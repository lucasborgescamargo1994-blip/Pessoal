/* js/core/rr-match.js — Compara uma pergunta com as respostas rápidas aprovadas ("pergunta semelhante").
   Usado pelo app (para responder na hora) e pela Área Administrativa (testador e sugestões de duplicadas).
   Depende de js/core/sinonimos.js (extrairTermosComSinonimos).

   Como decide:
   1. Pergunta idêntica (depois de normalizar acentos, maiúsculas e sinônimos) → acerta.
   2. Parecida: mede a sobreposição de termos (Jaccard) entre a pergunta e a pergunta cadastrada (ou uma variante).
      Acerta se passar do limiar léxico (padrão 0,80).
   3. (opcional, só no app) Semântica: se o léxico ficou entre 0,25 (MIN_CANDIDATA) e o limiar, compara os vetores (Jina) das
      3 melhores candidatas; acerta se a similaridade passar do limiar semântico (padrão 0,92).
   Trava de segurança: se a pergunta tem números (ex.: erro 539) eles precisam ser exatamente os mesmos. */
const RRMatch = (function () {
    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    function preparar(texto) {
        const norm = semAcento(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        let termos = [];
        try { termos = extrairTermosComSinonimos(String(texto || '')); } catch (e) { termos = norm.split(' ').filter(t => t.length > 2); }
        return {
            texto: String(texto || ''),
            norm,
            termos: Array.from(new Set(termos)),
            numeros: Array.from(new Set(norm.match(/\d+/g) || [])).sort().join(',')
        };
    }

    function jaccard(a, b) {
        if (!a.length || !b.length) return 0;
        const B = new Set(b); let inter = 0;
        new Set(a).forEach(t => { if (B.has(t)) inter++; });
        return inter / (new Set(a).size + B.size - inter);
    }

    // Prepara (uma vez) a pergunta cadastrada e suas variantes; guarda em item._prep
    function prepararItem(item) {
        if (item._prep) return item._prep;
        const vars = [item.pergunta].concat(Array.isArray(item.variantes) ? item.variantes : []).map(v => String(v || '').trim()).filter(Boolean);
        item._prep = vars.map(v => Object.assign(preparar(v), { texto: v }));
        return item._prep;
    }

    // Compara a pergunta já preparada (alvo) com um item; devolve a melhor variante.
    function comparar(alvo, item) {
        let melhor = null, pontosMelhor = -1;
        prepararItem(item).forEach(p => {
            const exato = !!alvo.norm && alvo.norm === p.norm;
            const lex = exato ? 1 : jaccard(alvo.termos, p.termos);
            const numerosOk = alvo.numeros === p.numeros;
            // prefere variantes com os números certos; depois a mais parecida
            const pontos = (numerosOk ? 10 : 0) + lex + (exato ? 5 : 0);
            if (pontos > pontosMelhor) { pontosMelhor = pontos; melhor = { lex, exato: exato || lex === 1, numerosOk, variante: p.texto }; }
        });
        return melhor || { lex: 0, exato: false, numerosOk: true, variante: item.pergunta };
    }

    // Lista os itens parecidos com a pergunta (léxico), do mais para o menos parecido. Para o testador/sugestões do admin.
    function ranking(pergunta, itens, minimo) {
        const alvo = preparar(pergunta);
        return itens.map(item => Object.assign({ item }, comparar(alvo, item)))
            .filter(x => x.lex >= (minimo == null ? 0.2 : minimo))
            .sort((a, b) => (b.numerosOk - a.numerosOk) || (b.lex - a.lex));
    }

    function hash(texto) { let h = 5381; const s = String(texto || ''); for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }

    // sobreposição mínima de termos para uma pergunta virar "candidata" à checagem por significado (a comparação semântica custa uma chamada à Jina)
    const MIN_CANDIDATA = 0.25;

    return { preparar, jaccard, prepararItem, comparar, ranking, hash, semAcento, MIN_CANDIDATA };
})();
