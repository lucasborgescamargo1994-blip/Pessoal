'use strict';
// Testa o PAINEL de imagens do procedimento (admin/js/imagens-artigo.js) com um armazenamento/banco SIMULADOS (nada vai ao Supabase de verdade).
const zlib = require('zlib'), fs = require('fs');
const L = require('./lib-cdp.js');
const res = []; const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASSOU ' : 'FALHOU ') + n + (x ? '  → ' + x : '')); };
function crc32(b) { let c, crc = -1; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function png(w, h, cor) { const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4; let p = [245, 245, 247, 255]; if (y < 44) p = cor; else if (x > 30 && x < w - 30 && y > 80 && y < h - 40 && (y - 80) % 56 < 40) p = [255, 255, 255, 255]; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; } } const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
const PNGB64 = png(640, 400, [37, 99, 235, 255]).toString('base64');

(async () => {
    const c = await L.abrirPagina(9555);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Fetch.enable', { patterns: [{ urlPattern: '*/storage/v1/object/public/bancodados-imagens/*' }] });
    c.on('Fetch.requestPaused', p => c.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: PNGB64 }));
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await L.navegar(c, (process.env.BSOFT_URL || '').replace(/\/index\.html.*$/, '') + '/admin/index.html');
    for (let i = 0; i < 80; i++) { await L.sleep(300); try { if (await c.eval("typeof ADM !== 'undefined' && !!ADM.imagensArtigo && typeof ADM.editorImagensArtigo === 'function' && typeof ADM.editarArtigoBanco === 'function'")) break; } catch (e) { /* carregando */ } }
    await L.sleep(500);
    const host = await c.eval("new URL(BSOFT_CONFIG.supabaseUrl).host");
    // painel visível (sem login) + armazenamento e banco de mentira
    await c.eval(`(()=>{ document.getElementById('login').hidden = true; document.getElementById('app').hidden = false;
      window.__st = { uploads: [], removidos: [], falha: null, updates: [], row: null, colunaImagens: true };
      const host = '${host}';
      const stor = { from: bucket => ({
        upload: async (nome, blob, opt) => { if (__st.falha) return { error: __st.falha }; __st.uploads.push({ bucket, nome, tipo: opt.contentType, tam: blob.size }); return { data: { path: nome }, error: null }; },
        getPublicUrl: nome => ({ data: { publicUrl: 'https://' + host + '/storage/v1/object/public/' + bucket + '/' + nome } }),
        remove: async lista => { __st.removidos.push(...lista); return { data: [], error: null }; },
        list: async () => ({ data: [], error: null }) }) };
      ADM.sb = { storage: stor, from: tabela => ({
        select: cols => { const colAusente = /imagens/.test(cols) && !__st.colunaImagens; const q = { eq: () => q, maybeSingle: async () => colAusente ? { data: null, error: { code: '42703', message: 'column BancoDados.imagens does not exist' } } : { data: Object.assign({}, __st.row), error: null }, then: r => r({ data: [], error: null }) }; return q; },
        update: payload => { __st.updates.push(payload); const q = { eq: () => q, select: async () => ({ data: [{ id: 5, titulo: 'T', categoria: null }], error: null }) }; return q; } }) };
      return 1 })()`);
    // helpers de arquivos de imagem criados na página
    await c.eval(`window.__arq = async (w, h, tipo, nome) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); const g = x.createLinearGradient(0,0,w,h); g.addColorStop(0,'#2563eb'); g.addColorStop(1,'#f97316'); x.fillStyle = g; x.fillRect(0,0,w,h); x.fillStyle='#fff'; for (let i=0;i<60;i++) x.fillRect((i*47)%w, (i*83)%h, 120, 18); x.font='28px sans-serif'; x.fillStyle='#000'; for (let i=0;i<30;i++) x.fillText('Linha de teste '+i+' com texto qualquer', 20, 30+i*34); const blob = await new Promise(r => cv.toBlob(r, tipo || 'image/png')); return new File([blob], nome || 'print.png', { type: tipo || 'image/png' }); }; 1`);

    // ── preparar(): reduz e comprime ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const w1 = await c.eval(`(async()=>{ const f = await __arq(3200, 1800, 'image/png'); const p = await ADM.imagensArtigo.preparar(f); return { w: p.largura, h: p.altura, tipo: p.tipo, ext: p.ext, antes: f.size, depois: p.blob.size } })()`);
    ok('W1 print de 3200×1800 vira ≤ 1600 de largura, WebP e bem menor', w1.w === 1600 && w1.h === 900 && w1.tipo === 'image/webp' && w1.depois < w1.antes, JSON.stringify(w1));
    const w2 = await c.eval(`(async()=>{ const out = {}; const t = async (f) => { try { await ADM.imagensArtigo.preparar(f); return 'ok'; } catch (e) { return (e.local ? 'LOCAL: ' : 'OUTRO: ') + e.message; } };
      out.pdf = await t(new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' }));
      out.gigante = await t(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })).then(() => 'x');
      const gifOk = new File([new Uint8Array(2000)], 'a.gif', { type: 'image/gif' }); out.gifPequeno = await t(gifOk);
      out.gifGrande = await t(new File([new Uint8Array(6 * 1048576)], 'g.gif', { type: 'image/gif' }));
      out.quebrada = await t(new File([new Uint8Array(500)], 'q.png', { type: 'image/png' }));
      return out })()`);
    ok('W2 formato não aceito (PDF) e GIF > 5 MB → mensagem clara, locais', /LOCAL: Formato não aceito/.test(w2.pdf) && /LOCAL: O GIF passa de 5 MB/.test(w2.gifGrande), JSON.stringify([w2.pdf, w2.gifGrande]));
    ok('W3 GIF pequeno passa sem recomprimir; arquivo danificado → erro local legível', w2.gifPequeno === 'ok' && /LOCAL: Não consegui abrir esta imagem/.test(w2.quebrada), JSON.stringify([w2.gifPequeno, w2.quebrada]));

    // ── o editor: colar, arrastar, escolher ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    await c.eval(`(()=>{ window.__estado = ADM.imagensArtigo.novoEstado(null); window.__ed = ADM.editorImagensArtigo({ estado: __estado, pasta: 'artigo-7', aoMudar: () => { window.__mudou = (window.__mudou||0)+1; } }); window.__modal = ADM.ui.modal({ titulo: 'Teste', largura: 760, corpo: [__ed.el], botoes: [] }); return 1 })()`);
    await L.sleep(300);
    // colar um print (Ctrl+V com imagem na área de transferência)
    await c.eval(`(async()=>{ const f = await __arq(1000, 700, 'image/png', 'print.png'); const dt = new DataTransfer(); dt.items.add(f); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); window.__colarPrevenido = !document.querySelector('.modal').dispatchEvent(ev); return 1 })()`);
    await L.sleep(1500);
    const p1 = await c.eval(`({ itens: __estado.itens.length, novos: __estado.novos.length, up: __st.uploads.map(u => u.nome.replace(/\\d[a-z0-9]+-[a-z0-9]+/, 'ID')), tipo: __st.uploads[0] && __st.uploads[0].tipo, prevenido: window.__colarPrevenido, miniaturas: document.querySelectorAll('.imgs-item img').length, status: document.querySelector('.imgs-status').textContent })`);
    ok('W4 colar print (Ctrl+V): enviado ao bucket certo (artigo-7/….webp), contado como novo, miniatura na tela', p1.itens === 1 && p1.novos === 1 && /^artigo-7\/.+\.webp$/.test(p1.up[0]) && p1.tipo === 'image/webp' && p1.prevenido && p1.miniaturas === 1, JSON.stringify(p1));
    ok('W5 aviso de sucesso pede para salvar o artigo', /enviada/.test(p1.status) && /Salve/.test(p1.status), p1.status);
    // colar TEXTO não pode ser interceptado
    const txt = await c.eval(`(()=>{ const dt = new DataTransfer(); dt.setData('text/plain', 'olá'); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); const nao = document.querySelector('.modal').dispatchEvent(ev); return { seguiu: nao, itens: __estado.itens.length } })()`);
    ok('W6 colar texto segue o comportamento normal (não é interceptado)', txt.seguiu === true && txt.itens === 1, JSON.stringify(txt));
    // arrastar e soltar
    await c.eval(`(async()=>{ const f = await __arq(800, 500, 'image/jpeg', 'solta.jpg'); const dt = new DataTransfer(); dt.items.add(f); const z = document.querySelector('.imgs-zona'); z.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); z.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return 1 })()`);
    await L.sleep(1500);
    const p2 = await c.eval(`({ itens: __estado.itens.length, up: __st.uploads.length })`);
    ok('W7 arrastar e soltar um arquivo JPG adiciona a imagem', p2.itens === 2 && p2.up === 2, JSON.stringify(p2));
    // escolher pelo botão (input file)
    await c.eval(`(async()=>{ const f = await __arq(600, 400, 'image/png', 'escolhida.png'); const dt = new DataTransfer(); dt.items.add(f); const inp = document.querySelector('.imgs-zona input[type=file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); return 1 })()`);
    await L.sleep(1500);
    ok('W8 escolher arquivo pelo botão "Adicionar imagem" adiciona a imagem', await c.eval('__estado.itens.length') === 3);
    // legenda e ordem
    await c.eval(`(()=>{ const ins = document.querySelectorAll('.imgs-item input[type=text]'); ins[0].value = '  Tela   de Parâmetros '; ins[0].dispatchEvent(new Event('input', { bubbles: true })); return 1 })()`);
    const v1 = await c.eval(`(()=>{ const v = ADM.imagensArtigo.valorParaGravar(__estado); return { n: v.length, leg: v[0].legenda, semLeg: !('legenda' in v[1]), mudou: ADM.imagensArtigo.mudou(__estado, null) } })()`);
    ok('W9 legenda é limpa e gravada; imagem sem legenda não leva o campo; "mudou" reconhece', v1.n === 3 && v1.leg === 'Tela de Parâmetros' && v1.semLeg && v1.mudou, JSON.stringify(v1));
    const ord = await c.eval(`(()=>{ const antes = __estado.itens.map(i => i.url.split('/').pop()); const bt = document.querySelectorAll('.imgs-item')[0].querySelector('button[aria-label="Mover para depois"]'); bt.click(); const depois = __estado.itens.map(i => i.url.split('/').pop()); return { trocou: antes[0] === depois[1] && antes[1] === depois[0], desabilitadoPrimeiroSubir: document.querySelectorAll('.imgs-item')[0].querySelector('button[aria-label="Mover para antes"]').disabled } })()`);
    ok('W10 mover para depois troca a ordem (e o 1º não sobe)', ord.trocou && ord.desabilitadoPrimeiroSubir, JSON.stringify(ord));
    // tirar uma imagem NOVA (nunca salva): some do armazenamento já
    await c.eval(`__st.removidos.length = 0; document.querySelectorAll('.imgs-item')[2].querySelector('button.perigo').click(); 0`); await L.sleep(300);
    const r1 = await c.eval(`({ itens: __estado.itens.length, novos: __estado.novos.length, rem: __st.removidos.length, removidosLista: __estado.removidos.length })`);
    ok('W11 tirar imagem enviada nesta edição apaga o arquivo na hora (não salva = sem dono)', r1.itens === 2 && r1.novos === 2 && r1.rem === 1 && r1.removidosLista === 0, JSON.stringify(r1));
    // cancelar a janela: o que sobrou de novo é apagado; depois de salvar, não
    await c.eval(`__st.removidos.length = 0; __modal.fechar(); 0`); await L.sleep(100);
    await c.eval(`ADM.imagensArtigo.descartar(__estado); 0`); await L.sleep(300);
    ok('W12 cancelar (descartar) apaga as 2 imagens que não chegaram a ser salvas', await c.eval('__st.removidos.length') === 2 && await c.eval('__estado.novos.length') === 0);
    // salvo: descartar não apaga nada; removidos já salvos saem só DEPOIS de salvar
    const sv = await c.eval(`(async()=>{ const U = 'https://${host}/storage/v1/object/public/bancodados-imagens/artigo-9/'; const est = ADM.imagensArtigo.novoEstado([{ url: U+'a.webp' }, { url: U+'b.webp', legenda: 'B' }]);
      __st.removidos.length = 0;
      const ed = ADM.editorImagensArtigo({ estado: est, pasta: 'artigo-9' }); document.body.appendChild(ed.el);
      ed.el.querySelectorAll('.imgs-item')[0].querySelector('button.perigo').click();
      const antes = { removidos: __st.removidos.length, guardados: est.removidos.length, mudou: ADM.imagensArtigo.mudou(est) };
      await ADM.imagensArtigo.aposSalvar(est);
      const depois = { removidos: __st.removidos.slice(), salvo: est.salvo, original: est.original.length };
      __st.removidos.length = 0; await ADM.imagensArtigo.descartar(est); const aposDescartar = __st.removidos.length;
      ed.el.remove(); return { antes, depois, aposDescartar } })()`);
    ok('W13 imagem JÁ salva e tirada: só sai do armazenamento depois de salvar o artigo', sv.antes.removidos === 0 && sv.antes.guardados === 1 && sv.antes.mudou && sv.depois.removidos.length === 1 && /artigo-9\/a\.webp$/.test(sv.depois.removidos[0]) && sv.depois.salvo, JSON.stringify(sv));
    ok('W14 depois de salvo, descartar não apaga mais nada', sv.aposDescartar === 0);
    // erros do armazenamento
    const er = await c.eval(`(async()=>{ const est = ADM.imagensArtigo.novoEstado(null); const ed = ADM.editorImagensArtigo({ estado: est, pasta: 'artigo-1' }); document.body.appendChild(ed.el); const out = {};
      const tentar = async (falha) => { __st.falha = falha; document.getElementById('toasts').innerHTML = ''; const f = await __arq(300, 200, 'image/png'); const dt = new DataTransfer(); dt.items.add(f); const inp = ed.el.querySelector('input[type=file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 1200)); return (document.querySelector('#toasts .toast .corpo') || {}).textContent || ''; };
      out.bucket = await tentar({ message: 'Bucket not found', statusCode: '404' });
      out.rls = await tentar({ message: 'new row violates row-level security policy', statusCode: '403' });
      out.grande = await tentar({ message: 'The object exceeded the maximum allowed size', statusCode: '413' });
      out.mime = await tentar({ message: 'mime type image/x is not supported' });
      __st.falha = null; out.itens = est.itens.length; ed.el.remove(); return out })()`);
    ok('W15 bucket inexistente → manda rodar o sql/09_bancodados_imagens.sql', /09_bancodados_imagens\.sql/.test(er.bucket), er.bucket.slice(0, 110));
    ok('W16 sem permissão (RLS), arquivo grande e tipo recusado → mensagens específicas; nada é adicionado', /sem permissão/.test(er.rls) && /5 MB/.test(er.grande) && /tipo de arquivo/.test(er.mime) && er.itens === 0, JSON.stringify([er.rls.slice(0, 40), er.grande.slice(0, 40), er.mime.slice(0, 40), er.itens]));
    // limite de 6
    const lim = await c.eval(`(async()=>{ const U = 'https://${host}/storage/v1/object/public/bancodados-imagens/artigo-3/'; const est = ADM.imagensArtigo.novoEstado(Array.from({length:6},(_, i)=>({ url: U+i+'.webp' }))); const ed = ADM.editorImagensArtigo({ estado: est, pasta: 'artigo-3' }); document.body.appendChild(ed.el);
      const bt = ed.el.querySelector('.imgs-zona button.btn'); const desab = bt.disabled; ed.el.remove(); return { desab, n: est.itens.length } })()`);
    ok('W17 com 6 imagens o botão "Adicionar imagem" fica desabilitado (máximo por artigo)', lim.desab && lim.n === 6);
    // coluna ausente → aviso
    const dis = await c.eval(`(()=>{ const ed = ADM.editorImagensArtigo({ estado: ADM.imagensArtigo.novoEstado(null), desabilitado: true }); document.body.appendChild(ed.el); const t = ed.el.textContent; const temZona = !!ed.el.querySelector('.imgs-zona'); ed.el.remove(); return { t: t.slice(0, 140), temZona } })()`);
    ok('W18 coluna inexistente → aviso com o nome do SQL e sem área de envio', /09_bancodados_imagens\.sql/.test(dis.t) && !dis.temZona, dis.t);

    // ── "Corrigir artigo" (ADM.editarArtigoBanco) de ponta a ponta, com banco simulado ───────────────────────────────────────────────────────────────────────────────────────────
    await c.eval(`__st.row = { id: 5, titulo: 'Como emitir o CT-e', conteudo: 'Passo 1: abra a tela. Passo 2: informe os dados do remetente e do destinatário.', como_emitir: null, categoria: 'CT-e', caminho_menu: 'Transporte > Documentos', imagens: null }; __st.colunaImagens = true; __st.updates.length = 0; __st.uploads.length = 0; 0`);
    await c.eval(`window.__j = null; ADM.editarArtigoBanco(5, {}).then(m => { window.__j = m; }); 0`); await L.sleep(800);
    ok('E1 "Corrigir artigo" abre com o campo de imagens (coluna existe)', await c.eval("!!document.querySelector('.modal .imgs-zona')"));
    await c.eval(`(async()=>{ const f = await __arq(900, 600, 'image/png'); const dt = new DataTransfer(); dt.items.add(f); document.querySelector('.modal').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return 1 })()`); await L.sleep(1500);
    await c.eval("document.getElementById('toasts').innerHTML = ''; document.querySelectorAll('.modal-rodape .btn')[1].click(); 0"); await L.sleep(1200);
    const e2 = await c.eval(`({ n: __st.updates.length, payload: __st.updates[0] ? { chaves: Object.keys(__st.updates[0]), imgs: __st.updates[0].imagens } : null, modalAberto: !!document.querySelector('.modal'), toast: (document.querySelector('#toasts .toast .corpo')||{}).textContent })`);
    ok('E2 salvar só com imagem nova grava APENAS "imagens" (o vetor de busca NÃO é descartado)', e2.n === 1 && JSON.stringify(e2.payload.chaves) === '["imagens"]' && e2.payload.imgs.length === 1 && /^https:/.test(e2.payload.imgs[0].url) && !('embedding' in e2.payload), JSON.stringify(e2.payload));
    ok('E3 a janela fecha e o aviso fala das imagens', !e2.modalAberto && /Imagens do artigo #5 salvas/.test(e2.toast || ''), e2.toast);
    ok('E4 as imagens salvas NÃO são apagadas ao fechar a janela', await c.eval('__st.removidos.filter(n => /artigo-5/.test(n)).length') === 0);
    // só o texto muda: grava o texto + descarta o vetor, e NÃO mexe em "imagens"
    await c.eval(`__st.updates.length = 0; __st.removidos.length = 0; __st.row.conteudo = 'Texto antigo do artigo com bastante conteúdo.'; ADM.editarArtigoBanco(5, {}); 0`); await L.sleep(800);
    await c.eval(`(()=>{ const ta = document.querySelector('.modal textarea'); ta.value = 'Texto NOVO do artigo com bastante conteúdo e mais detalhes.'; ta.dispatchEvent(new Event('input', { bubbles: true })); document.querySelectorAll('.modal-rodape .btn')[1].click(); return 1 })()`); await L.sleep(1000);
    const e5 = await c.eval(`__st.updates[0] ? Object.keys(__st.updates[0]).sort() : null`);
    ok('E5 mudar só o texto grava o texto e descarta o vetor, sem tocar em "imagens"', JSON.stringify(e5) === JSON.stringify(['conteudo', 'embedding']), JSON.stringify(e5));
    // cancelar depois de enviar: o arquivo enviado é apagado
    await c.eval(`__st.removidos.length = 0; __st.uploads.length = 0; __st.row.conteudo = 'Conteúdo qualquer do artigo para o teste de cancelar.'; ADM.editarArtigoBanco(5, {}); 0`); await L.sleep(800);
    await c.eval(`(async()=>{ const f = await __arq(500, 300, 'image/png'); const dt = new DataTransfer(); dt.items.add(f); document.querySelector('.modal').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return 1 })()`); await L.sleep(1400);
    await c.eval(`document.querySelectorAll('.modal-rodape .btn')[0].click(); 0`); await L.sleep(600);
    const e6 = await c.eval(`({ subiu: __st.uploads.length, apagou: __st.removidos.length, modal: !!document.querySelector('.modal') })`);
    ok('E6 enviar uma imagem e CANCELAR a janela apaga o arquivo enviado (sem lixo no armazenamento)', e6.subiu === 1 && e6.apagou === 1 && !e6.modal, JSON.stringify(e6));
    // coluna "imagens" inexistente: o artigo abre igual, com o aviso
    await c.eval(`__st.colunaImagens = false; ADM.editarArtigoBanco(5, {}); 0`); await L.sleep(800);
    const e7 = await c.eval(`({ aviso: /09_bancodados_imagens\\.sql/.test((document.querySelector('.modal .imgs-art')||{}).textContent || ''), zona: !!document.querySelector('.modal .imgs-zona'), titulo: !!document.querySelector('.modal input') })`);
    ok('E7 SQL 09 não rodado: "Corrigir artigo" abre normalmente, com o aviso de como habilitar as imagens', e7.aviso && !e7.zona && e7.titulo, JSON.stringify(e7));
    await c.eval(`document.querySelectorAll('.modal-rodape .btn')[0].click(); 0`);

    // ── visual: o campo com duas imagens ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    await c.eval(`__st.colunaImagens = true; __st.row.imagens = [{ url: 'https://${host}/storage/v1/object/public/bancodados-imagens/artigo-5/1.webp', legenda: 'Tela de Parâmetros' }, { url: 'https://${host}/storage/v1/object/public/bancodados-imagens/artigo-5/2.webp' }]; ADM.editarArtigoBanco(5, {}); 0`); await L.sleep(1500);
    const png1 = (await c.send('Page.captureScreenshot', { format: 'png' })).data;
    fs.writeFileSync(require('os').tmpdir() + '/admin-imagens.png', Buffer.from(png1, 'base64'));
    const erros = await c.eval('window.__errosPagina || []');
    console.log('\n' + (res.every(Boolean) ? 'TODOS OS ' + res.length + ' TESTES PASSARAM' : res.filter(x => !x).length + ' FALHA(S)'));
    c.fechar(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e).slice(0, 1200)); process.exit(1); });
