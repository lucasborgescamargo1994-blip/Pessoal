'use strict';
// Teste A/B ao vivo: carrega o app UMA vez, cria o chat longo e, para cada variante de CSS, mede ocioso/digitando/rolando.
// Uso: Code.exe ab.js variantes.json [--larg= --alt= --dpr= --cpu=] [--so=nome1,nome2] [--rapido]
const { execSync } = require('child_process');
const fs = require('fs');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : (process.argv.includes('--' + n) ? true : d); };
const PORTA = 9444;
const VARS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const SO = arg('so', null) ? String(arg('so')).split(',') : null;
const LARG = +arg('larg', 1536), ALT = +arg('alt', 730), DPR = +arg('dpr', 1.25), CPU = +arg('cpu', 1);
const URL = arg('url', L.URL_APP);
const SEL_CHAT = arg('chat', 'curto');

function cpuPorTipo() {
    const ps = "Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | ForEach-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($p) { [pscustomobject]@{ cmd = $_.CommandLine; cpu = $p.TotalProcessorTime.TotalSeconds } } } | ConvertTo-Json -Compress";
    let out = ''; try { out = execSync('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', { encoding: 'utf8', timeout: 20000 }); } catch (e) { return {}; }
    let arr = []; try { arr = JSON.parse(out); if (!Array.isArray(arr)) arr = [arr]; } catch (e) { return {}; }
    const r = { gpu: 0, renderer: 0, browser: 0 };
    for (const p of arr) {
        if (!(p.cmd || '').includes('edge-bench-' + PORTA)) continue;
        const m = /--type=([a-z-]+)/.exec(p.cmd || ''); const t = m ? m[1] : 'browser';
        if (t === 'gpu-process') r.gpu += p.cpu; else if (t === 'renderer') r.renderer += p.cpu; else if (t === 'browser') r.browser += p.cpu;
    }
    return r;
}
const pct = (a, b, s) => ({ gpu: Math.round((b.gpu - a.gpu) / s * 100), rend: Math.round((b.renderer - a.renderer) / s * 100), nav: Math.round((b.browser - a.browser) / s * 100) });

const HELPERS = `
window.__fr = function(ms){ return new Promise(res=>{ const t=[]; let last=0; const end=performance.now()+ms; function step(ts){ if(last) t.push(ts-last); last=ts; if(performance.now()<end) requestAnimationFrame(step); else { t.sort((a,b)=>a-b); const n=t.length; const q=p=>t[Math.min(n-1,Math.floor(p*n))]; res({n, mean:+(t.reduce((a,b)=>a+b,0)/n).toFixed(1), p50:+q(.5).toFixed(1), p95:+q(.95).toFixed(1), max:+t[n-1].toFixed(1), fps:+(1000/(t.reduce((a,b)=>a+b,0)/n)).toFixed(0)}); } } requestAnimationFrame(step); }); };
window.__ev = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name==='keydown') window.__ev.push(e.duration); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
window.__setCss = function(css){ let s=document.getElementById('__ab'); if(!s){ s=document.createElement('style'); s.id='__ab'; document.head.appendChild(s);} s.textContent=css; return 1; };
`;
const CHAT = `(() => {
  const s = document.getElementById('chatStream'); const w = document.getElementById('welcomeMsg'); if (w) w.remove();
  if (s.querySelector('.answer-card')) return s.children.length;
  const md = "## Como emitir o CT-e\\n\\nPara emitir um **CT-e** siga os passos:\\n\\n1. Acesse **Operacional > Conhecimento de Transporte**.\\n2. Clique em *Novo*.\\n3. Informe o remetente, o destinatÃ¡rio e a mercadoria.\\n\\n| Campo | Valor | ObservaÃ§Ã£o |\\n|---|---|---|\\n| CFOP | 6.353 | Transporte interestadual |\\n| ICMS | 12% | Conforme UF |\\n\\n- Verifique o parÃ¢metro de ICMS\\n- Confira a tabela de preÃ§os\\n\\n\`\`\`js\\nconst total = frete + pedagio;\\n\`\`\`\\n\\nSe aparecer erro de validaÃ§Ã£o, revise o cadastro do cliente e tente novamente.";
  for (let i = 0; i < 40; i++) {
    const u = document.createElement('div'); u.className = 'message user-msg'; u.textContent = 'Pergunta de teste numero ' + i + ': como emitir CT-e com ICMS?'; s.appendChild(u);
    const c = document.createElement('div'); c.className = 'answer-card';
    c.innerHTML = '<div class="answer-section"><div class="section-content">' + (window.renderMd ? renderMd(md) : md) + '</div></div><div class="feedback-area" style="display:flex"><span class="feedback-util">Esta resposta foi Ãºtil?</span><button class="feedback-btn">ðŸ‘</button><button class="feedback-btn">ðŸ‘Ž</button><button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg,#10b981,#059669)">CIOT</button><button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg,#dc2626,#991b1b)">Blog</button><button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg,#2563eb,#1d4ed8)">Manual</button></div>';
    s.appendChild(c);
  }
  s.scrollTop = 0; return s.children.length;
})()`;

const OUT = arg('out', null);
(async () => {
    const c = await L.abrirPagina(PORTA);
    await c.send('Page.enable'); await c.send('Runtime.enable');
    /* sem bringToFront: não atrapalhar o usuário */
    // __fr com limite de tempo: se a janela ficar oculta o rAF para e isso NÃƒO pode travar a bateria de testes
    const frT = (ms) => Promise.race([c.eval('__fr(' + ms + ')'), L.sleep(ms + 9000).then(() => ({ fps: 'TIMEOUT', p95: '-', max: '-' }))]);
    await c.send('Emulation.setDeviceMetricsOverride', { width: LARG, height: ALT, deviceScaleFactor: DPR, mobile: false });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf')}catch(e){}" });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: HELPERS });
    if (arg('js', null)) await c.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(arg('js'), 'utf8') });
    await L.navegar(c, URL);
    for (let i = 0; i < 120; i++) { await L.sleep(500); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100)})()")) break; } catch (e) { /* carregando */ } }
    await L.sleep(6000);
    await c.eval('document.documentElement.removeAttribute("data-perf"); 0');   // sem ajuste automÃ¡tico durante o teste
    if (SEL_CHAT !== 'nenhum') await c.eval(CHAT); await L.sleep(1500);
    if (CPU > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const linhas = [];
    for (const v of VARS) {
        if (SO && !SO.includes(v.nome)) continue;
        if (v.js) await c.eval(v.js);
        await c.eval('__setCss(' + JSON.stringify(v.css || '') + ')'); await L.sleep(1800);
        const r = { v: v.nome };
        // 1) ocioso com foco
        await c.eval("document.getElementById('searchInput').focus(); document.getElementById('chatStream').scrollTop=0; 0"); await L.sleep(500);
        let a = cpuPorTipo(), t0 = Date.now();
        const f1 = await frT(3000); let b = cpuPorTipo(); const s1 = (Date.now() - t0) / 1000;
        r.idle = f1.fps + 'fps p95=' + f1.p95; r.cpu = JSON.stringify(pct(a, b, s1));
        // 2) digitando
        await c.eval('window.__ev.length=0; 0');
        const texto = 'como emitir ct-e com icms de outro estado';
        const frp = frT(texto.length * 70 + 600); await L.sleep(300);
        for (const ch of texto) {
            const up = ch.toUpperCase(); const k = ch === ' ' ? 32 : up.charCodeAt(0);
            await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: k });
            await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: k });
            await L.sleep(70);
        }
        const ft = await frp; const ev = await c.eval('window.__ev.slice()');
        ev.sort((x, y) => x - y);
        r.tecla = ev.length ? ('med=' + Math.round(ev[Math.floor(ev.length / 2)]) + ' p90=' + Math.round(ev[Math.floor(ev.length * .9)]) + ' max=' + Math.round(ev[ev.length - 1])) : 'sem eventos';
        r.digFps = ft.fps;
        await c.eval("document.getElementById('searchInput').value=''; 0");
        // 3) rolando (com foco)
        await c.eval("document.getElementById('chatStream').scrollTop=0; 0"); await L.sleep(500);
        const frs = frT(2600); await L.sleep(200);
        for (let i = 0; i < 24; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: 100 }); await L.sleep(90); }
        const fs2 = await frs; r.rolar = fs2.fps + 'fps p95=' + fs2.p95 + ' max=' + fs2.max;
        // 4) mensagem nova entrando (animaÃ§Ã£o msgIn com blur): pergunta + resposta aparecem no fim do chat; 5 rodadas
        if (arg('entrada', false)) {
            const ADD = "(()=>{ const s=document.getElementById('chatStream'); const u=document.createElement('div'); u.className='message user-msg __novo'; u.textContent='Pergunta nova de teste'; s.appendChild(u); const c=document.createElement('div'); c.className='answer-card __novo'; const md=document.querySelector('.answer-card .section-content').innerHTML; c.innerHTML='<div class=\"answer-section\"><div class=\"section-content\">'+md+md+'</div></div><div class=\"feedback-area\" style=\"display:flex\"><span class=\"feedback-util\">Esta resposta foi Ãºtil?</span></div>'; s.appendChild(c); scrollToBottom(true); return 1 })()";
            const pior = []; const medias = [];
            for (let k = 0; k < 5; k++) {
                await L.sleep(700);
                const frm = frT(900); await L.sleep(40); await c.eval(ADD); const fm = await frm;
                pior.push(+fm.max); medias.push(+fm.fps);
                await c.eval("document.querySelectorAll('.__novo').forEach(e=>e.remove()); 0");
            }
            r.entrada = 'fps(med)=' + Math.round(medias.reduce((a, b) => a + b, 0) / medias.length) + ' pior-quadro=' + Math.max(...pior) + 'ms';
        }
        linhas.push(r); console.log(JSON.stringify(r)); if (OUT) fs.appendFileSync(OUT, JSON.stringify(r) + '\n');
    }
    await c.eval('__setCss("")');
    try { if (CPU > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: 1 }); } catch (e) { /* ok */ }
    c.fechar(); process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });

