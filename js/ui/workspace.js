/* js/ui/workspace.js — Abas, barra lateral de atalhos e tela dividida. */
'use strict';
/* ── workspace: rail, abas, painéis acoplados, divisão de tela ───────────── */
const Workspace = (() => {
    const st = { tabs: ['chat'], pinned: [], active: 'chat', right: null, ratio: .5 };
    const hist = ['chat'], loaded = {}, activity = {}, mem = {};
    let stage, tabsEl, indEl, railEl, emptyEl, dividerEl, tabbarEl, launcherEl;
    let booted = false, touched = false, emptyRight = false, ytOriginal = null, prevVis = new Set(['chat']), newTabId = null, dragId = null, lastCan = null;

    const isOpen = id => st.tabs.includes(id);
    const canSplit = () => !!stage && stage.clientWidth >= 760;
    const splitOn = () => !!st.right && st.right !== st.active && isOpen(st.right) && canSplit();
    const splitMode = () => splitOn() || (emptyRight && canSplit());
    const visibleIds = () => (splitOn() ? [st.active, st.right] : [st.active]);
    const isVisible = id => visibleIds().includes(id);
    const usageN = id => ((Prefs.get('usage') || {})[id] || {}).n || 0;

    /* estrutura ------------------------------------------------------------ */
    function build() {
        const layout = $('.app-layout'), main = $('.main-container'), header = $('header', main);
        railEl = el('nav', 'rail', 'wsRail');
        railEl.setAttribute('aria-label', 'Atalhos das ferramentas');
        railEl.innerHTML = `<div class="rail-tools" id="wsRailTools"></div><div class="rail-spacer"></div>
            <button class="rail-btn" data-act="sidebar" title="Mostrar ou ocultar a lista de conversas">${icon('sidebar', 21)}<span>Conversas</span></button>
            <button class="rail-btn" data-act="prefs" title="Personalizar o sistema">${icon('sliders', 21)}<span>Ajustes</span></button>`;
        layout.insertBefore(railEl, $('#sidebar'));

        tabbarEl = el('div', 'tabbar', 'wsTabbar');
        tabbarEl.innerHTML = `<div class="tabs-scroll" id="wsTabs" role="tablist" aria-label="Abas abertas"><i class="tab-indicator" id="wsInd"></i></div>
            <button class="tb-btn" id="wsAdd" title="Abrir ferramenta em uma nova aba" aria-label="Nova aba">${icon('plus', 17)}</button>
            <div class="tabbar-spacer"></div><div class="tabbar-end" id="wsEnd"></div>`;
        header.after(tabbarEl);
        const end = $('#wsEnd', tabbarEl);
        ['horarioBadge', 'statusSefazBadge', 'statusAnttBadge'].forEach(id => { const n = document.getElementById(id); if (n) end.appendChild(n); });
        end.insertAdjacentHTML('beforeend', `<span class="tabbar-sep"></span><button class="tb-btn tb-split" id="wsSplit" title="Dividir a tela (Ctrl+\\)" aria-label="Dividir a tela">${icon('split', 17)}</button>`);
        tabsEl = $('#wsTabs'); indEl = $('#wsInd');

        stage = el('div', 'ws-stage', 'wsStage');
        main.insertBefore(stage, $('#topTermsBar', main));
        const paneChat = el('div', 'ws-pane ws-pane-chat is-active', 'paneChat');
        stage.appendChild(paneChat);
        ['#topTermsBar', '#chatStream', '#btnScrollDown', '.input-wrapper'].forEach(s => { const n = $(s, main); if (n) paneChat.appendChild(n); });
        ['newsPanel', 'centralPanel', 'manualPanel', 'blogPanel', 'repositorioPanel', 'ciotPanel', 'ytPanel'].forEach(id => {
            const p = document.getElementById(id); if (p) { p.classList.add('ws-pane'); stage.appendChild(p); }
        });
        stage.appendChild(el('div', 'ws-pane', 'paneSpace'));
        stage.appendChild(el('div', 'ws-pane', 'paneAgenda'));
        Object.keys(TOOLS).filter(id => TOOLS[id].ferr).forEach(id => stage.appendChild(el('div', 'ws-pane ws-pane-tool', TOOLS[id].pane)));   // ferramentas em abas (js/app/ferramentas.js monta o conteúdo)
        dividerEl = el('div', 'ws-divider', 'wsDivider');
        dividerEl.setAttribute('role', 'separator'); dividerEl.setAttribute('aria-orientation', 'vertical');
        dividerEl.title = 'Arraste para ajustar • duplo clique para centralizar';
        stage.appendChild(dividerEl);
        emptyEl = el('div', 'ws-empty-right', 'wsEmptyRight');
        stage.appendChild(emptyEl);
        const yp = $('#ytPlayer'); ytOriginal = yp ? yp.innerHTML : null;

        // "IA Pronta (1234) [+56 repo]" é longo: o texto completo vira dica ao passar o mouse
        const sbadge = document.getElementById('statusBadge');
        if (sbadge) new MutationObserver(() => { sbadge.title = sbadge.textContent; }).observe(sbadge, { childList: true, characterData: true, subtree: true });
    }

    /* estado --------------------------------------------------------------- */
    function sortTabs() {
        const rest = st.tabs.filter(id => id !== 'chat');
        st.tabs = ['chat', ...rest.filter(id => st.pinned.includes(id)), ...rest.filter(id => !st.pinned.includes(id))];
    }
    function reorder(id, beforeId) {
        if (id === 'chat' || id === beforeId) return;
        const pinned = st.pinned.includes(id), arr = st.tabs.filter(x => x !== id);
        let idx = beforeId ? arr.indexOf(beforeId) : arr.length; if (idx < 0) idx = arr.length;
        const fo = arr.findIndex(x => x !== 'chat' && !st.pinned.includes(x));
        const zStart = pinned ? 1 : (fo < 0 ? arr.length : fo), zEnd = pinned ? (fo < 0 ? arr.length : fo) : arr.length;
        arr.splice(clamp(idx, zStart, zEnd), 0, id);
        st.tabs = arr;
    }
    function persist() { Prefs.setWs({ tabs: st.tabs.slice(), pinned: st.pinned.slice(), active: st.active, right: st.right, ratio: st.ratio }); }
    function pushHist(id) { const i = hist.indexOf(id); if (i >= 0) hist.splice(i, 1); hist.push(id); if (hist.length > 20) hist.shift(); }
    function snapScroll() {
        const s = $('#chatStream');
        if (s && prevVis.has('chat') && s.clientHeight) mem.chat = { top: s.scrollTop, bottom: s.scrollHeight - s.scrollTop - s.clientHeight };
    }

    /* ações públicas ------------------------------------------------------- */
    function open(id, o = {}) {
        if (!TOOLS[id]) return false;
        snapScroll();
        if (!isOpen(id)) { st.tabs.push(id); sortTabs(); newTabId = id; }
        Prefs.bump(id);
        if (id === 'chat') { st.active = 'chat'; if (st.right === 'chat') st.right = null; }
        else if (o.beside && canSplit()) {
            if (st.active === id) st.active = 'chat';
            st.right = id; emptyRight = false;
        } else if (emptyRight && canSplit() && id !== st.active) { st.right = id; emptyRight = false; }
        else if (!isVisible(id)) { st.active = id; if (st.right === id) st.right = null; }
        pushHist(st.active);
        commit({ focus: id === 'chat' || id === 'space' });
        return true;
    }
    const activate = id => open(id);
    function close(id) {
        if (id === 'chat' || !isOpen(id)) return;
        snapScroll();
        if (id === 'yt') { const p = $('#ytPlayer'); if (p && ytOriginal != null) p.innerHTML = ytOriginal; }   // para o vídeo ao fechar a aba
        loaded[id] = false; activity[id] = false;
        if (TOOLS[id].ferr && typeof Ferr !== 'undefined') Ferr.aoFechar(id);   // fechou a aba da ferramenta: a próxima vez começa do zero
        st.tabs = st.tabs.filter(x => x !== id); st.pinned = st.pinned.filter(x => x !== id);
        hist.splice(0, hist.length, ...hist.filter(x => x !== id));
        if (st.right === id) st.right = null;
        if (st.active === id) { st.active = [...hist].reverse().find(x => isOpen(x)) || 'chat'; if (st.right === st.active) st.right = null; }
        commit();
    }
    const toggle = id => (isVisible(id) ? (id === 'chat' ? null : close(id)) : open(id));
    function pin(id) {
        if (id === 'chat' || !isOpen(id)) return;
        st.pinned = st.pinned.includes(id) ? st.pinned.filter(x => x !== id) : [...st.pinned, id];
        sortTabs(); commit();
    }
    function closeOthers(keep) { st.tabs.filter(id => id !== 'chat' && id !== keep && !st.pinned.includes(id)).forEach(id => close(id)); }
    function cycle(dir) { const i = st.tabs.indexOf(st.active); activate(st.tabs[(i + dir + st.tabs.length) % st.tabs.length]); }
    function toggleSplit() {
        if (!canSplit()) { Toast.show('A janela está estreita demais para dividir a tela. Aumente a janela e tente de novo.', { kind: 'warn' }); return; }
        if (splitMode()) { st.right = null; emptyRight = false; commit(); return; }
        const partner = [...hist].reverse().find(x => x !== st.active && isOpen(x)) || st.tabs.find(x => x !== st.active);
        if (partner) st.right = partner; else emptyRight = true;
        commit();
    }
    function showChat(o = {}) {
        if (isVisible('chat')) return;
        if (o.beside !== false && canSplit() && st.active !== 'chat') { snapScroll(); st.right = st.active; st.active = 'chat'; emptyRight = false; pushHist('chat'); commit({ focus: true }); }
        else open('chat');
    }
    function chatLabel() {
        try { const c = typeof getConversaAtiva === 'function' && getConversaAtiva(); const t = c && c.titulo; return (!t || t === 'Nova Conversa') ? 'Chat' : t; } catch (e) { return 'Chat'; }
    }
    function refreshChatLabel() { const l = $('.tab[data-id="chat"] .tab-label', tabsEl); if (l) { const t = chatLabel(); if (l.textContent !== t) { l.textContent = t; positionIndicator(); } } }

    /* conversa ↔ tela lateral (cada conversa lembra o que estava ao lado dela) */
    function saveSideFor(cid) {
        if (!booted || !Prefs.get('rememberSide') || !cid || typeof conversas === 'undefined') return;
        const c = conversas.find(x => x.id === cid); if (!c) return;
        c.ws = { right: splitOn() && st.active === 'chat' ? st.right : null };
    }
    function restoreSideFor(cid) {
        if (!booted || !Prefs.get('rememberSide') || typeof conversas === 'undefined') return;
        const c = conversas.find(x => x.id === cid); if (!c || !c.ws) return;
        const r = c.ws.right;
        if (r && isOpen(r) && canSplit() && st.active === 'chat') { st.right = r; emptyRight = false; commit(); }
        else if (!r && st.right && st.active === 'chat') { st.right = null; commit(); }
    }

    /* renderização --------------------------------------------------------- */
    function commit(o = {}) { if (booted) touched = true; sortTabs(); persist(); render(o); }
    // as preferências chegaram depois (vindas da pasta do Meu Espaço): se o usuário ainda não mexeu nas abas, usa o layout salvo
    function reloadFromPrefs() { if (touched) { renderRail(); return; } restore(); render(); }

    function makeTab(id) {
        const t = TOOLS[id], n = el('div', 'tab');
        n.dataset.id = id; n.setAttribute('role', 'tab'); n.style.setProperty('--tool-c', t.color); n.title = t.desc;
        n.draggable = id !== 'chat';
        n.innerHTML = `<span class="tab-ic">${icon(t.icon, 15)}</span><span class="tab-label"></span><i class="tab-dot"></i>${id === 'chat' ? '' : `<button class="tab-x" aria-label="Fechar aba ${esc(t.short)}" title="Fechar (Alt+W)">${icon('x', 12, 2.4)}</button>`}`;
        $('.tab-label', n).textContent = id === 'chat' ? chatLabel() : t.short;
        return n;
    }
    function renderTabs() {
        const existing = new Map($$('.tab', tabsEl).map(t => [t.dataset.id, t]));
        st.tabs.forEach((id, i) => {
            let n = existing.get(id);
            if (!n) { n = makeTab(id); if (booted && newTabId === id) n.classList.add('tab-enter'); }
            existing.delete(id);
            const slot = tabsEl.children[i + 1];
            if (slot !== n) tabsEl.insertBefore(n, slot || null);
            const right = splitOn() && id === st.right;
            n.classList.toggle('is-active', id === st.active);
            n.classList.toggle('is-pair', right);
            n.classList.toggle('is-pinned', st.pinned.includes(id));
            n.classList.toggle('has-activity', !!activity[id] && !isVisible(id));
            n.setAttribute('aria-selected', id === st.active ? 'true' : 'false');
            n.tabIndex = id === st.active ? 0 : -1;   // "roving tabindex": Tab entra na lista de abas, setas navegam
        });
        existing.forEach(n => n.remove());
        newTabId = null;
        positionIndicator();
    }
    function positionIndicator() {
        const a = $('.tab.is-active', tabsEl);
        if (!a) { indEl.style.width = '0px'; return; }
        indEl.style.width = a.offsetWidth + 'px';
        indEl.style.transform = `translateX(${a.offsetLeft}px)`;
        const l = a.offsetLeft, r = l + a.offsetWidth;
        if (l < tabsEl.scrollLeft) tabsEl.scrollLeft = Math.max(0, l - 12);
        else if (r > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollLeft = r - tabsEl.clientWidth + 12;
    }
    function railIds() {
        const hidden = Prefs.get('hidden') || [];
        let ids = TOOL_ORDER.filter(id => id === 'chat' || !hidden.includes(id));
        if (Prefs.get('railOrder') === 'uso') {
            const fixed = ids.filter(id => TOOL_FIXED.includes(id)), rest = ids.filter(id => !TOOL_FIXED.includes(id)).sort((a, b) => usageN(b) - usageN(a) || TOOL_ORDER.indexOf(a) - TOOL_ORDER.indexOf(b));
            ids = [...fixed, ...rest];
        }
        return ids;
    }
    function renderRail() {
        const host = $('#wsRailTools'), ids = railIds(), sig = ids.join(',');
        if (host.dataset.sig !== sig) {
            host.dataset.sig = sig;
            host.innerHTML = ids.map((id, i) => { const t = TOOLS[id]; return `<button class="rail-btn rail-in" data-tool="${id}" style="--tool-c:${t.color};--i:${i}" title="${esc(t.label)} — ${esc(t.desc)}">${icon(t.icon, 21)}<span>${esc(t.short)}</span></button>`; }).join('');
        }
        const badges = V.badges ? V.badges() : {};
        $$('.rail-btn[data-tool]', host).forEach(b => {
            const id = b.dataset.tool;
            b.classList.toggle('is-active', isVisible(id));
            b.classList.toggle('is-open', isOpen(id) && !isVisible(id));
            let bd = $('.rail-badge', b); const v = badges[id] || (activity[id] && !isVisible(id) ? '•' : '');
            if (v) { if (!bd) { bd = el('i', 'rail-badge'); b.appendChild(bd); } if (bd.textContent !== String(v)) bd.textContent = v; }
            else if (bd) bd.remove();
        });
    }
    function renderEmpty() {
        const ids = TOOL_ORDER.filter(id => id !== 'chat' && id !== st.active && (Prefs.get('hidden') || []).indexOf(id) < 0);
        emptyEl.innerHTML = `<div class="er-ic">${icon('split', 26)}</div><b>Escolha o que abrir ao lado</b><span>A tela dividida mostra duas abas ao mesmo tempo.</span>
            <div class="er-grid">${ids.map(id => `<button data-open="${id}" style="--tool-c:${TOOLS[id].color}">${icon(TOOLS[id].icon, 15)}${esc(TOOLS[id].short)}</button>`).join('')}</div>`;
    }
    function render(o = {}) {
        if (!stage) return;
        const split = splitMode(), vis = new Set(visibleIds());
        activity[st.active] = false; if (splitOn()) activity[st.right] = false;
        stage.classList.toggle('is-split', split);
        stage.style.setProperty('--split-left', (st.ratio * 100).toFixed(2) + '%');
        emptyEl.classList.toggle('is-on', split && !splitOn());
        if (split && !splitOn()) renderEmpty();
        Object.keys(TOOLS).forEach(id => {
            const p = document.getElementById(TOOLS[id].pane); if (!p) return;
            p.classList.toggle('is-active', id === st.active);
            p.classList.toggle('is-left', split && id === st.active);
            p.classList.toggle('is-right', splitOn() && id === st.right);
            p.setAttribute('aria-hidden', vis.has(id) ? 'false' : 'true');
        });
        renderTabs(); renderRail();
        $('#wsSplit').classList.toggle('is-on', split);
        $('#wsSplit').title = split ? 'Fechar a tela dividida (Ctrl+\\)' : 'Dividir a tela (Ctrl+\\)';
        // painéis antigos: flag "aberto" = visível; efeitos de carga na primeira vez que aparecem
        Object.keys(LEGACY_FLAG).forEach(id => { try { LEGACY_FLAG[id](vis.has(id)); } catch (e) { /* binding ainda não existe */ } });
        vis.forEach(id => { if (!prevVis.has(id) || !loaded[id]) onShow(id, !prevVis.has(id)); });
        // o display:none do painel zera o scroll do chat: restaura (ou cola no fim se estava lá)
        const cs = $('#chatStream');
        if (vis.has('chat') && !prevVis.has('chat') && cs) {
            const fu = V.firstUnread; V.firstUnread = null;   // chegou resposta enquanto estava em outra aba: abre no começo dela, não no fim
            if (fu && fu.isConnected) cs.scrollTop = Math.max(0, fu.offsetTop - 16);
            else if (mem.chat) cs.scrollTop = mem.chat.bottom < 140 ? cs.scrollHeight : mem.chat.top;
        }
        if (vis.has('chat') && o.focus && innerWidth > 768) { const i = $('#searchInput'); if (i && !i.disabled) setTimeout(() => i.focus({ preventScroll: true }), 30); }
        prevVis = vis;
        document.body.classList.toggle('chat-hidden', !vis.has('chat'));
        lastCan = canSplit();
    }
    // Efeitos de "abrir" que o painel antigo fazia ao deslizar para dentro da tela
    const EVERY_SHOW = { repo: () => { try { carregarRepositorio().then(() => renderizarListaRepositorio()); } catch (e) { /* offline */ } } };
    const ONCE = {
        ciot: () => { const f = $('#ciotIframe'); if (f && (!f.getAttribute('src') || f.getAttribute('src') === 'about:blank')) { f.src = CIOT_URL; const s = $('#ciotStatus'); if (s) s.textContent = '🗺️ Carregando Geolocalizador CIOT...'; } },
        yt: () => { try { carregarCanalNoPlayer(); } catch (e) { /* offline */ } },
    };
    function onShow(id, becameVisible) {
        if (EVERY_SHOW[id] && becameVisible) EVERY_SHOW[id]();
        if (ONCE[id] && !loaded[id]) ONCE[id]();
        loaded[id] = true;
        if (TOOLS[id].ferr && typeof Ferr !== 'undefined') Ferr.aoMostrar(id);
        if (id === 'space' && V.Space) V.Space.onShow();
        if (id === 'agenda' && V.AgendaTab) V.AgendaTab.onShow();
        if (id === 'news' && V.News) V.News.markSeen();
    }

    /* launcher (+) --------------------------------------------------------- */
    function closeLauncher() { if (launcherEl) { launcherEl.remove(); launcherEl = null; document.removeEventListener('mousedown', outsideLauncher, true); document.removeEventListener('keydown', escLauncher, true); } }
    const outsideLauncher = e => { if (launcherEl && !launcherEl.contains(e.target) && !e.target.closest('#wsAdd')) closeLauncher(); };
    const escLauncher = e => { if (e.key === 'Escape') closeLauncher(); };
    function openLauncher() {
        if (launcherEl) { closeLauncher(); return; }
        const hidden = Prefs.get('hidden') || [];
        const ids = TOOL_ORDER.filter(id => id !== 'chat' && (!hidden.includes(id) || isOpen(id)))
            .sort((a, b) => usageN(b) - usageN(a) || TOOL_ORDER.indexOf(a) - TOOL_ORDER.indexOf(b));
        launcherEl = el('div', 'launcher pop-card');
        launcherEl.innerHTML = `<div class="launcher-head"><span>Abrir em uma aba</span><span class="kbd">Ctrl K</span></div>
            <div class="launcher-grid">${ids.map(id => { const t = TOOLS[id]; return `<button class="launch-item" data-open="${id}" style="--tool-c:${t.color}"><span class="launch-ic">${icon(t.icon, 18)}</span><span class="launch-tx"><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></span>${isOpen(id) ? '<i class="launch-open" title="Já está aberta"></i>' : ''}</button>`; }).join('')}</div>
            <div class="launcher-foot"><button data-act="split">${icon('split', 14)}Dividir tela</button><button data-act="prefs">${icon('sliders', 14)}Personalizar</button></div>`;
        document.body.appendChild(launcherEl);
        const a = $('#wsAdd').getBoundingClientRect(), w = launcherEl.offsetWidth;
        launcherEl.style.top = Math.round(a.bottom + 8) + 'px';
        launcherEl.style.left = clamp(Math.round(a.left), 8, innerWidth - w - 8) + 'px';
        launcherEl.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.open) open(b.dataset.open, { beside: e.shiftKey || e.ctrlKey || e.metaKey });
            else if (b.dataset.act === 'split') toggleSplit();
            else if (b.dataset.act === 'prefs') V.Personalizar && V.Personalizar.open();
            closeLauncher();
        });
        setTimeout(() => { document.addEventListener('mousedown', outsideLauncher, true); document.addEventListener('keydown', escLauncher, true); }, 0);
    }

    /* menus de contexto ---------------------------------------------------- */
    function tabMenu(id, x, y) {
        const items = [];
        if (id !== 'chat') items.push({ label: splitOn() && st.right === id ? 'Tirar do lado' : 'Abrir ao lado do chat', icon: 'split', fn: () => (splitOn() && st.right === id ? (st.right = null, commit()) : open(id, { beside: true })) });
        else if (splitOn()) items.push({ label: 'Fechar a tela dividida', icon: 'split', fn: toggleSplit });
        if (id !== 'chat') items.push({ label: st.pinned.includes(id) ? 'Desafixar aba' : 'Fixar aba', icon: 'star', fn: () => pin(id) });
        if (id !== 'chat') items.push({ sep: true }, { label: 'Fechar aba', icon: 'x', fn: () => close(id) });
        if (st.tabs.some(t => t !== 'chat' && t !== id && !st.pinned.includes(t))) items.push({ label: 'Fechar as outras abas', icon: 'x', fn: () => closeOthers(id) });
        if (!items.length) return;
        Ctx.open(x, y, items);
    }
    function railMenu(id, x, y) {
        const items = [{ label: 'Abrir', icon: 'ext', fn: () => open(id) }];
        if (id !== 'chat') items.push({ label: 'Abrir ao lado', icon: 'split', fn: () => open(id, { beside: true }) },
            { sep: true }, { label: 'Ocultar este atalho da barra', icon: 'eye', fn: () => { Prefs.set({ hidden: [...(Prefs.get('hidden') || []), id] }); renderRail(); Toast.show(`Atalho "${TOOLS[id].short}" ocultado. Para trazer de volta: Ajustes › Ferramentas visíveis.`, { ms: 5200 }); } });
        Ctx.open(x, y, items);
    }

    /* eventos -------------------------------------------------------------- */
    function wire() {
        railEl.addEventListener('click', e => {
            const b = e.target.closest('.rail-btn'); if (!b) return;
            if (b.dataset.tool) open(b.dataset.tool, { beside: e.shiftKey || e.ctrlKey || e.metaKey });
            else if (b.dataset.act === 'sidebar') { try { toggleSidebar(); } catch (err) { /* sem sidebar */ } }
            else if (b.dataset.act === 'prefs') V.Personalizar && V.Personalizar.open();
        });
        railEl.addEventListener('contextmenu', e => { const b = e.target.closest('.rail-btn[data-tool]'); if (!b) return; e.preventDefault(); railMenu(b.dataset.tool, e.clientX, e.clientY); });
        tabsEl.addEventListener('click', e => {
            const t = e.target.closest('.tab'); if (!t) return;
            if (e.target.closest('.tab-x')) { close(t.dataset.id); return; }
            open(t.dataset.id, { beside: (e.shiftKey || e.ctrlKey || e.metaKey) && t.dataset.id !== 'chat' });
        });
        tabsEl.addEventListener('auxclick', e => { if (e.button !== 1) return; const t = e.target.closest('.tab'); if (t) { e.preventDefault(); close(t.dataset.id); } });
        tabsEl.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
        tabsEl.addEventListener('dblclick', e => { const t = e.target.closest('.tab'); if (t && t.dataset.id !== 'chat') pin(t.dataset.id); });
        tabsEl.addEventListener('contextmenu', e => { const t = e.target.closest('.tab'); if (!t) return; e.preventDefault(); tabMenu(t.dataset.id, e.clientX, e.clientY); });
        tabsEl.addEventListener('keydown', e => {   // teclado: Enter/Espaço abre, setas movem o foco, Delete fecha
            const t = e.target.closest('.tab'); if (!t || e.target.closest('.tab-x')) return;
            const id = t.dataset.id, ids = st.tabs, i = ids.indexOf(id), go = n => { const x = $(`.tab[data-id="${n}"]`, tabsEl); if (x) x.focus(); };
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(id, { beside: e.shiftKey && id !== 'chat' }); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); go(ids[(i + 1) % ids.length]); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); go(ids[(i - 1 + ids.length) % ids.length]); }
            else if (e.key === 'Home') { e.preventDefault(); go(ids[0]); }
            else if (e.key === 'End') { e.preventDefault(); go(ids[ids.length - 1]); }
            else if (e.key === 'Delete' && id !== 'chat') { e.preventDefault(); close(id); }
            else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = t.getBoundingClientRect(); tabMenu(id, r.left, r.bottom + 4); }
        });
        let lastBefore;
        tabsEl.addEventListener('dragstart', e => {
            const t = e.target.closest('.tab'); if (!t || t.dataset.id === 'chat') { e.preventDefault(); return; }
            dragId = t.dataset.id; lastBefore = undefined; t.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* ok */ }
        });
        tabsEl.addEventListener('dragover', e => {
            if (!dragId) return; e.preventDefault();
            const over = $$('.tab', tabsEl).filter(t => t.dataset.id !== dragId).find(t => { const r = t.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
            const before = over ? over.dataset.id : null;
            if (before === lastBefore) return; lastBefore = before;
            reorder(dragId, before); renderTabs();
        });
        tabsEl.addEventListener('dragend', () => { dragId = null; $$('.is-dragging', tabsEl).forEach(t => t.classList.remove('is-dragging')); persist(); renderTabs(); });
        $('#wsAdd').addEventListener('click', openLauncher);
        $('#wsSplit').addEventListener('click', toggleSplit);
        emptyEl.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) open(b.dataset.open, { beside: true }); });
        // divisor arrastável
        dividerEl.addEventListener('pointerdown', e => {
            e.preventDefault(); dividerEl.setPointerCapture(e.pointerId); dividerEl.classList.add('is-drag'); document.body.classList.add('ws-resizing');
            const move = ev => { const r = stage.getBoundingClientRect(); st.ratio = clamp((ev.clientX - r.left) / r.width, .25, .75); stage.style.setProperty('--split-left', (st.ratio * 100).toFixed(2) + '%'); };
            const up = () => { dividerEl.classList.remove('is-drag'); document.body.classList.remove('ws-resizing'); dividerEl.removeEventListener('pointermove', move); dividerEl.removeEventListener('pointerup', up); dividerEl.removeEventListener('pointercancel', up); persist(); };
            dividerEl.addEventListener('pointermove', move); dividerEl.addEventListener('pointerup', up); dividerEl.addEventListener('pointercancel', up);
        });
        dividerEl.addEventListener('dblclick', () => { st.ratio = .5; stage.style.setProperty('--split-left', '50%'); persist(); });
        new ResizeObserver(() => { positionIndicator(); const c = canSplit(); if (booted && c !== lastCan) render(); }).observe(stage);
        window.addEventListener('keydown', e => {
            const k = e.key, mod = e.ctrlKey || e.metaKey;
            if (mod && !e.shiftKey && !e.altKey && k.toLowerCase() === 'k') { e.preventDefault(); V.Palette && V.Palette.toggle(); return; }
            if (mod && !e.shiftKey && !e.altKey && k === '\\') { e.preventDefault(); toggleSplit(); return; }
            if (e.altKey && !mod && !e.shiftKey) {
                if (/^[1-9]$/.test(k)) { const id = st.tabs[+k - 1]; if (id) { e.preventDefault(); activate(id); } return; }
                if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); cycle(k === 'ArrowRight' ? 1 : -1); return; }
                if (k.toLowerCase() === 'w') { e.preventDefault(); close(st.active); }
            }
        }, true);
    }

    /* compatibilidade com o código antigo ---------------------------------- */
    function installLegacy() {
        Object.keys(LEGACY_FN).forEach(id => { window[LEGACY_FN[id]] = () => toggle(id); });   // ✕, atalhos Ctrl+Shift+X e botões antigos
        window.fecharTodosPaineis = () => open('chat');
        // até 1000px de largura a lista de conversas vira uma gaveta por cima do conteúdo (a lateral de atalhos já ocupa espaço)
        window.toggleSidebar = function () {
            const s = document.getElementById('sidebar'); if (!s) return;
            if (innerWidth <= 1000) { s.classList.remove('collapsed'); s.classList.toggle('open'); return; }
            const btn = document.querySelector('.btn-toggle-sidebar'), willCollapse = !s.classList.contains('collapsed');
            s.classList.toggle('collapsed'); if (btn) btn.style.display = willCollapse ? 'flex' : 'none';
        };
        wrap('selecionarConversa', function (orig, args) { const from = typeof conversaAtivaId !== 'undefined' ? conversaAtivaId : null; saveSideFor(from); const r = orig.apply(this, args); if (booted) { open('chat', { }); restoreSideFor(conversaAtivaId); } return r; });
        wrap('criarNovaConversa', function (orig, args) { if (booted) saveSideFor(conversaAtivaId); const r = orig.apply(this, args); if (booted) open('chat'); return r; });
        wrap('restaurarConversa', function (orig, args) { const r = orig.apply(this, args); if (booted && !isVisible('chat')) open('chat'); return r; });
        wrap('renderizarListaConversas', function (orig, args) { const r = orig.apply(this, args); refreshChatLabel(); return r; });
        // quem dispara uma pergunta de outra aba (ex.: botão 🤖 do Manual) enxerga a resposta ao lado dela
        wrap('handleChat', function (orig, args) { if (booted && !isVisible('chat')) showChat(); return orig.apply(this, args); });
    }

    /* início --------------------------------------------------------------- */
    function restore() {
        const w = Prefs.get('ws') || {}, mode = Prefs.get('startup') || 'restore', ok = id => TOOLS[id] && id !== 'chat';
        const pinned = (w.pinned || []).filter(ok);
        // as ferramentas (SEFAZ, Regras...) são telas de "trabalho de agora": só voltam ao abrir o sistema se estiverem fixadas
        const tabs = mode === 'restore' ? (w.tabs || []).filter(ok).filter(id => !TOOLS[id].ferr || pinned.includes(id)) : [];
        pinned.forEach(id => { if (!tabs.includes(id)) tabs.push(id); });
        st.tabs = ['chat', ...tabs]; st.pinned = pinned.filter(id => st.tabs.includes(id));
        st.ratio = clamp(Number(w.ratio) || .5, .25, .75); st.active = 'chat'; st.right = null;
        if (mode === 'restore') {
            if (w.active && st.tabs.includes(w.active)) st.active = w.active;
            if (w.right && st.tabs.includes(w.right) && w.right !== st.active) st.right = w.right;
        } else if (mode === 'space') { if (!st.tabs.includes('space')) st.tabs.push('space'); st.active = 'space'; } else if (mode === 'agenda') { if (!st.tabs.includes('agenda')) st.tabs.push('agenda'); st.active = 'agenda'; }
        sortTabs(); hist.length = 0; hist.push('chat'); if (st.active !== 'chat') hist.push(st.active);
    }
    function init() {
        build(); wire(); installLegacy(); restore(); render();
        if (Prefs.get('sidebar') === 'collapsed' && innerWidth > 1000) { try { toggleSidebar(); } catch (e) { /* ok */ } }
    }
    function ready() { booted = true; render(); }
    function markActivity(id) { if (!isVisible(id)) { activity[id] = true; renderTabs(); renderRail(); } }

    return {
        init, ready, open, close, toggle, activate, pin, closeOthers, toggleSplit, showChat, refreshChatLabel, markActivity, reloadFromPrefs,
        isOpen, isVisible, canSplit, renderRail, render, openLauncher,
        get state() { return { tabs: st.tabs.slice(), active: st.active, right: st.right, pinned: st.pinned.slice(), split: splitOn() }; },
        get stage() { return stage; },
    };
})();
V.Workspace = window.Workspace = Workspace;
