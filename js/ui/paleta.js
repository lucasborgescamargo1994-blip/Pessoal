/* js/ui/paleta.js — Paleta de comandos (Ctrl+K). */
'use strict';
/* ── paleta de comandos (Ctrl+K) ─────────────────────────────────────────── */
const Palette = (() => {
    let root = null, input = null, list = null, items = [], sel = 0, shown = false, askIdx = -1;
    const score = (nq, text) => {
        if (!nq) return 1;
        const t = norm(text); let s = 0;
        for (const tk of nq.split(/\s+/).filter(Boolean)) {
            const i = t.indexOf(tk);
            if (i < 0) { if (tk.length < 4) return 0; let j = 0; for (const ch of t) { if (ch === tk[j]) j++; if (j === tk.length) break; } if (j < tk.length) return 0; s += 1; }   // aproximada só p/ palavras de 4+ letras
            else s += 10 - Math.min(i, 8) * .5 + (i === 0 || t[i - 1] === ' ' ? 6 : 0);
        }
        return s;
    };
    const actions = () => [
        { id: 'new-chat', title: 'Nova conversa', sub: 'Começar uma conversa do zero', icon: 'newchat', kw: 'novo chat conversa limpar', run: () => { Workspace.open('chat'); novaConversa(); } },
        { id: 'split', title: Workspace.state.split ? 'Fechar a tela dividida' : 'Dividir a tela', sub: 'Ver duas abas lado a lado · Ctrl+\\', icon: 'split', kw: 'dividir lado a lado split', run: () => Workspace.toggleSplit() },
        { id: 'prefs', title: 'Personalizar o sistema', sub: 'Cores, fundo, animações, abas e atalhos', icon: 'sliders', kw: 'ajustes configuracoes tema cores aparencia', run: () => V.Personalizar && V.Personalizar.open() },
        { id: 'sidebar', title: 'Mostrar ou ocultar as conversas', sub: 'Barra lateral com o histórico', icon: 'sidebar', kw: 'historico lateral', run: () => toggleSidebar() },
        { id: 'note-new', title: 'Meu Espaço: nova anotação', sub: 'Cria uma nota em branco', icon: 'edit', kw: 'nota anotacao escrever', run: () => V.Space && V.Space.newNote() },
        { id: 'ag-new', title: 'Agenda: nova tarefa', sub: 'Tarefa com data, responsável e lembrete', icon: 'plus', kw: 'tarefa nova lembrete criar agendar compromisso', run: () => V.Agenda.abrir({ newTask: {} }) },
        { id: 'ag-today', title: 'Agenda: mostrar as tarefas de hoje no chat', sub: 'Só você vê — nada vai para a IA', icon: 'chat', kw: 'tarefas hoje agenda chat lembretes dia', run: () => { Workspace.showChat(); V.AgendaChat.mostrarHoje(); } },
        { id: 'ag-board', title: 'Agenda: abrir o quadro do dia', sub: 'Atrasadas, tarefas de hoje e os próximos dias', icon: 'bellring', kw: 'quadro lembretes alerta atrasadas hoje agenda', run: () => V.Agenda.Remind.showBoard({ force: true }) },
        { id: 'space-folder', title: 'Meu Espaço: escolher a pasta dos dados', sub: 'Onde as suas anotações ficam guardadas', icon: 'folder', kw: 'pasta backup dados local', run: () => V.Space && V.Space.chooseFolder() },
        { id: 'space-export', title: 'Meu Espaço: exportar backup', sub: 'Baixa um arquivo com todas as suas notas', icon: 'download', kw: 'backup exportar baixar', run: () => V.MeuEspaco && V.MeuEspaco.exportFile() },
        { id: 'close-tab', title: 'Fechar a aba atual', sub: 'Alt+W', icon: 'x', kw: 'fechar aba', run: () => Workspace.close(Workspace.state.active) },
        { id: 'copilot', title: 'Abrir o Copilot (janela flutuante)', sub: 'O assistente sobre qualquer janela', icon: 'sparkles', kw: 'copilot flutuante pip', run: () => abrirCopilot() },
    ];
    function gather(q) {
        const nq = norm(q.trim()), out = [], W = Workspace;
        const usage = Prefs.get('usage') || {}, hidden = Prefs.get('hidden') || [];
        let tools = Object.keys(TOOLS).filter(id => id === 'chat' || !hidden.includes(id) || W.isOpen(id)).map(id => ({ id, s: score(nq, TOOLS[id].label + ' ' + (TOOLS[id].kw || '')) })).filter(x => x.s > 0);
        tools.sort((a, b) => b.s - a.s || ((usage[b.id] || {}).n || 0) - ((usage[a.id] || {}).n || 0));
        tools.forEach(({ id, s }) => out.push({ group: 'Ir para', icon: TOOLS[id].icon, color: TOOLS[id].color, title: TOOLS[id].label, s,
            sub: W.isVisible(id) ? 'Está na tela agora' : W.isOpen(id) ? 'Aba aberta — ir para ela' : TOOLS[id].desc, tag: W.isOpen(id) ? 'aberta' : '', run: e => W.open(id, { beside: !!(e && e.shiftKey) }) }));
        actions().map(a => ({ a, s: score(nq, a.title + ' ' + a.kw) })).filter(x => x.s > 0).slice(0, nq ? 5 : 6)
            .forEach(({ a, s }) => out.push({ group: 'Ações', icon: a.icon, title: a.title, sub: a.sub, s, run: a.run }));
        if (typeof conversas !== 'undefined') {
            const cs = nq ? conversas.map(c => ({ c, s: score(nq, c.titulo + ' ' + (c.primeiraPergunta || '')) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6)
                : conversas.slice(0, 4).map(c => ({ c, s: 1 }));
            cs.forEach(({ c, s }) => out.push({ group: 'Conversas', icon: 'chat', title: c.titulo, sub: `${c.mensagens.length} msgs · ${fmtDataCurta(new Date(c.data).getTime())}`, s, tag: c.id === conversaAtivaId ? 'atual' : '', run: () => selecionarConversa(c.id) }));
        }
        if (V.MeuEspaco) V.MeuEspaco.search(q, nq ? 6 : 3).forEach(n => out.push({ group: 'Meu Espaço', icon: 'note', color: '#d97706', title: n.title || 'Sem título', sub: (n.body || '').replace(/\s+/g, ' ').slice(0, 90) || 'Nota vazia', s: 5, run: () => V.Space && V.Space.openNote(n.id) }));
        if (V.Agenda && nq) V.Agenda.search(q, 4).forEach(t => out.push({ group: 'Agenda', icon: 'calendarcheck', color: '#d97706', title: t.title, sub: (t.date ? V.Agenda.fmtCurto(t.date) + (t.time ? ' · ' + V.Agenda.fmtTempo(t.time) : '') : 'Sem data') + (t.owner ? ' · ' + t.owner : ''), s: 5, run: () => V.Agenda.abrir({ date: t.date || undefined, edit: t.id }) }));
        if (q.trim()) { askIdx = out.length; out.push({ group: 'Perguntar à IA', icon: 'sparkles', color: '#a78bfa', title: `Perguntar: “${q.trim()}”`, sub: 'Envia sua pergunta para o chat · Ctrl+Enter', s: 0, run: () => ask(q) }); }
        else askIdx = -1;
        return out;
    }
    function build() {
        root = el('div', 'pal-overlay', 'palOverlay');
        root.innerHTML = `<div class="pal pop-card" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
            <div class="pal-search">${icon('search', 18)}<input id="palInput" type="text" placeholder="Buscar abas, conversas, notas… ou escreva uma pergunta para a IA" autocomplete="off" spellcheck="false" aria-label="Buscar ou perguntar"><kbd>Esc</kbd></div>
            <div class="pal-list" id="palList" role="listbox"></div>
            <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Shift</kbd><kbd>Enter</kbd> ao lado</span><span><kbd>Ctrl</kbd><kbd>Enter</kbd> perguntar à IA</span></div></div>`;
        document.body.appendChild(root);
        input = $('#palInput', root); list = $('#palList', root);
        root.addEventListener('mousedown', e => { if (e.target === root) close(); });
        input.addEventListener('input', refresh);
        input.addEventListener('keydown', onKey);
        list.addEventListener('mousemove', e => { const it = e.target.closest('.pal-item'); if (it && +it.dataset.i !== sel) { sel = +it.dataset.i; paint(false); } });
        list.addEventListener('click', e => { const it = e.target.closest('.pal-item'); if (it) run(+it.dataset.i, e); });
    }
    function refresh() {
        const q = input.value;
        items = gather(q); sel = 0;
        const words = q.trim().split(/\s+/).filter(Boolean).length, best = items.reduce((m, x, i) => (i === askIdx ? m : Math.max(m, x.s)), 0);
        if (askIdx >= 0 && (best < 8 && (words >= 4 || /\?\s*$/.test(q)))) sel = askIdx;
        let html = '', lastG = '';
        items.forEach((it, i) => {
            if (it.group !== lastG) { lastG = it.group; html += `<div class="pal-group">${esc(it.group)}</div>`; }
            html += `<div class="pal-item" role="option" data-i="${i}" style="--c:${it.color || 'var(--primary)'}"><span class="pal-ic">${icon(it.icon, 17)}</span><span class="pal-tx"><b>${esc(it.title)}</b><small>${esc(it.sub || '')}</small></span>${it.tag ? `<span class="pal-tag">${esc(it.tag)}</span>` : ''}<span class="pal-go">${icon('enter', 14)}</span></div>`;
        });
        list.innerHTML = html || '<div class="pal-empty">Nada encontrado.</div>';
        paint(true);
    }
    function paint(scroll) {
        $$('.pal-item', list).forEach(n => n.classList.toggle('is-sel', +n.dataset.i === sel));
        const cur = $(`.pal-item[data-i="${sel}"]`, list); if (cur && scroll !== false) cur.scrollIntoView({ block: 'nearest' });
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(items.length, 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(items.length, 1); paint(); }
        else if (e.key === 'Home') { e.preventDefault(); sel = 0; paint(); }
        else if (e.key === 'End') { e.preventDefault(); sel = Math.max(items.length - 1, 0); paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); if ((e.ctrlKey || e.metaKey) && input.value.trim()) ask(input.value); else run(sel, e); }
        else if (e.key === 'Tab') { e.preventDefault(); sel = (sel + (e.shiftKey ? -1 : 1) + items.length) % Math.max(items.length, 1); paint(); }   // foco fica na paleta; Tab percorre os resultados
    }
    function run(i, e) { const it = items[i]; if (!it) return; close(); setTimeout(() => { try { it.run(e); } catch (err) { console.warn('[v27] paleta', err); } }, 30); }
    function ask(text) {
        const t = String(text || '').trim(); if (!t) return;
        close(); Workspace.open('chat');
        const i = $('#searchInput'); if (!i) return;
        i.value = t;
        if (typeof isVectorizing !== 'undefined' && isVectorizing) { Toast.show('A base ainda está carregando — sua pergunta ficou no campo, é só enviar em instantes.', { kind: 'warn' }); i.focus(); return; }
        handleChat();
    }
    function open(prefill) {
        if (!root) build();
        shown = true; root.classList.add('is-on'); input.value = prefill || ''; refresh();
        setTimeout(() => input.focus(), 10);
    }
    function close() { if (!shown) return; shown = false; root.classList.remove('is-on'); }
    return { open, close, toggle: () => (shown ? close() : open()), ask, get isOpen() { return shown; } };
})();
V.Palette = window.Palette = Palette;
