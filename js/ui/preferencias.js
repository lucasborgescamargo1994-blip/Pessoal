/* js/ui/preferencias.js — Preferências do usuário (cor, fundo, abas). */
'use strict';
/* ── preferências (aparência, abas, comportamento) ───────────────────────── */
const Prefs = (() => {
    const KEY = 'bsoft_v27_prefs';
    // Atalhos da lateral que já vêm OCULTOS de fábrica (v28.5: Blog e Repositório não são relevantes no momento, e assim as demais opções cabem na lateral sem rolar).
    // A pessoa traz de volta em Ajustes › Ferramentas visíveis (e ainda os acha no Ctrl K). Quem já tem preferências salvas recebe esse padrão UMA vez (marcador railDefaults);
    // depois disso vale o que ela escolher, e "Restaurar padrões" volta a escondê-los. Mudou a lista? Some 1 em RAIL_DEFAULTS para a novidade chegar a todo mundo de novo.
    const HIDDEN_DEFAULT = ['blog', 'repo'], RAIL_DEFAULTS = 1;
    const base = () => ({ accent: null, accentRgb: null, bg: 'aurora', efeitos: 'completo', density: 'confortavel', startup: 'restore', sidebar: 'open',
        railOrder: 'fixa', railLabels: true, smartDock: true, rememberSide: true, hidden: HIDDEN_DEFAULT.slice(), railDefaults: RAIL_DEFAULTS, ws: null, usage: {}, newsSeen: 0, updated: 0,
        // Agenda: forma de ver (calendário/lista/cronograma), quadro ao abrir o sistema, avisos e início da semana
        agView: 'cal', agCrono: 28, agBoard: 'sempre', agToast: true, agNotify: false, agSound: false, agWeek: 'dom' });
    // Preferências antigas (sem o marcador railDefaults) ganham os atalhos ocultos de fábrica. Confere o objeto GUARDADO/recebido (o base() já traz o marcador) e mexe no `atual`.
    function migrar(guardadas, atual) {
        if ((guardadas.railDefaults || 0) >= RAIL_DEFAULTS) return false;
        const h = Array.isArray(atual.hidden) ? atual.hidden.slice() : [];
        HIDDEN_DEFAULT.forEach(id => { if (!h.includes(id)) h.push(id); });
        atual.hidden = h; atual.railDefaults = RAIL_DEFAULTS;
        return true;
    }
    let d = base(), migrouNaCarga = false;
    try {
        const guardadas = JSON.parse(lsGet(KEY, '{}') || '{}') || {};
        Object.assign(d, guardadas);
        if (Object.keys(guardadas).length) migrouNaCarga = migrar(guardadas, d);   // 1ª abertura sem nada guardado = usuário novo: já nasce com o padrão do base()
    } catch (e) { /* prefs corrompidas: segue com o padrão */ }
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
    if (migrouNaCarga) persist();   // grava já (o carimbo `updated` novo também faz a versão migrada vencer a cópia da pasta do Meu Espaço)
    return {
        get: k => d[k],
        all: () => d,
        set(patch, o) { Object.assign(d, patch); persist(); apply(); if (!(o && o.quiet)) emit(Object.keys(patch)); },
        setWs(ws) { d.ws = ws; persist(); },
        bump(id) { const u = d.usage[id] || { n: 0, t: 0 }; u.n++; u.t = Date.now(); d.usage[id] = u; persist(false); },
        adopt(remote) {
            if (!remote || typeof remote !== 'object' || (remote.updated || 0) <= (d.updated || 0)) return false;
            d = Object.assign(base(), remote);
            // cópia da pasta salva por uma versão antiga: aplica o padrão novo e devolve à pasta com um carimbo SEMPRE mais novo que o dela (relógios diferentes não desfazem a migração)
            if (migrar(remote, d)) { d.updated = Math.max(Date.now(), (remote.updated || 0) + 1); persist(false); } else persist(false, false);
            apply(); emit(['*']); return true;
        },
        reset() { const keep = { ws: d.ws, usage: d.usage, newsSeen: d.newsSeen }; d = Object.assign(base(), keep); persist(); apply(); emit(['*']); },
        on: fn => { subs.push(fn); }, apply,
    };
})();
V.Prefs = Prefs;
