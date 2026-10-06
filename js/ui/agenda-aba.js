/* js/ui/agenda-aba.js — A Agenda como ABA PRÓPRIA do workspace (ícone "Agenda" na lateral e na barra de abas).
   Cabeçalho + aviso da pasta de dados (o mesmo do Meu Espaço) + a agenda em si (agenda-ui.js).
   Os dados continuam na pasta local do Meu Espaço: nada vai para a rede. */
'use strict';
Agenda.Tab = (() => {
    let pane = null, built = false;

    function build() {
        if (built) return true;
        pane = document.getElementById('paneAgenda'); if (!pane) return false;
        built = true;
        pane.innerHTML = `<div class="sp sp-ag">
            <div class="sp-head">
                <div class="sp-title"><span class="sp-logo is-ag">${icon('calendar', 20)}</span><div><h2>Minha Agenda</h2><p>Tarefas, cronograma e lembretes</p></div></div>
                <div class="sp-head-end">
                    <button class="sp-agbtn" id="agNotes" type="button" title="Abrir o Meu Espaço (suas anotações)">${icon('note', 14)}<span>Notas</span></button>
                    <span class="sp-priv" title="Suas tarefas ficam numa pasta do seu computador. O sistema não envia nada para a internet, para o banco de dados da empresa nem para a IA.">${icon('lock', 13)}Só no seu computador</span>
                    <button class="sp-store" id="agStore" type="button"><i class="sp-dot"></i><span id="agStoreTx">…</span></button>
                </div>
            </div>
            <div class="sp-banner" id="agBanner" hidden></div>
            <section class="ag" id="agRoot" aria-label="Agenda"></section>
        </div>`;
        $('#agNotes').addEventListener('click', () => Workspace.open('space'));
        $('#agStore').addEventListener('click', e => { if (V.Space) V.Space.storeMenu(e.currentTarget); });
        $('#agBanner').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && V.Space) V.Space.bannerAction(b.dataset.a); });
        Agenda.UI.mount($('#agRoot'));
        MeuEspaco.on(t => { if (t === 'status' || t === 'saving' || t === 'saved') renderStatus(); });
        renderStatus();
        return true;
    }
    // estado da pasta de dados e aviso: vêm do Meu Espaço (V.Space), então os dois lugares sempre mostram a mesma coisa
    function renderStatus() {
        if (!built || !V.Space || !V.Space.statusInfo) return;
        const m = V.Space.statusInfo(), chip = $('#agStore'), tx = $('#agStoreTx');
        chip.className = 'sp-store is-' + m.cls; tx.textContent = m.text; chip.title = m.title;
        const b = $('#agBanner'), h = V.Space.bannerHtml();
        if (b.innerHTML !== h) b.innerHTML = h;
        b.hidden = !h;
    }
    const visible = () => built && Workspace.isVisible('agenda');
    function onShow() { if (!build()) return; renderStatus(); Agenda.UI.render(); }
    /* Abre (ou volta para) a aba da Agenda. o: { date, view: 'cal'|'list'|'crono', newTask: {...}, edit: id, beside } */
    function abrir(o = {}) {
        if (!Workspace.open('agenda', { beside: !!o.beside })) return false;
        build();
        const UI = Agenda.UI;
        UI.goto(o.date, o.view);
        if (o.newTask) UI.newTask(o.newTask); else if (o.edit) UI.editTask(o.edit);
        return true;
    }
    return { onShow, abrir, renderStatus, visible, get built() { return built; } };
})();
V.AgendaTab = Agenda.Tab;
Agenda.abrir = Agenda.Tab.abrir;
