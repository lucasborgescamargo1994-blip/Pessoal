/* js/app/conversa-voz.js — CONVERSA RÁPIDA POR VOZ (o 📞 padrão). 100% grátis e sem chave: voz do navegador + IA gratuita já usada no chat.
   Motor À PARTE do handleChat. A chamada antiga passava cada pergunta pelo chat inteiro (botões, "resposta curta ou completa", "não omita nada…"), esperava o texto
   COMPLETO e só então pedia o áudio — por isso era lenta e cortava as respostas longas. Aqui o caminho é curto e feito para conversar:
     1. ouve com o reconhecimento de voz do navegador e detecta o fim da frase sozinho (~0,5–0,9 s de silêncio, mais se a frase parecer incompleta);
     2. já vai buscando no banco de dados enquanto a pessoa termina de falar (js/app/voz-consulta.js, contexto enxuto);
     3. pede à IA uma resposta CURTA (1–3 frases) com o "raciocínio" desligado — é isso que tira os 4–7 s de espera dos modelos que "pensam" —
        e escolhe sozinha o modelo mais rápido da cadeia (placar no localStorage; modelo que não fala em ~5 s é pulado);
     4. fala cada frase assim que ela fica pronta (não espera o texto inteiro) e, se a IA demorar, solta um "deixa eu ver…" como uma pessoa faria;
     5. a pessoa pode interromper (botão ✋, toque no círculo e, com fone, falando); "continua" segue de onde parou.
   Cada troca aparece no chat e gera 1 linha de log (como a voz ao vivo). Se a opção "chamada de voz antiga" estiver ligada em Ajustes, nada disto é usado.
   A tela da chamada é js/app/painel-chamada.js; a busca no banco, js/app/voz-consulta.js. Ajustes finos: config/app-config.js → "conversaVoz": { … } (ver PADRAO). */
'use strict';
const ConversaVoz = (() => {
    const PADRAO = {
        escala: 0.45,            // quanto do contexto do banco vai para a IA (1 = cheio): menos texto = primeira palavra mais rápida
        artigos: 3,              // artigos do banco que entram
        maxTokens: 120,          // limite duro do tamanho da resposta pedida à IA; se bater nele, a última frase solta é descartada e ele oferece continuar
        maxFrases: 2,            // quanto a assistente FALA de cada vez (os modelos gratuitos ignoram "seja breve"): depois disso corta a IA e pergunta "Quer que eu continue?"
        maxPalavras: 45,         // idem, em palavras (o que vier primeiro)
        temperatura: 0.4,
        fimTurnoMs: 500,         // silêncio depois da última palavra quando o navegador já fechou a frase
        fimTurnoInterimMs: 800,  // idem, quando ainda não fechou (usa o que já ouviu)
        fimTurnoExtraMs: 600,    // soma se a frase parece incompleta ("eu queria saber como…")
        esperaFraseMs: 1700,     // sem 1ª frase da IA depois disso (medido: a resposta costuma começar em ~1–1,6 s), fala um "deixa eu ver…" — antes disso o "um instante" só atrasaria a resposta
        primeiraPalavraMs: 5500, // espera máxima pela 1ª palavra de um modelo antes de tentar o próximo
        semDadosMs: 9000,        // parou de chegar texto no meio da resposta: encerra com o que já veio
        taxaFala: 1.08,          // velocidade da voz (1 = normal)
        historico: 8,            // mensagens da conversa que a IA lembra (4 trocas)
        cadeiaVoz: null          // lista própria de modelos (opcional): [{ model, provider, apiKey, baseUrl, label }]; vazio = a cadeia do chat
    };
    const cfg = () => Object.assign({}, PADRAO, (window.BSOFT_CONFIG && window.BSOFT_CONFIG.conversaVoz) || {});
    const LS_PLACAR = 'bsoft_voz_modelos';

    const INSTRUCOES = `Você é a assistente de voz do Suporte Bsoft TMS (sistema para transportadoras), numa LIGAÇÃO com a pessoa. Fale como uma pessoa de verdade ao telefone: natural, simpática e direta, em português do Brasil.
COMO FALAR
- Responda com NO MÁXIMO 2 frases curtas (uns 30 palavras). Uma ideia por vez; o resto fica para quando a pessoa pedir. Nada de listas, títulos, negrito, símbolos, links nem códigos.
- Vocês já estão conversando: NÃO cumprimente de novo, não diga "olá", não repita a pergunta e não comece com "claro" ou "com certeza".
- Passo a passo: diga só os 2 primeiros passos e pergunte "Quer que eu continue?". Se a pessoa pedir para continuar, siga de onde parou, SEM repetir o que já disse.
- Só termine com pergunta quando for passo a passo ("Quer que eu continue?") ou quando faltar uma informação para ajudar. Resposta simples termina sem pergunta.
- Caminho de menu: fale com "depois" entre os níveis ("Transporte, depois Documentos, depois CT-e"), copiando os nomes do conhecimento, sem repetir palavras nem acrescentar níveis.
REGRAS
1. Use SÓ o CONHECIMENTO abaixo. Nunca invente caminho de menu, parâmetro, campo, valor ou passo. Só cite caminho de menu que esteja LITERALMENTE no conhecimento.
2. Se o conhecimento trouxer parâmetro ou funcionalidade que CONDICIONA o que a pessoa quer (seção "PARÂMETROS E FUNCIONALIDADES RELACIONADOS"), comece por ele: "Antes de tudo, confira…" e diga onde conferir, copiando o caminho que o conhecimento indica para parâmetros ou para funcionalidades (são caminhos diferentes).
   NUNCA fale o número/código de um parâmetro ou funcionalidade (nada de "funcionalidade 315"): diga só o NOME (a Descrição).
3. Se o conhecimento não responder, diga com sinceridade que não encontrou e faça UMA pergunta para entender melhor (qual tela, qual documento, qual mensagem de erro).
4. Diferencie CT-e, MDF-e, NF-e (mercadoria) e NFS-e (serviço). Não peça nem repita CPF, CNPJ ou senhas.
5. ⛔ REGRA INEGOCIÁVEL, A MAIS IMPORTANTE: NUNCA fale o código (número) de parâmetro ou funcionalidade — nada de "parâmetro mil cento e dezessete" nem "funcionalidade 315" —, nem quando o conhecimento trouxer o número. Os códigos não seguem mais um padrão e falar o número só atrapalha a pessoa a achar o item na tela. Diga SEMPRE só o NOME do item (a Descrição, como aparece na tela); se o conhecimento não trouxer o nome, descreva o item pelo que ele faz. Esta regra vale mais do que qualquer outra.`;

    const FILLERS = ['Um instante…', 'Deixa eu ver…', 'Hum, só um segundo…', 'Já vejo isso…', 'Certo, um momento…'];   // curtos: se a resposta chegar enquanto um deles toca, ela espera pouco
    const COMANDO_CURTO = /^(sim|n[aã]o|ok|certo|pode|continua|continue|segue|pr[oó]ximo|isso|tchau|obrigad[oa]|valeu|oi|ol[aá]|repete|repita|para|pare|beleza|entendi|show|quero)$/i;

    let V = null;   // a conversa em andamento (null = nenhuma)
    let vozesOuvidas = false;

    // ── utilidades ──
    const $id = id => document.getElementById(id);
    const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const palavrasDe = s => norm(s).split(' ').filter(Boolean);
    const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
    function suporta() { return !!(SR() && window.speechSynthesis && window.SpeechSynthesisUtterance); }
    function antigaLigada() { try { return !!Prefs.get('vozAntiga'); } catch (e) { return false; } }
    function disponivel() { return !window.BSOFT_SIM && suporta() && !antigaLigada(); }

    // Texto da resposta → texto para FALAR: sem markdown, emojis, links, setas de menu ("A > B" vira "A, depois B") nem marcas internas.
    function paraFala(t) {
        return String(t || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/\(\s*id da rotina[^)]*\)/gi, ' ').replace(/\[\s*pasta\s*\]/gi, ' ').replace(/#finalizado/gi, ' ')
            .replace(/\b(par[âa]metro|funcionalidade)s?\s+(?:n[º°o.]*\s*)?\d{1,5}\s*(?:[–—-]\s*)?/gi, '$1 ')   // o número (código) de parâmetro/funcionalidade nunca é falado: só o nome
            .replace(/\s*(?:→|->|›|»|>)\s*/g, ', depois ').replace(/\s+\/\s+/g, ', depois ')
            .replace(/[*_`#~|]/g, '')
            .replace(/\p{Extended_Pictographic}|️/gu, '')
            .replace(/^\s*(?:[-•–]|\d+[.)])\s+/gm, '')
            .replace(/["“”]/g, '')
            .replace(/\s+/g, ' ').trim();
    }

    // ── escolha da voz do navegador (grátis): as "Natural/Online" soam muito melhor que as locais ──
    function escolherVoz() {
        const vs = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || [];
        const pt = vs.filter(v => /^pt[-_]BR/i.test(v.lang) || /portugu[eê]s.*brasil|portuguese.*brazil/i.test(v.name));
        const lista = pt.length ? pt : vs.filter(v => /^pt/i.test(v.lang));
        const pontos = v => (/natural/i.test(v.name) ? 40 : 0) + (/online/i.test(v.name) ? 20 : 0) + (/google/i.test(v.name) ? 15 : 0) + (v.localService ? 0 : 3);
        return lista.sort((a, b) => pontos(b) - pontos(a))[0] || null;
    }

    // ── placar dos modelos: o mais rápido na prática vai primeiro; o que não fala (ou só "pensa") fica de fora por um tempo ──
    function placar() { try { return JSON.parse(localStorage.getItem(LS_PLACAR) || '{}') || {}; } catch (e) { return {}; } }
    function anotar(modelo, o) {
        try {
            const p = placar(), x = p[modelo] || {};
            if (o.ttft) { x.ttft = x.ttft ? Math.round(x.ttft * 0.6 + o.ttft * 0.4) : o.ttft; delete x.ruimAte; }
            if (o.ruimMin) { x.ruimAte = Date.now() + o.ruimMin * 60000; x.motivo = o.motivo || ''; }
            p[modelo] = x; localStorage.setItem(LS_PLACAR, JSON.stringify(p));
        } catch (e) { /* sem armazenamento: o placar vale só por ora */ }
    }
    function ordemDeModelos() {
        const c = cfg(), cadeia = (c.cadeiaVoz && c.cadeiaVoz.length) ? c.cadeiaVoz : mcpMontarCadeia(), p = placar(), agora = Date.now();
        const nota = (m, i) => { const x = p[m.model] || {}; return (x.ruimAte && x.ruimAte > agora) ? 3e6 + i : (x.ttft || (1500 + i * 10)); };
        return cadeia.map((m, i) => ({ m, n: nota(m, i) })).sort((a, b) => a.n - b.n).map(x => x.m);
    }

    // ── a IA: pede, espera a 1ª palavra (ou desiste e tenta o próximo modelo) e devolve o fluxo para ler o resto ──
    function criarLeitorSSE(provider) {
        let buf = ''; const dec = new TextDecoder();
        return bytes => {
            buf += dec.decode(bytes, { stream: true });
            const linhas = buf.split('\n'); buf = linhas.pop() ?? '';
            let conteudo = '', raciocinio = false, fim = '', acabou = false;
            for (const l of linhas) {
                if (!l.startsWith('data: ')) continue;
                const raw = l.slice(6).trim();
                if (raw === '[DONE]') { acabou = true; continue; }
                try {
                    const j = JSON.parse(raw), fr = j.choices?.[0]?.finish_reason || j.candidates?.[0]?.finishReason;
                    if (fr) fim = fr;
                    if (provider === 'google') conteudo += (j.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text)?.join('') ?? '');
                    else { const d = j.choices?.[0]?.delta || {}; if (d.content) conteudo += d.content; if (d.reasoning || d.reasoning_content) raciocinio = true; }
                } catch (e) { /* linha incompleta ou comentário do servidor */ }
            }
            return { conteudo, raciocinio, fim, acabou };
        };
    }
    function requisicao(c, msgs) {
        const preset = PROVIDER_PRESETS[c.provider], google = c.provider === 'google', k = cfg();
        let url = c.baseUrl || preset.baseUrl;
        url = google ? preset.buildUrl(url, c.model, preset.chatEndpoint) + `?key=${c.apiKey}&alt=sse` : url.replace(/\/+$/, '') + preset.chatEndpoint;
        const body = preset.formatRequestBody(c.model, msgs, { temperature: k.temperatura, maxTokens: k.maxTokens });
        if (!google) body.stream = true;
        if (c.provider === 'openrouter') body.reasoning = { enabled: false };   // sem isso os modelos "que pensam" gastam 4–7 s (ou todo o limite) raciocinando antes de falar
        return { url, init: { method: 'POST', headers: preset.headers(c.apiKey), body: JSON.stringify(body) } };
    }
    // Resolve com { leitor, ler, modelo, ttft, inicial } depois da 1ª palavra de CONTEÚDO; null se o modelo falhou, demorou ou só "pensou".
    async function abrirModelo(T, c, msgs) {
        const t0 = performance.now(), ac = new AbortController(); T.abort = ac;
        const tempo = setTimeout(() => ac.abort(), cfg().primeiraPalavraMs);
        const ruim = (min, motivo) => { clearTimeout(tempo); anotar(c.model, { ruimMin: min, motivo }); return null; };
        let resp;
        try { const r = requisicao(c, msgs); resp = await fetch(r.url, Object.assign({ signal: ac.signal }, r.init)); }
        catch (e) { return T.cancelado ? null : ruim(10, 'sem resposta'); }
        if (!resp.ok) return ruim(resp.status === 429 ? 5 : 15, 'HTTP ' + resp.status);
        const leitor = resp.body.getReader(), ler = criarLeitorSSE(c.provider);
        T.leitor = leitor;
        const limite = t0 + cfg().primeiraPalavraMs;
        try {
            while (true) {
                // (a espera pela 1ª palavra tem relógio próprio: não depende de o cancelamento da conexão derrubar a leitura)
                const lido = await Promise.race([leitor.read(), new Promise(res => setTimeout(() => res({ esgotou: true }), Math.max(0, limite - performance.now())))]);
                if (lido.esgotou) { try { ac.abort(); } catch (e) { /* já terminou */ } try { leitor.cancel(); } catch (e) { /* já fechou */ } return T.cancelado ? null : ruim(10, 'lento'); }
                const { done, value } = lido;
                if (done) { if (T.cancelado) return null; break; }   // (cortado pela pessoa: não é culpa do modelo, não marca no placar)
                const r = ler(value);
                if (r.conteudo) { clearTimeout(tempo); const ttft = Math.round(performance.now() - t0); anotar(c.model, { ttft }); return { leitor, ler, modelo: c.model, ttft, inicial: r }; }
                if (r.raciocinio) { try { leitor.cancel(); } catch (e) { /* já fechou */ } return ruim(360, 'só raciocina'); }
                if (r.acabou) break;
            }
        } catch (e) { if (T.cancelado) return null; try { leitor.cancel(); } catch (x) { /* já fechou */ } return ruim(10, 'lento'); }
        clearTimeout(tempo);
        return T.cancelado ? null : ruim(10, 'vazio');
    }

    // ── fala (voz do navegador): fila de frases ──
    function falar(frase, T, ehFiller) {
        const t = paraFala(frase); if (!V || !t) return;
        V.fila.push({ t, ehFiller: !!ehFiller, T: T || null }); V.falaRecente = (V.falaRecente + ' ' + t).slice(-500);
        if (T && !ehFiller) { T.falouAlgo = true; T.respFila = limpar(T.respFila + ' ' + t); }   // respFila = tudo que foi para a fila; respFalada (abaixo, em bombear) = só o que a pessoa de fato OUVIU
        bombear();
    }
    function bombear() {
        if (!V || V.falando || !V.fila.length) return;
        const it = V.fila.shift(), u = new SpeechSynthesisUtterance(it.t);
        u.lang = 'pt-BR'; if (V.voz) u.voice = V.voz; u.rate = cfg().taxaFala; u.pitch = 1; u.volume = 1;
        V.falando = true; V.utts.push(u);   // (guarda a referência: o Chrome pode descartar a fala antes do "onend" se ninguém a segura)
        try { window.speechSynthesis.resume(); } catch (e) { /* sem pausa para retomar */ }
        fase('falando');
        if (!it.ehFiller) { if (it.T) it.T.respFalada = limpar(it.T.respFalada + ' ' + it.t); PainelChamada.legendaResposta(it.T ? it.T.respFalada : it.t); }   // o que vai para o chat, o log e a memória é só o que foi falado; a legenda acompanha
        const fim = () => { if (!V) return; V.utts = V.utts.filter(x => x !== u); V.falando = false; V.ignorarAte = Date.now() + 1100; if (V.fila.length) bombear(); else aoFalaTerminar(); };
        u.onend = fim; u.onerror = fim;
        try { window.speechSynthesis.speak(u); } catch (e) { fim(); }
    }
    function cortarFala() {
        if (!V) return;
        V.fila.length = 0;
        try { window.speechSynthesis.cancel(); } catch (e) { /* já calado */ }
        V.falando = false; V.utts = []; V.ignorarAte = Date.now() + 1100;
    }
    function aoFalaTerminar() {
        const T = V && V.turno;
        if (T && T.streamAcabou && !V.falando && !V.fila.length && !T.cancelado) { fecharTurno(T, false); }
        else if (!T && !V.falando && !V.fila.length) { fase('ouvindo'); if (V.encerrarAoFinal) setTimeout(() => encerrar('despedida'), 300); }
    }

    // ── fases e tela ──
    function fase(f) { if (!V) return; V.fase = f; V.faseDesde = Date.now(); PainelChamada.fase(f, { mudo: V.mudo }); }

    // ── reconhecimento de voz (o navegador transcreve; grátis) ──
    function iniciarReconhecimento() {
        const R = SR(), rec = new R();
        rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.onstart = () => { if (V) { V.recVivo = true; V.base = 0; V.ultimoTotal = 0; } };   // nova sessão do reconhecedor: a lista de resultados recomeça
        rec.onresult = ev => aoResultado(ev);
        rec.onerror = ev => aoErroReconhecimento(ev);
        rec.onend = () => { if (!V) return; V.recVivo = false; if (V.ativa && !V.mudo) setTimeout(() => religar(), 250); };
        V.rec = rec;
        try { rec.start(); } catch (e) { /* já iniciado */ }
    }
    function religar() { if (!V || !V.ativa || V.mudo || V.recVivo) return; try { V.rec.start(); } catch (e) { /* ainda ligando */ } }
    function aoErroReconhecimento(ev) {
        if (!V) return;
        const e = ev && ev.error;
        if (e === 'not-allowed' || e === 'service-not-allowed') { encerrar('erro', 'O navegador não liberou o microfone. Clique no cadeado ao lado do endereço do site e permita o microfone.'); return; }
        if (e === 'network') { V.errosRede++; if (V.errosRede >= 4) encerrar('erro', 'O reconhecimento de voz do navegador ficou sem internet. Confira a conexão e ligue de novo.'); return; }
        if (e === 'audio-capture') { encerrar('erro', 'Não encontrei um microfone neste computador.'); return; }
        /* 'no-speech', 'aborted': normais — o onend religa */
    }
    // Eco: a própria voz da IA entrando no microfone. Compara as palavras do que foi "ouvido" com as da fala recente.
    function pareceEco(texto) {
        const w = palavrasDe(texto); if (!w.length) return true;
        const rec = new Set(palavrasDe(V.falaRecente)), acertos = w.filter(x => rec.has(x)).length;
        return acertos / w.length >= 0.6;
    }
    // A frase parece parada no meio? (a pessoa só respirou) → o motor espera um pouco mais antes de responder.
    function parecIncompleta(t) {
        const n = norm(t), w = n.split(' ').filter(Boolean);
        if (!w.length) return true;
        if (/\b(e|ou|que|como|para|pra|de|do|da|dos|das|no|na|nos|nas|o|a|os|as|um|uma|com|em|por|se|mas|porque|quando|onde|qual|quais|ao)$/.test(n)) return true;   // terminou numa palavra que pede continuação
        if (w.length === 1) return !COMANDO_CURTO.test(w[0]);                                                                                                     // 1 palavra só vale se for "sim", "tchau"…
        if (w.length <= 3 && !ehContinuacao(t) && /^(como|onde|qual|quais|quando|por que|porque|preciso|queria|quero|gostaria|tem|existe|posso|eu)\b/.test(n)) return true;   // "como emitir…", "eu queria…": começo de pergunta
        return false;
    }
    function aoResultado(ev) {
        if (!V || !V.ativa) return;
        V.errosRede = 0; V.ultimoTotal = ev.results.length;   // chegou resultado: a internet do reconhecimento está boa
        let finais = '', interim = '';
        for (let i = V.base; i < ev.results.length; i++) { const r = ev.results[i], t = r[0].transcript; if (r.isFinal) finais += t + ' '; else interim += t; }
        const bruto = limpar(finais + interim);
        if (!bruto) return;
        const t = Date.now(), ocupada = V.falando || V.fila.length > 0;
        if (V.mudo) { V.base = ev.results.length; return; }
        if (ocupada) {
            // sem fone, não escuta enquanto a IA fala; com fone, só ignora o que for eco e deixa a pessoa interromper
            if (V.semFone || pareceEco(bruto)) { V.base = ev.results.length; return; }
            if (palavrasDe(bruto).length < 2) return;   // um ruído solto não corta a IA
            interromper();
        } else if (t < V.ignorarAte && pareceEco(bruto)) {
            // acabou de falar: o reconhecedor ainda pode entregar o "rabo" da própria voz da IA. Só isso é descartado — quem responde logo em seguida (0,3 s depois) é ouvido
            V.base = ev.results.length; return;
        } else if (V.turno && !V.turno.fechado) {
            if (!V.turno.falouAlgo) { const antes = V.turno.pergunta; cancelarTurno(V.turno, 'mesclar'); V.prefixo = antes; }   // a pessoa continuou falando enquanto a IA ainda "pensava": junta as duas partes e recomeça
            else { if (palavrasDe(bruto).length < 2) return; interromper(); }                                                    // falou por cima da resposta (num respiro entre frases)
        }
        const texto = limpar((V.prefixo ? V.prefixo + ' ' : '') + bruto);
        V.textoAtual = texto;
        PainelChamada.legendaFala(texto);
        if (V.fase !== 'ouvindo') fase('ouvindo');
        const k = cfg(), tudoFinal = !!finais.trim() && !interim.trim();
        clearTimeout(V.timerFim);
        V.timerFim = setTimeout(fimDoTurno, (tudoFinal ? k.fimTurnoMs : k.fimTurnoInterimMs) + (parecIncompleta(texto) ? k.fimTurnoExtraMs : 0));
        clearTimeout(V.timerPre); V.timerPre = setTimeout(() => antecipar(texto), 380);   // a frase parou de mudar: já vai buscando no banco
    }

    // ── a busca no banco, adiantada: quando a frase para de mudar por um instante, começa antes do fim do turno ──
    const opcoesConsulta = () => ({ escala: cfg().escala, artigos: cfg().artigos, cabecalho: '' });
    function ehContinuacao(texto) {
        const n = norm(texto), w = n.split(' ').filter(Boolean);
        return !!V && !!V.ultimoConhecimento && w.length <= 5 && /^(sim|pode( sim)?|continua|continue|segue|prossiga|proximo|e depois|e ai|e entao|isso( mesmo)?|ok|certo|quero( sim)?|manda ver|vai|pode continuar|continua ai)( |$)/.test(n);
    }
    function consultaQuery(texto) {
        const grande = palavrasDe(texto).filter(w => w.length > 2).length >= 3;
        return (!grande && V.ultimaConsulta) ? V.ultimaConsulta + ' ' + texto : texto;   // "e o cancelamento?" é buscado junto da pergunta anterior
    }
    function antecipar(texto) {
        if (!V || V.turno || palavrasDe(texto).length < 4 || ehContinuacao(texto) || respostaLocal(texto)) return;
        const chave = norm(texto);
        if (V.pre && V.pre.chave === chave) return;
        V.pre = { chave, p: VozConsulta.consultar(consultaQuery(texto), opcoesConsulta()).catch(() => null) };
    }

    // ── respostas que dispensam a IA (saudação, agradecimento, despedida, "repete") ──
    // Só quando a frase INTEIRA é isso ("obrigado, mas ainda não funcionou" e "bom dia, queria uma ajuda" vão para a IA).
    const soPalavras = (w, ok) => w.every(x => ok.has(x));
    const P_DESPEDIDA = new Set('tchau ate mais logo falou flw pode desligar desliga encerrar encerra era so isso nao preciso de nada obrigado obrigada valeu brigado beleza amanha'.split(' '));
    const P_AGRADECE = new Set('muito obrigado obrigada brigado brigada valeu vlw pela pelo ajuda atencao mesmo tudo ok certo show beleza entendi perfeito otimo'.split(' '));
    const P_CUMPRIMENTO = new Set('oi ola opa eae e ai alo bom dia boa tarde noite tudo bem tranquilo como vai'.split(' '));
    function respostaLocal(texto) {
        const n = norm(texto), w = n.split(' ').filter(Boolean);
        if (!w.length || w.length > 6) return null;
        if (/\b(tchau|ate mais|ate logo|falou|flw|desligar|desliga|encerrar|encerra|era so isso|so isso)\b/.test(n) && soPalavras(w, P_DESPEDIDA)) return { fala: 'Até mais! Qualquer coisa, é só ligar de novo.', encerrar: true };
        if (/\b(obrigad[oa]|brigad[oa]|valeu|vlw)\b/.test(n) && soPalavras(w, P_AGRADECE)) return { fala: 'De nada! Posso ajudar em mais alguma coisa?' };
        if (w.length <= 4 && soPalavras(w, P_CUMPRIMENTO)) return { fala: (typeof obterSaudacao === 'function' ? obterSaudacao().saudacao : 'Olá') + '! Em que posso ajudar?' };
        if (/^(repete|repita|de novo|pode repetir|nao entendi|fala de novo)( .*)?$/.test(n) && w.length <= 4 && V && V.ultimaResposta) return { fala: V.ultimaResposta, repetir: true };
        return null;
    }

    // ── um turno: a pessoa fala → busca → IA → fala ──
    function fimDoTurno() {
        const texto = limpar(V && V.textoAtual);
        if (!V || !V.ativa || !texto) return;
        if (V.turno) { V.timerFim = setTimeout(fimDoTurno, 300); return; }   // a resposta anterior ainda está sendo fechada: tenta já já
        V.base = V.ultimoTotal; V.textoAtual = ''; V.prefixo = '';
        iniciarTurno(texto);
    }
    function bolhaUsuario(texto) {
        try { appendMessage('user', '🎤 ' + esc(texto)); adicionarMensagemNaConversa('user', texto); } catch (e) { console.warn('[conversa voz] chat:', e); }
    }
    async function iniciarTurno(texto) {
        const T = { id: ++V.turnoId, pergunta: texto, respFalada: '', respFila: '', respBruta: '', falouAlgo: false, cancelado: false, streamAcabou: false, ts: null, fontes: null, abort: null, leitor: null, modelo: '', tFim: performance.now(), tFala: 0, fillerFalado: false, timerFiller: 0 };
        V.turno = T; V.turnos++; V.ultimaPergunta = texto;
        PainelChamada.legendaFala(texto); PainelChamada.legendaResposta('');
        fase('pensando'); bolhaUsuario(texto);
        const local = respostaLocal(texto);
        if (local) {
            T.local = true; if (local.encerrar) V.encerrarAoFinal = true;
            falar(local.fala, T); T.streamAcabou = true; T.respBruta = local.fala;
            if (!V.falando && !V.fila.length) aoFalaTerminar();
            return;
        }
        T.timerFiller = setTimeout(() => { if (V && V.turno === T && !T.cancelado && !T.falouAlgo && !T.fillerFalado) { T.fillerFalado = true; V.ultimoFiller = (V.ultimoFiller + 1 + Math.floor(Math.random() * (FILLERS.length - 1))) % FILLERS.length; falar(FILLERS[V.ultimoFiller], T, true); } }, cfg().esperaFraseMs);
        try {
            const cont = ehContinuacao(texto); T.continuacao = cont;
            let ctx;
            if (cont) {   // "continua": usa o conhecimento COMPLETO (já buscado em segundo plano quando a fala anterior foi cortada) — o enxuto talvez não tenha os passos seguintes
                const completo = await (V.completoP || VozConsulta.consultar(V.ultimaConsulta, { escala: 1, artigos: 3, cabecalho: '' }).catch(() => null));
                ctx = completo || { texto: V.ultimoConhecimento, encontrou: true, fontes: V.ultimasFontes || [], titulos: [] };
            } else {
                const chave = norm(texto), q = consultaQuery(texto);
                const pre = V.pre && V.pre.chave === chave ? await V.pre.p : null;
                ctx = pre || await VozConsulta.consultar(q, opcoesConsulta());
                V.pre = null; V.completoP = null; V.ultimoConhecimento = ctx.texto; V.ultimasFontes = ctx.fontes; V.ultimaConsulta = q;
                if (!T.cancelado) { try { T.ts = logSearch(texto, ctx.encontrou); } catch (e) { console.warn('[conversa voz] log:', e); } }   // 1 linha de log por pergunta, como no chat
            }
            if (T.cancelado) return;
            T.fontes = ctx.fontes; PainelChamada.fontes(ctx.titulos);
            await responder(T, montarMensagens(texto, ctx.texto, cont));
        } catch (e) {
            if (T.cancelado) return;
            console.warn('[conversa voz] erro no turno:', e);
            falhar(T);
        }
    }
    function montarMensagens(texto, conhecimento, continuar) {
        const hist = V.hist.slice(-cfg().historico).map(m => (m.role === 'user' ? 'Pessoa: ' : 'Você: ') + m.content).join('\n');
        return [{ role: 'user', content: INSTRUCOES + '\n\n' + (hist ? 'CONVERSA ATÉ AQUI:\n' + hist + '\n\n' : '') + 'CONHECIMENTO:\n' + conhecimento + '\n\n'
            + (continuar ? 'A pessoa pediu para CONTINUAR. O que você JÁ FALOU (não repita nada disso): "' + limpar(V.ultimaResposta).slice(0, 500) + '"\nDiga agora só o PRÓXIMO trecho do que está no CONHECIMENTO (1 ou 2 frases curtas). Se já não houver mais nada, diga que é só isso e pergunte se pode ajudar em mais alguma coisa.\n' : '')
            + 'PESSOA AGORA: "' + texto + '"\nSua fala (só a fala, no máximo 2 frases curtas):' }];
    }
    // nenhum modelo respondeu a tempo: descarta o turno, avisa em voz e devolve a vez à pessoa
    function falhar(T) {
        if (!V || V.turno !== T || T.cancelado) return;
        cancelarTurno(T, 'falha');
        try { appendMessage('system', '⚠️ A IA não respondeu a tempo nesta pergunta. Pergunte de novo daqui a pouco.'); } catch (e) { /* sem chat */ }
        falar('Estou com instabilidade para pensar agora. Pode repetir a pergunta daqui a pouco?', null);
        if (!V.falando && !V.fila.length) aoFalaTerminar();
    }
    async function responder(T, msgs) {
        let r = null;
        for (const c of ordemDeModelos()) {
            if (T.cancelado) return;
            r = await abrirModelo(T, c, msgs);
            if (r) break;
        }
        if (T.cancelado) return;
        if (!r) { falhar(T); return; }
        T.modelo = r.modelo;
        const filtro = _makeThinkingFilter();   // <thinking>…</thinking> nunca é falado
        const k = cfg();
        let visivel = 0, fimMotivo = r.inicial.fim, buffer = '', quantas = 0, palavras = 0, limite = false;
        const dizer = f => { if (falarFrase(T, f)) { quantas++; palavras += palavrasDe(f).length; } if (quantas >= k.maxFrases || palavras >= k.maxPalavras) limite = true; };
        const frase = fim => {   // tira do buffer as frases COMPLETAS e fala cada uma assim que fica pronta (para quando já falou o que cabe numa vez)
            while (!limite) {
                const m = /[.!?…]+["”')\]]*(\s+|$)/.exec(buffer);
                if (!m || (!fim && m.index + m[0].length >= buffer.length && !/\s$/.test(m[0]))) break;
                let f = buffer.slice(0, m.index + m[0].length); const resto = buffer.slice(m.index + m[0].length);
                if (paraFala(f).length < 14 && resto.trim() && quantas === 0) { const m2 = /[.!?…]+["”')\]]*(\s+|$)/.exec(resto); if (m2) { f += resto.slice(0, m2.index + m2[0].length); buffer = resto.slice(m2.index + m2[0].length); } else break; }
                else buffer = resto;
                dizer(f);
            }
            if (!fim && !limite && buffer.length > 170) { const i = Math.max(buffer.lastIndexOf(', ', 170), buffer.lastIndexOf('; ', 170)); if (i > 60) { const f = buffer.slice(0, i + 1); buffer = buffer.slice(i + 1); dizer(f); } }
        };
        const entrar = pedaco => { if (!pedaco) return; T.respBruta += pedaco; const out = filtro.push(pedaco); buffer += out.slice(visivel).replace(/\s*\n+\s*/g, ' '); visivel = out.length; frase(false); };   // (quebra de linha no meio da frase não vira pausa)
        entrar(r.inicial.conteudo);
        let acabou = r.inicial.acabou;
        try {
            while (!acabou && !limite && !T.cancelado) {
                const lido = await Promise.race([r.leitor.read(), new Promise(res => setTimeout(() => res({ semDados: true }), k.semDadosMs))]);
                if (lido.semDados) { try { r.leitor.cancel(); } catch (e) { /* já fechou */ } break; }
                if (lido.done) break;
                const x = r.ler(lido.value);
                if (x.fim) fimMotivo = x.fim;
                entrar(x.conteudo);
                if (x.acabou) acabou = true;
            }
        } catch (e) { if (T.cancelado) return; }
        if (T.cancelado) return;
        // falou o que cabia numa vez e a IA ainda tinha mais a dizer? corta a IA, oferece continuar e já busca o conteúdo completo em segundo plano (para o "continua" seguir de verdade)
        let sobrou = false;
        if (limite) {   // um instante (350 ms) para ver se a IA já tinha terminado: resposta de exatamente 2 frases não precisa de "quer que eu continue?"
            let extra = '';
            const fimDreno = Date.now() + 350;
            try {
                while (!acabou && Date.now() < fimDreno && !T.cancelado) {
                    const lido = await Promise.race([r.leitor.read(), new Promise(res => setTimeout(() => res({ semDados: true }), Math.max(0, fimDreno - Date.now())))]);
                    if (lido.semDados) break;
                    if (lido.done) { acabou = true; break; }
                    const x = r.ler(lido.value); extra += x.conteudo || ''; if (x.acabou) acabou = true;
                }
            } catch (e) { /* conexão encerrada: trata como terminou */ acabou = true; }
            if (T.cancelado) return;
            sobrou = !acabou || !!limpar(extra) || !!limpar(buffer);
        }
        if (sobrou) {
            try { r.leitor.cancel(); } catch (e) { /* já fechou */ }
            buffer = '';
            if (!/\?\s*$/.test(T.respFila)) falarFrase(T, 'Quer que eu continue?');
            V.completoP = VozConsulta.consultar(V.ultimaConsulta, { escala: 1, artigos: 3, cabecalho: '' }).catch(() => null);
        } else {
            if (!limite) buffer += filtro.finish().slice(visivel).replace(/\s*\n+\s*/g, ' ');
            const cortada = /length|max_tokens|MAX_TOKENS/.test(fimMotivo || '');
            if (!limite) frase(true);
            if (cortada) buffer = '';   // bateu no limite de tokens no meio de uma frase: descarta o pedaço solto (a pessoa pede "continua" e ele volta)
            if (!limite && limpar(buffer)) { falarFrase(T, buffer); buffer = ''; }
            if (cortada && T.respFila && !/\?\s*$/.test(T.respFila)) { falarFrase(T, 'Quer que eu continue?'); V.completoP = VozConsulta.consultar(V.ultimaConsulta, { escala: 1, artigos: 3, cabecalho: '' }).catch(() => null); }
        }
        if (T.continuacao && !T.respFila) falarFrase(T, 'Isso é tudo que encontrei sobre esse assunto. Posso ajudar em mais alguma coisa?');   // a IA só repetiu o que já tinha dito
        if (!V.completoP && /continu/i.test(T.respFila.slice(-70))) V.completoP = VozConsulta.consultar(V.ultimaConsulta, { escala: 1, artigos: 3, cabecalho: '' }).catch(() => null);   // ela mesma ofereceu continuar: deixa o conteúdo completo pronto
        console.log(`%c⏱️ [conversa voz] ${T.modelo.split('/').pop()} · 1ª palavra ${r.ttft} ms · fim do turno → fala: ${Math.round((T.tFala || performance.now()) - T.tFim)} ms`, 'color:#0891b2;font-weight:600');
        T.streamAcabou = true; clearTimeout(T.timerFiller);
        if (!V.falando && !V.fila.length) aoFalaTerminar();
    }
    // Na continuação ("continua"), a IA pequena às vezes repete o que já disse: frase longa quase igual à fala anterior é descartada.
    function repetida(txt) {
        const w = palavrasDe(txt).filter(x => x.length > 2);
        if (w.length < 4) return false;   // frase curtíssima ("Quer que eu continue?") pode se repetir à vontade
        const antes = new Set(palavrasDe(V.ultimaResposta));
        return w.filter(x => antes.has(x)).length / w.length >= 0.8;
    }
    function falarFrase(T, f) {   // devolve true se a frase foi mesmo para a fila
        const limpa = paraFala(f); if (!limpa || !V || T.cancelado) return false;
        if (T.continuacao && repetida(limpa)) return false;
        if (!T.tFala) T.tFala = performance.now();
        falar(limpa, T);
        return true;
    }
    // grava a troca no chat e no log; devolve a vez à pessoa
    function fecharTurno(T, interrompido) {
        if (!V || T.fechado) return;
        T.fechado = true; clearTimeout(T.timerFiller);
        const resp = limpar(T.respFalada);
        if (V.turno === T) V.turno = null;
        if (resp) {
            V.hist.push({ role: 'user', content: T.pergunta.slice(0, 300) }, { role: 'assistant', content: resp.slice(0, 400) });
            if (V.hist.length > 12) V.hist = V.hist.slice(-12);
            V.ultimaResposta = resp;
            try { appendMessage('ai', esc(resp) + (interrompido ? ' <i>(interrompida)</i>' : '')); adicionarMensagemNaConversa('ai', esc(resp)); } catch (e) { console.warn('[conversa voz] chat:', e); }
            if (T.ts) { try { registrarRespostaNoLog(T.ts, { resposta: resp, fonte: 'ia', modelo: (T.modelo.split('/').pop() || 'IA') + ' (voz)', fontes: T.fontes, revisao: 'nao_se_aplica' }); } catch (e) { console.warn('[conversa voz] log:', e); } }
        }
        if (!interrompido) { fase('ouvindo'); if (V.encerrarAoFinal) setTimeout(() => encerrar('despedida'), 400); }
    }
    // motivo 'interrompido': grava no chat e no log o que a IA já tinha dito · 'mesclar'/'falha': descarta o turno
    function cancelarTurno(T, motivo) {
        if (!T || T.cancelado) return;
        T.cancelado = true; clearTimeout(T.timerFiller);
        try { if (T.abort) T.abort.abort(); } catch (e) { /* já terminou */ }
        try { if (T.leitor) T.leitor.cancel(); } catch (e) { /* já fechou */ }
        if (V && V.turno === T) V.turno = null;
        if (motivo === 'interrompido' && limpar(T.respFalada)) fecharTurno(T, true);
    }
    // a pessoa cortou a IA (botão, toque no círculo ou — com fone — a própria voz)
    function interromper() {
        if (!V) return;
        const T = V.turno;
        cortarFala();
        if (T) cancelarTurno(T, 'interrompido');
        V.encerrarAoFinal = false;
        fase('ouvindo');
    }

    // ── controles da tela ──
    function alternarMudo() {
        if (!V) return;
        V.mudo = !V.mudo; PainelChamada.mudo(V.mudo);
        if (V.mudo) { clearTimeout(V.timerFim); V.textoAtual = ''; V.prefixo = ''; try { V.rec.abort(); } catch (e) { /* já parado */ } }
        else religar();
        fase(V.fase);
    }
    function alternarFone() { if (!V) return; V.semFone = !V.semFone; PainelChamada.gravarFone(V.semFone); PainelChamada.semFone(V.semFone); }
    function mostrarNoChat() {   // a resposta escrita COMPLETA (com todas as regras, log e 👍/👎) sai do chat normal
        const q = V && (V.ultimaConsulta || V.ultimaPergunta || '');   // (a consulta já junta a pergunta anterior quando a última fala foi só "e o cancelamento?")
        if (!q) { try { Toast.show('Ainda não houve nenhuma pergunta nesta chamada.', { kind: 'warn' }); } catch (e) { /* sem aviso */ } return; }
        const p = $id('voiceCallPanel'); if (p && !p.classList.contains('minimized') && typeof toggleMinimizeCall === 'function') toggleMinimizeCall();
        try { if (typeof Workspace !== 'undefined' && Workspace.showChat) Workspace.showChat(); } catch (e) { /* sem abas */ }
        if (typeof fillAndSend === 'function') fillAndSend(q); else { $id('searchInput').value = q; handleChat(); }
    }
    function relogio() {
        if (!V) return;
        const seg = Math.floor((Date.now() - V.inicio) / 1000);
        PainelChamada.tempo(String(Math.floor(seg / 60)).padStart(2, '0') + ':' + String(seg % 60).padStart(2, '0'), false);
        if (V.fase === 'pensando' && Date.now() - V.faseDesde > 30000 && V.turno) falhar(V.turno);   // não deixa a tela presa em "Pensando…"
    }

    // ── começo e fim ──
    function saudar() {
        const s = (typeof obterSaudacao === 'function') ? obterSaudacao().saudacao : 'Olá';
        falar(`${s}! Aqui é o suporte do Bsoft. Em que posso ajudar?`, null);
    }
    function iniciar() {
        if (V) { const p = $id('voiceCallPanel'); if (p && p.classList.contains('minimized') && typeof toggleMinimizeCall === 'function') toggleMinimizeCall(); return true; }
        if (!suporta()) return false;
        V = { ativa: true, rec: null, recVivo: false, errosRede: 0, fase: 'ouvindo', faseDesde: Date.now(), inicio: Date.now(), mudo: false, semFone: PainelChamada.lerFone(true),
            base: 0, ultimoTotal: 0, textoAtual: '', prefixo: '', timerFim: 0, timerPre: 0, turnoId: 0, turno: null, hist: [], ultimoConhecimento: '', ultimasFontes: [], ultimaConsulta: '', ultimaPergunta: '', ultimaResposta: '',
            fila: [], falando: false, utts: [], falaRecente: '', ignorarAte: 0, voz: escolherVoz(), turnos: 0, tick: 0, ultimoFiller: -1, pre: null, encerrarAoFinal: false };
        PainelChamada.montar({
            semFone: V.semFone,
            aviso: 'O navegador transcreve o que você fala e o texto vai para IAs gratuitas. Não fale dados pessoais de clientes.',
            aoMudo: alternarMudo, aoFone: alternarFone, aoChat: mostrarNoChat, aoInterromper: interromper
        });
        if (!vozesOuvidas) { vozesOuvidas = true; try { if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', () => { if (V && !V.voz) V.voz = escolherVoz(); }); } catch (e) { /* sem evento */ } }   // (as vozes do navegador chegam depois da página; ouve uma vez só)
        fase('ouvindo'); iniciarReconhecimento(); saudar();
        V.tick = setInterval(relogio, 250);
        return true;
    }
    function encerrar(motivo, mensagem) {
        const v = V; if (!v) return;
        try { if (v.turno) cancelarTurno(v.turno, 'interrompido'); } catch (e) { /* o resto do encerramento é mais importante */ }   // (grava o que a IA já tinha dito)
        v.ativa = false; V = null;
        clearInterval(v.tick); clearTimeout(v.timerFim); clearTimeout(v.timerPre);
        try { v.rec.onend = null; v.rec.onresult = null; v.rec.onerror = null; v.rec.abort(); } catch (e) { /* já parado */ }
        try { window.speechSynthesis.cancel(); } catch (e) { /* já calado */ }
        PainelChamada.desmontar();
        const seg = Math.round((Date.now() - v.inicio) / 1000), dur = `${Math.floor(seg / 60)}min${String(seg % 60).padStart(2, '0')}s`, n = v.turnos;
        try { appendMessage('system', `📞 <b>Chamada de voz encerrada</b> (${dur}, ${n} pergunta${n === 1 ? '' : 's'}).${motivo === 'erro' ? ' ⚠️ ' + esc(mensagem || 'Houve um problema.') : ''}`); } catch (e) { /* sem chat */ }
        if (motivo === 'erro') { try { Toast.show(mensagem || 'Houve um problema na chamada.', { kind: 'warn', ms: 8000 }); } catch (e) { /* sem aviso */ } }
    }

    return { disponivel, suporta, iniciar, encerrar, ativa: () => !!V, interromper,
        estado: () => V ? { fase: V.fase, turnos: V.turnos, mudo: V.mudo, semFone: V.semFone, falando: V.falando, filaFala: V.fila.length, modeloAtual: V.turno ? V.turno.modelo : '', hist: V.hist.length } : null,
        config: cfg, ordemDeModelos, paraFala };
})();
window.ConversaVoz = ConversaVoz;
