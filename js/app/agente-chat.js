/* js/app/agente-chat.js — A PONTE entre o chat e o AGENTE DE IA (v29.0.0).

   O que mudou: quem RESPONDE no chat agora é o agente (js/agente/motor.js). Em vez de montar um prompt gigante e chamar a IA uma vez, ele
     1. pesquisa no banco SEM IA (palavras + significado), lê o artigo completo e, se a pergunta pedir, procura parâmetros / rejeição / menu / regras;
     2. entrega isso à IA, que quase sempre responde na 1ª chamada — ou pede mais uma ferramenta (conta exata, prazo de cancelamento, chave de acesso, status da SEFAZ…);
     3. a resposta passa pela "rede de segurança" (nunca o código do parâmetro, sem LaTeX, sem link de tela).
   O que NÃO mudou — tudo isto continua sendo do chat e funciona como antes: respostas rápidas aprovadas, saudações, agenda, geolocalização, os assistentes (regra, SEFAZ, relatórios), a
   "ferramenta recomendada", o log de toda pergunta (aba Revisão/Análise do painel), o 👍/👎, as imagens do procedimento, o histórico da conversa, o Meu Espaço e a voz.

   Esta ponte só faz a LIGAÇÃO: entrega ao agente os dados que o chat já baixou (artigos, vetores, parâmetros, funcionalidades, rotinas), o menu real, os pré-requisitos e a configuração de IA (MCP);
   desenha o cartão da resposta (passos, texto, fontes, botões); e grava o que o chat sempre gravou. O motor em si é GERADO a partir de agente-bsoft/nucleo (ferramentas-dev/publicar-no-chat.js).
   Reserva: se o agente não conseguir nem começar (ou estiver desligado em Personalizar › "Usar o Agente de IA", ou com ?agente=0 no endereço), o handleChat segue pelo caminho clássico, que continua em js/app/chat.js. */
const AgenteChat = (() => {
    'use strict';
    const VERSAO = '29.1.0';
    let preparando = null, agendado = false, falhas = 0, desligadoNaSessao = false, assinaturaAdotada = '', mapaManual = null, mapaManualN = -1, ultimoMCP = null, prepararMs = null;
    const REFAZER = new Map();     // ts do cartão → opções para "Tentar novamente"
    const RESUMIR = new Map();     // ts do cartão → { opts, contextoMsg, usado } (botão ⚡ Resumir)

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const cortar = (t, n) => { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
    const fmtMs = ms => ms >= 1000 ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : Math.round(ms) + ' ms';
    const motor = () => (typeof window !== 'undefined' ? window.Agente : (typeof globalThis !== 'undefined' ? globalThis.Agente : null));
    const aspas = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');   // para dentro de onclick="…('…')"

    // O chat JÁ tem o menu real (js/app/menu-bsoft.js), os pré-requisitos (js/app/prerequisitos.js) e os atalhos do sistema (js/app/sistema-bsoft.js): o agente usa os MESMOS módulos, sem cópia.
    // (por isso o motor gerado não leva menu.js, prereq.js nem sistema.js — ver ferramentas-dev/publicar-no-chat.js)
    (function ligarModulos() {
        const A = motor(); if (!A) return;
        try {
            if (typeof MenuBsoft !== 'undefined') A.menu = MenuBsoft;
            if (typeof Prereq !== 'undefined') A.prereq = Prereq;
            if (typeof SISTEMA_BSOFT_TMS !== 'undefined') A.sistema = SISTEMA_BSOFT_TMS;
        } catch (e) { console.warn('[agente] não consegui ligar os módulos do chat:', e); }
    })();

    /* ═════════ ligado? ═════════ */
    function ativo() {
        try { if (typeof location !== 'undefined' && /[?&]agente=0(?:&|$)/.test(location.search)) return false; } catch (e) { /* sem location */ }
        const A = motor();
        if (!A || !A.agente || !A.prereq || desligadoNaSessao) return false;
        try { return Prefs.get('agente') !== false; } catch (e) { return true; }
    }

    /* ═════════ preparar o motor (uma vez, quando o chat está livre) ═════════ */
    function chaveDeDados() {
        return [typeof manualVetorizado !== 'undefined' ? manualVetorizado.length : 0, typeof bancoCompletoRaw !== 'undefined' ? bancoCompletoRaw.length : 0,
            typeof dadosParametros !== 'undefined' ? dadosParametros.length : 0, typeof dadosFuncionalidades !== 'undefined' ? dadosFuncionalidades.length : 0, typeof dadosRotinas !== 'undefined' ? dadosRotinas.length : 0].join(':');
    }
    // entrega ao agente o que o chat JÁ baixou (nada é baixado duas vezes) — e refaz quando o chat ganha vetores novos (vetorização em segundo plano)
    function adotar() {
        const A = motor(), D = A.dados;
        const artigos = (typeof bancoCompletoRaw !== 'undefined' ? bancoCompletoRaw : []).map(r => ({
            id: r.id, titulo: String(r.titulo || '').trim(), conteudo: String(r.conteudo || ''), categoria: String(r.categoria || '').trim(),
            caminho: String(r.caminho_menu || '').trim(), comoEmitir: String(r.como_emitir || ''), imagens: Array.isArray(r.imagens) ? r.imagens : [], confirmacoes: 0, fonte: '',
        }));
        const vetores = new Map();
        (typeof manualVetorizado !== 'undefined' ? manualVetorizado : []).forEach(x => { if (x && x.idSupabase != null && x.vetor && x.vetor.length) vetores.set(x.idSupabase, Float32Array.from(x.vetor)); });
        D.adotar({ artigos, vetores, parametros: typeof dadosParametros !== 'undefined' ? dadosParametros : [], funcionalidades: typeof dadosFuncionalidades !== 'undefined' ? dadosFuncionalidades : [], rotinas: typeof dadosRotinas !== 'undefined' ? dadosRotinas : [] });
        assinaturaAdotada = chaveDeDados();
    }
    function prepararMotor() {
        if (preparando) return preparando;
        const A = motor();
        if (!A || !A.agente) return Promise.reject(new Error('o motor do agente não foi carregado'));
        try { if (typeof MCP_CFG !== 'undefined' && MCP_CFG) { A.mcp.usar(MCP_CFG); ultimoMCP = MCP_CFG; } } catch (e) { /* o motor lê o arquivo de configuração sozinho */ }
        // o chat já tem artigos, vetores, parâmetros, funcionalidades e rotinas: só faltam as rejeições da SEFAZ, as respostas aprovadas e o FAQ (tabelas pequenas)
        const t0 = performance.now();
        preparando = A.agente.preparar(null, false, { adotar, tabelas: ['rejeicoes', 'respostas', 'faq'], vetores: false });
        preparando.then(() => { prepararMs = Math.round(performance.now() - t0); }, e => { preparando = null; console.warn('[agente] não consegui preparar:', e && e.message || e); });
        return preparando;
    }
    // chamado pelo chat quando termina de carregar: prepara o motor numa folga do navegador (a 1ª pergunta já o encontra pronto)
    function agendar() {
        if (agendado) return; agendado = true;
        const f = () => { try { if (ativo()) prepararMotor().catch(() => { /* a 1ª pergunta tenta de novo */ }); } catch (e) { /* idem */ } };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(f, { timeout: 4000 }); else setTimeout(f, 1500);
    }

    /* ═════════ lógica pura (testada em Node) ═════════ */
    // id do artigo → item do chat (manualVetorizado: tem o vetor e o formato que o resto do chat entende)
    function mapaDoManual() {
        const mv = typeof manualVetorizado !== 'undefined' ? manualVetorizado : [];
        if (mapaManual && mapaManualN === mv.length) return mapaManual;
        mapaManual = new Map(); mv.forEach(x => { if (x && x.idSupabase != null) mapaManual.set(x.idSupabase, x); }); mapaManualN = mv.length;
        return mapaManual;
    }
    // Os artigos que o agente leu (primeiro) e os candidatos da pesquisa, NO FORMATO DO CHAT (idSupabase, erro, solucao, imagens, similaridade) — é o que "Ferramenta recomendada" e "Imagens do procedimento" esperam.
    // A semelhança é o cosseno com a pergunta (a mesma conta do chat); sem vetor da pergunta, vale a que o agente calculou.
    function rrCompat(usados, vp) {
        usados = usados || {};
        const mapa = mapaDoManual(), vistos = new Set(), out = [];
        const bruto = id => (typeof bancoCompletoRaw !== 'undefined' ? bancoCompletoRaw : []).find(r => r.id === id);
        const add = (id, simAgente) => {
            if (id == null || vistos.has(id)) return; vistos.add(id);
            const m = mapa.get(id); let base;
            if (m) base = Object.assign({}, m);
            else { const r = bruto(id); if (!r) return; base = { idSupabase: r.id, erro: r.titulo || '', solucao: r.conteudo || '', emitir: r.como_emitir || '', categoria: r.categoria || '', caminhoMenu: r.caminho_menu || '', imagens: r.imagens || null }; }
            let sim = Number(simAgente) || 0;
            if (vp && vp.length && m && m.vetor && typeof calcularSimilaridade === 'function') { try { sim = calcularSimilaridade(vp, m.vetor); } catch (e) { /* fica a do agente */ } }
            base.similaridade = sim; out.push(base);
        };
        (usados.lidos || []).forEach(t => { const m = /^A(\d+)$/.exec(String(t)); if (m) add(Number(m[1]), 0); });
        (usados.itens || []).forEach(it => add(it.id, it.sim != null ? it.sim : (it.cobertura ? it.cobertura * 0.6 : 0)));
        return out;
    }
    // O banco achou algo que sirva? (a mesma ideia do chat: nenhum artigo com semelhança ≥ 50 %, nem parâmetro pedido pelo código, nem resposta aprovada forte)
    function vumDe(itens, resultados) {
        const forte = (itens || []).some(i => i && (i.sim != null ? i.sim >= 0.5 : (i.cobertura || 0) >= 0.9));
        const rs = resultados || [];
        const pediuParam = rs.some(r => r && r.nome === 'buscar_parametros' && r.dados && ((r.dados.parametros || []).some(x => x.daPergunta) || (r.dados.funcionalidades || []).some(x => x.daPergunta)));
        const aprovada = rs.some(r => r && r.nome === 'buscar_conhecimento' && r.dados && (r.dados.respostas || []).some(x => x.confianca === 'alta'));
        return !forte && !pediuParam && !aprovada;
    }
    // respostas aprovadas que a pesquisa achou, no formato que o chat usa ({ item:{id,pergunta,resposta}, score })
    function aprovadasDoChat(resultados) {
        const out = [];
        (resultados || []).forEach(r => { if (r && r.nome === 'buscar_conhecimento' && r.dados) (r.dados.respostas || []).filter(x => x.confianca !== 'baixa').forEach(x => out.push({ item: { id: x.id, pergunta: x.titulo, resposta: x.doc ? x.doc.texto : '' }, score: x.dice || x.cobertura || 0.5, lex: x.cobertura || 0, cob: x.cobertura || 0 })); });
        return out;
    }
    // O histórico que o agente lê: as últimas mensagens ANTES da pergunta atual (o chat já pôs a pergunta no contexto)
    function historicoDaConversa(conversa) {
        const cx = (conversa && conversa.contexto) || [];
        let fim = cx.length; if (fim && cx[fim - 1] && cx[fim - 1].role === 'user') fim--;
        return cx.slice(Math.max(0, fim - 6), fim).filter(m => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim()).map(m => ({ role: m.role, content: String(m.content) }));
    }
    // "Dados do banco usados" do log (aba Revisão): os artigos lidos e os candidatos + respostas aprovadas + parâmetros + funcionalidades que o agente viu
    function fontesParaLog(usados, vp) {
        usados = usados || {};
        const rr = rrCompat(usados, vp).slice(0, 10);
        return fontesDoBanco({ artigos: rr, aprovadas: (usados.aprovadas || []).map(x => ({ item: { id: x.id, pergunta: x.titulo }, score: x.dice || x.cobertura || 0.5 })), parametros: (usados.pf && usados.pf.parametros) || [], funcionalidades: (usados.pf && usados.pf.funcionalidades) || [], rotinas: [] });
    }
    // curta ou completa? (preferência fixa; "perguntar" = completa, com o botão ⚡ Resumir no fim da resposta)
    function formatoEfetivo(opts) {
        let f = opts && opts.formato;
        if (!f) { try { f = (typeof Formato !== 'undefined') ? Formato.preferencia() : 'completa'; } catch (e) { f = 'completa'; } }
        return f === 'curta' ? 'curta' : 'completa';
    }

    /* ═════════ o cartão da resposta ═════════ */
    const htmlPasso = p => {
        const ic = p.estado === 'ok' ? '✓' : p.estado === 'erro' ? '✕' : '…';
        return '<li class="ag-passo ' + (p.estado === 'ok' ? 'ok' : p.estado === 'erro' ? 'erro' : 'rodando') + (p.origem === 'agente' ? ' agente' : '') + '"><span class="ag-ic">' + ic + '</span><span class="ag-rot">' + esc(p.rotulo || p.nome) + '</span>' + (p.resumo ? '<span class="ag-res">— ' + esc(p.resumo) + '</span>' : '') + (p.ms != null ? '<span class="ag-ms">' + fmtMs(p.ms) + '</span>' : '') + '</li>';
    };
    const htmlPassos = passos => {
        const ms = passos.reduce((s, p) => s + (p.ms || 0), 0);
        return '<summary>🔎 ' + passos.length + ' passo' + (passos.length > 1 ? 's' : '') + (ms ? ' · ' + fmtMs(ms) : '') + '</summary><ol class="ag-lista">' + passos.map(htmlPasso).join('') + '</ol>';
    };
    function htmlFontes(r) {
        let h = '';
        if (r.fontes && r.fontes.length) h += '<div class="ag-fontes"><span class="ag-rot">Fontes:</span>' + r.fontes.map(f => '<button type="button" class="ag-fonte" onclick="AgenteChat.abrirFonte(\'' + esc(f.id) + '\')" title="Abrir ' + esc(f.titulo) + '">📄 ' + esc(f.id) + ' · ' + esc(cortar(f.titulo, 58)) + '</button>').join('') + '</div>';
        if (r.consultados && r.consultados.length) h += '<div class="ag-fontes"><span class="ag-rot">Também achei:</span>' + r.consultados.map(f => '<button type="button" class="ag-fonte sec" onclick="AgenteChat.abrirFonte(\'' + esc(f.id) + '\')" title="' + esc(f.titulo) + '">' + esc(f.id) + ' · ' + esc(cortar(f.titulo, 46)) + '</button>').join('') + '</div>';
        return h;
    }
    function htmlVideos(r) {
        const v = []; (r.videos || []).forEach(g => (g.videos || []).forEach(x => { if (x && x.url) v.push('<a class="ag-video" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">▶ ' + esc(x.titulo || 'Vídeo') + '</a>'); }));
        return v.length ? '<div class="ag-midia">' + v.join('') + '</div>' : '';
    }
    // a barra de baixo é a MESMA do chat (👍 👎 · Nova conversa · CIOT, Blog, Manual, YouTube, Central), mais o botão de formato
    function htmlBarra(ts, query, formato, logTs) {
        const q = esc(aspas(query));   // (a pergunta vai dentro de onclick="…('…')": escapada para o JavaScript E para o atributo HTML)
        const fmtBtn = formato === 'curta'
            ? '<button type="button" class="btn-fmt-completa" onclick="fmtExpandir(this)">📖 Resposta completa detalhada</button>'
            : '<button type="button" class="feedback-btn ag-resumir" onclick="AgenteChat.resumir(this)" title="Refazer em até 8 linhas">⚡ Resposta curta</button>';
        return `<div class="feedback-area" id="_sf${ts}" data-log-ts="${logTs || ''}" style="display:none">
            ${fmtBtn}
            <span class="feedback-util">Esta resposta foi útil?</span>
            <button class="feedback-btn" onclick="saveFeedback(${ts},'positivo',this)">👍</button>
            <button class="feedback-btn" onclick="saveFeedback(${ts},'negativo',this)">👎</button>
            <button onclick="novaConversa()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);transition:all .2s;" onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">➕ Nova conversa</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #10b981, #059669);" onclick="Workspace.open('ciot', {beside: true})">🗺️ CIOT</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #dc2626, #991b1b);" onclick="Workspace.open('blog', {beside: true});document.getElementById('blogSearchInput').value='${q}';pesquisarNoBlog();">📝 Blog</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #2563eb, #1d4ed8);" onclick="Workspace.open('manual', {beside: true});">📘 Manual</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #ff0000, #cc0000);" onclick="Workspace.open('yt', {beside: true});document.getElementById('ytSearchInput').value='${q}';pesquisarNoYT();">🎬 YouTube</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, var(--central-color), var(--central-dark));" onclick="Workspace.open('central', {beside: true});document.getElementById('centralSearchInput').value='${q}';pesquisarNaCentral();">📚 Central</button>
            <span style="margin-left:auto;" id="_ib${ts}"></span>
        </div>`;
    }
    function montarCartao(ts, query, formato, logTs) {
        const card = document.createElement('div'); card.className = 'answer-card ag-card'; card.dataset.agTs = String(ts);
        card.innerHTML = `<div class="answer-section"><details class="ag-passos" open hidden></details>
            <div class="ag-status" role="status"><span class="ag-st-txt">Pesquisando no banco de conhecimento…</span><button type="button" class="ag-parar" title="Parar esta resposta">■ Parar</button></div>
            <div class="section-content" id="_sc${ts}"><span class="stream-thinking">💭 Pensando e formando resposta...</span><span class="stream-cursor"></span></div>
            <div class="ag-extra"></div></div>` + htmlBarra(ts, query, formato, logTs);
        return card;
    }

    /* ═════════ a resposta ═════════ */
    // Devolve true quando o agente tratou a pergunta (resposta, pergunta com botões ou "ferramenta recomendada"); false para o chat clássico seguir (nada foi mostrado nem gravado).
    // c: { query, queryNormalizada, vp (vetor da pergunta), opts, ld (cartão "Elaborando…"), _reuso, _ferrOfertadas, _t0, isCall }
    async function responder(c) {
        const A = motor(), opts = c.opts || {}, query = c.query, vp = c.vp, ld = c.ld;
        if (!A || !A.agente) return false;
        const conv0 = typeof conversaAtivaId !== 'undefined' ? conversaAtivaId : null;
        const mudou = () => typeof conversaAtivaId !== 'undefined' && conversaAtivaId !== conv0;   // trocou de conversa no meio: não escreve na outra
        try { await prepararMotor(); } catch (e) { if (++falhas >= 2) { desligadoNaSessao = true; console.warn('[agente] desligado nesta sessão (não consegui prepará-lo duas vezes); o chat clássico responde'); } return false; }
        // dados e configuração em dia (o chat ganha vetores em segundo plano; o painel pode mudar a cadeia de modelos)
        try { if (chaveDeDados() !== assinaturaAdotada) adotar(); } catch (e) { console.warn('[agente] não consegui atualizar os dados:', e); }
        try { if (typeof MCP_CFG !== 'undefined' && MCP_CFG && MCP_CFG !== ultimoMCP) { A.mcp.usar(MCP_CFG); ultimoMCP = MCP_CFG; } } catch (e) { /* segue com a configuração anterior */ }
        if (vp && vp.length) { try { A.busca.guardarVetor(c.queryNormalizada, vp); } catch (e) { /* só perde a economia de uma chamada à Jina */ } }

        const formato = c.isCall ? 'completa' : formatoEfetivo(opts);
        const historico = historicoDaConversa(typeof getConversaAtiva === 'function' ? getConversaAtiva() : null);
        const ts = Date.now(), ac = new AbortController();
        const passos = []; let statusTxt = 'Pesquisando no banco de conhecimento…';
        let card = null, contentEl = null, feedbackEl = null, passosEl = null, statusEl = null, guarda = null, parcial = '', raf = 0;
        let logTs = null, logFeito = false, vum = false, interceptado = false;

        const garantirLog = encontrou => { if (!logFeito) { logFeito = true; logTs = ('logTs' in opts) ? opts.logTs : logSearch(query, encontrou); } return logTs; };
        const pintarPassos = () => { if (!passosEl) return; passosEl.hidden = !passos.length; if (passos.length) passosEl.innerHTML = htmlPassos(passos); };
        const pintarStatus = () => { if (statusEl) { const t = statusEl.querySelector('.ag-st-txt'); if (t) t.textContent = statusTxt; } };
        const garantirCartao = () => {
            if (card) return;
            garantirLog(!vum);
            card = montarCartao(ts, query, formato, logTs);
            if (formato === 'curta' && typeof Formato !== 'undefined') { card.dataset.fmtCurta = String(ts); Formato.registrarCurta(ts, query, opts, { vp, logTs }); }
            contentEl = card.querySelector('#_sc' + ts); feedbackEl = card.querySelector('#_sf' + ts); passosEl = card.querySelector('.ag-passos'); statusEl = card.querySelector('.ag-status');
            statusEl.querySelector('.ag-parar').addEventListener('click', () => ac.abort());
            // (a guarda do idioma: a resposta TEM que sair em português; se vier inglês, não mostra e traduz no fim)
            guarda = _criarGuardaIdioma(contentEl, { atualizar: txt => _atualizarConteudoFluido(contentEl, renderMd(txt), true) });
            document.getElementById('chatStream').appendChild(card);
            if (ld) ld.remove();
            pintarPassos(); pintarStatus(); scrollToBottom(true);
        };
        const pintarTexto = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => { raf = 0; if (guarda) guarda.atualizar(parcial); if (typeof _atualizarBotaoScrollDown === 'function') _atualizarBotaoScrollDown(true); });
        };
        const aoEvento = e => {
            if (e.tipo === 'passo') { const i = passos.findIndex(p => p.id === e.passo.id); if (i >= 0) Object.assign(passos[i], e.passo); else passos.push(Object.assign({}, e.passo)); pintarPassos(); }
            else if (e.tipo === 'etapa') { statusTxt = e.texto; pintarStatus(); }
            else if (e.tipo === 'texto') { garantirCartao(); parcial = e.texto; if (statusEl) statusEl.hidden = true; pintarTexto(); }
            else if (e.tipo === 'rodada') { parcial = ''; if (contentEl) contentEl.innerHTML = '<span class="stream-thinking">🔧 Usando ferramentas...</span><span class="stream-cursor"></span>'; statusTxt = 'Usando ferramentas…'; if (statusEl) statusEl.hidden = false; pintarStatus(); }
            else if (e.tipo === 'tentativa') {
                const t = e.tentativa || {}; statusTxt = t.espera ? 'Modelos ocupados (limite de uso) — aguardando ' + t.espera + ' s…' : t.erro ? 'O modelo ' + String(t.modelo || '').split('/').pop() + ' não respondeu — tentando outro…' : 'Consultando ' + String(t.modelo || '').split('/').pop() + '…';
                if (statusEl) statusEl.hidden = false; pintarStatus();
            }
        };
        // Depois da pesquisa e ANTES de gastar a IA: o banco não achou e o assunto é de uma ferramenta do sistema? Mostra o botão da ferramenta (js/app/ferramenta-sugerida.js), como sempre fez.
        const interceptar = async pre => {
            vum = vumDe(pre.itens, pre.resultados);
            if (!c._reuso && !opts.forcarIA && !c.isCall && typeof FerrSug !== 'undefined') {
                let fs = null;
                try { fs = FerrSug.avaliar(query, { vum, rr: rrCompat({ itens: pre.itens, lidos: [] }, vp), rrUsadas: aprovadasDoChat(pre.resultados), ofertadas: c._ferrOfertadas || [] }); }
                catch (e) { console.warn('[ferramenta sugerida] não consegui avaliar, seguindo com a IA:', e); }
                if (fs) {
                    if (ld) ld.remove();
                    FerrSug.mostrar(query, fs, { logTs: logSearch(query, false) });
                    simEnviarAoPainel({ tipo: 'bsoft:sim:trace', fonte: 'ferramenta', pergunta: query, ferramentas: [fs.principal].concat(fs.outras).map(x => ({ nome: x.nome, direto: x.direto ? x.direto.tipo + ' ' + x.direto.codigo : '', motivo: fs.motivo })), ms: Math.round(performance.now() - c._t0), bloqueios: window.BSOFT_SIM_BLOQUEIOS.length, bloqueiosLista: window.BSOFT_SIM_BLOQUEIOS.slice(-20) });
                    interceptado = true; return true;
                }
            }
            garantirCartao();   // a pergunta vira uma linha do log (encontrou = o banco tinha algo) e o cartão da resposta aparece, já mostrando os passos da pesquisa
            return false;
        };

        let r;
        try {
            r = await A.agente.responder({ pergunta: query, historico, formato, expandida: !!opts.expandida, instrucaoExtra: opts.instrucaoExtra, consultaBusca: opts.buscaTexto, vetorBusca: vp, semAtalhos: true, sinal: ac.signal, aoEvento, interceptar });
        } catch (e) { r = { tipo: 'erro', erro: (e && e.message) || String(e) }; }
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (interceptado || r.tipo === 'interceptado') return true;
        if (r.tipo === 'erro' && !card) { console.warn('[agente] erro antes de mostrar qualquer coisa — o chat clássico responde:', r.erro); return false; }
        garantirCartao();
        if (statusEl) statusEl.remove();
        const det = passosEl; if (det) { det.open = false; pintarPassos(); }
        const opcoesRetry = Object.assign({}, opts, { pergunta: query, reutilizarMensagem: true, forcarIA: true, formatoDecidido: true, formato, vetor: vp, logTs });
        REFAZER.set(String(ts), opcoesRetry);
        const botaoRetry = '<button type="button" onclick="AgenteChat.refazer(this)" style="padding:8px 18px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:13px;">🔄 Tentar novamente</button>';

        if (r.tipo === 'cancelado') { card.remove(); appendMessage('system', '⏹️ Resposta interrompida. Pergunte de novo quando quiser.'); return true; }
        if (r.tipo === 'erro' || r.tipo === 'emergencia') {
            // a IA não respondeu (todos os modelos falharam ou algo quebrou): o chat NÃO grava isto como resposta (não vai para a Revisão) nem guarda na memória da conversa
            const aviso = '<div style="color:var(--text-muted);font-style:italic;font-size:13px;margin-bottom:10px;">⚠️ Não foi possível obter resposta dos modelos de IA no momento.' + (r.erro ? ' <small>(' + esc(cortar(r.erro, 110)) + ')</small>' : '') + '</div>';
            contentEl.innerHTML = aviso + (r.tipo === 'emergencia' && r.texto ? '<div style="margin-bottom:10px">' + renderMd(r.texto.replace(/^⚠️[^\n]*\n+/, '')) + '</div>' : '') + botaoRetry;
            feedbackEl.style.display = 'flex'; scrollToBottom(true); return true;
        }

        // ── resposta (ou pergunta com botões) ──
        let texto = r.texto || '';
        const ehPergunta = r.tipo === 'pergunta' && r.pergunta;
        try { texto = (await guarda.concluir(texto)).texto; } catch (e) { /* segue com o texto como veio */ }
        _atualizarConteudoFluido(contentEl, renderMd(texto), false);
        let imagens = [], analise = [];
        if (!ehPergunta && typeof BancoImg !== 'undefined') { try { const a = BancoImg.analisar(rrCompat(r.usados, vp), texto, query); imagens = a.imagens; analise = a.candidatos; } catch (e) { console.warn('[imagens] não consegui escolher as imagens do artigo:', e); } }
        if (imagens.length && typeof BancoImgUI !== 'undefined') { try { BancoImgUI.anexar(card, imagens); } catch (e) { console.warn('[imagens] não consegui mostrar as imagens do artigo:', e); } }
        const extra = card.querySelector('.ag-extra');
        let htmlExtra = '';
        if (ehPergunta) htmlExtra += '<div class="ag-opcoes">' + r.pergunta.opcoes.map(o => '<button type="button" onclick="AgenteChat.escolher(this)" data-o="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div>';
        if (!ehPergunta) htmlExtra += htmlFontes(r) + htmlVideos(r);
        if (r.avisos && r.avisos.length) htmlExtra += r.avisos.map(a => '<div class="ag-aviso">' + esc(a) + '</div>').join('');
        extra.innerHTML = htmlExtra;
        const ib = card.querySelector('#_ib' + ts); if (ib) ib.innerHTML = '<span style="font-size:10px;color:#0369a1;background:#f0f9ff;padding:2px 7px;border-radius:10px;border:1px solid #bae6fd;font-weight:600;" title="' + esc((r.modelos || []).join(' → ')) + '">🤖 Agente · ' + esc(String(r.modelo || '').split('/').pop()) + ' · ' + fmtMs(r.ms) + '</span>';
        if (!ehPergunta) feedbackEl.style.display = 'flex';
        scrollToBottom();   // (sem forçar: quem já subiu para ler o começo da resposta não é puxado de volta)

        // memória da conversa, log e avisos — exatamente o que o chat sempre fez
        const opcoesTxt = ehPergunta ? r.pergunta.opcoes : null;
        if (!mudou()) {
            adicionarMensagemNaConversa('ai', ehPergunta ? texto + '\n(opções: ' + opcoesTxt.join(' | ') + ')' : texto.replace(/\*\*(.*?)\*\*/g, '$1'), undefined, { imagens });
            if (formato === 'curta' && typeof Formato !== 'undefined') Formato.marcarNoContexto(ts);
            if (formato !== 'curta' && !ehPergunta) { let cm = null; try { const cv = getConversaAtiva(); if (cv && cv.contexto && cv.contexto.length) cm = cv.contexto[cv.contexto.length - 1]; } catch (e) { /* só deixa de limpar */ } RESUMIR.set(String(ts), { opts: Object.assign({}, opts, { pergunta: query, reutilizarMensagem: true, formatoDecidido: true, formato: 'curta', vetor: vp, logTs }), contextoMsg: cm, usado: false }); }
        }
        let fontesLog = null; try { fontesLog = fontesParaLog(r.usados, vp); } catch (e) { console.warn('[log] não consegui listar os dados do banco usados:', e); }
        registrarRespostaNoLog(logTs, { resposta: texto + (ehPergunta ? '\n\n[Botões oferecidos: ' + opcoesTxt.join(' | ') + ']' : ''), fonte: 'ia', modelo: r.modelo, fontes: fontesLog, revisao: ehPergunta ? 'ignorada' : undefined });
        simEnviarAoPainel({ tipo: 'bsoft:sim:trace', fonte: 'ia', pergunta: query, modelo: r.modelo, ms: Math.round(performance.now() - c._t0), bloqueios: window.BSOFT_SIM_BLOQUEIOS.length, bloqueiosLista: window.BSOFT_SIM_BLOQUEIOS.slice(-20), forcouIA: !!opts.forcarIA, formato, esclarecimento: opcoesTxt, modoEsclarecimento: 'agente', rrContexto: (r.usados && r.usados.aprovadas || []).map(x => ({ id: x.id, pct: Math.round((x.dice || x.cobertura || 0) * 100) })), imagens: imagens.length, imagensAnalise: analise, agente: { chamadasIA: r.chamadasIA, tokens: r.tokens, passos: (r.passos || []).map(p => p.nome), modelos: r.modelos } });
        console.log('%c🤖 [agente] ' + fmtMs(r.ms) + ' · ' + r.chamadasIA + ' chamada(s) de IA · ' + ((r.tokens && (r.tokens.entrada + r.tokens.saida)) || 0) + ' tokens · ' + (r.modelo || '?') + ' · passos: ' + (r.passos || []).map(p => p.nome).join(', '), 'color:#7c3aed;font-weight:600;');
        if (document.hidden) _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS respondeu', texto.replace(/[*_#`]/g, '').trim(), 'bsoft-ia-resposta');
        if (c.isCall) { try { speak(texto); } catch (e) { /* sem voz */ } }
        return true;
    }

    /* ═════════ botões do cartão ═════════ */
    function cartaoDe(btn) { return btn && btn.closest ? btn.closest('.answer-card') : null; }
    // um dos botões da pergunta do agente: vale como a pessoa ter digitado aquela opção
    function escolher(btn) {
        const card = cartaoDe(btn); if (!card) return;
        const o = btn.dataset.o || btn.textContent;
        card.querySelectorAll('.ag-opcoes button').forEach(b => { b.disabled = true; if (b === btn) b.classList.add('escolhida'); });
        fillAndSend(o);
    }
    async function refazer(btn) {
        const card = cartaoDe(btn), opts = card && REFAZER.get(String(card.dataset.agTs));
        if (!opts) return;
        card.remove();
        try { await handleChat(Object.assign({}, opts)); } catch (e) { console.warn('[agente] nova tentativa falhou:', e); appendMessage('ai', '😕 Não consegui responder agora. Tente de novo em instantes.'); }
    }
    // "⚡ Resposta curta": refaz em até 8 linhas (a longa continua na tela, mas sai da memória da conversa — senão a IA veria a própria resposta longa)
    async function resumir(btn) {
        const card = cartaoDe(btn), r = card && RESUMIR.get(String(card.dataset.agTs));
        if (!r || r.usado) return;
        r.usado = true; btn.disabled = true; btn.textContent = '⚡ Gerando a resposta curta abaixo…';
        try { const c = getConversaAtiva(); if (c && r.contextoMsg) { c.contexto = c.contexto.filter(m => m !== r.contextoMsg); salvarConversas(); } } catch (e) { /* conforto */ }
        try { await handleChat(Object.assign({}, r.opts)); } catch (e) { console.warn('[agente] resposta curta falhou:', e); }
        btn.textContent = '✔ Resposta curta aberta abaixo';
    }
    // a fonte (artigo, resposta aprovada, FAQ) inteira, numa janela — sem o código de parâmetro, como em toda parte
    function abrirFonte(id) {
        const A = motor(); const it = A && A.ferramentas && A.ferramentas.achar ? A.ferramentas.achar(id) : null;
        if (!it) { try { Toast.show('Não achei esse item agora.', { kind: 'warn' }); } catch (e) { /* sem aviso */ } return; }
        let dlg = document.getElementById('agDialogo');
        if (!dlg) {
            dlg = document.createElement('dialog'); dlg.id = 'agDialogo'; dlg.className = 'ag-dialog'; dlg.setAttribute('aria-labelledby', 'agDTit');
            dlg.innerHTML = '<div class="ag-d-cab"><h2 id="agDTit"></h2><button type="button" class="ag-d-x" aria-label="Fechar">✕</button></div><div class="ag-d-meta"></div><div class="ag-d-corpo"></div><div class="ag-d-midia"></div>';
            dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('.ag-d-x')) dlg.close(); });
            document.body.appendChild(dlg);
        }
        dlg.querySelector('#agDTit').textContent = it.titulo;
        dlg.querySelector('.ag-d-meta').textContent = [id, it.categoria, it.caminho ? 'menu: ' + it.caminho : ''].filter(Boolean).join(' · ');
        dlg.querySelector('.ag-d-corpo').textContent = A.saneamento.semCodigo(it.texto);
        dlg.querySelector('.ag-d-midia').innerHTML = ((it.imagens || []).map(im => im && im.url ? '<a href="' + esc(im.url) + '" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="' + esc(im.url) + '" alt="' + esc(im.legenda || 'Imagem do procedimento') + '"></a>' : '').join('')) + ((it.videos || []).map(v => v && v.url ? '<a class="ag-video" href="' + esc(v.url) + '" target="_blank" rel="noopener noreferrer">▶ ' + esc(v.titulo || 'Vídeo') + '</a>' : '').join(''));
        dlg.showModal();
    }
    // nova conversa / troca de conversa: os cartões saíram da tela
    function limpar() { REFAZER.clear(); RESUMIR.clear(); }

    // para o suporte (console): AgenteChat.diagnostico()
    function diagnostico() {
        const A = motor();
        return { versao: VERSAO, ativo: ativo(), preparado: !!(A && A.agente && A.agente.estado.fase === 'pronto'), fase: A && A.agente ? A.agente.estado.fase : 'sem motor', prepararMs, falhas, desligadoNaSessao,
            dados: A && A.dados ? A.dados.estado.contagens : null, vetores: A && A.dados ? A.dados.vetores.size : 0, avisos: A && A.agente ? A.agente.estado.avisos : [], modelos: A && A.mcp ? A.mcp.estado().modelos.map(m => ({ modelo: m.modelo, morto: m.morto, frio: m.frio })) : [] };
    }

    return { VERSAO, ativo, agendar, prepararMotor, responder, escolher, refazer, resumir, abrirFonte, limpar, diagnostico, logica: { rrCompat, vumDe, aprovadasDoChat, historicoDaConversa, fontesParaLog, formatoEfetivo, adotar, chaveDeDados, htmlPasso, htmlPassos, htmlFontes, htmlBarra } };
})();
