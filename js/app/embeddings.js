/* js/app/embeddings.js — Cache local dos vetores da base de conhecimento (a chamada à Jina fica em js/core/embeddings-api.js). */

// ═══════════════════════════════════════════════════════════
//  CACHE LOCAL DE EMBEDDINGS (evita baixar vetores do Supabase a cada carga)
// ═══════════════════════════════════════════════════════════
// Onde fica: IndexedDB (KV "bsoft_app_cache", um registro por artigo, vetor como Float32Array = 4 KB cada).
// Antes ficava num JSON único no localStorage (bsoft_emb_v3, ~5,5 mil caracteres por vetor): com ~600 artigos já eram
// 3,3 milhões de caracteres, perto do limite de ~5 milhões do navegador. Em computador com o localStorage mais cheio
// (conversas, aprendizado local, etc.) a gravação falhava em silêncio, o cache ficava pela metade e, como só se baixava
// do servidor com o cache 100% vazio, o resto era revetorizado na Jina a CADA recarga. Agora: o IndexedDB não tem esse
// teto, e o que faltar é buscado no servidor (dados.js → _embBaixarDoServidor) antes de qualquer chamada à Jina.
const _EMB_CACHE_KEY = 'bsoft_emb_v3'; // formato antigo (localStorage, base64): só lido para migrar, ou usado se o IndexedDB não abrir
const _EMB_IDB_PREFIXO = 'emb4:';      // chave dos registros no IndexedDB
let _embCacheMem = {}; // id -> { vetor:number[], hash:string|null }
let _embSujos = new Set(); // ids alterados que ainda não foram gravados
let _embTimer = null;
let _embUsaIdb = false;
// Para diagnóstico (passar o mouse no selo de status do chat, ou digitar BSOFT_VETORES no console).
const BSOFT_VETORES = { persistencia: 'carregando', cacheLocal: 0, servidor: 0, jina: 0, falhasServidor: 0, migrados: 0, forcado: false };

function _embToB64(arr) {
    const f = new Float32Array(arr);
    const b = new Uint8Array(f.buffer);
    let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
}
function _b64ToEmb(b64) {
    const s = atob(b64);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return Array.from(new Float32Array(b.buffer));
}
// Hash simples (não-criptográfico, só pra detectar mudança de conteúdo) do texto que foi
// realmente vetorizado -- 23/09/2026: editar um registro no banco (Editor de Banco ou direto no
// Supabase) não atualizava a busca porque o vetor usado vem só do cache local (ver
// "zero egress Supabase" logo abaixo), que nunca era invalidado. Guardando esse hash junto com
// cada vetor em cache, dá pra comparar com o hash do conteúdo atual a cada carga (ver
// carregarVetoresExistentes) e só revetorizar quem realmente mudou -- sem precisar baixar vetor
// nenhum do Supabase pra descobrir isso (o conteúdo, ao contrário do vetor, já é baixado de graça
// a cada carga de qualquer forma).
function _hashConteudo(texto) {
    let h = 5381;
    const s = String(texto || '');
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

// Abrir com ?vetores=servidor no endereço (ou chamar forcarVetoresDoServidor() no console) apaga o cache local de vetores
// deste navegador: na carga seguinte tudo é baixado de novo do servidor. O parâmetro some do endereço para não repetir a cada recarga.
const _embForcar = (() => {
    let p;
    try { p = new URLSearchParams(location.search); } catch (e) { return false; }
    if (!['servidor', 'limpar'].includes(p.get('vetores'))) return false;
    try { p.delete('vetores'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : '') + location.hash); } catch (e) { /* sem history: o parâmetro fica no endereço */ }
    return true;
})();
// Alguns navegadores (janela privada de versões antigas) deixam o IndexedDB pendurado sem responder: nunca esperar além do limite.
const _embComLimite = (promessa, ms, padrao) => Promise.race([promessa, new Promise(res => setTimeout(() => res(padrao), ms))]);

async function _embApagarTudo() {
    _embCacheMem = {}; _embSujos = new Set(); clearTimeout(_embTimer); _embTimer = null;
    try { localStorage.removeItem(_EMB_CACHE_KEY); } catch (e) { /* sem localStorage */ }
    await _embComLimite(KV.delPrefixo(_EMB_IDB_PREFIXO), 5000, false);
}
async function forcarVetoresDoServidor() { await _embApagarTudo(); location.reload(); }

// Lê o cache salvo: primeiro o IndexedDB; depois o formato antigo do localStorage (que, se o IndexedDB funciona, é migrado
// e apagado para liberar o espaço). Uma entrada corrompida é ignorada sozinha -- antes uma só derrubava o cache inteiro.
async function _embCarregar() {
    if (_embForcar) { BSOFT_VETORES.forcado = true; await _embApagarTudo(); }
    let idbOk = false;
    try {
        const pares = await _embComLimite(KV.todos(_EMB_IDB_PREFIXO), 5000, null);
        if (pares) {
            idbOk = true;
            pares.forEach(([k, reg]) => {
                if (reg && reg.v && reg.v.length === 1024) _embCacheMem[String(k).slice(_EMB_IDB_PREFIXO.length)] = { vetor: Array.from(reg.v), hash: reg.h || null };
            });
        }
    } catch (e) { idbOk = false; }
    _embUsaIdb = idbOk;
    let legado = 0;
    try {
        const raw = localStorage.getItem(_EMB_CACHE_KEY);
        if (raw) {
            for (const [id, entry] of Object.entries(JSON.parse(raw))) {
                if (_embCacheMem[id]) continue;
                try {
                    const e = typeof entry === 'string' ? { v: entry, h: null } : entry;
                    if (e && e.v) { _embCacheMem[id] = { vetor: _b64ToEmb(e.v), hash: e.h || null }; if (idbOk) _embSujos.add(id); legado++; }
                } catch (e2) { /* só esta entrada */ }
            }
        }
    } catch (e) { /* JSON ilegível: ignora o formato antigo */ }
    BSOFT_VETORES.persistencia = idbOk ? 'indexeddb' : 'localstorage';
    if (idbOk && legado > 0) {
        BSOFT_VETORES.migrados = legado;
        if (await _embGravarIdb()) { try { localStorage.removeItem(_EMB_CACHE_KEY); } catch (e) { /* ok */ } }
    }
    BSOFT_VETORES.cacheLocal = Object.keys(_embCacheMem).length;
}
const _embCachePronto = _embCarregar().catch(() => { BSOFT_VETORES.persistencia = 'memoria'; });

// Grava os ids alterados numa transação só. Se o IndexedDB recusar, passa a usar o localStorage (formato antigo).
async function _embGravarIdb() {
    const ids = Array.from(_embSujos); _embSujos = new Set();
    if (!ids.length) return true;
    const pares = ids.filter(id => _embCacheMem[id]).map(id => [_EMB_IDB_PREFIXO + id, { v: new Float32Array(_embCacheMem[id].vetor), h: _embCacheMem[id].hash }]);
    if (await _embComLimite(KV.setVarios(pares), 8000, false)) return true;
    ids.forEach(id => _embSujos.add(id));
    return false;
}
// Plano B (IndexedDB bloqueado, ex.: janela anônima): um JSON só no localStorage, gravado de uma vez. Se não couber, grava
// só uma parte (vai diminuindo) -- o que ficar de fora é baixado do servidor na próxima abertura, não revetorizado.
const _embCod = {}; // vetores já codificados em base64 (só o plano B usa): evita recodificar o cache inteiro a cada gravação
let _embSemArmazenamento = false; // nem o localStorage aceitou nada: para de tentar (o servidor refaz o cache na próxima abertura)
function _embGravarLocalStorage() {
    if (_embSemArmazenamento) return;
    const ids = Object.keys(_embCacheMem);
    ids.forEach(id => { const c = _embCod[id], e = _embCacheMem[id]; if (!c || c.vetor !== e.vetor) _embCod[id] = { vetor: e.vetor, v: _embToB64(e.vetor) }; });
    for (let n = ids.length; n > 0; n = Math.floor(n * 0.8)) {
        try {
            const parte = {}; ids.slice(0, n).forEach(id => { parte[id] = { v: _embCod[id].v, h: _embCacheMem[id].hash }; });
            localStorage.setItem(_EMB_CACHE_KEY, JSON.stringify(parte));
            BSOFT_VETORES.persistencia = n === ids.length ? 'localstorage' : 'localstorage-parcial (' + n + ' de ' + ids.length + ')';
            return;
        } catch (e) { /* cheio: tenta com menos */ }
    }
    _embSemArmazenamento = true;
    BSOFT_VETORES.persistencia = 'memoria (sem armazenamento local)';
}
async function _embGravarAgora() {
    clearTimeout(_embTimer); _embTimer = null;
    await _embCachePronto;
    if (!_embSujos.size) return;
    if (_embUsaIdb && await _embGravarIdb()) return;
    _embUsaIdb = false; _embSujos = new Set();
    _embGravarLocalStorage();
}
function _saveEmbToCache(id, vec, hash) {
    if (!id || !vec) return;
    const hashFinal = hash || _embCacheMem[id]?.hash || null;
    _embCacheMem[id] = { vetor: vec, hash: hashFinal };
    _embSujos.add(String(id));
    if (!_embTimer) _embTimer = setTimeout(_embGravarAgora, 600); // junta as gravações em lote (antes cada vetor reescrevia o cache inteiro)
}
function _getEmbFromCache(id) { return _embCacheMem[String(id)]?.vetor || null; }
function _getEmbHashFromCache(id) { return _embCacheMem[String(id)]?.hash || null; }

// Busca no servidor (Supabase) o vetor dos artigos que NÃO estão no cache local, em lotes pequenos e com tentativas -- um
// pedido gigante único (~7 MB) estourava o limite de tempo do banco em conexão lenta, e o erro era ignorado. Só o que o servidor
// também não tiver (ou tiver inválido) é que vai para a Jina.
async function _embBaixarDoServidor(ids, aoProgresso) {
    const LOTE = 60, PARALELO = 3, TENTATIVAS = 3;
    const lotes = []; for (let i = 0; i < ids.length; i += LOTE) lotes.push(ids.slice(i, i + LOTE));
    let baixados = 0, falhas = 0, feitos = 0, prox = 0;
    const baixarLote = async (lote) => {
        for (let t = 0; t < TENTATIVAS; t++) {
            try {
                const { data, error } = await sb.from('BancoDados').select('id, embedding').in('id', lote);
                if (error) throw error;
                (data || []).forEach(r => {
                    let vec = r.embedding;
                    if (typeof vec === 'string') { try { vec = JSON.parse(vec); } catch (e) { return; } }
                    // Só aceita vetores Jina (1024 dims) — ignora vetores Gemini antigos (3072 dims)
                    if (Array.isArray(vec) && vec.length === 1024) { _saveEmbToCache(r.id, vec); baixados++; }
                });
                return;
            } catch (e) { if (t === TENTATIVAS - 1) { falhas++; console.warn('[vetores] lote do servidor falhou:', e && (e.message || e)); } else await new Promise(r => setTimeout(r, 800 * (t + 1))); }
        }
    };
    const trabalhador = async () => {
        while (prox < lotes.length) {
            const lote = lotes[prox++];
            await baixarLote(lote);
            feitos += lote.length;
            if (aoProgresso) aoProgresso(Math.min(feitos, ids.length), ids.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(PARALELO, lotes.length) }, trabalhador));
    BSOFT_VETORES.servidor += baixados; BSOFT_VETORES.falhasServidor += falhas;
    return { baixados, falhas };
}

function _embResumo() {
    const v = BSOFT_VETORES;
    return `Vetores da busca: ${v.cacheLocal} do cache deste navegador, ${v.servidor} baixados do servidor, ${v.jina} gerados agora. Cache local: ${v.persistencia}.` + (v.falhasServidor ? ` ${v.falhasServidor} lote(s) do servidor falharam.` : '');
}

// Remove caches antigos de versões anteriores para liberar espaço no localStorage
['bsoft_emb_v1','bsoft_emb_v2'].forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
