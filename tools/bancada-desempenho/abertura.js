'use strict';
// Mede a ABERTURA do sistema no Edge desta máquina: quando a tela aparece, quando o CAMPO libera para digitar, quando o BOTÃO DE ENVIAR libera, o que foi baixado,
// a memória (página, placa de vídeo) e o trabalho da thread principal. Duas aberturas no mesmo perfil: 1ª "fria" (perfil novo, sem vetores guardados) e 2ª "quente" (as seguintes, a que o usuário vive).
// Uso: Code.exe abertura.js [--url=...] [--rotulo=texto] [--so-fria] [--sem-janela] [--porta=9571] [--espera=ocioso|nenhuma]
const { execSync } = require('child_process');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : (process.argv.includes('--' + n) ? true : d); };
const PORTA = +arg('porta', 9571), URL = arg('url', L.URL_APP), ROTULO = arg('rotulo', 'base'), SEM_JANELA = !!arg('sem-janela', false), SO_FRIA = !!arg('so-fria', false);
const LARG = +arg('larg', 1536), ALT = +arg('alt', 730), DPR = +arg('dpr', 1.25);

// Marcações dentro da página, desde o primeiro instante (Page.addScriptToEvaluateOnNewDocument)
const SONDA = `
(function () {
  var T = window.__t = { badge: [], campo: [] }, t0 = function () { return Math.round(performance.now()); };
  function marca(k) { if (!(k in T)) T[k] = t0(); }
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (e.name === 'first-paint') marca('pintou'); if (e.name === 'first-contentful-paint') marca('conteudo'); }); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () { marca('dcl'); });
  window.addEventListener('load', function () { marca('load'); });
  function estado() {
    var i = document.getElementById('searchInput'), b = document.getElementById('sendBtn'), s = document.getElementById('statusBadge');
    if (i && !i.disabled) marca('campoLivre'); if (i && i.disabled && !('campoLivre' in T)) T.campoTravadoVisto = true;
    if (b && !b.disabled) marca('envioLivre');
    if (s) { var tx = (s.textContent || '').trim(); if (!T.badge.length || T.badge[T.badge.length - 1][1] !== tx) T.badge.push([t0(), tx]); }
    if (typeof isVectorizing !== 'undefined' && !isVectorizing && typeof bancoCompletoRaw !== 'undefined' && bancoCompletoRaw.length > 100) marca('pronto');
  }
  new MutationObserver(estado).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  setInterval(estado, 100);
  // o campo aceita digitar de verdade? (foco + evento sintético não basta: conferimos o atributo e o foco ao primeiro quadro em que o campo existe)
  (function esperar() { var i = document.getElementById('searchInput'); if (i) { requestAnimationFrame(function () { T.campoNoPrimeiroQuadro = !i.disabled; T.campoFocoNoPrimeiroQuadro = document.activeElement === i; marca('campoVisto'); }); } else requestAnimationFrame(esperar); })();
})();`;

// (PowerShell por -EncodedCommand: aspas e barras do comando passam intactas, sem escape)
const sh = (ps) => { try { return execSync('powershell -NoProfile -EncodedCommand ' + Buffer.from(ps, 'utf16le').toString('base64'), { encoding: 'utf8', timeout: 25000 }); } catch (e) { return ''; } };
function processos() {
    const out = sh("Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | ForEach-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($p) { [pscustomobject]@{ cmd = $_.CommandLine; cpu = $p.TotalProcessorTime.TotalSeconds; ws = $p.WorkingSet64; priv = $p.PrivateMemorySize64 } } } | ConvertTo-Json -Compress");
    let arr = []; try { arr = JSON.parse(out); if (!Array.isArray(arr)) arr = [arr]; } catch (e) { return null; }
    const r = { gpu: { cpu: 0, mb: 0 }, renderer: { cpu: 0, mb: 0 }, browser: { cpu: 0, mb: 0 }, outros: { cpu: 0, mb: 0 } };
    for (const p of arr) {
        if (!(p.cmd || '').includes('edge-bench-' + PORTA)) continue;
        const m = /--type=([a-z-]+)/.exec(p.cmd || ''); const t = m ? m[1] : 'browser';
        const k = t === 'gpu-process' ? 'gpu' : t === 'renderer' ? 'renderer' : t === 'browser' ? 'browser' : 'outros';
        r[k].cpu += p.cpu; r[k].mb += (p.priv || p.ws) / 1048576;
    }
    return r;
}
function paraOFundo(pid) {   // janela de teste para o fim da pilha, sem roubar o foco (o dono usa o PC enquanto isto roda)
    sh("Add-Type -Namespace W -Name U -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);'; Start-Sleep -Milliseconds 1500; $p = Get-Process -Id " + pid + " -ErrorAction SilentlyContinue; if ($p -and $p.MainWindowHandle -ne 0) { [W.U]::SetWindowPos($p.MainWindowHandle, [IntPtr]1, 0, 0, 0, 0, 0x13) | Out-Null }");
}

async function abrir(c, rotulo, recarregar) {
    const rede = { req: 0, kb: 0, porTipo: {} }, tipos = new Map();
    c.off('Network.responseReceived'); c.off('Network.loadingFinished'); c.off('Network.requestWillBeSent');
    // pedidos ao banco (Supabase /rest/v1): quando saíram e quando terminaram (ms desde o 1º pedido do banco) — mostra se a carga é rede ou é a página
    const banco = new Map(); let t1 = null;
    c.on('Network.requestWillBeSent', p => {
        rede.req++;
        if (p.request.method === 'GET' && /\/rest\/v1\//.test(p.request.url)) { if (t1 === null) t1 = p.timestamp; banco.set(p.requestId, { tabela: (/\/rest\/v1\/([A-Za-z_]+)/.exec(p.request.url) || [0, '?'])[1], off: (/[?&]offset=(\d+)/.exec(p.request.url) || [0, ''])[1], ini: Math.round((p.timestamp - t1) * 1000) }); }
    });
    c.on('Network.responseReceived', p => { tipos.set(p.requestId, p.type || '?'); });
    c.on('Network.loadingFinished', p => {
        const t = tipos.get(p.requestId) || '?'; const kb = (p.encodedDataLength || 0) / 1024; rede.kb += kb; const o = rede.porTipo[t] = rede.porTipo[t] || { n: 0, kb: 0 }; o.n++; o.kb += kb;
        const b = banco.get(p.requestId); if (b) { b.fim = Math.round((p.timestamp - t1) * 1000); b.kb = Math.round(kb); }
    });
    // (os contadores do navegador recomeçam do zero a cada documento novo: ao recarregar, a base é zero, senão a diferença sai negativa)
    const g = (m, n) => (m.find(x => x.name === n) || {}).value || 0;
    const m0 = recarregar ? [] : (await c.send('Performance.getMetrics')).metrics;
    const p0 = processos(), t0 = Date.now();
    if (recarregar) await c.send('Page.reload', { ignoreCache: false }); else await c.send('Page.navigate', { url: URL });
    let T = null, pronto = false;
    for (let i = 0; i < 400 && !pronto; i++) {   // até ~100 s
        await L.sleep(250);
        try { T = await c.eval('window.__t ? JSON.parse(JSON.stringify(window.__t)) : null'); pronto = !!(T && T.pronto && T.envioLivre); } catch (e) { /* página trocando */ }
    }
    const tPronto = Date.now() - t0;
    await L.sleep(1500);
    // ocioso: 6 s sem mexer em nada, depois de pronto (CPU/placa de vídeo parados e quadros)
    const mA = (await c.send('Performance.getMetrics')).metrics, pA = processos(), tA = Date.now();
    await c.eval("(function(){ var i=document.getElementById('searchInput'); if(i) i.blur(); return 0; })()");
    const fr = await c.eval(`(function(){ return new Promise(function(res){ var t=[], last=0, fim=performance.now()+6000; function s(ts){ if(last) t.push(ts-last); last=ts; if(performance.now()<fim) requestAnimationFrame(s); else { t.sort(function(a,b){return a-b}); var n=t.length; res({ quadros: n, p50: +t[Math.floor(n*.5)].toFixed(1), p95: +t[Math.min(n-1,Math.floor(n*.95))].toFixed(1), fps: +(1000/(t.reduce(function(a,b){return a+b},0)/n)).toFixed(0) }); } } requestAnimationFrame(s); }); })()`);
    const mB = (await c.send('Performance.getMetrics')).metrics, pB = processos(), tB = (Date.now() - tA) / 1000;
    // memória de verdade: o "heap usado" medido sem coletar o lixo engana (depende de quando o navegador resolveu limpar). Força a coleta e mede de novo.
    const heapSujo = g(mB, 'JSHeapUsedSize');
    try { await c.send('HeapProfiler.enable'); await c.send('HeapProfiler.collectGarbage'); await c.send('HeapProfiler.collectGarbage'); } catch (e) { /* sem coleta forçada */ }
    const mC = (await c.send('Performance.getMetrics')).metrics, pC = processos();
    const dom = await c.eval("document.querySelectorAll('*').length");
    const anim = await c.eval("document.getAnimations().filter(function(a){return a.playState==='running'}).length");
    const camadas = await c.eval("(function(){var n=0; document.querySelectorAll('*').forEach(function(e){var cs=getComputedStyle(e); if(cs.backdropFilter&&cs.backdropFilter!=='none') n++;}); return n;})()");
    const filtros = await c.eval("(function(){var n=0; document.querySelectorAll('*').forEach(function(e){var cs=getComputedStyle(e); if(cs.filter&&cs.filter!=='none') n++;}); return n;})()");
    const pct = (a, b) => (a && b) ? +(((b.cpu - a.cpu) / tB) * 100).toFixed(1) : null;
    const abertura = { cpuSeg: p0 && pA ? { pagina: +(pA.renderer.cpu - p0.renderer.cpu).toFixed(1), placa: +(pA.gpu.cpu - p0.gpu.cpu).toFixed(1) } : null };
    return {
        rotulo, prontoEmSeg: +(tPronto / 1000).toFixed(1),
        // "digitável" = o que a pessoa sente: a tela já apareceu E o campo aceita letras. "campoBloqueadoDepoisDeAparecer" = quanto tempo ela olhou para uma tela que ainda não deixava digitar.
        digitavelEmMs: T && T.conteudo != null && T.campoLivre != null ? Math.max(T.conteudo, T.campoLivre) : null,
        campoBloqueadoDepoisDeAparecerMs: T && T.conteudo != null && T.campoLivre != null ? Math.max(0, T.campoLivre - T.conteudo) : null,
        marcas: T && { pintou: T.pintou, conteudo: T.conteudo, dcl: T.dcl, load: T.load, campoLivre: T.campoLivre, campoNoPrimeiroQuadro: T.campoNoPrimeiroQuadro, campoFoco: T.campoFocoNoPrimeiroQuadro, envioLivre: T.envioLivre, pronto: T.pronto, campoTravadoVisto: !!T.campoTravadoVisto },
        selo: T && T.badge.map(b => b[0] + 'ms: ' + b[1].slice(0, 46)),
        rede: { requisicoes: rede.req, kb: Math.round(rede.kb), porTipo: Object.fromEntries(Object.entries(rede.porTipo).map(([k, v]) => [k, v.n + ' / ' + Math.round(v.kb) + ' KB'])) },
        // cada pedido ao banco: "tabela[offset] início→fim (KB)" em ms contados do 1º pedido; a carga termina com o último
        banco: [...banco.values()].sort((a, b) => a.ini - b.ini).map(b => b.tabela + (b.off !== '' ? '[' + b.off + ']' : '') + ' ' + b.ini + '→' + b.fim + ' (' + b.kb + ' KB)'),
        cargaDoBancoMs: banco.size ? Math.max(...[...banco.values()].map(b => b.fim || 0)) : null,
        carga: { scriptMs: Math.round((g(mA, 'ScriptDuration') - g(m0, 'ScriptDuration')) * 1000), estiloMs: Math.round((g(mA, 'RecalcStyleDuration') - g(m0, 'RecalcStyleDuration')) * 1000), layoutMs: Math.round((g(mA, 'LayoutDuration') - g(m0, 'LayoutDuration')) * 1000), tarefasMs: Math.round((g(mA, 'TaskDuration') - g(m0, 'TaskDuration')) * 1000), cpuSeg: abertura.cpuSeg },
        memoria: { heapSemColetarMB: +(heapSujo / 1048576).toFixed(1), heapDepoisDeColetarMB: +(g(mC, 'JSHeapUsedSize') / 1048576).toFixed(1), nosDepoisDeColetar: g(mC, 'Nodes'), elementos: dom, paginaMB: pC && Math.round(pC.renderer.mb), placaMB: pC && Math.round(pC.gpu.mb) },
        ocioso6s: { quadros: fr, cpuPaginaPct: pct(pA && pA.renderer, pB && pB.renderer), cpuPlacaPct: pct(pA && pA.gpu, pB && pB.gpu), tarefasMs: Math.round((g(mB, 'TaskDuration') - g(mA, 'TaskDuration')) * 1000), estiloMs: Math.round((g(mB, 'RecalcStyleDuration') - g(mA, 'RecalcStyleDuration')) * 1000), layoutMs: Math.round((g(mB, 'LayoutDuration') - g(mA, 'LayoutDuration')) * 1000), animacoesRodando: anim },
        efeitos: { backdropFilter: camadas, filter: filtros }
    };
}

(async () => {
    const proc = await L.lancar({ porta: PORTA, gpu: true, w: LARG, h: ALT + 160, args: ['--window-position=1930,10', '--disable-features=msEdgeSidebarV2,Translate,msWebOOUI,msEdgeEnhanceImages,CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...(SEM_JANELA ? ['--headless=new'] : [])] });
    if (!SEM_JANELA) paraOFundo(proc.pid);
    const c = await L.abrirPagina(PORTA);
    const saida = { rotulo: ROTULO, url: URL, viewport: LARG + 'x' + ALT + '@' + DPR, janela: SEM_JANELA ? 'headless' : 'real (2º monitor, no fundo)', aberturas: [] };
    try {
        await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Performance.enable'); await c.send('Network.enable');
        await c.send('Emulation.setDeviceMetricsOverride', { width: LARG, height: ALT, deviceScaleFactor: DPR, mobile: false });
        await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });   // o Windows desta máquina desliga animações: aqui forçamos o que a maioria vê
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: SONDA });
        saida.aberturas.push(await abrir(c, '1ª abertura (fria: perfil novo, sem vetores guardados)', false));
        if (!SO_FRIA) {
            await L.sleep(4000);   // deixa gravar os vetores no IndexedDB
            saida.aberturas.push(await abrir(c, '2ª abertura (quente: vetores já guardados)', true));
            await L.sleep(3000);
            saida.aberturas.push(await abrir(c, '3ª abertura (quente)', true));
        }
    } catch (e) { saida.erro = String(e && e.stack || e); }
    console.log(JSON.stringify(saida, null, 1));
    // resumo de uma linha por abertura (para comparar versões lado a lado)
    console.log('\n=== RESUMO ' + ROTULO + ' ===');
    for (const a of saida.aberturas) {
        const m = a.marcas || {}, o = a.ocioso6s || {}, me = a.memoria || {};
        console.log([a.rotulo.slice(0, 7), 'digitável ' + a.digitavelEmMs + ' ms', 'campo travado após a tela ' + a.campoBloqueadoDepoisDeAparecerMs + ' ms', '➤ livre ' + m.envioLivre + ' ms', 'DCL→➤ ' + (m.envioLivre - m.dcl) + ' ms (pedidos ao banco: ' + a.cargaDoBancoMs + ' ms)',
            'ocioso: placa ' + o.cpuPlacaPct + '% página ' + o.cpuPaginaPct + '% tarefas ' + o.tarefasMs + ' ms estilo ' + o.estiloMs + ' ms anim ' + o.animacoesRodando, 'heap(GC) ' + me.heapDepoisDeColetarMB + ' MB', 'página ' + me.paginaMB + ' MB', 'placa ' + me.placaMB + ' MB'].join(' | '));
    }
    c.fechar();
    try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
    process.exit(0);
})();
