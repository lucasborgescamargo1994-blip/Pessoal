'use strict';
// Fidelidade do CÓDIGO REAL: compara o fundo "assado" (js/core/aurora.js + css/desempenho.css) com o fundo ORIGINAL (filter: blur + ruído multiply/screen) no mesmo instante da animação.
// Uso: Code.exe fid2.js [--cenarios=claro,escuro,leve,azul,...]
const fs = require('fs');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const CEN = String(arg('cenarios', 'claro,escuro,leve,azul,estreita')).split(',');
(async () => {
    const c = await L.abrirPagina(9444);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Page.bringToFront');
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf')}catch(e){}" });
    const saida = [];
    for (const cen of CEN) {
        const larg = cen === 'estreita' ? 1100 : 1536, alt = cen === 'estreita' ? 900 : 730;
        await c.send('Emulation.setDeviceMetricsOverride', { width: larg, height: alt, deviceScaleFactor: 1.25, mobile: false });
        await L.navegar(c, L.URL_APP);
        for (let i = 0; i < 120; i++) { await L.sleep(500); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&typeof bancoCompletoRaw!=='undefined'&&bancoCompletoRaw.length>100)})()")) break; } catch (e) { /* carregando */ } }
        await L.sleep(1200);
        // prepara o cenário (como o app faria) e deixa o fundo REAL se refazer
        const prep = {
            claro: "0", escuro: "document.documentElement.dataset.bg='escuro'", leve: "document.documentElement.dataset.efeitos='leve'",
            azul: "document.documentElement.style.setProperty('--primary','#2563eb'); document.documentElement.style.setProperty('--primary-rgb','37 99 235')", estreita: "0"
        }[cen] || '0';
        await c.eval(prep + "; Aurora.assar(); document.documentElement.removeAttribute('data-perf'); for (const e of document.body.children) { if (!e.classList.contains('bg-aurora')) e.style.visibility='hidden'; } 1");
        const parar = "(()=>{ document.getAnimations().forEach(a=>{ const t=a.effect&&a.effect.target; if (t && t.closest && t.closest('.bg-aurora')) { a.pause(); a.currentTime=9000; } }); return 1 })()";
        await c.eval(parar); await L.sleep(1500);
        const info = await c.eval("(()=>{ const f=document.querySelector('.bg-aurora'); const i=f.querySelector('i'); return { baked: f.hasAttribute('data-baked'), filtro: getComputedStyle(i).filter, ruido: getComputedStyle(f,'::after').mixBlendMode + '/' + getComputedStyle(f,'::after').display, w: Math.round(i.getBoundingClientRect().width), p: f.style.getPropertyValue('--au-p') } })()");
        const B = (await c.send('Page.captureScreenshot', { format: 'png' })).data;
        // ORIGINAL: sem as imagens, com filter do CSS antigo e o ruído antigo (multiply no claro, screen no escuro)
        const sigma = cen === 'leve' ? 48 : 72;
        await c.eval("(()=>{ const f=document.querySelector('.bg-aurora'); f.removeAttribute('data-baked'); const s=document.createElement('style'); s.id='__orig'; s.textContent='.bg-aurora i{filter:blur(" + sigma + "px) !important} .bg-aurora::after{mix-blend-mode:" + (cen === 'escuro' ? 'screen' : 'multiply') + " !important; display:block !important}'; document.head.appendChild(s); return 1 })()");
        await c.eval(parar); await L.sleep(1500);
        const A = (await c.send('Page.captureScreenshot', { format: 'png' })).data;
        const diff = await c.eval("(async()=>{ const load=b=>new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src='data:image/png;base64,'+b}); const IA=await load(" + JSON.stringify(A) + "), IB=await load(" + JSON.stringify(B) + "); const mk=i=>{const c=document.createElement('canvas'); c.width=i.width; c.height=i.height; const x=c.getContext('2d'); x.drawImage(i,0,0); return x.getImageData(0,0,c.width,c.height).data}; const a=mk(IA), b=mk(IB); let max=0, soma=0, n=0, h=new Array(6).fill(0); for (let k=0;k<a.length;k+=4) { for (let j=0;j<3;j++) { const d=Math.abs(a[k+j]-b[k+j]); if (d>max) max=d; soma+=d; n++; h[Math.min(5,d)]++; } } return { w:IA.width, h:IA.height, max, media:+(soma/n).toFixed(3), pct0a5:h.map(v=>+(100*v/n).toFixed(2)) } })()");
        saida.push({ cen, info, diff });
        console.log(JSON.stringify({ cen, info, diff }));
    }
    await c.eval("document.querySelectorAll('body > *').forEach(e=>e.style.visibility=''); 0");
    c.fechar(); process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
