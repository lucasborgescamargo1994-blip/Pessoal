/* js/ui/agenda-chat.js — A agenda conversa com o chat: perguntar "quais tarefas tenho hoje?" ou clicar num dia do calendário e trazer as tarefas para o chat.
   PRIVACIDADE: o cartão da agenda é desenhado só na tela. Ele NÃO vai para a IA, NÃO entra no histórico/contexto da conversa, NÃO gera log e
   NÃO usa a rede — mesmo a pergunta digitada fica de fora (handleChat para antes de qualquer registro). */
'use strict';
Agenda.Chat = (() => {
    const A = Agenda, E = () => MeuEspaco;
    const cards = new Map();   // nó do cartão → especificação (para redesenhar quando as tarefas mudam)
    let wired = false;

    /* ── entender a frase ─────────────────────────────────────────────────── */
    // perguntas sobre o SISTEMA Bsoft (que tratam de "tarefa agendada", rotinas etc.) nunca são tomadas como pergunta da agenda
    const EXCLUI = /\b(sistema|bsoft|tms|ct-?e|mdf-?e|nf-?e|nfs-?e|rotinas?|parametros?|funcionalidades?|erros?|telas?|relatorios?|cadastr\w*|configur\w*|certificado|manual|agendad[ao]s?|executa\w*|executou|rodou|integra\w*|sefaz|emiss\w*|emitir|cancelar|boleto|fatura\w*|novidades?|novos?|novas?|coletas?|entregas?|motoristas?|veiculos?|viagens?|fretes?|manifestos?|nao consigo|nao funciona|como (?:criar|fazer|configurar|cadastrar|funciona|agendar|usar|habilitar|ativar))\b/;
    const NOUN = /\b(tarefas?|agenda|cronograma|lembretes?|compromissos?|afazeres|pendencias do dia)\b/;
    const PESSOAL = /\b(minha|minhas|meu|meus)\b/;
    const QUEM = /\b(?:o que|oque|que)\s+(?:eu\s+|o\s+\w+\s+|a\s+\w+\s+)?(?:tenho|tem|preciso|devo|ha|existe|fica)\b/;
    // Só vale como pergunta da agenda se a frase for CURTA e feita só de palavras de agenda/tempo (no máx. 1 palavra "estranha", fora o nome do responsável):
    // "minha agenda de entregas está errada" é dúvida de suporte, não consulta à agenda.
    const OK = new Set(('quais qual que o a os as um uma de do da dos das para pra pro no na nos nas em e eu me mim ver veja mostre mostra mostrar lista listar liste tenho tem tinha ha temos preciso devo fazer faco algo alguma coisa por favor pf ainda ja '
        + 'esse essa este esta estas estes neste nesta nesse nessa desta desse dessa minha minhas meu meus hoje amanha ontem anteontem depois semana semanas mes meses dia dias proxima proximo proximas proximos ultima ultimo ultimas ultimos atual passada passado vem seguinte '
        + 'tarefa tarefas agenda cronograma lembrete lembretes compromisso compromissos afazeres atrasada atrasadas atrasado atrasados vencida vencidas vencido vencidos pendente pendentes concluida concluidas concluido concluidos feita feitas feito feitos finalizada finalizadas finalizado finalizados completada completadas '
        + 'domingo segunda terca quarta quinta sexta sabado feira ate sobre tudo todas todos onde quando como estao estou fica ficam atraso').split(' '));
    function palavrasEstranhas(t, dono) {
        const nome = new Set(A.fold(dono || '').split(/\s+/).filter(Boolean));
        return t.split(' ').filter(w => w && !/^\d+([/\-.]\d+)*$/.test(w) && !OK.has(w) && !nome.has(w)).length;
    }
    function interpretar(texto) {
        const raw = String(texto || '').trim();
        if (!raw || raw.length > 200) return null;
        const t = A.fold(raw).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
        let m;
        // criar: só com prefixo explícito (para não confundir com uma pergunta de suporte)
        if ((m = /^\/?(?:nova |criar |adicionar |add )?(?:tarefa|lembrete)\s*[:\-–]\s*(.+)$/i.exec(raw))) return { tipo: 'criar', texto: m[1].trim() };
        if (EXCLUI.test(t)) return null;
        // "abrir a agenda" / "abrir o cronograma": abre a aba da Agenda
        if ((m = /^(?:por favor )?(?:abrir|abre|abra)\s+(?:a |o |minha |meu )?(agenda|calendario|cronograma)$/.exec(t))) return { tipo: 'abrir', view: m[1] === 'cronograma' ? 'crono' : 'cal' };
        const dono =A.owners().find(o => new RegExp('(?:^|[^a-z0-9])' + A.fold(o).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])').test(t)) || '';
        const rng = A.findRange(t), dia = rng ? null : A.findDate(t), atras = /\b(atrasad[ao]s?|vencid[ao]s?|em atraso)\b/.test(t), feitas = /\b(concluid[ao]s?|feit[ao]s?|finalizad[ao]s?|completad[ao]s?)\b/.test(t);
        const tempo = !!(rng || dia || atras || /\b(hoje|amanha|ontem)\b/.test(t));
        const temNome = NOUN.test(t);
        let ok = false;
        if (temNome && (PESSOAL.test(t) || tempo || dono)) ok = true;
        else if (!temNome && tempo && (QUEM.test(t) || /\b(tenho|tem) (algo|alguma coisa|compromisso)\b/.test(t))) ok = true;
        if (!ok || palavrasEstranhas(t, dono) > 1) return null;
        const o = { tipo: 'consulta', dono };
        if (atras && !rng && !dia) o.spec = { kind: 'atrasadas' };
        else if (rng) o.spec = { kind: 'periodo', from: rng.from, to: rng.to, label: rng.label };
        else if (dia) o.spec = { kind: 'dia', date: dia.date };
        else o.spec = (PESSOAL.test(t) && temNome && !/\bhoje\b/.test(t)) ? { kind: 'geral' } : { kind: 'dia', date: A.today() };
        if (feitas) o.spec.feitas = true;
        if (dono) o.spec.owner = dono;
        return o;
    }

    /* ── cartão ───────────────────────────────────────────────────────────── */
    const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
    function bodyFor(spec) {
        const f = { owner: spec.owner || undefined }, TR = (o, w) => A.UI.taskRow(o, { when: !!w });
        const grp = (cls, ic, title, n) => `<div class="ag-group${cls ? ' ' + cls : ''}">${ic ? icon(ic, 12) : ''}${title}<b>${n}</b></div>`;
        let title = '', sub = '', html = '', n = 0, vazio = '';
        const quem = spec.owner ? ` · responsável: ${spec.owner}` : '';
        if (spec.kind === 'atrasadas') {
            const l = A.overdue(f); n = l.length; title = 'Tarefas atrasadas'; sub = (n ? plural(n, 'tarefa', 'tarefas') : 'nenhuma') + quem;
            html = l.map(o => TR(o, true)).join(''); vazio = 'Nenhuma tarefa atrasada. 🎉';
        } else if (spec.kind === 'dia') {
            const d = spec.date, td = A.today(), st = spec.feitas ? 'done' : undefined;
            const l = A.forDay(d, Object.assign({}, f, { status: st })), od = d === td && !spec.feitas ? A.overdue(f) : [];
            n = l.length + od.length;
            title = d === td ? 'Sua agenda de hoje' : `Sua agenda — ${A.cap(A.fmtRel(d))}`; sub = `${A.cap(A.fmtLong(d))}${quem}`;
            html = (od.length ? grp('is-late', 'alert', 'Atrasadas', od.length) + od.map(o => TR(o, true)).join('') + (l.length ? grp('', '', A.cap(A.fmtCurto(d)), l.length) : '') : '') + l.map(o => TR(o)).join('');
            vazio = spec.feitas ? 'Nenhuma tarefa concluída neste dia.' : `Nada marcado para ${A.fmtDM(d)}. Dia livre ✨`;
        } else if (spec.kind === 'periodo') {
            const l = A.between(spec.from, spec.to, Object.assign({}, f, { status: spec.feitas ? 'done' : undefined })); n = l.length;
            title = `Suas tarefas ${spec.label}`; sub = `${A.fmtDM(spec.from)} a ${A.fmtDM(spec.to)} · ${plural(n, 'tarefa', 'tarefas')}${quem}`;
            const por = {}; l.forEach(o => { (por[o.date] = por[o.date] || []).push(o); });
            html = Object.keys(por).sort().map(d => grp('', '', `${A.cap(A.fmtLong(d))} <span style="font-weight:700;text-transform:none;letter-spacing:0">${esc(A.fmtRel(d))}</span>`, por[d].length) + por[d].map(o => TR(o)).join('')).join('');
            vazio = 'Nenhuma tarefa neste período.';
        } else {   // geral: atrasadas + hoje + próximos 7 dias
            const td = A.today(), od = A.overdue(f), hj = A.forDay(td, f), px = A.between(A.add(td, 1), A.add(td, 7), Object.assign({}, f, { status: 'open' }));
            n = od.length + hj.length + px.length; title = 'Sua agenda'; sub = `${plural(od.length + hj.filter(o => !o.done).length, 'tarefa pede', 'tarefas pedem')} atenção${quem}`;
            html = (od.length ? grp('is-late', 'alert', 'Atrasadas', od.length) + od.map(o => TR(o, true)).join('') : '')
                + (hj.length ? grp('', 'calendarcheck', 'Hoje', hj.length) + hj.map(o => TR(o)).join('') : '')
                + (px.length ? grp('', 'calendar', 'Próximos 7 dias', px.length) + px.map(o => TR(o, true)).join('') : '');
            vazio = 'Sua agenda está vazia por enquanto. Crie tarefas pelo Meu Espaço › Agenda — ou escreva aqui: “tarefa: ligar para o cliente amanhã 14h”.';
        }
        return { title, sub, html: html || `<div class="ag-empty"><b>${esc(vazio)}</b></div>`, n };
    }
    function paint(node, spec) {
        const b = bodyFor(spec);
        node.querySelector('.agc-head b').textContent = b.title; node.querySelector('.agc-head small').textContent = b.sub;
        node.querySelector('.agc-body').innerHTML = b.html;
    }
    function novoCartao(spec) {
        const c = el('div', 'answer-card ag-chat');
        c.innerHTML = `<div class="agc-head"><span class="agc-ic">${icon('calendar', 18)}</span><div><b></b><small></small></div></div><div class="agc-body"></div>
            <div class="agc-foot"><span class="agc-priv" title="Estas tarefas ficam só na pasta do seu computador. Este cartão não é enviado à IA, não entra no histórico da conversa e não gera registro.">${icon('lock', 12)}Só você vê — não vai para a IA nem para o banco</span><span class="ag-spacer"></span><button type="button" class="ag-sbtn" data-c="open">${icon('calendar', 14)}Abrir a agenda</button><button type="button" class="ag-sbtn" data-c="new">${icon('plus', 14, 2.4)}Nova tarefa</button></div>`;
        cards.set(c, spec); paint(c, spec);
        return c;
    }
    function colocar(node) {
        const s = document.getElementById('chatStream'); if (!s) return;
        const w = document.getElementById('welcomeMsg'); if (w) w.remove();
        s.appendChild(node);
        // se a conversa estava escondida atrás de outra aba, mostra
        try { if (Workspace.isVisible && !Workspace.isVisible('chat')) Workspace.showChat(); } catch (e) { /* sem workspace */ }
        if (typeof scrollToBottom === 'function') scrollToBottom(true);
    }
    function refreshCards() {
        cards.forEach((spec, node) => { if (!node.isConnected) { cards.delete(node); return; } paint(node, spec); });
    }
    function wire() {
        if (wired) return; wired = true;
        const s = document.getElementById('chatStream'); if (!s) return;
        s.addEventListener('click', e => {
            const c = e.target.closest('.ag-chat'); if (!c) return;
            const spec = cards.get(c) || {}, bb = e.target.closest('[data-c]');
            if (bb) {
                if (bb.dataset.c === 'open') Agenda.abrir({ date: spec.date || (spec.from || A.today()), beside: true });
                else if (bb.dataset.c === 'new') Agenda.abrir({ date: spec.date || A.today(), newTask: { date: spec.date || A.today() }, beside: true });
                return;
            }
            const b = e.target.closest('[data-a]'); if (!b) return;
            const row = b.closest('.ag-task'), id = row && row.dataset.id, d = row && row.dataset.d; if (!id) return;
            if (b.dataset.a === 'edit') Agenda.abrir({ date: d || A.today(), edit: id, beside: true });
            else if (b.dataset.a === 'del') { const t = E().taskById(id); if (t) { E().removeTask(id); Toast.show(`Tarefa “${t.title.slice(0, 40)}” excluída.`, { icon: 'trash', ms: 6000, action: { label: 'Desfazer', fn: () => E().restoreTask(id) } }); } }
            else if (b.dataset.a === 'snooze') {
                const t = E().taskById(id); if (!t) return; const r = b.getBoundingClientRect(), items = [];
                if (t.time) items.push({ label: 'Daqui a 15 minutos', icon: 'clock', fn: () => A.snooze(id, '15m') }, { label: 'Daqui a 1 hora', icon: 'clock', fn: () => A.snooze(id, '1h') });
                items.push({ label: 'Para amanhã', icon: 'calendar', fn: () => A.snooze(id, 'tomorrow') });
                Ctx.open(r.left - 120, r.bottom + 6, items);
            }
        });
        s.addEventListener('change', e => { const t = e.target; if (t.matches && t.matches('.ag-chat .ag-ck')) { const row = t.closest('.ag-task'); A.setDone(row.dataset.id, row.dataset.d, t.checked); } });
        E().on(type => { if (type === 'data') refreshCards(); });
    }

    /* ── ações públicas ───────────────────────────────────────────────────── */
    function mostrar(spec) { wire(); const c = novoCartao(spec); colocar(c); return c; }
    const mostrarDia = d => mostrar({ kind: 'dia', date: d || A.today() });
    const mostrarHoje = () => mostrar({ kind: 'dia', date: A.today() });
    function criar(texto) {
        const r = A.parseQuick(texto, {});
        if (!r.title) { appendMessage('ai', '🗓️ Escreva o que precisa lembrar. Exemplo: <b>tarefa: ligar para o cliente amanhã 14h @João</b>'); return; }
        const t = E().createTask({ title: r.title, date: r.date || '', time: r.time, owner: r.owner, prio: r.prio || 'med', tags: r.tags, remind: 0 });
        const quando = t.date ? `${A.fmtCurto(t.date)}${t.time ? ' às ' + A.fmtTempo(t.time) : ''}` : 'sem data (aparece em “Sem data” na Lista)';
        const msg = appendMessage('system', `🗓️ Anotei na sua agenda: <b>${esc(t.title)}</b> — ${esc(quando)}${t.owner ? ' · ' + esc(t.owner) : ''}. <a href="#" data-ag="undo" style="font-weight:800">Desfazer</a> · <a href="#" data-ag="open" style="font-weight:800">Abrir</a>`);
        msg.addEventListener('click', ev => {
            const a = ev.target.closest('[data-ag]'); if (!a) return; ev.preventDefault();
            if (a.dataset.ag === 'undo') { E().removeTask(t.id); msg.innerHTML = '🗓️ Tarefa desfeita.'; }
            else Agenda.abrir({ date: t.date || A.today(), edit: t.id, beside: true });
        });
    }
    /* Chamado pelo handleChat: devolve true se a frase era da agenda (e já foi respondida aqui). */
    function tratar(texto) {
        try {
            if (typeof IS_PIP !== 'undefined' && IS_PIP) return false;
            if ((Prefs.get('hidden') || []).includes('agenda')) return false;   // usuário ocultou a Agenda: ela não interfere no chat
            const it = interpretar(texto); if (!it) return false;
            wire();
            const input = document.getElementById('searchInput'); if (input) input.value = '';
            const w = document.getElementById('welcomeMsg'); if (w) w.remove();
            appendMessage('user', esc(texto));
            if (it.tipo === 'criar') criar(it.texto);
            else if (it.tipo === 'abrir') { if (Agenda.abrir({ date: A.today(), view: it.view })) appendMessage('system', '📅 Abri a <b>Agenda</b> em uma aba. Quando terminar, volte pela aba <b>Chat</b> — a conversa continua aqui.'); }
            else mostrar(it.spec);
            return true;
        } catch (e) { console.warn('[agenda] chat', e); return false; }
    }
    return { interpretar, tratar, mostrar, mostrarDia, mostrarHoje, criar, refreshCards };
})();
V.AgendaChat = Agenda.Chat;
