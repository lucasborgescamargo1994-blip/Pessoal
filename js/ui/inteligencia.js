/* js/ui/inteligencia.js — Sugestões inteligentes, salvar resposta no Meu Espaço e relógio compacto. */
'use strict';
/* ── inteligência da tela: sugestões, "Meu Espaço" nas respostas, anel de IA ocupada ── */
const Smart = (() => {
    let stream = null, dock = null, busy = false, raf = 0, pendingToast = false, dismissedFor = '';
    const RULES = [
        { tool: 'ciot', re: /\b(ciot|rota|roteiriz|distancia|geolocaliz|vale[- ]?pedagio|km\b)/, label: 'Validar a rota no Geolocalizador CIOT', search: false },
        { tool: 'yt', re: /\b(video|tutorial|passo a passo|treinamento|aprender)/, label: 'Ver vídeos da Bsoft sobre isso', search: true },
        { tool: 'manual', re: /\b(manual|documentacao|confluence|parametro|funcionalidade|configurac)/, label: 'Consultar o Manual Técnico', search: true },
        { tool: 'central', re: /\b(central de ajuda|artigo|ajuda|como fazer|procedimento)/, label: 'Buscar na Central de Ajuda', search: true },
        { tool: 'blog', re: /\b(blog|noticia|legislacao|medida provisoria|nota tecnica|mp\b)/, label: 'Procurar no Blog da Bsoft', search: true },
        { tool: 'repo', re: /\b(documento|pdf|planilha|arquivo|repositorio|anexo)/, label: 'Abrir o Repositório de documentos', search: true },
        // ferramentas em abas: só sugeridas quando o assunto está na PERGUNTA (não por a resposta citar a palavra)
        { tool: 'sefaz', re: /\b(rejeic|rejeitad|sefaz)/, label: 'Consultar a rejeição em Erros SEFAZ', search: false, soPergunta: true },
        { tool: 'params', re: /\b(parametro|funcionalidade|habilitar|permissao de)/, label: 'Buscar em Parâmetros / Funcionalidades', search: true, soPergunta: true },
    ];
    const lastUser = () => { const u = $$('.user-msg', stream).pop(); return u ? u.textContent.trim() : ''; };
    const lastAnswer = () => { const a = $$('.answer-card, .ai-msg', stream).pop(); return a ? (a.innerText || '').slice(0, 4000) : ''; };
    function openTool(tool, q) {
        if (TOOLS[tool] && TOOLS[tool].ferr) { Ferr.abrir(tool, { beside: true, consulta: tool === 'params' ? q : '', novo: tool === 'params' }); return; }
        Workspace.open(tool, { beside: true });
        const set = (id, v) => { const n = document.getElementById(id); if (n) n.value = v; };
        try {
            if (tool === 'central') { set('centralSearchInput', q); pesquisarNaCentral(); }
            else if (tool === 'yt') { set('ytSearchInput', q); pesquisarNoYT(); }
            else if (tool === 'blog') set('blogSearchInput', q);
            else if (tool === 'manual') set('manualSearchInput', q);
            else if (tool === 'repo') set('repositorioSearchInput', q);
        } catch (e) { /* painel ainda carregando */ }
    }
    function renderDock() {
        if (!dock) return;
        const q = lastUser();
        const nq = norm(q), na = norm(lastAnswer()), usage = Prefs.get('usage') || {};
        // a pergunta pesa mais que a resposta: só sugere se o assunto está na pergunta ou aparece mais de uma vez na resposta
        const count = re => (na.match(new RegExp(re.source, 'g')) || []).length;
        const hits = RULES.filter(r => (r.re.test(nq) || (!r.soPergunta && count(r.re) >= 2)) && !Workspace.isVisible(r.tool) && !(Prefs.get('hidden') || []).includes(r.tool))
            .sort((a, b) => (b.re.test(nq) ? 100 : 0) - (a.re.test(nq) ? 100 : 0) || ((usage[b.tool] || {}).n || 0) - ((usage[a.tool] || {}).n || 0)).slice(0, 3);
        const sig = q + '|' + hits.map(h => h.tool).join();
        if (!Prefs.get('smartDock') || !hits.length || !q || dismissedFor === sig) { dock.classList.remove('is-on'); return; }
        dock.innerHTML = `<span class="sd-label">${icon('sparkles', 13)}Sugestões</span>${hits.map(h => `<button class="dock-chip" data-tool="${h.tool}" style="--tool-c:${TOOLS[h.tool].color}">${icon(TOOLS[h.tool].icon, 14)}<span>${esc(h.label)}</span></button>`).join('')}<button class="sd-x" aria-label="Dispensar sugestões" title="Dispensar">${icon('x', 13, 2.4)}</button>`;
        dock.dataset.sig = sig; dock.classList.add('is-on');
    }
    function injectSave(fa) {
        fa.dataset.sp = '1';
        if (fa.querySelector('.btn-save-space') || (Prefs.get('hidden') || []).includes('space')) return;
        const b = el('button', 'btn-save-space', null, `${icon('note', 14)}<span>Meu Espaço</span>`);
        b.title = 'Guardar esta resposta nas suas anotações (ficam só no seu computador)';
        fa.insertBefore(b, fa.querySelector('span[id^="_ib"]'));
    }
    function scan(recs) {
        raf = 0;
        const nowBusy = !!stream.querySelector('.stream-cursor, .loading-dots');
        if (nowBusy !== busy) {
            busy = nowBusy; document.body.classList.toggle('ai-busy', busy);
            if (!busy) {
                if (Workspace.isVisible('chat')) setTimeout(renderDock, 350);
                else if (pendingToast) { pendingToast = false; Toast.show('A IA respondeu no Chat.', { icon: 'chat', action: { label: 'Ver', fn: () => Workspace.showChat() }, ms: 7000 }); }
            }
        }
        $$('.feedback-area:not([data-sp])', stream).forEach(injectSave);
        (recs || []).forEach(r => r.addedNodes.forEach(n => {
            if (n.nodeType !== 1 || r.target !== stream) return;
            if (n.classList.contains('user-msg') || n.id === 'welcomeMsg') { if (dock) dock.classList.remove('is-on'); return; }
            if (!Workspace.isVisible('chat') && /message|answer-card/.test(n.className) && !n.classList.contains('system-msg')) { if (!V.firstUnread) V.firstUnread = n; Workspace.markActivity('chat'); pendingToast = true; }
        }));
    }
    function init() {
        stream = document.getElementById('chatStream'); if (!stream) return;
        const wrapper = $('.input-wrapper'), area = $('.input-area', wrapper);
        dock = el('div', 'smart-dock', 'smartDock'); dock.setAttribute('aria-label', 'Sugestões'); wrapper.insertBefore(dock, area);
        dock.addEventListener('click', e => {
            if (e.target.closest('.sd-x')) { dismissedFor = dock.dataset.sig || ''; dock.classList.remove('is-on'); return; }
            const c = e.target.closest('.dock-chip'); if (c) { openTool(c.dataset.tool, lastUser()); dock.classList.remove('is-on'); }
        });
        // o campo de digitação cresce quando o dock aparece: o chat reserva o espaço certo embaixo
        const pane = document.getElementById('paneChat');
        new ResizeObserver(() => { const h = wrapper.offsetHeight; if (h > 0) pane.style.setProperty('--composer-h', Math.max(78, h - 44) + 'px'); }).observe(wrapper);
        const buf = [];
        new MutationObserver(recs => {
            recs.forEach(r => { if (r.target === stream && r.addedNodes.length) buf.push(r); });
            if (!raf) raf = requestAnimationFrame(() => scan(buf.splice(0)));   // no máx. 1x por quadro, mesmo com a resposta chegando aos pedaços
        }).observe(stream, { childList: true, subtree: true });
        // salvar resposta no Meu Espaço
        stream.addEventListener('click', e => {
            const b = e.target.closest('.btn-save-space'); if (!b) return;
            const fa = b.closest('.feedback-area'), card = fa ? fa.parentElement : b.parentElement;
            if (V.Space) V.Space.saveFromChat(card, b, lastUserFor(card));
        });
        scan([]);
    }
    function lastUserFor(card) { let n = card; while (n && (n = n.previousElementSibling)) { if (n.classList && n.classList.contains('user-msg')) return n.textContent.trim(); } return lastUser(); }
    return { init, openTool, renderDock };
})();
V.Smart = Smart;

/* ── relógio compacto (o texto antigo era longo demais para a barra de abas) ── */
function compactClock() {
    const b = document.getElementById('horarioBadge'); if (!b) return;
    const fix = () => {
        try {
            const i = obterSaudacao(), d = obterHoraBrasilia();
            const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
            const txt = `${i.emoji} ${dia} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            if (b.textContent !== txt) b.textContent = txt;
            b.title = 'Horário de Brasília — ' + i.dataCompleta;
        } catch (e) { /* mantém o texto original */ }
    };
    new MutationObserver(fix).observe(b, { childList: true, characterData: true, subtree: true });
    fix();
}
