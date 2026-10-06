/* js/core/util.js — Utilitários pequenos (seletores, escape de HTML, datas...). Usado pelo app e pela Área Administrativa. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, cls, id, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (id) n.id = id; if (html != null) n.innerHTML = html; return n; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const debounce = (fn, ms) => { let t; const w = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; w.flush = () => { clearTimeout(t); fn(); }; return w; };
const fmtHora = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDataCurta = ts => {
    const d = new Date(ts), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
    const mesmo = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (mesmo(d, hoje)) return 'hoje ' + fmtHora(ts);
    if (mesmo(d, ontem)) return 'ontem ' + fmtHora(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};
