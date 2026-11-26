/* Aplica as preferências visuais ANTES da primeira pintura (evita o piscar do tema padrão).
   Carregado no <head>, de forma síncrona. */
    // Aplica as preferências visuais (cor de destaque e densidade) ANTES da primeira pintura, lendo o
    // cache local -- evita o "piscar" do tema padrão. A fonte da verdade fica no Meu Espaço (ver MeuEspaco).
    // (v28.43: o visual é único e leve — não existem mais as escolhas de fundo, "animações e vidro" nem o ajuste automático de desempenho.)
    (function () {
        try {
            var p = JSON.parse(localStorage.getItem('bsoft_v27_prefs') || '{}'), h = document.documentElement;
            h.dataset.density = p.density || 'confortavel';
            if (p.accent && p.accentRgb) { h.style.setProperty('--primary', p.accent); h.style.setProperty('--primary-rgb', String(p.accentRgb).replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); }
            if (window.self !== window.top) h.classList.add('pip');
        } catch (e) {}
    })();
