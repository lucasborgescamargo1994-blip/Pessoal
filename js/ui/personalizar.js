/* js/ui/personalizar.js — Painel Personalizar. */
'use strict';
/* ═══ Personalizar ═══════════════════════════════════════════════════════════ */
const Personalizar = (() => {
    const ACCENTS = [['Laranja Bsoft', null, null], ['Azul', '#2563eb', '37 99 235'], ['Violeta', '#7c3aed', '124 58 237'], ['Esmeralda', '#059669', '5 150 105'],
        ['Rosa', '#db2777', '219 39 119'], ['Ciano', '#0891b2', '8 145 178'], ['Grafite', '#475569', '71 85 105']];
    let root = null, shown = false, lastFocus = null;
    const seg = (k, opts, val) => `<div class="seg" role="radiogroup" data-k="${k}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${v === val}" class="${v === val ? 'is-on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const sw = (k, label, hint, val) => `<label class="sw-row"><span class="sw-tx"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" class="sw" data-k="${k}"${val ? ' checked' : ''}><i class="sw-ui"></i></label>`;
    const hexRgb = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const luminance = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };

    function html() {
        const p = Prefs.all(), hidden = p.hidden || [], m = MeuEspaco.info();
        const stMap = { conectado: ['ok', `Salvo na pasta “${esc(m.folder)}”`, `${m.count} nota(s) · ${m.tasks} tarefa(s) · ${m.trash} na lixeira`], permissao: ['warn', 'Falta reconectar a pasta', 'Abra o Meu Espaço e clique em Reconectar.'],
            erro: ['err', 'Problema na pasta', esc(m.lastErr || '')], 'sem-pasta': ['warn', 'Sem pasta escolhida', 'As notas e tarefas estão salvas só neste navegador.'], 'sem-suporte': ['warn', 'Navegador sem suporte a pasta', 'Use Chrome ou Edge para guardar numa pasta.'], init: ['warn', 'Carregando…', ''] };
        const st = stMap[m.status] || stMap.init;
        return `<div class="dr-head"><div><h2>Personalizar</h2><p>Deixe o sistema do seu jeito. Tudo é salvo na hora.</p></div><button class="dr-x" data-a="close" type="button" aria-label="Fechar">${icon('x', 17)}</button></div>
        <div class="dr-body">
          <section class="dr-sec"><h3>${icon('sparkles', 13)}Aparência</h3>
            <div class="dr-row"><span class="dr-lbl">Cor de destaque</span><div class="dr-swatches">${ACCENTS.map(([n, hex, rgb]) => `<button type="button" class="dr-sw${(p.accent || null) === hex ? ' is-on' : ''}" data-accent="${hex || ''}" data-rgb="${rgb || ''}" title="${n}" aria-label="${n}" style="--sw:${hex || '#f97316'}"></button>`).join('')}<label class="dr-custom" title="Escolher outra cor"><input type="color" id="drCustom" value="${p.accent || '#f97316'}" aria-label="Outra cor"></label></div></div>
            <div class="dr-row"><span class="dr-lbl">Fundo</span>${seg('bg', [['aurora', 'Aurora'], ['liso', 'Liso'], ['escuro', 'Escuro'], ['foto', 'Foto']], p.bg)}</div>
            <div class="dr-row"><span class="dr-lbl">Animações e vidro</span>${seg('efeitos', [['completo', 'Completas'], ['leve', 'Leves'], ['zero', 'Desligadas']], p.efeitos)}<small>“Leves” tira o efeito de vidro e deixa o sistema mais rápido em computadores simples. “Desligadas” remove todo o movimento.</small></div>
            <div class="dr-row"><span class="dr-lbl">Densidade</span>${seg('density', [['confortavel', 'Confortável'], ['compacta', 'Compacta']], p.density)}</div>
          </section>
          <section class="dr-sec"><h3>${icon('split', 13)}Abas e atalhos</h3>
            <div class="dr-row"><span class="dr-lbl">Ao abrir o sistema</span>${seg('startup', [['chat', 'Só o chat'], ['restore', 'Reabrir minhas abas'], ['space', 'Meu Espaço'], ['agenda', 'Agenda']], p.startup)}</div>
            <div class="dr-row"><span class="dr-lbl">Lista de conversas</span>${seg('sidebar', [['open', 'Aberta'], ['collapsed', 'Recolhida']], p.sidebar)}</div>
            <div class="dr-row"><span class="dr-lbl">Ordem dos atalhos na lateral</span>${seg('railOrder', [['fixa', 'Fixa'], ['uso', 'Mais usados primeiro']], p.railOrder)}</div>
            ${sw('railLabels', 'Mostrar o nome sob os ícones', '', p.railLabels !== false)}
            ${sw('rememberSide', 'Lembrar a tela lateral de cada conversa', 'Cada conversa guarda qual ferramenta estava aberta ao lado dela.', p.rememberSide !== false)}
            ${sw('smartDock', 'Sugestões inteligentes', 'Depois de uma resposta, sugere abrir o Manual, o CIOT, vídeos… quando fizer sentido.', p.smartDock !== false)}
            <div class="dr-row" style="margin-top:12px"><span class="dr-lbl">Ferramentas visíveis (lateral e botão “+”)</span><div class="dr-tools">${TOOL_ORDER.filter(id => id !== 'chat').map(id => `<button type="button" class="dr-tool${hidden.includes(id) ? '' : ' is-on'}" data-tool="${id}" style="--tool-c:${TOOLS[id].color}" aria-pressed="${!hidden.includes(id)}">${icon(TOOLS[id].icon, 14)}${esc(TOOLS[id].short)}</button>`).join('')}</div><small>Ferramentas ocultas continuam disponíveis em <b>Ctrl K</b>.</small></div>
          </section>
          <section class="dr-sec"><h3>${icon('calendar', 13)}Agenda e lembretes</h3>
            <div class="dr-row"><span class="dr-lbl">Quadro de lembretes ao abrir o sistema</span>${seg('agBoard', [['sempre', 'Sempre'], ['diaria', 'Uma vez por dia'], ['nunca', 'Nunca']], p.agBoard || 'sempre')}<small>O quadro mostra as tarefas atrasadas e as de hoje assim que o sistema abre.</small></div>
            ${sw('agToast', 'Avisar na hora da tarefa', 'Mostra um aviso no canto da tela quando chega o horário da tarefa (ou às 08:00, nas que não têm horário). Só funciona com o sistema aberto.', p.agToast !== false)}
            ${sw('agNotify', 'Também como notificação do navegador', 'Quando o sistema estiver em segundo plano. O navegador vai pedir a sua permissão.', !!p.agNotify)}
            ${sw('agSound', 'Tocar um som no lembrete', '', !!p.agSound)}
            <div class="dr-row"><span class="dr-lbl">A semana começa em</span>${seg('agWeek', [['dom', 'Domingo'], ['seg', 'Segunda']], p.agWeek || 'dom')}</div>
          </section>
          <section class="dr-sec"><h3>${icon('note', 13)}Meu Espaço — seus dados</h3>
            <div class="dr-card"><div class="dc-top"><span class="dc-ic">${icon('folder', 19)}</span><div><b>${st[1]}</b><small>${st[2]}</small></div></div>
              <div class="dr-btns"><button class="dr-btn primary" data-a="folder" type="button">${icon('folder', 14)}${m.status === 'conectado' ? 'Trocar a pasta' : 'Escolher a pasta'}</button><button class="dr-btn" data-a="export" type="button">${icon('download', 14)}Exportar backup</button><button class="dr-btn" data-a="import" type="button">${icon('upload', 14)}Importar</button></div></div>
            <div class="dr-priv">${icon('shield', 16)}<span><b>Privacidade:</b> suas anotações, tarefas e preferências ficam só no seu computador. Nada disso é enviado para a internet, para o banco de dados da empresa ou para a IA — nem o desenvolvedor do sistema consegue ver.</span></div>
            <small class="dr-tip">Dica: use uma pasta fixa como <b>Documentos\\Bsoft - Meu Espaço</b>. Se trocar de navegador, escolha a mesma pasta e tudo volta. Pastas dentro do OneDrive ganham backup na nuvem da sua própria conta; fora dele, ficam só neste computador.</small>
          </section>
        </div>
        <div class="dr-foot"><button class="dr-btn" data-a="reset" type="button">${icon('refresh', 14)}Restaurar padrões</button><button class="dr-btn primary" data-a="close" type="button">Concluir</button></div>`;
    }
    function build() {
        root = el('div', 'dr-overlay', 'drOverlay');
        root.innerHTML = '<aside class="drawer pop-card" role="dialog" aria-modal="true" aria-label="Personalizar o sistema" id="drawer"></aside>';
        document.body.appendChild(root);
        root.addEventListener('mousedown', e => { if (e.target === root) close(); });
        const dr = $('#drawer', root);
        dr.addEventListener('click', onClick);
        dr.addEventListener('change', onChange);
        dr.addEventListener('input', e => { if (e.target.id === 'drCustom') onCustom(e.target.value); });
        document.addEventListener('keydown', e => {
            if (!shown) return;
            if (e.key === 'Escape' && !Ctx.node) { e.preventDefault(); close(); return; }
            if (e.key === 'Tab') {   // mantém o foco dentro do painel enquanto ele está aberto
                const f = $$('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', dr).filter(n => n.offsetParent !== null && n.type !== 'file');
                if (!f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && (document.activeElement === first || !dr.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && (document.activeElement === last || !dr.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
            }
        });
        MeuEspaco.on(t => { if (shown && (t === 'status' || t === 'data')) render(); });
    }
    function render() { const dr = $('#drawer', root), top = $('.dr-body', dr) ? $('.dr-body', dr).scrollTop : 0; dr.innerHTML = html(); const b = $('.dr-body', dr); if (b) b.scrollTop = top; }
    function applySidebar(want) { const s = document.getElementById('sidebar'); if (!s || innerWidth <= 1000) return; const collapsed = s.classList.contains('collapsed'); if ((want === 'collapsed') !== collapsed) { try { toggleSidebar(); } catch (e) { /* ok */ } } }
    function onCustom(hex) {
        const rgb = hexRgb(hex); if (!rgb) return;
        if (luminance(rgb) > .62) { Toast.show('Essa cor é clara demais — os textos brancos dos botões ficariam ilegíveis. Escolha uma mais escura.', { kind: 'warn', ms: 5000 }); return; }
        Prefs.set({ accent: hex, accentRgb: rgb.join(' ') });
        $$('.dr-sw', root).forEach(b => b.classList.remove('is-on'));
    }
    function onClick(e) {
        const sw = e.target.closest('.dr-sw');
        if (sw) { Prefs.set({ accent: sw.dataset.accent || null, accentRgb: sw.dataset.rgb || null }); render(); return; }
        const sg = e.target.closest('.seg button');
        if (sg) {
            const k = sg.parentElement.dataset.k, v = sg.dataset.v;
            Prefs.set({ [k]: v });
            if (k === 'sidebar') applySidebar(v);
            if (k === 'railOrder') Workspace.renderRail();
            if (k === 'agWeek' && V.Agenda.UI.mounted) V.Agenda.UI.render();
            render(); return;
        }
        const tl = e.target.closest('.dr-tool');
        if (tl) {
            const id = tl.dataset.tool, h = (Prefs.get('hidden') || []).slice(), i = h.indexOf(id);
            if (i >= 0) h.splice(i, 1); else h.push(id);
            Prefs.set({ hidden: h }); Workspace.renderRail(); render(); return;
        }
        const a = e.target.closest('[data-a]'); if (!a) return;
        const act = a.dataset.a;
        if (act === 'close') close();
        else if (act === 'folder') { close(); Space.chooseFolder(); }
        else if (act === 'export') MeuEspaco.exportFile();
        else if (act === 'import') { close(); setTimeout(() => Space.pickImport(), 60); }
        else if (act === 'reset') { if (confirm('Voltar todas as preferências (cores, fundo, abas, atalhos) ao padrão?\n\nSuas anotações do Meu Espaço NÃO são afetadas.')) { Prefs.reset(); applySidebar('open'); Workspace.renderRail(); render(); Toast.show('Preferências restauradas.', { kind: 'ok' }); } }
    }
    function onChange(e) {
        const k = e.target.dataset && e.target.dataset.k; if (!k || e.target.type !== 'checkbox') return;
        Prefs.set({ [k]: e.target.checked });
        if (k === 'railLabels') Workspace.renderRail();
        if (k === 'smartDock') Smart.renderDock();
        if (k === 'agNotify' && e.target.checked) V.Agenda.Remind.allowNotifications().then(ok => { if (!ok) { Prefs.set({ agNotify: false }); render(); Toast.show('O navegador não liberou as notificações. Libere nas configurações do site (ícone de cadeado) e tente de novo.', { kind: 'warn', ms: 7000 }); } });
    }
    function open() {
        if (!root) build();
        lastFocus = document.activeElement; shown = true; render(); root.classList.add('is-on');
        setTimeout(() => { const b = $('.dr-x', root); if (b) b.focus(); }, 30);
    }
    function close() { if (!shown) return; shown = false; root.classList.remove('is-on'); if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* ok */ } }
    return { open, close, refresh: () => { if (shown) render(); }, get isOpen() { return shown; } };
})();
V.Personalizar = window.Personalizar = Personalizar;
// preferências que chegam depois (vindas da pasta do Meu Espaço): reaplica layout e atalhos
V.afterPrefs = () => { Workspace.reloadFromPrefs(); Workspace.renderRail(); Personalizar.refresh(); };
