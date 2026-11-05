/* js/app/voz-ao-vivo.js — Chamada de voz AO VIVO (Gemini Live API) · BETA.
   Conversa por voz em tempo real, como numa ligação: a pessoa fala, a IA responde falando e pode ser INTERROMPIDA no meio da frase.
   Para "pensar", a IA chama a função consultar_base_bsoft, que usa o MESMO banco de dados do chat (artigos, respostas aprovadas pela equipe,
   parâmetros, funcionalidades, rotinas e o menu real do sistema). Sem essa consulta ela não responde sobre o sistema.

   É GRÁTIS: usa o plano gratuito da API do Google (chave do AI Studio criada num projeto SEM cobrança ativada — assim nunca há cobrança).
   No plano gratuito o Google pode usar o conteúdo das conversas para melhorar os produtos dele: a tela da chamada avisa para não falar dados pessoais.

   LIGAR/DESLIGAR e a CHAVE ficam no painel administrativo (aba IA / MCP › "Voz ao vivo"), que grava config/mcp-config.js → "vozAoVivo": vale para TODOS
   que usam o sistema, sem ninguém colar chave nenhuma. Desligada por padrão. Se estiver desligada, faltar a chave, a conexão falhar ou o navegador não
   suportar, o 📞 cai na conversa rápida (js/app/conversa-voz.js) — e, dela, na chamada antiga (js/app/tela-arquivo-voz.js). Cada pessoa ainda pode
   escolher não usar a voz ao vivo no computador dela (Personalizar › Recursos em teste).

   De onde vem a credencial da conexão (em ordem):
     1) a chave do Google AI Studio guardada no painel (mcp-config.js, em pedaços) — conecta direto, sem servidor. Qualquer chave num site pode ser vista por
        quem abrir as ferramentas do desenvolvedor: use uma chave de projeto SEM cobrança (o pior que pode acontecer é gastar a cota grátis);
     2) sem chave, mas com "funcaoToken" no painel (avançado): um token temporário pedido à Edge Function do Supabase (supabase/functions/voz-token) —
        a chave do Google fica só no Supabase e nunca chega ao navegador.

   Protocolo (WebSocket, JSON): https://ai.google.dev/api/live — entrada de áudio PCM 16 bits a 16 kHz, saída PCM 16 bits a 24 kHz.
   Ajustes finos além do painel (opcional): config/app-config.js → "vozAoVivo": { modeloReserva, sensibilidadeInicio, silencioMs, ... } (ver PADRAO abaixo).
   A busca no banco fica em js/app/voz-consulta.js e a tela da chamada em js/app/painel-chamada.js (as duas servem também à conversa rápida, js/app/conversa-voz.js). */
'use strict';
const VozAoVivo = (() => {
    const PADRAO = {
        modelo: 'gemini-3.8-live',                                      // tem plano gratuito (https://ai.google.dev/gemini-api/docs/pricing)
        modeloReserva: 'gemini-2.5-flash-native-audio-preview-12-2025', // tentado se o Google disser que o 1º modelo não existe/não é aceito
        voz: 'Kore',                                                    // outras: Aoede, Leda, Zephyr, Puck, Charon, Orus, Fenrir…
        versaoApi: 'v1beta',
        limiteMinutos: 5,                                               // por chamada (poupa a cota gratuita); 0 = sem limite
        funcaoToken: '',                                                // nome da Edge Function que entrega o token temporário (vazio = usa a chave do painel)
        sensibilidadeInicio: 'START_SENSITIVITY_LOW',                   // LOW = menos "interrupções" por ruído/eco
        silencioMs: 700,                                                // silêncio que o Google espera para achar que a pessoa terminou de falar
        prefixoMs: 150
    };
    // A configuração do painel (MCP_CFG.vozAoVivo, de config/mcp-config.js) vale sobre o padrão; campo vazio no painel = fica o padrão (limiteMinutos 0 = sem limite).
    const doPainel = () => (typeof MCP_CFG !== 'undefined' && MCP_CFG && MCP_CFG.vozAoVivo) || {};
    const cfg = () => {
        const m = doPainel(), o = {};
        if (m.modelo) o.modelo = m.modelo;
        if (m.voz) o.voz = m.voz;
        if (m.funcaoToken) o.funcaoToken = m.funcaoToken;
        if (m.limiteMinutos !== undefined && m.limiteMinutos !== null && m.limiteMinutos !== '') o.limiteMinutos = Number(m.limiteMinutos) || 0;
        return Object.assign({}, PADRAO, (window.BSOFT_CONFIG && window.BSOFT_CONFIG.vozAoVivo) || {}, o);
    };
    const HOST = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.';
    const REST_MODELOS = 'https://generativelanguage.googleapis.com/v1beta/models';

    let C = null;   // a chamada em andamento (null = nenhuma)

    // ── utilidades ──
    const $id = id => document.getElementById(id);
    const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();
    const espera = ms => new Promise(r => setTimeout(r, ms));
    function paraBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
    function pcmDeBase64(b64) {   // PCM 16 bits little-endian → Float32 (-1…1)
        const bin = atob(b64), n = bin.length >> 1, out = new Float32Array(n);
        for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v & 0x8000) v -= 0x10000; out[i] = v / 32768; }
        return out;
    }
    // (a chave vai na URL do WebSocket: se alguma mensagem do navegador a citar, ela nunca chega à tela)
    function erroVoz(tipo, amigavel, extra) { amigavel = String(amigavel).replace(/(key|access_token)=[^&\s'"]+/gi, '$1=***'); const e = new Error(amigavel); e.tipo = tipo; e.amigavel = amigavel; return Object.assign(e, extra || {}); }

    // ── disponibilidade ──
    function suporta() {
        return !!(window.WebSocket && (window.AudioContext || window.webkitAudioContext) && window.AudioWorkletNode && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    // ligada = o administrador ligou no painel (aba IA / MCP); liberada = ligada E com chave (ou função de token); disponivel = o que o 📞 pergunta antes de abrir a chamada.
    const ligada = () => doPainel().ativo === true;
    const chaveDoPainel = () => mcpJuntar(doPainel().chave).trim();
    const liberada = () => ligada() && !!(chaveDoPainel() || cfg().funcaoToken);
    function optouPorNao() { try { return !!Prefs.get('vozSemAoVivo'); } catch (e) { return false; } }   // escolha da própria pessoa (Personalizar): neste computador usa a conversa rápida
    function disponivel() { return !window.BSOFT_SIM && liberada() && !optouPorNao() && suporta(); }

    // Credencial da conexão: a chave do painel ou, sem ela, um token temporário da Edge Function (avançado).
    // Os parâmetros existem para o teste do painel usar valores que ainda não foram publicados.
    async function obterCredencial(chave = chaveDoPainel(), c = cfg()) {
        if (chave) return { modo: 'chave', valor: chave };
        if (!c.funcaoToken) throw erroVoz('sem-credencial', 'A voz ao vivo está ligada, mas falta a chave do Google no painel administrativo (aba IA / MCP › Voz ao vivo).');
        const B = window.BSOFT_CONFIG || {};
        let r;
        try {
            r = await fetch(`${B.supabaseUrl}/functions/v1/${c.funcaoToken}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + B.supabaseAnonKey, apikey: B.supabaseAnonKey }, body: '{}' });
        } catch (e) { throw erroVoz('sem-credencial', 'Não consegui falar com a função ' + c.funcaoToken + ' do Supabase (rede ou função não publicada).'); }
        let j = {}; try { j = await r.json(); } catch (e) { /* sem corpo */ }
        if (r.status === 429) throw erroVoz('limite', j.erro || 'Muitas chamadas seguidas. Tente de novo em alguns minutos.');
        if (!r.ok || !j.token) throw erroVoz('sem-credencial', r.status === 404 ? 'A função ' + c.funcaoToken + ' não existe no Supabase (falta publicá-la).' : (j.erro || 'Não consegui o token temporário da voz ao vivo (HTTP ' + r.status + ').'));
        return { modo: 'token', valor: j.token };
    }

    // ── o que a IA recebe: personalidade, regras e ferramentas ──
    function instrucaoDoSistema() {
        let hora = ''; try { hora = obterContextoHorario(); } catch (e) { /* sem a data: segue */ }
        return `Você é a assistente de VOZ do Suporte Bsoft TMS (sistema de gestão para transportadoras). ${hora}
FALE SEMPRE em português do Brasil, com voz calma, simpática e natural, em frases curtas, como numa ligação de suporte. Nunca mude de idioma.

COMO TRABALHAR
1. Para QUALQUER dúvida sobre o Bsoft TMS (telas, parâmetros, funcionalidades, CT-e, MDF-e, NF-e, NFS-e, SEFAZ, regras, relatórios, erros, cadastros…), chame SEMPRE a função consultar_base_bsoft ANTES de responder. Antes de chamar, diga uma frase bem curta, como "Só um instante, vou verificar.".
2. Responda SOMENTE com o que a consulta devolver. Se ela não trouxer a resposta, diga com sinceridade que não encontrou na base e faça UMA pergunta curta para entender melhor (qual tela, qual documento, qual mensagem de erro). NUNCA invente caminho de menu, parâmetro, campo, valor, passo ou código.
3. PRÉ-REQUISITO PRIMEIRO: se a consulta trouxer parâmetros ou funcionalidades que CONDICIONAM o que a pessoa quer fazer, comece por eles: "Antes de tudo, verifique…" — diga a DESCRIÇÃO do item (nunca o código ou número, veja a regra 14) e onde conferir; só depois dê o passo a passo.
4. CAMINHOS DE MENU: só cite caminhos que apareçam LITERALMENTE no resultado da consulta, na mesma ordem. Fale devagar, dizendo "depois" entre os níveis (ex.: "Cadastros, depois Pessoas, depois Pessoas").
5. PASSO A PASSO: dite poucos passos por vez (até 4), com pausa, e pergunte "Posso continuar?". Se a resposta for longa (muitos passos, fórmulas, tabelas), faça um resumo falado e ofereça deixar a resposta COMPLETA por escrito no chat; se a pessoa aceitar, chame mostrar_resposta_completa_no_chat.
6. Em voz, não leia links, símbolos, markdown, emojis nem trechos de código.
7. Seja breve: de uma a três frases quando der. Não repita a pergunta da pessoa.
8. Diferencie CT-e, MDF-e, NF-e (mercadoria), NFS-e (serviço), CIOT e VPO. Se a pessoa disser só "nota fiscal" e isso mudar a resposta, pergunte qual.
9. Latitude e longitude: você não consulta mapas e nunca inventa coordenadas; oriente a mandar o endereço escrito no chat.
10. Criar regra, montar relatório e buscar parâmetro na tela: oriente a abrir as abas Regras, Relatórios ou Parâmetros do sistema; por voz você só explica e orienta.
11. Se a pessoa se despedir ("tchau", "pode desligar", "era só isso, obrigado"), despeça-se numa frase e chame encerrar_chamada.
12. Se o assunto não for o sistema, diga gentilmente que só ajuda com o Bsoft TMS.
13. Não peça CPF, CNPJ, senhas nem dados pessoais; se a pessoa disser algum, não o repita.
14. ⛔ REGRA INEGOCIÁVEL, A MAIS IMPORTANTE: NUNCA fale o código (número) de parâmetro ou funcionalidade — nada de "parâmetro mil cento e dezessete" nem "funcionalidade trezentos e quinze" —, nem quando a consulta trouxer o número. Os códigos não seguem mais um padrão e falar o número só atrapalha a pessoa a achar o item na tela. Diga SEMPRE só o NOME do item (a Descrição, como aparece na tela); se a consulta não trouxer o nome, descreva o item pelo que ele faz. Esta regra vale mais do que qualquer outra.`;
    }
    const FERRAMENTAS = [{ functionDeclarations: [
        { name: 'consultar_base_bsoft',
            description: 'Consulta o banco de dados oficial do Bsoft TMS (artigos de suporte, respostas aprovadas pela equipe, parâmetros, funcionalidades, rotinas e o menu real do sistema). Chame SEMPRE antes de responder qualquer dúvida sobre o sistema.',
            parameters: { type: 'OBJECT', properties: { pergunta: { type: 'STRING', description: 'A dúvida da pessoa, completa e que se entenda sozinha, em português (inclua o tipo de documento, a tela ou o código do erro, se houver).' } }, required: ['pergunta'] } },
        { name: 'mostrar_resposta_completa_no_chat',
            description: 'Escreve no chat a resposta COMPLETA e detalhada (passo a passo inteiro) de uma pergunta. Use só depois que a pessoa aceitar ver por escrito.',
            parameters: { type: 'OBJECT', properties: { pergunta: { type: 'STRING', description: 'A dúvida a ser respondida por escrito no chat.' } }, required: ['pergunta'] } },
        { name: 'encerrar_chamada', description: 'Encerra a ligação. Chame depois de se despedir, quando a pessoa se despedir ou disser que não precisa de mais nada.' }
    ] }];

    function montarSetup(modelo, handle, c = cfg()) {
        return {
            model: 'models/' + modelo,
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: c.voz } } } },
            systemInstruction: { parts: [{ text: instrucaoDoSistema() }] },
            tools: FERRAMENTAS,
            realtimeInputConfig: { automaticActivityDetection: { startOfSpeechSensitivity: c.sensibilidadeInicio, prefixPaddingMs: c.prefixoMs, silenceDurationMs: c.silencioMs } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            contextWindowCompression: { slidingWindow: {} },   // sem isso a conversa para em ~15 minutos
            sessionResumption: handle ? { handle } : {}         // permite retomar a conversa se a conexão cair
        };
    }

    // ── conexão (WebSocket) ──
    function erroDeFechamento(ev) {
        const cod = ev && ev.code, mot = limpar(ev && ev.reason);
        let am;
        if (/quota|exhausted|rate.?limit|429/i.test(mot)) am = 'O limite gratuito do Google foi atingido por agora. Tente de novo em alguns minutos.';
        else if (/api key|permission|denied|unauthenticated|expired|token/i.test(mot) || cod === 1008) am = 'O Google recusou a conexão' + (mot ? ': ' + mot : ' (chave inválida, sem permissão ou token vencido).');
        else if (cod === 1007 || /invalid|not found|unsupported|model/i.test(mot)) am = 'O Google não aceitou a configuração da chamada' + (mot ? ': ' + mot : '.');
        else if (cod === 1006 || !cod) am = 'Não consegui conectar ao Google (rede, chave inválida ou bloqueio de firewall).';
        else am = `A conexão com o Google foi encerrada (código ${cod}${mot ? ': ' + mot : ''}).`;
        return erroVoz('fechou', am, { codigo: cod, motivo: mot });
    }
    // Abre a conexão e só devolve depois do "setupComplete" do Google. Depois disso as mensagens e o fechamento seguem para a chamada em andamento (C).
    function abrirSessao(cred, modelo, handle, c = cfg()) {
        return new Promise((resolve, reject) => {
            const base = HOST + c.versaoApi + '.GenerativeService.';
            const url = cred.modo === 'token' ? base + 'BidiGenerateContentConstrained?access_token=' + encodeURIComponent(cred.valor) : base + 'BidiGenerateContent?key=' + encodeURIComponent(cred.valor);
            let ws = null, feito = false;
            const falha = e => { if (feito) return; feito = true; clearTimeout(tempo); try { ws && ws.close(); } catch (x) { /* já fechou */ } reject(e); };
            const tempo = setTimeout(() => falha(erroVoz('timeout', 'O Google não respondeu em 15 segundos.')), 15000);
            try { ws = new WebSocket(url); } catch (e) { falha(erroVoz('ws', 'Não consegui abrir a conexão: ' + e.message)); return; }
            ws.onopen = () => { try { ws.send(JSON.stringify({ setup: montarSetup(modelo, handle, c) })); } catch (e) { falha(erroVoz('ws', 'Não consegui enviar a configuração: ' + e.message)); } };
            ws.onmessage = async ev => {
                if (feito) return;
                const msg = await lerMensagem(ev.data);
                if (feito || !msg) return;
                if (msg.setupComplete) {
                    feito = true; clearTimeout(tempo);
                    ws.onmessage = e2 => enfileirar(ws, e2);
                    ws.onclose = e2 => aoFechar(ws, e2);
                    resolve(ws);
                }
            };
            ws.onerror = () => { /* os detalhes vêm no evento de fechamento */ };
            ws.onclose = ev => falha(erroDeFechamento(ev));
        });
    }
    // O Google fecha com o código 1007 tanto para "chave inválida" quanto para "modelo/configuração inválidos" (testado de verdade): só o TEXTO do motivo diz qual foi.
    const modeloPareceErrado = e => !!e && !!e.motivo && !/api key|token|permission|denied|quota|exhausted|billing/i.test(e.motivo) && /model|not found|unsupported|not supported/i.test(e.motivo);
    // Tenta o modelo principal; se o Google disser que ele não existe/não é aceito, tenta o de reserva.
    async function abrirComModelos(cred, handle, c = cfg()) {
        let ultimo = null;
        for (const m of [c.modelo, c.modeloReserva].filter((x, i, a) => x && a.indexOf(x) === i)) {
            try { const ws = await abrirSessao(cred, m, handle, c); return { ws, modelo: m }; }
            catch (e) { ultimo = e; if (!modeloPareceErrado(e)) throw e; console.warn('[voz ao vivo] modelo', m, 'não aceito:', e.message); }
        }
        throw ultimo;
    }
    async function lerMensagem(d) {
        try {
            let txt = d;
            if (typeof d !== 'string') txt = (typeof Blob !== 'undefined' && d instanceof Blob) ? await d.text() : new TextDecoder().decode(d);
            return JSON.parse(txt);
        } catch (e) { return null; }
    }
    // As mensagens do Google são tratadas uma de cada vez, na ordem em que chegaram.
    function enfileirar(ws, ev) {
        const c = C; if (!c) return;
        c.fila = c.fila.then(() => lerMensagem(ev.data)).then(msg => { if (msg && C === c && c.ws === ws) tratar(msg); }).catch(e => console.warn('[voz ao vivo] mensagem:', e));
    }
    function enviar(obj) { const c = C; if (c && c.ws && c.ws.readyState === 1) { try { c.ws.send(JSON.stringify(obj)); return true; } catch (e) { /* conexão caindo */ } } return false; }
    function aoFechar(ws, ev) {
        const c = C; if (!c || c.ws !== ws || c.encerrando || c.reconectando) return;
        if (c.fecharAoFinal) { encerrar('despedida'); return; }
        const fatal = ev.code === 1007 || ev.code === 1008;
        if (!fatal && c.tentativas < 2) { c.tentativas++; reconectar(); return; }
        encerrar('erro', erroDeFechamento(ev).amigavel);
    }
    async function reconectar() {
        const c = C; if (!c || c.reconectando || c.encerrando) return;
        c.reconectando = true; c.pronto = false; fase('conectando');
        try {
            const cred = c.credencial.modo === 'token' ? await obterCredencial() : c.credencial;   // token novo a cada conexão
            const ws = await abrirSessao(cred, c.modelo, c.handle);
            if (C !== c || c.encerrando) { try { ws.close(); } catch (e) { /* já fechou */ } return; }
            const velho = c.ws; c.ws = ws; try { if (velho) { velho.onclose = null; velho.onmessage = null; velho.close(); } } catch (e) { /* já fechou */ }
            c.pronto = true; fase(c.fontes.size ? 'falando' : 'ouvindo');
        } catch (e) { if (C === c) encerrar('erro', 'A conexão com o Google caiu e não consegui retomar. ' + (e.amigavel || e.message)); }
        finally { c.reconectando = false; }
    }
    // O Google avisa que vai encerrar a conexão (limite de ~10 min): retoma com o "handle" quando a IA estiver quieta (ou perto do prazo).
    function aoGoAway(tl) {
        const c = C; if (!c) return;
        const seg = parseFloat(String(tl || '').replace('s', '')) || 10;
        const limite = Date.now() + Math.max(1000, (seg - 4) * 1000);
        clearInterval(c.timerOcioso);
        c.timerOcioso = setInterval(() => { if (C !== c) { clearInterval(c.timerOcioso); return; } if ((!emFala() && !c.consultando) || Date.now() >= limite) { clearInterval(c.timerOcioso); reconectar(); } }, 400);
    }

    // ── microfone: captura em 16 kHz via AudioWorklet ──
    const CODIGO_WORKLET = `
class CapturaBsoft extends AudioWorkletProcessor {
    constructor() { super(); this.razao = sampleRate / 16000; this.soma = 0; this.cont = 0; this.t = 0; this.quadro = new Int16Array(640); this.n = 0; this.e2 = 0; this.ne = 0; }
    process(entradas) {
        const ch = entradas[0] && entradas[0][0];
        if (!ch) return true;
        for (let i = 0; i < ch.length; i++) {
            const x = ch[i];
            this.soma += x; this.cont++; this.e2 += x * x; this.ne++; this.t += 1;
            if (this.t >= this.razao) {
                this.t -= this.razao;
                let v = this.soma / this.cont; this.soma = 0; this.cont = 0;
                v = v > 1 ? 1 : v < -1 ? -1 : v;
                this.quadro[this.n++] = v < 0 ? v * 32768 : v * 32767;
                if (this.n === this.quadro.length) {
                    const rms = Math.sqrt(this.e2 / Math.max(1, this.ne)); this.e2 = 0; this.ne = 0;
                    this.port.postMessage({ pcm: this.quadro.buffer, nivel: rms }, [this.quadro.buffer]);
                    this.quadro = new Int16Array(640); this.n = 0;
                }
            }
        }
        return true;
    }
}
registerProcessor('captura-bsoft', CapturaBsoft);`;

    function criarContextosDeAudio() {   // dentro do clique do usuário (política de autoplay do navegador)
        const AC = window.AudioContext || window.webkitAudioContext;
        C.ctxMic = new AC({ latencyHint: 'interactive' });
        C.ctxSaida = new AC({ latencyHint: 'interactive' });
        C.ganho = C.ctxSaida.createGain(); C.ganho.connect(C.ctxSaida.destination);
        [C.ctxMic, C.ctxSaida].forEach(x => { try { x.resume(); } catch (e) { /* tenta de novo depois */ } });
    }
    async function iniciarMicrofone() {
        const c = C;
        c.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        c.urlWorklet = URL.createObjectURL(new Blob([CODIGO_WORKLET], { type: 'application/javascript' }));
        await c.ctxMic.audioWorklet.addModule(c.urlWorklet);
        const fonte = c.ctxMic.createMediaStreamSource(c.stream);
        c.no = new AudioWorkletNode(c.ctxMic, 'captura-bsoft', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
        c.no.port.onmessage = ev => aoQuadroDoMicrofone(ev.data);
        const mudo = c.ctxMic.createGain(); mudo.gain.value = 0;   // o nó precisa chegar ao destino para o navegador processá-lo; sem som
        fonte.connect(c.no); c.no.connect(mudo); mudo.connect(c.ctxMic.destination);
        c.silencio = mudo;
        try { await Promise.race([c.ctxMic.resume(), espera(1500)]); } catch (e) { /* segue */ }
    }
    function aoQuadroDoMicrofone(d) {
        const c = C; if (!c || !d) return;
        c.nivel = d.nivel || 0;
        if (c.mudo || !c.pronto || !c.ws || c.ws.readyState !== 1) return;
        if (c.semFone && emFala()) return;   // sem fone, o microfone ouviria a própria IA — não deixa interromper enquanto ela fala
        if (c.ws.bufferedAmount > 1048576) return;
        enviar({ realtimeInput: { audio: { data: paraBase64(new Uint8Array(d.pcm)), mimeType: 'audio/pcm;rate=16000' } } });
    }

    // ── fala da IA: fila de áudio sem emendas ──
    const emFala = () => !!C && (C.fontes.size > 0 || performance.now() < C.silencioAte);
    function tocar(b64, mime) {
        const c = C; if (!c || !c.ctxSaida) return;
        const taxa = parseInt((/rate=(\d+)/.exec(mime || '') || [])[1], 10) || 24000;
        const pcm = pcmDeBase64(b64); if (!pcm.length) return;
        const buf = c.ctxSaida.createBuffer(1, pcm.length, taxa); buf.getChannelData(0).set(pcm);
        const src = c.ctxSaida.createBufferSource(); src.buffer = buf; src.connect(c.ganho);
        const t = Math.max(c.ctxSaida.currentTime + 0.03, c.proximo); src.start(t); c.proximo = t + buf.duration;
        c.fontes.add(src);
        src.onended = () => { c.fontes.delete(src); c.silencioAte = performance.now() + 350; if (!c.fontes.size) setTimeout(() => aoFimDaFala(c), 300); };
    }
    function pararSaida(c) {   // interrupção (ou fim da chamada): corta o que ainda não foi falado
        c = c || C; if (!c) return;
        c.fontes.forEach(s => { s.onended = null; try { s.stop(); } catch (e) { /* já terminou */ } });
        c.fontes.clear(); c.proximo = 0; c.silencioAte = performance.now() + 200;
    }
    function aoFimDaFala(c) {
        if (C !== c || c.fontes.size || c.encerrando) return;
        if (c.turnoCompleto && !c.consultando) { fase('ouvindo'); if (c.fecharAoFinal) setTimeout(() => encerrar('despedida'), 500); }
    }

    // ── mensagens do Google ──
    function tratar(msg) {
        const c = C; if (!c) return;
        const sc = msg.serverContent;
        if (sc) {
            if (sc.interrupted) { pararSaida(c); c.turnoCompleto = true; confirmarTurno('interrompido'); fase('ouvindo'); }
            if (sc.inputTranscription && sc.inputTranscription.text) pedacoDaFala(sc.inputTranscription.text);
            if (sc.outputTranscription && sc.outputTranscription.text) pedacoDaResposta(sc.outputTranscription.text);
            const partes = sc.modelTurn && sc.modelTurn.parts;
            if (partes) partes.forEach(p => { if (p.inlineData && p.inlineData.data) { iniciouModelo(); c.turnoCompleto = false; tocar(p.inlineData.data, p.inlineData.mimeType); fase('falando'); } });
            if (sc.turnComplete) { c.turnoCompleto = true; confirmarTurno('completo'); if (!c.fontes.size) setTimeout(() => aoFimDaFala(c), 300); }
        }
        if (msg.toolCall && msg.toolCall.functionCalls) executarChamadas(msg.toolCall.functionCalls);
        if (msg.toolCallCancellation && msg.toolCallCancellation.ids) msg.toolCallCancellation.ids.forEach(id => c.cancelados.add(id));
        if (msg.sessionResumptionUpdate && msg.sessionResumptionUpdate.resumable && msg.sessionResumptionUpdate.newHandle) c.handle = msg.sessionResumptionUpdate.newHandle;
        if (msg.goAway) aoGoAway(msg.goAway.timeLeft);
    }

    // ── vez de falar: junta as transcrições, mostra as legendas e grava no chat e no log ──
    const novoTurno = () => ({ fala: '', falaDepois: '', resp: '', modeloIniciou: false, ts: null, fontes: null, consultou: false });
    function iniciouModelo() { if (C) C.turno.modeloIniciou = true; }
    function pedacoDaFala(t) {
        const c = C, T = c.turno;
        if (c.legendaNova) { c.legendaNova = false; PainelChamada.legendaResposta(''); }
        if (T.modeloIniciou) T.falaDepois += t; else T.fala += t;
        PainelChamada.legendaFala(T.fala + T.falaDepois);
    }
    function pedacoDaResposta(t) {
        const c = C, T = c.turno;
        if (c.legendaNova) { c.legendaNova = false; PainelChamada.legendaResposta(''); }
        T.modeloIniciou = true; T.resp += t;
        PainelChamada.legendaResposta(semCodigo(T.resp));
    }
    // Regra "nunca o código (número) de parâmetro/funcionalidade": o áudio não dá para corrigir depois de falado (por isso a instrução e o conhecimento já vão sem o número), mas o que fica ESCRITO — legenda e chat — sai sem ele.
    const semCodigo = t => { try { return typeof _semCodigoParam === 'function' ? _semCodigoParam(t) : t; } catch (e) { return t; } };
    function confirmarTurno(motivo) {
        const c = C; if (!c) return;
        const T = c.turno, interrompido = motivo === 'interrompido';
        const fala = limpar(interrompido ? T.fala : T.fala + ' ' + T.falaDepois), resp = semCodigo(limpar(T.resp));
        const novo = novoTurno(); if (interrompido) novo.fala = T.falaDepois;   // o que a pessoa já disse por cima da IA vale para a próxima vez
        c.turno = novo; c.legendaNova = true;
        if (!fala && !resp) return;
        c.turnos++;
        try {
            if (fala) { appendMessage('user', '🎤 ' + esc(fala)); adicionarMensagemNaConversa('user', fala); }
            if (resp) { appendMessage('ai', esc(resp) + (interrompido ? ' <i>(interrompida)</i>' : '')); adicionarMensagemNaConversa('ai', esc(resp)); }
        } catch (e) { console.warn('[voz ao vivo] não consegui mostrar a conversa no chat:', e); }
        if (T.ts && resp) { try { registrarRespostaNoLog(T.ts, { resposta: resp, fonte: 'ia', modelo: 'Gemini Live (voz)', fontes: T.fontes, revisao: 'nao_se_aplica' }); } catch (e) { console.warn('[voz ao vivo] log:', e); } }
    }

    // ── ferramentas que a IA pode chamar ──
    async function executarChamadas(chamadas) {
        const c = C; if (!c) return;
        c.consultando = true; fase('pensando');
        const respostas = [];
        for (const fc of chamadas) {
            let resposta;
            try { resposta = await executar(fc); }
            catch (e) { console.warn('[voz ao vivo] ferramenta', fc.name, e); resposta = { erro: 'A consulta falhou (' + (e.message || e) + '). Peça desculpas e peça para a pessoa repetir a pergunta.' }; }
            if (!c.cancelados.has(fc.id)) respostas.push({ id: fc.id, name: fc.name, response: resposta });
        }
        if (C !== c) return;
        c.consultando = false;
        if (respostas.length) enviar({ toolResponse: { functionResponses: respostas } });
        if (!c.fontes.size && !respostas.length) fase('ouvindo');
    }
    async function executar(fc) {
        const args = fc.args || {};
        if (fc.name === 'consultar_base_bsoft') {
            const r = await Promise.race([VozConsulta.consultar(args.pergunta), espera(25000).then(() => { throw new Error('a consulta demorou demais'); })]);
            const c = C;
            if (c) {
                const T = c.turno; T.consultou = true; T.fontes = r.fontes;
                const falada = limpar(T.fala + ' ' + T.falaDepois), pergunta = limpar(args.pergunta);
                c.ultimaPergunta = falada || pergunta;
                if (!T.ts) { try { T.ts = logSearch(falada || pergunta, r.encontrou); } catch (e) { console.warn('[voz ao vivo] log:', e); } }   // 1 linha de log por pergunta, como no chat
                PainelChamada.fontes(r.titulos);
            }
            return { resultado: r.texto };
        }
        if (fc.name === 'mostrar_resposta_completa_no_chat') {
            const ok = mostrarNoChat(args.pergunta);
            return ok ? { resultado: 'Pronto: a resposta completa está sendo escrita no chat. Diga isso à pessoa em uma frase.' } : { erro: 'Não havia pergunta para escrever no chat.' };
        }
        if (fc.name === 'encerrar_chamada') { if (C) C.fecharAoFinal = true; return { resultado: 'Ok. Despeça-se em uma frase curta; a ligação encerra sozinha em seguida.' }; }
        return { erro: 'Função desconhecida: ' + fc.name };
    }
    function mostrarNoChat(pergunta) {   // a resposta escrita COMPLETA (com todas as regras, log e 👍/👎) sai do chat normal
        const q = limpar(pergunta) || (C && C.ultimaPergunta) || '';
        if (!q) return false;
        const p = $id('voiceCallPanel'); if (p && !p.classList.contains('minimized') && typeof toggleMinimizeCall === 'function') toggleMinimizeCall();
        try { if (typeof Workspace !== 'undefined' && Workspace.showChat) Workspace.showChat(); } catch (e) { /* sem abas */ }
        if (typeof fillAndSend === 'function') fillAndSend(q); else { $id('searchInput').value = q; handleChat(); }
        return true;
    }

    // ── tela da chamada (js/app/painel-chamada.js) ──
    function fase(f) {
        const c = C; if (!c) return;
        c.fase = f; c.faseDesde = Date.now();
        PainelChamada.fase(f === 'pensando' ? 'consultando' : f, { mudo: c.mudo });
    }
    function montarPainel() {
        return PainelChamada.montar({
            semFone: C.semFone,
            aviso: 'Conversa processada pela API gratuita do Google (Gemini). Não fale dados pessoais de clientes.',
            aoMudo: () => alternarMudo(), aoFone: () => alternarFone(),
            aoChat: () => { if (!mostrarNoChat('')) { try { Toast.show('Ainda não houve nenhuma pergunta nesta chamada.', { kind: 'warn' }); } catch (e) { /* sem aviso */ } } }
        });
    }
    function alternarMudo() {
        const c = C; if (!c) return;
        c.mudo = !c.mudo; PainelChamada.mudo(c.mudo);
        if (c.mudo) enviar({ realtimeInput: { audioStreamEnd: true } });
        fase(c.fase);
    }
    function alternarFone() { const c = C; if (!c) return; c.semFone = !c.semFone; PainelChamada.gravarFone(c.semFone); PainelChamada.semFone(c.semFone); }
    function sinal() {   // "ding" curto: a ligação está pronta
        try { const x = C.ctxSaida, t = x.currentTime, o = x.createOscillator(), g = x.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(x.destination); o.start(t); o.stop(t + 0.22); } catch (e) { /* sem som: não atrapalha */ }
    }
    function relogio() {   // cronômetro e limite de tempo da chamada
        const c = C; if (!c) return;
        const seg = Math.floor((Date.now() - c.inicio) / 1000), lim = (parseFloat(cfg().limiteMinutos) || 0) * 60;
        const s = lim ? Math.max(0, Math.ceil(lim - seg)) : seg;
        PainelChamada.tempo(String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + (lim ? ' restantes' : ''), !!lim && lim - seg <= 30);
        if (lim && seg >= lim) { encerrar('limite'); return; }
        if (c.fase === 'pensando' && !c.consultando && Date.now() - c.faseDesde > 30000) fase('ouvindo');   // o Google não respondeu depois da consulta: não deixa a tela presa em "Consultando…"
    }

    // ── começo e fim da chamada ──
    function novaChamada() {
        return { ws: null, credencial: null, modelo: '', pronto: false, encerrando: false, reconectando: false, consultando: false, fase: 'conectando', inicio: Date.now(), mudo: false,
            semFone: PainelChamada.lerFone(false), stream: null, ctxMic: null, ctxSaida: null, ganho: null, no: null, silencio: null, urlWorklet: null, fontes: new Set(), proximo: 0, silencioAte: 0,
            handle: '', tentativas: 0, nivel: 0, turno: novoTurno(), turnos: 0, ultimaPergunta: '', cancelados: new Set(), fecharAoFinal: false, turnoCompleto: true, legendaNova: false,
            tick: 0, timerOcioso: 0, fila: Promise.resolve() };
    }
    function mensagemDeErro(e) {
        if (e && e.amigavel) return e.amigavel;
        const nome = e && e.name;
        if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'O navegador não liberou o microfone. Clique no cadeado ao lado do endereço do site e permita o microfone.';
        if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'Não encontrei um microfone neste computador.';
        return 'Não consegui iniciar a voz ao vivo: ' + ((e && e.message) || e);
    }
    async function iniciar() {
        if (C) { const p = $id('voiceCallPanel'); if (p && p.classList.contains('minimized') && typeof toggleMinimizeCall === 'function') toggleMinimizeCall(); return; }
        C = novaChamada(); const c = C;
        montarPainel(); fase('conectando');
        try {
            criarContextosDeAudio();
            c.credencial = await obterCredencial();
            await iniciarMicrofone();                                  // pede o microfone primeiro: se a pessoa negar, nem chega a conectar
            const r = await abrirComModelos(c.credencial, '');
            if (C !== c) { try { r.ws.close(); } catch (e) { /* já encerrou */ } return; }
            c.ws = r.ws; c.modelo = r.modelo; c.pronto = true; c.inicio = Date.now();
            c.tick = setInterval(() => { relogio(); PainelChamada.nivel((C && !C.mudo ? C.nivel : 0) * 8); }, 120);
            fase('ouvindo'); sinal();
        } catch (e) {
            if (C !== c) return;
            const msg = mensagemDeErro(e), semMic = e && (e.name === 'NotAllowedError' || e.name === 'NotFoundError' || e.name === 'SecurityError');
            console.warn('[voz ao vivo] não iniciou:', e);
            limparChamada(c);
            if (semMic || typeof toggleVoiceClassico !== 'function') { try { Toast.show(msg, { kind: 'warn', ms: 8000 }); } catch (x) { alert(msg); } return; }
            const rapida = typeof ConversaVoz !== 'undefined' && ConversaVoz.disponivel();   // reserva: a conversa rápida (voz do navegador + IA gratuita); sem ela, a chamada antiga
            try { Toast.show(msg + (rapida ? ' Abri a conversa por voz rápida.' : ' Abri a chamada de voz comum.'), { kind: 'warn', ms: 9000 }); } catch (x) { /* sem aviso */ }
            if (rapida && ConversaVoz.iniciar()) return;
            toggleVoiceClassico();
        }
    }
    function limparChamada(c) {   // solta microfone, áudio e conexão e esconde a tela
        c.encerrando = true; if (C === c) C = null;
        clearInterval(c.tick); clearInterval(c.timerOcioso);
        pararSaida(c);
        try { if (c.ws) { c.ws.onclose = null; c.ws.onmessage = null; c.ws.close(1000); } } catch (e) { /* já fechou */ }
        try { if (c.stream) c.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* já parou */ }
        try { if (c.no) { c.no.port.onmessage = null; c.no.disconnect(); } if (c.silencio) c.silencio.disconnect(); } catch (e) { /* já solto */ }
        try { if (c.ctxMic) c.ctxMic.close(); if (c.ctxSaida) c.ctxSaida.close(); } catch (e) { /* já fechou */ }
        try { if (c.urlWorklet) URL.revokeObjectURL(c.urlWorklet); } catch (e) { /* sem URL */ }
        PainelChamada.desmontar();
    }
    function encerrar(motivo, mensagem) {
        const c = C; if (!c) return;
        if (!c.encerrando) { try { confirmarTurno('completo'); } catch (e) { /* o resto do encerramento é mais importante */ } }
        const seg = Math.round((Date.now() - c.inicio) / 1000), turnos = c.turnos;
        limparChamada(c);
        const dur = `${Math.floor(seg / 60)}min${String(seg % 60).padStart(2, '0')}s`;
        const nota = motivo === 'limite' ? ` Chegou ao limite de ${cfg().limiteMinutos} minutos por chamada — toque em 📞 para ligar de novo.`
            : motivo === 'erro' ? ` ⚠️ ${esc(mensagem || 'A conexão caiu.')}` : '';
        try { appendMessage('system', `📞 <b>Chamada de voz ao vivo encerrada</b> (${dur}, ${turnos} troca${turnos === 1 ? '' : 's'} de fala).${nota}`); } catch (e) { /* sem chat */ }
        if (motivo === 'erro') { try { Toast.show(mensagem || 'A conexão com o Google caiu.', { kind: 'warn', ms: 8000 }); } catch (e) { /* sem aviso */ } }
    }

    // ── teste da chave (botão "Testar conexão" do painel administrativo, aba IA / MCP) ──
    // Sem argumentos testa o que está publicado; o painel passa a chave e as opções do rascunho (ainda não publicadas). Não precisa de microfone.
    async function testarConexao(chaveDigitada, extra) {
        const c = cfg();
        Object.keys(extra || {}).forEach(k => { if (extra[k] !== undefined && extra[k] !== null && extra[k] !== '') c[k] = extra[k]; });
        const chave = String(chaveDigitada === undefined ? chaveDoPainel() : (chaveDigitada || '')).trim();
        let cred;
        if (chave) {
            try {   // 1) a chave existe e vale?
                const r = await fetch(REST_MODELOS + '?pageSize=1&key=' + encodeURIComponent(chave));
                if (!r.ok) { let m = 'HTTP ' + r.status; try { const j = await r.json(); m = (j.error && j.error.message) || m; } catch (e) { /* sem corpo */ } return { ok: false, mensagem: '❌ O Google recusou a chave: ' + m }; }
            } catch (e) { /* rede ou bloqueio do navegador: a prova de verdade é a conexão de voz logo abaixo */ }
            cred = { modo: 'chave', valor: chave };
        } else if (c.funcaoToken) {
            try { cred = await obterCredencial('', c); } catch (e) { return { ok: false, mensagem: '❌ ' + (e.amigavel || e.message) }; }
        } else return { ok: false, mensagem: 'Cole a chave do Google AI Studio no campo e tente de novo.' };
        try {   // 2) a conexão de voz ao vivo abre (com a mesma configuração da chamada)?
            const r = await abrirComModelos(cred, '', c);
            try { r.ws.onclose = null; r.ws.onmessage = null; r.ws.close(1000); } catch (e) { /* já fechou */ }
            return { ok: true, mensagem: `✅ Tudo certo: ${cred.modo === 'chave' ? 'a chave vale e a' : 'o token foi entregue e a'} voz ao vivo conectou (modelo ${r.modelo}).` };
        } catch (e) { return { ok: false, mensagem: '❌ ' + (e.amigavel || e.message) }; }
    }

    return { disponivel, ligada, liberada, suporta, iniciar, encerrar, ativa: () => !!C, estado: () => C ? { fase: C.fase, turnos: C.turnos, mudo: C.mudo, pronto: C.pronto, falando: emFala(), modelo: C.modelo } : null,
        testarConexao, config: cfg, consultarBase: p => VozConsulta.consultar(p) };
})();
window.VozAoVivo = VozAoVivo;
