/* js/ui/agenda-core.js — Agenda do Meu Espaço: datas, repetição, consultas e leitura de frases em português.
   Só lógica: não desenha tela e NÃO usa a rede. As tarefas ficam na mesma pasta local das anotações (ver meu-espaco-dados.js). */
'use strict';
const Agenda = (() => {
    const E = () => MeuEspaco;
    const DOW = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const DOW_S = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const MES_S = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const PRIO = { high: ['Alta', '#ef4444'], med: ['Média', '#f59e0b'], low: ['Baixa', '#10b981'] };
    const STATUS = { todo: 'A fazer', doing: 'Em andamento', done: 'Concluída' };
    const REPEAT = { none: 'Não repete', daily: 'Todo dia', weekdays: 'Dias úteis (seg a sex)', weekly: 'Toda semana', monthly: 'Todo mês' };
    const REMIND = [[-1, 'Não avisar'], [0, 'Na hora'], [5, '5 minutos antes'], [15, '15 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes'], [1440, '1 dia antes']];
    const HORA_PADRAO = '08:00';   // tarefa sem horário avisa neste horário (se o sistema estiver aberto)

    /* ── datas (texto "AAAA-MM-DD", sempre no horário local do computador) ─────────────── */
    const pad = n => String(n).padStart(2, '0');
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? d : null; };
    const today = () => iso(new Date());
    const add = (s, n) => { const d = parse(s) || new Date(); d.setDate(d.getDate() + n); return iso(d); };
    const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
    const dow = s => parse(s).getDay();
    const weekStart = () => (Prefs.get('agWeek') === 'seg' ? 1 : 0);
    const startOfWeek = s => add(s, -((dow(s) - weekStart() + 7) % 7));
    const monthStart = s => s.slice(0, 8) + '01';
    const monthEnd = s => { const d = parse(monthStart(s)); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
    const addMonths = (s, n) => { const d = parse(monthStart(s)); return iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
    const mesAno = s => { const d = parse(s); return `${MES[d.getMonth()]} de ${d.getFullYear()}`; };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const fmtLong = s => { const d = parse(s); return `${DOW[d.getDay()]}, ${d.getDate()} de ${MES[d.getMonth()]}`; };
    const fmtDM = s => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
    const fmtDMY = s => `${fmtDM(s)}/${s.slice(0, 4)}`;
    const fmtCurto = s => { const d = parse(s); return `${DOW_S[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
    function fmtRel(s) {
        const n = diff(today(), s);
        if (n === 0) return 'hoje'; if (n === 1) return 'amanhã'; if (n === -1) return 'ontem'; if (n === 2) return 'depois de amanhã';
        return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
    }
    const fmtTempo = t => (t ? t.replace(/^0/, '').replace(':00', 'h').replace(':', 'h') : '');   // 14:30 → 14h30 · 09:00 → 9h
    const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
    const fold = s => String(s == null ? '' : s).replace(/[À-ſ]/g, c => c.normalize('NFD')[0]).toLowerCase();   // sem acentos e SEM mudar o tamanho (dá para achar posições)

    /* ── leitura das tarefas ──────────────────────────────────────────────── */
    const tasks = () => E().tasks().filter(t => t && typeof t.id === 'string' && (!t.date || parse(t.date)));
    const isRec = t => !!t.repeat && t.repeat !== 'none';
    const hay = t => norm([t.title, t.notes, t.owner, (t.tags || []).join(' ')].join(' '));
    function owners() {
        const c = {};
        tasks().forEach(t => { const o = (t.owner || '').trim(); if (o) c[o] = (c[o] || 0) + 1; });
        return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b, 'pt-BR'));
    }
    function match(t, f) {
        if (!f) return true;
        if (f.owner) { const o = norm((t.owner || '').trim()); if (f.owner === '__none') { if (o) return false; } else if (o !== norm(f.owner)) return false; }
        if (f.q) { const h = hay(t); if (!norm(f.q).split(/\s+/).filter(Boolean).every(w => h.includes(w))) return false; }
        if (f.tag && !(t.tags || []).includes(f.tag)) return false;
        return true;
    }
    /* A tarefa acontece nesta data? (tarefas com início/fim ocupam todos os dias do período; as repetidas, uma data por vez) */
    function occursOn(t, d) {
        if (!t.date || d < t.date) return false;
        if (!isRec(t)) return t.end ? d <= t.end : d === t.date;
        if (t.until && d > t.until) return false;
        const a = parse(t.date), b = parse(d);
        if (t.repeat === 'daily') return true;
        if (t.repeat === 'weekdays') return b.getDay() >= 1 && b.getDay() <= 5;
        if (t.repeat === 'weekly') return a.getDay() === b.getDay();
        if (t.repeat === 'monthly') { const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate(); return b.getDate() === Math.min(a.getDate(), last); }
        return false;
    }
    function occ(t, d, td) {
        const rec = isRec(t), fim = rec ? d : (t.end || t.date);
        const done = rec ? (t.doneOn || []).includes(d) : t.status === 'done';
        return { key: t.id + '@' + d, id: t.id, task: t, date: d, time: t.time || '', done, rec, overdue: !done && fim < td, first: rec || d === t.date, last: rec || d === fim, multi: !rec && !!t.end };
    }
    const PR = { high: 0, med: 1, low: 2 };
    const cmp = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || (a.done - b.done) || ((a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : 0)
        || ((PR[a.task.prio] != null ? PR[a.task.prio] : 1) - (PR[b.task.prio] != null ? PR[b.task.prio] : 1)) || String(a.task.title || '').localeCompare(String(b.task.title || ''), 'pt-BR');
    /* Todas as ocorrências no período [from, to]. f: { owner, q, tag, status: 'open' | 'done' } */
    function between(from, to, f) {
        const out = [], td = today(); f = f || {};
        for (const t of tasks()) {
            if (!t.date || !match(t, f)) continue;
            const rec = isRec(t);
            let s = from > t.date ? from : t.date, e = to;
            if (!rec) { const fim = t.end || t.date; if (e > fim) e = fim; } else if (t.until && e > t.until) e = t.until;
            if (s > e) continue;
            for (let d = s; d <= e; d = add(d, 1)) {
                if (!occursOn(t, d)) continue;
                const o = occ(t, d, td);
                if (f.status === 'open' && o.done) continue;
                if (f.status === 'done' && !o.done) continue;
                out.push(o);
            }
        }
        return out.sort(cmp);
    }
    const forDay = (d, f) => between(d, d, f);
    /* Atrasadas: tarefas simples abertas cujo prazo passou + a última ocorrência (até 7 dias) das repetidas que ficou sem concluir */
    function overdue(f) {
        const td = today(), out = []; f = f || {};
        for (const t of tasks()) {
            if (!t.date || !match(t, f)) continue;
            if (!isRec(t)) { const fim = t.end || t.date; if (t.status !== 'done' && fim < td) out.push(occ(t, fim, td)); continue; }
            for (let d = add(td, -1), n = 0; n < 7 && d >= t.date; d = add(d, -1), n++) {
                if (occursOn(t, d)) { const o = occ(t, d, td); if (!o.done) out.push(o); break; }
            }
        }
        return out.sort(cmp);
    }
    function nextOf(t) {   // próxima data de uma tarefa repetida (de hoje em diante)
        const td = today(); if (!isRec(t)) return t.date || '';
        for (let d = td, n = 0; n < 400; d = add(d, 1), n++) { if (t.until && d > t.until) return ''; if (occursOn(t, d)) return d; }
        return '';
    }
    function counts() {
        const td = today(), od = overdue(), hoje = forDay(td);
        return { overdue: od.length, today: hoje.filter(o => !o.done).length, todayAll: hoje.length, todayDone: hoje.filter(o => o.done).length, open: od.length + hoje.filter(o => !o.done).length };
    }
    const noDate = f => tasks().filter(t => !t.date && t.status !== 'done' && match(t, f));
    const search = (q, limit = 6) => { const nq = norm(q || '').trim(); if (!nq) return []; return tasks().filter(t => !(t.status === 'done' && !isRec(t)) && nq.split(/\s+/).every(w => hay(t).includes(w))).slice(0, limit); };

    /* ── ações ────────────────────────────────────────────────────────────── */
    function setDone(id, d, done) {   // d = data da ocorrência (nas repetidas, cada dia é concluído separado)
        const t = E().taskById(id); if (!t) return null;
        if (isRec(t)) { const l = new Set(t.doneOn || []); if (done) l.add(d); else l.delete(d); return E().updateTask(id, { doneOn: Array.from(l) }); }
        return E().updateTask(id, { status: done ? 'done' : (t.status === 'done' ? 'todo' : t.status) });
    }
    /* Adiar: '15m' e '1h' (precisam de horário) ou 'tomorrow'. Nas repetidas só dá para concluir a ocorrência. */
    function snooze(id, how) {
        const t = E().taskById(id); if (!t || isRec(t)) return null;
        const td = today(), patch = {};
        if (how === 'tomorrow') {
            const base = t.date < td ? td : t.date, nd = add(base, 1), shift = diff(t.date, nd);
            patch.date = nd; if (t.end) patch.end = add(t.end, shift);
        } else {
            if (!t.time) return null;
            const m = how === '1h' ? 60 : 15, n = new Date(), cur = parse(t.date); const [h, mi] = t.time.split(':'); cur.setHours(+h, +mi, 0, 0);
            const from = Math.max(n.getTime(), cur.getTime()), nt = new Date(from + m * 60000);
            const nd = iso(nt); patch.time = `${pad(nt.getHours())}:${pad(nt.getMinutes())}`;
            if (nd !== t.date) { const shift = diff(t.date, nd); patch.date = nd; if (t.end) patch.end = add(t.end, shift); }
        }
        return E().updateTask(id, patch);
    }

    /* ── leitura de datas e horas em português ────────────────────────────── */
    const N_MES = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
    const N_DOW = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
    const mkDate = (y, m, d) => { const x = new Date(y, m, d); return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d ? iso(x) : null; };
    /* Procura UMA data em um texto. Devolve { date, from, to, label, span: [início, fim] no texto } ou null.
       futuro: "dia 5" que já passou vira o dia 5 do mês que vem (usado ao CRIAR tarefas). */
    function findDate(text, o = {}) {
        const f = fold(text), td = o.base || today(), t = parse(td), futuro = !!o.futuro;
        let m;
        const hit = (date, re, label) => { const x = re.exec(f); return { date, label: label || fmtLong(date), span: [x.index, x.index + x[0].length] }; };
        const lastDom = (y, mo) => new Date(y, mo + 1, 0).getDate();
        if ((m = /(?:^|[^\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/.exec(f))) {
            const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : t.getFullYear();
            let d = mkDate(y, +m[2] - 1, +m[1]);
            if (d && !m[3] && futuro && d < td) d = mkDate(y + 1, +m[2] - 1, +m[1]) || d;
            if (d) { const k = m.index + m[0].indexOf(m[1]); return { date: d, label: fmtLong(d), span: [k, m.index + m[0].length] }; }
        }
        if ((m = /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?\b/.exec(f))) {
            const y = m[3] ? +m[3] : t.getFullYear(); let d = mkDate(y, N_MES[m[2]], +m[1]);
            if (d && !m[3] && futuro && d < td) d = mkDate(y + 1, N_MES[m[2]], +m[1]) || d;
            if (d) return { date: d, label: fmtLong(d), span: [m.index, m.index + m[0].length] };
        }
        if ((m = /\bdepois de amanha\b/.exec(f))) return hit(add(td, 2), /\bdepois de amanha\b/);
        if ((m = /\banteontem\b/.exec(f))) return hit(add(td, -2), /\banteontem\b/);
        if ((m = /\bamanha\b/.exec(f))) return hit(add(td, 1), /\bamanha\b/);
        if ((m = /\bontem\b/.exec(f))) return hit(add(td, -1), /\bontem\b/);
        if ((m = /\bhoje\b/.exec(f))) return hit(td, /\bhoje\b/);
        if ((m = /\b(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?(?:\s+(que vem|proxima|passada))?\b/.exec(f))) {
            const alvo = N_DOW[m[1]], mod = m[2] || '';
            let d = td;
            if (mod === 'passada') { do { d = add(d, -1); } while (dow(d) !== alvo); }
            else { const ate = (alvo - t.getDay() + 7) % 7; d = add(td, mod ? (ate === 0 ? 7 : ate) : ate); }
            return { date: d, label: fmtLong(d), span: [m.index, m.index + m[0].length] };
        }
        if ((m = /\bdia\s+(\d{1,2})\b/.exec(f))) {
            const y = t.getFullYear(), mo = t.getMonth(), dd = +m[1];
            let d = dd <= lastDom(y, mo) ? mkDate(y, mo, dd) : null;
            if (d && futuro && d < td) { const n = new Date(y, mo + 1, 1); d = dd <= lastDom(n.getFullYear(), n.getMonth()) ? mkDate(n.getFullYear(), n.getMonth(), dd) : d; }
            if (d) return { date: d, label: fmtLong(d), span: [m.index, m.index + m[0].length] };
        }
        return null;
    }
    /* Períodos para CONSULTAS: semana, mês, "próximos N dias"... Devolve { from, to, label } ou null. */
    function findRange(text, base) {
        const f = fold(text), td = base || today();
        let m;
        const sem = n => { const a = add(startOfWeek(td), 7 * n); return { from: a, to: add(a, 6) }; };
        if (/\b(proxima semana|semana que vem|semana seguinte)\b/.test(f)) return Object.assign(sem(1), { label: 'na próxima semana' });
        if (/\b(semana passada|semana anterior)\b/.test(f)) return Object.assign(sem(-1), { label: 'na semana passada' });
        if (/\b(esta|essa|nesta|nessa|desta|dessa)\s+semana\b|\bsemana atual\b|\bda semana\b|\bna semana\b|\bsemana\b/.test(f)) return Object.assign(sem(0), { label: 'nesta semana' });
        if (/\b(proximo mes|mes que vem|mes seguinte)\b/.test(f)) { const a = addMonths(td, 1); return { from: a, to: monthEnd(a), label: 'no próximo mês' }; }
        if (/\b(mes passado|mes anterior)\b/.test(f)) { const a = addMonths(td, -1); return { from: a, to: monthEnd(a), label: 'no mês passado' }; }
        if (/\b(este|esse|neste|nesse|deste|desse)\s+mes\b|\bmes atual\b|\bdo mes\b|\bno mes\b/.test(f)) return { from: monthStart(td), to: monthEnd(td), label: 'neste mês' };
        if ((m = /\bproximos?\s+(\d{1,2})\s+dias?\b/.exec(f))) { const n = clamp(+m[1], 1, 60); return { from: td, to: add(td, n - 1), label: n === 1 ? 'hoje' : `nos próximos ${n} dias` }; }
        if ((m = /\bultimos?\s+(\d{1,2})\s+dias?\b/.exec(f))) { const n = clamp(+m[1], 1, 60); return { from: add(td, -(n - 1)), to: td, label: `nos últimos ${n} dias` }; }
        return null;
    }
    /* Horário: "14h", "14h30", "14:30", "às 9", "9 horas". Devolve { time: 'HH:MM', span } ou null. */
    function findTime(text) {
        const s = String(text || ''), f = fold(s); let m;
        if ((m = /(?:^|[^\d/])((?:as\s+)?)([01]?\d|2[0-3])(?::|h)([0-5]\d)?(?!\d)(?!\/)/.exec(f))) {
            const k = m.index + m[0].indexOf(m[2]) - m[1].length;
            return { time: `${pad(+m[2])}:${m[3] || '00'}`, span: [Math.max(m.index, k), m.index + m[0].length] };
        }
        // "às 9" / "às 9 horas": só com o acento, para não confundir com "as 3 tarefas"
        if ((m = /(?:^|\s)([àÀ]s\s+([01]?\d|2[0-3]))(?:\s*horas?)?(?![\d/:h])(?!\s*(?:de\b|dias?\b))/.exec(s))) return { time: `${pad(+m[2])}:00`, span: [m.index + m[0].indexOf(m[1]), m.index + m[0].length] };
        if ((m = /\b([01]?\d|2[0-3])\s*horas\b/.exec(f)) && !/(?:\bem|\bha|\bpor|daqui a|dentro de)\s*$/.test(f.slice(0, m.index))) return { time: `${pad(+m[1])}:00`, span: [m.index, m.index + m[0].length] };
        return null;
    }
    /* "Ligar para o cliente amanhã 14h @João !alta #sefaz" → { title, date, time, owner, prio, tags }. */
    function parseQuick(text, o = {}) {
        let s = String(text || '').replace(/\s+/g, ' ').trim(), r = { title: '', date: '', time: '', owner: '', prio: '', tags: [] };
        const cutSpan = sp => { s = (s.slice(0, sp[0]) + ' ' + s.slice(sp[1])).replace(/\s+/g, ' ').trim(); };
        let m;
        while ((m = /(?:^|\s)@([\p{L}\p{N}_.-]{1,40})/u.exec(s))) { if (!r.owner) r.owner = m[1].replace(/[_]/g, ' '); s = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
        while ((m = /(?:^|\s)#([\p{L}\p{N}_-]{1,24})/u.exec(s))) { r.tags.push(m[1].toLowerCase()); s = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
        if ((m = /(?:^|\s)!(alta|urgente|media|média|baixa)\b/iu.exec(s))) { const w = fold(m[1]); r.prio = w === 'baixa' ? 'low' : w === 'media' ? 'med' : 'high'; s = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
        const dt = findDate(s, { futuro: true, base: o.base });
        if (dt) { r.date = dt.date; cutSpan(dt.span); }
        const tm = findTime(s);
        if (tm) { r.time = tm.time; cutSpan(tm.span); }
        if (r.time && !r.date) r.date = o.base || today();
        s = s.replace(/^(?:para|pra|de|em|no|na|ate|até|dia|as|às|a)\s+/i, '').replace(/\s+(?:para|pra|de|em|no|na|ate|até|dia|as|às|a|e)$/i, '').replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, '').trim();
        r.title = s.slice(0, 200);
        return r;
    }

    /* ── lembretes ─────────────────────────────────────────────────────────── */
    const dueMs = o => { const d = parse(o.date); const [h, m] = (o.time || HORA_PADRAO).split(':'); d.setHours(+h, +m, 0, 0); return d.getTime(); };
    /* Avisos que vencem entre fromMs e toMs: [{ key, at, due, occ }]. Tarefas com período avisam no 1º e no último dia. */
    function reminders(fromMs, toMs) {
        const out = [], a = iso(new Date(fromMs - 2 * 864e5)), b = iso(new Date(toMs + 2 * 864e5));
        for (const o of between(a, b, { status: 'open' })) {
            const t = o.task; if (!(t.remind >= 0) || !(o.first || o.last)) continue;
            const due = dueMs(o), at = due - t.remind * 60000;
            if (at >= fromMs && at <= toMs) out.push({ key: o.key + '|' + (o.time || '') + '|' + t.remind, at, due, occ: o });   // o horário entra na chave: tarefa adiada avisa de novo
        }
        return out.sort((x, y) => x.at - y.at);
    }
    /* O que mostrar no "quadro do dia": atrasadas, hoje e os próximos dias. */
    function board(daysAhead = 3) {
        const td = today(), hoje = forDay(td), od = overdue();
        const prox = daysAhead > 0 ? between(add(td, 1), add(td, daysAhead), { status: 'open' }) : [];
        return { td, overdue: od, today: hoje, soon: prox, open: od.length + hoje.filter(o => !o.done).length };
    }
    const label = {
        prio: p => (PRIO[p] || PRIO.med)[0], prioColor: p => (PRIO[p] || PRIO.med)[1], status: s => STATUS[s] || STATUS.todo,
        repeat: r => REPEAT[r] || REPEAT.none, remind: m => (REMIND.find(x => x[0] === m) || [0, m >= 0 ? `${m} min antes` : 'Não avisar'])[1],
    };
    return { iso, parse, today, add, diff, dow, startOfWeek, monthStart, monthEnd, addMonths, mesAno, cap, fmtLong, fmtDM, fmtDMY, fmtCurto, fmtRel, fmtTempo, nowMin, fold,
        DOW, DOW_S, MES, MES_S, PRIO, STATUS, REPEAT, REMIND, HORA_PADRAO, label,
        tasks, owners, match, occursOn, between, forDay, overdue, nextOf, counts, noDate, search, setDone, snooze,
        findDate, findRange, findTime, parseQuick, dueMs, reminders, board, weekStart };
})();
V.Agenda = window.Agenda = Agenda;
