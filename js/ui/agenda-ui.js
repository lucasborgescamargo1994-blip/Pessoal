/* js/ui/agenda-ui.js — Agenda dentro do Meu Espaço: calendário, lista, cronograma e editor de tarefas.
   Tudo local: os dados vêm de MeuEspaco (pasta do usuário). Nenhum texto de tarefa é enviado para a rede, para o banco da empresa ou para a IA. */
'use strict';
Agenda.UI = (() => {
    const A = Agenda, E = () => MeuEspaco;
    const S = { view: 'cal', sel: A.today(), month: A.monthStart(A.today()), owner: '', q: '', done: true, days: 28, gstart: '', quick: '', listMax: 60 };
    let host = null, built = false, modal = null, lastFocus = null, barSig = '';

    const visible = () => built && host && host.isConnected && host.offsetParent !== null;
    const filters = () => ({ owner: S.owner || undefined, q: S.q || undefined, status: S.done ? undefined : 'open' });
    const capFirst = A.cap;
    const colorOf = o => (o.done ? '#a8a29e' : o.overdue ? '#dc2626' : o.task.status === 'doing' ? '#2563eb' : A.label.prioColor(o.task.prio));
    const inicial = s => (String(s || '?').trim().charAt(0) || '?').toUpperCase();

    /* ── montagem ─────────────────────────────────────────────────────────── */
    function mount(container) {
        if (built || !container) return;
        host = container; built = true;
        S.view = ['cal', 'list', 'crono'].includes(Prefs.get('agView')) ? Prefs.get('agView') : 'cal';
        S.days = [14, 28, 56].includes(Prefs.get('agCrono')) ? Prefs.get('agCrono') : 28;
        host.innerHTML = '<div class="ag-bar" id="agBar"></div><div class="ag-main" id="agMain"></div>';
        host.addEventListener('click', onClick);
        host.addEventListener('change', onChange);
        host.addEventListener('input', onInput);
        host.addEventListener('keydown', onKey);
        host.addEventListener('submit', onSubmit);
        E().on(type => { if ((type === 'data' || type === 'status') && visible()) refresh(); });
        render();
    }
    function refresh() { if (visible()) { renderBar(); renderMain(); } }
    function render() { if (!built) return; renderBar(true); renderMain(); }

    /* ── barra superior ───────────────────────────────────────────────────── */
    function titleText() {
        if (S.view === 'cal') return capFirst(A.mesAno(S.month));
        if (S.view === 'crono') { const a = S.gstart || A.startOfWeek(A.today()); return `${A.fmtDM(a)} a ${A.fmtDM(A.add(a, S.days - 1))}`; }
        return 'Próximas tarefas';
    }
    function renderBar(force) {
        const owners = A.owners(), has = A.tasks().some(t => !(t.owner || '').trim());
        const sig = [S.view, titleText(), S.owner, S.done, S.days, owners.join('|'), has].join('~');
        if (!force && sig === barSig) return;
        barSig = sig;
        const v = (id, ic, label) => `<button type="button" role="tab" aria-selected="${S.view === id}" class="${S.view === id ? 'is-on' : ''}" data-a="view" data-v="${id}">${icon(ic, 14)}<span>${label}</span></button>`;
        const nav = S.view !== 'list' ? `<div class="ag-nav"><button class="ag-ib" type="button" data-a="prev" aria-label="Anterior" title="Anterior">${icon('chevl', 16)}</button><button class="ag-today-btn" type="button" data-a="today">Hoje</button><button class="ag-ib" type="button" data-a="next" aria-label="Próximo" title="Próximo">${icon('chevr', 16)}</button></div><h3 class="ag-title" aria-live="polite">${esc(titleText())}</h3>` : `<h3 class="ag-title">${esc(titleText())}</h3>`;
        const zoom = S.view === 'crono' ? `<div class="ag-zoom" role="group" aria-label="Período do cronograma">${[[14, '2 sem.'], [28, '4 sem.'], [56, '8 sem.']].map(([n, l]) => `<button type="button" data-a="zoom" data-n="${n}" class="${S.days === n ? 'is-on' : ''}">${l}</button>`).join('')}</div>` : '';
        const ownerOpts = `<option value="">Todos os responsáveis</option>${has ? `<option value="__none"${S.owner === '__none' ? ' selected' : ''}>Sem responsável</option>` : ''}${owners.map(o => `<option value="${esc(o)}"${S.owner === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}`;
        $('#agBar', host).innerHTML = `<div class="ag-views" role="tablist" aria-label="Forma de ver a agenda">${v('cal', 'calendar', 'Calendário')}${v('list', 'todo', 'Lista')}${v('crono', 'gantt', 'Cronograma')}</div>
            ${nav}${zoom}<span class="ag-spacer"></span>
            <label class="ag-filter" title="Filtrar por responsável">${icon('user', 14)}<select id="agOwner" aria-label="Filtrar por responsável">${ownerOpts}</select></label>
            <label class="ag-filter" title="Buscar nas tarefas">${icon('search', 14)}<input id="agQ" type="search" placeholder="Buscar tarefa…" value="${esc(S.q)}" autocomplete="off" spellcheck="false" aria-label="Buscar tarefa"></label>
            <label class="ag-filter" title="Mostrar também as tarefas já concluídas"><span><input id="agDone" type="checkbox"${S.done ? ' checked' : ''}> concluídas</span></label>
            <button class="ag-new" type="button" data-a="new">${icon('plus', 16, 2.4)}<span>Nova tarefa</span></button>`;
    }

    /* ── área principal ───────────────────────────────────────────────────── */
    function renderMain() {
        const main = $('#agMain', host); if (!main) return;
        const keep = main.querySelector('#agQuick'), had = keep && document.activeElement === keep, pos = keep ? keep.selectionStart : 0;
        const gscroll = main.querySelector('.ag-gwrap'), gl = gscroll ? gscroll.scrollLeft : null, gt = gscroll ? gscroll.scrollTop : 0;
        const dscroll = main.querySelector('.ag-day-list'), dt = dscroll ? dscroll.scrollTop : 0;
        const lscroll = main.querySelector('.ag-listv'), lt = lscroll ? lscroll.scrollTop : 0, cscroll = main.querySelector('.ag-cal'), ct = cscroll ? cscroll.scrollTop : 0, mt = main.scrollTop;   // não "pular" para o topo a cada alteração
        if (S.view === 'cal') {
            main.classList.remove('is-wide');
            main.innerHTML = `<section class="ag-card ag-cal" aria-label="Calendário">${calHtml()}</section><aside class="ag-card ag-side" aria-label="Tarefas do dia">${dayHtml()}</aside>`;
            const q = main.querySelector('#agQuick'); if (q) { q.value = S.quick; if (had) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) { /* ok */ } } }
            const dl = main.querySelector('.ag-day-list'); if (dl) dl.scrollTop = dt;
            const cl = main.querySelector('.ag-cal'); if (cl) cl.scrollTop = ct;
        } else if (S.view === 'list') {
            main.classList.add('is-wide');
            main.innerHTML = `<section class="ag-card" aria-label="Lista de tarefas"><div class="ag-listv">${listHtml()}</div></section>`;
            const lv = main.querySelector('.ag-listv'); if (lv) lv.scrollTop = lt;
        } else {
            main.classList.add('is-wide');
            main.innerHTML = `<section class="ag-card" aria-label="Cronograma">${ganttHtml()}</section>`;
            const gw = main.querySelector('.ag-gwrap');
            if (gw) { if (gl != null) { gw.scrollLeft = gl; gw.scrollTop = gt; } }
        }
        main.scrollTop = mt;
    }

    /* — calendário — */
    function chipHtml(o) {
        const t = o.task, c = colorOf(o);
        return `<button type="button" class="ag-chip${o.done ? ' is-done' : ''}${o.multi && !o.first ? ' is-cont' : ''}" data-a="chip" data-id="${esc(t.id)}" data-d="${o.date}" tabindex="-1" style="--c:${c}" title="${esc((o.time ? o.time + ' · ' : '') + t.title)}">${o.time ? esc(A.fmtTempo(o.time)) + ' ' : ''}${esc(t.title)}</button>`;
    }
    function calHtml() {
        const first = A.startOfWeek(S.month), td = A.today(), m = S.month.slice(0, 7), ws = A.weekStart();
        const occs = A.between(first, A.add(first, 41), filters()), by = {};
        occs.forEach(o => { (by[o.date] = by[o.date] || []).push(o); });
        const head = Array.from({ length: 7 }, (_, i) => `<span role="columnheader">${A.DOW_S[(ws + i) % 7]}</span>`).join('');
        let rows = '';
        for (let r = 0; r < 6; r++) {
            let cells = '';
            for (let c = 0; c < 7; c++) {
                const d = A.add(first, r * 7 + c), list = by[d] || [], dw = A.dow(d), pd = A.parse(d);
                const cls = ['ag-cell', d.slice(0, 7) !== m ? 'is-out' : '', dw === 0 || dw === 6 ? 'is-we' : '', d === td ? 'is-today' : '', d === S.sel ? 'is-sel' : ''].filter(Boolean).join(' ');
                const open = list.filter(o => !o.done).length, label = `${A.fmtLong(d)}${d === td ? ' (hoje)' : ''}: ${list.length ? `${list.length} ${list.length === 1 ? 'tarefa' : 'tarefas'}${open !== list.length ? `, ${open} em aberto` : ''}` : 'sem tarefas'}`;
                cells += `<div class="${cls}" role="gridcell" data-a="pick" data-d="${d}" tabindex="${d === S.sel ? 0 : -1}" aria-selected="${d === S.sel}"${d === td ? ' aria-current="date"' : ''} aria-label="${esc(label)}"><span class="ag-n">${pd.getDate()}</span><div class="ag-chips">${list.slice(0, 3).map(chipHtml).join('')}${list.length > 3 ? `<span class="ag-more">+${list.length - 3} mais</span>` : ''}</div></div>`;
            }
            rows += `<div role="row" style="display:contents">${cells}</div>`;
        }
        return `<div class="ag-dow" role="row">${head}</div><div class="ag-grid" role="grid" aria-label="${esc(capFirst(A.mesAno(S.month)))}">${rows}</div>`;
    }

    /* — linha de tarefa (usada no painel do dia, na lista, no quadro e no chat) — */
    function taskRow(o, opt = {}) {
        const t = o.task, bits = [];
        if (opt.when) bits.push(`<span class="ag-pill ag-when">${esc(A.fmtCurto(o.date))}${o.date === A.today() ? ' · hoje' : ''}</span>`);
        if (o.time) bits.push(`<span class="ag-pill t">${icon('clock', 11)}${esc(A.fmtTempo(o.time))}</span>`);
        if (o.overdue) bits.push(`<span class="ag-pill late">${icon('alert', 11)}atrasada${o.date < A.today() ? ' · ' + esc(A.fmtRel(o.date)) : ''}</span>`);
        if (o.multi) bits.push(`<span class="ag-pill">${icon('gantt', 11)}${esc(A.fmtDM(t.date))} → ${esc(A.fmtDM(t.end))}</span>`);
        if (o.rec) bits.push(`<span class="ag-pill" title="${esc(A.label.repeat(t.repeat))}">${icon('repeat', 11)}${esc(A.label.repeat(t.repeat))}</span>`);
        if ((t.owner || '').trim()) bits.push(`<span class="ag-pill own" title="Responsável">${icon('user', 11)}${esc(t.owner)}</span>`);
        if (t.prio === 'high' && !o.done) bits.push(`<span class="ag-pill prio-high">${icon('flag', 11)}alta</span>`);
        if (t.status === 'doing' && !o.done) bits.push(`<span class="ag-pill">em andamento</span>`);
        (t.tags || []).slice(0, 3).forEach(g => bits.push(`<span class="ag-pill">#${esc(g)}</span>`));
        const acts = opt.compact ? '' : `<div class="ag-tacts">
            ${!o.rec && !o.done ? `<button type="button" class="ag-ia" data-a="snooze" title="Adiar" aria-label="Adiar a tarefa ${esc(t.title)}">${icon('clock', 15)}</button>` : ''}
            <button type="button" class="ag-ia" data-a="edit" title="Editar" aria-label="Editar a tarefa ${esc(t.title)}">${icon('edit', 15)}</button>
            <button type="button" class="ag-ia danger" data-a="del" title="Excluir" aria-label="Excluir a tarefa ${esc(t.title)}">${icon('trash', 15)}</button></div>`;
        return `<div class="ag-task${o.done ? ' is-done' : ''}${o.overdue ? ' is-late' : ''}" data-id="${esc(t.id)}" data-d="${o.date}" style="--pc:${A.label.prioColor(t.prio)}">
            <input type="checkbox" class="ag-ck" data-a="ck"${o.done ? ' checked' : ''} aria-label="Concluir: ${esc(t.title)}">
            <button type="button" class="ag-tmain" data-a="edit"><span class="ag-tt">${esc(t.title)}</span>${bits.length ? `<span class="ag-tmeta">${bits.join('')}</span>` : ''}</button>${acts}</div>`;
    }

    /* — painel do dia — */
    function dayHtml() {
        const d = S.sel, td = A.today(), list = A.forDay(d, filters()), od = d === td ? A.overdue(filters()) : [];
        const abertas = list.filter(o => !o.done).length, rel = A.fmtRel(d);
        const sub = list.length ? `${list.length} ${list.length === 1 ? 'tarefa' : 'tarefas'}${list.length - abertas ? ` · ${list.length - abertas} concluída${list.length - abertas > 1 ? 's' : ''}` : ''}` : 'Nenhuma tarefa neste dia';
        const relCls = d < td ? ' is-late' : '';
        const lateBlock = od.length ? `<div class="ag-group is-late">${icon('alert', 12)}Atrasadas<b>${od.length}</b></div>${od.map(o => taskRow(o, { when: true })).join('')}` : '';
        const dayBlock = list.length ? list.map(o => taskRow(o)).join('') : `<div class="ag-empty"><b>Dia livre ✨</b>Nada marcado para ${esc(A.fmtDM(d))}. Use o campo acima para anotar algo rapidinho.</div>`;
        return `<div class="ag-dayhead"><div><h3>${esc(capFirst(A.fmtLong(d)))}${rel === 'hoje' || rel === 'amanhã' || rel === 'ontem' ? `<span class="ag-rel${relCls}">${rel}</span>` : ''}</h3><p>${esc(sub)}</p></div></div>
            <form class="ag-quick" data-a="quickform" autocomplete="off"><input id="agQuick" type="text" maxlength="260" placeholder="Nova tarefa… ex.: ligar p/ cliente 14h @João !alta" aria-label="Nova tarefa neste dia" title="Escreva a tarefa e, se quiser, o horário (14h), o responsável (@João) e a prioridade (!alta). Eu separo tudo."><button type="submit" aria-label="Adicionar tarefa" title="Adicionar">${icon('plus', 17, 2.6)}</button></form>
            <div class="ag-day-list">${lateBlock}${lateBlock ? `<div class="ag-group">${esc(capFirst(A.fmtCurto(d)))}<b>${list.length}</b></div>` : ''}${dayBlock}</div>
            <div class="ag-day-foot"><button type="button" class="ag-sbtn" data-a="tochat" title="Mostrar as tarefas deste dia no chat (só você vê — nada é enviado à IA)">${icon('chat', 14)}Mostrar no chat</button><button type="button" class="ag-sbtn" data-a="new" data-d="${d}" title="Abrir o formulário completo (término, responsável, lembrete, repetição…)">${icon('plus', 14, 2.4)}Tarefa detalhada…</button></div>`;
    }

    /* — lista — */
    function listHtml() {
        const f = filters(), td = A.today(), fo = Object.assign({}, f, { status: 'open' });
        // tarefas com período e as que se repetem aparecem UMA vez na lista (na próxima ocorrência); no calendário e no dia aparecem todo dia
        const vistos = new Set();
        const od = A.overdue(f), nd = A.noDate(f), up = A.between(td, A.add(td, 120), fo).filter(o => { if (!(o.rec || o.multi)) return true; if (vistos.has(o.id)) return false; vistos.add(o.id); return true; });
        const done = S.done ? A.between(A.add(td, -30), td, { owner: f.owner, q: f.q, status: 'done' }).reverse().slice(0, 15) : [];
        let out = '', n = 0, cut = false;
        const push = html => { out += html; };
        if (od.length) push(`<div class="ag-group is-late">${icon('alert', 12)}Atrasadas<b>${od.length}</b></div>${od.map(o => taskRow(o, { when: true })).join('')}`);
        const byDate = {}; up.forEach(o => { (byDate[o.date] = byDate[o.date] || []).push(o); });
        for (const d of Object.keys(byDate).sort()) {
            if (n >= S.listMax) { cut = true; break; }
            const l = byDate[d]; n += l.length;
            push(`<div class="ag-group">${esc(capFirst(A.fmtLong(d)))}<b>${l.length}</b><span style="font-weight:700;text-transform:none;letter-spacing:0">${esc(A.fmtRel(d))}</span></div>${l.map(o => taskRow(o)).join('')}`);
        }
        if (cut) push(`<button type="button" class="ag-sbtn ag-more-btn" data-a="more">Mostrar mais tarefas</button>`);
        if (nd.length) push(`<div class="ag-group">Sem data<b>${nd.length}</b></div>${nd.map(t => taskRow({ task: t, id: t.id, date: '', time: '', done: false, rec: false, overdue: false, multi: false })).join('')}`);
        if (done.length) push(`<div class="ag-group">Concluídas recentemente<b>${done.length}</b></div>${done.map(o => taskRow(o, { when: true })).join('')}`);
        return out || `<div class="ag-empty"><b>Nenhuma tarefa por aqui</b>${S.q || S.owner ? 'Nada combina com o filtro escolhido.' : 'Crie a primeira tarefa em “Nova tarefa”, ou escreva direto no calendário.'}</div>`;
    }

    /* — cronograma — */
    function ganttHtml() {
        const n = S.days, td = A.today(), start = S.gstart || A.startOfWeek(td), end = A.add(start, n - 1), f = filters();
        const occ = A.between(start, end, f), byTask = new Map();
        occ.forEach(o => { let g = byTask.get(o.id); if (!g) byTask.set(o.id, g = { task: o.task, items: [] }); g.items.push(o); });
        const groups = {};
        byTask.forEach(g => { const k = (g.task.owner || '').trim() || '__none'; (groups[k] = groups[k] || []).push(g); });
        const keys = Object.keys(groups).sort((a, b) => (a === '__none') - (b === '__none') || groups[b].length - groups[a].length || a.localeCompare(b, 'pt-BR'));
        const days = Array.from({ length: n }, (_, i) => A.add(start, i));
        const cols = days.map(d => `<i class="${[A.dow(d) === 0 || A.dow(d) === 6 ? 'we' : '', d === td ? 'td' : ''].filter(Boolean).join(' ')}"></i>`).join('');
        let months = '', i = 0;
        while (i < n) { const m = days[i].slice(0, 7); let j = i; while (j < n && days[j].slice(0, 7) === m) j++; months += `<div class="agg-m" style="grid-column:${2 + i} / span ${j - i};grid-row:1">${esc(A.MES[+m.slice(5) - 1].slice(0, 3))} ${m.slice(0, 4)}</div>`; i = j; }
        const head = `<div class="agg-head"><div class="agg-corner" style="grid-row:1 / 3">Tarefa</div>${months}${days.map((d, k) => { const dw = A.dow(d), we = dw === 0 || dw === 6; return `<div class="agg-d${we ? ' we' : ''}${d === td ? ' td' : ''}" style="grid-column:${2 + k};grid-row:2">${d === td ? `<b>${+d.slice(8)}</b>` : +d.slice(8)}<small>${A.DOW_S[dw].slice(0, 3)}</small></div>`; }).join('')}</div>`;
        let body = '';
        for (const k of keys) {
            const list = groups[k].sort((a, b) => (a.items[0].date < b.items[0].date ? -1 : 1));
            const nome = k === '__none' ? 'Sem responsável' : k;
            body += `<div class="agg-grp"><div class="agg-gh"><span class="ag-av"${k === '__none' ? ' style="background:#a8a29e"' : ''}>${k === '__none' ? icon('user', 12) : esc(inicial(nome))}</span>${esc(nome)}<b>${list.length}</b></div></div>`;
            list.forEach(g => {
                const t = g.task, first = g.items[0], c = colorOf(first), allDone = g.items.every(o => o.done);
                let marks = '';
                if (first.rec) g.items.forEach(o => { marks += `<button type="button" class="agg-pt${o.done ? ' is-done' : ''}" style="grid-column:${2 + A.diff(start, o.date)};grid-row:1;--c:${colorOf(o)}" data-a="gbar" data-id="${esc(t.id)}" data-d="${o.date}" title="${esc(t.title)} · ${esc(A.fmtCurto(o.date))}" aria-label="${esc(t.title)} em ${esc(A.fmtCurto(o.date))}"></button>`; });
                else {
                    const a = g.items[0].date, b = g.items[g.items.length - 1].date, s = A.diff(start, a), e = A.diff(start, b);
                    const cutL = t.date < start, cutR = (t.end || t.date) > end, tip = `${t.title} · ${A.fmtDM(t.date)}${t.end ? ' → ' + A.fmtDM(t.end) : ''}${t.time ? ' às ' + t.time : ''}`;
                    if (!t.end && !cutL && !cutR) marks = `<button type="button" class="agg-pt${first.done ? ' is-done' : ''}" style="grid-column:${2 + s};grid-row:1;--c:${c}" data-a="gbar" data-id="${esc(t.id)}" data-d="${a}" title="${esc(tip)}" aria-label="${esc(tip)}"></button>`;
                    else marks = `<button type="button" class="agg-bar${first.done ? ' is-done' : ''}${cutL ? ' cut-l' : ''}${cutR ? ' cut-r' : ''}" style="grid-column:${2 + s} / ${2 + e + 1};grid-row:1;--c:${c}" data-a="gbar" data-id="${esc(t.id)}" data-d="${a}" title="${esc(tip)}">${cutL ? '◂ ' : ''}${e - s >= 2 ? esc(t.title) : ''}${cutR ? ' ▸' : ''}</button>`;
                }
                body += `<div class="agg-row"><button type="button" class="agg-lab${allDone ? ' is-done' : ''}" style="--pc:${A.label.prioColor(t.prio)}" data-a="gbar" data-id="${esc(t.id)}" data-d="${first.date}" title="${esc(t.title)}"><i class="agg-dot"></i><span>${esc(t.title)}</span></button>${marks}</div>`;
            });
        }
        if (!keys.length) body = `<div class="ag-empty" style="grid-column:1/-1;padding:50px 12px"><b>Nada neste período</b>${S.q || S.owner ? 'Nada combina com o filtro escolhido.' : 'Crie tarefas com início e término para vê-las como barras no cronograma.'}</div>`;
        const legend = `<div class="agg-legend"><span style="--c:#10b981"><i></i>Prioridade baixa</span><span style="--c:#f59e0b"><i></i>Média</span><span style="--c:#ef4444"><i></i>Alta</span><span style="--c:#2563eb"><i></i>Em andamento</span><span style="--c:#dc2626"><i></i>Atrasada</span><span style="--c:#a8a29e"><i></i>Concluída</span><span>◆ tarefa de um dia ou repetida</span></div>`;
        return `<div class="ag-gwrap"><div class="agg" style="--n:${n}"><div class="agg-cols">${'<span></span>'}${cols}</div>${head}${body}</div></div>${legend}`;
    }

    /* ── ações da tela ────────────────────────────────────────────────────── */
    function go(date) { S.sel = date; S.month = A.monthStart(date); }
    function select(d, focus) {
        go(d); renderBar(); renderMain();
        if (focus) { const c = $(`.ag-cell[data-d="${d}"]`, host); if (c) c.focus(); }
    }
    function setView(v) {
        if (!['cal', 'list', 'crono'].includes(v)) return;
        S.view = v; Prefs.set({ agView: v }, { quiet: true }); if (v === 'crono') S.gstart = ''; render();
    }
    function quickAdd(text) {
        const r = A.parseQuick(text, { base: S.sel });
        if (!r.title) return false;
        const date = r.date || (S.view === 'cal' ? S.sel : A.today());
        S.quick = ''; go(date);   // antes de gravar: a gravação já redesenha a tela
        const t = E().createTask({ title: r.title, date, time: r.time, owner: r.owner || (S.owner && S.owner !== '__none' ? S.owner : ''), prio: r.prio || 'med', tags: r.tags, remind: 0 });
        Toast.show(`Tarefa criada para ${A.fmtCurto(t.date)}${t.time ? ' às ' + A.fmtTempo(t.time) : ''}.`, { kind: 'ok', icon: 'calendarcheck', ms: 5200, action: { label: 'Desfazer', fn: () => { E().removeTask(t.id); } } });
        return true;
    }
    function snoozeMenu(btn, id, d) {
        const t = E().taskById(id); if (!t) return;
        const r = btn.getBoundingClientRect(), items = [];
        if (t.time) items.push({ label: 'Daqui a 15 minutos', icon: 'clock', fn: () => doSnooze(id, '15m') }, { label: 'Daqui a 1 hora', icon: 'clock', fn: () => doSnooze(id, '1h') });
        items.push({ label: 'Para amanhã', icon: 'calendar', fn: () => doSnooze(id, 'tomorrow') });
        Ctx.open(r.left - 120, r.bottom + 6, items);
    }
    function doSnooze(id, how) {
        const t = A.snooze(id, how); if (!t) return;
        Toast.show(`Tarefa adiada para ${A.fmtCurto(t.date)}${t.time ? ' às ' + A.fmtTempo(t.time) : ''}.`, { icon: 'clock', ms: 3600 });
    }
    function del(id) {
        const t = E().taskById(id); if (!t) return;
        E().removeTask(id);
        Toast.show(`Tarefa “${t.title.slice(0, 40)}” excluída.`, { icon: 'trash', ms: 6000, action: { label: 'Desfazer', fn: () => E().restoreTask(id) } });
    }
    function toggleDone(id, d, checked) {
        const t = A.setDone(id, d, checked); if (!t) return;
        if (checked) Toast.show('Tarefa concluída ✓', { kind: 'ok', ms: 3200, action: { label: 'Desfazer', fn: () => A.setDone(id, d, false) } });
    }

    function onClick(e) {
        const b = e.target.closest('[data-a]'); if (!b || !host.contains(b)) return;
        const a = b.dataset.a, row = b.closest('.ag-task'), id = b.dataset.id || (row && row.dataset.id), d = b.dataset.d || (row && row.dataset.d) || S.sel;
        if (a === 'ck' || a === 'quickform') return;
        if (a === 'view') setView(b.dataset.v);
        else if (a === 'prev' || a === 'next') {
            const k = a === 'next' ? 1 : -1;
            if (S.view === 'cal') { S.month = A.addMonths(S.month, k); const day = Math.min(+S.sel.slice(8), +A.monthEnd(S.month).slice(8)); S.sel = S.month.slice(0, 8) + String(day).padStart(2, '0'); }
            else S.gstart = A.add(S.gstart || A.startOfWeek(A.today()), k * (S.days >= 28 ? 28 : 14));
            renderBar(); renderMain();
        }
        else if (a === 'today') { go(A.today()); S.gstart = ''; renderBar(); renderMain(); }
        else if (a === 'zoom') { S.days = +b.dataset.n; Prefs.set({ agCrono: S.days }, { quiet: true }); renderBar(); renderMain(); }
        else if (a === 'new') openEditor({ date: b.dataset.d || (S.view === 'cal' ? S.sel : A.today()) });
        else if (a === 'pick') { if (!e.target.closest('.ag-chip')) select(b.dataset.d); }
        else if (a === 'chip') { go(d); openEditor({ id, d }); }
        else if (a === 'gbar') openEditor({ id, d });
        else if (a === 'edit') openEditor({ id, d });
        else if (a === 'del') del(id);
        else if (a === 'snooze') snoozeMenu(b, id, d);
        else if (a === 'more') { S.listMax += 60; renderMain(); }
        else if (a === 'tochat') { if (V.AgendaChat) V.AgendaChat.mostrarDia(S.sel); }
    }
    function onChange(e) {
        const t = e.target;
        if (t.id === 'agOwner') { S.owner = t.value; renderBar(true); renderMain(); }
        else if (t.id === 'agDone') { S.done = t.checked; renderBar(true); renderMain(); }
        else if (t.matches && t.matches('.ag-ck')) { const row = t.closest('.ag-task'); toggleDone(row.dataset.id, row.dataset.d, t.checked); }
    }
    const searchSoon = debounce(() => { renderMain(); }, 240);
    function onInput(e) {
        if (e.target.id === 'agQ') { S.q = e.target.value; searchSoon(); }
        else if (e.target.id === 'agQuick') S.quick = e.target.value;
    }
    // o campo de "nova tarefa rápida" é recriado a cada atualização: o envio é tratado aqui, no host
    function onSubmit(e) { if (e.target.matches && e.target.matches('.ag-quick')) { e.preventDefault(); const i = e.target.querySelector('input'); if (quickAdd(i.value)) i.value = ''; } }
    function onKey(e) {
        const cell = e.target.closest && e.target.closest('.ag-cell');
        if (cell && e.target === cell) {
            const d = cell.dataset.d; let nd = null;
            if (e.key === 'ArrowLeft') nd = A.add(d, -1); else if (e.key === 'ArrowRight') nd = A.add(d, 1);
            else if (e.key === 'ArrowUp') nd = A.add(d, -7); else if (e.key === 'ArrowDown') nd = A.add(d, 7);
            else if (e.key === 'PageUp') nd = A.add(A.addMonths(d, -1), 0); else if (e.key === 'PageDown') nd = A.add(A.addMonths(d, 1), 0);
            else if (e.key === 'Home') nd = A.startOfWeek(d); else if (e.key === 'End') nd = A.add(A.startOfWeek(d), 6);
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(d); const q = $('#agQuick', host); if (q) q.focus(); return; }
            else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openEditor({ date: d }); return; }
            if (nd) { e.preventDefault(); if (/^PageUp|PageDown$/.test(e.key)) nd = A.add(A.monthStart(nd), Math.min(+d.slice(8), +A.monthEnd(nd).slice(8)) - 1); select(nd, true); }
        }
    }

    /* ── editor de tarefa ─────────────────────────────────────────────────── */
    function closeEditor() {
        if (!modal) return;
        modal.remove(); modal = null; document.removeEventListener('keydown', modalKey, true);
        if (lastFocus && lastFocus.isConnected) { try { lastFocus.focus(); } catch (e) { /* ok */ } }
    }
    function modalKey(e) {
        if (!modal) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeEditor(); }
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEditor(); }
        else if (e.key === 'Tab') {
            const f = $$('button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea', modal).filter(n => n.offsetParent !== null);
            if (!f.length) return; const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
        }
    }
    function openEditor(o = {}) {
        closeEditor(); lastFocus = document.activeElement;
        const t = o.id ? E().taskById(o.id) : null;
        if (o.id && !t) return;
        const d = t || { title: o.title || '', notes: '', date: o.date != null ? o.date : A.today(), end: '', time: o.time || '', owner: o.owner || (S.owner && S.owner !== '__none' ? S.owner : ''), prio: 'med', status: 'todo', tags: [], remind: 0, repeat: 'none', until: '' };
        const rec = d.repeat && d.repeat !== 'none';
        const owners = A.owners();
        const optList = (arr, cur) => arr.map(([v, l]) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('');
        modal = el('div', 'ag-ov', 'agModal');
        modal.innerHTML = `<form class="ag-modal pop-card" role="dialog" aria-modal="true" aria-labelledby="agMT" novalidate>
            <header><h3 id="agMT">${t ? 'Editar tarefa' : 'Nova tarefa'}</h3><button type="button" class="ag-x" data-m="close" aria-label="Fechar">${icon('x', 17)}</button></header>
            <div class="ag-m-body">
                <label class="ag-f"><span>Tarefa</span><input id="agfTitle" maxlength="200" placeholder="O que precisa ser feito?" autocomplete="off"></label>
                <div class="ag-f-row">
                    <label class="ag-f"><span>Início</span><input type="date" id="agfDate"></label>
                    <label class="ag-f"><span>Término <small>(opcional)</small></span><input type="date" id="agfEnd"></label>
                    <label class="ag-f"><span>Horário <small>(opcional)</small></span><input type="time" id="agfTime"></label>
                </div>
                <div class="ag-f-row">
                    <label class="ag-f"><span>Responsável</span><input id="agfOwner" list="agOwners" maxlength="60" placeholder="Quem vai fazer?" autocomplete="off"><datalist id="agOwners">${owners.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
                    <div class="ag-f"><span>Prioridade</span><div class="ag-prio" role="radiogroup" aria-label="Prioridade">${[['low', 'Baixa'], ['med', 'Média'], ['high', 'Alta']].map(([v, l]) => `<label style="--pc:${A.label.prioColor(v)}"><input type="radio" name="agfPrio" value="${v}"${d.prio === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
                    <label class="ag-f"><span>Situação</span><select id="agfStatus"${rec ? ' disabled title="Tarefas que se repetem são concluídas dia a dia, marcando a caixinha no calendário."' : ''}>${optList(Object.keys(A.STATUS).map(k => [k, A.STATUS[k]]), d.status)}</select></label>
                </div>
                <div class="ag-f-row">
                    <label class="ag-f"><span>Lembrar</span><select id="agfRemind">${optList(A.REMIND, d.remind)}</select></label>
                    <label class="ag-f"><span>Repetir</span><select id="agfRepeat">${optList(Object.keys(A.REPEAT).map(k => [k, A.REPEAT[k]]), d.repeat || 'none')}</select></label>
                    <label class="ag-f" id="agfUntilWrap"><span>Repetir até <small>(opcional)</small></span><input type="date" id="agfUntil"></label>
                </div>
                <label class="ag-f"><span>Detalhes</span><textarea id="agfNotes" rows="3" maxlength="4000" placeholder="Anotações, links, número do chamado…"></textarea></label>
                <label class="ag-f"><span>Etiquetas <small>(separe por vírgula)</small></span><input id="agfTags" maxlength="120" placeholder="ex.: sefaz, cliente-x" autocomplete="off"></label>
                <p class="ag-m-err" id="agfErr" role="alert" hidden></p>
            </div>
            <footer>${t ? `<button type="button" class="ag-btn danger" data-m="del">${icon('trash', 15)}Excluir</button>` : ''}<span class="ag-spacer"></span><button type="button" class="ag-btn" data-m="close">Cancelar</button><button type="submit" class="ag-btn primary">${icon('check', 15, 2.6)}Salvar</button></footer>
        </form>`;
        document.body.appendChild(modal);
        const $f = id => modal.querySelector('#' + id);
        $f('agfTitle').value = d.title || ''; $f('agfDate').value = d.date || ''; $f('agfEnd').value = d.end || ''; $f('agfTime').value = d.time || '';
        $f('agfOwner').value = d.owner || ''; $f('agfUntil').value = d.until || ''; $f('agfNotes').value = d.notes || ''; $f('agfTags').value = (d.tags || []).join(', ');
        const syncUntil = () => { $f('agfUntilWrap').style.display = $f('agfRepeat').value === 'none' ? 'none' : ''; $f('agfStatus').disabled = $f('agfRepeat').value !== 'none'; };
        $f('agfRepeat').addEventListener('change', syncUntil); syncUntil();
        modal.addEventListener('mousedown', ev => { if (ev.target === modal) closeEditor(); });
        modal.addEventListener('click', ev => {
            const b = ev.target.closest('[data-m]'); if (!b) return;
            if (b.dataset.m === 'close') closeEditor();
            else if (b.dataset.m === 'del' && t) { closeEditor(); del(t.id); }
        });
        modal.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); saveEditor(); });
        modal.dataset.id = t ? t.id : '';
        document.addEventListener('keydown', modalKey, true);
        setTimeout(() => { const i = $f('agfTitle'); if (i) { i.focus(); i.select(); } }, 30);
    }
    function saveEditor() {
        if (!modal) return;
        const $f = id => modal.querySelector('#' + id), err = $f('agfErr');
        const fail = m => { err.textContent = m; err.hidden = false; };
        const title = $f('agfTitle').value.trim(), date = $f('agfDate').value, end = $f('agfEnd').value, time = $f('agfTime').value, until = $f('agfUntil').value;
        if (!title) { $f('agfTitle').focus(); return fail('Escreva o nome da tarefa.'); }
        if (time && !date) { $f('agfDate').focus(); return fail('Para usar o horário, informe também a data de início.'); }
        if (end && !date) { $f('agfDate').focus(); return fail('Para usar o término, informe também a data de início.'); }
        if (end && end < date) { $f('agfEnd').focus(); return fail('O término não pode ser antes do início.'); }
        const repeat = $f('agfRepeat').value;
        if (repeat !== 'none' && !date) { $f('agfDate').focus(); return fail('Para repetir a tarefa, informe a data de início.'); }
        if (repeat !== 'none' && until && until < date) { $f('agfUntil').focus(); return fail('“Repetir até” não pode ser antes do início.'); }
        const prio = (modal.querySelector('input[name=agfPrio]:checked') || {}).value || 'med';
        const patch = { title, date, end: repeat !== 'none' ? '' : end, time, owner: $f('agfOwner').value.trim(), prio, status: repeat !== 'none' ? 'todo' : $f('agfStatus').value,
            remind: +$f('agfRemind').value, repeat, until: repeat !== 'none' ? until : '', notes: $f('agfNotes').value, tags: $f('agfTags').value.split(/[,;#]+/).map(x => x.trim()).filter(Boolean) };
        const id = modal.dataset.id;
        let t;
        if (id) { const old = E().taskById(id); if (old && old.repeat !== 'none' && repeat === 'none') patch.doneOn = []; t = E().updateTask(id, patch); }
        else t = E().createTask(patch);
        closeEditor();
        if (t && t.date) { go(t.date); S.gstart = ''; }
        render();
        Toast.show(id ? 'Tarefa atualizada.' : `Tarefa criada${t && t.date ? ' para ' + A.fmtCurto(t.date) : ''}.`, { kind: 'ok', icon: 'calendarcheck', ms: 3200 });
    }

    /* ── entradas públicas ────────────────────────────────────────────────── */
    function goto(date, view) { if (view) { S.view = view; Prefs.set({ agView: view }, { quiet: true }); } if (date) go(date); S.gstart = ''; render(); }
    function newTask(pre) { openEditor(pre || {}); }
    function editTask(id, d) { openEditor({ id, d }); }
    return { mount, render, refresh, goto, newTask, editTask, taskRow, onSubmit, get mounted() { return built; }, get state() { return Object.assign({}, S); }, setFilters(f) { Object.assign(S, f || {}); render(); } };
})();
