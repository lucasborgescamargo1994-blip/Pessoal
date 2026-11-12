'use strict';
// Sessão persistente: "up" sobe o Edge (fica rodando em segundo plano) e abre o app; "ev" avalia uma expressão JS na página; "down" encerra.
// Uso: Code.exe sessao.js up [--w=1440 --h=900 --dpr=1 --sem-gpu --url=...]   |   sessao.js ev "<js>"   |   sessao.js evf arquivo.js   |   sessao.js down
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const L = require('./lib-cdp.js');
const PORTA = 9444;
const cmd = process.argv[2];
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : (process.argv.includes('--' + n) ? true : d); };

(async () => {
    if (cmd === 'up') {
        const w = +arg('w', 1440), h = +arg('h', 900), dpr = +arg('dpr', 1);
        // o Edge é lançado FORA daqui (PowerShell em segundo plano), senão morre quando este processo termina
        for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + PORTA + '/json/version'); if (r.ok) break; } catch (e) { /* subindo */ } await L.sleep(500); }
        const c = await L.abrirPagina(PORTA);
        await c.send('Page.enable'); await c.send('Runtime.enable');
        await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h - 100, deviceScaleFactor: dpr, mobile: false });
        await L.navegar(c, arg('url', L.URL_APP));
        for (let i = 0; i < 120; i++) { await L.sleep(500); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100)})()")) break; } catch (e) { /* carregando */ } }
        console.log('pronto'); c.fechar(); process.exit(0);
    } else if (cmd === 'ev' || cmd === 'evf') {
        const c = await L.abrirPagina(PORTA);
        const expr = cmd === 'evf' ? fs.readFileSync(process.argv[3], 'utf8') : process.argv[3];
        const v = await c.eval(expr);
        console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1)); c.fechar(); process.exit(0);
    } else if (cmd === 'down') {
        try { const pid = fs.readFileSync(path.join(__dirname, 'sessao.pid'), 'utf8'); execSync('taskkill /F /T /PID ' + pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
        console.log('encerrado'); process.exit(0);
    }
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
