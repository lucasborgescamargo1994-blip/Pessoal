'use strict';
// Resposta da IA aparecendo (handleChat real, IA SIMULADA): mede quadros, tarefas longas, CPU e rolagem DURANTE a resposta.
// Uso: Code.exe stream.js [--css=arq] [--chars=6000] [--cps=900] [--rolar] [--rotulo=x]
const fs = require('fs');
const { execSync } = require('child_process');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : (process.argv.includes('--' + n) ? true : d); };
const PORTA = +arg('porta', 9444);
function cpuPorTipo() {
    const ps = "Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | ForEach-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($p) { [pscustomobject]@{ cmd = $_.CommandLine; cpu = $p.TotalProcessorTime.TotalSeconds } } } | ConvertTo-Json -Compress";
    let out = ''; try { out = execSync('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', { encoding: 'utf8', timeout: 20000 }); } catch (e) { return {}; }
    let arr = []; try { arr = JSON.parse(out); if (!Array.isArray(arr)) arr = [arr]; } catch (e) { return {}; }
    const r = { gpu: 0, renderer: 0 };
    for (const p of arr) { if (!(p.cmd || '').includes('edge-bench-' + PORTA)) continue; const m = /--type=([a-z-]+)/.exec(p.cmd || ''); const t = m ? m[1] : 'browser'; if (t === 'gpu-process') r.gpu += p.cpu; else if (t === 'renderer') r.renderer += p.cpu; }
    return r;
}
const HELPERS = `
window.__fr = function(ms){ return new Promise(res=>{ const t=[]; let last=0; const end=performance.now()+ms; function step(ts){ if(last) t.push(ts-last); last=ts; if(performance.now()<end) requestAnimationFrame(step); else { t.sort((a,b)=>a-b); const n=t.length; const q=p=>t[Math.min(n-1,Math.floor(p*n))]; res({n, mean:+(t.reduce((a,b)=>a+b,0)/n).toFixed(1), p50:+q(.5).toFixed(1), p95:+q(.95).toFixed(1), max:+t[n-1].toFixed(1), fps:+(1000/(t.reduce((a,b)=>a+b,0)/n)).toFixed(0), d33:t.filter(x=>x>33.4).length, d50:t.filter(x=>x>50).length}); } } requestAnimationFrame(step); }); };
window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
window.__ev = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__ev.push(e.duration); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
`;
const CHARS = +arg('chars', 6000), CPS = +arg('cps', 900);
const FAKE = `
(function(){
  const base = "## Como emitir o CT-e com ICMS\\n\\nPara emitir um **CT-e** siga os passos abaixo:\\n\\n1. Acesse **Operacional > Conhecimento de Transporte**.\\n2. Clique em *Novo* e informe o remetente.\\n3. Confira o parÃ¢metro de ICMS na tabela de preÃ§os.\\n\\n| Campo | Valor | ObservaÃ§Ã£o |\\n|---|---|---|\\n| CFOP | 6.353 | Transporte interestadual |\\n| ICMS | 12% | Conforme a UF de origem |\\n\\n- Verifique a **base de cÃ¡lculo** antes de emitir.\\n- Se aparecer erro de validaÃ§Ã£o, revise o cadastro do cliente.\\n\\n\`\`\`js\\nconst total = frete + pedagio;\\n\`\`\`\\n\\n";
  let texto = ''; while (texto.length < ${CHARS}) texto += base;
  texto = texto.slice(0, ${CHARS});
  window.__fakeTexto = texto;
  window.callCurrentMCPStream = async function(){
    const enc = new TextEncoder(); let i = 0; const passo = Math.max(4, Math.round(${CPS} / 60));
    const rs = new ReadableStream({ async pull(ctrl){
      if (i >= texto.length) { ctrl.enqueue(enc.encode('data: [DONE]\\n\\n')); ctrl.close(); return; }
      const part = texto.slice(i, i + passo); i += passo;
      ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: part } }] }) + '\\n\\n'));
      await new Promise(r => setTimeout(r, 16));
    } });
    return { resp: new Response(rs), provider: 'openai', iaUsada: 'Custom', iaModelo: 'teste' };
  };
  window.callMCPSemPensamento = async () => ({ text: '' });
})()`;

(async () => {
    const c = await L.abrirPagina(PORTA);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Performance.enable'); 
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 730, deviceScaleFactor: 1.25, mobile: false });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: arg('reduzir', false) ? 'reduce' : 'no-preference' }] });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf')}catch(e){}" });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: HELPERS });
    await L.navegar(c, L.URL_APP);
    for (let i = 0; i < 120; i++) { await L.sleep(500); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100)})()")) break; } catch (e) { /* carregando */ } }
    await L.sleep(5000);
    await c.eval("document.documentElement.removeAttribute('data-perf'); 0");
    if (arg('css', null)) await c.eval("(()=>{const s=document.createElement('style'); s.textContent=" + JSON.stringify(fs.readFileSync(arg('css'), 'utf8')) + "; document.head.appendChild(s); return 1})()");
    if (arg('original', false)) {   // comportamento ANTIGO da revelação (60 atualizações/s, botão ↓ a cada quadro), para comparar na mesma bancada
        await c.eval(`window._criarRevelacaoFluida = function(contentEl, opts = {}) {
            const CPS = opts.cps || 220; let textoCompleto = '', revelados = 0, streamAcabou = false, ultimoTs = null, animando = false, aoTerminar = null;
            function passo(ts) { if (ultimoTs === null) ultimoTs = ts; revelados = Math.min(textoCompleto.length, revelados + ((ts - ultimoTs) / 1000) * CPS); ultimoTs = ts; const falta = revelados < textoCompleto.length;
                _atualizarConteudoFluido(contentEl, renderMd(textoCompleto.slice(0, Math.floor(revelados))), falta || !streamAcabou); _atualizarBotaoScrollDown(falta || !streamAcabou);
                if (falta || !streamAcabou) { requestAnimationFrame(passo); } else { animando = false; if (aoTerminar) { const f = aoTerminar; aoTerminar = null; try { f(); } catch (e) {} } } }
            function garantirAnimando() { if (!animando) { animando = true; ultimoTs = null; requestAnimationFrame(passo); } }
            return { atualizar(t) { textoCompleto = _semCodigoParam(t); garantirAnimando(); }, finalizar(cb) { streamAcabou = true; if (cb) { aoTerminar = cb; setTimeout(() => { if (aoTerminar) { const f = aoTerminar; aoTerminar = null; try { f(); } catch (e) {} } }, Math.min(6000, 700 + textoCompleto.length * 5)); } garantirAnimando(); } };
        }; 0`);
    }
    await c.eval(FAKE);
    await c.eval("Prefs.set({ formatoResposta: 'completa', desambiguar: false, esclarecer: false, ferramentaSugerida: false }, { quiet: true }); 0");   // vai direto para a IA (sem botÃµes de escolha)
    await c.eval("document.getElementById('searchInput').focus(); 0"); await L.sleep(800);
    const perfil = !!arg('perfil', false);
    if (perfil) { await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 400 }); await c.send('Profiler.start'); }
    const m0 = (await c.send('Performance.getMetrics')).metrics; const cpu0 = cpuPorTipo(); const t0 = Date.now();
    await c.eval("window.__lt.length=0; window.__ev.length=0; document.getElementById('searchInput').value='como emitir ct-e com icms de outro estado'; handleChat(); 0");
    // acompanha: quadros durante a resposta inteira
    const maxMs = Math.ceil(CHARS / CPS * 1000) + 6000;
    const fr = c.eval('__fr(' + maxMs + ')');
    // opcional: DIGITAR durante a resposta (a pessoa já começa a escrever a próxima dúvida): latência de cada tecla
    let teclasLat = null;
    if (arg('digitar', false)) {
        await L.sleep(2500);
        await c.eval("window.__ev.length=0; document.getElementById('searchInput').focus(); 0");
        const texto = 'como emitir ct-e com icms de outro estado'; let n = 0;
        for (const ch of texto) {
            const up = ch.toUpperCase(); const k = ch === ' ' ? 32 : up.charCodeAt(0);
            await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: k });
            await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: k });
            await L.sleep(90); n++;
        }
        await L.sleep(400);
        const ev = (await c.eval('window.__ev.slice()')).sort((a, b) => a - b);
        teclasLat = ev.length ? { n: ev.length, med: Math.round(ev[Math.floor(ev.length / 2)]), p90: Math.round(ev[Math.floor(ev.length * .9)]), max: Math.round(ev[ev.length - 1]) } : { n: 0 };
    }
    // opcional: rolar para cima/baixo durante a resposta
    if (arg('rolar', false)) { await L.sleep(1500); for (let i = 0; i < 30; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: (i % 2 ? 120 : -120) }); await L.sleep(100); } }
    // espera acabar
    let fim = null;
    for (let i = 0; i < 200; i++) { await L.sleep(250); const ocupado = await c.eval("document.body.classList.contains('ai-busy')"); if (!ocupado && i > 6) { fim = Date.now(); break; } }
    const r = await fr;   // (a janela do __fr Ã© fixa; usamos sÃ³ o trecho em que respondeu: ver "seg")
    const seg = ((fim || Date.now()) - t0) / 1000;
    let topo = null;
    if (perfil) {
        const { profile } = await c.send('Profiler.stop');
        const porNo = new Map(profile.nodes.map(n => [n.id, n])); const self = new Map();
        const dts = profile.timeDeltas; let total = 0;
        profile.samples.forEach((id, i) => { const n = porNo.get(id); const k = (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dts[i] || 0)); total += (dts[i] || 0); });
        topo = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + '  ' + Math.round(v / 1000) + 'ms (' + (100 * v / total).toFixed(1) + '%)');
        topo.unshift('total amostrado: ' + Math.round(total / 1000) + 'ms');
    }
    const cpu1 = cpuPorTipo(); const m1 = (await c.send('Performance.getMetrics')).metrics;
    const g = (m, n) => (m.find(x => x.name === n) || {}).value || 0;
    const lt = await c.eval('window.__lt.slice()');
    const resumo = await c.eval("(()=>{ const cs=document.querySelectorAll('.answer-card'); const u=cs[cs.length-1]; return { len: u ? u.innerText.length : 0, fimOcupado: document.body.classList.contains('ai-busy') } })()");
    console.log(JSON.stringify({
        rotulo: arg('rotulo', ''), chars: CHARS, segResposta: +seg.toFixed(1),
        quadrosDuranteTudo: { fps: r.fps, p50: r.p50, p95: r.p95, max: r.max, d33: r.d33, d50: r.d50 },
        cpu: { gpu: Math.round((cpu1.gpu - cpu0.gpu) / ((Date.now() - t0) / 1000) * 100), rend: Math.round((cpu1.renderer - cpu0.renderer) / ((Date.now() - t0) / 1000) * 100) },
        mainMs: { tarefas: Math.round((g(m1, 'TaskDuration') - g(m0, 'TaskDuration')) * 1000), script: Math.round((g(m1, 'ScriptDuration') - g(m0, 'ScriptDuration')) * 1000), layout: Math.round((g(m1, 'LayoutDuration') - g(m0, 'LayoutDuration')) * 1000), estilo: Math.round((g(m1, 'RecalcStyleDuration') - g(m0, 'RecalcStyleDuration')) * 1000) },
        longtasks: lt, texto: resumo, topo, teclasDurante: teclasLat
    }, null, 1));
    c.fechar(); process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });


