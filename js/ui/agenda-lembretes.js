/* js/ui/agenda-lembretes.js — Lembretes da agenda: quadro do dia ao abrir o sistema, avisos na hora da tarefa e bolinha na lateral.
   Os lembretes só aparecem com o sistema aberto (uma página da web não consegue avisar quando está fechada). Tudo local, sem rede. */
'use strict';
Agenda.Remind = (() => {
    const A = Agenda, E = () => MeuEspaco;
    const FIRED_KEY = 'bsoft_ag_fired', BOARD_KEY = 'bsoft_ag_board';
    let timer = 0, lastCheck = Date.now(), lastDay = A.today(), started = false, boardEl = null, alertsEl = null, titleBase = '', flashed = 0, audio = null;
    let fired = (() => { try { const o = JSON.parse(lsGet(FIRED_KEY, '{}')) || {}, lim = Date.now() - 7 * 864e5; Object.keys(o).forEach(k => { if (o[k] < lim) delete o[k]; }); return o; } catch (e) { return {}; } })();
    const saveFired = () => lsSet(FIRED_KEY, JSON.stringify(fired));
    const boardState = () => { try { return JSON.parse(lsGet(BOARD_KEY, '{}')) || {}; } catch (e) { return {}; } };
    const saveBoardState = patch => lsSet(BOARD_KEY, JSON.stringify(Object.assign(boardState(), patch)));
    const UI = () => A.UI;

    /* ── bolinha na lateral ───────────────────────────────────────────────── */
    function refreshBadge() { try { Workspace.renderRail(); if (V.Space && V.Space.built) V.Space.refreshBadge(); } catch (e) { /* ainda montando */ } }

    /* ── quadro do dia ────────────────────────────────────────────────────── */
    function boardWanted() {
        const mode = Prefs.get('agBoard') || 'sempre'; if (mode === 'nunca') return false;
        const st = boardState(), td = A.today();
        if (st.hideDay === td) return false;
        if (mode === 'diaria' && st.shownDay === td) return false;
        return true;
    }
    const grp = (cls, ic, title, n) => `<div class="ag-group${cls ? ' ' + cls : ''}">${ic ? icon(ic, 12) : ''}${title}<b>${n}</b></div>`;
    function boardBody(b) {
        const td = b.td, hoje = b.today, abertas = hoje.filter(o => !o.done);
        let h = '';
        if (b.overdue.length) h += grp('is-late', 'alert', 'Atrasadas', b.overdue.length) + b.overdue.map(o => UI().taskRow(o, { when: true })).join('');
        if (hoje.length) h += grp('', 'calendarcheck', 'Hoje', hoje.length) + hoje.map(o => UI().taskRow(o)).join('');
        if (!b.overdue.length && !abertas.length) h += `<div class="agb-ok">🎉 Tudo em dia por hoje. Bom trabalho!</div>`;
        if (b.soon.length) {
            const por = {}; b.soon.forEach(o => { (por[o.date] = por[o.date] || []).push(o); });
            h += `<div class="agb-soon"><b>Nos próximos dias:</b> ${Object.keys(por).sort().slice(0, 3).map(d => `${esc(A.cap(A.fmtRel(d)))} (${esc(A.fmtDM(d))}): ${por[d].length} ${por[d].length === 1 ? 'tarefa' : 'tarefas'}`).join(' · ')}</div>`;
        }
        return h;
    }
    function boardSub(b) {
        const abertas = b.today.filter(o => !o.done).length, parts = [];
        if (b.overdue.length) parts.push(`${b.overdue.length} atrasada${b.overdue.length > 1 ? 's' : ''}`);
        parts.push(abertas ? `${abertas} para hoje` : 'nada pendente hoje');
        return `${A.cap(A.fmtLong(b.td))} · ${parts.join(' · ')}`;
    }
    function closeBoard() {
        if (!boardEl) return;
        boardEl.remove(); boardEl = null; document.removeEventListener('keydown', boardKey, true);
    }
    function boardKey(e) { if (e.key === 'Escape' && boardEl && !Ctx.node) { e.preventDefault(); e.stopPropagation(); closeBoard(); } }
    function renderBoard() {
        if (!boardEl) return;
        const b = A.board(3), body = boardEl.querySelector('.agb-body'), sub = boardEl.querySelector('.agb-sub');
        if (!b.open && !b.today.length) { body.innerHTML = '<div class="agb-ok">🎉 Tudo em dia por hoje. Bom trabalho!</div>'; }
        else body.innerHTML = boardBody(b);
        sub.textContent = boardSub(b);
    }
    function showBoard(o = {}) {
        const b = A.board(3);
        if (!o.force && !b.open) return false;
        closeBoard();
        boardEl = el('div', 'ag-ov', 'agBoardOv');
        boardEl.innerHTML = `<div class="ag-board pop-card" role="dialog" aria-modal="true" aria-labelledby="agbT">
            <div class="agb-head"><span class="agb-ic">${icon('bellring', 24)}</span><div><h2 id="agbT">Seu dia — lembretes das tarefas</h2><p class="agb-sub">${esc(boardSub(b))}</p></div><button type="button" class="ag-x" data-b="close" aria-label="Fechar">${icon('x', 17)}</button></div>
            <div class="agb-body">${boardBody(b)}</div>
            <div class="agb-foot"><button type="button" class="ag-btn primary" data-b="open">${icon('calendar', 15)}Abrir a agenda</button><button type="button" class="ag-btn" data-b="chat">${icon('chat', 15)}Mostrar no chat</button><span class="ag-spacer"></span><button type="button" class="ag-btn" data-b="hide" title="Não abre o quadro de novo até amanhã">Não mostrar mais hoje</button><button type="button" class="ag-btn" data-b="close">Entendi</button></div></div>`;
        document.body.appendChild(boardEl);
        boardEl.addEventListener('mousedown', e => { if (e.target === boardEl) closeBoard(); });
        boardEl.addEventListener('click', onBoardClick);
        boardEl.addEventListener('change', e => { const t = e.target; if (t.matches && t.matches('.ag-ck')) { const row = t.closest('.ag-task'); A.setDone(row.dataset.id, row.dataset.d, t.checked); } });
        document.addEventListener('keydown', boardKey, true);
        saveBoardState({ shownDay: A.today() });
        setTimeout(() => { const p = boardEl && boardEl.querySelector('[data-b="open"]'); if (p) p.focus({ preventScroll: true }); }, 60);
        return true;
    }
    function onBoardClick(e) {
        const bb = e.target.closest('[data-b]');
        if (bb) {
            const a = bb.dataset.b;
            if (a === 'close') closeBoard();
            else if (a === 'open') { closeBoard(); Agenda.abrir({ date: A.today(), view: 'cal' }); }
            else if (a === 'chat') { closeBoard(); if (V.AgendaChat) V.AgendaChat.mostrarHoje(); }
            else if (a === 'hide') { saveBoardState({ hideDay: A.today() }); closeBoard(); Toast.show('Certo. O quadro volta a aparecer amanhã.', { icon: 'bellring', ms: 3600 }); }
            return;
        }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const row = b.closest('.ag-task'), id = row && row.dataset.id, d = row && row.dataset.d;
        if (!id) return;
        if (b.dataset.a === 'edit') { closeBoard(); Agenda.abrir({ date: d || A.today(), edit: id }); }
        else if (b.dataset.a === 'del') { const t = E().taskById(id); if (t) { E().removeTask(id); Toast.show(`Tarefa “${t.title.slice(0, 40)}” excluída.`, { icon: 'trash', ms: 6000, action: { label: 'Desfazer', fn: () => E().restoreTask(id) } }); } }
        else if (b.dataset.a === 'snooze') {
            const t = E().taskById(id); if (!t) return; const r = b.getBoundingClientRect(), items = [];
            if (t.time) items.push({ label: 'Daqui a 15 minutos', icon: 'clock', fn: () => A.snooze(id, '15m') }, { label: 'Daqui a 1 hora', icon: 'clock', fn: () => A.snooze(id, '1h') });
            items.push({ label: 'Para amanhã', icon: 'calendar', fn: () => A.snooze(id, 'tomorrow') });
            Ctx.open(r.left - 120, r.bottom + 6, items);
        }
    }

    /* ── avisos na hora da tarefa ─────────────────────────────────────────── */
    function alertsHost() {
        if (alertsEl && alertsEl.isConnected) return alertsEl;
        alertsEl = el('div', 'ag-alerts', 'agAlerts'); alertsEl.setAttribute('aria-live', 'assertive');
        document.body.appendChild(alertsEl); alertsEl.addEventListener('click', onAlertClick);
        return alertsEl;
    }
    function dismissAlert(n) { if (!n || !n.isConnected) return; n.classList.add('out'); setTimeout(() => n.remove(), 260); }
    function alertWhen(r) {
        const min = Math.round((r.due - Date.now()) / 60000), o = r.occ;
        if (min > 1) return `${o.date === A.today() ? '' : A.cap(A.fmtRel(o.date)) + ' · '}${min >= 60 ? 'em ' + Math.round(min / 60) + ' h' : 'em ' + min + ' min'}${o.time ? ' (' + A.fmtTempo(o.time) + ')' : ''}`;
        return o.time ? `Agora · ${A.fmtTempo(o.time)}` : 'Para hoje';
    }
    function showAlert(r) {
        const o = r.occ, t = o.task, host = alertsHost();
        const n = el('div', 'ag-alert pop-card'); n.dataset.key = r.key; n.dataset.id = t.id; n.dataset.d = o.date; n.style.setProperty('--pc', A.label.prioColor(t.prio));
        const canSnooze = !o.rec;
        n.innerHTML = `<div class="ag-alert-top"><span class="ag-alert-ic">${icon('bellring', 16)}</span><div style="min-width:0"><b>${esc(t.title)}</b><small>${esc(alertWhen(r))}${(t.owner || '').trim() ? ' · ' + esc(t.owner) : ''}</small></div><button type="button" class="ag-x" data-q="x" aria-label="Dispensar">${icon('x', 14)}</button></div>
            <div class="ag-alert-bt"><button type="button" class="ag-tbtn" data-q="done">${icon('check', 12, 2.6)}Concluir</button>${canSnooze ? `<button type="button" class="ag-tbtn" data-q="${t.time ? '15m' : 'tomorrow'}">${icon('clock', 12)}${t.time ? 'Adiar 15 min' : 'Para amanhã'}</button>` : ''}<button type="button" class="ag-tbtn" data-q="open">${icon('calendar', 12)}Abrir</button></div>`;
        host.appendChild(n);
        while (host.children.length > 3) dismissAlert(host.firstChild);
    }
    function showSummary(list) {
        const host = alertsHost(), n = el('div', 'ag-alert pop-card');
        n.innerHTML = `<div class="ag-alert-top"><span class="ag-alert-ic">${icon('bellring', 16)}</span><div style="min-width:0"><b>${list.length} lembretes de tarefas</b><small>${esc(list.slice(0, 3).map(r => r.occ.task.title).join(' · '))}${list.length > 3 ? '…' : ''}</small></div><button type="button" class="ag-x" data-q="x" aria-label="Dispensar">${icon('x', 14)}</button></div>
            <div class="ag-alert-bt"><button type="button" class="ag-tbtn" data-q="board">${icon('calendar', 12)}Ver o quadro do dia</button></div>`;
        host.appendChild(n);
        while (host.children.length > 3) dismissAlert(host.firstChild);
    }
    function onAlertClick(e) {
        const b = e.target.closest('[data-q]'); if (!b) return;
        const n = b.closest('.ag-alert'), q = b.dataset.q, id = n.dataset.id, d = n.dataset.d;
        if (q === 'x') dismissAlert(n);
        else if (q === 'done') { A.setDone(id, d, true); dismissAlert(n); Toast.show('Tarefa concluída ✓', { kind: 'ok', ms: 2600 }); }
        else if (q === '15m' || q === 'tomorrow') { const t = A.snooze(id, q); dismissAlert(n); if (t) Toast.show(`Adiada para ${A.fmtCurto(t.date)}${t.time ? ' às ' + A.fmtTempo(t.time) : ''}.`, { icon: 'clock', ms: 3200 }); }
        else if (q === 'open') { dismissAlert(n); Agenda.abrir({ date: d, edit: id }); }
        else if (q === 'board') { dismissAlert(n); showBoard({ force: true }); }
    }
    function beep() {
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            [[880, 0], [1175, .16]].forEach(([f, t0]) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, audio.currentTime + t0); g.gain.exponentialRampToValueAtTime(.18, audio.currentTime + t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + t0 + .24); o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + t0); o.stop(audio.currentTime + t0 + .26); });
        } catch (e) { /* sem áudio */ }
    }
    function notifyOutside(list) {
        if (!Prefs.get('agNotify') || !('Notification' in window) || Notification.permission !== 'granted') return;
        if (!document.hidden && document.hasFocus()) return;   // com o sistema à frente, o aviso da própria tela basta
        list.slice(0, 3).forEach(r => { try { const x = new Notification('⏰ ' + r.occ.task.title, { body: alertWhen(r), tag: 'bsoft-ag-' + r.key }); x.onclick = () => { try { window.focus(); } catch (e) { /* ok */ } x.close(); }; } catch (e) { /* sem permissão */ } });
    }
    function flashTitle(n) {
        if (!document.hidden) return;
        if (!titleBase) titleBase = document.title.replace(/^⏰ \(\d+\) /, '');
        flashed += n; document.title = `⏰ (${flashed}) ${titleBase}`;
    }
    function restoreTitle() { if (titleBase) { document.title = titleBase; titleBase = ''; flashed = 0; } }

    /* ── relógio dos lembretes ────────────────────────────────────────────── */
    function tick() {
        const now = Date.now(), td = A.today();
        if (td !== lastDay) { lastDay = td; refreshBadge(); if (UI() && UI().mounted) UI().refresh(); }
        const from = Math.max(lastCheck, now - 6 * 3600e3);
        lastCheck = now;
        if (Prefs.get('agToast') === false) return;
        const due = A.reminders(from, now).filter(r => !fired[r.key]);
        if (!due.length) return;
        due.forEach(r => { fired[r.key] = now; }); saveFired();
        if (due.length > 3) showSummary(due); else due.forEach(showAlert);
        notifyOutside(due); if (Prefs.get('agSound')) beep(); flashTitle(due.length);
        refreshBadge();
    }
    function onData() { refreshBadge(); if (boardEl) renderBoard(); }
    function start() {
        if (started) return; started = true;
        lastCheck = Date.now(); lastDay = A.today();
        timer = setInterval(tick, 15000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) { restoreTitle(); tick(); } });
        window.addEventListener('focus', () => { restoreTitle(); tick(); });
        E().on(t => { if (t === 'data') onData(); });
        refreshBadge();
        setTimeout(() => { try { if (boardWanted()) showBoard(); } catch (e) { console.warn('[agenda] quadro', e); } }, 900);
    }
    /* pede (ou confirma) a permissão para notificações do navegador; devolve true se estiver liberada */
    async function allowNotifications() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        try { return (await Notification.requestPermission()) === 'granted'; } catch (e) { return false; }
    }
    return { start, showBoard, closeBoard, refreshBadge, tick, allowNotifications, beep, get boardOpen() { return !!boardEl; } };
})();
