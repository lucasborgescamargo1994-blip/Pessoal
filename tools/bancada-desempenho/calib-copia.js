// Calibragem da prova de "a resposta veio deste artigo" (BancoImg.analisar) com os artigos REAIS da base — roda dentro da página (c.eval), como calib-imagens.js.
// A IA recebe uns 5 artigos: aqui o contexto é o artigo + 4 vizinhos de título parecido (todos com imagem, para poder medir quem entraria). Respostas (positivos = o artigo foi a fonte):
//   fiel          procedimento do artigo copiado (com a frase de abertura da IA)
//   diluida       o bloco "Antes de tudo, verifique" com o vocabulário de OUTRO artigo + só metade do procedimento
//   parafraseada  o texto do artigo com 1 palavra em 6 tirada e 1 em 9 trocada por "importante"
//   curta         só as 32 primeiras palavras
//   mistura       o que a resposta "completa" faz: o artigo + o texto de 2 artigos parecidos (esses dois também são fonte)
//   misturaGrande o bloco "Antes de tudo" + o artigo + 3 artigos parecidos, bem longa
//   reescrita     só informativa: 1 palavra em 3 tirada e 1 em 5 trocada (artigo curto quase não tem trechos de 3 palavras que sobrem)
// Negativos: vizinho que NÃO é fonte da resposta (os de título mais parecido) e um artigo sem relação nenhuma.
(() => {
    const B = BancoImg, IMG = [{ url: 'https://x.supabase.co/storage/v1/object/public/bancodados-imagens/t.webp', legenda: '' }];
    const TODOS = bancoCompletoRaw.filter(r => (r.titulo || '').length > 5 && (r.conteudo || '').length >= 150);
    const limpa = s => String(s).replace(/[*#>|`_-]+/g, ' ');
    const item = a => ({ idSupabase: a.id, erro: a.titulo, solucao: a.conteudo, emitir: a.como_emitir || '', caminhoMenu: a.caminho_menu || '', similaridade: 0.8, imagens: IMG });
    const vizinhos = (a, n) => { const ta = B.tokens(a.titulo); return TODOS.filter(b => b !== a).map(b => { const tb = B.tokens(b.titulo + ' ' + String(b.conteudo).slice(0, 300)); let h = 0; ta.forEach(w => { if (tb.has(w)) h++; }); return { b, h }; }).sort((x, y) => y.h - x.h).slice(0, n).map(x => x.b); };
    const respostas = (a, outro, viz) => {
        const t = limpa(a.conteudo), w = t.split(/\s+/), intro = 'Para resolver isso siga o procedimento abaixo ';
        const metade = w.slice(Math.floor(w.length * 0.45)).join(' ');
        const preq = limpa(outro.conteudo).split(/\s+/).slice(0, Math.max(20, Math.round(w.length * 0.4))).join(' ');
        return {
            fiel: { r: intro + t.slice(0, 1600), fontes: [a] },
            diluida: { r: 'Antes de tudo verifique ' + preq + ' Com isso configurado siga o procedimento ' + metade.slice(0, 900), fontes: [a] },
            parafraseada: { r: w.filter((x, i) => i % 6 !== 5).map((x, i) => i % 9 === 4 ? 'importante' : x).join(' ').slice(0, 1600), fontes: [a] },
            curta: { r: w.slice(0, 32).join(' '), fontes: [a] },
            mistura: { r: intro + t.slice(0, 1600) + ' Observações importantes: ' + limpa(viz[0].conteudo).slice(0, 700) + ' Além disso: ' + limpa(viz[1].conteudo).slice(0, 700), fontes: [a, viz[0], viz[1]] },
            misturaGrande: { r: 'Antes de tudo verifique ' + preq + ' ' + intro + t.slice(0, 1600) + ' Observações importantes: ' + limpa(viz[0].conteudo).slice(0, 1200) + ' Além disso: ' + limpa(viz[1].conteudo).slice(0, 1200) + ' ' + limpa(viz[2].conteudo).slice(0, 1000), fontes: [a, viz[0], viz[1], viz[2]] },
            reescrita: { r: 'Antes de tudo verifique ' + preq.split(' ').slice(0, 30).join(' ') + ' Com isso configurado siga o procedimento ' + w.filter((x, i) => i % 3 !== 2).map((x, i) => i % 5 === 3 ? 'item' : x).join(' ').slice(0, 1400) + ' Pronto o procedimento foi concluído e está disponível', fontes: [a] }
        };
    };
    const am = (lst, n) => lst.filter((_, i) => i % Math.max(1, Math.floor(lst.length / n)) === 0).slice(0, n);
    const frac = l => +(l.filter(Boolean).length / Math.max(1, l.length)).toFixed(3);
    const grupo = amostra => {
        const pos = {}, negViz = [], negSem = [];
        amostra.forEach(a => {
            const idx = TODOS.indexOf(a), outro = TODOS[(idx * 7 + 13) % TODOS.length], viz = vizinhos(a, 4), rs = respostas(a, outro, viz);
            Object.keys(rs).forEach(k => {
                const ctx = [a].concat(viz), r = B.analisar(ctx.map(item), rs[k].r);   // (sem a pergunta: só a resposta decide)
                (pos[k] = pos[k] || []).push(!!r.candidatos[0].prova);
                ctx.forEach((x, i) => { if (i > 0 && !rs[k].fontes.includes(x)) negViz.push(!!r.candidatos[i].prova); });
                const u = TODOS[(idx * 11 + 5) % TODOS.length];
                if (!rs[k].fontes.includes(u)) negSem.push(!!B.analisar([item(a), item(u)], rs[k].r).candidatos[1].prova);
            });
        });
        return { artigos: amostra.length, acerto: Object.fromEntries(Object.keys(pos).map(k => [k, frac(pos[k])])), falsoVizinho: frac(negViz), falsoSemRelacao: frac(negSem) };
    };
    return { longos: grupo(am(TODOS.filter(r => r.conteudo.length >= 500), 70)), curtos: grupo(am(TODOS.filter(r => r.conteudo.length < 600), 70)), limites: B.LIMITES };
})()
