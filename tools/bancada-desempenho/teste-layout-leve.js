'use strict';
// Layout leve (v28.43) — teste no Edge (CDP), sem IA e sem gravar nada (?sim=1).
//   A) PRONTIDÃO: o campo de digitação aceita letras desde o 1º quadro, só o ➤ espera; Enter/atalho antes da hora só avisa; tudo libera sozinho (a rede da base é SEGURADA de propósito).
//   B) SEM EFEITO PESADO: nenhum backdrop-filter / filter / mix-blend-mode / will-change, nenhuma animação rodando parado, nada de aurora nem anel.
//   C) NO MESMO LUGAR: lateral à esquerda, conversas, cabeçalho no topo, abas, campo de digitação embaixo no centro; painéis colados, sem margem.
//   D) AINDA FUNCIONA: Ctrl K, Personalizar (sem as opções de fundo/vidro; cor de destaque vale), cada aba de ferramenta, aviso (toast), gaveta de conversas no celular.
//   E) COMPATIBILIDADE: preferências antigas (bg/efeitos/perfAuto) e o ajuste automático antigo guardado no navegador não quebram nada.
//   F) OUTRAS PÁGINAS (FAQ, primeira emissão, simulador, painel administrativo): abrem sem erro e sem efeito pesado.
//   G) TABELAS GRANDES EM PÁGINAS PARALELAS (js/app/dados.js › _paginarTabela): Rotinas (~3.800 linhas) vem em fila na 1ª abertura e TODAS as páginas juntas nas seguintes — com os MESMOS dados; tabela que cresceu/encolheu não perde nem repete linha.
// Uso: Code.exe teste-layout-leve.js [--capturas=PASTA] [--url=http://localhost:8080] [--porta=9573] [--so=A,B,M,E,G,F] [--verbose]   (B = página pronta: efeitos, lugares e telas)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : (process.argv.includes('--' + n) ? true : d); };
const BASE = String(arg('url', 'http://localhost:8080')).replace(/\/$/, ''), PORTA = +arg('porta', 9573), CAP = arg('capturas', null), SO = arg('so', null), VERBOSE = !!arg('verbose', false);
const URL_APP = BASE + '/index.html?sim=1';
let n = 0, falhas = 0; const erros = [];
const ok = (nome, cond, det) => { n++; if (!cond) { falhas++; console.log('  ✘ ' + nome + (det !== undefined ? '  → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); } else if (VERBOSE) console.log('  ✔ ' + nome); };
const quer = s => !SO || String(SO).split(',').includes(s);
const sleep = L.sleep;

const PRONTO = "(function(){ try { return typeof Pronto !== 'undefined' && Pronto.pronto() && typeof isVectorizing !== 'undefined' && !isVectorizing && bancoCompletoRaw.length > 100; } catch (e) { return false; } })()";
const EFEITOS = `(function(){ var r = { backdrop: [], filtro: [], mistura: [], willChange: [], infinitas: [] };
  var nm = function(e){ return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/)[0] : ''); };
  document.querySelectorAll('body *').forEach(function(e){ var c = getComputedStyle(e); if (c.display === 'none') return;
    if (c.backdropFilter && c.backdropFilter !== 'none') r.backdrop.push(nm(e));
    if (c.filter && c.filter !== 'none') r.filtro.push(nm(e));
    if (c.mixBlendMode && c.mixBlendMode !== 'normal') r.mistura.push(nm(e));
    if (c.willChange && c.willChange !== 'auto') r.willChange.push(nm(e));
    if (c.animationName && c.animationName !== 'none' && /infinite/.test(c.animationIterationCount)) r.infinitas.push(nm(e) + ':' + c.animationName); });
  r.rodando = document.getAnimations().filter(function(a){ return a.playState === 'running'; }).map(function(a){ return (a.animationName || a.transitionProperty || '?'); });
  return r; })()`;

async function nova(opcoes) {
    const c = await L.abrirPagina(PORTA);
    c.erros = [];
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Log.enable').catch(() => {});
    c.on('Runtime.exceptionThrown', p => c.erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).split('\n')[0]));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') c.erros.push('console.error: ' + (p.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 220)); });
    await c.send('Emulation.setDeviceMetricsOverride', { width: (opcoes && opcoes.w) || 1536, height: (opcoes && opcoes.h) || 730, deviceScaleFactor: 1, mobile: !!(opcoes && opcoes.mobile) });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    return c;
}
async function ir(c, url, ate) {
    await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true });
    await c.send('Page.navigate', { url });
    if (ate) for (let i = 0; i < 240; i++) { try { if (await c.eval(ate)) return true; } catch (e) { /* carregando */ } await sleep(250); }
    return false;
}
async function digitar(c, texto) { for (const ch of texto) { const up = ch.toUpperCase(); await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: ch === ' ' ? 32 : up.charCodeAt(0) }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: ch === ' ' ? 'Space' : 'Key' + up, windowsVirtualKeyCode: ch === ' ' ? 32 : up.charCodeAt(0) }); } }
async function enter(c) { await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); }
async function foto(c, nome) { if (!CAP) return; fs.mkdirSync(CAP, { recursive: true }); const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(CAP, nome + '.png'), Buffer.from(r.data, 'base64')); }

// ─── A) PRONTIDÃO ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function testeProntidao() {
    console.log('A) Prontidão — campo livre desde o início, só o ➤ espera');
    const c = await nova();
    const seguradas = [];
    c.on('Fetch.requestPaused', p => { seguradas.push(p.requestId); });
    await c.send('Fetch.enable', { patterns: [{ urlPattern: '*/rest/v1/*', requestStage: 'Request' }] });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__t0 = performance.now(); window.__ev = []; new MutationObserver(function(){ var i = document.getElementById('searchInput'); if (i && !window.__campoVisto) { window.__campoVisto = true; window.__campoLivreAoNascer = !i.disabled; } }).observe(document, { childList: true, subtree: true });" });
    const subiu = await ir(c, URL_APP, "typeof Pronto !== 'undefined' && !!document.getElementById('searchInput') && typeof handleChat === 'function' && document.readyState !== 'loading'");
    ok('A0 a página subiu', subiu);
    if (!subiu) { c.fechar(); return; }
    await sleep(1500);
    ok('A1 o campo NASCE liberado (sem `disabled` quando o elemento apareceu)', await c.eval('window.__campoLivreAoNascer === true'));
    ok('A2 a base ainda está carregando (rede da base segurada)', !(await c.eval(PRONTO)) && seguradas.length > 0, seguradas.length);
    ok('A3 o campo aceita digitar enquanto carrega', await c.eval("!document.getElementById('searchInput').disabled"));
    await c.eval("document.getElementById('searchInput').focus(); 0");
    await digitar(c, 'ct-e rejeicao 539');
    ok('A4 as letras digitadas aparecem no campo', (await c.eval("document.getElementById('searchInput').value")) === 'ct-e rejeicao 539', await c.eval("document.getElementById('searchInput').value"));
    ok('A5 o botão ➤ está travado e diz por quê', await c.eval("(function(){ var b = document.getElementById('sendBtn'); return b.disabled && /aguarde/i.test(b.title); })()"));
    const aviso = await c.eval("(function(){ var s = document.getElementById('composerStatus'); return { vis: getComputedStyle(s).display !== 'none', tx: s.textContent }; })()");
    ok('A6 o aviso acima do campo está visível e diz que já dá para digitar', aviso.vis && /já pode digitar/i.test(aviso.tx), aviso);
    ok('A7 o selo do cabeçalho mostra o andamento', /carregando|baixando|vetoriz/i.test(await c.eval("document.getElementById('statusBadge').textContent")), await c.eval("document.getElementById('statusBadge').textContent"));
    await c.eval("window.__chamadas = []; var o = window.handleChat; window.handleChat = function () { window.__chamadas.push(arguments.length); return Promise.resolve(); }; window.__orig = o; 0");
    await enter(c); await sleep(200);
    ok('A8 Enter ANTES da hora não envia (handleChat não é chamado)', (await c.eval('window.__chamadas.length')) === 0, await c.eval('window.__chamadas.length'));
    ok('A9 …e destaca o aviso por um instante (is-aviso)', await c.eval("document.getElementById('composerStatus').classList.contains('is-aviso')"));
    ok('A10 …e o texto continua no campo', (await c.eval("document.getElementById('searchInput').value")) === 'ct-e rejeicao 539');
    await c.eval("window.handleChat = window.__orig; 0");
    // atalho "Em alta"/menu: fillAndSend → handleChat de verdade → isVectorizing = true → só avisa
    await c.eval("document.getElementById('composerStatus').classList.remove('is-aviso'); document.getElementById('searchInput').value = ''; fillAndSend('MDF-e Encerrado'); 0"); await sleep(200);
    ok('A11 atalho antes da hora: o texto vai para o campo, nada é enviado e o aviso destaca', await c.eval("(function(){ return document.getElementById('searchInput').value === 'MDF-e Encerrado' && !document.querySelector('#chatStream .user-msg') && document.getElementById('composerStatus').classList.contains('is-aviso'); })()"));
    await foto(c, '01-carregando');
    // libera a rede: a base termina de carregar
    await c.send('Fetch.disable').catch(() => {});
    for (const id of seguradas) { try { await c.send('Fetch.continueRequest', { requestId: id }); } catch (e) { /* já seguiu */ } }
    let pronto = false; for (let i = 0; i < 160 && !pronto; i++) { await sleep(250); pronto = await c.eval(PRONTO).catch(() => false); }
    ok('A12 a base ficou pronta sozinha', pronto);
    if (pronto) {
        ok('A13 o ➤ liberou e o aviso sumiu', await c.eval("(function(){ var b = document.getElementById('sendBtn'); return !b.disabled && getComputedStyle(document.getElementById('composerStatus')).display === 'none'; })()"));
        ok('A14 o que foi digitado continua no campo', (await c.eval("document.getElementById('searchInput').value")) === 'MDF-e Encerrado');
        ok('A15 o selo do cabeçalho virou "IA Pronta"', /IA Pronta/i.test(await c.eval("document.getElementById('statusBadge').textContent")));
        await c.eval("window.__chamadas = []; window.handleChat = function (o) { window.__chamadas.push(o && o.deComposer ? 'composer' : 'outro'); return Promise.resolve(); }; document.getElementById('searchInput').focus(); 0");
        await enter(c); await sleep(200);
        ok('A16 depois de pronto o Enter envia (handleChat com deComposer)', JSON.stringify(await c.eval('window.__chamadas')) === '["composer"]', await c.eval('window.__chamadas'));
        await c.eval("window.handleChat = window.__orig; 0");
        ok('A17 sem erro de JavaScript durante a carga', c.erros.length === 0, c.erros);
    }
    c.fechar();
}

// ─── B + C + D) página pronta ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function testePagina() {
    console.log('B/C/D) Sem efeito pesado · no mesmo lugar · ainda funciona');
    const c = await nova();
    const pronto = await ir(c, URL_APP, PRONTO);
    ok('B0 a página ficou pronta', pronto);
    if (!pronto) { c.fechar(); return; }
    await sleep(1800); await c.eval("document.getElementById('searchInput').focus(); 0"); await sleep(600);
    // B) efeitos
    const ef = await c.eval(EFEITOS);
    ok('B1 nenhum backdrop-filter (vidro)', ef.backdrop.length === 0, ef.backdrop);
    ok('B2 nenhum filter (blur/brightness/drop-shadow)', ef.filtro.length === 0, ef.filtro);
    ok('B3 nenhum mix-blend-mode', ef.mistura.length === 0, ef.mistura);
    ok('B4 nenhum will-change', ef.willChange.length === 0, ef.willChange);
    ok('B5 nenhuma animação infinita nos elementos visíveis (parado, com o campo em foco)', ef.infinitas.length === 0, ef.infinitas);
    // (o aviso de boas-vindas/novidades — toast — é passageiro e o único que pode estar na tela: o contador da barrinha dele é uma animação curta por transform; não conta)
    ok('B6 nenhuma animação rodando (parado, com o campo em foco)', ef.rodando.filter(x => !/^toast/i.test(x)).length === 0, ef.rodando);
    ok('B7 não existe mais fundo aurora, anel do campo, nem o ajuste automático (Perf/Aurora)', await c.eval("!document.querySelector('.bg-aurora') && !document.querySelector('.ia-ring') && typeof Perf === 'undefined' && typeof Aurora === 'undefined' && !document.documentElement.dataset.perf && !document.documentElement.dataset.bg && !document.documentElement.dataset.efeitos"));
    ok('B8 os painéis não têm sombra grande (sidebar, conversa, lateral)', await c.eval("['.sidebar', '.main-container', '.rail'].every(function(s){ var e = document.querySelector(s); return e && (getComputedStyle(e).boxShadow === 'none' || /0px 0px 0px 0px/.test(getComputedStyle(e).boxShadow)); })"));
    // (só o que está NA TELA: janelas e avisos escondidos — modal, "instalando" — podem ter a sombra de quem flutua)
    const grandes = await c.eval(`(function(){ var r = []; document.querySelectorAll('body *').forEach(function(e){ var c = getComputedStyle(e); if (c.display === 'none' || !c.boxShadow || c.boxShadow === 'none' || e.getClientRects().length === 0) return;
        var m, re = /(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px/g; while ((m = re.exec(c.boxShadow))) { if (+m[3] >= 12) { r.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0] + ' ' + m[0]); break; } } }); return r.slice(0, 8); })()`);
    ok('B9 nenhum elemento visível na tela do chat tem sombra com desfoque grande (≥ 12 px), fora o aviso que flutua (toast)', grandes.filter(x => !/^div\.toast\b/.test(x)).length === 0, grandes);
    // C) lugares
    const g = await c.eval(`(function(){ var r = function(s){ var e = document.querySelector(s); if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { vw: innerWidth, vh: innerHeight, rail: r('.rail'), side: r('#sidebar'), main: r('.main-container'), head: r('header'), tabbar: r('.tabbar'), input: r('.input-area'), banner: r('#simBanner'), chat: r('#chatStream'), brand: r('.brand'), cmd: r('.cmd-trigger'), chips: r('.header-chips'), acoes: r('.header-actions'), bodyPad: getComputedStyle(document.body).padding }; })()`);
    ok('C1 a lateral de atalhos está no canto esquerdo (x=0) e vai até o fim da tela', g.rail && g.rail.x === 0 && g.rail.b >= g.vh - 2, g.rail);
    ok('C2 conversas logo ao lado da lateral, SEM margem (painéis colados)', g.rail && g.side && g.side.x === g.rail.r, { rail: g.rail, side: g.side });
    ok('C3 a área do chat logo ao lado das conversas e até a borda direita', g.side && g.main && g.main.x === g.side.r && g.main.r === g.vw, { side: g.side, main: g.main, vw: g.vw });
    ok('C4 sem margem na página (body sem padding) e a casca preenche a altura', /^0px/.test(g.bodyPad) || g.bodyPad === '40px 0px 0px' || /^40px 0px 0px/.test(g.bodyPad), g.bodyPad);
    ok('C5 cabeçalho no topo da área do chat, com a marca à esquerda, a busca no meio e os botões à direita', g.head && g.brand && g.cmd && g.acoes && g.brand.x < g.cmd.x && g.cmd.x < g.acoes.x && g.head.y <= 44, { head: g.head, brand: g.brand, cmd: g.cmd, acoes: g.acoes });
    ok('C6 barra de abas logo abaixo do cabeçalho', g.head && g.tabbar && Math.abs(g.tabbar.y - g.head.b) <= 1, { head: g.head, tabbar: g.tabbar });
    ok('C7 campo de digitação embaixo, centralizado na área do chat', g.input && g.main && Math.abs((g.input.x + g.input.r) / 2 - (g.main.x + g.main.r) / 2) <= 3 && g.input.b > g.vh - 40, { input: g.input, main: g.main });
    await foto(c, '02-boas-vindas');
    // chat com mensagens (HTML igual ao que o chat monta)
    await c.eval(`(function(){ var s = document.getElementById('chatStream'); var w = document.getElementById('welcomeMsg'); if (w) w.remove();
      var md = "## Como emitir o CT-e\\n\\nPara emitir um **CT-e** siga os passos:\\n\\n1. Acesse **Operacional > Conhecimento de Transporte**.\\n2. Clique em *Novo*.\\n3. Informe o remetente, o destinatário e a mercadoria.\\n\\n| Campo | Valor |\\n|---|---|\\n| CFOP | 6.353 |\\n| ICMS | 12% |\\n\\n- Verifique o parâmetro de ICMS\\n- Confira a tabela de preços";
      var u = document.createElement('div'); u.className = 'message user-msg'; u.textContent = 'Como emitir CT-e com ICMS de outro estado?'; s.appendChild(u);
      var a = document.createElement('div'); a.className = 'message ai-msg'; a.textContent = 'Encontrei o procedimento no banco de dados. Veja abaixo.'; s.appendChild(a);
      var sy = document.createElement('div'); sy.className = 'message system-msg'; sy.textContent = 'Conversa iniciada'; s.appendChild(sy);
      var c = document.createElement('div'); c.className = 'answer-card'; c.innerHTML = '<div class="answer-section"><div class="section-label path"><span class="section-icon path">📍</span>Caminho</div><div class="section-content"><span class="path-breadcrumb">Operacional <span class="sep">›</span> Conhecimento</span></div></div><div class="answer-section"><div class="section-label how"><span class="section-icon how">✅</span>Como fazer</div><div class="section-content">' + (window.renderMd ? renderMd(md) : md) + '</div></div><div class="feedback-area" style="display:flex"><span class="feedback-util">Esta resposta foi útil?</span><button class="feedback-btn">👍</button><button class="feedback-btn">👎</button><button class="btn-pesquisa-avancada" style="background:#10b981">CIOT</button><button class="btn-pesquisa-avancada" style="background:#dc2626">Blog</button></div>'; s.appendChild(c);
      s.scrollTop = s.scrollHeight; })()`);
    await sleep(300); await foto(c, '03-chat');
    // D) funcionamento
    await c.eval("Palette.open(); 0"); await sleep(250);
    ok('D1 a paleta (Ctrl K) abre', await c.eval("document.querySelector('.pal-overlay') && document.querySelector('.pal-overlay').classList.contains('is-on')"));
    const efPal = await c.eval(EFEITOS);
    ok('D1b a paleta aberta não tem vidro nem filtro (a cortina atrás dela é só uma cor translúcida)', efPal.backdrop.length === 0 && efPal.filtro.length === 0, { backdrop: efPal.backdrop, filtro: efPal.filtro });
    await foto(c, '04-paleta');
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(250);
    ok('D2 Esc fecha a paleta', await c.eval("!document.querySelector('.pal-overlay').classList.contains('is-on')"));
    await c.eval("Personalizar.open(); 0"); await sleep(300);
    const dr = await c.eval("(function(){ var t = document.getElementById('drawer').innerText; return { fundo: /\\bFundo\\b/.test(t), vidro: /Animações e vidro/.test(t), auto: /Ajustar o visual sozinho/.test(t), cor: /Cor de destaque/.test(t), dens: /Densidade/.test(t) }; })()");
    ok('D3 Personalizar abre com "Cor de destaque" e "Densidade" e SEM Fundo / Animações e vidro / ajuste automático', dr.cor && dr.dens && !dr.fundo && !dr.vidro && !dr.auto, dr);
    const efDr = await c.eval(EFEITOS);
    ok('D3b Personalizar aberto não tem vidro nem filtro', efDr.backdrop.length === 0 && efDr.filtro.length === 0, { backdrop: efDr.backdrop, filtro: efDr.filtro });
    await foto(c, '05-personalizar');
    await c.eval("document.querySelector('.dr-sw[data-accent=\"#2563eb\"]').click(); 0"); await sleep(250);
    ok('D4 trocar a cor de destaque funciona (--primary vira azul no botão ➤ e na mensagem do usuário)', await c.eval("(function(){ var e = document.querySelector('.user-msg'); return getComputedStyle(e).backgroundColor === 'rgb(37, 99, 235)' && document.documentElement.style.getPropertyValue('--primary').trim() === '#2563eb'; })()"));
    await c.eval("document.querySelector('.dr-sw[data-accent=\"\"]').click(); 0"); await sleep(150);
    await c.eval("Personalizar.close ? Personalizar.close() : document.querySelector('[data-a=\"close\"]').click(); 0"); await sleep(250);
    ok('D5 o painel Personalizar fecha', await c.eval("!document.getElementById('drOverlay') || !document.getElementById('drOverlay').classList.contains('is-on')"));
    for (const [id, nome] of [['sefaz', 'SEFAZ'], ['regra', 'Regras'], ['relatorios', 'Relatórios'], ['params', 'Parâmetros'], ['agenda', 'Agenda'], ['space', 'Meu Espaço'], ['news', 'Novidades']]) {
        await c.eval("Workspace.open('" + id + "'); 0"); await sleep(700);
        const v = await c.eval("(function(){ var t = TOOLS['" + id + "']; var p = document.getElementById(t.pane); if (!p) return null; var b = p.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), ativa: p.classList.contains('is-active') || getComputedStyle(p).display !== 'none' }; })()");
        ok('D6 a aba ' + nome + ' abre e ocupa a área do chat', v && v.ativa && v.w > 400 && v.h > 300, v);
        if (VERBOSE || CAP) await foto(c, '06-aba-' + id);
    }
    await c.eval("Workspace.open('chat'); 0"); await sleep(400);
    await c.eval("Toast.show('Teste de aviso do layout leve', { ms: 1200, icon: 'sparkles' }); 0"); await sleep(250);
    ok('D7 o aviso (toast) aparece', await c.eval("!!document.querySelector('.toasts .toast')"));
    await foto(c, '07-toast'); await sleep(1800);
    ok('D8 …e some sozinho', await c.eval("!document.querySelector('.toasts .toast:not(.out)')"));
    // recolher/abrir conversas
    await c.eval("toggleSidebar(); 0"); await sleep(250);
    const colapsou = await c.eval("document.getElementById('sidebar').getBoundingClientRect().width");
    await c.eval("toggleSidebar(); 0"); await sleep(250);
    ok('D9 recolher e abrir a lista de conversas funciona', colapsou < 5 && (await c.eval("document.getElementById('sidebar').getBoundingClientRect().width")) > 200, colapsou);
    ok('D10 nenhuma animação rodando depois de tudo, parado', (await c.eval(EFEITOS)).rodando.filter(x => !/toast/i.test(x)).length === 0, (await c.eval(EFEITOS)).rodando);
    ok('D11 sem erro de JavaScript', c.erros.length === 0, c.erros);
    c.fechar();
}

// ─── celular ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function testeCelular() {
    console.log('D) Celular (390 px) — conversas viram gaveta');
    const c = await nova({ w: 390, h: 800, mobile: true });
    const pronto = await ir(c, URL_APP, PRONTO);
    ok('M0 a página ficou pronta no celular', pronto);
    if (!pronto) { c.fechar(); return; }
    await sleep(900);
    const g = await c.eval("(function(){ var s = document.getElementById('sidebar').getBoundingClientRect(); var i = document.querySelector('.input-area').getBoundingClientRect(); return { sideR: Math.round(s.right), inputW: Math.round(i.width), scrollX: document.documentElement.scrollWidth > innerWidth + 1 }; })()");
    ok('M1 as conversas começam FORA da tela (gaveta fechada)', g.sideR <= 0, g);
    ok('M2 sem rolagem horizontal da página', !g.scrollX, g);
    await foto(c, '10-celular');
    await c.eval("document.querySelector('.btn-toggle-sidebar').click(); 0"); await sleep(400);
    const ab = await c.eval("(function(){ var s = document.getElementById('sidebar').getBoundingClientRect(); return { x: Math.round(s.left), w: Math.round(s.width), h: Math.round(s.height), vh: innerHeight, aberta: document.getElementById('sidebar').classList.contains('open') }; })()");
    ok('M3 o botão ☰ abre a gaveta (encosta na esquerda, altura total)', ab.aberta && ab.x === 0 && ab.w > 200 && ab.h >= ab.vh - 2, ab);
    await foto(c, '11-celular-gaveta');
    await c.eval("document.body.click(); 0"); await sleep(400);
    ok('M4 clicar fora fecha a gaveta', await c.eval("!document.getElementById('sidebar').classList.contains('open')"));
    ok('M5 sem erro de JavaScript', c.erros.length === 0, c.erros);
    c.fechar();
}

// ─── E) compatibilidade ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function testeCompat() {
    console.log('E) Compatibilidade — preferências antigas e ajuste automático antigo guardados no navegador');
    const c = await nova();
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('bsoft_v27_prefs', JSON.stringify({ bg: 'foto', efeitos: 'zero', perfAuto: false, density: 'compacta', accent: '#059669', accentRgb: '5 150 105', updated: 1 })); localStorage.setItem('bsoft_perf', JSON.stringify({ n: 'leve', t: Date.now() })); } catch (e) {}" });
    const pronto = await ir(c, URL_APP, PRONTO);
    ok('E0 a página ficou pronta com preferências antigas', pronto);
    if (pronto) {
        await sleep(800);
        const e = await c.eval("(function(){ var h = document.documentElement; return { dens: h.dataset.density, pr: h.style.getPropertyValue('--primary').trim(), perf: h.dataset.perf || null, bg: h.dataset.bg || null, fundo: getComputedStyle(document.body).backgroundColor }; })()");
        ok('E1 densidade compacta e cor verde continuam valendo; nada de data-perf/data-bg', e.dens === 'compacta' && e.pr === '#059669' && !e.perf && !e.bg, e);
        ok('E2 o fundo é liso (cor sólida, sem imagem)', await c.eval("getComputedStyle(document.body).backgroundImage === 'none'"));
        ok('E3 sem erro de JavaScript', c.erros.length === 0, c.erros);
    }
    c.fechar();
}

// ─── G) tabelas grandes em páginas paralelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function testeParalelo() {
    console.log('G) Tabelas grandes: páginas em paralelo (mesmos dados, chegam mais cedo)');
    const c = await nova();
    let reqs = [];
    // (só os GET: cada página também gera uma pré-verificação CORS — OPTIONS — que não conta)
    c.on('Network.requestWillBeSent', p => { if (p.request.method === 'GET' && /\/rest\/v1\/Rotinas\?/.test(p.request.url)) reqs.push({ t: p.timestamp, id: p.requestId, off: +((/[?&]offset=(\d+)/.exec(p.request.url) || [0, 0])[1]) }); });
    c.on('Network.responseReceived', p => { const r = reqs.find(x => x.id === p.requestId); if (r) r.resp = p.timestamp; });
    // identidade das linhas: o conteúdo INTEIRO de cada uma (Rotinas não tem coluna id) — "ord" confere também a ORDEM, "conj" só o conjunto de linhas
    const HASH = "function(arr){ var ord = 7, conj = 0; arr.forEach(function(r){ var s = JSON.stringify(r), h = 5; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000000007; ord = (ord * 31 + h) % 1000000007; conj = (conj + h) % 1000000007; }); return ord + ':' + conj; }";
    const DADOS = "(function(){ var H = " + HASH + "; return JSON.stringify({ rot: dadosRotinas.length, par: dadosParametros.length, fun: dadosFuncionalidades.length, ids: H(dadosRotinas) + '|' + H(dadosParametros) + '|' + H(dadosFuncionalidades), cont: localStorage.getItem('bsoft_tab_linhas') }); })()";
    const esperarPronto = async () => { for (let i = 0; i < 160; i++) { await sleep(250); if (await c.eval(PRONTO).catch(() => false)) return true; } return false; };
    const sequencial = r => r.length > 1 && r.slice().sort((a, b) => a.off - b.off).every((x, i, v) => i === 0 || x.t >= (v[i - 1].resp || Infinity));
    const paralelo = r => r.length > 1 && Math.max(...r.map(x => x.t)) < Math.min(...r.map(x => x.resp || Infinity));
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try { if (!sessionStorage.getItem('__g_ini')) { localStorage.removeItem('bsoft_tab_linhas'); sessionStorage.setItem('__g_ini', '1'); } } catch (e) {}" });
    ok('G0 1ª abertura (sem contagem guardada) ficou pronta', await ir(c, URL_APP, PRONTO));
    const d1 = JSON.parse(await c.eval(DADOS)); const r1 = reqs.slice(); reqs = [];
    ok('G1 as tabelas vieram completas (Rotinas passa de 1000 linhas)', d1.rot > 1000 && d1.par > 0 && d1.fun > 0, d1);
    ok('G2 sem contagem guardada: Rotinas vem página por página (cada uma só depois da anterior, como antes)', sequencial(r1) && r1.length === Math.ceil(d1.rot / 1000) + (d1.rot % 1000 === 0 ? 1 : 0), r1.map(x => x.off));
    ok('G3 a contagem foi guardada para a próxima abertura', !!d1.cont && JSON.parse(d1.cont).Rotinas === d1.rot, d1.cont);
    await c.send('Page.reload'); ok('G4 2ª abertura ficou pronta', await esperarPronto());
    const d2 = JSON.parse(await c.eval(DADOS)); const r2 = reqs.slice(); reqs = [];
    ok('G5 2ª abertura: as páginas de Rotinas saem TODAS JUNTAS (nenhuma espera a resposta de outra)', paralelo(r2) && r2.length === Math.ceil((d1.rot + 100) / 1000), { n: r2.length, esperado: Math.ceil((d1.rot + 100) / 1000) });
    ok('G6 …e os dados são EXATAMENTE os mesmos da carga em fila (mesmo tamanho, mesmo conteúdo de cada linha, na mesma ordem)', d2.rot === d1.rot && d2.par === d1.par && d2.fun === d1.fun && d2.ids === d1.ids, { d1, d2 });
    // a tabela "cresceu" (contagem guardada menor que a real): 1 página junta e o resto em fila, sem perder linha
    await c.eval("localStorage.setItem('bsoft_tab_linhas', JSON.stringify({ Rotinas: 100, Parametros: 100, Funcionalidades: 100 })); 0");
    await c.send('Page.reload'); ok('G7 abertura com contagem antiga (tabela cresceu) ficou pronta', await esperarPronto());
    const d3 = JSON.parse(await c.eval(DADOS)); const r3 = reqs.slice(); reqs = [];
    ok('G8 tabela maior que o esperado: nenhuma linha se perde (dados idênticos) e o resto vem em fila', d3.rot === d1.rot && d3.par === d1.par && d3.fun === d1.fun && d3.ids === d1.ids && sequencial(r3), { d1, d3, offs: r3.map(x => x.off) });
    // a tabela "encolheu" (contagem guardada maior que a real): páginas a mais voltam vazias e nada muda (o teto é 8 páginas)
    await c.eval("localStorage.setItem('bsoft_tab_linhas', JSON.stringify({ Rotinas: 50000, Parametros: 50000, Funcionalidades: 50000 })); 0");
    await c.send('Page.reload'); ok('G9 abertura com contagem velha (tabela encolheu) ficou pronta', await esperarPronto());
    const d4 = JSON.parse(await c.eval(DADOS)); const r4 = reqs.slice(); reqs = [];
    ok('G10 contagem exagerada: no máximo 8 páginas juntas e os dados continuam idênticos', d4.rot === d1.rot && d4.par === d1.par && d4.fun === d1.fun && d4.ids === d1.ids && r4.length <= 8, { n: r4.length });
    ok('G11 a contagem guardada volta ao valor real', JSON.parse(d4.cont).Rotinas === d1.rot, d4.cont);
    ok('G12 sem erro de JavaScript', c.erros.length === 0, c.erros);
    c.fechar();
}

// ─── F) outras páginas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function testeOutras() {
    console.log('F) Outras páginas — abrem sem erro e sem efeito pesado');
    for (const [rel, nome] of [['faq.html', 'FAQ'], ['migracao.html', 'Primeira emissão'], ['simulador.html', 'Simulador'], ['admin/index.html', 'Painel administrativo (login)'], ['migracaolocal.html', 'Primeira emissão (IA local)']]) {
        const c = await nova();
        await ir(c, BASE + '/' + rel, null); await sleep(3200);
        const ef = await c.eval(EFEITOS).catch(() => null);
        ok('F ' + nome + ': carregou', !!ef);
        if (ef) {
            ok('F ' + nome + ': sem backdrop-filter', ef.backdrop.length === 0, ef.backdrop);
            ok('F ' + nome + ': sem filter / mistura / will-change', ef.filtro.length === 0 && ef.mistura.length === 0 && ef.willChange.length === 0, { filtro: ef.filtro, mistura: ef.mistura, wc: ef.willChange });
        }
        const filtrados = c.erros.filter(e => !/Failed to load resource|net::ERR|supabase|CORS|favicon|ERR_FAILED|401|403|404/i.test(e));
        ok('F ' + nome + ': sem erro de JavaScript', filtrados.length === 0, filtrados);
        if (CAP) await foto(c, '20-' + rel.replace(/[\/.]/g, '-'));
        c.fechar();
    }
}

(async () => {
    const proc = await L.lancar({ porta: PORTA, gpu: false, w: 1536, h: 900, args: ['--headless=new'] });
    try {
        if (quer('A')) await testeProntidao();
        if (quer('B')) await testePagina();
        if (quer('M')) await testeCelular();
        if (quer('E')) await testeCompat();
        if (quer('G')) await testeParalelo();
        if (quer('F')) await testeOutras();
    } catch (e) { falhas++; console.log('ERRO no teste:', e && e.stack || e); }
    console.log('\n' + (n - falhas) + ' verificações ok · ' + falhas + ' falha(s)');
    try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
    process.exit(falhas ? 1 : 0);
})();
