// Calibragem da prova de "COPIA DE TRECHOS" (BancoImg.copia / copiou) com os artigos REAIS da base — roda dentro da página (c.eval), como calib-imagens.js.
// Quatro jeitos de a IA responder A PARTIR do artigo (positivos) e dois tipos de artigo que NÃO deram origem à resposta (negativos):
//   fiel         procedimento do artigo copiado (com a frase de abertura da IA)
//   diluida      o que o dono viu: bloco "Antes de tudo, verifique" com o vocabulário de OUTRO artigo + só metade do procedimento
//   parafraseada o texto do artigo com 1 palavra em 6 tirada e 1 em 9 trocada por "importante"
//   curta        só as 32 primeiras palavras
//   vizinho      os 2 artigos de título mais parecido (o que a busca traz junto)      semRelacao   um artigo qualquer de outro assunto
(() => {
    const B = BancoImg;
    const A = bancoCompletoRaw.filter(r => (r.conteudo || '').length >= 500 && (r.titulo || '').length > 5);
    const amostra = A.filter((_, i) => i % Math.max(1, Math.floor(A.length / 70)) === 0).slice(0, 70);
    const limpa = s => String(s).replace(/[*#>|`_-]+/g, ' ');
    const variantes = (a, outro) => {
        const t = limpa(a.conteudo), w = t.split(/\s+/);
        const metade = w.slice(Math.floor(w.length * 0.45)).join(' ');
        const preq = limpa(outro.conteudo).split(/\s+/).slice(0, Math.max(20, Math.round(w.length * 0.4))).join(' ');
        return {
            fiel: 'Para resolver isso siga o procedimento abaixo ' + t.slice(0, 1600),
            diluida: 'Antes de tudo verifique ' + preq + ' Com isso configurado siga o procedimento ' + metade.slice(0, 900),
            parafraseada: w.filter((x, i) => i % 6 !== 5).map((x, i) => i % 9 === 4 ? 'importante' : x).join(' ').slice(0, 1600),
            curta: w.slice(0, 32).join(' ')
        };
    };
    const pos = { fiel: [], diluida: [], parafraseada: [], curta: [] }, neg = { vizinho: [], semRelacao: [] };
    amostra.forEach(a => {
        const idx = A.indexOf(a), outro = A[(idx * 7 + 13) % A.length], v = variantes(a, outro), ta = B.tokens(a.titulo);
        const viz = A.filter(b => b !== a).map(b => { const tb = B.tokens(b.titulo + ' ' + String(b.conteudo).slice(0, 300)); let h = 0; ta.forEach(w => { if (tb.has(w)) h++; }); return { b, h }; }).sort((x, y) => y.h - x.h).slice(0, 2).map(x => x.b);
        Object.keys(v).forEach(k => {
            const tg = B.trechos(v[k]);
            pos[k].push(B.copiou(B.copia(a, tg)));
            viz.forEach(b => neg.vizinho.push(B.copiou(B.copia(b, tg))));
            const u = A[(idx * 11 + 5) % A.length]; if (u !== a) neg.semRelacao.push(B.copiou(B.copia(u, tg)));
        });
    });
    const frac = l => +(l.filter(Boolean).length / Math.max(1, l.length)).toFixed(3);
    return { n: amostra.length, acerto: Object.fromEntries(Object.keys(pos).map(k => [k, frac(pos[k])])), falsoVizinho: frac(neg.vizinho), falsoSemRelacao: frac(neg.semRelacao), limites: B.LIMITES.COPIA };
})()
