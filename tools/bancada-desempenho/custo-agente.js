'use strict';
// Quanto o AGENTE DE IA (v29) custa na abertura do chat, num computador FRACO simulado (CPU mais lenta).
// Mede, nas duas versões da MESMA página alternadas (?agente=0 = só o motor carregado, nada preparado × padrão = agente ligado):
//   • em quanto tempo o ➤ libera;
//   • o trabalho "longo" da thread principal DEPOIS disso (tarefas > 50 ms = o que faz o campo de digitação engasgar);
//   • quanto tempo o agente leva para se preparar (numa folga do navegador) e a memória JS.
// Uso (servidor do projeto na porta 8080 → tools\servidor-local.bat):
//   Code.exe custo-agente.js [--url=http://localhost:8080/index.html?sim=1] [--porta=9561] [--cpu=4] [--rodadas=3]
// Nada é gravado no banco (?sim=1). Fecha só o Edge de teste que ele mesmo abriu.
const L = require('./lib-cdp.js');
const { execSync } = require('child_process');

const arg = (n, padrao) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : padrao; };
const URL = arg('url', 'http://localhost:8080/index.html?sim=1');
const PORTA = +arg('porta', 9561), CPU = +arg('cpu', 4), RODADAS = +arg('rodadas', 3);
const SEP = URL.indexOf('?') >= 0 ? '&' : '?';
const mediana = v => { const s = v.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const PRONTO = "(typeof isVectorizing !== 'undefined' && !isVectorizing && bancoCompletoRaw.length > 100)";

(async () => {
    const proc = await L.lancar({ porta: PORTA, gpu: false, w: 1366, h: 800, args: ['--headless=new'] });
    const c = await L.abrirPagina(PORTA);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: false });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {} " });
    // 1ª abertura: aquece o cache de vetores do navegador e o HTTP (a abertura "fria" não é o que se quer medir aqui)
    await L.navegar(c, URL);
    for (let i = 0; i < 400; i++) { await L.sleep(300); if (await c.eval(PRONTO).catch(() => false)) break; }
    await L.sleep(4000);
    await c.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const res = { sem: [], com: [] };
    for (let r = 0; r < RODADAS * 2; r++) {
        const modo = r % 2 === 0 ? 'sem' : 'com';
        await L.navegar(c, modo === 'sem' ? URL + SEP + 'agente=0' : URL);
        let pronto = null;
        for (let i = 0; i < 600; i++) { await L.sleep(250); pronto = await c.eval('(' + PRONTO + ') ? Math.round(performance.now()) : null').catch(() => null); if (pronto) break; }
        await L.sleep(7000);   // folga para o agente se preparar (numa folga do navegador)
        const d = await c.eval("({ lt: window.__lt, diag: (typeof AgenteChat !== 'undefined' ? AgenteChat.diagnostico() : null), mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null })");
        const depois = d.lt.filter(x => x.t >= pronto), total = depois.reduce((s, x) => s + x.d, 0), maior = depois.reduce((m, x) => Math.max(m, x.d), 0);
        res[modo].push({ pronto, longtasks: depois.length, longMs: total, maior, prepararMs: d.diag && d.diag.prepararMs, preparado: d.diag && d.diag.preparado, mem: d.mem });
        console.log((modo === 'sem' ? 'SEM agente ' : 'COM agente ') + JSON.stringify(res[modo][res[modo].length - 1]));
    }
    for (const k of ['sem', 'com']) console.log('MEDIANA ' + k.toUpperCase() + ' (CPU ' + CPU + '×): ➤ livre em ' + mediana(res[k].map(x => x.pronto)) + ' ms · trabalho longo depois disso ' + mediana(res[k].map(x => x.longMs)) + ' ms (maior tarefa ' + mediana(res[k].map(x => x.maior)) + ' ms) · preparo do agente ' + mediana(res[k].map(x => x.prepararMs || 0)) + ' ms · memória JS ' + mediana(res[k].map(x => x.mem || 0)) + ' MB');
    c.fechar(); try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
    process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
