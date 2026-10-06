/* Aplica as preferências visuais ANTES da primeira pintura (evita o piscar do tema padrão).
   Carregado no <head>, de forma síncrona. */
    // Aplica as preferências visuais (cor, fundo, efeitos, densidade) ANTES da primeira pintura, lendo o
    // cache local -- evita o "piscar" do tema padrão. A fonte da verdade fica no Meu Espaço (ver MeuEspaco).
    (function () {
        try {
            var p = JSON.parse(localStorage.getItem('bsoft_v27_prefs') || '{}'), h = document.documentElement;
            h.dataset.bg = p.bg || 'aurora'; h.dataset.efeitos = p.efeitos || 'completo'; h.dataset.density = p.density || 'confortavel';
            if (p.accent && p.accentRgb) { h.style.setProperty('--primary', p.accent); h.style.setProperty('--primary-rgb', String(p.accentRgb).replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); }
            if (window.self !== window.top) h.classList.add('pip');
        } catch (e) {}
    })();
