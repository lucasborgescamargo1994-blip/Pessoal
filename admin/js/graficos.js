/* admin/js/graficos.js — Gráficos leves do painel (SVG + CSS): linha, colunas, rosca e ranking de barras.
   Sem biblioteca externa: as cores vêm de variáveis CSS (seguem o tema claro/escuro) e nada depende de scripts de terceiros — combina com a
   CSP estrita do painel. Todo texto entra como texto (nunca como HTML). O visual está em admin.css (classes .graf, .rk, .rosca-wrap). */
'use strict';

const NS_SVG = 'http://www.w3.org/2000/svg';
// monta um elemento SVG: svg('rect', {x: 1, class: 'a'}, filhos…)
function svg(tag, attrs, ...filhos) {
    const n = document.createElementNS(NS_SVG, tag);
    if (attrs) for (const k of Object.keys(attrs)) { const v = attrs[k]; if (v === null || v === undefined || v === false) continue; n.setAttribute(k, String(v)); }
    for (const f of filhos.flat()) { if (f === null || f === undefined || f === false) continue; n.appendChild(f instanceof Node ? f : document.createTextNode(String(f))); }
    return n;
}

ADM.graf = (function () {
    'use strict';
    const num = n => Number(n || 0).toLocaleString('pt-BR');

    // escala do eixo vertical em números inteiros: passo 1, 2, 5, 10, 20, 50… com no máximo 5 divisões
    function escalaY(max) {
        if (!(max > 0)) return { topo: 1, passo: 1 };
        for (let mag = 1; ; mag *= 10) for (const f of [1, 2, 5]) { const passo = f * mag; if (Math.ceil(max / passo) <= 5) return { topo: Math.ceil(max / passo) * passo, passo }; }
    }

    // linha (área) ou colunas. op = { tipo: 'linha'|'colunas', pontos: [{ rotulo, dica, valor, extra, destaque }], altura, unidade, descricao }
    function grafico(alvo, op) {
        if (alvo._ro) { alvo._ro.disconnect(); alvo._ro = null; }
        let larguraAtual = 0;
        function desenhar() {
            larguraAtual = Math.floor(alvo.clientWidth) || 640;
            limpar(alvo);
            const pts = op.pontos || [], n = pts.length;
            if (!n) return;
            const W = Math.max(280, larguraAtual), H = op.altura || 260, m = { e: 42, d: 12, t: 14, b: 28 };
            const iw = W - m.e - m.d, ih = H - m.t - m.b, colunas = op.tipo === 'colunas';
            const max = Math.max(0, ...pts.map(p => p.valor));
            const { topo, passo } = escalaY(max);
            const x = i => m.e + (colunas ? (iw / n) * (i + .5) : (n === 1 ? iw / 2 : (iw / (n - 1)) * i));
            const y = v => m.t + ih - ih * v / topo;
            const raiz = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': op.descricao || 'Gráfico' });

            const grade = svg('g', { class: 'grade' });
            for (let v = 0; v <= topo; v += passo) {
                grade.appendChild(svg('line', { x1: m.e, x2: W - m.d, y1: y(v), y2: y(v) }));
                grade.appendChild(svg('text', { x: m.e - 7, y: y(v) + 4, 'text-anchor': 'end' }, num(v)));
            }
            raiz.appendChild(grade);

            // rótulos do eixo horizontal: todos se couberem; senão de tantos em tantos (e o último, se não ficar colado no anterior)
            const salto = colunas ? (W < 520 ? 3 : n > 12 ? 2 : 1) : (n <= 12 ? 1 : Math.ceil(n / (W < 520 ? 5 : 9)));
            const rotulos = svg('g', { class: 'rotulos' });
            pts.forEach((p, i) => { if (i % salto === 0 || (i === n - 1 && i - Math.floor(i / salto) * salto >= salto * .6)) rotulos.appendChild(svg('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, p.rotulo)); });
            raiz.appendChild(rotulos);

            const guia = svg('line', { class: 'guia', x1: 0, x2: 0, y1: m.t, y2: m.t + ih, visibility: 'hidden' });
            const marca = svg('circle', { class: 'marca', r: 5, cx: 0, cy: 0, visibility: 'hidden' });
            let barras = [];
            if (colunas) {
                const larg = Math.max(2, Math.min(36, (iw / n) * .66));
                barras = pts.map((p, i) => svg('rect', { class: 'col' + (p.destaque ? ' pico' : ''), x: x(i) - larg / 2, y: y(p.valor), width: larg, height: Math.max(0, m.t + ih - y(p.valor)), rx: Math.min(4, larg / 3) }));
                barras.forEach(b => raiz.appendChild(b));
            } else {
                const xs = pts.map((p, i) => x(i)), ys = pts.map(p => y(p.valor));
                const linha = xs.map((xx, i) => (i ? 'L' : 'M') + xx.toFixed(1) + ' ' + ys[i].toFixed(1)).join(' ');
                if (n > 1) raiz.appendChild(svg('path', { class: 'area', d: linha + ` L${xs[n - 1].toFixed(1)} ${m.t + ih} L${xs[0].toFixed(1)} ${m.t + ih} Z` }));
                raiz.appendChild(svg('path', { class: 'serie', d: n > 1 ? linha : `M${xs[0] - .1} ${ys[0]} L${xs[0] + .1} ${ys[0]}` }));
                if (n <= 45) pts.forEach((p, i) => raiz.appendChild(svg('circle', { class: 'pt', cx: xs[i], cy: ys[i], r: 3 })));
            }
            raiz.append(guia, marca);

            const dica = h('div', { class: 'graf-dica', hidden: true });
            const zona = svg('rect', { x: m.e, y: m.t, width: iw, height: ih, fill: 'transparent' });
            let ativo = -1;
            function mostrar(i) {
                if (i === ativo) return; ativo = i;
                barras.forEach((b, k) => b.classList.toggle('ativa', k === i));
                if (i < 0) { dica.hidden = true; guia.setAttribute('visibility', 'hidden'); marca.setAttribute('visibility', 'hidden'); return; }
                const p = pts[i], esc = raiz.getBoundingClientRect().width / W || 1;
                limpar(dica);
                [h('b', null, p.dica || p.rotulo), h('div', null, num(p.valor) + (op.unidade ? ' ' + op.unidade : '')), p.extra ? h('div', { class: 'mu' }, p.extra) : null].filter(Boolean).forEach(el => dica.appendChild(el));
                dica.hidden = false;
                const caixa = alvo.getBoundingClientRect(), svgBox = raiz.getBoundingClientRect();
                let esq = svgBox.left - caixa.left + x(i) * esc;
                const meia = dica.offsetWidth / 2; esq = Math.min(Math.max(esq, meia + 2), caixa.width - meia - 2);
                dica.style.left = esq + 'px'; dica.style.top = Math.max(dica.offsetHeight + 6, svgBox.top - caixa.top + y(p.valor) * esc - 10) + 'px';
                if (!colunas) { guia.setAttribute('x1', x(i)); guia.setAttribute('x2', x(i)); guia.setAttribute('visibility', 'visible'); marca.setAttribute('cx', x(i)); marca.setAttribute('cy', y(p.valor)); marca.setAttribute('visibility', 'visible'); }
            }
            zona.addEventListener('pointermove', ev => {
                const r = raiz.getBoundingClientRect(), px = (ev.clientX - r.left) / (r.width / W || 1) - m.e;
                const i = colunas ? Math.floor(px / (iw / n)) : (n === 1 ? 0 : Math.round(px / (iw / (n - 1))));
                mostrar(Math.min(n - 1, Math.max(0, i)));
            });
            zona.addEventListener('pointerleave', () => mostrar(-1));
            raiz.appendChild(zona);
            alvo.append(raiz, dica);
        }
        alvo.classList.add('graf');
        desenhar();
        if (typeof ResizeObserver === 'function') {
            alvo._ro = new ResizeObserver(() => { if (Math.abs(Math.floor(alvo.clientWidth) - larguraAtual) > 3 && alvo.clientWidth > 0) desenhar(); });
            alvo._ro.observe(alvo);
        }
        return alvo;
    }
    const linha = (alvo, op) => grafico(alvo, Object.assign({}, op, { tipo: 'linha' }));
    const colunas = (alvo, op) => grafico(alvo, Object.assign({}, op, { tipo: 'colunas' }));

    // rosca: partes = [{ rotulo, valor, cor: 'var(--ad-ok)' }] (partes com valor 0 não aparecem). op = { centro: 'rótulo do total' }
    function rosca(alvo, partes, op) {
        limpar(alvo).classList.add('rosca-wrap');
        const lista = partes.filter(p => p.valor > 0), total = lista.reduce((a, p) => a + p.valor, 0);
        if (!total) { alvo.appendChild(h('div', { class: 'vazio' }, 'Sem dados.')); return alvo; }
        const r = 44, C = 2 * Math.PI * r;
        let acum = 0;
        const raiz = svg('svg', { viewBox: '0 0 120 120', width: 170, height: 170, role: 'img', 'aria-label': (op && op.descricao) || 'Gráfico de rosca' },
            svg('circle', { class: 'rosca-fundo', cx: 60, cy: 60, r, fill: 'none', 'stroke-width': 17 }),
            lista.map(p => {
                const fatia = svg('circle', { cx: 60, cy: 60, r, fill: 'none', 'stroke-width': 17, 'stroke-dasharray': `${(C * p.valor / total).toFixed(2)} ${C.toFixed(2)}`, 'stroke-dashoffset': (-C * acum / total).toFixed(2), transform: 'rotate(-90 60 60)' }, svg('title', null, `${p.rotulo}: ${num(p.valor)}`));
                fatia.style.stroke = p.cor; acum += p.valor; return fatia;
            }),
            svg('text', { class: 'rosca-total', x: 60, y: 58, 'text-anchor': 'middle' }, num(total)),
            svg('text', { class: 'rosca-sub', x: 60, y: 73, 'text-anchor': 'middle' }, (op && op.centro) || 'consultas'));
        const legenda = h('div', { class: 'legenda' }, lista.map(p => { const bolinha = h('i'); bolinha.style.background = p.cor; return h('div', null, bolinha, h('b', null, num(p.valor)), ' ' + p.rotulo, h('span', { class: 'mu' }, ' · ' + Math.round(p.valor * 100 / total) + '%')); }));
        alvo.append(raiz, legenda);
        return alvo;
    }

    // ranking de barras horizontais: itens = [{ rotulo, valor, dica, segmentos: [{ valor, classe: 'ok'|'er'|'sem'|'pr' }] }] — sem segmentos a barra é de uma cor só
    function ranking(itens, op) {
        const max = Math.max(1, ...itens.map(i => i.valor));
        return h('div', { class: 'rk', role: 'list' }, itens.map(i => h('div', { class: 'rk-linha', role: 'listitem', title: i.dica || i.rotulo },
            h('span', { class: 'rk-rot' }, i.rotulo),
            h('div', { class: 'rk-trilho' }, (i.segmentos || [{ valor: i.valor, classe: (op && op.classe) || 'pr' }]).filter(s => s.valor > 0).map(s => { const b = h('div', { class: 'rk-barra ' + s.classe }); b.style.width = (s.valor * 100 / max) + '%'; return b; })),
            h('span', { class: 'rk-val' }, num(i.valor)))));
    }

    return { linha, colunas, rosca, ranking, escalaY };
})();
