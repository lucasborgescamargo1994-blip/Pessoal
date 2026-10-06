/* js/core/fontes.js — Carrega as fontes (Plus Jakarta Sans e JetBrains Mono) do Google Fonts SEM travar a página.
   Um <link rel="stylesheet"> comum no <head> segura a execução dos scripts até a folha chegar; se o Google Fonts estiver
   lento ou bloqueado (rede corporativa, sem internet), o sistema ficaria esperando. Inserido por script, o carregamento
   é independente: sem as fontes, o texto aparece na fonte do sistema e troca quando elas chegam (display=swap). */
(function () {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap';
    document.head.appendChild(l);
})();
