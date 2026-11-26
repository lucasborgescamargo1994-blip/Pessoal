'use strict';
// A/B das páginas em paralelo (js/app/dados.js › _paginarTabela): alterna aberturas SEM a contagem guardada (as páginas vêm em fila, como antes da v28.43) e COM ela (vêm juntas) no MESMO Edge,
// e compara quanto tempo levam os pedidos ao banco e quando o ➤ libera. A rede e o Supabase variam de um minuto para o outro, por isso as rodadas são ALTERNADAS e o resultado é a mediana.
// Uso: Code.exe ab-paginas.js [--rodadas=6] [--porta=9577] [--url=http://localhost:8080/index.html?sim=1]
const { execSync } = require('child_process');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const RODADAS = +arg('rodadas', 6), PORTA = +arg('porta', 9577), URL = arg('url', L.URL_APP);
const mediana = v => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const PRONTO = "(function(){ try { return typeof Pronto !== 'undefined' && Pronto.pronto() && typeof isVectorizing !== 'undefined' && !isVectorizing && bancoCompletoRaw.length > 100; } catch (e) { return false; } })()";
(async () => {
    const proc = await L.lancar({ porta: PORTA, gpu: false, w: 1536, h: 900, args: ['--headless=new'] });
    const c = await L.abrirPagina(PORTA);
    const res = { sem: { banco: [], pronto: [], dcl: [] }, com: { banco: [], pronto: [], dcl: [] } };
    try {
        await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
        await c.send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 730, deviceScaleFactor: 1, mobile: false });
        // marca o instante do DCL e do "pronto" dentro da página
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__m = {}; document.addEventListener('DOMContentLoaded', function(){ window.__m.dcl = Math.round(performance.now()); }); (function p(){ try { if (typeof Pronto !== 'undefined' && Pronto.pronto() && !window.__m.pronto) window.__m.pronto = Math.round(performance.now()); } catch (e) {} if (!window.__m.pronto) setTimeout(p, 20); })();" });
        let t1 = null, fim = 0;
        c.on('Network.requestWillBeSent', p => { if (p.request.method === 'GET' && /\/rest\/v1\//.test(p.request.url) && t1 === null) t1 = p.timestamp; });
        c.on('Network.loadingFinished', p => { if (t1 !== null) fim = Math.max(fim, p.timestamp); });
        const url = (rel) => URL;
        // 1ª abertura: baixa os vetores e deixa tudo guardado (fica de fora da medida)
        await c.send('Page.navigate', { url: URL });
        for (let i = 0; i < 300; i++) { await L.sleep(250); if (await c.eval(PRONTO).catch(() => false)) break; }
        await L.sleep(3000);
        for (let r = 0; r < RODADAS * 2; r++) {
            const modo = r % 2 === 0 ? 'sem' : 'com';   // alterna: sem, com, sem, com…
            // (a chave de contagem só existe depois de uma abertura; "sem" a apaga, "com" deixa a que a abertura anterior gravou)
            if (modo === 'sem') await c.eval("try { localStorage.removeItem('bsoft_tab_linhas'); } catch (e) {} 0");
            else if (!(await c.eval("localStorage.getItem('bsoft_tab_linhas')"))) { r--; await c.send('Page.reload'); for (let i = 0; i < 300; i++) { await L.sleep(250); if (await c.eval(PRONTO).catch(() => false)) break; } continue; }
            t1 = null; fim = 0;
            await c.send('Page.reload');
            let m = null; for (let i = 0; i < 400; i++) { await L.sleep(200); m = await c.eval('window.__m').catch(() => null); if (m && m.pronto) break; }
            await L.sleep(400);
            if (m && m.pronto && t1 !== null) { res[modo].banco.push(Math.round((fim - t1) * 1000)); res[modo].pronto.push(m.pronto); res[modo].dcl.push(m.dcl); }
            console.log((modo === 'sem' ? 'SEM contagem (em fila)  ' : 'COM contagem (juntas)  ') + 'pedidos ao banco ' + String(res[modo].banco.slice(-1)[0]).padStart(5) + ' ms · DCL ' + String(m && m.dcl).padStart(5) + ' ms · ➤ livre ' + String(m && m.pronto).padStart(5) + ' ms · DCL→➤ ' + String(m && (m.pronto - m.dcl)).padStart(5) + ' ms');
        }
    } catch (e) { console.log('ERRO', e && e.stack || e); }
    for (const k of ['sem', 'com']) console.log('MEDIANA ' + (k === 'sem' ? 'SEM contagem (em fila)' : 'COM contagem (juntas)') + ': pedidos ao banco ' + mediana(res[k].banco) + ' ms · ➤ livre ' + mediana(res[k].pronto) + ' ms · DCL ' + mediana(res[k].dcl) + ' ms  (n=' + res[k].banco.length + ')');
    c.fechar();
    try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
    process.exit(0);
})();
