/* js/ui/novidades-badge.js — Bolinha de novidades não lidas. */
'use strict';
/* ── novidades: bolinha de "não lido" ────────────────────────────────────── */
const News = (() => {
    let feed = null, toastedFor = 0;
    const items = () => $$('.news-item[data-created-at]', feed || document);
    const newest = () => items().reduce((m, n) => Math.max(m, +n.dataset.createdAt || 0), 0);
    const unseen = () => { const seen = Prefs.get('newsSeen') || 0; return seen ? items().filter(n => +n.dataset.createdAt > seen).length : 0; };
    function markSeen() {
        const n = newest();
        if (n && n > (Prefs.get('newsSeen') || 0)) Prefs.set({ newsSeen: n }, { quiet: true });
        Workspace.renderRail();
    }
    function onFeed() {
        const seen = Prefs.get('newsSeen') || 0, n = newest();
        if (!seen && n) Prefs.set({ newsSeen: n }, { quiet: true });          // 1º uso: não acende bolinha por novidade antiga
        else if (Workspace.isVisible('news')) markSeen();
        else if (unseen() > 0 && n > toastedFor) {
            toastedFor = n;
            const u = unseen();
            Toast.show(u === 1 ? 'Tem 1 novidade nova no sistema.' : `Tem ${u} novidades novas no sistema.`, { icon: 'bell', action: { label: 'Ver', fn: () => Workspace.open('news') }, ms: 7000 });
        }
        Workspace.renderRail();
    }
    function init() {
        // cada item guarda a data de criação: é com ela que se sabe o que ainda não foi visto
        wrap('_renderNovidadeItem', function (orig, args) {
            const node = orig.apply(this, args);
            try { const it = args[0]; if (it && it.created_at) node.dataset.createdAt = new Date(it.created_at).getTime(); } catch (e) { /* sem data */ }
            return node;
        });
        feed = document.getElementById('newsFeed');
        if (feed) new MutationObserver(onFeed).observe(feed, { childList: true });
    }
    V.badges = () => {
        const b = {}, u = unseen();
        if (u > 0 && !Workspace.isVisible('news')) b.news = u > 9 ? '9+' : u;
        if (V.MeuEspaco && V.MeuEspaco.attention && V.MeuEspaco.attention()) b.space = '!';
        if (V.Agenda && !Workspace.isVisible('agenda')) { const n = V.Agenda.counts().open; if (n > 0) b.agenda = n > 9 ? '9+' : n; }   // tarefas atrasadas + de hoje
        return b;
    };
    return { init, markSeen };
})();
V.News = News;
