'use strict';
// Bancada de mediÃ§Ã£o: abre o app no Edge (GPU real desta mÃ¡quina), cria um chat longo e mede quadros/latÃªncia/CPU por processo.
// Uso: Code.exe bench.js [--cenario=nome,nome] [--css=arquivo.css] [--sem-gpu] [--url=...] [--rotulo=texto] [--trace]
const { execSync } = require('child_process');
const fs = require('fs');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : (process.argv.includes('--' + n) ? true : d); };

const PORTA = +arg('porta', 9444);
const URL = arg('url', L.URL_APP);
const CEN = String(arg('cenario', 'ocioso,digitando,rolando')).split(',');
const CSS = arg('css', null);
const JS_ANTES = arg('js', null);
const GPU = !arg('sem-gpu', false);
const ROTULO = arg('rotulo', 'base');
const TRACE = !!arg('trace', false);

function cpuPorTipo() {
    const ps = "Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | ForEach-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($p) { [pscustomobject]@{ id = $_.ProcessId; cmd = $_.CommandLine; cpu = $p.TotalProcessorTime.TotalSeconds } } } | ConvertTo-Json -Compress";
    let out = ''; try { out = execSync('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', { encoding: 'utf8', timeout: 20000 }); } catch (e) { return {}; }
    let arr = []; try { arr = JSON.parse(out); if (!Array.isArray(arr)) arr = [arr]; } catch (e) { return {}; }
    const r = { gpu: 0, renderer: 0, browser: 0, outros: 0 };
    for (const p of arr) {
        const m = /--type=([a-z-]+)/.exec(p.cmd || ''); const t = m ? m[1] : 'browser';
        if (!(p.cmd || '').includes('edge-bench-' + PORTA)) continue;
        if (t === 'gpu-process') r.gpu += p.cpu; else if (t === 'renderer') r.renderer += p.cpu; else if (t === 'browser') r.browser += p.cpu; else r.outros += p.cpu;
    }
    return r;
}
const dif = (a, b, s) => { const o = {}; for (const k of Object.keys(b)) o[k] = +(((b[k] - (a[k] || 0)) / s) * 100).toFixed(0) + '%'; return o; };

const HELPERS = `
window.__fr = function(ms){ return new Promise(res=>{ const t=[]; let last=0; const end=performance.now()+ms; function step(ts){ if(last) t.push(ts-last); last=ts; if(performance.now()<end) requestAnimationFrame(step); else { t.sort((a,b)=>a-b); const n=t.length; const q=p=>t[Math.min(n-1,Math.floor(p*n))]; res({n, mean:+(t.reduce((a,b)=>a+b,0)/n).toFixed(1), p50:+q(.5).toFixed(1), p90:+q(.9).toFixed(1), p95:+q(.95).toFixed(1), p99:+q(.99).toFixed(1), max:+t[n-1].toFixed(1), fps:+(1000/(t.reduce((a,b)=>a+b,0)/n)).toFixed(0), d33:t.filter(x=>x>33.4).length, d50:t.filter(x=>x>50).length}); } } requestAnimationFrame(step); }); };
window.__ev = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__ev.push({ n: e.name, d: e.duration, ini: +(e.processingStart - e.startTime).toFixed(1), proc: +(e.processingEnd - e.processingStart).toFixed(1) }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
`;

const CHAT_LONGO = `(() => {
  const s = document.getElementById('chatStream'); const w = document.getElementById('welcomeMsg'); if (w) w.remove();
  const md = "## Como emitir o CT-e\\n\\nPara emitir um **CT-e** siga os passos:\\n\\n1. Acesse **Operacional > Conhecimento de Transporte**.\\n2. Clique em *Novo*.\\n3. Informe o remetente, o destinatÃ¡rio e a mercadoria.\\n\\n| Campo | Valor | ObservaÃ§Ã£o |\\n|---|---|---|\\n| CFOP | 6.353 | Transporte interestadual |\\n| ICMS | 12% | Conforme UF |\\n\\n- Verifique o parÃ¢metro de ICMS\\n- Confira a tabela de preÃ§os\\n\\n\`\`\`js\\nconst total = frete + pedagio;\\n\`\`\`\\n\\nSe aparecer erro de validaÃ§Ã£o, revise o cadastro do cliente e tente novamente.";
  for (let i = 0; i < 40; i++) {
    const u = document.createElement('div'); u.className = 'message user-msg'; u.textContent = 'Pergunta de teste numero ' + i + ': como emitir CT-e com ICMS?'; s.appendChild(u);
    const c = document.createElement('div'); c.className = 'answer-card';
    c.innerHTML = '<div class="answer-section"><div class="section-content">' + (window.renderMd ? renderMd(md) : md) + '</div></div><div class="feedback-area" style="display:flex"><span class="feedback-util">Esta resposta foi Ãºtil?</span><button class="feedback-btn">ðŸ‘</button><button class="feedback-btn">ðŸ‘Ž</button><button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg,#10b981,#059669)">CIOT</button><button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg,#dc2626,#991b1b)">Blog</button><button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg,#2563eb,#1d4ed8)">Manual</button></div>';
    s.appendChild(c);
  }
  s.scrollTop = 0; return s.children.length;
})()`;

const LARG = +arg('larg', 1536), ALT = +arg('alt', 730), DPR = +arg('dpr', 1.25), CPU = +arg('cpu', 1);
(async () => {
    // usa o Edge persistente (porta 9444, subido por edge-up.ps1); se nÃ£o houver, lanÃ§a um prÃ³prio
    let proc = null;
    try { const r = await fetch('http://127.0.0.1:' + PORTA + '/json/version'); if (!r.ok) throw 0; } catch (e) { proc = await L.lancar({ porta: PORTA, gpu: GPU }); }
    const c = await L.abrirPagina(PORTA);
    const res = { rotulo: ROTULO, viewport: LARG + 'x' + ALT + '@' + DPR, cpu: CPU, gpu: GPU, cenarios: {} };
    try {
        await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Performance.enable');
        await c.send('Emulation.setDeviceMetricsOverride', { width: LARG, height: ALT, deviceScaleFactor: DPR, mobile: false });
        await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });   // o Windows desta mÃ¡quina desliga animaÃ§Ãµes: aqui forÃ§amos o que a maioria vÃª
        if (CPU > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: CPU });
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf')}catch(e){}" });
        if (JS_ANTES) await c.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(JS_ANTES, 'utf8') });
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: HELPERS });
        if (CSS) {
            const css = fs.readFileSync(CSS, 'utf8').replace(/\\/g, '\\\\').replace(/`/g, '\\`');
            await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.id='__bench_css';s.textContent=`" + css + "`;document.head.appendChild(s);});" });
        }
        await L.navegar(c, URL);
        // espera o chat ficar pronto
        let pronto = false;
        for (let i = 0; i < 120 && !pronto; i++) { await L.sleep(500); try { pronto = await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100&&document.getElementById('sendBtn')&&!document.getElementById('sendBtn').disabled)})()"); } catch (e) { /* carregando */ } }
        res.pronto = pronto;
        await L.sleep(9000);   // deixa passar as sondas do "Perf" e o resto da inicializaÃ§Ã£o
        res.perfNivel = await c.eval("document.documentElement.dataset.perf || 'completo'");
        res.ua = await c.eval("navigator.userAgent.slice(-40)");
        res.dom = await c.eval("document.querySelectorAll('*').length");
        res.animacoes = await c.eval("document.getAnimations().filter(a=>a.playState==='running').map(a=>(a.effect&&a.effect.target?(a.effect.target.className&&a.effect.target.className.baseVal===undefined?a.effect.target.tagName+'.'+String(a.effect.target.className).split(' ')[0]:a.effect.target.tagName):'?')+':'+(a.animationName||a.transitionProperty||'')).join(' | ')");
        const chatAntes = await c.eval(CHAT_LONGO); res.msgs = chatAntes;
        await L.sleep(1500);

        async function rodar(nome, fn) {
            await c.send('Performance.enable');
            const m0 = (await c.send('Performance.getMetrics')).metrics; const cpu0 = cpuPorTipo(); const t0 = Date.now();
            await c.eval('window.__ev.length=0; window.__lt.length=0; 0');
            if (TRACE) await L.traceIniciar(c);
            const r = await fn();
            const dt = (Date.now() - t0) / 1000;
            let traceRes = null; if (TRACE) { const ev = await L.traceParar(c); traceRes = L.resumirTrace(ev, dt * 1000).slice(0, 6); }
            const cpu1 = cpuPorTipo(); const m1 = (await c.send('Performance.getMetrics')).metrics;
            const g = (m, n) => (m.find(x => x.name === n) || {}).value || 0;
            const evs = await c.eval('window.__ev.slice()'); const lt = await c.eval('window.__lt.slice()');
            const agr = {}; for (const e of evs) { (agr[e.n] = agr[e.n] || []).push(e.d); }
            res.cenarios[nome] = Object.assign({}, r, {
                seg: +dt.toFixed(1), cpu: dif(cpu0, cpu1, dt),
                main: { script: Math.round((g(m1, 'ScriptDuration') - g(m0, 'ScriptDuration')) * 1000), layout: Math.round((g(m1, 'LayoutDuration') - g(m0, 'LayoutDuration')) * 1000), estilo: Math.round((g(m1, 'RecalcStyleDuration') - g(m0, 'RecalcStyleDuration')) * 1000), tarefas: Math.round((g(m1, 'TaskDuration') - g(m0, 'TaskDuration')) * 1000) },
                eventos: Object.fromEntries(Object.entries(agr).map(([k, v]) => [k, { n: v.length, max: Math.max(...v), media: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(0) }])),
                longtasks: lt.length ? lt : undefined, trace: traceRes || undefined
            });
        }

        for (const cen of CEN) {
            if (cen === 'ocioso') {
                await c.eval("document.getElementById('searchInput').blur(); 0"); await L.sleep(800);
                await rodar('ocioso_sem_foco', async () => Promise.race([c.eval('__fr(4000)'), L.sleep(4000 + 9000).then(() => ({ fps: 'TIMEOUT', p95: '-', max: '-' }))]));
            }
            if (cen === 'foco') {
                await c.eval("document.getElementById('searchInput').focus(); 0"); await L.sleep(800);
                await rodar('ocioso_com_foco', async () => Promise.race([c.eval('__fr(4000)'), L.sleep(4000 + 9000).then(() => ({ fps: 'TIMEOUT', p95: '-', max: '-' }))]));
            }
            if (cen === 'digitando') {
                await c.eval("document.getElementById('searchInput').focus(); 0"); await L.sleep(800);
                await rodar('digitando', async () => {
                    const fr = Promise.race([c.eval('__fr(5600)'), L.sleep(5600 + 9000).then(() => ({ fps: 'TIMEOUT', p95: '-', max: '-' }))]);
                    await L.sleep(300);
                    const texto = 'como emitir ct-e com icms de outro estado'; let i = 0;
                    for (const ch of texto + ' ' + texto) {
                        const up = ch.toUpperCase();
                        await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: ch === ' ' ? 32 : up.charCodeAt(0) });
                        await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: ch === ' ' ? 32 : up.charCodeAt(0) });
                        await L.sleep(60); i++;
                    }
                    return fr;
                });
                await c.eval("(()=>{const i=document.getElementById('searchInput'); i.value=''; 0})()");
            }
            if (cen === 'rolando') {
                await c.eval("document.getElementById('searchInput').blur(); document.getElementById('chatStream').scrollTop=0; 0"); await L.sleep(800);
                await rodar('rolando', async () => {
                    const fr = Promise.race([c.eval('__fr(4200)'), L.sleep(4200 + 9000).then(() => ({ fps: 'TIMEOUT', p95: '-', max: '-' }))]);
                    await L.sleep(300);
                    for (let i = 0; i < 40; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: 100 }); await L.sleep(90); }
                    return fr;
                });
            }
            if (cen === 'rolando_foco') {
                await c.eval("document.getElementById('searchInput').focus(); document.getElementById('chatStream').scrollTop=0; 0"); await L.sleep(800);
                await rodar('rolando_foco', async () => {
                    const fr = Promise.race([c.eval('__fr(4200)'), L.sleep(4200 + 9000).then(() => ({ fps: 'TIMEOUT', p95: '-', max: '-' }))]);
                    await L.sleep(300);
                    for (let i = 0; i < 40; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: 100 }); await L.sleep(90); }
                    return fr;
                });
            }
        }
    } catch (e) { res.erro = String(e && e.stack || e); }
    console.log(JSON.stringify(res, null, 1));
    try { if (CPU > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: 1 }); } catch (e) { /* ok */ }
    c.fechar();
    if (proc) { try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ } }
    process.exit(0);
})();
