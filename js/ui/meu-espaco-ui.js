/* js/ui/meu-espaco-ui.js — Meu Espaço: interface de notas. */
'use strict';
/* ═══ Meu Espaço — interface ═════════════════════════════════════════════════ */
// Markdown simplificado: o texto da nota é sempre escapado antes (nada de HTML da nota chega ao DOM).
function mdLite(src) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    const inl = s => esc(s)
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/(^|[^*\w])_([^_\n]+)_(?!\w)/g, '$1<i>$2</i>')
        .replace(/(^|[^*])\*([^*\s][^*\n]*)\*/g, '$1<i>$2</i>')
        .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
    const out = []; let i = 0, list = null;
    const endList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    while (i < lines.length) {
        const ln = lines[i]; let m;
        if (/^```/.test(ln)) { endList(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
        if ((m = /^(#{1,3})\s+(.*)$/.exec(ln))) { endList(); out.push(`<h${m[1].length + 1}>${inl(m[2])}</h${m[1].length + 1}>`); }
        else if (/^\s*(---|\*\*\*)\s*$/.test(ln)) { endList(); out.push('<hr>'); }
        else if ((m = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/.exec(ln))) { if (list !== 'ul') { endList(); out.push('<ul>'); list = 'ul'; } const on = m[1] !== ' '; out.push(`<li class="task${on ? ' done' : ''}"><input type="checkbox" data-line="${i}"${on ? ' checked' : ''}><span>${inl(m[2])}</span></li>`); }
        else if ((m = /^\s*[-*]\s+(.*)$/.exec(ln))) { if (list !== 'ul') { endList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inl(m[1])}</li>`); }
        else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))) { if (list !== 'ol') { endList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inl(m[1])}</li>`); }
        else if ((m = /^>\s?(.*)$/.exec(ln))) { endList(); out.push(`<blockquote>${inl(m[1])}</blockquote>`); }
        else if (!ln.trim()) { endList(); out.push('<div class="gap"></div>'); }
        else { endList(); out.push(`<p>${inl(ln)}</p>`); }
        i++;
    }
    endList();
    return out.join('');
}

const Space = (() => {
    const E = () => MeuEspaco;
    const COLORS = { '': ['Sem cor', '#a8a29e'], amber: ['Âmbar', '#f59e0b'], rose: ['Rosa', '#f43f5e'], sky: ['Azul', '#0ea5e9'], emerald: ['Verde', '#10b981'], violet: ['Violeta', '#8b5cf6'] };
    const TPL = {
        blank: { title: '', body: '' },
        check: { title: 'Checklist', body: '- [ ] \n- [ ] \n- [ ] ', tags: ['checklist'] },
        steps: { title: 'Passo a passo', body: '1. \n2. \n3. ', tags: ['procedimento'] },
        atend: { title: 'Atendimento — ', body: '**Cliente:** \n**Chamado/protocolo:** \n\n**Problema**\n\n\n**O que foi feito**\n\n\n**Observações**\n', tags: ['atendimento'] },
    };
    let pane = null, built = false, sel = null, q = '', filter = 'todas', mode = 'edit', stamp = 0, pop = null;
    let nagDismissed = lsGet('bsoft_v27_sp_nag', '') === '1';
    const note = () => (sel ? E().byId(sel) : null);

    function build() {
        if (built) return;
        pane = document.getElementById('paneSpace'); if (!pane) return;
        built = true;
        pane.innerHTML = `<div class="sp">
            <div class="sp-head">
                <div class="sp-title"><span class="sp-logo">${icon('note', 20)}</span><div><h2>Meu Espaço</h2><p>Suas anotações pessoais</p></div></div>
                <div class="sp-head-end">
                    <button class="sp-agbtn" id="spAgBtn" type="button" title="Abrir a Agenda (tarefas, cronograma e lembretes) em uma aba própria">${icon('calendar', 14)}<span>Agenda</span><i class="sp-seg-n" id="spAgN"></i></button>
                    <span class="sp-priv" title="Suas anotações e tarefas ficam numa pasta do seu computador. O sistema não envia nada para a internet, para o banco de dados da empresa nem para a IA.">${icon('lock', 13)}Só no seu computador</span>
                    <button class="sp-store" id="spStore" type="button"><i class="sp-dot"></i><span id="spStoreTx">…</span></button>
                </div>
            </div>
            <div class="sp-banner" id="spBanner" hidden></div>
            <div class="sp-body" id="spBody">
                <aside class="sp-list">
                    <div class="sp-tools">
                        <label class="sp-search">${icon('search', 15)}<input id="spQ" type="search" placeholder="Buscar nas notas…" autocomplete="off" spellcheck="false" aria-label="Buscar nas notas"></label>
                        <button class="sp-new" id="spNew" type="button">${icon('plus', 16, 2.4)}<span>Nova nota</span></button>
                    </div>
                    <div class="sp-chips" id="spChips"></div>
                    <div class="sp-items" id="spItems"></div>
                </aside>
                <section class="sp-editor" id="spEd"></section>
            </div>
        </div>`;
        $('#spQ').addEventListener('input', e => { q = e.target.value; renderList(); });
        $('#spQ').addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.target.value = ''; q = ''; renderList(); }
            else if (e.key === 'Enter') { const f = $('.sp-item', pane); if (f) select(f.dataset.id); }
        });
        $('#spNew').addEventListener('click', () => newNote());
        $('#spChips').addEventListener('click', e => { const c = e.target.closest('.sp-chip'); if (!c) return; filter = c.dataset.f; renderChips(); renderList(); });
        $('#spItems').addEventListener('click', e => { const it = e.target.closest('.sp-item'); if (it) select(it.dataset.id); });
        $('#spStore').addEventListener('click', e => storeMenu(e.currentTarget));
        $('#spBanner').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) bannerAction(b.dataset.a); });
        $('#spAgBtn').addEventListener('click', () => { if (V.Agenda && V.Agenda.abrir) V.Agenda.abrir({ date: V.Agenda.today() }); });
        const ed = $('#spEd');
        ed.addEventListener('click', onEditorClick); ed.addEventListener('input', onEditorInput);
        ed.addEventListener('keydown', onEditorKey); ed.addEventListener('change', onEditorChange);
        ed.addEventListener('focusout', e => { if (e.target.id === 'spTagIn') commitTag(e.target); });
        E().on(onStore);
    }

    /* ── ligação com a Agenda (aba própria: js/ui/agenda-aba.js) ─────────── */
    function renderAgBadge() {
        const n = $('#spAgN'); if (!n || !V.Agenda) return;
        const c = V.Agenda.counts().open; n.textContent = c > 0 ? (c > 9 ? '9+' : String(c)) : '';
        n.title = c > 0 ? `${c} tarefa(s) pedindo atenção (atrasadas ou de hoje)` : '';
    }
    // a aba da Agenda mostra o mesmo estado da pasta e o mesmo aviso: eles saem daqui para os dois lugares ficarem iguais
    function statusInfo() {
        const i = E().info();
        const map = {
            conectado: ['ok', i.saving ? 'Salvando…' : `Salvo na pasta “${i.folder}”`, 'Suas anotações e tarefas estão sendo gravadas na pasta escolhida. Clique para ver as opções.'],
            permissao: ['warn', 'Reconectar a pasta', 'O navegador precisa da sua permissão para voltar a usar a pasta.'],
            erro: ['err', 'Pasta com problema', i.lastErr || 'Não foi possível gravar na pasta.'],
            'sem-pasta': ['warn', 'Só neste navegador', 'Escolha uma pasta para não perder suas notas e tarefas.'],
            'sem-suporte': ['warn', 'Só neste navegador', 'Este navegador não permite escolher uma pasta (use Chrome ou Edge).'],
            init: ['warn', 'Carregando…', ''],
        };
        const m = map[i.status] || map.init;
        return { cls: m[0], text: m[1], title: m[2] };
    }
    const tellAgendaTab = () => { try { if (V.AgendaTab) V.AgendaTab.renderStatus(); } catch (e) { /* aba ainda não montada */ } };

    /* ── renderização ───────────────────────────────────────────────────── */
    function renderAll() { renderStatus(); renderChips(); renderList(); renderEditor(); renderAgBadge(); tellAgendaTab(); }
    function renderStatus() {
        if (!built) return;
        const m = statusInfo(), chip = $('#spStore'), tx = $('#spStoreTx');
        chip.className = 'sp-store is-' + m.cls; tx.textContent = m.text; chip.title = m.title;
        renderBanner(); renderSaved();
    }
    function renderBanner() {
        if (!built) return;
        const b = $('#spBanner'), h = bannerHtml();
        b.innerHTML = h; b.hidden = !h;
    }
    function bannerHtml() {
        const i = E().info(); let h = '';
        const box = (cls, ic, title, text, btns) => `<div class="spb ${cls}"><span class="spb-ic">${icon(ic, 20)}</span><div class="spb-tx"><b>${title}</b><p>${text}</p></div><div class="spb-bt">${btns}</div></div>`;
        const btn = (a, label, cls = '') => `<button class="spb-btn ${cls}" data-a="${a}" type="button">${label}</button>`;
        if (i.status === 'sem-pasta') {
            h = nagDismissed
                ? box('spb-soft', 'alert', 'Suas notas e tarefas estão só neste navegador.', 'Se você limpar os dados do navegador ou trocar de navegador, elas se perdem.', btn('choose', 'Escolher pasta', 'primary'))
                : box('spb-info', 'folder', 'Escolha onde guardar suas anotações e tarefas',
                    'Crie (ou escolha) uma pasta no seu computador — por exemplo <code>Documentos\\Bsoft - Meu Espaço</code>. Assim suas notas e tarefas ficam seguras mesmo se você limpar o navegador, trocar de navegador ou o PC passar por uma limpeza. Já usava o Meu Espaço? Escolha a mesma pasta de antes e tudo volta.',
                    btn('choose', 'Escolher pasta', 'primary') + btn('later', 'Depois'));
        } else if (i.status === 'permissao') h = box('spb-soft', 'lock', `Falta um clique para voltar à pasta “${esc(i.folder)}”`, 'Por segurança o navegador pede sua permissão de novo de vez em quando. Suas notas estão intactas.', btn('reconnect', 'Reconectar', 'primary') + btn('choose', 'Escolher outra pasta'));
        else if (i.status === 'erro') h = box('spb-err', 'alert', 'Não deu para gravar na pasta', esc(i.lastErr || 'Erro desconhecido.') + ' Suas notas continuam salvas neste navegador.', btn('reconnect', 'Tentar de novo', 'primary') + btn('choose', 'Escolher outra pasta') + btn('export', 'Exportar backup'));
        else if (i.status === 'sem-suporte') h = window.isSecureContext === false
            ? box('spb-soft', 'alert', 'Esta página não está em conexão segura', 'O navegador só deixa escolher uma pasta em páginas https (ou abertas direto do computador). Enquanto isso suas notas ficam só neste navegador — exporte um backup de vez em quando.', btn('export', 'Exportar backup', 'primary'))
            : box('spb-soft', 'alert', 'Este navegador não consegue gravar numa pasta', 'Use o Google Chrome ou o Microsoft Edge para guardar numa pasta. Enquanto isso suas notas ficam só neste navegador — exporte um backup de vez em quando.', btn('export', 'Exportar backup', 'primary'));
        if (i.cacheFail && i.status !== 'conectado') h += box('spb-err', 'alert', 'O armazenamento do navegador está cheio', 'Escolha uma pasta ou exporte um backup agora para não perder as últimas alterações.', btn('export', 'Exportar backup', 'primary'));
        return h;
    }
    function renderSaved() {
        const s = $('#spSaved'); if (!s) return; const i = E().info();
        if (i.saving) { s.className = 'sp-saved is-saving'; s.textContent = 'Salvando…'; }
        else if (i.status === 'conectado') { s.className = 'sp-saved'; s.innerHTML = `${icon('check', 13, 2.6)}Salvo na pasta${i.lastSaved ? ' às ' + fmtHora(i.lastSaved) : ''}`; }
        else { s.className = 'sp-saved is-warn'; s.innerHTML = `${icon('alert', 13)}Salvo só neste navegador`; }
    }
    function renderChips() {
        const all = E().notes(), tr = E().trashed(), tags = {};
        all.forEach(n => (n.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
        if (filter.startsWith('#') && !tags[filter.slice(1)]) filter = 'todas';
        if (filter === 'lixeira' && !tr.length) filter = 'todas';
        const top = Object.keys(tags).sort((a, b) => tags[b] - tags[a] || a.localeCompare(b)).slice(0, 8);
        const chip = (f, label, n) => `<button class="sp-chip${filter === f ? ' is-on' : ''}" data-f="${esc(f)}" type="button">${label}<i>${n}</i></button>`;
        $('#spChips').innerHTML = chip('todas', 'Todas', all.length) + chip('fixadas', `${icon('star', 12)}Fixadas`, all.filter(n => n.pinned).length)
            + top.map(t => chip('#' + t, '#' + esc(t), tags[t])).join('') + (tr.length ? chip('lixeira', `${icon('trash', 12)}Lixeira`, tr.length) : '');
    }
    function visibleNotes() {
        let list = filter === 'lixeira' ? E().trashed() : E().notes();
        if (filter === 'fixadas') list = list.filter(n => n.pinned);
        else if (filter.startsWith('#')) list = list.filter(n => (n.tags || []).includes(filter.slice(1)));
        if (q.trim()) list = list.filter(n => E().matches(q, n));
        return list.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
    }
    function rowHtml(n) {
        const snip = (n.body || '').replace(/[#*_`>\[\]]/g, ' ').replace(/^\s*-\s/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 110);
        const tags = (n.tags || []).slice(0, 3).map(t => `<span class="si-tag">#${esc(t)}</span>`).join('');
        return `<button class="sp-item${n.id === sel ? ' is-sel' : ''}${n.deleted ? ' is-trash' : ''}" data-id="${esc(n.id)}" style="--nc:${(COLORS[n.color] || COLORS[''])[1]}" type="button"><span class="si-bar"></span><span class="si-main"><span class="si-top"><b>${esc(n.title || 'Sem título')}</b>${n.pinned ? `<span class="si-pin">${icon('star', 12)}</span>` : ''}</span><span class="si-snip">${snip ? esc(snip) : '<em>Nota vazia</em>'}</span><span class="si-meta">${tags}<span class="si-date">${fmtDataCurta(n.updated || n.created)}</span></span></span></button>`;
    }
    function renderList() {
        if (!built) return;
        const list = visibleNotes(), host = $('#spItems');
        host.innerHTML = list.length ? list.map(rowHtml).join('')
            : `<div class="sp-none">${q ? `Nenhuma nota com “${esc(q)}”.` : filter === 'lixeira' ? 'A lixeira está vazia.' : 'Nenhuma anotação aqui ainda.'}</div>`;
    }
    function touchRow(n) { const row = $(`.sp-item[data-id="${CSS.escape(n.id)}"]`, pane); if (row) row.outerHTML = rowHtml(n); }
    const emptyHtml = () => `<div class="sp-empty"><div class="sp-ill">${icon('note', 34)}</div><h3>${E().notes().length ? 'Escolha uma nota para ler ou editar' : 'Comece sua primeira anotação'}</h3><p>Escreva livremente, monte checklists e guarde respostas da IA. Tudo fica só no seu computador.</p><div class="sp-tpls">${[['blank', 'edit', 'Nota em branco'], ['check', 'checksq', 'Checklist'], ['steps', 'list', 'Passo a passo'], ['atend', 'chat', 'Registro de atendimento']].map(([k, ic, l]) => `<button type="button" data-tpl="${k}">${icon(ic, 16)}<span>${l}</span></button>`).join('')}</div></div>`;
    const tagsHtml = (n, ro) => (n.tags || []).map(t => `<span class="sp-tag">#${esc(t)}${ro ? '' : `<button class="sp-tag-x" data-a="tag-x" data-t="${esc(t)}" type="button" aria-label="Remover etiqueta ${esc(t)}">${icon('x', 11, 2.6)}</button>`}</span>`).join('')
        + (ro ? '' : `<input class="sp-tag-in" id="spTagIn" placeholder="${(n.tags || []).length ? '+ etiqueta' : '+ Adicionar etiqueta'}" maxlength="24" autocomplete="off" aria-label="Nova etiqueta">`);
    function renderEditor() {
        if (!built) return;
        const ed = $('#spEd'), n = note();
        if (!n || n.purged) { sel = null; ed.innerHTML = emptyHtml(); $('#spBody').classList.remove('is-editing'); return; }
        stamp = n.updated; const trash = !!n.deleted;
        ed.style.setProperty('--nc', (COLORS[n.color] || COLORS[''])[1]);
        ed.innerHTML = `<div class="sp-ed-top">
            <button class="sp-back" data-a="back" type="button" title="Voltar para a lista" aria-label="Voltar para a lista">${icon('arrowL', 17)}</button>
            <input class="sp-title-in" id="spTitle" placeholder="Título da nota" maxlength="140" ${trash ? 'readonly' : ''} aria-label="Título da nota">
            <div class="sp-acts">${trash
                ? `<button class="sp-act" data-a="restore" type="button">${icon('undo', 15)}<span>Restaurar</span></button><button class="sp-act danger" data-a="purge" type="button">${icon('trash', 15)}<span>Excluir de vez</span></button>`
                : `<button class="sp-act${n.pinned ? ' is-on' : ''}" data-a="pin" type="button" title="${n.pinned ? 'Desafixar' : 'Fixar no topo'}" aria-label="Fixar">${icon('star', 16)}</button>
                   <button class="sp-act" data-a="color" type="button" title="Cor da nota" aria-label="Cor da nota"><i class="sp-swatch"></i></button>
                   <button class="sp-act${mode === 'view' ? ' is-on' : ''}" data-a="mode" type="button" title="${mode === 'view' ? 'Voltar a editar' : 'Ver formatado (checklists clicáveis)'}" aria-label="Alternar visualização">${icon(mode === 'view' ? 'edit' : 'eye', 16)}</button>
                   <button class="sp-act" data-a="copy" type="button" title="Copiar o texto" aria-label="Copiar">${icon('copy', 16)}</button>
                   <button class="sp-act" data-a="chat" type="button" title="Colocar no campo do chat (só vai para a IA se você enviar)" aria-label="Usar no chat">${icon('chat', 16)}</button>
                   <button class="sp-act danger" data-a="del" type="button" title="Mover para a lixeira" aria-label="Excluir">${icon('trash', 16)}</button>`}</div></div>
            ${trash ? `<div class="sp-trash-note">${icon('trash', 14)}Esta nota está na lixeira e some de vez em 30 dias.</div>` : ''}
            <div class="sp-tags" id="spTags">${tagsHtml(n, trash)}</div>
            <div class="sp-text-wrap">${mode === 'view' || trash ? `<div class="sp-view" id="spView">${mdLite(n.body) || '<p class="muted">Nota vazia.</p>'}</div>` : '<textarea class="sp-text" id="spText" placeholder="Escreva aqui…  (- [ ] vira checklist · # vira título)" spellcheck="true"></textarea>'}</div>
            <div class="sp-ed-foot"><span class="sp-saved" id="spSaved"></span><span id="spCount"></span><span class="sp-dates">criada ${fmtDataCurta(n.created)} · alterada ${fmtDataCurta(n.updated)}</span></div>`;
        $('#spTitle').value = n.title || '';
        const ta = $('#spText'); if (ta) ta.value = n.body || '';
        $('#spBody').classList.add('is-editing');
        renderSaved(); renderCount(n);
    }
    function renderCount(n) { const c = $('#spCount'); if (c) { const w = (n.body || '').trim().split(/\s+/).filter(Boolean).length; c.textContent = w + (w === 1 ? ' palavra' : ' palavras'); } }

    /* ── ações ──────────────────────────────────────────────────────────── */
    function select(id) { sel = id; renderList(); renderEditor(); }
    function openNote(id, o) {
        sel = id; filter = E().byId(id) && E().byId(id).deleted ? 'lixeira' : 'todas'; q = '';
        Workspace.open('space', o); build(); const qi = $('#spQ'); if (qi) qi.value = '';
        renderAll();
    }
    function newNote(key) {
        const t = TPL[key || 'blank'] || TPL.blank;
        const n = E().create({ title: t.title, body: t.body, tags: (t.tags || []).slice() });
        sel = n.id; filter = 'todas'; q = ''; mode = 'edit';
        Workspace.open('space'); build(); const qi = $('#spQ'); if (qi) qi.value = '';
        renderAll();
        setTimeout(() => { const e = $('#spTitle'); if (e) { e.focus(); e.select(); } }, 80);
        return n;
    }
    // Escolher / reconectar / importar servem ao Meu Espaço e à aba da Agenda. Com `stay` o usuário continua na aba em que está.
    async function chooseFolder(o = {}) {
        if (!o.stay) { Workspace.open('space'); build(); }
        try {
            const r = await E().chooseFolder();
            if (r) {
                const name = E().info().folder;
                if (r.corrupt) Toast.show(`O arquivo de dados da pasta “${name}” estava ilegível. Guardei uma cópia dele em “backups” e comecei um novo.`, { kind: 'warn', ms: 9000 });
                else if (r.found) Toast.show(`Encontrei ${r.diskCount} nota(s) na pasta “${name}” e juntei com as deste navegador.`, { kind: 'ok', icon: 'folder', ms: 7000 });
                else Toast.show(`Pronto! Suas anotações e tarefas agora ficam na pasta “${name}”.`, { kind: 'ok', icon: 'folder', ms: 6000 });
            }
        } catch (e) { Toast.show('Não consegui usar essa pasta: ' + (e.message || e), { kind: 'err', ms: 8000 }); }
        renderAll();
    }
    async function reconnect() {
        try { const r = await E().reconnect(); if (r) Toast.show(`Pasta “${E().info().folder}” reconectada.`, { kind: 'ok', icon: 'folder' }); }
        catch (e) { Toast.show('Não consegui reconectar: ' + (e.message || e), { kind: 'err' }); }
        renderAll();
    }
    // clique nos botões do aviso da pasta (o mesmo aviso aparece no Meu Espaço e na Agenda)
    function bannerAction(a) {
        if (a === 'choose') chooseFolder({ stay: !!(V.AgendaTab && V.AgendaTab.visible()) });   // vindo da Agenda, não pula para a aba do Meu Espaço
        else if (a === 'reconnect') reconnect();
        else if (a === 'export') E().exportFile();
        else if (a === 'later') { nagDismissed = true; lsSet('bsoft_v27_sp_nag', '1'); renderBanner(); tellAgendaTab(); }
    }
    async function onImport(e) {
        const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
        try { const r = await E().importFile(f); Toast.show(`Backup importado: ${r.added} nota(s) nova(s) (de ${r.total} no arquivo)${r.tasksTotal ? ` e ${r.tasksAdded} tarefa(s) nova(s) (de ${r.tasksTotal})` : ''}.`, { kind: 'ok', icon: 'upload' }); }
        catch (err) { Toast.show('Não foi possível importar: ' + (err.message || err), { kind: 'err', ms: 7000 }); }
        renderAll();
    }
    // o seletor de arquivo do "Importar backup" é criado uma vez só, fora das abas (serve ao Meu Espaço, à Agenda e ao Personalizar)
    function pickImport() {
        let f = document.getElementById('spImport');
        if (!f) { f = el('input', '', 'spImport'); f.type = 'file'; f.accept = '.json,application/json'; f.hidden = true; f.addEventListener('change', onImport); document.body.appendChild(f); }
        f.click();
    }
    function storeMenu(anchor) {
        const r = (anchor || $('#spStore')).getBoundingClientRect(), i = E().info(), stay = !!(V.AgendaTab && V.AgendaTab.visible());
        const items = [{ label: i.status === 'conectado' ? 'Trocar a pasta dos dados…' : 'Escolher a pasta dos dados…', icon: 'folder', fn: () => chooseFolder({ stay }) }];
        if (i.status === 'permissao') items.unshift({ label: 'Reconectar a pasta', icon: 'refresh', fn: reconnect });
        items.push({ label: 'Exportar backup (.json)', icon: 'download', fn: () => E().exportFile() }, { label: 'Importar backup…', icon: 'upload', fn: pickImport });
        if (i.status === 'conectado' || i.status === 'permissao' || i.status === 'erro') items.push({ sep: true }, { label: 'Esquecer a pasta neste navegador', icon: 'x', fn: async () => { await E().forget(); Toast.show('A pasta foi desvinculada deste navegador. Os arquivos continuam lá.', { ms: 6000 }); renderAll(); } });
        Ctx.open(r.right - 230, r.bottom + 8, items);
    }
    function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', popOff, true); } }
    const popOff = e => { if (pop && !pop.contains(e.target)) closePop(); };
    function colorPop(btn) {
        closePop(); const n = note(); if (!n) return;
        pop = el('div', 'sp-pop pop-card');
        pop.innerHTML = Object.keys(COLORS).map(k => `<button type="button" class="sp-sw${(n.color || '') === k ? ' is-on' : ''}" data-c="${k}" title="${COLORS[k][0]}" aria-label="${COLORS[k][0]}" style="--sw:${COLORS[k][1]}"></button>`).join('');
        document.body.appendChild(pop);
        const r = btn.getBoundingClientRect();
        pop.style.top = (r.bottom + 8) + 'px'; pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px';
        pop.addEventListener('click', ev => { const b = ev.target.closest('.sp-sw'); if (!b) return; E().update(sel, { color: b.dataset.c }); closePop(); renderEditor(); });
        setTimeout(() => document.addEventListener('mousedown', popOff, true), 0);
    }
    function commitTag(input) {
        const n = note(); if (!n || !input) return;
        const raw = input.value.replace(/[#,;]+/g, ' ').split(/\s+/).map(t => t.trim().toLowerCase().slice(0, 24)).filter(Boolean);
        if (!raw.length) return;
        const tags = Array.from(new Set([...(n.tags || []), ...raw])).slice(0, 12);
        E().update(sel, { tags }, { quiet: true }); input.value = '';
        $('#spTags').innerHTML = tagsHtml(E().byId(sel), false); renderChips();
        const ni = $('#spTagIn'); if (ni && document.activeElement !== ni) { /* mantém o foco fora quando veio de blur */ }
    }
    function afterDelete(id) {
        const next = visibleNotes().find(n => n.id !== id);
        sel = next ? next.id : null; renderChips(); renderList(); renderEditor();
    }
    function onEditorClick(e) {
        const tpl = e.target.closest('[data-tpl]'); if (tpl) { newNote(tpl.dataset.tpl); return; }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const n = note(), a = b.dataset.a; if (!n) return;
        if (a === 'back') { $('#spBody').classList.remove('is-editing'); }
        else if (a === 'pin') { E().update(sel, { pinned: !n.pinned }); b.classList.toggle('is-on', !n.pinned); }
        else if (a === 'color') colorPop(b);
        else if (a === 'mode') { mode = mode === 'view' ? 'edit' : 'view'; renderEditor(); }
        else if (a === 'copy') { copyText(`${n.title ? n.title + '\n\n' : ''}${n.body}`); }
        else if (a === 'chat') toChat(n);
        else if (a === 'del') { const id = sel; E().remove(id); afterDelete(id); Toast.show('Nota movida para a lixeira.', { icon: 'trash', ms: 6000, action: { label: 'Desfazer', fn: () => { E().restore(id); sel = id; filter = 'todas'; renderAll(); } } }); }
        else if (a === 'restore') { E().restore(sel); filter = 'todas'; renderAll(); Toast.show('Nota restaurada.', { kind: 'ok' }); }
        else if (a === 'purge') { if (confirm('Excluir esta nota de vez? Não dá para desfazer.')) { const id = sel; E().purge(id); afterDelete(id); } }
        else if (a === 'tag-x') { E().update(sel, { tags: (n.tags || []).filter(t => t !== b.dataset.t) }, { quiet: true }); $('#spTags').innerHTML = tagsHtml(E().byId(sel), false); renderChips(); touchRow(E().byId(sel)); }
    }
    function copyText(t) {
        const ok = () => Toast.show('Texto copiado.', { kind: 'ok', icon: 'copy', ms: 2400 });
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => Toast.show('Não consegui copiar.', { kind: 'err' }));
        else { const ta = el('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* sem permissão */ } ta.remove(); }
    }
    function toChat(n) {
        const text = `${n.title ? n.title + '\n' : ''}${n.body || ''}`.trim(); if (!text) return;
        Workspace.showChat();
        const i = $('#searchInput'); if (i) { i.value = text.slice(0, 1500); i.focus(); }
        Toast.show('Texto colocado no campo do chat. Ele só vai para a IA se você enviar.', { icon: 'chat', ms: 6500 });
    }
    function onEditorInput(e) {
        const n = note(); if (!n) return;
        if (e.target.id === 'spTitle') { E().update(sel, { title: e.target.value }, { quiet: true }); touchRow(E().byId(sel)); }
        else if (e.target.id === 'spText') { const u = E().update(sel, { body: e.target.value }, { quiet: true }); touchRow(u); renderCount(u); }
    }
    function onEditorChange(e) {
        const cb = e.target; if (!cb.matches || !cb.matches('input[type=checkbox][data-line]')) return;
        const n = note(); if (!n) return;
        const lines = (n.body || '').replace(/\r\n?/g, '\n').split('\n'), i = +cb.dataset.line;
        if (lines[i] != null) lines[i] = lines[i].replace(/\[( |x|X)\]/, cb.checked ? '[x]' : '[ ]');
        const u = E().update(sel, { body: lines.join('\n') }, { quiet: true });
        $('#spView').innerHTML = mdLite(u.body); touchRow(u);
    }
    function listEnter(e, ta) {
        if (ta.selectionStart !== ta.selectionEnd) return false;
        const v = ta.value, s = ta.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s);
        const m = /^(\s*)(- \[( |x|X)\] |[-*] |(\d+)([.)]) )(.*)$/.exec(line);
        if (!m) return false;
        e.preventDefault();
        if (!m[6].trim()) ta.setRangeText('', ls, s, 'end');   // item vazio: encerra a lista
        else ta.setRangeText('\n' + m[1] + (m[3] !== undefined ? '- [ ] ' : m[4] ? (+m[4] + 1) + m[5] + ' ' : m[2]), s, s, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }
    function onEditorKey(e) {
        const id = e.target.id;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); E().flush(); Toast.show('Salvo.', { kind: 'ok', ms: 1800 }); return; }
        if (id === 'spTagIn') {
            if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); commitTag(e.target); const ni = $('#spTagIn'); if (ni) ni.focus(); }
            else if (e.key === 'Backspace' && !e.target.value) { const n = note(); if (n && (n.tags || []).length) { E().update(sel, { tags: n.tags.slice(0, -1) }, { quiet: true }); $('#spTags').innerHTML = tagsHtml(E().byId(sel), false); renderChips(); const ni = $('#spTagIn'); if (ni) ni.focus(); } }
        } else if (id === 'spTitle' && e.key === 'Enter') { e.preventDefault(); const t = $('#spText'); if (t) t.focus(); }
        else if (id === 'spText' && e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) listEnter(e, e.target);
    }
    function onStore(type, arg) {
        if (type === 'status') renderStatus();
        else if (type === 'data') {
            renderAgBadge(); renderChips(); renderList();
            const n = note();
            if (sel && (!n || n.purged)) { sel = null; renderEditor(); }
            else if (arg === true && n && n.updated !== stamp) { renderEditor(); Toast.show('Esta nota foi atualizada em outra janela.', { icon: 'refresh', ms: 4500 }); }
        } else if (type === 'saving' || type === 'saved') { renderSaved(); const c = $('#spStoreTx'); if (c) renderStatus(); }
    }

    /* ── integrações ────────────────────────────────────────────────────── */
    function saveFromChat(card, btn, question) {
        const secs = $$('.answer-section', card);
        let text = secs.length ? secs.map(s => (s.innerText || '').trim()).filter(Boolean).join('\n\n') : (card.innerText || '').trim();
        const fa = card.querySelector('.feedback-area');
        if (!secs.length && fa) text = text.replace((fa.innerText || '').trim(), '').trim();
        text = text.replace(/\n{3,}/g, '\n\n').slice(0, 20000);
        const qq = (question || '').trim();
        const title = (qq || text.split('\n')[0] || 'Resposta da IA').slice(0, 80);
        const body = (qq ? `**Pergunta:** ${qq}\n\n` : '') + text + `\n\n— Guardado do chat em ${new Date().toLocaleString('pt-BR')}`;
        const n = E().create({ title, body, tags: ['chat'], color: 'amber' });
        btn.classList.add('is-saved'); const sp = btn.querySelector('span'); if (sp) sp.textContent = 'Guardado ✓';
        Toast.show('Resposta guardada no Meu Espaço.', { kind: 'ok', icon: 'note', action: { label: 'Abrir', fn: () => openNote(n.id, { beside: true }) }, ms: 6000 });
        if (built) { renderChips(); renderList(); }
    }
    function onShow() { build(); renderAll(); E().refresh(); }
    return { onShow, openNote, newNote, chooseFolder, reconnect, saveFromChat, renderAll, refreshBadge: renderAgBadge,
        // usados também pela aba da Agenda (mesma pasta de dados, mesmo aviso)
        statusInfo, bannerHtml, bannerAction, storeMenu, pickImport,
        get built() { return built; } };
})();
V.Space = window.Space = Space;
