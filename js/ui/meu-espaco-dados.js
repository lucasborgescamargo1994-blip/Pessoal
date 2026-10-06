/* js/ui/meu-espaco-dados.js — Meu Espaço: armazenamento local em pasta escolhida pelo usuário. */
'use strict';
/* ═══ Meu Espaço — armazenamento LOCAL ══════════════════════════════════════
   Os dados ficam numa pasta que o próprio usuário escolhe (File System Access API), fora da pasta
   temporária do navegador: sobrevivem a limpeza do PC, "limpar dados de navegação" e troca de
   navegador (basta escolher a mesma pasta de novo). A "alça" da pasta é guardada no IndexedDB;
   um espelho no localStorage deixa a tela abrir instantânea e evita perda se a pasta sumir.
   NADA daqui é enviado para a rede: nem Supabase, nem IA, nem telemetria. ═══════════════════ */
const MeuEspaco = (() => {
    const FILE = 'meu-espaco.json', DIR_BK = 'backups', README = 'LEIAME.txt';
    const LS_CACHE = 'bsoft_meuespaco_cache_v1';
    const DB = 'bsoft_meu_espaco', STORE = 'kv', HKEY = 'dirHandle';
    const SUPPORTED = typeof window.showDirectoryPicker === 'function';
    const DAY = 864e5;
    const subs = [];
    const blank = () => ({ app: 'bsoft-meu-espaco', schema: 1, createdAt: Date.now(), savedAt: 0, seeded: false, notes: [], tasks: [], prefs: null, prefsUpdated: 0 });
    let store = blank(), handle = null, folder = '', status = SUPPORTED ? 'init' : 'sem-suporte', lastErr = '';
    let lastMod = 0, saving = false, dirty = false, lastSaved = 0, lastBackupAt = 0, poller = 0, cacheFail = false, loaded = false;

    const emit = (type, arg) => subs.forEach(fn => { try { fn(type, arg); } catch (e) { console.warn('[v27] meu-espaço listener', e); } });
    const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sigList = l => (l || []).map(n => n.id + ':' + (n.updated || 0) + ':' + (n.deleted || 0) + (n.purged ? 'p' : '')).sort().join('|');
    const sig = s => sigList(s.notes) + '~' + sigList(s.tasks) + '#' + (s.prefsUpdated || 0);
    function describe(e) {
        const n = e && e.name;
        if (n === 'NotAllowedError' || n === 'SecurityError') return 'O navegador perdeu a permissão de acesso à pasta.';
        if (n === 'NotFoundError') return 'A pasta não foi encontrada (foi movida, renomeada ou apagada).';
        if (n === 'QuotaExceededError') return 'Sem espaço em disco para gravar.';
        if (n === 'NoModificationAllowedError' || n === 'InvalidStateError') return 'O arquivo está em uso por outro programa. Tente de novo em instantes.';
        return (e && e.message) || 'Erro desconhecido ao acessar a pasta.';
    }

    /* IndexedDB: só guarda a alça da pasta ------------------------------------ */
    const idb = () => new Promise((res, rej) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
    const idbGet = async k => { const db = await idb(); return new Promise((res, rej) => { const rq = db.transaction(STORE).objectStore(STORE).get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); };
    const idbSet = async (k, v) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); };
    const idbDel = async k => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); };

    /* espelho local: IndexedDB (quota grande; o localStorage já é bem ocupado pelo cache de embeddings da IA) --- */
    const validStore = j => !!(j && j.app === 'bsoft-meu-espaco' && Array.isArray(j.notes));
    async function readCache() {
        try { const j = await idbGet('cache'); if (validStore(j)) return j; } catch (e) { /* sem IndexedDB */ }
        try { const j = JSON.parse(lsGet(LS_CACHE, 'null')); return validStore(j) ? j : null; } catch (e) { return null; }   // espelho antigo / plano B
    }
    async function doCache() {
        try { await idbSet('cache', store); cacheFail = false; try { localStorage.removeItem(LS_CACHE); } catch (e) { /* ok */ } }
        catch (e) {
            const s = JSON.stringify(store);   // IndexedDB indisponível: plano B no localStorage, só se for pequeno
            if (s.length < 300000 && lsSet(LS_CACHE, s)) cacheFail = false;
            else if (!cacheFail) { cacheFail = true; emit('status'); }
        }
    }
    const writeCache = debounce(doCache, 250);

    /* mesclagem: por nota, vale a alteração mais recente (e apagar também é uma alteração) -- */
    const better = (n, cur) => (cur.seed && !n.seed) ? true : (n.seed && !cur.seed) ? false : (n.updated || 0) > (cur.updated || 0);
    // tarefas: vale a alteração mais recente de cada uma (a agenda não tem "semente"). Tudo que vem do disco/backup passa por cleanTask: dado estranho vira dado válido.
    const fixTask = t => (t.purged ? t : Object.assign({}, t, cleanTask(t)));
    function mergeTasks(local, disk) {
        const map = new Map();
        [...(Array.isArray(disk) ? disk : []), ...(Array.isArray(local) ? local : [])].forEach(t => { if (!t || typeof t.id !== 'string' || !t.id) return; const cur = map.get(t.id); if (!cur || (t.updated || 0) > (cur.updated || 0)) map.set(t.id, fixTask(t)); });
        return Array.from(map.values());
    }
    function merge(local, disk) {
        const map = new Map();
        [...(disk.notes || []), ...(local.notes || [])].forEach(n => { if (!n || !n.id) return; const cur = map.get(n.id); if (!cur || better(n, cur)) map.set(n.id, n); });
        const out = Object.assign(blank(), disk);
        out.notes = Array.from(map.values());
        out.tasks = mergeTasks(local.tasks, disk.tasks);
        out.createdAt = Math.min(local.createdAt || Infinity, disk.createdAt || Infinity); if (!isFinite(out.createdAt)) out.createdAt = Date.now();
        out.seeded = !!(local.seeded || disk.seeded);
        if ((local.prefsUpdated || 0) > (disk.prefsUpdated || 0)) { out.prefs = local.prefs; out.prefsUpdated = local.prefsUpdated; }
        return out;
    }
    function housekeeping() {   // lixeira guarda 30 dias; marcas de exclusão somem depois de 90
        const now = Date.now();
        store.notes.forEach(n => { if (n.deleted && !n.purged && now - n.deleted > 30 * DAY) { n.title = ''; n.body = ''; n.tags = []; n.purged = true; } });
        store.notes = store.notes.filter(n => !(n.purged && now - (n.deleted || 0) > 90 * DAY));
        if (!Array.isArray(store.tasks)) store.tasks = [];
        store.tasks.forEach(t => { if (t.deleted && !t.purged && now - t.deleted > 30 * DAY) { t.title = ''; t.notes = ''; t.owner = ''; t.tags = []; t.purged = true; } });
        store.tasks = store.tasks.filter(t => !(t.purged && now - (t.deleted || 0) > 90 * DAY));
    }

    /* disco ------------------------------------------------------------------- */
    async function quarantine(text) {   // arquivo ilegível: guarda uma cópia antes de qualquer sobrescrita
        try { const dir = await handle.getDirectoryHandle(DIR_BK, { create: true }); const fh = await dir.getFileHandle(`ilegivel-${stamp()}.json`, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close(); } catch (e) { /* sem espaço: segue */ }
    }
    async function readDisk() {
        try {
            const fh = await handle.getFileHandle(FILE), f = await fh.getFile(), text = await f.text();
            let j; try { j = JSON.parse(text); } catch (e) { await quarantine(text); return { corrupt: true }; }
            if (!j || j.app !== 'bsoft-meu-espaco' || !Array.isArray(j.notes)) { await quarantine(text); return { corrupt: true }; }
            return { data: j, modified: f.lastModified };
        } catch (e) { if (e && e.name === 'NotFoundError') return { missing: true }; throw e; }
    }
    async function writeReadme() {
        try {
            await handle.getFileHandle(README);   // já existe: não mexe
        } catch (e) {
            try {
                const fh = await handle.getFileHandle(README, { create: true }), w = await fh.createWritable();
                await w.write(['MEU ESPAÇO — Suporte Bsoft TMS', '==============================', '',
                    'Esta pasta guarda as suas anotações e a sua agenda de tarefas do sistema de suporte da Bsoft.', '',
                    '  meu-espaco.json   -> suas anotações, tarefas (agenda) e preferências (arquivo principal)',
                    '  backups\\          -> cópias automáticas (uma por dia; ficam as últimas 14)', '',
                    'IMPORTANTE',
                    ' * Estes dados ficam SÓ no seu computador. O sistema não envia suas anotações para a internet,',
                    '   para o banco de dados da empresa, nem para a IA.',
                    ' * Pode abrir o meu-espaco.json no Bloco de Notas para ler, mas não edite com o sistema aberto.',
                    ' * Trocou de navegador ou de computador? Abra o Meu Espaço, clique em "Escolher pasta" e selecione',
                    '   ESTA mesma pasta: suas notas voltam.',
                    ' * Apagou algo sem querer? A nota fica 30 dias na Lixeira do Meu Espaço. E a pasta "backups" tem',
                    '   as cópias diárias (copie uma delas por cima do meu-espaco.json).',
                    ' * Não apague nem renomeie esta pasta.', ''].join('\r\n'));
                await w.close();
            } catch (e2) { /* não é essencial */ }
        }
    }
    async function dailyBackup(text) {
        if (Date.now() - lastBackupAt < 30 * 60e3) return;
        lastBackupAt = Date.now();
        const dir = await handle.getDirectoryHandle(DIR_BK, { create: true });
        const fh = await dir.getFileHandle(`meu-espaco-${new Date().toISOString().slice(0, 10)}.json`, { create: true });
        const w = await fh.createWritable(); await w.write(text); await w.close();
        const names = []; for await (const [name] of dir.entries()) if (/^meu-espaco-\d{4}-\d{2}-\d{2}\.json$/.test(name)) names.push(name);
        names.sort().slice(0, Math.max(0, names.length - 14)).forEach(n => dir.removeEntry(n).catch(() => {}));
    }
    async function writeDisk() {
        housekeeping(); store.savedAt = Date.now();
        const text = JSON.stringify(store, null, 1);
        const fh = await handle.getFileHandle(FILE, { create: true }), w = await fh.createWritable();
        await w.write(text); await w.close();
        lastMod = (await fh.getFile()).lastModified; lastSaved = Date.now();
        try { await dailyBackup(text); } catch (e) { console.warn('[v27] backup diário', e); }
    }
    async function flush() {
        writeCache();
        if (status !== 'conectado') { lastSaved = Date.now(); emit('saved'); return; }
        if (saving) { dirty = true; return; }
        saving = true; dirty = false; emit('saving');
        try { await writeDisk(); lastErr = ''; }
        catch (e) { lastErr = describe(e); status = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'permissao' : 'erro'; emit('status'); }
        saving = false; emit('saved');
        if (dirty) flushSoon();
    }
    const flushSoon = debounce(flush, 600);

    /* conexão ----------------------------------------------------------------- */
    function applyPrefsFromStore() {   // vale a versão mais nova das preferências, a deste navegador ou a da pasta
        const lp = Prefs.get('updated') || 0;
        if (store.prefs && (store.prefsUpdated || 0) > lp) { if (Prefs.adopt(store.prefs) && V.afterPrefs) V.afterPrefs(); }
        else if (lp > (store.prefsUpdated || 0)) { store.prefs = JSON.parse(JSON.stringify(Prefs.all())); store.prefsUpdated = lp; }
    }
    const seedNote = () => ({ id: 'welcome-note-v1', seed: true, title: 'Bem-vindo ao Meu Espaço 👋', pinned: true, color: 'amber', tags: ['guia'], created: Date.now(), updated: Date.now(), deleted: 0,
        body: ['# Bem-vindo ao Meu Espaço', 'Este é o seu bloco de anotações pessoal. O que você escreve aqui fica **só no seu computador**, na pasta que você escolheu — nada vai para a internet.', '',
            '## O que dá para fazer', '- [x] Criar notas rápidas, listas e passo a passo', '- [ ] Marcar com etiquetas e fixar as mais importantes', '- [ ] Guardar uma resposta da IA com o botão "Meu Espaço"',
            '- [ ] Abrir o Meu Espaço ao lado de outra aba (botão de dividir a tela)', '', '## Dica', 'Use `Ctrl+K` para achar qualquer nota rapidamente.'].join('\n') });
    function seedIfNeeded() {
        if (store.seeded) return;
        store.seeded = true;
        if (!store.notes.some(n => !n.deleted)) store.notes.push(seedNote());
    }
    let listening = false;
    function startPolling() {
        clearInterval(poller); poller = setInterval(pollExternal, 15000);
        if (listening) return; listening = true;   // quem volta para a aba/janela já vê o que outra janela gravou
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollExternal(); });
        window.addEventListener('focus', pollExternal);
        window.addEventListener('pagehide', () => { try { writeCache.flush(); } catch (e) { /* ok */ } });
    }
    async function pollExternal() {
        if (status !== 'conectado' || saving || document.visibilityState === 'hidden') return;
        try {
            const fh = await handle.getFileHandle(FILE), f = await fh.getFile();
            if (f.lastModified !== lastMod) await reload(true);   // qualquer mudança no arquivo (de outro navegador, outra aba, sincronização)
        } catch (e) {
            if (e && e.name === 'NotFoundError') { dirty = true; flushSoon(); }
            else { lastErr = describe(e); status = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'permissao' : 'erro'; emit('status'); }
        }
    }
    async function reload(external) {
        const r = await readDisk();
        if (!r.data) return;
        const merged = merge(store, r.data), changed = sig(merged) !== sig(store);
        store = merged; lastMod = r.modified; applyPrefsFromStore(); writeCache();
        if (sig(merged) !== sig(r.data)) flushSoon();
        if (changed) emit('data', !!external);
    }
    async function attach(h, o = {}) {
        handle = h; folder = h.name || 'pasta'; lastErr = '';
        if (!o.keep) { try { await idbSet(HKEY, h); } catch (e) { /* sem IndexedDB: precisará escolher de novo na próxima vez */ } }
        status = 'conectado';
        let r;
        try { r = await readDisk(); } catch (e) { lastErr = describe(e); status = (e && e.name === 'NotFoundError') ? 'erro' : 'permissao'; emit('status'); throw e; }
        const before = store.notes.filter(n => !n.deleted).length;
        const found = !!r.data, diskCount = r.data ? r.data.notes.filter(n => !n.deleted).length : 0;
        if (r.data) { store = merge(store, r.data); lastMod = r.modified; }
        applyPrefsFromStore(); seedIfNeeded();
        try { await writeDisk(); await writeReadme(); } catch (e) { lastErr = describe(e); status = 'erro'; emit('status'); throw e; }
        startPolling(); loaded = true;
        emit('status'); emit('data');
        return { found, diskCount, localCount: before, corrupt: !!r.corrupt };
    }
    async function init() {
        const c = await readCache(); if (c) store = merge(store, Object.assign(blank(), c));
        if (!SUPPORTED) { status = 'sem-suporte'; seedIfNeeded(); writeCache(); loaded = true; emit('status'); emit('data'); return; }
        let h = null;
        try { h = await idbGet(HKEY); } catch (e) { /* IndexedDB bloqueado */ }
        if (!h) { status = 'sem-pasta'; seedIfNeeded(); writeCache(); loaded = true; emit('status'); emit('data'); return; }
        handle = h; folder = h.name || 'pasta';
        try {
            if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') await attach(h, { keep: true });
            else { status = 'permissao'; loaded = true; emit('status'); emit('data'); }
        } catch (e) { lastErr = describe(e); if (status === 'conectado' || status === 'init') status = 'erro'; loaded = true; emit('status'); emit('data'); }
    }
    async function chooseFolder() {
        if (!SUPPORTED) throw new Error('Este navegador não permite escolher uma pasta.');
        let h;
        try { h = await window.showDirectoryPicker({ id: 'bsoft-meu-espaco', mode: 'readwrite', startIn: 'documents' }); }
        catch (e) { if (e && e.name === 'AbortError') return null; throw e; }
        return attach(h);
    }
    async function reconnect() {
        if (!handle) return chooseFolder();
        try { if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') return await attach(handle, { keep: true }); } catch (e) { lastErr = describe(e); }
        status = 'permissao'; emit('status'); return null;
    }
    async function forget() {
        try { await idbDel(HKEY); } catch (e) { /* ok */ }
        clearInterval(poller); handle = null; folder = ''; status = SUPPORTED ? 'sem-pasta' : 'sem-suporte'; lastErr = '';
        emit('status');
    }

    /* notas ------------------------------------------------------------------- */
    const byId = id => store.notes.find(n => n.id === id) || null;
    const live = () => store.notes.filter(n => !n.deleted);
    const trashed = () => store.notes.filter(n => n.deleted && !n.purged);
    const touch = quiet => { writeCache(); flushSoon(); if (!quiet) emit('data'); };
    function create(p = {}) {
        const now = Date.now();
        const n = { id: uid(), title: p.title || '', body: p.body || '', tags: p.tags || [], color: p.color || '', pinned: !!p.pinned, created: now, updated: now, deleted: 0 };
        store.notes.push(n); touch(); return n;
    }
    function update(id, patch, o = {}) {
        const n = byId(id); if (!n) return null;
        Object.assign(n, patch, { updated: Date.now() }); delete n.seed; touch(!!o.quiet); return n;
    }
    function remove(id) { const n = byId(id); if (!n) return; n.deleted = Date.now(); n.updated = n.deleted; touch(); }
    function restore(id) { const n = byId(id); if (!n) return; n.deleted = 0; n.updated = Date.now(); touch(); }
    function purge(id) { const n = byId(id); if (!n) return; n.title = ''; n.body = ''; n.tags = []; n.purged = true; n.deleted = n.deleted || Date.now(); n.updated = Date.now(); touch(); }
    function search(q, limit = 8) {
        const nq = norm((q || '').trim()), list = live();
        if (!nq) return list.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, limit);
        return list.map(n => ({ n, s: noteScore(nq, n) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s || (b.n.updated || 0) - (a.n.updated || 0)).slice(0, limit).map(x => x.n);
    }
    function noteScore(nq, n) {
        const t = norm(n.title), b = norm(n.body), g = norm((n.tags || []).join(' '));
        let s = 0;
        for (const tk of nq.split(/\s+/).filter(Boolean)) {
            const a = t.includes(tk) ? 10 : 0, c = g.includes(tk) ? 6 : 0, d = b.includes(tk) ? 2 : 0;
            if (!a && !c && !d) return 0; s += a + c + d;
        }
        return s;
    }
    /* tarefas da agenda (mesma pasta, mesma regra: só no computador do usuário) ------------------------- */
    const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/, RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
    const PRIOS = ['low', 'med', 'high'], STATUS = ['todo', 'doing', 'done'], REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'];
    const cut = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n);
    const dataOk = s => { const m = RE_DATA.exec(s || ''); if (!m) return false; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]; };
    function cleanTask(p, base) {   // nada que chegue da tela, de um backup ou da pasta entra na agenda sem passar por aqui
        const t = Object.assign({}, base || {}, p || {}), o = {};
        o.title = cut(t.title, 200).replace(/\n/g, ' ');
        o.notes = cut(t.notes, 4000);
        o.owner = cut(t.owner, 60).replace(/\n/g, ' ');
        o.date = dataOk(t.date) ? t.date : '';
        o.end = o.date && dataOk(t.end) && t.end > o.date ? t.end : '';
        o.time = o.date && RE_HORA.test(t.time || '') ? t.time : '';
        o.prio = PRIOS.includes(t.prio) ? t.prio : 'med';
        o.status = STATUS.includes(t.status) ? t.status : 'todo';
        o.tags = Array.from(new Set((Array.isArray(t.tags) ? t.tags : []).map(x => cut(x, 24).toLowerCase()).filter(Boolean))).slice(0, 8);
        const r = Math.round(Number(t.remind)); o.remind = Number.isFinite(r) ? clamp(r, -1, 10080) : -1;   // minutos antes do horário; -1 = sem aviso
        o.repeat = o.date && REPEATS.includes(t.repeat) ? t.repeat : 'none';
        o.until = o.repeat !== 'none' && dataOk(t.until) && t.until >= o.date ? t.until : '';
        o.doneOn = Array.from(new Set((Array.isArray(t.doneOn) ? t.doneOn : []).filter(dataOk))).sort().slice(-400);
        return o;
    }
    const taskById = id => store.tasks.find(t => t.id === id) || null;
    const liveTasks = () => store.tasks.filter(t => !t.deleted);
    const trashedTasks = () => store.tasks.filter(t => t.deleted && !t.purged);
    function createTask(p = {}) {
        const now = Date.now(), c = cleanTask(p);
        const t = Object.assign({ id: uid(), created: now, updated: now, deleted: 0, doneAt: c.status === 'done' ? now : 0 }, c);
        store.tasks.push(t); touch(); return t;
    }
    function updateTask(id, patch, o = {}) {
        const t = taskById(id); if (!t || t.purged) return null;
        const c = cleanTask(patch, t), now = Date.now();
        if (c.status === 'done' && t.status !== 'done') t.doneAt = now; else if (c.status !== 'done' && t.status === 'done') t.doneAt = 0;
        Object.assign(t, c, { updated: now }); touch(!!o.quiet); return t;
    }
    function removeTask(id) { const t = taskById(id); if (!t) return; t.deleted = Date.now(); t.updated = t.deleted; touch(); }
    function restoreTask(id) { const t = taskById(id); if (!t) return; t.deleted = 0; t.updated = Date.now(); touch(); }
    function purgeTask(id) { const t = taskById(id); if (!t) return; t.title = ''; t.notes = ''; t.owner = ''; t.tags = []; t.purged = true; t.deleted = t.deleted || Date.now(); t.updated = Date.now(); touch(); }

    function setPrefs(p) { store.prefs = JSON.parse(JSON.stringify(p)); store.prefsUpdated = p.updated || Date.now(); writeCache(); flushSoon(); }

    /* backup manual ------------------------------------------------------------ */
    function exportFile() {
        const blob = new Blob([JSON.stringify(store, null, 1)], { type: 'application/json' });
        const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `meu-espaco-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
        Toast.show('Backup baixado. Guarde o arquivo em um lugar seguro.', { kind: 'ok', icon: 'download' });
    }
    async function importFile(file) {
        const j = JSON.parse(await file.text());
        if (!j || j.app !== 'bsoft-meu-espaco' || !Array.isArray(j.notes)) throw new Error('Esse arquivo não é um backup do Meu Espaço.');
        const before = live().length, beforeT = liveTasks().length; store = merge(store, j); store.seeded = true; touch();
        return { added: Math.max(0, live().length - before), total: j.notes.filter(n => !n.deleted).length,
            tasksAdded: Math.max(0, liveTasks().length - beforeT), tasksTotal: (Array.isArray(j.tasks) ? j.tasks : []).filter(t => t && !t.deleted).length };
    }

    const info = () => ({ status, folder, lastErr, lastSaved, supported: SUPPORTED, count: live().length, tasks: liveTasks().length, trash: trashed().length, saving, cacheFail, loaded });
    const attention = () => status === 'permissao' || status === 'erro' || (status === 'sem-pasta' && live().some(n => !n.seed));
    const matches = (q, n) => { const nq = norm((q || '').trim()); return !nq || noteScore(nq, n) > 0; };
    return { init, on: fn => { subs.push(fn); }, info, attention, notes: live, trashed, byId, create, update, remove, restore, purge, search, matches, setPrefs,
        tasks: liveTasks, trashedTasks, taskById, createTask, updateTask, removeTask, restoreTask, purgeTask, cleanTask,
        chooseFolder, reconnect, forget, exportFile, importFile, flush, refresh: pollExternal, attach };
})();
V.MeuEspaco = window.MeuEspaco = MeuEspaco;
