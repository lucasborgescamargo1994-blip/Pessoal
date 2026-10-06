/* js/core/env.js — Detecta onde o sistema está rodando e se é o chat de teste (simulador).
   Roda em qualquer lugar: arquivo aberto direto no computador (file://), localhost e GitHub Pages. */
(function () {
    var q = new URLSearchParams(location.search);
    window.BSOFT_ENV = {
        arquivoLocal: location.protocol === 'file:',
        localhost: /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname),
        githubPages: /\.github\.io$/.test(location.hostname),
        // ?sim=1 → chat de teste do painel administrativo: não grava NADA no banco (logs, feedback, aprendizado...)
        simulacao: q.get('sim') === '1',
        embutido: window.self !== window.top
    };
    window.BSOFT_SIM = window.BSOFT_ENV.simulacao;
    if (window.BSOFT_SIM) document.documentElement.classList.add('sim');
})();
