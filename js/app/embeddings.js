/* js/app/embeddings.js — Cache local dos vetores da base de conhecimento (a chamada à Jina fica em js/core/embeddings-api.js). */

// ═══════════════════════════════════════════════════════════
//  CACHE LOCAL DE EMBEDDINGS (evita baixar vetores do Supabase a cada carga)
// ═══════════════════════════════════════════════════════════
const _EMB_CACHE_KEY = 'bsoft_emb_v3'; // v3 = migração Gemini → Jina (1024 dims)
let _embCacheMem = {}; // id -> { vetor:number[], hash:string|null }

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
function _loadEmbCache() {
    try {
        const raw = localStorage.getItem(_EMB_CACHE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        for (const [id, entry] of Object.entries(obj)) {
            // Formato antigo (só o vetor em base64, sem hash) continua lendo normal -- só ganha
            // hash na próxima vez que passar por carregarVetoresExistentes (backfill oportunista).
            if (typeof entry === 'string') _embCacheMem[id] = { vetor: _b64ToEmb(entry), hash: null };
            else if (entry && entry.v) _embCacheMem[id] = { vetor: _b64ToEmb(entry.v), hash: entry.h || null };
        }
    } catch(e) { _embCacheMem = {}; }
}
function _saveEmbToCache(id, vec, hash) {
    if (!id || !vec) return;
    const hashFinal = hash || _embCacheMem[id]?.hash || null;
    _embCacheMem[id] = { vetor: vec, hash: hashFinal };
    try {
        const raw = localStorage.getItem(_EMB_CACHE_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        obj[String(id)] = { v: _embToB64(vec), h: hashFinal };
        localStorage.setItem(_EMB_CACHE_KEY, JSON.stringify(obj));
    } catch(e) {} // localStorage cheio — mantém apenas em memória
}
function _getEmbFromCache(id) { return _embCacheMem[String(id)]?.vetor || null; }
function _getEmbHashFromCache(id) { return _embCacheMem[String(id)]?.hash || null; }
_loadEmbCache();
// Remove caches antigos de versões anteriores para liberar espaço no localStorage
['bsoft_emb_v1','bsoft_emb_v2'].forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
