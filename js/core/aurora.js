/* js/core/aurora.js — Fundo (aurora) "assado": o MESMO visual, sem refazer o desfoque a cada quadro.

   Por que existe: as 4 manchas coloridas do fundo eram elementos com `filter: blur(72px)` se mexendo. Um filtro de desfoque num elemento animado é refeito PELA PLACA DE VÍDEO a cada quadro
   (4 superfícies grandes borradas, o tempo todo, mais o vidro por cima): em computadores com vídeo simples isso consumia quase toda a placa e deixava digitar, rolar e animar com atraso
   (medido num i3-7100 com Intel HD 630: 18 quadros/s ao rolar, 88 ms por tecla). Aqui o desfoque é feito UMA vez, dentro de uma imagem SVG (rasterizada uma só vez e guardada pelo navegador), e o
   movimento do fundo continua sendo só o `transform` das mesmas animações (css/desempenho.css) — a placa só desloca uma textura pronta.

   Fidelidade: a imagem usa o mesmo círculo, o mesmo degradê radial e o mesmo desfoque (sigma 72, ou 48 em "Leves") do CSS original, em sRGB como o `filter: blur()`. Comparado pixel a pixel com o fundo
   antigo (mesmo instante da animação, 1536×730 a 125 %): diferença máxima de 4 em 255 num canal, média 0,3 (só arredondamento) — ver README, seção Desempenho (v28.38).
   Sem JavaScript (ou se algo falhar) o CSS antigo continua valendo: o atributo data-baked só é posto no fim, com as imagens prontas.
   A cor da 1ª mancha acompanha o "tom" escolhido em Personalizar; o tamanho acompanha a janela (vmax), então refaz ao redimensionar / trocar cor / trocar "Animações e vidro". */
'use strict';
const Aurora = (() => {
    // geometria idêntica à de css/theme-2026.css (.bg-aurora i:nth-child(n)): tamanho em vmax, centro do degradê (fx, fy em fração do lado), onde o degradê chega a 0 (parada) e a opacidade do centro
    const MANCHAS = [
        { vmax: 54, cor: null,            a: 0.80, parada: 0.68, fx: 0.35, fy: 0.35 },   // a cor da 1ª é o tom de destaque (--primary-rgb)
        { vmax: 46, cor: [167, 139, 250], a: 1,    parada: 0.68, fx: 0.5,  fy: 0.5 },
        { vmax: 52, cor: [56, 189, 248],  a: 1,    parada: 0.66, fx: 0.5,  fy: 0.5 },
        { vmax: 34, cor: [251, 113, 133], a: 1,    parada: 0.66, fx: 0.5,  fy: 0.5 },
    ];
    let assinatura = '', timer = 0;

    // o tom escolhido em Personalizar fica INLINE no <html> (js/core/early.js e js/ui/preferencias.js); sem escolha vale o padrão de css/tokens.css (laranja). Ler o inline evita forçar um cálculo de estilo da página
    function rgbDoTom(raiz) {
        const v = (raiz.style.getPropertyValue('--primary-rgb') || '').trim().split(/[\s,]+/).map(Number);
        return v.length === 3 && v.every(n => n >= 0 && n <= 255) ? v : [249, 115, 22];
    }
    function svgDaMancha(m, rgbTom, lado, P, sigma) {
        const W = Math.round(lado + 2 * P), cx = P + m.fx * lado, cy = P + m.fy * lado;
        const R = Math.max(...[[0, 0], [lado, 0], [0, lado], [lado, lado]].map(([x, y]) => Math.hypot(P + x - cx, P + y - cy)));   // `circle` sem tamanho = farthest-corner
        const c = 'rgb(' + (m.cor || rgbTom).join(',') + ')';
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + W + '" viewBox="0 0 ' + W + ' ' + W + '">' +
            '<defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="' + cx + '" cy="' + cy + '" r="' + R + '">' +
            '<stop offset="0" stop-color="' + c + '" stop-opacity="' + m.a + '"/><stop offset="' + m.parada + '" stop-color="' + c + '" stop-opacity="0"/></radialGradient>' +
            // sRGB, como o `filter: blur()` do CSS (o padrão do SVG seria linearRGB e clarearia as bordas)
            '<filter id="b" filterUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + W + '" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="' + sigma + '"/></filter></defs>' +
            '<g filter="url(#b)"><circle cx="' + (P + lado / 2) + '" cy="' + (P + lado / 2) + '" r="' + (lado / 2) + '" fill="url(#g)"/></g></svg>';
        return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }
    function assar() {
        try {
            const raiz = document.documentElement, fundo = document.querySelector('.bg-aurora');
            if (!fundo) return;
            if (raiz.dataset.bg === 'liso' || raiz.dataset.bg === 'foto') { fundo.removeAttribute('data-baked'); assinatura = ''; return; }   // sem manchas nesses fundos
            const sigma = raiz.dataset.efeitos === 'leve' ? 48 : 72;
            const vmax = Math.max(window.innerWidth, window.innerHeight) / 100, rgb = rgbDoTom(raiz);
            const sig = [sigma, Math.round(vmax * 10), rgb.join(',')].join('|');
            if (sig === assinatura && fundo.hasAttribute('data-baked')) return;
            const P = Math.ceil(sigma * 3);   // margem para a "cauda" do desfoque (3 sigmas = 99,7 %)
            MANCHAS.forEach((m, i) => fundo.style.setProperty('--au-' + (i + 1), svgDaMancha(m, rgb, m.vmax * vmax, P, sigma)));
            fundo.style.setProperty('--au-p', P + 'px');
            fundo.setAttribute('data-baked', '');
            assinatura = sig;
        } catch (e) { /* sem imagens: vale o CSS antigo (filter: blur) */ }
    }
    // ao redimensionar o tamanho das manchas (vmax) muda: refaz depois que a janela parar de mudar
    function aoRedimensionar() { clearTimeout(timer); timer = setTimeout(assar, 250); }
    window.addEventListener('resize', aoRedimensionar, { passive: true });
    assar();
    return { assar };
})();
