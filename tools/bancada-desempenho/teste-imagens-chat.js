'use strict';
// Testa as IMAGENS DO PROCEDIMENTO no chat (v28.39): carga com colunas ausentes, escolha das imagens, galeria, ampliar, histórico, segurança.
const zlib = require('zlib');
const L = require('./lib-cdp.js');
const res = []; const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASSOU ' : 'FALHOU ') + n + (x ? '  → ' + x : '')); };

// PNG de mentira (tela de sistema): cabeçalho azul, caixas cinza
function crc32(b) { let c, crc = -1; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function png(w, h, cor) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4; let p = [245, 245, 247, 255]; if (y < 44) p = cor; else if (x > 30 && x < w - 30 && y > 80 && y < h - 40 && (y - 80) % 56 < 40) p = [255, 255, 255, 255]; if (x === 30 || x === w - 31) p = [200, 200, 205, 255]; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; } }
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG1 = png(900, 520, [37, 99, 235, 255]).toString('base64'), PNG2 = png(900, 380, [234, 88, 12, 255]).toString('base64');

(async () => {
    const c = await L.abrirPagina(9555);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Fetch.enable', { patterns: [{ urlPattern: '*/storage/v1/object/public/bancodados-imagens/*' }] });
    const pedidos = [], logsImagens = [];
    c.on('Runtime.consoleAPICalled', p => { const t = p.args.map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' '); if (/imagens do procedimento/.test(t)) logsImagens.push(t); });
    c.on('Fetch.requestPaused', p => {
        const u = p.request.url; pedidos.push(u);
        if (/indisponivel/.test(u)) { c.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 404, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }], body: '' }); return; }
        c.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: /img-2/.test(u) ? PNG2 : PNG1 });
    });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf'); localStorage.removeItem('bsoft_v27_prefs')}catch(e){}" });
    await L.navegar(c, L.URL_APP);
    for (let i = 0; i < 150; i++) { await L.sleep(400); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&bancoCompletoRaw.length>100&&typeof BancoImg!=='undefined'&&typeof BancoImgUI!=='undefined')})()")) break; } catch (e) { /* carregando */ } }
    await L.sleep(1500);
    const host = await c.eval("new URL(BSOFT_CONFIG.supabaseUrl).host");
    const URLB = 'https://' + host + '/storage/v1/object/public/bancodados-imagens/';

    // ── 1) regras puras ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const t1 = await c.eval(`(()=>{ const B=BancoImg, U='${URLB}'; const o={};
      o.validas = [B.urlValida(U+'a/1.webp'), B.urlValida('http://'+new URL(BSOFT_CONFIG.supabaseUrl).host+'/storage/v1/object/public/x/1.png'), B.urlValida('data:image/png;base64,AAAA'), B.urlValida('javascript:alert(1)'), B.urlValida('https://exemplo.com/storage/v1/object/public/bancodados-imagens/a.png'), B.urlValida('https://'+new URL(BSOFT_CONFIG.supabaseUrl).host+'/rest/v1/BancoDados'), B.urlValida(''), B.urlValida(null)];
      o.lista1 = B.lista([{url:U+'a/1.webp', legenda:'  Tela   de  Parâmetros '},{url:'http://x.com/a.png'},{url:U+'a/1.webp'},'lixo',null,{url:U+'a/2.webp'}]).map(x=>x.legenda+'|'+x.url.split('/').pop());
      o.lista2 = B.lista(JSON.stringify([{url:U+'a/3.webp', legenda:'x'}])).length;
      o.lista3 = B.lista(U+'a/4.webp').length; o.lista4 = B.lista('{{').length; o.lista5 = B.lista(undefined).length; o.lista6 = B.lista({url:U+'a/5.webp'}).length;
      o.max = B.lista(Array.from({length:20},(_, i)=>({url:U+'a/'+i+'.webp'}))).length;
      o.caminho = [B.caminhoNoBucket(U+'artigo-12/1699-ab.webp'), B.caminhoNoBucket(U+'a%20b/c.webp'), B.caminhoNoBucket('https://x.supabase.co/storage/v1/object/public/outro/a.png')];
      return o })()`);
    ok('P1 urlValida: só https do armazenamento público do Supabase', JSON.stringify(t1.validas) === '[true,false,false,false,false,false,false,false]', JSON.stringify(t1.validas));
    ok('P2 lista(): limpa legenda, tira URL inválida, repetida e lixo', JSON.stringify(t1.lista1) === JSON.stringify(['Tela de Parâmetros|1.webp', '|2.webp']), JSON.stringify(t1.lista1));
    ok('P3 lista(): aceita JSON em texto, URL solta e objeto; rejeita lixo; limita a 6', t1.lista2 === 1 && t1.lista3 === 1 && t1.lista4 === 0 && t1.lista5 === 0 && t1.lista6 === 1 && t1.max === 6, JSON.stringify([t1.lista2, t1.lista3, t1.lista4, t1.lista5, t1.lista6, t1.max]));
    ok('P4 caminhoNoBucket', t1.caminho[0] === 'artigo-12/1699-ab.webp' && t1.caminho[1] === 'a b/c.webp' && t1.caminho[2] === null, JSON.stringify(t1.caminho));

    // ── 2) carga do banco: colunas que ainda não existem ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const t2 = await c.eval(`(async()=>{ const orig = sb.from; const log=[]; const out={};
      const mk = (falha) => (tabela) => ({ select: (cols) => { log.push(cols); const r = falha(cols); return Promise.resolve(r); } });
      const erroCol = n => ({ data:null, error:{ code:'42703', message:'column BancoDados.'+n+' does not exist' } });
      // a) nenhuma coluna nova existe
      sb.from = mk(c => c.includes('imagens') ? erroCol('imagens') : c.includes('caminho_menu') ? erroCol('caminho_menu') : ({ data:[{id:1}], error:null }));
      let r = await _carregarBancoDados(); out.a = { ok: !r.error, tentativas: log.slice() }; log.length = 0;
      // b) só a imagens não existe (SQL 09 não rodado, SQL 05 sim)
      sb.from = mk(c => c.includes('imagens') ? ({ data:null, error:{ code:'PGRST204', message:"Could not find the 'imagens' column of 'BancoDados' in the schema cache" } }) : ({ data:[{id:1}], error:null }));
      r = await _carregarBancoDados(); out.b = { ok: !r.error, tentativas: log.slice() }; log.length = 0;
      // c) erro de outro tipo: devolve o erro sem insistir
      sb.from = mk(c => ({ data:null, error:{ code:'401', message:'JWT expired' } }));
      r = await _carregarBancoDados(); out.c = { erro: !!r.error, tentativas: log.length }; log.length = 0;
      // d) tudo existe
      sb.from = mk(c => ({ data:[{id:1, imagens:[{url:'x'}]}], error:null }));
      r = await _carregarBancoDados(); out.d = { ok: !r.error, tentativas: log.slice() };
      sb.from = orig; return out })()`);
    ok('C1 sem as duas colunas: refaz sem elas e abre', t1 && t2.a.ok && t2.a.tentativas.length === 3 && !/imagens|caminho_menu/.test(t2.a.tentativas[2]), JSON.stringify(t2.a.tentativas));
    ok('C2 só "imagens" ausente (erro PGRST204): refaz só sem ela, mantém caminho_menu', t2.b.ok && t2.b.tentativas.length === 2 && /caminho_menu/.test(t2.b.tentativas[1]) && !/imagens/.test(t2.b.tentativas[1]), JSON.stringify(t2.b.tentativas));
    ok('C3 outro erro (ex.: JWT) volta direto, sem insistir', t2.c.erro && t2.c.tentativas === 1);
    ok('C4 tudo existe: 1 consulta com as duas colunas', t2.d.ok && t2.d.tentativas.length === 1 && /imagens/.test(t2.d.tentativas[0]));

    // ── 3) calibragem do "a resposta veio deste artigo" com os ARTIGOS REAIS da base ───────────────────────────────────────────────────────────────────────────────────────
    const cal = await c.eval(require('fs').readFileSync(__dirname + '/calib-imagens.js', 'utf8'));
    console.log('CALIBRAGEM (artigos reais da base, n=' + cal.n + '):', JSON.stringify(cal));
    ok('K1 resposta fiel ao artigo (com 35 % de palavras extras) fica ACIMA do limite de 45 % em 90 % dos casos', cal.ruidoso.p10 >= 0.45, 'p10=' + cal.ruidoso.p10 + ' · mediana=' + cal.ruidoso.med);
    ok('K2 artigo vizinho passa em menos de 10 % dos casos e artigo sem relação nunca passa', cal.vizinho.p90 < 0.45 && cal.semRelacao.max < 0.45, 'vizinho p90=' + cal.vizinho.p90 + ' · sem relação máx=' + cal.semRelacao.max);
    // a prova por CÓPIA DE TRECHOS (28.39.1): resposta que abre com o bloco "Antes de tudo" dilui o vocabulário, mas continua copiando o procedimento do artigo
    const cop = await c.eval(require('fs').readFileSync(__dirname + '/calib-copia.js', 'utf8'));
    console.log('CALIBRAGEM DA CÓPIA (artigos reais da base, n=' + cop.n + '):', JSON.stringify(cop));
    ok('K3 resposta copiada do artigo (fiel, diluída pelo bloco "Antes de tudo", parafraseada ou curta) é reconhecida em 95 % ou mais dos casos', Object.values(cop.acerto).every(v => v >= 0.95), JSON.stringify(cop.acerto));
    ok('K4 pela cópia, artigo vizinho passa em até 10 % dos casos e artigo sem relação em até 3 %', cop.falsoVizinho <= 0.10 && cop.falsoSemRelacao <= 0.03, 'vizinho=' + cop.falsoVizinho + ' · sem relação=' + cop.falsoSemRelacao);

    // ── 3b) analisar(): quais artigos com imagem entram e o MOTIVO de cada um que ficou de fora ─────────────────────────────────────────────────────────────────────────────────
    const t3 = await c.eval(`(()=>{ const B=BancoImg, U='${URLB}'; const im = n => [{ url: U+'a/'+n+'.webp', legenda: 'L'+n }];
      const passos = 'Acesse o menu Fiscal Documentos Eletronicos CT-e Carta de Correcao e informe o grupo alterado depois o campo corrigido e o novo valor em seguida clique em Enviar para a SEFAZ e aguarde a autorizacao do evento';
      const outro = 'Cadastro de motoristas com habilitacao validade e categoria da carteira registro de vencimentos mensais para controle da frota e emissao de relatorio';
      const mk = (id, conteudo, sim, extra) => Object.assign({ id, titulo: 'Artigo ' + id, conteudo, similaridade: sim, imagens: im(id) }, extra || {});
      const resp = 'Antes de tudo verifique o parametro de permissao do usuario e o ambiente de producao. Siga o procedimento: ' + passos;
      const d1 = B.analisar([ mk(1, passos, 0.80), mk(2, outro, 0.70), mk(3, passos, 0.40), mk(4, passos, 0.90), mk(5, passos, 0.75, { _reforcoPalavraChave: true }) ], resp);
      const d2 = B.analisar([ mk(1, passos, 0.80), mk(2, passos, 0.78), mk(3, passos, 0.77) ], resp);
      const d3 = B.analisar([ { id: 9, titulo: 'sem imagem', conteudo: passos, similaridade: 0.9 }, mk(8, passos, 0.9, { isRepositorio: true }) ], resp);
      const d4 = B.analisar(null, resp), d5 = B.analisar([ mk(1, passos, 0.8) ], '');
      return { d1: { imagens: d1.imagens.map(x => x.id), cand: d1.candidatos.map(x => x.id + ':' + (x.motivo === 'ok' ? 'ok' : /^semelhança/.test(x.motivo) ? 'semelhanca' : /^a resposta não parece/.test(x.motivo) ? 'nao-veio' : /^já há/.test(x.motivo) ? 'limite' : '?')) },
               d2: { imagens: d2.imagens.map(x => x.id), motivo3: d2.candidatos[2].motivo },
               d3: { cand: d3.candidatos.length, imagens: d3.imagens.length }, d4: [d4.imagens.length, d4.candidatos.length], d5: d5.imagens.length,
               legenda: d1.imagens[0].legenda, titulo: d1.imagens[0].titulo, escolher: B.escolher([ mk(1, passos, 0.80) ], resp).length } })()`);
    ok('D1 analisar(): entra o artigo da resposta e o reforço por palavra-chave; ficam de fora o de outro assunto, o de baixa semelhança e o que não é candidato (4º lugar sem reforço)', JSON.stringify(t3.d1.imagens) === '[1,5]' && JSON.stringify(t3.d1.cand) === JSON.stringify(['1:ok', '2:nao-veio', '3:semelhanca', '5:ok']), JSON.stringify(t3.d1));
    ok('D2 no máximo 2 artigos por resposta (o 3º diz o motivo)', JSON.stringify(t3.d2.imagens) === '[1,2]' && /já há 2 artigos/.test(t3.d2.motivo3), JSON.stringify(t3.d2));
    ok('D3 artigo sem imagem e repositório nunca são candidatos; lista vazia/nula e resposta vazia não quebram', t3.d3.cand === 0 && t3.d3.imagens === 0 && t3.d4[0] === 0 && t3.d4[1] === 0 && t3.d5 === 0, JSON.stringify([t3.d3, t3.d4, t3.d5]));
    ok('D4 escolher() continua devolvendo só a lista de imagens (com legenda e título)', t3.escolher === 1 && t3.legenda === 'L1' && t3.titulo === 'Artigo 1', JSON.stringify([t3.escolher, t3.legenda, t3.titulo]));

    // ── 4) resposta de verdade pelo handleChat (IA simulada) com um artigo REAL que recebeu 2 imagens ───────────────────────────────────────────────────────────────────────
    const prep = await c.eval(`(()=>{ window.normalizarSinonimos = t => t;   // palavras da pergunta exatamente como digitadas (determinístico)
      const norm = t => String(t||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
      const rank = a => { const w = norm(a.titulo).split(/\\s+/).filter(x => x.length > 2); const sc = bancoCompletoRaw.map(it => { const tx = norm((it.erro||it.titulo||'')+' '+(it.solucao||it.conteudo||'')); return { it, s: w.filter(x => tx.includes(x)).length / w.length }; }).filter(x => x.s > 0).sort((p,q) => q.s - p.s); return sc.findIndex(x => x.it === a); };
      const A = bancoCompletoRaw.filter(r => (r.conteudo||'').length >= 700 && (r.titulo||'').length > 12 && !/[\\[\\]<>]/.test(r.titulo));
      const art = A.find(a => rank(a) === 0) || A.find(a => rank(a) <= 1);
      const U='${URLB}'; const imgs=[{url:U+'artigo-'+art.id+'/img-1.png', legenda:'Tela <b>inicial</b> do cadastro'},{url:U+'artigo-'+art.id+'/img-2.png', legenda:''}];
      art.imagens = imgs; const m = manualVetorizado.find(x => x.idSupabase === art.id); if (m) m.imagens = imgs;
      window.__art = art; window.gerarEmbedding = async () => null;   // sem a Jina: busca por palavras-chave
      window.__texto = String(art.conteudo).replace(/[*#]+/g,'').slice(0, 1400);
      window.callMCPSemPensamento = async () => ({ text: '' });
      window.callCurrentMCPStream = async function(){ const enc=new TextEncoder(); const t = window.__respostaTeste; let i=0; const rs=new ReadableStream({ async pull(ctrl){ if(i>=t.length){ ctrl.enqueue(enc.encode('data: [DONE]\\n\\n')); ctrl.close(); return;} const p=t.slice(i,i+40); i+=40; ctrl.enqueue(enc.encode('data: '+JSON.stringify({choices:[{delta:{content:p}}]})+'\\n\\n')); await new Promise(r=>setTimeout(r,8)); } }); return { resp:new Response(rs), provider:'openai', iaUsada:'Custom', iaModelo:'teste' }; };
      Prefs.set({ formatoResposta:'completa', desambiguar:false, esclarecer:false, ferramentaSugerida:false }, { quiet:true });
      return { id: art.id, titulo: art.titulo, rank: rank(art), naVetorial: !!m } })()`);
    console.log('artigo de teste:', JSON.stringify(prep));    async function perguntar(q, resp) {
        await c.eval("window.__respostaTeste = " + JSON.stringify(resp) + "; document.getElementById('searchInput').value = " + JSON.stringify(q) + "; handleChat({ forcarIA: true }); 0");
        for (let i = 0; i < 120; i++) { await L.sleep(250); if (!(await c.eval("document.body.classList.contains('ai-busy')")) && i > 6) break; }
        await L.sleep(1200);
        return c.eval(`(()=>{ const cs=[...document.querySelectorAll('#chatStream .answer-card')]; const u=cs[cs.length-1]; if(!u) return null; const g=u.querySelector('.bd-imagens'); const kids=[...u.children].map(k=>k.className.split(' ')[0]);
          return { temGaleria: !!g, figuras: g? g.querySelectorAll('figure').length : 0, legendas: g? [...g.querySelectorAll('figcaption')].map(f=>f.textContent) : [], carregadas: g? [...g.querySelectorAll('img')].map(i=>i.naturalWidth>0) : [], ordem: kids, alts: g? [...g.querySelectorAll('img')].map(i=>i.alt):[], html: g ? g.innerHTML.slice(0,600) : '' } })()`);
    }
    // a) pergunta com o título do artigo, resposta feita a partir do artigo → imagens
    const ra = await perguntar(prep.titulo, '## ' + prep.titulo + '\n\n' + await c.eval('window.__texto'));
    ok('A1 resposta feita a partir do artigo com imagens → galeria com 2 figuras', ra && ra.temGaleria && ra.figuras === 2, JSON.stringify({ figuras: ra && ra.figuras, legendas: ra && ra.legendas }));
    ok('A2 a galeria fica entre o texto e o "foi útil?"', ra && ra.ordem.indexOf('bd-imagens') > ra.ordem.indexOf('answer-section') && ra.ordem.indexOf('bd-imagens') < ra.ordem.indexOf('feedback-area'), JSON.stringify(ra && ra.ordem));
    ok('A3 as imagens carregaram de verdade (naturalWidth > 0)', ra && ra.carregadas.length === 2 && ra.carregadas.every(Boolean), JSON.stringify(ra && ra.carregadas));
    ok('A4 legenda com HTML aparece como TEXTO (sem injetar tag)', ra && ra.legendas[0] === 'Tela <b>inicial</b> do cadastro' && !/<b>inicial/.test(ra.html.replace(/&lt;/g, '<<')), ra && ra.legendas[0]);
    ok('A5 imagem sem legenda fica sem legenda e com texto alternativo', ra && ra.legendas.length === 1 && /Imagem do procedimento/.test(ra.alts[1]), JSON.stringify(ra && ra.alts));
    // b) ampliar
    await c.eval("document.querySelector('#chatStream .answer-card:last-of-type .bd-fig-btn').click(); 0"); await L.sleep(300);
    const lb = await c.eval("(()=>{ const l=document.querySelector('.bd-lb'); return l ? { img: !!l.querySelector('img.bd-lb-img') && /bancodados-imagens/.test(l.querySelector('img').src), aria: l.getAttribute('aria-modal'), abrir: (l.querySelector('a')||{}).rel } : null })()");
    ok('B1 clicar na imagem abre a janela ampliada (dialog, link seguro para outra guia)', lb && lb.img && lb.aria === 'true' && /noopener/.test(lb.abrir), JSON.stringify(lb));
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await L.sleep(250);
    ok('B2 Esc fecha a janela ampliada', await c.eval("!document.querySelector('.bd-lb')"));
    // c) conversa guardada e restaurada
    const hist = await c.eval("(()=>{ const cv = getConversaAtiva(); const m = cv.mensagens.filter(x => x.sender==='ai').pop(); return { n: m && m.imagens ? m.imagens.length : 0, url: m && m.imagens && m.imagens[0].url.split('/').pop() } })()");
    ok('H1 as imagens ficam guardadas na mensagem da conversa', hist.n === 2 && hist.url === 'img-1.png', JSON.stringify(hist));
    await c.eval("restaurarConversa(conversaAtivaId); 0"); await L.sleep(800);
    const rest = await c.eval("(()=>{ const g=document.querySelector('#chatStream .ai-msg .bd-imagens'); return g ? { fig: g.querySelectorAll('figure').length, dentro: !!g.closest('.message') } : null })()");
    ok('H2 ao reabrir a conversa as imagens voltam (dentro da mensagem)', rest && rest.fig === 2 && rest.dentro, JSON.stringify(rest));
    // d) NÃO mostra: resposta que não veio do artigo
    const rd = await perguntar(prep.titulo, 'Para configurar a impressão de etiquetas de volumes, acesse a rotina de expedição e escolha o modelo de etiqueta desejado, depois informe a quantidade de volumes e confirme a gravação do lote.');
    ok('N1 resposta sobre OUTRO assunto (mesmo com o artigo na busca) → sem imagem', rd && !rd.temGaleria, JSON.stringify(rd && rd.ordem));
    // d2) o caso REAL do dono (28.39.1): a resposta abre com o bloco "⚙️ Antes de tudo, verifique:" (vocabulário de outros artigos) e depois copia o procedimento do artigo → a imagem TEM que vir
    const dil = await c.eval(`(()=>{ const art = window.__art, B = BancoImg; const limpa = s => String(s).replace(/[*#>|\`_-]+/g, ' ');
      const proc = limpa(art.conteudo).split(/\\s+/).slice(0, 110).join(' ');
      const outros = bancoCompletoRaw.filter(r => r !== art && (r.conteudo||'').length >= 500 && !/[\\[\\]<>]/.test(r.titulo));
      let bloco = '', k = 0, u = 1;
      const montar = () => '## ' + art.titulo + '\\n\\n⚙️ **Antes de tudo, verifique:**\\n' + bloco + '\\nCom isso configurado, siga o procedimento:\\n' + proc;
      while (k < outros.length && k < 14) { bloco += '- ' + limpa(outros[k].conteudo).split(/\\s+/).slice(0, 40).join(' ') + '\\n'; k++; u = B.uso(art, B.tokens(montar())); if (u < 0.43) break; }
      const resp = montar(), cp = B.copia(art, B.trechos(resp));
      return { resposta: resp, uso: +u.toFixed(3), n: cp.n, fr: +cp.fr.toFixed(3), copiou: B.copiou(cp), blocos: k } })()`);
    console.log('resposta diluída de teste:', JSON.stringify({ uso: dil.uso, trechos: dil.n, fracao: dil.fr, blocos: dil.blocos }));
    logsImagens.length = 0;
    const rd2 = await perguntar(prep.titulo, dil.resposta);
    ok('A6 resposta DILUÍDA pelo bloco "Antes de tudo" (vocabulário em comum abaixo de 45 %: a regra antiga recusaria) mas com o procedimento copiado → galeria com 2 figuras', dil.uso < 0.45 && dil.copiou && rd2 && rd2.temGaleria && rd2.figuras === 2, JSON.stringify({ uso: dil.uso, trechos: dil.n, fracao: dil.fr, figuras: rd2 && rd2.figuras }));
    // d3) NÃO mostra: a resposta é cópia de OUTRO artigo real (o do teste está na busca, com imagem, mas não deu origem à resposta)
    const outroReal = await c.eval(`(()=>{ const art = window.__art, B = BancoImg; const limpa = s => String(s).replace(/[*#>|\`_-]+/g, ' ');
      const ach = bancoCompletoRaw.filter(r => r !== art && (r.conteudo||'').length >= 700 && !/[\\[\\]<>]/.test(r.titulo)).map(r => { const t = '## ' + r.titulo + '\\n\\n' + limpa(r.conteudo).slice(0, 1400); return { t, c: B.copia(art, B.trechos(t)), u: B.uso(art, B.tokens(t)) }; }).filter(x => !B.copiou(x.c) && x.u < 0.45)[0];
      return ach ? { resposta: ach.t, n: ach.c.n, uso: +ach.u.toFixed(3) } : null })()`);
    logsImagens.length = 0;
    const rd3 = outroReal && await perguntar(prep.titulo, outroReal.resposta);
    ok('N3 resposta copiada de OUTRO artigo real (o do teste só entrou na busca) → sem imagem', outroReal && rd3 && !rd3.temGaleria, JSON.stringify(outroReal && { trechos: outroReal.n, uso: outroReal.uso }));
    ok('L1 sem imagem por esse motivo, o console diz qual artigo tinha imagem e por que não entrou', logsImagens.some(t => /nenhuma entrou nesta resposta/.test(t) && new RegExp('#' + prep.id + ' ').test(t) && /não parece vir deste artigo/.test(t)), logsImagens.map(t => t.slice(0, 200)).join(' | ') || '(nenhuma linha)');
    // e) NÃO mostra: URL inválida gravada na coluna
    await c.eval("window.__art.imagens = [{ url: 'http://evil.example/x.png', legenda: 'x' }, { url: 'javascript:alert(1)' }, { url: 'data:image/png;base64,AAAA' }]; const m = manualVetorizado.find(x => x.idSupabase === window.__art.id); if (m) m.imagens = window.__art.imagens; 0");
    const re = await perguntar(prep.titulo, '## ' + prep.titulo + '\n\n' + await c.eval('window.__texto'));
    ok('N2 URL fora do armazenamento público do Supabase (http, javascript:, data:) → nenhuma imagem', re && !re.temGaleria);
    // f) arquivo que sumiu do armazenamento → aviso no lugar do ícone quebrado
    await c.eval("window.__art.imagens = [{ url: '" + URLB + "artigo-0/indisponivel.png', legenda: 'sumiu' }]; const m2 = manualVetorizado.find(x => x.idSupabase === window.__art.id); if (m2) m2.imagens = window.__art.imagens; 0");
    const rf = await perguntar(prep.titulo, '## ' + prep.titulo + '\n\n' + await c.eval('window.__texto'));
    const falha = await c.eval("(()=>{ const f=document.querySelector('#chatStream .answer-card:last-of-type .bd-fig-falha'); return f ? f.textContent : null })()");
    ok('E1 arquivo removido do armazenamento → "Imagem indisponível" (sem ícone quebrado)', rf && rf.temGaleria && /indispon/i.test(falha || ''), String(falha));
    // g) artigo SEM imagem: nada muda
    await c.eval("window.__art.imagens = null; const m3 = manualVetorizado.find(x => x.idSupabase === window.__art.id); if (m3) m3.imagens = null; 0");
    const rg = await perguntar(prep.titulo, '## ' + prep.titulo + '\n\n' + await c.eval('window.__texto'));
    ok('S1 artigo sem imagem → resposta normal, sem galeria', rg && !rg.temGaleria);
    const erros = await c.eval("window.__erros || []");
    ok('Z1 sem imagens extras pedidas à rede além das esperadas (3 arquivos de teste + 1 sumido)', pedidos.length >= 2 && pedidos.every(u => /bancodados-imagens/.test(u)), pedidos.length + ' pedidos');
    console.log('\n' + (res.every(Boolean) ? 'TODOS OS ' + res.length + ' TESTES PASSARAM' : res.filter(x => !x).length + ' FALHA(S)'));
    c.fechar(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
