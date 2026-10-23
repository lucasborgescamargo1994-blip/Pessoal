/* js/simulador/tela.js — Simulador de atendimento: a tela (simulador.html).
   Dois jeitos de usar, os dois com a pessoa identificada pelo nome completo (pedido ao abrir):
     • TREINO LIVRE: sorteia (ou escolhe) um caso do banco de dados e conversa com o cliente simulado. O treino fica registrado (tabela sim_sessoes).
     • PROVA: montada na Área Administrativa (aba "Treinamento"): vários casos em sequência, sem ver a solução; nota = % de casos resolvidos; passou ou não
       passou; se não passou, a tela orienta a REVISAR o conteúdo do curso (YOUniversity). Tudo fica registrado (sim_tentativas) para o administrador.
   Casos: vêm do banco de dados do Supabase (BancoDados, só leitura) ou são casos próprios escritos dentro da prova. A conversa com o banco fica em js/simulador/dados.js.
   IA: os mesmos modelos do MCP (config/mcp-config.js) — chamarIA() percorre a cadeia de modelos (mcpMontarCadeia() de js/core/mcp.js) com fallback e a
   página confere a configuração nova sozinha (a cada 2 horas), como o sistema principal. Mudou o modelo no painel "IA / MCP"? Muda aqui também.
   Os textos que vão para a IA, as regras da prova e a nota ficam em js/simulador/logica.js. */
(function () {
    'use strict';
    const L = SimLogica, D = SimDados;
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const MAX_LISTA = 60;           // casos mostrados de uma vez em "escolher um caso"
    const MAX_TURNOS = 40;          // trava de segurança (conversa que não termina)
    const CHAVE_NOME = 'bsoft_sim_nome';
    const TELAS = ['telaInicio', 'telaProva', 'telaChat', 'telaFim', 'telaResultado'];

    // ── aparência: usa a cor e o fundo que a pessoa escolheu em Personalizar no sistema principal ──
    try {
        const p = JSON.parse(localStorage.getItem('bsoft_v27_prefs') || '{}') || {};
        const h = document.documentElement;
        h.dataset.bg = p.bg || 'aurora'; h.dataset.efeitos = p.efeitos || 'completo';
        if (p.accent && p.accentRgb) { h.style.setProperty('--primary', p.accent); h.style.setProperty('--primary-rgb', String(p.accentRgb).replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); }
    } catch (e) { /* sem preferências: padrão */ }

    // modo: 'treino' | 'prova'.  token: sobe a cada caso/encerramento — respostas da IA que chegam atrasadas (de um caso já encerrado) são descartadas.
    const S = { indice: [], filtrados: [], caso: null, perfil: 'normal', hist: [], dicas: 0, inicio: 0, resultado: '', ocupado: false, timer: null, encerrado: false, gravado: false, ultimoModelo: '',
        modo: 'treino', token: 0, nome: '', chave: '', config: Object.assign({}, D.CONFIG_PADRAO), provas: [], minhas: [], provaAtual: null, teste: false };
    let P = null;   // a prova em andamento (ou recém-terminada, até sair da tela de resultado)

    // ── IA: cadeia de modelos do MCP, com limite de tempo por modelo ──
    // A função pronta de js/core/mcp.js também percorre a cadeia de modelos, mas não tem limite de tempo: um modelo travado ou lento (visto: 40 s e resposta vazia) pararia a conversa.
    // Aqui cada modelo tem 40 s; resposta vazia ou lenta passa direto para o próximo; erro de rede/limite tenta mais uma vez antes de passar.
    const LIMITE_MODELO_MS = 40000, QUARENTENA_MS = 10 * 60 * 1000;
    const FALHAS = new Map();   // modelo → { n: falhas seguidas (vazio/lento), ate: até quando fica de fora }
    const emQuarentena = m => { const x = FALHAS.get(m); return !!x && x.n >= 2 && Date.now() < x.ate; };
    const comLimite = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT: o modelo demorou mais de ' + Math.round(ms / 1000) + ' s')), ms))]);
    async function chamarIA(messages, cfg, aoTentar) {
        const passos = mcpMontarCadeia();
        if (!passos.length) throw new Error('nenhum modelo ativo no MCP (config/mcp-config.js)');
        let ultimo = null;
        const ativos = passos.filter(p => !emQuarentena(p.model));    // modelo que ficou vazio/lento 2 vezes seguidas descansa 10 min (senão cada turno gastaria 40 s nele)
        for (const p of (ativos.length ? ativos : passos)) {
            for (let t = 1; t <= 2; t++) {
                try {
                    if (aoTentar) aoTentar(p, t);
                    const res = await comLimite(callMCPAPI(p.provider, p.model, p.apiKey, p.baseUrl, messages, cfg || {}), LIMITE_MODELO_MS);
                    const f = filtrarPensamentoAlto(res && res.text);
                    if (!f.texto || f.eraPensamento) throw new Error('resposta vazia');
                    FALHAS.delete(p.model);
                    return { text: f.texto, _iaModelo: p.model, finishReason: res.finishReason };
                } catch (e) {
                    ultimo = e; console.warn('[simulador] ' + p.model + ' (tentativa ' + t + '): ' + (e && e.message));
                    if (/vazia|TIMEOUT/.test(String(e && e.message))) { const x = FALHAS.get(p.model) || { n: 0, ate: 0 }; x.n++; x.ate = Date.now() + QUARENTENA_MS; FALHAS.set(p.model, x); break; }      // vazio ou lento: não adianta repetir, vai para o próximo modelo
                    if (t === 1) await new Promise(r => setTimeout(r, 1200));
                }
            }
        }
        throw ultimo || new Error('Todos os provedores falharam.');
    }

    function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms || 4000); }
    function tela(nome) { TELAS.forEach(id => { $(id).hidden = id !== nome; }); window.scrollTo({ top: 0 }); }
    function el(tag, cls, texto) { const n = document.createElement(tag); if (cls) n.className = cls; if (texto != null) n.textContent = texto; return n; }
    function copiarTexto(t, okMsg) {
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(okMsg), () => {
            const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(okMsg); } catch (e) { toast('Não consegui copiar.'); } ta.remove();
        });
    }

    // ── selo da IA (modelos do MCP) ──
    function atualizarSeloIA() {
        const e = $('simIA');
        try {
            const passos = mcpMontarCadeia();
            const v = (MCP_CFG && MCP_CFG.versao) ? ' · config v' + MCP_CFG.versao : '';
            const mod = S.ultimoModelo || (passos[0] && passos[0].model) || '';
            e.textContent = passos.length ? '🤖 ' + String(mod).split('/').pop().replace(/:free$/, '') + v : '⚠️ sem modelo de IA no MCP';
            e.title = passos.length ? 'Cadeia de modelos do MCP (config/mcp-config.js): ' + passos.map(p => p.model.split('/').pop()).join(' → ') + '. Quando você muda lá, muda aqui.' : 'Preencha config/mcp-config.js (aba "IA / MCP" do painel).';
            e.classList.toggle('erro', !passos.length);
        } catch (x) { e.textContent = '⚠️ IA indisponível'; e.classList.add('erro'); }
    }
    window.addEventListener('bsoft:mcp-aplicado', atualizarSeloIA);

    // ═════════ identificação (nome completo) ═════════
    function nomeSalvo() { try { return localStorage.getItem(CHAVE_NOME) || ''; } catch (e) { return ''; } }
    function guardarNome(n) { try { localStorage.setItem(CHAVE_NOME, n); } catch (e) { /* sem armazenamento: pergunta de novo da próxima vez */ } }
    // Abre a janela do nome. Resolve com { nome, chave } — ou null, se a pessoa estava trocando de nome e desistiu.
    function pedirNome(trocando) {
        return new Promise(resolve => {
            const fundo = $('modalNome'), inp = $('inpNome'), erro = $('erroNome'), form = $('formNome'), cancelar = $('btnNomeCancelar');
            inp.value = trocando ? S.nome : nomeSalvo();
            erro.hidden = true; cancelar.hidden = !trocando;
            fundo.hidden = false; $('conteudo').inert = true; document.querySelector('.sim-topo').inert = true;
            setTimeout(() => { inp.focus(); inp.select(); }, 30);
            const fechar = () => { fundo.hidden = true; $('conteudo').inert = false; document.querySelector('.sim-topo').inert = false; form.removeEventListener('submit', enviarNome); cancelar.removeEventListener('click', desistirNome); };
            const enviarNome = ev => {
                ev.preventDefault();
                const v = L.validarNome(inp.value);
                if (!v.ok) { erro.textContent = v.msg; erro.hidden = false; inp.focus(); return; }
                fechar(); resolve(v);
            };
            const desistirNome = () => { fechar(); resolve(null); };
            form.addEventListener('submit', enviarNome);
            cancelar.addEventListener('click', desistirNome);
        });
    }
    function aplicarNome(v) {
        S.nome = v.nome; S.chave = v.chave; guardarNome(v.nome);
        $('nomeAtual').textContent = v.nome; $('btnNome').hidden = false;
    }
    async function trocarNome() {
        if (P && !P.finalizada) { toast('Termine a prova antes de trocar o nome.'); return; }
        if (!$('telaChat').hidden && !S.encerrado) { toast('Encerre o atendimento atual antes de trocar o nome.'); return; }
        const v = await pedirNome(true);
        if (!v) return;
        aplicarNome(v); P = null; S.modo = 'treino';
        await carregarHistorico(); renderInicio(); tela('telaInicio');
    }

    // ═════════ início: provas e treino livre ═════════
    async function carregarConfigEProvas() {
        try { D.iniciar(); } catch (e) { return; }
        S.config = await D.lerConfig();
        S.provas = (await D.listarProvas()).filter(p => L.itensDaProva(p.itens).length > 0);
    }
    async function carregarHistorico() {
        if (!S.provas.length) { S.minhas = []; return; }
        const h = await D.minhasTentativas(S.chave);
        S.minhas = h.linhas;
    }
    function etiquetaProva(r) {
        if (r.aprovado) return ['ok', '✅ Aprovado(a)' + (r.melhorNota != null ? ' · ' + r.melhorNota + '%' : '')];
        if (r.concluidas) return ['nao', 'Ainda não aprovado(a)' + (r.melhorNota != null ? ' · melhor nota ' + r.melhorNota + '%' : '')];
        if (r.emAndamento) return ['nao', 'Tentativa iniciada, não concluída'];
        return ['', 'Ainda não feita'];
    }
    function cartaoProva(p) {
        const cfg = L.configProva(p.config), itens = L.itensDaProva(p.itens), r = L.resumoTentativas(S.minhas, p.id);
        const restam = L.tentativasRestantes(cfg, r.feitas);
        const [cls, rot] = etiquetaProva(r);
        const c = el('div', 'sim-prova');
        const topo = el('div', 'sim-prova-topo'); topo.append(el('b', null, p.titulo), el('span', 'sim-etiqueta ' + cls, rot)); c.appendChild(topo);
        if (p.curso_nome) c.appendChild(el('div', 'sim-prova-curso', '📖 ' + p.curso_nome));
        c.appendChild(el('small', null, `${itens.length} caso(s) · nota mínima ${cfg.nota_minima}%` + (cfg.tempo_min ? ' · ' + cfg.tempo_min + ' min' : '') + (cfg.max_tentativas ? ` · ${r.feitas}/${cfg.max_tentativas} tentativa(s)` : '')));
        const b = el('button', 'sim-btn' + (r.aprovado ? '' : ' primario'), restam === 0 ? 'Sem tentativas restantes' : r.aprovado ? 'Fazer de novo' : r.feitas ? 'Tentar de novo' : 'Fazer a prova');
        b.type = 'button'; b.disabled = restam === 0;
        b.addEventListener('click', () => abrirProva(p));
        c.appendChild(b);
        return c;
    }
    function renderInicio() {
        const nome = L.primeiroNome(S.nome);
        $('boasVindas').textContent = ((nome ? 'Olá, ' + nome + '! ' : '') + (S.config.boas_vindas || '')).trim();
        $('boasVindas').hidden = !$('boasVindas').textContent;
        const caixa = $('listaProvas'); caixa.textContent = '';
        S.provas.forEach(p => caixa.appendChild(cartaoProva(p)));
        $('blocoProvas').hidden = !S.provas.length;
        const treino = S.config.treino_livre !== false;
        $('blocoTreino').hidden = !treino;
        $('tituloTreino').hidden = !S.provas.length;     // sem provas, o título "Treino livre" é redundante
        $('semNada').hidden = !!S.provas.length || treino;
    }

    // ── casos do banco de dados (treino livre) ──
    async function carregarIndice() {
        const st = $('statusBanco');
        try {
            S.indice = (await D.indiceCasos()).filter(r => r && r.titulo && String(r.titulo).trim());
            const cats = new Map(), grafias = new Map();   // chave (sem acento/maiúscula) → total; chave → { grafia: vezes }
            S.indice.forEach(r => { const c = String(r.categoria || '').trim() || 'Sem categoria', k = chaveCat(c); cats.set(k, (cats.get(k) || 0) + 1); const g = grafias.get(k) || {}; g[c] = (g[c] || 0) + 1; grafias.set(k, g); });
            const rotulo = k => Object.entries(grafias.get(k)).sort((a, b) => b[1] - a[1])[0][0];   // a grafia mais usada
            const sel = $('fCategoria');
            Array.from(cats.entries()).map(([k, n]) => [k, rotulo(k), n]).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).forEach(([k, c, n]) => { const o = document.createElement('option'); o.value = k; o.textContent = `${c} (${n})`; sel.appendChild(o); });
            st.textContent = `${S.indice.length} casos disponíveis no banco de dados.`;
            $('btnSortear').disabled = !S.indice.length;
            filtrar();
        } catch (e) {
            console.error('[simulador] banco de dados:', e);
            st.textContent = '⚠️ Não consegui ler o banco de dados: ' + ((e && e.message) || e);
            st.classList.add('erro');
        }
    }
    const chaveCat = c => L.semAcento(String(c || '').trim()).replace(/\s+/g, ' ') || 'sem categoria';
    const categoriaDe = r => String(r.categoria || '').trim() || 'Sem categoria';
    function filtrar() {
        const cat = $('fCategoria').value, q = L.semAcento($('fBusca').value).trim();
        S.filtrados = S.indice.filter(r => (!cat || chaveCat(categoriaDe(r)) === cat) && (!q || L.semAcento(r.titulo).includes(q)));
        const ul = $('listaCasos'); ul.innerHTML = '';
        S.filtrados.slice(0, MAX_LISTA).forEach(r => {
            const li = document.createElement('li');
            const b = document.createElement('button'); b.type = 'button'; b.className = 'sim-caso-item';
            b.innerHTML = `<span class="t">${esc(r.titulo)}</span><span class="c">${esc(categoriaDe(r))}</span>`;
            b.addEventListener('click', () => iniciarCaso(r.id));
            li.appendChild(b); ul.appendChild(li);
        });
        const mais = $('listaMais');
        mais.hidden = false;
        mais.textContent = S.filtrados.length === 0 ? 'Nenhum caso encontrado com esse filtro.' : (S.filtrados.length > MAX_LISTA ? `Mostrando ${MAX_LISTA} de ${S.filtrados.length}. Refine a busca para ver os outros.` : `${S.filtrados.length} caso(s).`);
    }

    // ═════════ conversa (treino e prova) ═════════
    function bolha(de, texto, extra) {
        const box = $('mensagens');
        const d = document.createElement('div');
        d.className = 'sim-msg ' + de + (extra ? ' ' + extra : '');
        const quem = de === 'cliente' ? '👤 Cliente' : de === 'suporte' ? '🎧 Você (suporte)' : de === 'dica' ? '💡 Dica' : 'ℹ️';
        d.innerHTML = `<div class="quem">${quem}</div><div class="txt"></div>`;
        d.querySelector('.txt').textContent = texto;
        box.appendChild(d); box.scrollTop = box.scrollHeight;
        return d;
    }
    function infoDigitando(txt) { const e = $('digitando'); const i = e && e.querySelector('.info'); if (i) i.textContent = txt || ''; }
    function digitando(on) {
        let e = $('digitando');
        if (on && !e) { e = document.createElement('div'); e.id = 'digitando'; e.className = 'sim-msg cliente digitando'; e.innerHTML = '<div class="quem">👤 Cliente</div><div class="txt"><span class="pt"></span><span class="pt"></span><span class="pt"></span></div><div class="info"></div>'; $('mensagens').appendChild(e); $('mensagens').scrollTop = $('mensagens').scrollHeight; }
        if (!on && e) e.remove();
    }
    function bloquear(on) {
        S.ocupado = on;
        $('txtSuporte').disabled = on || S.encerrado; $('btnEnviar').disabled = on || S.encerrado;
        $('btnDica').disabled = on || S.encerrado; $('btnDesistir').disabled = S.encerrado;
        $('btnJaOrientei').disabled = on || S.encerrado;
        if (!on && !S.encerrado) $('txtSuporte').focus({ preventScroll: true });
    }
    const falasSuporte = () => S.hist.filter(x => x.de === 'suporte').length;
    function atualizarBotaoJaOrientei() { $('btnJaOrientei').hidden = !(falasSuporte() >= 2); }
    function atualizarChipsProva() {
        if (S.modo !== 'prova' || !P) return;
        $('chipProva').textContent = `📝 Caso ${P.idx + 1} de ${P.casos.length}`;
        const max = P.cfg.max_mensagens;
        $('chipMsgs').textContent = '✉ ' + falasSuporte() + (max ? ' / ' + max : '');
        $('chipMsgs').title = max ? `Mensagens suas neste caso (limite: ${max})` : 'Mensagens suas neste caso';
    }
    function mostrarErro(msg, aoTentar) {
        const d = bolha('sistema', msg, 'erro');
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sim-btn peq'; b.textContent = '🔄 Tentar de novo';
        b.addEventListener('click', () => { d.remove(); aoTentar(); });
        d.querySelector('.txt').appendChild(document.createElement('br')); d.querySelector('.txt').appendChild(b);
    }

    function relogio() {
        const chip = $('chipTempo');
        if (S.modo === 'prova' && P && P.fimEm) {
            const resta = (P.fimEm - Date.now()) / 1000;
            chip.textContent = '⏳ ' + L.mmss(resta) + ' restantes'; chip.classList.toggle('alerta', resta <= 60);
            if (resta <= 0) tempoEsgotado();
            return;
        }
        chip.classList.remove('alerta');
        chip.textContent = '⏱ ' + L.mmss((Date.now() - S.inicio) / 1000);
    }

    // Monta a tela de conversa para um caso (treino ou prova)
    function prepararChat(caso, perfil) {
        S.caso = caso; S.perfil = perfil; S.hist = []; S.dicas = 0; S.encerrado = false; S.gravado = false; S.resultado = ''; S.inicio = Date.now(); S.token++; S.ocupado = false;
        const prova = S.modo === 'prova';
        $('mensagens').innerHTML = '';
        $('chipProva').hidden = !prova; $('chipMsgs').hidden = !prova;
        $('chipCategoria').hidden = prova;     // na prova a categoria poderia entregar o assunto
        $('chipCategoria').textContent = '📂 ' + (String(caso.categoria || '').trim() || 'Sem categoria');
        $('chipPerfil').textContent = '🎭 ' + L.PERFIS[perfil].nome;
        $('btnDica').hidden = prova && !P.cfg.dicas;
        $('btnDesistir').textContent = prova ? '⏭ Pular este caso' : '🏳️ Desistir e ver a solução';
        $('btnDesistir').title = prova ? 'Passa para o próximo caso (este conta como não resolvido)' : 'Encerra e mostra a solução';
        $('barraProximo').hidden = true; $('formEnvio').hidden = false;
        $('txtSuporte').value = '';
        tela('telaChat'); relogio(); clearInterval(S.timer); S.timer = setInterval(relogio, 1000);
        atualizarBotaoJaOrientei(); atualizarChipsProva();
        bolha('sistema', 'Um cliente entrou no chat. Aguarde a primeira mensagem dele e atenda como atenderia de verdade.');
    }

    async function iniciarCaso(id) {
        if (S.ocupado) return;
        const st = $('statusBanco'); const btn = $('btnSortear');
        btn.disabled = true; st.textContent = 'Buscando o caso…'; st.classList.remove('erro');
        let caso;
        try {
            caso = await D.buscarCaso(id);
        } catch (e) { console.error(e); st.textContent = '⚠️ Não consegui abrir o caso: ' + ((e && e.message) || e); st.classList.add('erro'); btn.disabled = false; return; }
        btn.disabled = false; st.textContent = `${S.indice.length} casos disponíveis no banco de dados.`;
        if (!String(caso.conteudo || '').trim()) { S.caso = caso; toast('Esse caso não tem solução cadastrada. Sorteando outro…'); return sortear(); }
        S.modo = 'treino'; P = null;
        prepararChat(caso, $('fPerfil').value || 'normal');
        falaCliente();
    }
    function sortear() {
        if (!S.filtrados.length) { toast('Nenhum caso com esse filtro.'); return; }
        const lista = S.filtrados.filter(r => !S.caso || r.id !== S.caso.id); const base = lista.length ? lista : S.filtrados;
        iniciarCaso(base[Math.floor(Math.random() * base.length)].id);
    }

    // A IA (no papel de cliente) responde. verificar=true: já veio "RESOLVIDO" e vai ser conferido por um juiz.
    // notaBase = aviso interno para a IA (ex.: "ainda falta X"); eco = quantas vezes já pedimos para o cliente responder em vez de devolver a pergunta;
    // recusas = quantas vezes o supervisor já disse "ainda não" a um RESOLVIDO neste turno (depois de 2, o cliente segue a conversa em vez de ficar num laço).
    const NOTA_ECO = 'sua resposta anterior não respondeu ao suporte (devolveu a pergunta dele, repetiu a sua mensagem anterior ou falou como atendente). Você é o CLIENTE: responda ao que ele disse ou perguntou com informação do SEU caso (escolha uma das opções, diga o que você vê ou faz), em 1 ou 2 frases. Não repita nem reformule a pergunta dele e não ofereça opções a ele; se não souber como fazer algo, diga que não sabe ou pergunte como se faz.';
    async function falaCliente(notaBase, eco, recusas) {
        const tok = S.token;
        const nota = eco ? (notaBase ? notaBase + ' ' : '') + NOTA_ECO : notaBase;
        bloquear(true); digitando(true); S.tentativas = 0;
        let res;
        try {
            res = await chamarIA(L.montarMensagens(S.caso, S.perfil, S.hist, nota), { temperature: 0.8, maxTokens: 600 }, (p, tent) => { S.tentativas = (S.tentativas || 0) + 1; infoDigitando(S.tentativas > 1 ? 'o modelo anterior não respondeu — tentando ' + p.model.split('/').pop().replace(/:free$/, '') + '…' : ''); });
            S.tentativas = 0;
        } catch (e) {
            if (tok !== S.token) return;
            digitando(false); bloquear(false);
            console.error('[simulador] IA:', e);
            mostrarErro('⚠️ Não consegui falar com a IA agora (' + ((e && e.message) || 'erro') + '). Confira os modelos em "IA / MCP" no painel.', () => falaCliente(notaBase, 0, recusas));
            return;
        }
        if (tok !== S.token) return;
        if (res && res._iaModelo) { S.ultimoModelo = res._iaModelo; atualizarSeloIA(); }
        let r = L.interpretarCliente(res && res.text);
        if (!r.mensagem) { digitando(false); bloquear(false); mostrarErro('⚠️ A IA respondeu vazio.', () => falaCliente(notaBase, 0, recusas)); return; }
        if (r.estado === 'CONTINUA' && (L.devolveuPergunta(r.mensagem, S.hist) || L.repetiuMensagem(r.mensagem, S.hist))) {          // o cliente "virou o suporte" ou repetiu a própria mensagem: pede de novo (no máx. 2 vezes) em vez de mostrar isso
            if ((eco || 0) < 2) return falaCliente(notaBase, (eco || 0) + 1, recusas);
            if (L.devolveuPergunta(r.mensagem, S.hist)) r = { estado: 'CONTINUA', mensagem: 'Hum, não sei dizer ao certo. Pode me explicar melhor como eu faço ou descubro isso?' };    // eco claro que insiste: um cliente leigo sem saber responder, em vez de inverter os papéis
        }

        if (r.estado === 'RESOLVIDO') {
            if (!L.temOrientacao(S.hist)) {                          // "ok"/"oi" não resolvem nada: o cliente segue na conversa
                r = { estado: 'CONTINUA', mensagem: 'Hum, ainda não entendi bem o que eu preciso fazer. Pode me explicar melhor?' };
            } else {
                const ok = await conferir();
                if (tok !== S.token) return;
                if (!ok.ok && (recusas || 0) >= 2) {                  // o supervisor já recusou 2 vezes: o cliente segue a conversa em vez de ficar num laço
                    r = { estado: 'CONTINUA', mensagem: 'Hum, acho que ainda não resolveu aqui. Pode me explicar de outro jeito?' };
                } else if (!ok.ok) {                                  // a IA se adiantou: pede outra resposta, sem encerrar
                    digitando(false);
                    return falaCliente('a orientação do suporte AINDA NÃO resolve o seu problema original' + (ok.falta ? ' (falta o essencial: ' + ok.falta + ')' : '') + '. Não use o estado RESOLVIDO agora. Continue falando SÓ do mesmo problema, sem criar problema nem dúvida nova: diga o que ainda não conseguiu ou peça esclarecimento do passo que ficou incompleto, sem entregar a resposta.', 0, (recusas || 0) + 1);
                }
            }
        }
        digitando(false);
        if (S.modo === 'prova' && P && !P.tentativaPronta) {             // a tentativa só é registrada (e só conta) depois que o cliente de fato "entrou no chat"
            const t = await criarTentativa();
            if (tok !== S.token) return;
            if (t === 'esgotadas' || t === 'indisponivel') { abortarProva(t === 'esgotadas' ? 'Você já usou todas as tentativas desta prova.' : 'Esta prova não está mais disponível.'); return; }
            if (t === 'falhou') toast('⚠️ Não consegui registrar a prova no servidor. Pode continuar: no final, copie o comprovante e envie ao responsável.', 10000);
            P.tentativaPronta = true;
        }
        S.hist.push({ de: 'cliente', texto: r.mensagem });
        const bc = bolha('cliente', r.mensagem); if (S.ultimoModelo) bc.title = 'Modelo: ' + S.ultimoModelo;
        if (r.estado === 'RESOLVIDO') { bloquear(false); return encerrar('Resolvido'); }
        bloquear(false); atualizarBotaoJaOrientei();
        if (S.modo === 'prova' && P.cfg.max_mensagens && falasSuporte() >= P.cfg.max_mensagens) {
            bolha('sistema', 'Você chegou ao limite de ' + P.cfg.max_mensagens + ' mensagens deste caso.', 'aviso');
            return encerrar('Não resolvido');
        }
        if (S.modo === 'treino' && falasSuporte() >= MAX_TURNOS) toast('A conversa já está longa. Se estiver travado, use 💡 Dica ou 🏳️ Desistir.', 6000);
    }

    // Juiz independente: o suporte já orientou o que resolve?
    async function conferir() {
        try {
            const res = await chamarIA(L.montarJuiz(S.caso, S.hist), { temperature: 0.1, maxTokens: 300 });
            if (res && res._iaModelo) S.ultimoModelo = res._iaModelo;
            const j = L.interpretarJuiz(res && res.text);
            return j.indeciso ? { ok: true, falta: '' } : j;          // se o juiz não se entendeu, vale o que o cliente disse
        } catch (e) { console.warn('[simulador] juiz indisponível, vale o que o cliente disse:', e); return { ok: true, falta: '' }; }
    }

    function enviar(ev) {
        if (ev) ev.preventDefault();
        if (S.ocupado || S.encerrado) return;
        const t = $('txtSuporte').value.trim();
        if (!t) return;
        S.hist.push({ de: 'suporte', texto: t });
        bolha('suporte', t);
        $('txtSuporte').value = '';
        atualizarBotaoJaOrientei(); atualizarChipsProva();
        falaCliente();
    }

    async function pedirDica() {
        if (S.ocupado || S.encerrado) return;
        if (S.modo === 'prova' && !P.cfg.dicas) return;
        const tok = S.token;
        bloquear(true);
        const aviso = bolha('dica', 'Pensando numa dica…');
        try {
            const res = await chamarIA(L.montarDica(S.caso, S.hist), { temperature: 0.4, maxTokens: 300 });
            if (tok !== S.token) return;
            if (res && res._iaModelo) { S.ultimoModelo = res._iaModelo; atualizarSeloIA(); }
            const t = String(res.text || '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
            S.dicas++;
            aviso.querySelector('.txt').textContent = t || 'Pergunte ao cliente em qual tela ele está e o que aparece.';
        } catch (e) { aviso.remove(); toast('Não consegui gerar a dica agora.'); }
        if (tok === S.token) bloquear(false);
    }

    async function jaOrientei() {
        if (S.ocupado || S.encerrado) return;
        if (!L.temOrientacao(S.hist)) { toast('Orientações ainda curtas demais: explique o passo a passo ao cliente.'); return; }
        const tok = S.token;
        bloquear(true);
        const aviso = bolha('sistema', 'Conferindo se você orientou tudo o que resolve…');
        const ok = await conferir();
        if (tok !== S.token) return;
        aviso.remove();
        if (ok.ok) {
            const m = L.FRASE_FINAL; S.hist.push({ de: 'cliente', texto: m }); bolha('cliente', m); bloquear(false); return encerrar('Resolvido');
        }
        bloquear(false);
        // na prova o motivo do "ainda não" não é mostrado: dizer "falta X" entregaria a resposta
        bolha('sistema', S.modo === 'prova' ? 'Ainda não é o suficiente. Continue orientando o cliente.' : 'Ainda não é o suficiente' + (ok.falta ? ': ' + ok.falta : '.') + ' Continue orientando o cliente.', 'aviso');
    }

    async function desistir() {
        if (S.encerrado) return;
        if (S.modo === 'prova') { if (!window.confirm('Pular este caso? Ele conta como não resolvido.')) return; return encerrar('Não resolvido'); }
        if (!window.confirm('Encerrar o treino e ver a solução oficial?')) return;
        encerrar('Encerrado sem resolver');
    }

    // ── fim do caso ──
    function encerrar(resultado) {
        if (S.encerrado) return;
        S.encerrado = true; S.resultado = resultado; S.token++; bloquear(false);
        if (S.modo === 'prova') return encerrarCasoProva(resultado);
        clearInterval(S.timer);
        const ok = resultado === 'Resolvido';
        const seg = Math.max(0, Math.round((Date.now() - S.inicio) / 1000));
        const turnos = falasSuporte();
        $('tituloFim').textContent = ok ? '✅ Deu certinho! Caso resolvido' : '🏳️ Treino encerrado';
        $('fimStats').innerHTML = `<div class="sim-stat"><b>${turnos}</b><span>suas mensagens</span></div><div class="sim-stat"><b>${L.mmss(seg)}</b><span>tempo</span></div><div class="sim-stat"><b>${S.dicas}</b><span>dica(s) usada(s)</span></div><div class="sim-stat ${ok ? 'ok' : 'nao'}"><b>${ok ? 'Resolvido' : 'Sem resolver'}</b><span>resultado</span></div>`;
        $('fimCaso').innerHTML = `<b>${esc(S.caso.titulo)}</b> <span class="sim-chip suave">${esc(String(S.caso.categoria || 'Sem categoria'))}</span>${S.caso.caminho_menu ? `<br><small>Caminho no menu: ${esc(S.caso.caminho_menu)}</small>` : ''}`;
        let sol = String(S.caso.conteudo || '').trim(); if (S.caso.como_emitir) sol += '\n\n**Como emitir**\n' + String(S.caso.como_emitir).trim();
        try { $('fimSolucao').innerHTML = renderMd(sol); } catch (e) { $('fimSolucao').textContent = sol; }
        tela('telaFim');
        if (!S.gravado) {           // o treino fica registrado para o acompanhamento (não atrapalha se o SQL 06 ainda não foi rodado)
            S.gravado = true;
            D.registrarSessao({ nome: S.nome, nome_chave: S.chave, caso_id: S.caso.id != null ? Number(S.caso.id) : null, caso_titulo: S.caso.titulo, categoria: String(S.caso.categoria || '').trim() || null, perfil: S.perfil, resultado, turnos, dicas: S.dicas, duracao_s: seg, conversa: L.conversaParaGravar(S.hist), modelo: S.ultimoModelo || '' });
        }
    }

    function copiarConversa() { copiarTexto(L.textoParaCopiar(S.caso, S.hist, S.resultado || 'Em andamento'), 'Conversa copiada.'); }

    // ═════════ PROVA ═════════
    function abrirProva(p) {
        const cfg = L.configProva(p.config), itens = L.itensDaProva(p.itens), r = L.resumoTentativas(S.minhas, p.id), restam = L.tentativasRestantes(cfg, r.feitas);
        S.provaAtual = p;
        $('provaTitulo').textContent = p.titulo;
        $('provaCurso').hidden = !p.curso_nome; $('provaCurso').textContent = p.curso_nome ? '📖 Conteúdo: ' + p.curso_nome : '';
        $('provaDescricao').hidden = !String(p.descricao || '').trim(); $('provaDescricao').textContent = String(p.descricao || '').trim();
        const regras = [
            `${itens.length} caso(s) de atendimento, um cliente simulado em cada.`,
            `Para passar: nota mínima de ${cfg.nota_minima}% — resolver pelo menos ${L.calcularNota(itens.map(() => ({ resultado: 'x' })), cfg.nota_minima).minimoCasos} de ${itens.length} caso(s).`,
            cfg.max_mensagens ? `Até ${cfg.max_mensagens} mensagens suas por caso.` : 'Sem limite de mensagens por caso.',
            cfg.tempo_min ? `Tempo total: ${cfg.tempo_min} minuto(s) para a prova inteira.` : 'Sem limite de tempo.',
            cfg.dicas ? 'Dicas liberadas.' : 'Sem dicas, e a solução oficial não é mostrada durante a prova.',
            cfg.perfil === 'misto' ? 'Os clientes têm jeitos variados (comum, leigo ou apressado).' : 'Jeito do cliente: ' + L.PERFIS[cfg.perfil].nome.toLowerCase() + '.',
            cfg.max_tentativas ? `Tentativas: ${cfg.max_tentativas} no total (você já usou ${r.feitas}).` : 'Pode refazer quantas vezes precisar.',
            'Se não passar, você será orientado(a) a rever o conteúdo' + (p.curso_nome ? ' “' + p.curso_nome + '”' : '') + ' e poderá tentar de novo.',
        ];
        if (S.teste) regras.push('MODO TESTE: nada desta prova é gravado.');
        const ul = $('provaRegras'); ul.textContent = ''; regras.forEach(t => ul.appendChild(el('li', null, t)));
        const aviso = $('provaAviso');
        aviso.hidden = restam !== 0 || S.teste; aviso.textContent = restam === 0 ? 'Você já usou todas as tentativas desta prova. Fale com o responsável pelo treinamento.' : '';
        $('btnComecarProva').disabled = restam === 0 && !S.teste; $('btnComecarProva').textContent = r.feitas ? '▶ Começar de novo' : '▶ Começar a prova';
        const link = L.linkSeguro(p.curso_link);
        $('provaLinkCurso').hidden = !link; if (link) $('provaLinkCurso').href = link;
        tela('telaProva');
    }

    async function comecarProva() {
        const p = S.provaAtual, btn = $('btnComecarProva');
        if (!p || btn.disabled) return;
        const cfg = L.configProva(p.config), itens = L.itensDaProva(p.itens), aviso = $('provaAviso');
        btn.disabled = true; aviso.hidden = false; aviso.textContent = 'Preparando a prova…';
        try {
            if (!S.teste) {                      // confere de novo (pode ter feito em outro aparelho)
                const h = await D.minhasTentativas(S.chave);
                if (h.ok) { S.minhas = h.linhas; if (L.tentativasRestantes(cfg, L.resumoTentativas(S.minhas, p.id).feitas) === 0) { abrirProva(p); return; } }
            }
            const mapa = await D.buscarCasos(itens.filter(i => i.tipo === 'banco').map(i => i.id));
            let casos = itens.map(it => L.casoDoItem(it, it.tipo === 'banco' ? mapa.get(it.id) : null)).filter(Boolean);
            if (!casos.length) throw new Error('nenhum caso da prova pôde ser carregado (foram apagados do banco?)');
            if (casos.length < itens.length) console.warn('[simulador] ' + (itens.length - casos.length) + ' caso(s) da prova não foram encontrados e foram ignorados.');
            if (cfg.embaralhar) casos = L.embaralhar(casos);
            P = { prova: p, cfg, casos: casos.map(c => ({ caso: c, perfil: L.perfilDoCaso(cfg.perfil) })), idx: -1, resultados: [], tentativaId: null, tentativaPronta: false, numero: null, inicio: Date.now(),
                fimEm: cfg.tempo_min ? Date.now() + cfg.tempo_min * 60000 : 0, semRegistro: false, finalizada: false, expirando: false, teste: S.teste };
        } catch (e) {
            console.error('[simulador] prova:', e);
            aviso.textContent = '⚠️ Não consegui preparar a prova: ' + ((e && e.message) || e); btn.disabled = false; return;
        }
        aviso.hidden = true; btn.disabled = false;
        S.modo = 'prova';
        window.onbeforeunload = ev => { if (P && !P.finalizada) { ev.preventDefault(); ev.returnValue = ''; return ''; } };
        proximoCasoProva();
    }
    function proximoCasoProva() {
        if (!P || P.finalizada) return;
        P.idx++;
        if (P.idx >= P.casos.length) return finalizarProva();
        const c = P.casos[P.idx];
        prepararChat(c.caso, c.perfil);
        falaCliente();
    }
    function resultadoDoCaso(caso, resultado, extra) {
        return Object.assign({ titulo: caso.titulo, categoria: String(caso.categoria || '').trim(), origem: caso.origem || (caso.id != null ? 'banco' : 'custom'), caso_id: caso.id != null ? Number(caso.id) : null,
            resultado, turnos: 0, dicas: 0, duracao_s: 0, conversa: [] }, extra || {});
    }
    function registrarCasoProva(resultado) {
        if (P.resultados.length > P.idx) return;      // este caso já foi registrado
        P.resultados.push(resultadoDoCaso(S.caso, resultado, { turnos: falasSuporte(), dicas: S.dicas, duracao_s: Math.max(0, Math.round((Date.now() - S.inicio) / 1000)), conversa: L.conversaParaGravar(S.hist) }));
    }
    function encerrarCasoProva(resultado) {
        registrarCasoProva(resultado);
        const ultimo = P.idx >= P.casos.length - 1;
        $('proximoTxt').textContent = resultado === 'Resolvido' ? '✅ Caso resolvido!' : '⏭ Caso encerrado sem resolução.';
        $('btnProximo').textContent = ultimo ? 'Ver o resultado →' : 'Próximo caso →';
        $('barraProximo').hidden = false; $('formEnvio').hidden = true;
        $('btnJaOrientei').hidden = true;
    }
    function tempoEsgotado() {
        if (!P || P.finalizada || P.expirando) return;
        P.expirando = true; S.token++; digitando(false);
        if (!S.encerrado && P.idx >= 0 && P.idx < P.casos.length) { S.encerrado = true; registrarCasoProva('Tempo esgotado'); }
        toast('⏰ O tempo da prova acabou.', 7000);
        finalizarProva();
    }
    function abortarProva(msg) {
        window.onbeforeunload = null; clearInterval(S.timer); S.token++; digitando(false);
        P = null; S.modo = 'treino';
        carregarHistorico().then(() => { renderInicio(); tela('telaInicio'); toast(msg, 9000); });
    }

    // Cria a tentativa no banco (uma vez por prova). 'ok' | 'esgotadas' | 'indisponivel' | 'falhou' (não registrou, mas a prova segue)
    async function criarTentativa() {
        if (P.tentativaId || P.teste) return 'ok';
        if (P.semRegistro) return 'falhou';
        try {
            P.tentativaId = await D.iniciarTentativa(P.prova.id, S.nome, S.chave, P.cfg.nota_minima);
            P.numero = L.resumoTentativas(S.minhas, P.prova.id).feitas + 1;
            return 'ok';
        } catch (e) {
            if (e.tipo === 'esgotadas' || e.tipo === 'indisponivel') return e.tipo;
            if (e.tipo !== 'ausente') console.warn('[simulador] não registrei a tentativa:', e);
            P.semRegistro = true; return 'falhou';
        }
    }

    async function finalizarProva() {
        if (!P || P.finalizada) return;
        P.finalizada = true; clearInterval(S.timer); window.onbeforeunload = null; S.token++; digitando(false);
        for (let i = P.resultados.length; i < P.casos.length; i++) P.resultados.push(resultadoDoCaso(P.casos[i].caso, 'Não feito'));      // o que ficou para trás (tempo esgotado)
        P.calc = L.calcularNota(P.resultados, P.cfg.nota_minima);
        P.duracao = Math.max(0, Math.round((Date.now() - P.inicio) / 1000));
        mostrarResultado('gravando');
        let grav = 'teste';
        if (!P.teste) {
            grav = 'falhou';
            if (P.tentativaId || (await criarTentativa()) === 'ok') {
                try { grav = (await D.concluirTentativa(P.tentativaId, { nota: P.calc.nota, aprovado: P.calc.aprovado, detalhes: P.resultados, duracao_s: P.duracao, modelo: S.ultimoModelo })) ? 'ok' : 'falhou'; }
                catch (e) { console.warn('[simulador] não gravei o resultado:', e); }
            }
        }
        P.gravacao = grav;
        mostrarResultado(grav);
        if (!P.teste) carregarHistorico().then(() => { if (!$('telaInicio').hidden) renderInicio(); });
    }

    function mostrarResultado(grav) {
        const c = P.calc, ok = c.aprovado, p = P.prova, curso = p.curso_nome ? ' “' + p.curso_nome + '”' : '';
        $('resSelo').textContent = ok ? '🏆' : '📚';
        $('resTitulo').textContent = ok ? 'Parabéns, você foi aprovado(a)!' : 'Você ainda não atingiu a nota mínima';
        $('resSub').textContent = p.titulo + (p.curso_nome ? ' · ' + p.curso_nome : '');
        $('resStats').innerHTML = `<div class="sim-stat ${ok ? 'ok' : 'nao'}"><b>${c.nota}%</b><span>sua nota</span></div><div class="sim-stat"><b>${c.resolvidos} de ${c.total}</b><span>casos resolvidos</span></div><div class="sim-stat"><b>${P.cfg.nota_minima}%</b><span>nota mínima</span></div><div class="sim-stat"><b>${L.mmss(P.duracao || 0)}</b><span>tempo</span></div>`;
        const msg = ok ? (String(p.msg_aprovado || '').trim() || 'Muito bem! Você mostrou que domina este conteúdo. Pode seguir para o próximo passo do seu aprendizado.')
            : (String(p.msg_reprovado || '').trim() || 'Não foi desta vez — e tudo bem, faz parte do aprendizado. Revise o conteúdo com calma e faça a prova de novo.');
        $('resMensagem').textContent = msg;
        const topicos = L.topicosParaRever(P.resultados);
        $('resRevisar').hidden = ok;
        if (!ok) {
            $('resRevisarTxt').textContent = 'Antes de tentar de novo, volte ao conteúdo' + curso + ' e reveja principalmente o que apareceu nestes casos:';
            const ul = $('resTopicos'); ul.textContent = ''; topicos.slice(0, 8).forEach(t => ul.appendChild(el('li', null, t)));
            if (topicos.length > 8) ul.appendChild(el('li', 'mu', '… e mais ' + (topicos.length - 8) + ' caso(s).'));
        }
        const lista = $('resCasos'); lista.textContent = '';
        P.resultados.forEach(r => {
            const li = el('li', r.resultado === 'Resolvido' ? 'ok' : 'nao');
            li.append(el('span', 'ic', r.resultado === 'Resolvido' ? '✅' : '❌'), el('span', 't', r.titulo), el('small', null, r.resultado === 'Resolvido' ? r.turnos + ' msg' : r.resultado));
            lista.appendChild(li);
        });
        const lc = L.linkSeguro(p.curso_link), lp = L.linkSeguro(p.proximo_link);
        $('resLinkCurso').hidden = ok || !lc; if (lc) $('resLinkCurso').href = lc;
        $('resLinkProximo').hidden = !ok || !lp; if (lp) $('resLinkProximo').href = lp;
        const restam = P.cfg.max_tentativas ? Math.max(0, P.cfg.max_tentativas - (P.numero || L.resumoTentativas(S.minhas, p.id).feitas + 1)) : Infinity;
        $('btnRefazer').hidden = restam === 0; $('btnRefazer').textContent = ok ? '🔁 Fazer a prova de novo' : '🔁 Tentar a prova de novo';
        const g = $('resGravacao'); g.classList.toggle('erro', grav === 'falhou');
        g.textContent = grav === 'gravando' ? 'Registrando o seu resultado…' : grav === 'ok' ? '✔ Resultado registrado para o acompanhamento do treinamento.' : grav === 'teste' ? 'Modo teste: nada foi gravado.'
            : '⚠️ Não consegui registrar o resultado no servidor. Copie o comprovante abaixo e envie ao responsável pelo treinamento.';
        tela('telaResultado');
    }
    function copiarComprovante() {
        if (!P || !P.calc) return;
        copiarTexto(L.comprovante({ nome: S.nome, prova: P.prova.titulo, curso: P.prova.curso_nome, numero: P.numero, nota: P.calc.nota, notaMinima: P.cfg.nota_minima, aprovado: P.calc.aprovado, resolvidos: P.calc.resolvidos, total: P.calc.total, casos: P.resultados, data: new Date() }), 'Comprovante copiado.');
    }
    async function voltarInicio() {
        window.onbeforeunload = null; S.modo = 'treino'; S.provaAtual = null;
        if (P && P.finalizada) { await carregarHistorico(); }
        P = null; renderInicio(); tela('telaInicio');
    }
    async function refazerProva() {
        const p = P && P.prova; if (!p) return;
        await carregarHistorico(); P = null; S.modo = 'treino';
        abrirProva(p);
    }

    // ═════════ ligações ═════════
    async function iniciar() {
        const sel = $('fPerfil');
        Object.entries(L.PERFIS).forEach(([k, p]) => { const o = document.createElement('option'); o.value = k; o.textContent = `${p.nome} — ${p.desc}`; sel.appendChild(o); });
        atualizarSeloIA();
        $('btnSortear').addEventListener('click', sortear);
        $('fCategoria').addEventListener('change', filtrar);
        $('fBusca').addEventListener('input', filtrar);
        $('formEnvio').addEventListener('submit', enviar);
        $('txtSuporte').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(); } });
        $('btnDica').addEventListener('click', pedirDica);
        $('btnJaOrientei').addEventListener('click', jaOrientei);
        $('btnDesistir').addEventListener('click', desistir);
        $('btnNovo').addEventListener('click', () => { tela('telaInicio'); sortear(); });
        $('btnMesmo').addEventListener('click', () => { if (S.caso) iniciarCaso(S.caso.id); });
        $('btnInicio').addEventListener('click', () => { renderInicio(); tela('telaInicio'); });
        $('btnRever').addEventListener('click', () => { tela('telaChat'); $('txtSuporte').disabled = true; $('btnEnviar').disabled = true; $('btnDica').disabled = true; $('btnJaOrientei').hidden = true; $('btnDesistir').disabled = true; $('mensagens').scrollTop = $('mensagens').scrollHeight; });
        $('btnCopiar').addEventListener('click', copiarConversa);
        $('btnNome').addEventListener('click', trocarNome);
        $('btnProvaVoltar').addEventListener('click', () => { renderInicio(); tela('telaInicio'); });
        $('btnComecarProva').addEventListener('click', comecarProva);
        $('btnProximo').addEventListener('click', proximoCasoProva);
        $('btnRefazer').addEventListener('click', refazerProva);
        $('btnComprovante').addEventListener('click', copiarComprovante);
        $('btnResInicio').addEventListener('click', voltarInicio);

        const qs = new URLSearchParams(location.search);
        S.teste = qs.get('teste') === '1';
        const carga = Promise.all([carregarIndice(), carregarConfigEProvas()]);      // enquanto a pessoa digita o nome, o resto já carrega
        const v = await pedirNome(false);
        aplicarNome(v);
        await carga;
        await carregarHistorico();
        renderInicio(); tela('telaInicio');
        const pid = Number(qs.get('prova'));
        if (pid) {         // link direto de uma prova (ex.: botão no YOUniversity): ?prova=ID
            const p = S.provas.find(x => Number(x.id) === pid) || await D.buscarProva(pid);
            if (p && L.itensDaProva(p.itens).length) abrirProva(p); else toast('Essa prova não foi encontrada ou não está ativa.', 7000);
        }
    }
    window.Simulador = { S, getP: () => P, iniciarCaso, sortear, enviar, pedirDica, jaOrientei, encerrar, abrirProva, comecarProva, finalizarProva, renderInicio, tempoEsgotado };   // (também facilita testar)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
