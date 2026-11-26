'use strict';
// Regressão (v28.43, layout leve): carga e uso SEM exceções nem console.error, nenhum arquivo local com 404, e uma resposta da IA SIMULADA pelo handleChat de verdade chegando completa.
// (As verificações do fundo "aurora"/Personalizar da v28.38 saíram junto com o fundo; o que é do layout em si está em teste-layout-leve.js.)
// Uso: Code.exe regressao.js [--porta=9555]   (usa o Edge de testes já aberto nessa porta; veja edge-up.ps1)
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const res = []; const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASSOU ' : 'FALHOU ') + n + (x ? '  → ' + x : '')); };
(async () => {
    const c = await L.abrirPagina(+arg('porta', 9555));
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Network.enable');
    const erros = [], falhasRede = [];
    c.on('Runtime.exceptionThrown', p => erros.push('EXCEÇÃO: ' + (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 200)));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') erros.push('console.error: ' + p.args.map(a => a.value || a.description || '').join(' ').slice(0, 200)); });
    c.on('Network.loadingFailed', p => falhasRede.push(p.errorText + ' ' + (p.canceled ? '(cancelado)' : '')));
    c.on('Network.responseReceived', p => { if (p.response.status >= 400 && /localhost/.test(p.response.url)) falhasRede.push(p.response.status + ' ' + p.response.url); });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 730, deviceScaleFactor: 1, mobile: false });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_v27_prefs')}catch(e){}" });
    await L.navegar(c, L.URL_APP);
    for (let i = 0; i < 120; i++) { await L.sleep(400); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100&&!document.getElementById('sendBtn').disabled)})()")) break; } catch (e) { /* carregando */ } }
    await L.sleep(3000);
    ok('R1 carga sem exceções nem console.error', erros.length === 0, erros.slice(0, 3).join(' | '));
    ok('R2 nenhum arquivo local com erro de rede/404', falhasRede.filter(x => !/cancelado|ERR_ABORTED/.test(x)).length === 0, falhasRede.slice(0, 3).join(' | '));
    // uso: digitar, pergunta à IA simulada, rolar — sem erros
    await c.eval("window.callCurrentMCPStream = async function(){ const enc=new TextEncoder(); const t='## Teste\\n\\n1. passo **um**\\n2. passo dois\\n\\n| a | b |\\n|---|---|\\n| 1 | 2 |\\n\\nFim da resposta de teste, com um texto razoavelmente longo para passar de alguns quadros na revelação fluida.'; let i=0; const rs=new ReadableStream({ async pull(ctrl){ if(i>=t.length){ ctrl.enqueue(enc.encode('data: [DONE]\\n\\n')); ctrl.close(); return;} const p=t.slice(i,i+10); i+=10; ctrl.enqueue(enc.encode('data: '+JSON.stringify({choices:[{delta:{content:p}}]})+'\\n\\n')); await new Promise(r=>setTimeout(r,20)); } }); return { resp: new Response(rs), provider:'openai', iaUsada:'Custom', iaModelo:'teste' }; }; window.callMCPSemPensamento = async()=>({text:''}); Prefs.set({ formatoResposta:'completa', desambiguar:false, esclarecer:false, ferramentaSugerida:false },{quiet:true}); document.getElementById('searchInput').value='teste de resposta'; handleChat(); 0");
    for (let i = 0; i < 80; i++) { await L.sleep(250); if (!(await c.eval("document.body.classList.contains('ai-busy')")) && i > 4) break; }
    await L.sleep(500);
    const txt = await c.eval("(()=>{ const cs=document.querySelectorAll('.answer-card'); const u=cs[cs.length-1]; return u ? u.querySelector('.section-content').innerHTML : '' })()");
    ok('R3 resposta simulada termina completa (revelação nova)', /Fim da resposta de teste/.test(txt) && /<table/.test(txt) && /<b>um<\/b>/.test(txt) && !/stream-cursor/.test(txt), txt.length + ' bytes de HTML');
    ok('R4 sem exceções durante o uso', erros.length === 0, erros.slice(0, 3).join(' | '));
    console.log('\n' + (res.every(Boolean) ? 'TODOS OS ' + res.length + ' TESTES PASSARAM' : res.filter(x => !x).length + ' FALHA(S)'));
    c.fechar(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
