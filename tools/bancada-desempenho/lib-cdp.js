'use strict';
// Biblioteca mínima de Chrome DevTools Protocol (Node 22 do Electron do VS Code) para medir desempenho REAL no Edge desta máquina.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
// endereço do app: o servidor local do projeto (tools\servidor-local.bat) ou a variável BSOFT_URL
const URL_APP = process.env.BSOFT_URL || 'http://localhost:8080/index.html?sim=1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function lancar({ porta = 9333, gpu = true, w = 1440, h = 900, args = [] } = {}) {
    const dir = path.join(os.tmpdir(), 'edge-bench-' + porta);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ok */ }
    const a = [
        '--remote-debugging-port=' + porta, '--user-data-dir=' + dir, '--window-size=' + w + ',' + h, '--window-position=20,20',
        '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
        '--disable-component-update', '--disable-default-apps', '--hide-crash-restore-bubble', '--disable-features=msEdgeSidebarV2,Translate,msWebOOUI,msEdgeEnhanceImages',
        ...(gpu ? [] : ['--disable-gpu']), ...args, 'about:blank'
    ];
    const p = spawn(EDGE, a, { stdio: 'ignore' });
    for (let i = 0; i < 150; i++) {
        try { const r = await fetch('http://127.0.0.1:' + porta + '/json/version'); if (r.ok) return p; } catch (e) { /* ainda subindo */ }
        await sleep(200);
    }
    throw new Error('Edge nao subiu');
}

class Cdp {
    constructor(url) { this.url = url; this.id = 0; this.pend = new Map(); this.ev = new Map(); }
    async conectar() {
        this.ws = new WebSocket(this.url);
        await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
        this.ws.onmessage = m => {
            const d = JSON.parse(m.data);
            if (d.id) { const p = this.pend.get(d.id); if (p) { this.pend.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } }
            else if (d.method) { (this.ev.get(d.method) || []).forEach(f => f(d.params)); }
        };
    }
    send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pend.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
    on(m, f) { if (!this.ev.has(m)) this.ev.set(m, []); this.ev.get(m).push(f); }
    off(m) { this.ev.delete(m); }
    async eval(expr) {
        const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.exceptionDetails).slice(0, 600));
        return r.result.value;
    }
    fechar() { try { this.ws.close(); } catch (e) { /* ok */ } }
}

async function abrirPagina(porta) {
    const lista = await (await fetch('http://127.0.0.1:' + porta + '/json/list')).json();
    const pg = lista.find(t => t.type === 'page');
    const c = new Cdp(pg.webSocketDebuggerUrl); await c.conectar(); return c;
}

async function navegar(c, url) {
    await c.send('Page.enable');
    try { await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true }); } catch (e) { /* sem rede */ }   // sempre os arquivos do disco, nunca cópia antiga
    const carregou = new Promise(r => c.on('Page.loadEventFired', r));
    await c.send('Page.navigate', { url });
    await carregou;
}

// ── Trace: coleta e resume uso de CPU por thread ────────────────────────────────────────────────────────────────
async function traceIniciar(c, categorias) {
    c.traceEv = []; c.off('Tracing.dataCollected');
    c.on('Tracing.dataCollected', p => { for (const e of p.value) c.traceEv.push(e); });
    await c.send('Tracing.start', { categories: categorias || '-*,toplevel,devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,viz,gpu,benchmark,input,latency', transferMode: 'ReportEvents' });
}
async function traceParar(c) {
    const fim = new Promise(r => c.on('Tracing.tracingComplete', r));
    await c.send('Tracing.end'); await fim; return c.traceEv;
}
function resumirTrace(ev, janelaMs) {
    const nomeThread = new Map(), nomeProc = new Map();
    for (const e of ev) {
        if (e.ph === 'M' && e.name === 'thread_name') nomeThread.set(e.pid + ':' + e.tid, e.args.name);
        if (e.ph === 'M' && e.name === 'process_name') nomeProc.set(e.pid, e.args.name);
    }
    const porThread = new Map();
    for (const e of ev) {
        if (e.ph !== 'X' || !e.dur) continue;
        const k = e.pid + ':' + e.tid;
        let t = porThread.get(k); if (!t) { t = { nome: (nomeProc.get(e.pid) || '?') + '/' + (nomeThread.get(k) || e.tid), top: 0, nomes: new Map() }; porThread.set(k, t); }
        if (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'ThreadControllerImpl::DoWork' || e.name === 'ThreadControllerImpl::RunTask') t.top += e.dur;
        t.nomes.set(e.name, (t.nomes.get(e.name) || 0) + e.dur);
    }
    const out = [];
    for (const [, t] of porThread) {
        if (!t.top) continue;
        out.push({ thread: t.nome, busyPct: +(100 * t.top / 1000 / janelaMs).toFixed(1), top: [...t.nomes.entries()].filter(([n]) => !/ThreadController/.test(n)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, d]) => n + ' ' + (d / 1000).toFixed(0) + 'ms') });
    }
    return out.sort((a, b) => b.busyPct - a.busyPct);
}

module.exports = { URL_APP, lancar, Cdp, abrirPagina, navegar, sleep, traceIniciar, traceParar, resumirTrace };
