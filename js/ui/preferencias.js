/* js/ui/preferencias.js — Preferências do usuário (cor, fundo, abas). */
'use strict';
/* ── preferências (aparência, abas, comportamento) ───────────────────────── */
const Prefs = (() => {
    const KEY = 'bsoft_v27_prefs';
    const base = () => ({ accent: null, accentRgb: null, bg: 'aurora', efeitos: 'completo', density: 'confortavel', startup: 'restore', sidebar: 'open',
        railOrder: 'fixa', railLabels: true, smartDock: true, rememberSide: true, hidden: [], ws: null, usage: {}, newsSeen: 0, updated: 0,
        // Agenda: forma de ver (calendário/lista/cronograma), quadro ao abrir o sistema, avisos e início da semana
        agView: 'cal', agCrono: 28, agBoard: 'sempre', agToast: true, agNotify: false, agSound: false, agWeek: 'dom' });
    let d = base();
    try { Object.assign(d, JSON.parse(lsGet(KEY, '{}') || '{}')); } catch (e) { /* prefs corrompidas: segue com o padrão */ }
    const subs = [];
    const emit = keys => subs.forEach(fn => { try { fn(keys); } catch (e) { console.warn('[v27] listener de prefs', e); } });
    const pushDisk = debounce(() => { try { V.MeuEspaco && V.MeuEspaco.setPrefs(d); } catch (e) { console.warn(e); } }, 450);
    function persist(touch, push) { if (touch !== false) d.updated = Date.now(); lsSet(KEY, JSON.stringify(d)); if (push !== false) pushDisk(); }
    function apply() {
        const h = document.documentElement;
        h.dataset.bg = d.bg || 'aurora'; h.dataset.efeitos = d.efeitos || 'completo'; h.dataset.density = d.density || 'confortavel';
        h.dataset.labels = d.railLabels === false ? 'off' : 'on';
        if (d.accent && d.accentRgb) { h.style.setProperty('--primary', d.accent); h.style.setProperty('--primary-rgb', String(d.accentRgb).replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); }
        else { h.style.removeProperty('--primary'); h.style.removeProperty('--primary-rgb'); }
    }
    return {
        get: k => d[k],
        all: () => d,
        set(patch, o) { Object.assign(d, patch); persist(); apply(); if (!(o && o.quiet)) emit(Object.keys(patch)); },
        setWs(ws) { d.ws = ws; persist(); },
        bump(id) { const u = d.usage[id] || { n: 0, t: 0 }; u.n++; u.t = Date.now(); d.usage[id] = u; persist(false); },
        adopt(remote) {
            if (!remote || typeof remote !== 'object' || (remote.updated || 0) <= (d.updated || 0)) return false;
            d = Object.assign(base(), remote); persist(false, false); apply(); emit(['*']); return true;
        },
        reset() { const keep = { ws: d.ws, usage: d.usage, newsSeen: d.newsSeen }; d = Object.assign(base(), keep); persist(); apply(); emit(['*']); },
        on: fn => { subs.push(fn); }, apply,
    };
})();
V.Prefs = Prefs;
