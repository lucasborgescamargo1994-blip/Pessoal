(()=>{ const B=BancoImg; const A = bancoCompletoRaw.filter(r => (r.conteudo||'').length >= 500 && (r.titulo||'').length > 5);
  const amostra = A.filter((_, i) => i % Math.max(1, Math.floor(A.length/70)) === 0).slice(0, 70);
  const extras = 'recomendamos importante lembre observacao verifique tambem conforme necessario'.split(' ');
  const resposta = (a, ruido) => { const t = String(a.conteudo).replace(/[*#>|`_-]+/g,' ').slice(0, 1600); const w = t.split(/\s+/); let inj = ''; if (ruido) { for (let i=0; i<Math.round(w.length*ruido); i++) inj += extras[i%extras.length] + (i%7===0?'s':'') + ' '; } return 'Para resolver isso siga o procedimento abaixo ' + t + ' ' + inj; };
  const pct = (arr, p) => { if (!arr.length) return null; const s = arr.slice().sort((x,y)=>x-y); return +(s[Math.min(s.length-1, Math.floor(p*s.length))]).toFixed(2); };
  const fiel=[], ruidoso=[], vizinho=[], nada=[];
  amostra.forEach(a => {
    const trF = B.tokens(resposta(a, 0)), trR = B.tokens(resposta(a, 0.35));
    fiel.push(B.uso(a, trF)); ruidoso.push(B.uso(a, trR));
    const ta = B.tokens(a.titulo);
    const viz = A.filter(b => b !== a).map(b => { const tb = B.tokens(b.titulo + ' ' + String(b.conteudo).slice(0,300)); let h=0; ta.forEach(w => { if (tb.has(w)) h++; }); return { b, h }; }).sort((x,y)=>y.h-x.h).slice(0,2);
    viz.forEach(v => vizinho.push(B.uso(v.b, trR)));
    nada.push(B.uso(A[(A.indexOf(a)*7+13) % A.length], trR));
  });
  return { n: amostra.length, tam: [fiel.length, ruidoso.length, vizinho.length, nada.length], fiel:{ min:pct(fiel,0), p10:pct(fiel,.1), med:pct(fiel,.5) }, ruidoso:{ min:pct(ruidoso,0), p10:pct(ruidoso,.1), p25:pct(ruidoso,.25), med:pct(ruidoso,.5) }, vizinho:{ med:pct(vizinho,.5), p90:pct(vizinho,.9), p95:pct(vizinho,.95), max:pct(vizinho,1) }, semRelacao:{ med:pct(nada,.5), p90:pct(nada,.9), max:pct(nada,1) } };
})()
