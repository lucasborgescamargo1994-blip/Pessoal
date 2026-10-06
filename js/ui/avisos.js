/* js/ui/avisos.js — Avisos (toasts) e menu de contexto. */
'use strict';
/* ── avisos (toasts) ─────────────────────────────────────────────────────── */
const Toast = {
    show(msg, o = {}) {
        let box = $('#toasts');
        if (!box) { box = el('div', 'toasts', 'toasts'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
        const kind = o.kind || 'info', ms = o.ms == null ? 4200 : o.ms;
        const t = el('div', `toast pop-card ${kind}`);
        t.innerHTML = `<span class="t-ic">${icon(o.icon || (kind === 'ok' ? 'check' : kind === 'info' ? 'sparkles' : 'alert'), 15)}</span><span class="t-tx">${o.html ? msg : esc(msg)}</span>`;
        const close = () => { if (!t.isConnected) return; t.classList.add('out'); setTimeout(() => t.remove(), 260); };
        if (o.action) { const b = el('button', '', null, esc(o.action.label)); b.onclick = () => { try { o.action.fn(); } catch (e) { console.warn(e); } close(); }; t.appendChild(b); }
        if (ms > 0) { t.style.setProperty('--t-ms', ms + 'ms'); t.appendChild(el('i', 't-bar')); setTimeout(close, ms); }
        t.addEventListener('click', e => { if (e.target === t || e.target.closest('.t-tx')) close(); });
        box.appendChild(t);
        while (box.children.length > 4) box.firstChild.remove();
        return { close };
    },
};

/* ── menu de contexto ────────────────────────────────────────────────────── */
const Ctx = {
    node: null,
    close() {
        if (!this.node) return;
        this.node.remove(); this.node = null;
        ['mousedown', 'keydown', 'wheel', 'blur', 'resize'].forEach(ev => window.removeEventListener(ev, this._off, true));
    },
    open(x, y, items) {
        this.close();
        const m = el('div', 'ctx-menu pop-card');
        m.innerHTML = items.map((it, i) => it.sep ? '<div class="ctx-sep"></div>' : `<button class="ctx-item${it.danger ? ' danger' : ''}" data-i="${i}">${it.icon ? icon(it.icon, 15) : ''}<span>${esc(it.label)}</span></button>`).join('');
        m.addEventListener('click', e => { const b = e.target.closest('.ctx-item'); if (!b) return; const it = items[+b.dataset.i]; this.close(); try { it.fn(); } catch (err) { console.warn(err); } });
        document.body.appendChild(m);
        const r = m.getBoundingClientRect();
        m.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px';
        m.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
        this.node = m;
        this._off = e => { if (e.type === 'keydown' && e.key !== 'Escape') return; if (e.type === 'mousedown' && m.contains(e.target)) return; Ctx.close(); };
        setTimeout(() => ['mousedown', 'keydown', 'wheel', 'blur', 'resize'].forEach(ev => window.addEventListener(ev, this._off, true)), 0);
    },
};
