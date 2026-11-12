'use strict';
// Testa a vigilância de digitação/rolagem do Perf (js/ui/desempenho.js): ruim desce de nível, normal NÃO desce, "Voltar ao completo" vale.
// Uso: Code.exe perf-test.js [--porta=9555]
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const PORTA = +arg('porta', 9555);
const resultados = [];
const ok = (nome, cond, extra) => { resultados.push({ nome, ok: !!cond, extra }); console.log((cond ? 'PASSOU ' : 'FALHOU ') + nome + (extra ? '  → ' + extra : '')); };

const CHAT = `(() => { const s = document.getElementById('chatStream'); const w = document.getElementById('welcomeMsg'); if (w) w.remove();
  for (let i = 0; i < 40; i++) { const u = document.createElement('div'); u.className = 'message user-msg'; u.textContent = 'Pergunta ' + i; s.appendChild(u); const c = document.createElement('div'); c.className = 'answer-card';
    c.innerHTML = '<div class="answer-section"><div class="section-content">' + 'Texto da resposta número ' + i + ' com bastante conteúdo para ocupar espaço na tela. '.repeat(14) + '</div></div>'; s.appendChild(c); } s.scrollTop = 0; return s.children.length })()`;

async function abrir(c) {
    await L.navegar(c, L.URL_APP);
    for (let i = 0; i < 120; i++) { await L.sleep(400); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100&&typeof Perf!=='undefined')})()")) break; } catch (e) { /* carregando */ } }
    await L.sleep(800);
    await c.eval("Prefs.set({ perfAuto: true, efeitos: 'completo' }, { quiet: true }); Perf.reavaliar(); 0");
}
const estado = c => c.eval("JSON.stringify({ nivel: Perf.nivel(), attr: document.documentElement.dataset.perf || null, salvo: (()=>{ try { return JSON.parse(localStorage.getItem('bsoft_perf')||'null') } catch(e){ return null } })(), toast: (document.querySelector('.toast')||{innerText:''}).innerText.slice(0,160) })").then(JSON.parse);

(async () => {
    const c = await L.abrirPagina(PORTA);
    await c.send('Page.enable'); await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 730, deviceScaleFactor: 1, mobile: false });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf')}catch(e){}" });

    // A) digitação muito lenta (90 % das teclas) → desce na hora, avisa, grava
    await abrir(c);
    await c.eval('Perf._teste.rajadaDeTeclas(20, 18)'); await L.sleep(400);
    let e = await estado(c);
    ok('A1 digitação 90 % lenta → nível "medio"', e.nivel === 'medio' && e.attr === 'medio', JSON.stringify(e.salvo));
    ok('A2 motivo gravado fala de digitação', e.salvo && /digita/.test(e.salvo.por || ''));
    ok('A3 aviso explica o sintoma (digitar)', /demorando a mostrar o que você digita/.test(e.toast), e.toast.slice(0, 90));
    // B) 50–70 %: só na 2ª vez
    await abrir(c);
    await c.eval('Perf._teste.rajadaDeTeclas(20, 11)'); e = await estado(c);
    ok('B1 digitação 55 % lenta (1ª vez) → continua "completo"', e.nivel === 'completo');
    await c.eval('Perf._teste.rajadaDeTeclas(20, 11)'); e = await estado(c);
    ok('B2 digitação 55 % lenta (2ª vez) → "medio"', e.nivel === 'medio');
    // C) bom / poucas teclas / contador zera numa digitação boa
    await abrir(c);
    await c.eval('Perf._teste.rajadaDeTeclas(20, 3)'); await c.eval('Perf._teste.rajadaDeTeclas(5, 5)');
    e = await estado(c); ok('C1 digitação boa e poucas teclas → "completo"', e.nivel === 'completo');
    await c.eval('Perf._teste.rajadaDeTeclas(20, 11); Perf._teste.rajadaDeTeclas(20, 3); Perf._teste.rajadaDeTeclas(20, 11)');
    e = await estado(c); ok('C2 ruim, boa, ruim (não seguidas) → "completo"', e.nivel === 'completo');

    // D) caminho REAL: teclas de verdade com o tratamento da tecla lento (110 ms) → Event Timing → desce sozinho
    await abrir(c);
    await c.eval("(()=>{ const i=document.getElementById('searchInput'); i.focus(); i.addEventListener('keydown',()=>{ const t=performance.now(); while(performance.now()-t<110); }); return 1 })()");
    await L.sleep(500);
    for (const ch of 'como emitir cte') {
        await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch, code: ch === ' ' ? 'Space' : 'Key' + ch.toUpperCase(), windowsVirtualKeyCode: ch === ' ' ? 32 : ch.toUpperCase().charCodeAt(0) });
        await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: ch === ' ' ? 'Space' : 'Key' + ch.toUpperCase(), windowsVirtualKeyCode: ch === ' ' ? 32 : ch.toUpperCase().charCodeAt(0) });
        await L.sleep(60);
    }
    await L.sleep(2600); e = await estado(c);
    ok('D digitação REAL lenta (110 ms por tecla) → "medio" sozinho', e.nivel === 'medio', JSON.stringify(e.salvo));

    // F) NORMAL: digitar e rolar sem lentidão não pode descer
    await abrir(c);
    await c.eval(CHAT); await L.sleep(600);
    await c.eval("document.getElementById('searchInput').focus(); 0");
    for (const ch of 'como emitir ct-e com icms de outro estado') {
        await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch, code: ch === ' ' ? 'Space' : 'Key' + ch.toUpperCase(), windowsVirtualKeyCode: ch === ' ' ? 32 : ch.toUpperCase().charCodeAt(0) });
        await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: ch === ' ' ? 'Space' : 'Key' + ch.toUpperCase(), windowsVirtualKeyCode: ch === ' ' ? 32 : ch.toUpperCase().charCodeAt(0) });
        await L.sleep(70);
    }
    await L.sleep(1800);
    for (let s = 0; s < 3; s++) { for (let i = 0; i < 14; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: 100 }); await L.sleep(60); } await L.sleep(500); }
    e = await estado(c); ok('F digitar e rolar NORMAL → continua "completo"', e.nivel === 'completo', 'scrollTop=' + await c.eval("document.getElementById('chatStream').scrollTop|0"));

    // E) rolagem lenta de verdade: quadros de 45 ms enquanto rola, 2 vezes seguidas
    await abrir(c);
    await c.eval(CHAT); await L.sleep(600);
    await c.eval("window.__busy = true; (function f(){ if (!window.__busy) return; const t=performance.now(); while(performance.now()-t<45); requestAnimationFrame(f); })(); 0");
    for (let s = 0; s < 3; s++) { for (let i = 0; i < 16; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: 90 }); await L.sleep(70); } await L.sleep(700); }
    await c.eval('window.__busy = false; 0'); await L.sleep(500);
    e = await estado(c); ok('E rolagem LENTA (quadros de ~50 ms) duas vezes → "medio"', e.nivel === 'medio', JSON.stringify(e.salvo));

    // G) "Voltar ao completo" vale: depois dele, digitação lenta NÃO desce de novo
    await abrir(c);
    await c.eval('Perf._teste.rajadaDeTeclas(20, 18)'); e = await estado(c);
    ok('G1 desceu', e.nivel === 'medio');
    await c.eval('Perf.voltarAoCompleto()'); e = await estado(c);
    ok('G2 voltou ao completo e ficou fixo', e.nivel === 'completo' && e.salvo && e.salvo.fixo === true);
    await c.eval('Perf._teste.rajadaDeTeclas(20, 20)'); e = await estado(c);
    ok('G3 digitação lenta depois de "Voltar ao completo" → continua "completo"', e.nivel === 'completo');

    // H) quem escolheu "Leves"/"Desligadas" em Animações e vidro não é afetado
    await abrir(c);
    await c.eval("Prefs.set({ efeitos: 'leve' }, { quiet: true }); 0");
    await c.eval('Perf._teste.rajadaDeTeclas(20, 20)'); e = await estado(c);
    ok('H efeitos "Leves" → vigilância não mexe', e.nivel === 'completo');

    const falhas = resultados.filter(r => !r.ok).length;
    console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS ' + resultados.length + ' TESTES PASSARAM'));
    c.fechar(); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
