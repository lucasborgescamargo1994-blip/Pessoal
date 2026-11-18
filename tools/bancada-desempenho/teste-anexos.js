'use strict';
// Testa a IMAGEM ANEXADA AO CHAT (v28.40, js/app/anexos.js) em ?sim=1, com a IA SIMULADA (nada de rede): colar/arrastar/escolher só anexa, o envio lê a imagem e responde à pergunta,
// histórico, falha com "tentar de novo", segurança do texto lido da imagem. O teste com a IA de verdade é o teste-anexos-ia-real.js.
const L = require('./lib-cdp.js');
const res = []; const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASSOU ' : 'FALHOU ') + n + (x ? '  → ' + x : '')); };

(async () => {
    const c = await L.abrirPagina(9555);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true });   // (sem cache: o arquivo editado agora é o que roda)
    const erros = []; c.on('Runtime.exceptionThrown', p => erros.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 300)));
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf'); localStorage.removeItem('bsoft_v27_prefs'); localStorage.removeItem('bsoft_conversas')}catch(e){}" });
    await L.navegar(c, L.URL_APP);
    for (let i = 0; i < 240; i++) { await L.sleep(400); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&bancoCompletoRaw.length>100&&typeof Anexos!=='undefined'&&!document.getElementById('sendBtn').disabled)})()")) break; } catch (e) { /* carregando */ } }
    await L.sleep(1200);

    // ── ferramentas dentro da página: imagens desenhadas, colar/soltar de mentira, IA simulada, espiões ──
    await c.eval(`(() => {
      window.__img = (w, h, falas, nome, ruido) => new Promise(res => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
        x.fillStyle = '#efeae2'; x.fillRect(0, 0, w, h); x.fillStyle = '#075e54'; x.fillRect(0, 0, w, 56); x.fillStyle = '#fff'; x.font = 'bold 18px Segoe UI'; x.fillText('Cliente', 20, 36);
        let y = 80; (falas || ['Bom dia, preciso de ajuda']).forEach(t => { x.font = '16px Segoe UI'; const l = Math.min(w - 80, x.measureText(t).width + 32); x.fillStyle = '#fff'; x.fillRect(20, y, l, 40); x.fillStyle = '#111'; x.fillText(t, 36, y + 26); y += 52; });
        if (ruido) { for (let i = 0; i < 2600; i++) { x.fillStyle = 'hsl(' + ((Math.random() * 360) | 0) + ',' + (30 + Math.random() * 60 | 0) + '%,' + (35 + Math.random() * 50 | 0) + '%)'; x.fillRect(Math.random() * w, Math.random() * h, 8 + Math.random() * 160, 3 + Math.random() * 40); } x.fillStyle = '#000'; x.font = '15px Segoe UI'; for (let i = 0; i < 90; i++) x.fillText('linha ' + i + ' do sistema: campo valor ' + ((Math.random() * 1e6) | 0), 20 + (i % 3) * (w / 3), 90 + ((i / 3) | 0) * (h / 34)); }   // (tela cheia de detalhes: retângulos de cores e muito texto)
        cv.toBlob(b => res(new File([b], nome || 'print.png', { type: 'image/png' })), 'image/png'); });
      window.__colar = (alvo, arquivos, texto) => { const dt = new DataTransfer(); (arquivos || []).forEach(f => dt.items.add(f)); if (texto) dt.setData('text/plain', texto); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); (alvo || document.getElementById('searchInput')).dispatchEvent(ev); return ev.defaultPrevented; };
      window.__soltar = (alvo, arquivos) => { const dt = new DataTransfer(); arquivos.forEach(f => dt.items.add(f)); const o = { dataTransfer: dt, bubbles: true, cancelable: true }; alvo.dispatchEvent(new DragEvent('dragenter', o)); alvo.dispatchEvent(new DragEvent('dragover', o)); const sol = new DragEvent('drop', o); alvo.dispatchEvent(sol); return sol.defaultPrevented; };
      window.__espera = async (cond, ms) => { const t0 = performance.now(); while (performance.now() - t0 < (ms || 8000)) { if (cond()) return true; await new Promise(r => setTimeout(r, 60)); } return false; };
      // IA simulada: a leitura (visão) devolve o que __leitura mandar; a resposta do chat (stream) devolve __resposta e guarda o prompt
      window.__visao = []; window.__prompts = []; window.__logs = []; window.__leitura = 'RESUMO: O cliente não consegue emitir a carta de correção de um CT-e: aparece que não tem permissão. Já saiu e entrou de novo no sistema.\\nTEXTOS: você não tem permissão para essa ação\\nCT-e 4821\\nBUSCA: carta de correção CT-e sem permissão';
      window.__falhaVisao = 0;
      window.callMCPVision = async (msgs, cfg) => { window.__visao.push({ msgs, cfg }); if (window.__falhaVisao > 0) { window.__falhaVisao--; throw new Error('simulado: sem modelo de visão'); } return { text: window.__leitura }; };
      window.__resposta = '**O que o cliente relata** — não consegue emitir a carta de correção (sem permissão).\\n\\n**Por onde começar**\\n1. Conferir a funcionalidade de permissão do usuário.\\n\\n#finalizado';
      window.callCurrentMCPStream = async function (messages) { window.__prompts.push(messages); const enc = new TextEncoder(), t = window.__resposta; let i = 0; const rs = new ReadableStream({ async pull(ctrl) { if (i >= t.length) { ctrl.enqueue(enc.encode('data: [DONE]\\n\\n')); ctrl.close(); return; } const p = t.slice(i, i + 40); i += 40; ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: p } }] }) + '\\n\\n')); await new Promise(r => setTimeout(r, 6)); } }); return { resp: new Response(rs), provider: 'openai', iaUsada: 'Custom', iaModelo: 'teste' }; };
      window.callMCPAPI = async () => ({ text: '' }); window.callMCPSemPensamento = async () => ({ text: '' }); window.gerarEmbedding = async () => null;
      const logOrig = window.logSearch; window.logSearch = function () { window.__logs.push([].slice.call(arguments)); return logOrig ? logOrig.apply(this, arguments) : null; };
      Prefs.set({ formatoResposta: 'perguntar', desambiguar: false, esclarecer: false, ferramentaSugerida: false }, { quiet: true });   // (o formato fica "perguntar": o envio com imagem NÃO pode perguntar curta/completa)
      window.__estado = () => { const b = document.getElementById('anexosBandeja'); return { chips: b.querySelectorAll('.anx-chip').length, ligada: b.classList.contains('is-on'), ph: document.getElementById('searchInput').placeholder, pend: Anexos.pendentes().length }; };
      return true; })()`);
    const estado = () => c.eval('window.__estado()');
    const guardar = async (chave, n, falas, nome, ruido) => { await c.eval(`window.__img(${n[0]}, ${n[1]}, ${JSON.stringify(falas || null)}, ${JSON.stringify(nome || 'print.png')}, ${!!ruido}).then(f => { window['${chave}'] = f; })`); };
    const limpar = async () => { await c.eval('Anexos.pendentes().forEach(a => Anexos.remover(a.id)); document.getElementById("searchInput").value = ""; 0'); };

    // ══ A) anexar: nada vai para a IA ══
    await guardar('__f1', [720, 480]);
    const colou = await c.eval('window.__colar(null, [window.__f1])');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1 && !Anexos.pendentes()[0].preparando)');
    let e1 = await estado();
    const miniatura = await c.eval(`(() => { const i = document.querySelector('#anexosBandeja .anx-chip img'); return i ? { w: i.naturalWidth, h: i.naturalHeight } : null })()`);
    ok('A1 colar uma imagem (Ctrl+V) só ANEXA: miniatura na bandeja, campo ganha o foco e o texto de ajuda muda — a IA não é chamada', colou && e1.chips === 1 && e1.ligada && /imagem/i.test(e1.ph) && miniatura && miniatura.w === 720 && (await c.eval('window.__visao.length === 0 && window.__prompts.length === 0 && document.activeElement === document.getElementById("searchInput")')), JSON.stringify({ colou, e1, miniatura }));
    const ordem = await c.eval(`[...document.querySelector('.input-wrapper').children].map(k => k.className.split(' ')[0])`);
    ok('A2 a bandeja fica logo ACIMA do campo de digitação (depois das sugestões)', ordem.indexOf('anx-bandeja') === ordem.indexOf('input-area') - 1, JSON.stringify(ordem));
    await c.eval('Anexos.remover(Anexos.pendentes()[0].id); 0');
    // o mesmo print em dois formatos (image.png + image.bmp, como alguns programas fazem) vira UM anexo; dois arquivos de nomes diferentes (copiados no Explorer) viram dois
    await guardar('__g1', [300, 200], ['um'], 'image.png'); await guardar('__g2', [300, 200], ['um'], 'image.bmp'); await guardar('__g3', [300, 200], ['tres'], 'relatorio.png');
    await c.eval('window.__colar(null, [window.__g1, window.__g2])');
    await c.eval('window.__espera(() => Anexos.pendentes().length >= 1 && Anexos.pendentes().every(a => !a.preparando))'); await L.sleep(300);
    const dup = (await estado()).chips; await limpar();
    await c.eval('window.__colar(null, [window.__g1, window.__g3])');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 2 && Anexos.pendentes().every(a => !a.preparando))'); await L.sleep(300);
    const dois = (await estado()).chips; await limpar();
    ok('A2b o mesmo print colado em dois formatos (image.png + image.bmp) vira UM anexo; dois arquivos diferentes viram dois', dup === 1 && dois === 2, JSON.stringify({ dup, dois }));
    e1 = await estado();
    ok('A3 o ✕ remove o anexo, a bandeja some e o texto de ajuda volta ao normal', e1.chips === 0 && !e1.ligada && /Digite sua d/.test(e1.ph), JSON.stringify(e1));
    await guardar('__f2', [400, 300]);
    const preventTxt = await c.eval('window.__colar(null, [window.__f2], "texto copiado de uma planilha")');
    await L.sleep(500);
    ok('A4 colar TEXTO + figura (planilha/Word) não vira anexo: vale o texto', !preventTxt && (await estado()).chips === 0);
    await c.eval(`(() => { const t = document.createElement('textarea'); t.id = '__ta'; document.body.appendChild(t); t.focus(); return true })()`);
    const prevOutro = await c.eval('window.__colar(document.getElementById("__ta"), [window.__f2])');
    await L.sleep(500);
    ok('A5 colar uma imagem em OUTRO campo de texto (ferramentas em abas) não é capturado', !prevOutro && (await estado()).chips === 0);
    await c.eval('document.getElementById("__ta").remove(); 0');
    await c.eval('window.__wsOrig = Workspace.isVisible; Workspace.isVisible = id => id !== "chat"; 0');
    const prevAba = await c.eval('window.__colar(null, [window.__f2])'); await L.sleep(400);
    await c.eval('Workspace.isVisible = window.__wsOrig; 0');
    ok('A6 com o Chat fora da tela (outra aba aberta) colar não anexa', !prevAba && (await estado()).chips === 0);

    // vários, limite, não-imagem, enorme
    for (let i = 0; i < 5; i++) { await guardar('__f' + i, [300 + i * 20, 200], ['imagem ' + i]); }
    await c.eval('Anexos.adicionar([window.__f0, window.__f1, window.__f2]); 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 3 && Anexos.pendentes().every(a => !a.preparando))');
    await c.eval('Anexos.adicionar([window.__f3, window.__f4]); 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 4 && Anexos.pendentes().every(a => !a.preparando))'); await L.sleep(300);
    e1 = await estado();
    const avisoMax = await c.eval(`[...document.querySelectorAll('#toasts .toast .t-tx')].map(t => t.textContent).join(' | ')`);
    ok('A7 no máximo 4 imagens por mensagem: a 5ª fica de fora e o sistema avisa', e1.chips === 4 && /m[aá]ximo 4|4 imagens/i.test(avisoMax), JSON.stringify({ chips: e1.chips, aviso: avisoMax.slice(0, 160) }));
    await limpar();
    await c.eval(`document.getElementById('toasts').innerHTML = ''; Anexos.adicionar([new File(['texto'], 'nota.txt', { type: 'text/plain' }), new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })]); 0`); await L.sleep(400);
    ok('A8 arquivo que não é imagem (txt, pdf) não vira anexo e o sistema avisa', (await estado()).chips === 0 && /imagens/i.test(await c.eval(`[...document.querySelectorAll('#toasts .toast .t-tx')].map(t => t.textContent).join(' | ')`)));
    await c.eval(`document.getElementById('toasts').innerHTML = ''; Anexos.adicionar([new File([new Uint8Array(26 * 1024 * 1024)], 'enorme.png', { type: 'image/png' })]); 0`); await L.sleep(500);
    ok('A8b arquivo de imagem com mais de 25 MB é recusado com aviso (sem tentar abrir)', (await estado()).chips === 0 && /25 MB/.test(await c.eval(`[...document.querySelectorAll('#toasts .toast .t-tx')].map(t => t.textContent).join(' | ')`)));
    await guardar('__grande', [3600, 2400], ['imagem grande'], 'grande.png', true);
    await c.eval('Anexos.adicionar([window.__grande]); 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1 && !Anexos.pendentes()[0].preparando, 20000)');
    const g = await c.eval(`(() => { const a = Anexos.pendentes()[0]; return a ? { w: a.w, h: a.h, bytes: a.bytes, base64: a.dataUrl.length, orig: window.__grande.size } : null })()`);
    ok('A9 imagem enorme (3600×2400, tela cheia de detalhes) é reduzida (maior lado ≤ 2200) e comprimida (≤ ~1,4 MB) antes de ir para a IA', g && Math.max(g.w, g.h) <= 2200 && g.bytes <= 1.5 * 1024 * 1024 && /^data:image\/jpeg;base64,/.test(await c.eval('Anexos.pendentes()[0].dataUrl.slice(0, 30)')), JSON.stringify(g));
    await limpar();

    // arrastar e soltar / botão de escolher arquivo
    await guardar('__f0', [500, 300], ['arrastada'], 'arrastada.png');
    const sol = await c.eval('window.__soltar(document.getElementById("chatStream"), [window.__f0])');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1)');
    ok('A10 arrastar uma imagem para a conversa anexa (e o navegador não abre a imagem em outra tela)', sol && (await estado()).chips === 1 && !(await c.eval('document.body.classList.contains("anx-arrastando")')));
    await limpar();
    await c.eval(`(() => { const t = document.createElement('textarea'); t.id = '__ta'; document.body.appendChild(t); return true })()`);
    const solOutro = await c.eval('window.__soltar(document.getElementById("__ta"), [window.__f0])'); await L.sleep(300);
    await c.eval('document.getElementById("__ta").remove(); 0');
    ok('A11 soltar fora da conversa (num campo de outra ferramenta) não anexa', !solOutro && (await estado()).chips === 0);
    await c.eval(`(() => { const i = document.getElementById('fileInput'); const dt = new DataTransfer(); dt.items.add(window.__f0); i.files = dt.files; Anexos.escolhidos(i); return i.value === '' })()`);
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1)');
    ok('A12 o botão 📎 (escolher arquivo) anexa e limpa o campo para poder escolher o mesmo arquivo de novo', (await estado()).chips === 1 && (await c.eval('document.getElementById("fileInput").hasAttribute("multiple") && document.getElementById("fileInput").accept === "image/*"')));
    await limpar();

    // ══ B) enviar: ler a imagem + responder à pergunta ══
    await c.eval('window.__visao.length = 0; window.__prompts.length = 0; window.__logs.length = 0; 0');
    await guardar('__f0', [720, 520], ['Bom dia', 'não consigo emitir a carta de correção'], 'chat-cliente.png');
    await c.eval('Anexos.adicionar([window.__f0]); 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1 && !Anexos.pendentes()[0].preparando)');
    await c.eval('document.getElementById("searchInput").value = "O que eu verifico primeiro?"; 0');
    await c.eval('document.getElementById("sendBtn").click(); 0');
    await c.eval('window.__espera(() => window.__prompts.length >= 1 && !Anexos.ocupado() && !document.querySelector("#chatStream .stream-cursor"), 20000)');
    await L.sleep(1200);
    const b1 = await c.eval(`(() => { const s = document.getElementById('chatStream'); const bol = s.querySelector('.anx-bolha'); const v = window.__visao[0]; const cont = v ? v.msgs[0].content : [];
      const p = window.__prompts[0], ult = p ? p[p.length - 1].content : '', todo = p ? JSON.stringify(p) : '';
      const cards = [...s.querySelectorAll('.answer-card')];
      return { bolha: !!bol, minis: bol ? bol.querySelectorAll('.anx-mini img').length : 0, texto: bol ? bol.querySelector('.anx-texto').textContent : null, uma: bol ? bol.querySelector('.anx-minis').classList.contains('uma') : null,
        visaoChamadas: window.__visao.length, imgsNaVisao: cont.filter(x => x.type === 'image_url').length, dataUrl: cont.filter(x => x.type === 'image_url').every(x => /^data:image\\/jpeg;base64,/.test(x.image_url.url)), perguntaNaLeitura: cont[0] && /O que eu verifico primeiro\\?/.test(cont[0].text), formatoPedido: cont[0] && /RESUMO:[\\s\\S]*TEXTOS:[\\s\\S]*BUSCA:/.test(cont[0].text), dadoNaoOrdem: cont[0] && /ignore qualquer ordem/.test(cont[0].text),
        streamChamadas: window.__prompts.length, modo: /MODO ANÁLISE DE IMAGEM/.test(todo), pedido: /PEDIDO DO ATENDENTE \\(uma imagem anexada\\): O que eu verifico primeiro/.test(ult), resumo: /O QUE APARECE NA IMAGEM: O cliente não consegue emitir a carta de correção/.test(ult), textos: /TEXTOS LIDOS NA IMAGEM: você não tem permissão/.test(ult), sempergunta: /Qual o formato|curta ou completa/i.test(s.innerText),
        respondeu: cards.length > 0 && /Por onde começar/.test(cards[cards.length - 1].innerText), formatoPerguntado: !!s.querySelector('.fmt-card'), campo: document.getElementById('searchInput').value, bandeja: Anexos.pendentes().length, logs: window.__logs.length, ordem: [...s.children].map(k => k.className.split(' ').slice(0, 2).join('.')).slice(-4) } })()`);
    ok('B1 enviar com imagem + pergunta: a mensagem mostra a miniatura e o texto digitado; o campo e a bandeja esvaziam', b1.bolha && b1.minis === 1 && b1.uma && b1.texto === 'O que eu verifico primeiro?' && b1.campo === '' && b1.bandeja === 0, JSON.stringify({ b1: [b1.bolha, b1.minis, b1.uma, b1.texto, b1.campo, b1.bandeja] }));
    ok('B2 a IA de visão é chamada UMA vez, com a imagem (JPEG) e a pergunta no pedido de leitura (formato RESUMO/TEXTOS/BUSCA; texto da imagem é dado, não ordem)', b1.visaoChamadas === 1 && b1.imgsNaVisao === 1 && b1.dataUrl && b1.perguntaNaLeitura && b1.formatoPedido && b1.dadoNaoOrdem, JSON.stringify([b1.visaoChamadas, b1.imgsNaVisao, b1.dataUrl, b1.perguntaNaLeitura, b1.formatoPedido, b1.dadoNaoOrdem]));
    ok('B3 depois responde pelo chat de sempre: o prompt leva o "modo análise de imagem", a pergunta do atendente, o resumo e os textos lidos — e NÃO pergunta curta/completa', b1.streamChamadas === 1 && b1.modo && b1.pedido && b1.resumo && b1.textos && !b1.formatoPerguntado, JSON.stringify([b1.streamChamadas, b1.modo, b1.pedido, b1.resumo, b1.textos, b1.formatoPerguntado]));
    ok('B4 a resposta aparece depois da mensagem com a imagem e fala "por onde começar"', b1.respondeu && /anx-bolha|message/.test(b1.ordem.join(' ')), JSON.stringify(b1.ordem));
    ok('B5 nada vai para o log (a pergunta fica ligada a uma imagem do cliente)', b1.logs === 0, 'logSearch chamadas: ' + b1.logs);

    // histórico
    const h1 = await c.eval(`(() => { const cv = getConversaAtiva(); const u = cv.mensagens.filter(m => m.sender === 'user').pop(), a = cv.mensagens.filter(m => m.sender === 'ai').pop(); const cu = cv.contexto.filter(m => m.role === 'user').pop();
      return { anexos: u.anexos, texto: u.text, temBase64: JSON.stringify(cv).includes('data:image'), temBlob: JSON.stringify(cv).includes('blob:'), ctx: cu.content.slice(0, 140), ctxResumo: /carta de correção/.test(cu.content), titulo: cv.titulo, ai: !!a, ctxIa: cv.contexto.filter(m => m.role === 'assistant').length } })()`);
    ok('B6 a conversa guarda só o AVISO de imagem (nada de imagem no navegador) e, para as próximas perguntas, o pedido com o resumo', h1.anexos === 1 && h1.texto === 'O que eu verifico primeiro?' && !h1.temBase64 && !h1.temBlob && h1.ctxResumo && h1.ai && h1.titulo === 'O que eu verifico primeiro?', JSON.stringify(h1));
    await c.eval('restaurarConversa(conversaAtivaId); 0'); await L.sleep(400);
    const rest = await c.eval(`(() => { const u = document.querySelector('#chatStream .user-msg'); return u ? { aviso: (u.querySelector('.anx-restaurado') || {}).textContent, texto: u.innerText } : null })()`);
    ok('B7 ao reabrir a conversa aparece "📎 1 imagem anexada · não ficam guardadas" no lugar das miniaturas', rest && /1 imagem anexada/.test(rest.aviso || '') && /verifico primeiro/.test(rest.texto), JSON.stringify(rest));

    // sem pergunta, vários anexos, texto que não segue o formato
    await c.eval('window.__visao.length = 0; window.__prompts.length = 0; window.__leitura = "O print mostra uma tela de erro: rejeição 539 ao autorizar o CT-e, duplicidade de documento."; 0');
    await guardar('__f1', [500, 400], ['a'], 'p1.png'); await guardar('__f2', [500, 400], ['b'], 'p2.png'); await guardar('__f3', [500, 400], ['c'], 'p3.png');
    await c.eval('Anexos.adicionar([window.__f1, window.__f2, window.__f3]); 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 3 && Anexos.pendentes().every(a => !a.preparando))');
    await c.eval('document.getElementById("searchInput").dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", bubbles: true })); 0');
    await c.eval('window.__espera(() => window.__prompts.length >= 1 && !Anexos.ocupado() && !document.querySelector("#chatStream .stream-cursor"), 20000)'); await L.sleep(800);
    const b2 = await c.eval(`(() => { const bol = [...document.querySelectorAll('#chatStream .anx-bolha')].pop(); const v = window.__visao[0], cont = v ? v.msgs[0].content : [], ult = window.__prompts[0] ? window.__prompts[0][window.__prompts[0].length - 1].content : '';
      return { minis: bol.querySelectorAll('.anx-mini').length, uma: bol.querySelector('.anx-minis').classList.contains('uma'), texto: bol.querySelector('.anx-texto').textContent, vazio: bol.querySelector('.anx-texto').classList.contains('vazio'), imgs: cont.filter(x => x.type === 'image_url').length, tresNoPrompt: /3 imagens anexadas/.test(ult) && /NAS IMAGENS|NA IMAGEM|IMAGENS/.test(ult), padrao: /por onde começar a verificar/.test(ult), livre: /rejeição 539/.test(ult), titulo: getConversaAtiva().titulo } })()`);
    ok('B8 só imagens (3), sem texto, enviado com Enter: três miniaturas, pergunta padrão ("por onde começar") e leitura em texto livre vale como resumo', b2.minis === 3 && !b2.uma && b2.vazio && b2.imgs === 3 && b2.tresNoPrompt && b2.padrao && b2.livre, JSON.stringify(b2));

    // falha na leitura: cartão com "Tentar novamente"
    await c.eval('window.__visao.length = 0; window.__prompts.length = 0; window.__falhaVisao = 1; window.__leitura = "RESUMO: tela de login do sistema\\nTEXTOS: nenhum\\nBUSCA: login"; 0');
    await guardar('__f0', [400, 300], ['falha'], 'f.png'); await c.eval('Anexos.adicionar([window.__f0]); document.getElementById("searchInput").value = "e agora?"; 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1 && !Anexos.pendentes()[0].preparando)');
    await c.eval('document.getElementById("sendBtn").click(); 0');
    await c.eval('window.__espera(() => document.querySelector("#chatStream .anx-erro button"), 15000)');
    const f1 = await c.eval(`(() => { const b = document.querySelector('#chatStream .anx-erro button'); return { cartao: !!b, texto: b ? b.parentElement.innerText : '', pergunta: window.__prompts.length, ocupado: Anexos.ocupado() } })()`);
    ok('B9 se a IA de visão falha: aparece o aviso com "🔄 Tentar novamente" e o envio fica livre (a mensagem do usuário não se repete)', f1.cartao && /Tentar novamente/.test(f1.texto) && f1.pergunta === 0 && !f1.ocupado, JSON.stringify(f1));
    await c.eval('document.querySelector("#chatStream .anx-erro button").click(); 0');
    await c.eval('window.__espera(() => window.__prompts.length >= 1 && !Anexos.ocupado() && !document.querySelector("#chatStream .stream-cursor"), 20000)'); await L.sleep(800);
    const f2 = await c.eval(`(() => ({ erroSumiu: !document.querySelector('#chatStream .anx-erro'), respondeu: window.__prompts.length === 1, bolhas: [...document.querySelectorAll('#chatStream .anx-bolha')].filter(b => b.querySelector('.anx-texto').textContent === 'e agora?').length, visao: window.__visao.length }))()`);
    ok('B10 "Tentar novamente" lê a MESMA imagem de novo e responde, sem duplicar a mensagem', f2.erroSumiu && f2.respondeu && f2.bolhas === 1 && f2.visao === 2, JSON.stringify(f2));

    // segurança: texto lido da imagem (do cliente) não pode quebrar os atributos onclick do chat nem injetar nada
    const maligno = "RESUMO: cliente escreveu: '); window.__pwned = 1; // e \"><img src=x onerror=\"window.__pwned=2\"> e &#39;);window.__pwned=3;//\nsegunda linha \\ final\nTEXTOS: x');window.__pwned=4;//\"><svg onload=window.__pwned=5>\nBUSCA: normal";
    const perguntaMa = 'pergunta " com \' aspas <b>html</b> & \\';
    await c.eval('window.__visao.length = 0; window.__prompts.length = 0; window.__pwned = undefined; window.__leitura = ' + JSON.stringify(maligno) + '; 0');
    await guardar('__f0', [400, 300], ['seg'], 's.png');
    await c.eval('Anexos.adicionar([window.__f0]); document.getElementById("searchInput").value = ' + JSON.stringify(perguntaMa) + '; 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1 && !Anexos.pendentes()[0].preparando)');
    await c.eval('document.getElementById("sendBtn").click(); 0');
    await c.eval('window.__espera(() => window.__prompts.length >= 1 && !Anexos.ocupado() && !document.querySelector("#chatStream .stream-cursor"), 20000)'); await L.sleep(1000);
    const s1 = await c.eval(`(() => { const ult = window.__prompts[0] ? window.__prompts[0][window.__prompts[0].length - 1].content : ''; const q = (ult.match(/PERGUNTA: "([^"]*)"/) || [])[1] || '';
      const card = [...document.querySelectorAll('#chatStream .answer-card')].pop(); const attrs = card ? [...card.querySelectorAll('[onclick]')].map(b => b.getAttribute('onclick')) : [];
      // atributos que SÓ uma injeção criaria (os botões do chat têm onclick/onmouseover/onmouseout legítimos): onerror, onload, onfocus, ontoggle, autofocus
      const estranhos = card ? [...card.querySelectorAll('*')].filter(n => [...n.attributes].some(a => /^on(error|load|focus|toggle|animation|pointer)/i.test(a.name) || a.name === 'autofocus')).length : -1;
      // cada onclick continua sendo JavaScript VÁLIDO (se o texto tivesse fechado a aspa do texto, daria erro de sintaxe ou criaria comandos novos)
      const validos = attrs.map(a => { try { new Function(a); return true; } catch (e) { return false; } });
      return { pwned: window.__pwned, completo: q.includes('TEXTOS LIDOS NA IMAGEM'), perigoso: /[&<>"'\\\\\`]/.test(q.replace(/^PEDIDO DO ATENDENTE \\(uma imagem anexada\\): /, '')), umaLinha: !/[\\r\\n]/.test(q), tamanho: q.length,
        onclicksValidos: validos.every(Boolean), nAttrs: attrs.length, estranhos, imgsEstranhas: document.querySelectorAll('#chatStream img[onerror], #chatStream svg[onload]').length, amostra: q.slice(0, 260) } })()`);
    ok('B11 texto malicioso dentro da imagem (aspas, </>, &#39;, barras, quebras) NÃO quebra os botões do chat nem executa nada: a pergunta chega inteira, limpa e numa linha só; todo onclick continua JavaScript válido', s1.pwned === undefined && s1.completo && !s1.perigoso && s1.umaLinha && s1.tamanho > 60 && s1.onclicksValidos && s1.nAttrs > 3 && s1.estranhos === 0 && s1.imgsEstranhas === 0, JSON.stringify(s1));
    // controle do teste: o MESMO texto, sem a limpeza (como era o caminho antes), montado do jeito que o chat monta o atributo, QUEBRA — prova que a limpeza é o que protege
    const ctl = await c.eval(`(() => { const bruto = ${JSON.stringify(maligno.replace(/^RESUMO: /, ''))}; const h = '<div id="__ctl"><button onclick="Workspace.open(\\'blog\\');x.value=\\'' + bruto.replace(/'/g, "\\\\'") + '\\';y();">b</button></div>'; const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d); window.__pwned = undefined;
      const botoes = d.querySelectorAll('button'), extras = d.querySelectorAll('img, svg'); const attrsEstr = [...d.querySelectorAll('*')].filter(n => [...n.attributes].some(a => /^on(error|load)/i.test(a.name))).length; d.remove(); return { extras: extras.length, attrsEstr } })()`);
    ok('B11b (controle do teste) sem a limpeza, o mesmo texto fecha o atributo e cria elementos com onerror/onload', ctl.extras > 0 && ctl.attrsEstr > 0, JSON.stringify(ctl));

    // atalhos e fluxo normal não são afetados
    await c.eval('window.__visao.length = 0; window.__prompts.length = 0; 0');
    await guardar('__f0', [400, 300], ['pendente'], 'p.png'); await c.eval('Anexos.adicionar([window.__f0]); 0');
    await c.eval('window.__espera(() => Anexos.pendentes().length === 1 && !Anexos.pendentes()[0].preparando)');
    await c.eval('fillAndSend("Como emitir um Ct-e complementar?"); 0'); await L.sleep(1200);
    const n1 = await c.eval(`({ visao: window.__visao.length, pend: Anexos.pendentes().length, bolhaImg: document.querySelectorAll('#chatStream .anx-bolha').length })`);
    ok('B12 atalho do chat (fillAndSend, "Em alta") com imagem pendente NÃO leva a imagem: o anexo continua esperando no campo', n1.visao === 0 && n1.pend === 1, JSON.stringify(n1));
    await limpar(); await c.eval('window.__visao.length = 0; window.__prompts.length = 0; 0');
    await c.eval('document.getElementById("searchInput").value = "pergunta normal sem imagem"; document.getElementById("sendBtn").click(); 0'); await L.sleep(2500);
    ok('B13 sem imagem anexada o envio é o de sempre (a IA de visão nem é chamada)', (await c.eval('window.__visao.length')) === 0);

    // nova conversa libera as miniaturas da memória
    const antes = await c.eval('Anexos._lotes.size');
    await c.eval('novaConversa(); 0'); await L.sleep(300);
    ok('B14 ao abrir uma nova conversa as imagens enviadas saem da memória', antes > 0 && (await c.eval('Anexos._lotes.size')) === 0, 'antes=' + antes);
    // ══ C) leitura do que o modelo devolve (funções puras) ══
    const pu = await c.eval(`(() => { const I = Anexos.interpretarLeitura;
      const a = I('**RESUMO:** cliente sem permissão\\n**TEXTOS:** erro um\\n- erro dois\\n**BUSCA:** permissão carta'), b = I('RESUMO: x\\nTEXTOS: nenhum\\nBUSCA: y'), d = I('BUSCA: termos\\nRESUMO: depois\\nTEXTOS: t1'), e = I('resumo : minúsculo\\ntextos : t\\nbusca : b'), f = I('só um texto solto, sem o formato'), g = I('RESUMO:\\n- linha 1\\n- linha 2\\n\\nTEXTOS:\\n"aspas" e <tags>\\nBUSCA: z');
      const sg = Anexos.seguro('a"b\\'c\`d<e>f&g\\\\h\\ni\\tj\\u0000k');
      const pedido = Anexos.montarPedido({ imgs: [{}, {}], pergunta: '' }, { resumo: 'r', textos: 't1 | t2', busca: 'b' }), longo = Anexos.montarPedido({ imgs: [{}], pergunta: 'p'.repeat(6000) }, { resumo: 'r'.repeat(6000), textos: '', busca: '' });
      return { a, b, d, e, f, g, sg, pedido, longoTam: longo.length, pedidoUmaLinha: !/[\\r\\n]/.test(pedido) } })()`);
    ok('C1 leitura com negrito/lista/ordem diferente/minúsculas/sem formato: RESUMO, TEXTOS e BUSCA saem certos (e "nenhum" vira vazio)', pu.a.resumo === 'cliente sem permissão' && pu.a.textos === 'erro um | erro dois' && pu.a.busca === 'permissão carta' && pu.b.textos === '' && pu.b.busca === 'y' && pu.d.resumo === 'depois' && pu.d.textos === 't1' && pu.d.busca === 'termos' && pu.e.resumo === 'minúsculo' && pu.e.busca === 'b' && pu.f.resumo === 'só um texto solto, sem o formato' && pu.g.resumo === 'linha 1 · linha 2' && /aspas/.test(pu.g.textos), JSON.stringify([pu.a, pu.b, pu.d, pu.e, pu.f, pu.g]).slice(0, 420));
    ok('C2 seguro() tira aspas, crase, <, >, &, barra, tabulação, quebra e caractere de controle', !/[&<>"'`\\\r\n\t\u0000]/.test(pu.sg) && /^a b c d e f g h i j k$/.test(pu.sg), JSON.stringify(pu.sg));
    ok('C3 o pedido que vai ao chat é de UMA linha, cita "2 imagens anexadas", usa a pergunta padrão quando não há texto e nunca passa de 4200 caracteres', pu.pedidoUmaLinha && /2 imagens anexadas/.test(pu.pedido) && /por onde começar/.test(pu.pedido) && /TEXTOS LIDOS NA IMAGEM: t1 \| t2/.test(pu.pedido) && pu.longoTam <= 4200, JSON.stringify({ pedido: pu.pedido.slice(0, 200), longo: pu.longoTam }));
    ok('Z1 nenhum erro de JavaScript durante os testes', erros.length === 0, erros.join(' | ').slice(0, 300));
    console.log('\n' + (res.every(Boolean) ? 'TODOS OS ' + res.length + ' TESTES PASSARAM' : res.filter(x => !x).length + ' FALHA(S)'));
    c.fechar(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
