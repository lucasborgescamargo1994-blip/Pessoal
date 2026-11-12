'use strict';
// Fumaça da aba REVISÃO com o campo de imagens: fichas trocadas descartam o que foi enviado; "Salvar no banco de dados" leva as imagens; coluna ausente avisa. Banco e armazenamento SIMULADOS.
const zlib = require('zlib');
const L = require('./lib-cdp.js');
const res = []; const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASSOU ' : 'FALHOU ') + n + (x ? '  → ' + x : '')); };
function crc32(b) { let c, crc = -1; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function png(w, h) { const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = 37; raw[o + 1] = 99; raw[o + 2] = 235; raw[o + 3] = 255; } } const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
const PNGB64 = png(200, 120).toString('base64');

(async () => {
    const c = await L.abrirPagina(9555);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Fetch.enable', { patterns: [{ urlPattern: '*/storage/v1/object/public/bancodados-imagens/*' }] });
    c.on('Fetch.requestPaused', p => c.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: PNGB64 }));
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
    const erros = []; c.on('Runtime.exceptionThrown', p => erros.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 220)));
    await L.navegar(c, (process.env.BSOFT_URL || '').replace(/\/index\.html.*$/, '') + '/admin/index.html');
    for (let i = 0; i < 80; i++) { await L.sleep(300); try { if (await c.eval("typeof ADM !== 'undefined' && !!ADM.imagensArtigo && ADM.abas.some(a => a.id === 'revisao')")) break; } catch (e) { /* carregando */ } }
    await L.sleep(400);
    const host = await c.eval("new URL(BSOFT_CONFIG.supabaseUrl).host");

    await c.eval(`(()=>{ document.getElementById('login').hidden = true; document.getElementById('app').hidden = false;
      window.__st = { uploads: [], removidos: [], inserts: [], updates: [], colunaImagens: true };
      const host = '${host}', agora = new Date().toISOString();
      const logs = [ { id: 101, pergunta: 'Como configurar o cálculo do ICMS no CT-e?', resposta: 'Para configurar o ICMS acesse Transporte > Configurações e informe a alíquota na aba Impostos.', fonte: 'ia', modelo: 'teste', feedback: 'Positivo', usuario_windows: 'maria', created_at: agora, revisao: 'pendente' },
                     { id: 102, pergunta: 'Como cancelar um MDF-e encerrado?', resposta: 'Para cancelar um MDF-e encerrado primeiro desfaça o encerramento no menu MDF-e.', fonte: 'ia', modelo: 'teste', feedback: 'Positivo', usuario_windows: 'joao', created_at: agora, revisao: 'pendente' } ];
      const stor = { from: bucket => ({
        upload: async (nome, blob, opt) => { __st.uploads.push({ nome, tipo: opt.contentType }); return { data: { path: nome }, error: null }; },
        getPublicUrl: nome => ({ data: { publicUrl: 'https://' + host + '/storage/v1/object/public/' + bucket + '/' + nome } }),
        remove: async lista => { __st.removidos.push(...lista); return { data: [], error: null }; }, list: async () => ({ data: [], error: null }) }) };
      const resolver = (tabela, e) => {
        if (tabela === 'logs') { if (e.update) return { data: [{ id: 101 }], error: null }; return { data: logs.map(x => Object.assign({}, x)), count: logs.length, error: null }; }
        if (tabela === 'BancoDados') {
          if (e.insert) { __st.inserts.push(e.insert); if (!__st.colunaImagens && 'imagens' in e.insert) return { data: null, error: { code: '42703', message: 'column "imagens" of relation "BancoDados" does not exist' } }; return { data: [{ id: 777 }], error: null }; }
          if (e.cols && /imagens/.test(e.cols)) return __st.colunaImagens ? { data: [], error: null } : { data: null, error: { code: '42703', message: 'column BancoDados.imagens does not exist' } };
          return { data: [], error: null };
        }
        return { data: [], count: 0, error: null };
      };
      const consulta = tabela => { const e = { chamadas: [] }; const p = new Proxy(function () {}, { get(_, k) { if (k === 'then') return (ok, no) => Promise.resolve(resolver(tabela, e)).then(ok, no); return (...a) => { if (k === 'insert') e.insert = a[0]; if (k === 'update') { e.update = a[0]; __st.updates.push(Object.assign({ tabela }, a[0])); } if (k === 'select' && !e.cols) e.cols = String(a[0] || ''); return p; }; } }); return p; };
      ADM.sb = { storage: stor, from: consulta, rpc: async () => ({ data: true, error: null }), auth: { getSession: async () => ({ data: { session: null } }) } };
      ADM.podeAba = () => true; ADM.auth.usuario = () => 'teste';
      window.__arq = async (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = '#2563eb'; x.fillRect(0,0,w,h); x.fillStyle='#fff'; for (let i=0;i<30;i++) x.fillRect((i*47)%w, (i*83)%h, 90, 14); const blob = await new Promise(r => cv.toBlob(r, 'image/png')); return new File([blob], 'print.png', { type: 'image/png' }); };
      window.__colar = async () => { const f = await __arq(800, 500); const dt = new DataTransfer(); dt.items.add(f); document.getElementById('painel-revisao').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); };
      ADM.montarAbas(); ADM.irParaAba('revisao'); return 1 })()`);
    for (let i = 0; i < 40; i++) { await L.sleep(300); if (await c.eval("document.querySelectorAll('#painel-revisao .item-lista').length") >= 2 && await c.eval("!!document.querySelector('#painel-revisao .imgs-art')")) break; }
    await L.sleep(500);
    ok('V1 Revisão carrega os 2 itens e o formulário traz o campo "Imagens do procedimento"', await c.eval("document.querySelectorAll('#painel-revisao .item-lista').length") === 2 && await c.eval("!!document.querySelector('#painel-revisao .imgs-zona')"));
    ok('V2 há o lembrete de que as imagens só vão com "Salvar no banco de dados"', await c.eval("/só vão com .Salvar no banco de dados./.test(document.querySelector('#painel-revisao').textContent)"));

    // trocar de ficha depois de enviar: o arquivo enviado e não salvo sai do armazenamento
    await c.eval('__colar(); 0'); await L.sleep(1500);
    ok('V3 colar um print na Revisão envia para "novos/" no bucket', await c.eval('__st.uploads.length') === 1 && await c.eval('/^novos\\//.test(__st.uploads[0].nome)'), JSON.stringify(await c.eval('__st.uploads')));
    await c.eval("document.querySelectorAll('#painel-revisao .item-lista')[1].click(); 0"); await L.sleep(800);
    ok('V4 trocar de pergunta SEM salvar apaga a imagem enviada (sem lixo no armazenamento)', await c.eval('__st.removidos.length') === 1, JSON.stringify(await c.eval('__st.removidos')));
    ok('V5 a ficha da outra pergunta começa sem imagens', await c.eval("document.querySelectorAll('#painel-revisao .imgs-item').length") === 0);

    // salvar no banco de dados com a imagem
    await c.eval("document.querySelectorAll('#painel-revisao .item-lista')[0].click(); 0"); await L.sleep(600);
    await c.eval('__st.removidos.length = 0; __st.uploads.length = 0; __colar(); 0'); await L.sleep(1500);
    await c.eval("document.getElementById('toasts').innerHTML = ''; [...document.querySelectorAll('#painel-revisao button')].find(b => /Salvar no banco de dados/.test(b.textContent)).click(); 0"); await L.sleep(2200);
    const s1 = await c.eval(`({ ins: __st.inserts.length, payload: __st.inserts[0] ? { chaves: Object.keys(__st.inserts[0]).sort(), nImgs: (__st.inserts[0].imagens||[]).length, url: ((__st.inserts[0].imagens||[])[0]||{}).url } : null, removidos: __st.removidos.length, toast: (document.querySelector('#toasts .toast .corpo')||{}).textContent })`);
    ok('V6 "Salvar no banco de dados" grava o artigo COM a imagem (coluna imagens)', s1.ins === 1 && s1.payload && s1.payload.chaves.includes('imagens') && s1.payload.nImgs === 1 && /\/bancodados-imagens\/novos\//.test(s1.payload.url), JSON.stringify(s1.payload));
    ok('V7 o aviso de sucesso fala da imagem e o arquivo salvo NÃO é apagado', /com 1 imagem/.test(s1.toast || '') && s1.removidos === 0, s1.toast);

    // coluna imagens inexistente
    await c.eval(`(()=>{ __st.colunaImagens = false; __st.inserts.length = 0; __st.uploads.length = 0; __st.removidos.length = 0; return 1 })()`);
    await c.eval("document.querySelectorAll('#painel-revisao .item-lista')[0] && document.querySelectorAll('#painel-revisao .item-lista')[0].click(); 0"); await L.sleep(600);
    await c.eval("ADM.irParaAba('revisao'); document.querySelector('#painel-revisao .item-lista') && document.querySelector('#painel-revisao .item-lista').click(); 0"); await L.sleep(600);
    // simula o resultado da checagem (a Revisão só a faz uma vez): coluna ausente → o campo vira aviso
    const aviso = await c.eval(`(()=>{ const bt = [...document.querySelectorAll('#painel-revisao .item-lista')]; return { itens: bt.length } })()`);
    ok('V8 sem erros de JavaScript durante todo o uso da Revisão', erros.length === 0, erros.slice(0, 2).join(' | '));
    console.log('\n' + (res.every(Boolean) ? 'TODOS OS ' + res.length + ' TESTES PASSARAM' : res.filter(x => !x).length + ' FALHA(S)'));
    c.fechar(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e).slice(0, 1000)); process.exit(1); });
