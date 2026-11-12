'use strict';
// RegressÃ£o da v28.38: erros de console/exceÃ§Ãµes na carga e no uso, e o caminho real de Personalizar (cor/fundo/efeitos) refazendo o fundo assado.
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const res = []; const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASSOU ' : 'FALHOU ') + n + (x ? '  â†’ ' + x : '')); };
(async () => {
    const c = await L.abrirPagina(+arg('porta', 9555));
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Network.enable');
    const erros = [], falhasRede = [];
    c.on('Runtime.exceptionThrown', p => erros.push('EXCEÃ‡ÃƒO: ' + (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 200)));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') erros.push('console.error: ' + p.args.map(a => a.value || a.description || '').join(' ').slice(0, 200)); });
    c.on('Network.loadingFailed', p => falhasRede.push(p.errorText + ' ' + (p.canceled ? '(cancelado)' : '')));
    c.on('Network.responseReceived', p => { if (p.response.status >= 400 && /localhost/.test(p.response.url)) falhasRede.push(p.response.status + ' ' + p.response.url); });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 730, deviceScaleFactor: 1, mobile: false });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf'); localStorage.removeItem('bsoft_v27_prefs')}catch(e){}" });
    await L.navegar(c, L.URL_APP);
    for (let i = 0; i < 120; i++) { await L.sleep(400); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100)})()")) break; } catch (e) { /* carregando */ } }
    await L.sleep(3000);
    ok('R1 carga sem exceÃ§Ãµes nem console.error', erros.length === 0, erros.slice(0, 3).join(' | '));
    ok('R2 nenhum arquivo local com erro de rede/404', falhasRede.filter(x => !/cancelado|ERR_ABORTED/.test(x)).length === 0, falhasRede.slice(0, 3).join(' | '));
    let e = await c.eval("JSON.stringify({ baked: document.querySelector('.bg-aurora').hasAttribute('data-baked'), a1: document.querySelector('.bg-aurora').style.getPropertyValue('--au-1').slice(0,60), p: document.querySelector('.bg-aurora').style.getPropertyValue('--au-p') })").then(JSON.parse);
    ok('R3 fundo assado ligado na carga', e.baked && /^url\("data:image\/svg\+xml/.test(e.a1) && e.p === '216px', e.p);
    // Personalizar de verdade: tom de destaque
    await c.eval("Prefs.set({ accent: '#2563eb', accentRgb: '37 99 235' }); 0"); await L.sleep(300);
    e = await c.eval("decodeURIComponent(document.querySelector('.bg-aurora').style.getPropertyValue('--au-1'))");
    ok('R4 trocar o tom de destaque refaz a 1Âª mancha com a cor nova', /rgb\(37,99,235\)/.test(e), (e.match(/stop-color="[^"]+"/) || [''])[0]);
    await c.eval("Prefs.set({ accent: null, accentRgb: null }); 0"); await L.sleep(300);
    e = await c.eval("decodeURIComponent(document.querySelector('.bg-aurora').style.getPropertyValue('--au-1'))");
    ok('R5 voltar ao tom padrÃ£o volta a laranja', /rgb\(249,115,22\)/.test(e));
    // Fundo liso / foto / aurora
    await c.eval("Prefs.set({ bg: 'liso' }); 0"); await L.sleep(300);
    ok('R6 fundo "liso" nÃ£o usa as manchas (sem data-baked)', await c.eval("!document.querySelector('.bg-aurora').hasAttribute('data-baked')"));
    await c.eval("Prefs.set({ bg: 'aurora' }); 0"); await L.sleep(300);
    ok('R7 voltar para "aurora" assa de novo', await c.eval("document.querySelector('.bg-aurora').hasAttribute('data-baked')"));
    // AnimaÃ§Ãµes e vidro: Leves usa desfoque menor (margem 144px); Completas volta a 216px
    await c.eval("Prefs.set({ efeitos: 'leve' }); 0"); await L.sleep(300);
    ok('R8 efeitos "Leves" â†’ imagem com desfoque 48 (margem 144px)', await c.eval("document.querySelector('.bg-aurora').style.getPropertyValue('--au-p')") === '144px');
    await c.eval("Prefs.set({ efeitos: 'completo' }); 0"); await L.sleep(300);
    ok('R9 efeitos "Completas" â†’ desfoque 72 (margem 216px)', await c.eval("document.querySelector('.bg-aurora').style.getPropertyValue('--au-p')") === '216px');
    // redimensionar a janela refaz (vmax muda)
    const antes = await c.eval("document.querySelector('.bg-aurora').style.getPropertyValue('--au-2').length");
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false }); await L.sleep(900);
    const depois = await c.eval("decodeURIComponent(document.querySelector('.bg-aurora').style.getPropertyValue('--au-2'))");
    ok('R10 redimensionar a janela refaz as imagens para o novo tamanho', /width="(\d+)"/.test(depois) && Math.abs(+/width="(\d+)"/.exec(depois)[1] - Math.round(46 * 11 + 432)) <= 2, (depois.match(/width="\d+"/) || [''])[0]);
    // uso: digitar, pergunta Ã  IA simulada, rolar â€” sem erros
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 730, deviceScaleFactor: 1, mobile: false }); await L.sleep(500);
    await c.eval("window.callCurrentMCPStream = async function(){ const enc=new TextEncoder(); const t='## Teste\\n\\n1. passo **um**\\n2. passo dois\\n\\n| a | b |\\n|---|---|\\n| 1 | 2 |\\n\\nFim da resposta de teste, com um texto razoavelmente longo para passar de alguns quadros na revelaÃ§Ã£o fluida.'; let i=0; const rs=new ReadableStream({ async pull(ctrl){ if(i>=t.length){ ctrl.enqueue(enc.encode('data: [DONE]\\n\\n')); ctrl.close(); return;} const p=t.slice(i,i+10); i+=10; ctrl.enqueue(enc.encode('data: '+JSON.stringify({choices:[{delta:{content:p}}]})+'\\n\\n')); await new Promise(r=>setTimeout(r,20)); } }); return { resp: new Response(rs), provider:'openai', iaUsada:'Custom', iaModelo:'teste' }; }; window.callMCPSemPensamento = async()=>({text:''}); Prefs.set({ formatoResposta:'completa', desambiguar:false, esclarecer:false, ferramentaSugerida:false },{quiet:true}); document.getElementById('searchInput').value='teste de resposta'; handleChat(); 0");
    for (let i = 0; i < 80; i++) { await L.sleep(250); if (!(await c.eval("document.body.classList.contains('ai-busy')")) && i > 4) break; }
    await L.sleep(500);
    const txt = await c.eval("(()=>{ const cs=document.querySelectorAll('.answer-card'); const u=cs[cs.length-1]; return u ? u.querySelector('.section-content').innerHTML : '' })()");
    ok('R11 resposta simulada termina completa (revelaÃ§Ã£o nova)', /Fim da resposta de teste/.test(txt) && /<table/.test(txt) && /<b>um<\/b>/.test(txt) && !/stream-cursor/.test(txt), txt.length + ' bytes de HTML');
    ok('R12 sem exceÃ§Ãµes durante o uso', erros.length === 0, erros.slice(0, 3).join(' | '));
    console.log('\n' + (res.every(Boolean) ? 'TODOS OS ' + res.length + ' TESTES PASSARAM' : res.filter(x => !x).length + ' FALHA(S)'));
    c.fechar(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
