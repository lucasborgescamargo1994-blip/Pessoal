/* Aplica as preferências visuais ANTES da primeira pintura (evita o piscar do tema padrão).
   Carregado no <head>, de forma síncrona. */
    // Aplica as preferências visuais (cor, fundo, efeitos, densidade) ANTES da primeira pintura, lendo o
    // cache local -- evita o "piscar" do tema padrão. A fonte da verdade fica no Meu Espaço (ver MeuEspaco).
    (function () {
        try {
            var p = JSON.parse(localStorage.getItem('bsoft_v27_prefs') || '{}'), h = document.documentElement;
            h.dataset.bg = p.bg || 'aurora'; h.dataset.efeitos = p.efeitos || 'completo'; h.dataset.density = p.density || 'confortavel';
            if (p.accent && p.accentRgb) { h.style.setProperty('--primary', p.accent); h.style.setProperty('--primary-rgb', String(p.accentRgb).replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); }
            // Desempenho automático (js/ui/desempenho.js): se ESTE computador já foi ajustado para um modo mais leve, vale desde a primeira pintura (sem passar de novo pelo visual pesado)
            if (p.perfAuto !== false && (p.efeitos || 'completo') === 'completo') {
                var s = JSON.parse(localStorage.getItem('bsoft_perf') || 'null');
                if (s && !s.fixo && (s.n === 'medio' || s.n === 'leve') && Date.now() - (s.t || 0) < 14 * 24 * 3600 * 1000) h.dataset.perf = s.n;
            }
            if (window.self !== window.top) h.classList.add('pip');
        } catch (e) {}
    })();
