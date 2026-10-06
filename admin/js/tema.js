/* admin/js/tema.js — Define o tema (claro/escuro) ANTES da primeira pintura, para a tela não "piscar". */
(function () {
    var t = null;
    try { t = localStorage.getItem('bsoft_admin_tema'); } catch (e) { /* sem localStorage */ }
    if (t !== 'claro' && t !== 'escuro') t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'escuro' : 'claro';
    document.documentElement.setAttribute('data-tema', t);
})();
