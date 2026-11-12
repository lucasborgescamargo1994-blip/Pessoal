/* js/app/imagens-banco-ui.js — Imagens do procedimento no chat (v28.39): monta a galeria abaixo da resposta e a janela de ampliação. As regras (quais imagens, validação) ficam em js/core/imagens-banco.js.
   Tudo é montado com createElement/textContent (a legenda e o título vêm do banco: nunca viram HTML). Clique na imagem = ampliar (Esc, clique fora ou ✕ fecham). Se o arquivo sumiu do armazenamento,
   a figura mostra "Imagem indisponível" em vez de um ícone quebrado. */
'use strict';
const BancoImgUI = (() => {
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    let janela = null, aoTeclar = null;

    function fechar() {
        if (aoTeclar) { document.removeEventListener('keydown', aoTeclar, true); aoTeclar = null; }
        if (janela) { const antes = janela._foco; janela.remove(); janela = null; if (antes && antes.focus && document.contains(antes)) { try { antes.focus({ preventScroll: true }); } catch (e) { /* ok */ } } }
    }
    function ampliar(url, legenda) {
        if (!BancoImg.urlValida(url)) return;
        const foco = document.activeElement;
        fechar();
        const fundo = el('div', 'bd-lb'); fundo._foco = foco;
        fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-modal', 'true'); fundo.setAttribute('aria-label', legenda ? 'Imagem ampliada: ' + legenda : 'Imagem ampliada');
        const img = el('img', 'bd-lb-img'); img.src = url; img.alt = legenda || 'Imagem do procedimento'; img.referrerPolicy = 'no-referrer';
        const x = el('button', 'bd-lb-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar imagem ampliada');
        const barra = el('div', 'bd-lb-barra');
        if (legenda) barra.appendChild(el('span', 'bd-lb-cap', legenda));
        const abrir = el('a', 'bd-lb-abrir', 'Abrir em outra guia ↗'); abrir.href = url; abrir.target = '_blank'; abrir.rel = 'noopener noreferrer';
        barra.appendChild(abrir);
        fundo.append(x, img, barra);
        fundo.addEventListener('click', e => { if (e.target === fundo || e.target === x || e.target === img) fechar(); });
        aoTeclar = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); } };
        document.addEventListener('keydown', aoTeclar, true);
        document.body.appendChild(fundo); janela = fundo;
        try { x.focus({ preventScroll: true }); } catch (e) { /* ok */ }
    }

    // imagens: [{ url, legenda, titulo?, id? }] (já validadas ou não: aqui confere de novo). Devolve o elemento da galeria, ou null se não sobrou nenhuma.
    function montar(imagens, opcoes) {
        opcoes = opcoes || {};
        const lista = (Array.isArray(imagens) ? imagens : []).filter(i => i && BancoImg.urlValida(i.url));
        if (!lista.length) return null;
        const raiz = el('div', 'bd-imagens'); raiz.setAttribute('role', 'group'); raiz.setAttribute('aria-label', 'Imagens do procedimento');
        const tit = el('div', 'bd-imagens-tit', '📷 Veja na tela'); tit.appendChild(el('small', null, ' · clique para ampliar'));
        raiz.appendChild(tit);
        const grade = el('div', 'bd-imagens-lista' + (lista.length === 1 ? ' uma' : ''));
        const artigos = new Set(lista.map(i => i.id != null ? 'id' + i.id : 't' + (i.titulo || ''))).size;   // só rotula pelo título do artigo quando as imagens vêm de mais de um
        lista.forEach(i => {
            const legenda = String(i.legenda || '').trim(), titulo = String(i.titulo || '').trim();
            const rotulo = legenda || (artigos > 1 ? titulo : '');
            const fig = el('figure', 'bd-fig');
            const btn = el('button', 'bd-fig-btn'); btn.type = 'button'; btn.title = 'Clique para ampliar';
            btn.setAttribute('aria-label', 'Ampliar imagem' + (rotulo ? ': ' + rotulo : ''));
            const img = el('img'); img.alt = rotulo || ('Imagem do procedimento' + (titulo ? ': ' + titulo : '')); img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => { fig.classList.add('bd-fig-erro'); btn.replaceWith(el('div', 'bd-fig-falha', 'Imagem indisponível no momento.')); });
            img.addEventListener('load', () => { if (opcoes.aoCarregar) { try { opcoes.aoCarregar(img); } catch (e) { /* ok */ } } });
            img.src = i.url;
            btn.appendChild(img); btn.addEventListener('click', () => ampliar(i.url, rotulo));
            fig.appendChild(btn);
            if (rotulo) fig.appendChild(el('figcaption', null, rotulo));
            grade.appendChild(fig);
        });
        raiz.appendChild(grade);
        return raiz;
    }

    // Põe a galeria no cartão da resposta, ENTRE o texto e a área do "esta resposta foi útil?". Se a pessoa estava lendo o fim da conversa, acompanha o crescimento (as imagens carregam depois).
    function anexar(card, imagens) {
        if (!card || !card.isConnected) return null;
        const stream = document.getElementById('chatStream');
        const folga = () => stream ? stream.scrollHeight - stream.scrollTop - stream.clientHeight : 99999;
        const noFim = folga() < 160;
        const gal = montar(imagens, { aoCarregar: img => { if (noFim && typeof scrollToBottom === 'function' && folga() < (img.clientHeight || 0) + 240) scrollToBottom(true); } });
        if (!gal) return null;
        const fb = card.querySelector('.feedback-area');
        if (fb) card.insertBefore(gal, fb); else card.appendChild(gal);
        if (noFim && typeof scrollToBottom === 'function') scrollToBottom(true);
        return gal;
    }
    return { montar, anexar, ampliar, fechar };
})();
