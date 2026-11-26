/* js/ui/boot.js — Liga a interface (abas, paleta, Meu Espaço...). É o ÚLTIMO script carregado. */
'use strict';

function boot() {
    // Copilot (janela flutuante) e simulador do painel administrativo rodam este mesmo app dentro de um iframe:
    // tela enxuta, só o chat (sem abas, sem Meu Espaço).
    if (IS_PIP) return;
    Prefs.apply();
    Workspace.init();
    News.init(); Smart.init(); compactClock();
    MeuEspaco.on(() => Workspace.renderRail());   // bolinha "!" no atalho quando a pasta pede atenção
    MeuEspaco.init().catch(e => console.warn('[Meu Espaço]', e)).then(() => Agenda.Remind.start());   // quadro do dia + lembretes das tarefas (só com o sistema aberto; tudo local)
    const ready = () => {
        Workspace.ready();
        const novoV28 = !lsGet('bsoft_v28_welcomed');
        if (!novoV28 && !lsGet('bsoft_v281_welcomed')) {   // quem já usava a v28: avisa as novidades da 28.1 uma única vez
            lsSet('bsoft_v281_welcomed', '1');
            setTimeout(() => Toast.show('<b>Novidades:</b> aba <b>Agenda</b> (tarefas, cronograma e quadro de lembretes ao abrir o sistema) e as ferramentas — Sefaz, Regras, Relatórios e Parâmetros — agora abrem em abas.', { html: true, ms: 14000, icon: 'calendar', action: { label: 'Ver a agenda', fn: () => Agenda.abrir({ view: 'cal' }) } }), 3500);
        }
        if (novoV28) lsSet('bsoft_v281_welcomed', '1');
        if (!lsGet('bsoft_v28_welcomed')) {
            lsSet('bsoft_v28_welcomed', '1');
            setTimeout(() => Toast.show('<b>Nova versão v28.</b> Perguntas parecidas com as já aprovadas ganham resposta pronta — e se não for o que procurava, é só pedir para a IA pesquisar. Busca rápida em <kbd>Ctrl</kbd> <kbd>K</kbd>.', { html: true, ms: 10000, icon: 'sparkles', action: { label: 'Personalizar', fn: () => Personalizar.open() } }), 2500);
        }
    };
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', ready); else ready();
}
boot();
