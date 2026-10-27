/* js/core/storage-idb.js — Pequeno "chave → valor" em IndexedDB (cabe muito mais dado que o localStorage,
   que já está cheio de vetores da IA). Usado para o índice das respostas rápidas e seus vetores (KV) e, na Área
   Administrativa, para guardar a "alça" dos arquivos de configuração (ADM.kv — banco separado).
   Se o IndexedDB estiver bloqueado (janela anônima, por exemplo), as funções falham em silêncio (devolvem null). */
function criarKV(nomeBanco) {
    const DB = nomeBanco, STORE = 'kv';
    let abrindo = null;
    function abrir() {
        if (abrindo) return abrindo;
        abrindo = new Promise((res, rej) => {
            try {
                const r = indexedDB.open(DB, 1);
                r.onupgradeneeded = () => r.result.createObjectStore(STORE);
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error);
            } catch (e) { rej(e); }
        });
        abrindo.catch(() => { abrindo = null; });
        return abrindo;
    }
    async function get(chave) {
        try {
            const db = await abrir();
            return await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(chave); q.onsuccess = () => res(q.result === undefined ? null : q.result); q.onerror = () => rej(q.error); });
        } catch (e) { return null; }
    }
    async function set(chave, valor) {
        try {
            const db = await abrir();
            return await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(valor, chave); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); });
        } catch (e) { return false; }
    }
    async function del(chave) {
        try {
            const db = await abrir();
            return await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(chave); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); });
        } catch (e) { return false; }
    }
    async function limpar() {   // apaga tudo deste banco (sem precisar fechar a conexão)
        try {
            const db = await abrir();
            return await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); });
        } catch (e) { return false; }
    }
    // Em lote (usado pelo cache de vetores): várias gravações numa transação só, e leitura/remoção por prefixo da chave.
    async function setVarios(pares) {   // pares = [[chave, valor], ...] → true/false
        try {
            const db = await abrir();
            return await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'), os = tx.objectStore(STORE); pares.forEach(([k, v]) => os.put(v, k)); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
        } catch (e) { return false; }
    }
    async function todos(prefixo) {     // [[chave, valor], ...] das chaves que começam com o prefixo; null se o IndexedDB não abre (diferente de "vazio" = [])
        try {
            const db = await abrir();
            return await new Promise((res, rej) => {
                const saida = [], q = db.transaction(STORE).objectStore(STORE).openCursor(prefixo ? IDBKeyRange.bound(prefixo, prefixo + '￿') : null);
                q.onsuccess = () => { const c = q.result; if (c) { saida.push([c.key, c.value]); c.continue(); } else res(saida); };
                q.onerror = () => rej(q.error);
            });
        } catch (e) { return null; }
    }
    async function delPrefixo(prefixo) { // apaga todas as chaves que começam com o prefixo
        try {
            const db = await abrir();
            return await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(IDBKeyRange.bound(prefixo, prefixo + '￿')); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); });
        } catch (e) { return false; }
    }
    return { get, set, del, limpar, setVarios, todos, delPrefixo };
}
const KV = criarKV('bsoft_app_cache');
