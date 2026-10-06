/* js/core/embeddings-api.js — Chamada à Jina para gerar embeddings (vetores) e similaridade por cosseno. Usado pelo app e pela Área Administrativa. */
// ═══════════════════════════════════════════════════════════
//  EMBEDDINGS
// ═══════════════════════════════════════════════════════════
// Chamada rápida — sem retry. Usada em tempo real (handleChat).
// Usa Jina AI (jina-embeddings-v3, 1024 dims) — limite de 1M tokens/mês grátis, sem 429.
async function gerarEmbedding(texto) {
    // Antes não tinha limite de tempo nenhum aqui — se a Jina travasse, o handleChat ficava
    // esperando indefinidamente ANTES até de tentar a busca por palavra-chave (que não depende
    // disso). 8s é folgado (embedding normalmente volta em bem menos que 1s) — só existe pra
    // cortar caso de trava, caindo pro fallback por palavra-chave em vez de ficar parado.
    const _ac = new AbortController();
    const _tid = setTimeout(() => _ac.abort(), 8000);
    try {
        const r = await fetch('https://api.jina.ai/v1/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${JINA_KEY}` },
            body: JSON.stringify({ model: 'jina-embeddings-v3', input: [texto] }),
            signal: _ac.signal
        });
        const d = await r.json();
        if (r.ok && d.data?.[0]?.embedding) return d.data[0].embedding;
    } catch(e) {} finally { clearTimeout(_tid); }
    return null;
}

// Chamada com retry — usada na vetorização em background (repositório / novos registros).
// Tenta até 4 vezes com espera crescente antes de desistir.
async function gerarEmbeddingComRetry(texto, _tent = 0) {
    const v = await gerarEmbedding(texto);
    if (v) return v;
    if (_tent < 3) {
        const espera = [5000, 10000, 20000][_tent] || 20000;
        await new Promise(res => setTimeout(res, espera));
        return gerarEmbeddingComRetry(texto, _tent + 1);
    }
    return null;
}
function calcularSimilaridade(vA,vB){if(!vA||!vB||vA.length!==vB.length)return 0;let d=0,mA=0,mB=0;for(let i=0;i<vA.length;i++){d+=vA[i]*vB[i];mA+=vA[i]**2;mB+=vB[i]**2;}mA=Math.sqrt(mA);mB=Math.sqrt(mB);return(mA&&mB)?d/(mA*mB):0;}
