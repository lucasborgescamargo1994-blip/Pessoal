/* js/app/prontidao.js — "Já dá para perguntar?" (v28.43).

   Antes: o campo de digitação nascia travado (`disabled`) e só soltava no FIM do carregamento da página (~100 arquivos) — a tela aparecia e a pessoa ficava olhando um campo que não aceitava letras.
   Agora: o campo nasce LIBERADO (index.html, sem `disabled`) e a pessoa já digita enquanto a base carrega; só o botão de enviar (➤) fica travado, com um aviso discreto logo acima do campo
   ("⏳ Preparando a base… você já pode digitar") e uma barrinha quando há contagem (ex.: "Baixando vetores do servidor… 240/641"). O ➤ libera sozinho quando a base está pronta.

   Este módulo só cuida do que a pessoa VÊ. Quem decide o "pronto" é js/app/dados.js (`liberarChat`: base carregada e com vetores — a mesma regra de antes) e quem barra o envio de fato continua sendo
   `isVectorizing` (js/core/globals.js) em handleChat: aqui só se avisa, em vez de ignorar o clique/Enter em silêncio como antes.

   API: Pronto.progresso(texto) · Pronto.liberar() · Pronto.avisarEspera() · Pronto.pronto() */
'use strict';
const Pronto = (() => {
    let liberado = false, tAviso = 0;
    const el = id => document.getElementById(id);

    // texto do aviso acima do campo; com "i/n" no texto a barrinha acompanha
    function progresso(texto) {
        if (liberado) return;
        const box = el('composerStatus'), tx = el('composerStatusTx'), bar = el('composerStatusBar');
        if (!box || !tx) return;
        const t = String(texto || '').replace(/\.{3}$/, '…').trim() || 'Preparando a base de conhecimento…';
        box.classList.remove('is-erro'); box.classList.add('is-on');
        tx.textContent = '⏳ ' + t + ' — você já pode digitar; o ➤ libera sozinho.';
        const m = /(\d+)\s*\/\s*(\d+)/.exec(t);
        if (bar && bar.parentElement) {
            if (m && +m[2] > 0) { bar.parentElement.hidden = false; bar.style.width = Math.min(100, Math.round(100 * (+m[1]) / (+m[2]))) + '%'; }
            else bar.parentElement.hidden = true;
        }
    }

    // a base está utilizável: some o aviso e o ➤ passa a enviar
    function liberar() {
        liberado = true;
        clearTimeout(tAviso);
        const box = el('composerStatus'); if (box) box.classList.remove('is-on', 'is-erro', 'is-aviso');
        const b = el('sendBtn'); if (b) { b.disabled = false; b.title = 'Enviar'; }
    }

    // a pessoa tentou enviar (Enter, atalho "Em alta", botão do menu de boas-vindas…) antes da hora: o texto fica no campo e o aviso destaca por um instante
    function avisarEspera() {
        if (liberado) return;
        const box = el('composerStatus'); if (!box) return;
        box.classList.add('is-on', 'is-aviso');
        clearTimeout(tAviso); tAviso = setTimeout(() => box.classList.remove('is-aviso'), 1600);
        try { const i = el('searchInput'); if (i) i.focus({ preventScroll: true }); } catch (e) { /* conforto */ }
    }

    return { progresso, liberar, avisarEspera, pronto: () => liberado };
})();
