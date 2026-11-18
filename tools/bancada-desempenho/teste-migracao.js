'use strict';
/* teste-migracao.js — testa a página migracao.html (Primeira emissão guiada) no Edge de verdade (via CDP), com a IA SIMULADA (sem rede de IA; o banco é lido de verdade, somente leitura).
   Percorre o que o CLIENTE vê: as perguntas do começo, o passo a passo (Anterior / Próximo, vídeos, "Onde fica no Bsoft", erros comuns, prazos), o chat com a IA no mesmo lugar
   (pergunta, anonimização, modo "Deu erro", "Tentar de novo", cancelar, fontes, HTML injetado), mudar respostas, recomeçar, dados corrompidos no navegador, celular 375 px e o banco fora do ar.
   Rode (servidor do projeto em http://localhost:8791 ou BSOFT_URL):
     $env:ELECTRON_RUN_AS_NODE = "1"; $env:BSOFT_URL = "http://localhost:8791/bsoft-suporte-ia/migracao.html?sim=1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-migracao.js | Out-String
   Parâmetros: --visual  salva prints em %TEMP%\migracao-prints\ (para conferir o visual) · --verbose  mostra cada verificação. */
const fs = require('fs'), path = require('path'), os = require('os');
const L = require('./lib-cdp.js');
const URL_PG = process.env.BSOFT_URL || 'http://localhost:8791/bsoft-suporte-ia/migracao.html?sim=1';
const visual = process.argv.includes('--visual'), verboso = process.argv.includes('--verbose');
const PORTA = 9555, pastaPrints = path.join(os.tmpdir(), 'migracao-prints');
let ok = 0; const falhas = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 300) : '')); if (verboso) console.log((cond ? '  ✔ ' : '  ✘ ') + nome + (!cond && detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 200) : '')); };

// Se sobrou um Edge de TESTE de uma rodada anterior nesta porta (rodada interrompida), fecha só ele — pelo próprio protocolo de depuração — antes de começar,
// senão o teste se ligaria a ele e herdaria o armazenamento dele. (Nunca encerra o Edge da pessoa: só responde nesta porta o que este teste abriu.)
async function fecharAntigo(porta) {
    try {
        const v = await (await fetch('http://127.0.0.1:' + porta + '/json/version')).json();
        const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await L.sleep(1800);
    } catch (e) { /* não havia nenhum */ }
}
// a IA de mentira: guarda o que a página mandou e responde o que o teste combinar (window.__resp)
const STUB = `window.__chamadas = []; window.__resp = { modo: 'ok', texto: 'Resposta de teste: vá em **Transporte > Conhecimento de Transporte Eletrônico** e clique em Novo.' };
window.callMCPAPI = async (p, m, k, b, msgs) => { window.__chamadas.push(msgs); const r = window.__resp; if (r.modo === 'erro') throw new Error('falha de teste'); if (r.modo === 'travado') return new Promise(() => {}); return { text: r.texto, finishReason: 'stop' }; }; true`;

(async () => {
    await fecharAntigo(PORTA);
    const edge = await L.lancar({ porta: PORTA, gpu: false, w: 1280, h: 900, args: ['--headless=new', '--force-prefers-no-reduced-motion'] });
    const c = await L.abrirPagina(PORTA);
    const ev = js => c.eval(js);
    const esperar = async (cond, ms = 15000, passo = 120) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda carregando */ } await L.sleep(passo); } return false; };
    const erros = [];
    c.on('Runtime.exceptionThrown', p => erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).slice(0, 220)));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') erros.push('console.error: ' + p.args.map(a => a.value || a.description || '').join(' ').slice(0, 220)); });
    async function print(nome) { if (!visual) return; fs.mkdirSync(pastaPrints, { recursive: true }); const r = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(pastaPrints, nome + '.png'), Buffer.from(r.data, 'base64')); }
    const carregar = async (url, aposLimpar) => { await L.navegar(c, 'about:blank'); if (aposLimpar) await c.send('Storage.clearDataForOrigin', { origin: new URL(URL_PG).origin, storageTypes: 'local_storage' }); await L.navegar(c, url || URL_PG); await esperar("typeof Mig !== 'undefined' && Mig.dados.estado !== 'carregando'", 40000); await ev(STUB); };
    // clica no primeiro elemento do seletor cujo texto contém o trecho (sem diferenciar maiúsculas)
    const clicarTexto = (sel, trecho) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.toLowerCase().includes(${JSON.stringify(trecho.toLowerCase())})); if (!e) return false; e.click(); return true; })()`);
    const clicar = sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const digitar = (sel, valor) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(valor)}; e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    const textos = sel => ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(x => x.textContent.trim())`);
    const ocioso = () => esperar("!document.querySelector('#chatLista .mig-msg.digitando')", 20000);
    const perguntar = async (texto) => { await ev(`(() => { const f = document.getElementById('chatCampo'); f.value = ${JSON.stringify(texto)}; document.querySelector('.mig-compor').requestSubmit(); return true; })()`); await L.sleep(150); await ocioso(); await L.sleep(100); };
    const ultimoPrompt = () => ev("(() => { const m = window.__chamadas.slice(-1)[0] || []; return { sistema: (m.find(x => x.role === 'system') || {}).content || '', usuario: (m.filter(x => x.role === 'user').slice(-1)[0] || {}).content || '', n: window.__chamadas.length }; })()");
    const passoAtual = () => ev("({ idx: Mig.atual.passoIdx, id: Mig.rot.passos[Mig.atual.passoIdx].id, titulo: (document.querySelector('#passoCard h2') || {}).textContent })");
    // true quando o texto visível do trecho NÃO tem "null", "undefined", "NaN" nem "[object" (o append nativo do DOM escreve "null" quando o filho é null)
    const semLixo = sel => ev(`!/(^|[^\\w])(null|undefined|NaN)([^\\w]|$)|\\[object/.test(document.querySelector(${JSON.stringify(sel)}).innerText)`);
    const IDS_MIGRACAO = ['numeracao', 'pessoas', 'veiculos', 'seguro', 'cte', 'mdfe', 'ciotPropria', 'contratoFrete', 'depois'];

    try {
        await c.send('Runtime.enable'); await c.send('Page.enable');
        await c.send('Network.enable'); await c.send('Network.setBlockedURLs', { urls: ['*youtube-nocookie.com*', '*youtube.com*', '*ytimg.com*'] });   // o player não precisa abrir de verdade
        await carregar(URL_PG, true);

        // ═════════ carga ═════════
        t('carga: a base de conhecimento terminou de carregar', await esperar("Mig.dados.estado === 'pronto'", 40000), await ev("Mig.dados.estado + ' ' + Mig.dados.erro"));
        const base = await ev("({ banco: Mig.dados.banco.length, rap: Mig.dados.rapidas.length, faq: Mig.dados.faq.length, par: Mig.dados.params.length, fun: Mig.dados.funcs.length, ix: Mig.ix.banco.N })");
        t('carga: leu artigos, respostas aprovadas, parâmetros e funcionalidades', base.banco > 300 && base.rap > 5 && base.par > 500 && base.fun > 50 && base.ix === base.banco, JSON.stringify(base));
        t('carga: sem erro de JavaScript na abertura', erros.length === 0, erros.join(' | '));
        t('carga: título da página', /Primeira emissão guiada/.test(await ev('document.title')), await ev('document.title'));
        t('carga: nenhuma gravação tentada no banco (somente leitura)', (await ev('(window.BSOFT_SIM_BLOQUEIOS||[]).length')) === 0);
        t('carga: sem cliente guardado, abre nas perguntas (sem o passo a passo, sem Recomeçar e sem botão do chat)', await ev("!document.getElementById('telaInicio').hidden && document.getElementById('telaPassos').hidden && document.getElementById('btnRecomecar').hidden && document.getElementById('btnChatCelular').hidden"));
        t('a IA do chat usa os modelos do painel (MCP)', (await ev('mcpMontarCadeia().length')) >= 1);

        // ═════════ perguntas do começo ═════════
        t('perguntas: título e as 4 perguntas na ordem', JSON.stringify(await textos('#telaInicio legend')) === JSON.stringify(['Sua empresa…', 'Com quais documentos você quer ajuda para emitir?', 'Você tem seguro de transporte (apólice)?', 'Últimos números que você emitiu no sistema anterior (opcional)']), JSON.stringify(await textos('#telaInicio legend')));
        t('perguntas: não pede nome, CNPJ nem nenhum dado pessoal (só 1 campo de texto = números)', (await ev("document.querySelectorAll('#telaInicio input[type=text]').length")) === 4 && (await ev("[...document.querySelectorAll('#telaInicio input[type=text]')].every(i => i.inputMode === 'numeric')")));
        t('perguntas: as respostas padrão (migração; CT-e e MDF-e; seguro já configurado)', await ev("document.querySelector('input[name=perf_trilha]:checked').value === 'migracao' && [...document.querySelectorAll('.mig-op input[type=checkbox]:checked')].map(i => i.nextSibling.textContent).join('|').startsWith('CT-e') && document.querySelector('input[name=perf_seguro]:checked').value === 'configurado'"));
        t('perguntas: a tela é simples — nenhum item de configuração do sistema (certificado, talão, regra, tabela)', !/certificado|talão|talao|regra de cálculo|tabela de pre/i.test(await ev("document.getElementById('telaInicio').textContent")));
        await print('01-perguntas');
        t('tela: as perguntas não mostram "null" nem "undefined"', await semLixo('#telaInicio'));
        await clicar('input[name=perf_trilha][value=nova]'); await L.sleep(120);
        t('perguntas: "empresa nova" tira a pergunta dos últimos números', (await textos('#telaInicio legend')).length === 3);
        await clicar('input[name=perf_trilha][value=migracao]'); await L.sleep(120);
        t('perguntas: voltar para "outro sistema" traz a pergunta de volta', (await textos('#telaInicio legend')).length === 4);
        // sem documento nenhum não segue
        await ev("document.querySelectorAll('.mig-op input[type=checkbox]:checked').forEach(i => i.click()); true");
        await clicar('.mig-form button[type=submit]'); await L.sleep(150);
        t('perguntas: sem nenhum documento marcado mostra o aviso e não segue', await ev("!document.querySelector('.mig-erro[role=alert]').hidden && /pelo menos um documento/.test(document.querySelector('.mig-erro[role=alert]').textContent) && !document.getElementById('telaInicio').hidden"));
        await clicarTexto('.mig-op', 'CT-e (conhecimento'); await clicarTexto('.mig-op', 'MDF-e'); await clicarTexto('.mig-op', 'CIOT da frota'); await clicarTexto('.mig-op', 'Contrato de frete');
        await clicar('input[name=perf_seguro][value=configurar]');
        const nums = '.mig-numeracao input';
        await ev(`(() => { const n = [...document.querySelectorAll(${JSON.stringify(nums)})]; const pôr = (i, v) => { n[i].value = v; n[i].dispatchEvent(new Event('input', { bubbles: true })); }; pôr(0, '1'); pôr(1, '15a00'); pôr(2, '1'); pôr(3, '320'); return true; })()`);
        t('perguntas: o campo de número só aceita dígitos', (await ev(`document.querySelectorAll(${JSON.stringify(nums)})[1].value`)) === '1500');
        await print('02-perguntas-preenchidas');
        await clicar('.mig-form button[type=submit]');
        t('perguntas: "Começar" leva ao passo a passo (e mostra Recomeçar e o chat)', await esperar("document.getElementById('telaInicio').hidden && !document.getElementById('telaPassos').hidden && !document.getElementById('btnRecomecar').hidden && !!document.getElementById('colunaChat').firstChild", 4000));
        const cli = await ev('JSON.parse(JSON.stringify(Mig.atual))');
        t('cliente: respostas saneadas (documentos, seguro e números só com dígitos), sem nome', JSON.stringify(cli.perfil.docs) === JSON.stringify(['cte', 'mdfe', 'ciotPropria', 'contratoFrete']) && cli.perfil.seguro === 'configurar' && cli.perfil.numeracao.cteNumero === '1500' && cli.perfil.numeracao.mdfeNumero === '320' && !('nome' in cli), JSON.stringify(cli.perfil));
        await L.sleep(700);
        t('cliente: guardado só no navegador (localStorage), um único cliente', (await ev("JSON.parse(localStorage.getItem('bsoft_migracao_v1')).clientes.length")) === 1);

        // ═════════ passo a passo ═════════
        t('passos: 9 passos na ordem certa para esse perfil (sem o passo "entenda", que é da empresa nova)', JSON.stringify(await ev('Mig.rot.passos.map(p => p.id)')) === JSON.stringify(IDS_MIGRACAO), JSON.stringify(await ev('Mig.rot.passos.map(p => p.id)')));
        t('passos: faixa de progresso "Passo 1 de 9" e 9 bolinhas', (await textos('.mig-progresso-topo b'))[0] === 'Passo 1 de 9' && (await ev("document.querySelectorAll('.mig-stepper .mig-step').length")) === 9);
        t('passo 1: "Anterior" desligado no primeiro passo', await ev("[...document.querySelectorAll('.mig-nav button')].find(b => /Anterior/.test(b.textContent)).disabled"));
        const p1 = await ev("({ titulo: document.querySelector('#passoCard h2').textContent, numeros: [...document.querySelectorAll('.mig-numeros p')].map(p => p.textContent), secs: [...document.querySelectorAll('#passoCard .mig-sec > h4')].map(h => h.textContent), caminhos: [...document.querySelectorAll('#passoCard .mig-caminho')].map(x => x.textContent + (x.classList.contains('duvida') ? ' [DÚVIDA]' : '')) })");
        t('passo 1 (numeração): mostra o último número e o próximo esperado (CT-e 1501, MDF-e 321)', p1.numeros.some(x => /número 1500.*1501/.test(x)) && p1.numeros.some(x => /número 320.*321/.test(x)), JSON.stringify(p1.numeros));
        t('passo 1: tem Tenha em mãos, Onde fica no Bsoft, Passo a passo e Cuidado', ['Tenha em mãos', 'Onde fica no Bsoft', 'Passo a passo', 'Cuidado'].every(s => p1.secs.includes(s)), JSON.stringify(p1.secs));
        t('passo 1: o caminho do menu existe no menu real do Bsoft (sem aviso de dúvida)', p1.caminhos.length >= 1 && p1.caminhos.every(x => !/DÚVIDA/.test(x)), JSON.stringify(p1.caminhos));
        t('passo 1: o chat já sabe em que passo a pessoa está', /Você está em: Confira se a numeração/.test(await ev("document.querySelector('.mig-chat-cab small').textContent")));
        await print('03-passo-numeracao');
        t('tela: o passo e o chat (ainda vazio) não mostram "null" nem "undefined"', await semLixo('#telaPassos'));
        // percorre todos os passos
        const resumoPassos = [];
        for (let i = 0; i < 9; i++) {
            await ev('Mig.irPasso(' + i + '); true'); await L.sleep(60);
            resumoPassos.push(await ev(`(() => { const card = document.getElementById('passoCard'), p = Mig.rot.passos[${i}]; return { id: p.id, h2: card.querySelector('h2').textContent, comoLi: card.querySelectorAll('.mig-como-fazer li').length, video: !!card.querySelector('.mig-video'), esperaVideo: !!(p.video && p.video.length), erros: card.querySelectorAll('.mig-chips .mig-chip').length, esperaErros: (p.erros || []).length, sugestao: !!document.querySelector('.mig-sugestoes .mig-chip:nth-child(2)') && document.querySelector('.mig-sugestoes .mig-chip:nth-child(2)').textContent === p.mentor }; })()`));
        }
        t('passos: todos têm título, "Passo a passo" com ações e a pergunta pronta do chat como 1ª sugestão', resumoPassos.every(r => r.h2.length > 8 && r.comoLi >= 2 && r.sugestao), JSON.stringify(resumoPassos.filter(r => !(r.h2.length > 8 && r.comoLi >= 2 && r.sugestao))));
        t('passos: vídeo tutorial só nos passos que têm vídeo (6 passos)', resumoPassos.every(r => r.video === r.esperaVideo) && resumoPassos.filter(r => r.video).length === 6, JSON.stringify(resumoPassos.map(r => r.id + ':' + r.video)));
        t('passos: os "erros comuns" de cada passo aparecem como botões', resumoPassos.every(r => r.erros === r.esperaErros) && resumoPassos.every(r => r.erros >= 1), JSON.stringify(resumoPassos.map(r => r.id + ':' + r.erros + '/' + r.esperaErros)));
        // passo com vídeo
        await ev('Mig.irPasso(1); true'); await L.sleep(80);
        const v1 = await ev("({ titulo: document.querySelector('.mig-video h4').textContent, botao: !!document.querySelector('.mig-video button'), link: (document.querySelector('.mig-video-link a') || {}).href, rel: (document.querySelector('.mig-video-link a') || {}).rel, iframe: !!document.querySelector('.mig-video iframe') })");
        t('vídeo: título do vídeo do passo, botão "Carregar e assistir" e link para abrir em outra guia (rel noopener)', /Cadastro de Pessoas/.test(v1.titulo) && v1.botao && /youtube\.com\/watch\?v=PQyEQINmHYA/.test(v1.link) && /noopener/.test(v1.rel) && !v1.iframe, JSON.stringify(v1));
        await clicarTexto('.mig-video button', 'Carregar'); await L.sleep(200);
        const pl = await ev("(() => { const f = document.querySelector('.mig-player iframe'); return f ? { src: f.src, sandbox: f.getAttribute('sandbox'), title: f.title } : null; })()");
        t('vídeo: o player só aparece depois do clique, no domínio sem cookies do YouTube, com sandbox', !!pl && /^https:\/\/www\.youtube-nocookie\.com\/embed\/PQyEQINmHYA/.test(pl.src) && /allow-scripts/.test(pl.sandbox) && !/allow-top-navigation/.test(pl.sandbox), JSON.stringify(pl));
        await print('04-passo-video');
        // seguro
        await ev('Mig.irPasso(3); true'); await L.sleep(80);
        const seg = await ev("document.getElementById('passoCard').textContent");
        t('passo do seguro (cliente marcou "ainda não configurei"): ensina a cadastrar a apólice e a ligar a averbação automática', /apólice/i.test(seg) && /averba/i.test(seg) && !(await ev("!!document.querySelector('#passoCard .mig-video')")));
        // erro comum abre o artigo do banco
        await ev('Mig.irPasso(0); true'); await L.sleep(80);
        await clicarTexto('#passoCard .mig-chips .mig-chip', 'Rejeição 539'); await L.sleep(500);
        const dlg = await ev("(() => { const d = document.querySelector('dialog.mig-dialogo[open]'); return d ? { tit: d.querySelector('h2').textContent, corpo: d.querySelector('.mig-know-corpo') && !d.querySelector('.mig-know-corpo').hidden, texto: d.querySelector('.mig-know-corpo') ? d.querySelector('.mig-know-corpo').textContent.length : 0, botoes: [...d.querySelectorAll('.mig-dialogo-rodape button')].map(b => b.textContent) } : null; })()");
        t('erro comum: o botão abre na hora o artigo do banco de dados (sem IA) com o texto da solução', !!dlg && /539/.test(dlg.tit) && dlg.corpo && dlg.texto > 150 && dlg.botoes.some(b => /Perguntar à IA/.test(b)), JSON.stringify(dlg));
        t('erro comum: a janela avisa que mexer em talão, certificado, regras e tabelas é com o Suporte (os artigos são escritos para o Suporte)', await ev("(() => { const n = document.querySelector('dialog[open] .mig-so-emite'); return !!n && /é com o Suporte/.test(n.textContent) && /Opções do Sistema > Suporte/.test(n.textContent); })()"));
        await print('05-erro-comum-artigo');
        t('erro comum: abrir o artigo não chamou a IA', (await ev('window.__chamadas.length')) === 0);
        await clicarTexto('dialog[open] .mig-dialogo-rodape button', 'Perguntar à IA'); await L.sleep(250); await ocioso(); await L.sleep(150);
        const pe = await ultimoPrompt();
        t('erro comum → "Não resolveu? Perguntar à IA": vai para o chat no modo erro (formato causa → correção)', pe.n === 1 && /MODO "DEU ERRO NA PRIMEIRA EMISSÃO"/.test(pe.sistema) && /Causa provável/.test(pe.sistema) && /DEU ERRO NA PRIMEIRA EMISSÃO\.\nDocumento\/etapa: Talão e numeração\nMensagem de erro \(copiada do sistema\): Rejeição 539/.test(pe.usuario), pe.n + ' ' + pe.usuario.slice(-300));
        t('erro comum: o chat mostra a pergunta marcada com 🚑 e a resposta', (await textos('#chatLista .mig-msg.voce .mig-balao'))[0].startsWith('🚑 Erro:') && (await ev("document.querySelectorAll('#chatLista .mig-msg.ia').length")) === 1);
        t('modo erro: depois de enviar, volta ao modo normal', await ev("!document.querySelector('.mig-chip.erro.ativo')"));

        // ═════════ chat ═════════
        const ant = await ev('window.__chamadas.length');
        await ev('Mig.irPasso(4); true'); await L.sleep(80);
        await perguntar('Como emito o primeiro CT-e? Meu CNPJ é 12.345.678/0001-95, e-mail joao@empresa.com.br, fone (11) 98765-4321');
        const pr = await ultimoPrompt();
        t('chat: a pergunta chegou à IA com o perfil do cliente e o passo em que ele está', pr.n === ant + 1 && /PRIMEIRA EMISSÃO/.test(pr.usuario) && /Documentos que precisa emitir: CT-e; MDF-e; CIOT da frota própria; Contrato de frete/.test(pr.usuario) && /Seguro de transporte \(apólice\): Sim, mas ainda não configurei no sistema/.test(pr.usuario) && /Emitir o CT-e/.test(pr.usuario), pr.usuario.slice(0, 700));
        t('chat: manda também os números informados e o próximo esperado', /CT-e série 1, último número 1500 \(o próximo no Bsoft deve ser 1501\)/.test(pr.usuario) && /MDF-e série 1, último número 320/.test(pr.usuario));
        t('chat: anonimiza CNPJ, e-mail e telefone antes de ir para a IA', !/12\.345\.678|joao@empresa|98765/.test(pr.sistema + pr.usuario) && /CNPJ omitido/.test(pr.usuario) && /e-mail omitido/.test(pr.usuario) && /telefone omitido/.test(pr.usuario));
        t('chat: avisa a pessoa que omitiu os dados pessoais', /Omiti CNPJ/.test(await ev("document.getElementById('toast').textContent")));
        t('chat: o prompt diz que o cliente só emite (não configura o sistema) e traz a regra sem código de parâmetro', /O CLIENTE SÓ EMITE/.test(pr.sistema) && /NUNCA escreva o código/i.test(pr.sistema));
        t('chat: o prompt traz os vídeos do passo, o conhecimento do banco e as regras', /VÍDEOS TUTORIAIS/.test(pr.usuario) && /Emissão de CT-e/.test(pr.usuario) && /ARTIGO DO BANCO DE DADOS/.test(pr.usuario) && /REGRAS E PRAZOS CONFERIDOS/.test(pr.usuario));
        t('chat: a conversa mostra as perguntas e a resposta da IA com o texto formatado (negrito)', (await ev("document.querySelectorAll('#chatLista .mig-msg.voce').length")) === 2 && (await ev("!!document.querySelector('#chatLista .mig-msg.ia:last-of-type b, #chatLista .mig-msg.ia:last-of-type strong')")));
        const chips = await ev("[...document.querySelectorAll('#chatLista .mig-msg.ia:last-of-type .mig-fontes-chips .mig-chip')].map(b => b.textContent)");
        t('chat: mostra "Baseado em" com o vídeo primeiro, depois regras e artigos do banco (no máximo 6, sem ícone duplicado)', chips.length === 6 && chips[0].startsWith('🎬') && chips.some(x => x.startsWith('⏱️')) && chips.some(x => x.startsWith('📚')) && !chips.some(x => /📄 🎬/.test(x)), JSON.stringify(chips));
        const maisFontes = await ev("(() => { const b = [...document.querySelectorAll('#chatLista .mig-msg.ia:last-of-type .mig-fontes-chips > .mig-mini')][0]; return b ? b.textContent : null; })()");
        t('chat: o que passa de 6 fontes fica atrás de um botão "+N fontes"', /^\+\d+ fontes$/.test(maisFontes || ''), String(maisFontes));
        await ev("document.querySelector('#chatLista .mig-msg.ia:last-of-type .mig-fontes-chips > .mig-mini').click(); true"); await L.sleep(100);
        const todasFontes = await ev("[...document.querySelectorAll('#chatLista .mig-msg.ia:last-of-type .mig-fontes-chips .mig-chip')].map(b => b.textContent)");
        t('chat: clicar em "+N fontes" mostra o resto (incluindo as respostas aprovadas) e some o botão', todasFontes.length > 6 && todasFontes.some(x => x.startsWith('✅')) && !(await ev("document.querySelector('#chatLista .mig-msg.ia:last-of-type .mig-fontes-chips > .mig-mini')")), JSON.stringify(todasFontes));
        t('tela: nenhum "null", "undefined" ou "[object" escrito na tela do chat (o append nativo escreve "null")', await semLixo('#colunaChat'));
        await print('06-chat');
        // clicar numa fonte do banco
        await ev("(() => { const b = [...document.querySelectorAll('#chatLista .mig-msg.ia:last-of-type .mig-chip.fonte.banco')][0]; b.click(); return true; })()"); await L.sleep(300);
        t('chat: clicar numa fonte do banco abre o artigo', await ev("!!document.querySelector('dialog[open] .mig-know-corpo:not([hidden])') && document.querySelector('dialog[open] .mig-know-corpo').textContent.length > 100"));
        await ev("document.querySelector('dialog[open] .mig-x').click(); true"); await L.sleep(150);
        t('chat: fechar a janela a remove da página', (await ev("document.querySelectorAll('dialog.mig-dialogo').length")) === 0);
        await ev("[...document.querySelectorAll('#chatLista .mig-msg.ia:last-of-type .mig-chip.fonte.video')][0].click(); true"); await L.sleep(250);
        t('chat: clicar na fonte de vídeo abre o vídeo da equipe', await ev("!!document.querySelector('dialog[open] .mig-video') && /Emissão de CT-e/.test(document.querySelector('dialog[open] h2').textContent)"));
        await ev("document.querySelector('dialog[open] .mig-x').click(); true"); await L.sleep(150);
        await ev("[...document.querySelectorAll('#chatLista .mig-msg.ia:last-of-type .mig-chip.fonte.regra')][0].click(); true"); await L.sleep(250);
        t('chat: clicar numa regra mostra o texto da regra e "confirme com o seu contador"', await ev("!!document.querySelector('dialog[open] .mig-regra-texto') && /contador/.test(document.querySelector('dialog[open]').textContent)"));
        await ev("document.querySelector('dialog[open] .mig-x').click(); true"); await L.sleep(150);
        // modo erro pelo botão
        await clicarTexto('.mig-sugestoes .mig-chip.erro', 'Deu erro'); await L.sleep(120);
        t('modo erro: o botão liga o modo, muda a dica e o campo de texto', await ev("document.querySelector('.mig-chip.erro').getAttribute('aria-pressed') === 'true' && /Modo erro/.test(document.querySelector('.modo-erro').textContent) && /Cole aqui a mensagem/.test(document.getElementById('chatCampo').placeholder)"));
        await perguntar('Rejeição 539: Duplicidade de CT-e [chCTe:35260512345678000195570010000015001000015000]');
        const pm = await ultimoPrompt();
        t('modo erro: a IA recebe o formato "Causa provável / Como corrigir / Depois de corrigir / Se não resolver" e a chave de acesso é omitida', /Causa provável/.test(pm.sistema) && /Se não resolver/.test(pm.sistema) && /Documento\/etapa: CT-e\n/.test(pm.usuario) && /chave de acesso omitida/.test(pm.usuario) && !/35260512345678000195570010000015001000015000/.test(pm.sistema + pm.usuario));
        // HTML injetado na resposta
        await ev("window.__resp.texto = 'Olá <img src=x onerror=\"window.__xss=1\"> [clique aqui](javascript:window.__xss=2) <script>window.__xss=3</script> **negrito** e [site](https://exemplo.com)'; true");
        await perguntar('teste de segurança');
        t('segurança: HTML e links "javascript:" vindos da IA viram texto — nada executa', await ev("window.__xss === undefined && document.querySelectorAll('#chatLista img, #chatLista script').length === 0 && ![...document.querySelectorAll('#chatLista a')].some(a => /^javascript:/i.test(a.getAttribute('href')))"));
        t('segurança: links normais da IA abrem em outra guia com noopener', await ev("[...document.querySelectorAll('#chatLista a[href^=\"https://exemplo.com\"]')].every(a => a.target === '_blank' && /noopener/.test(a.rel))"));
        // pergunta com contexto antes da dúvida: a regra do cancelamento precisa chegar à IA
        await ev("window.__resp.texto = 'ok, veja a regra.'; true");
        await perguntar('Emiti um CT-e ontem em São Paulo com o valor errado. Ainda consigo cancelar? Qual é o prazo?');
        const pz2 = await ultimoPrompt();
        t('chat: a regra do cancelamento chega à IA mesmo quando a dúvida vem depois de um contexto ("Emiti um CT-e ontem… Ainda consigo cancelar?")', /\[REGRA cte-cancelar/.test(pz2.usuario) && /7 dias \(168 horas\)/.test(pz2.usuario), pz2.usuario.slice(0, 200));
        t('chat: o prompt traz os caminhos do menu do passo em que a pessoa está (conferidos no menu real)', /CAMINHOS DO MENU DESTE PASSO/.test(pz2.usuario) && /- Transporte > Documentos > CT-e/.test(pz2.usuario));
        // regra sem código
        await ev("window.__resp.texto = 'Ative o parâmetro 1234 (Descrição X) e a funcionalidade 77 antes de emitir.'; true");
        await perguntar('qual parâmetro preciso?');
        t('regra "sem código": a resposta da IA nunca mostra número de parâmetro ou funcionalidade', !/1234|\b77\b/.test(await ev("document.querySelector('#chatLista .mig-msg.ia:last-of-type .mig-balao').textContent")));
        // erro da IA + tentar de novo
        const antes = await ev('Mig.atual.mentor.length');
        await ev("window.__resp.modo = 'erro'; true");
        await ev("(() => { const f = document.getElementById('chatCampo'); f.value = 'e se a IA cair?'; document.querySelector('.mig-compor').requestSubmit(); return true; })()");
        t('IA fora do ar: mostra o aviso com "Tentar de novo" e as fontes do banco (depois de tentar os 4 modelos)', await esperar("!!document.querySelector('#chatLista .mig-msg.erro')", 40000) && /A IA não respondeu agora/.test(await ev("document.querySelector('#chatLista .mig-msg.erro').textContent")) && (await ev("document.querySelectorAll('#chatLista .mig-msg.erro .mig-chip').length")) >= 1);
        await ev("window.__resp.modo = 'ok'; window.__resp.texto = 'Voltei! Aqui está a resposta.'; true");
        await clicarTexto('#chatLista .mig-msg.erro button', 'Tentar de novo'); await L.sleep(200); await ocioso(); await L.sleep(150);
        t('"Tentar de novo": responde e não duplica a pergunta nem deixa o aviso', await ev("!document.querySelector('#chatLista .mig-msg.erro')") && (await ev('Mig.atual.mentor.length')) === antes + 2 && /Voltei!/.test(await ev("document.querySelector('#chatLista .mig-msg.ia:last-of-type').textContent")), (await ev('Mig.atual.mentor.length')) + ' vs ' + (antes + 2));
        // cancelar
        await ev("window.__resp.modo = 'travado'; true");
        await ev("(() => { const f = document.getElementById('chatCampo'); f.value = 'pergunta que trava'; document.querySelector('.mig-compor').requestSubmit(); return true; })()"); await L.sleep(400);
        const antesCancelar = await ev('Mig.atual.mentor.length - 1');
        t('cancelar: durante a espera aparece "cancelar" e o envio fica travado', await ev("!!document.querySelector('.mig-msg.digitando button') && document.querySelector('.mig-compor button[type=submit]').disabled"));
        await clicar('.mig-msg.digitando button'); await L.sleep(250);
        t('cancelar: avisa, libera o campo, tira a pergunta da conversa e devolve o texto para o campo (dá para editar e enviar de novo)', /cancelada/.test(await ev("document.getElementById('toast').textContent")) && await ev("!document.getElementById('chatCampo').disabled && !document.querySelector('.mig-msg.digitando')") && (await ev('Mig.atual.mentor.length')) === antesCancelar && (await ev("document.getElementById('chatCampo').value")) === 'pergunta que trava');
        await ev("window.__resp.modo = 'ok'; true"); await L.sleep(100);
        t('cancelar: quando a IA travada responde depois, a resposta atrasada é ignorada', (await ev('Mig.atual.mentor.length')) === antesCancelar);
        // limpar conversa
        const n1 = await ev('Mig.atual.mentor.length');
        await clicarTexto('.mig-chat-rodape .mig-link', 'Limpar'); await L.sleep(250);
        t('limpar conversa: pede confirmação', await ev("!!document.querySelector('dialog[open]') && /Apagar a conversa/.test(document.querySelector('dialog[open]').textContent)"));
        await clicarTexto('dialog[open] button', 'Apagar'); await L.sleep(250);
        t('limpar conversa: apaga as mensagens e volta ao convite inicial', n1 > 4 && (await ev('Mig.atual.mentor.length')) === 0 && await ev("!!document.querySelector('.mig-chat-vazio')"));
        await ev("[...document.querySelectorAll('.mig-sugestoes .mig-chip')].find(b => !b.classList.contains('erro')).click(); true"); await L.sleep(150); await ocioso();
        t('chat: clicar numa sugestão envia a pergunta do passo', (await ev("window.__chamadas.slice(-1)[0].slice(-1)[0].content")).includes('=== PERGUNTA ===\n' + await ev('Mig.rot.passos[Mig.atual.passoIdx].mentor')));

        // ═════════ prazos e fim ═════════
        await ev('Mig.irPasso(8); true'); await L.sleep(120);
        const pz = await ev("({ cards: document.querySelectorAll('.mig-regras-mini .mig-detalhes').length, tags: [...document.querySelectorAll('.mig-regras-mini .mig-tag')].map(x => x.textContent), aviso: /Conferido em/.test(document.querySelector('.mig-aviso-legal').textContent), fontes: document.querySelectorAll('.mig-regras-mini .mig-fontes a[href^=\"https://\"]').length })");
        t('prazos: 5 regras (CT-e, CC-e, MDF-e, encerrar, CIOT) com selo "conferida/orientativa", data e fontes', pz.cards === 5 && pz.tags.length === 5 && pz.tags.every(x => /conferida|orientativa/.test(x)) && pz.aviso && pz.fontes >= 3, JSON.stringify(pz));
        await ev("document.querySelector('.mig-regras-mini summary').click(); true"); await L.sleep(100);
        t('prazos: abrir a regra mostra o texto, "E se passar do prazo?" e as fontes', await ev("(() => { const d = document.querySelector('.mig-regras-mini .mig-detalhes'); return d.open && !!d.querySelector('.mig-regra-texto') && /E se passar do prazo/.test(d.textContent) && /Fontes/.test(d.textContent); })()"));
        // calculadora
        await ev(`(() => { const sel = document.querySelectorAll('.mig-prazos select'); const q = document.querySelector('.mig-prazos input[type=datetime-local]'); q.value = '2026-11-16T09:00'; q.dispatchEvent(new Event('input', { bubbles: true })); sel[0].value = 'CT-e'; sel[1].value = ''; sel[0].dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await L.sleep(120);
        const calc1 = await textos('.mig-prazo .ate');
        t('calculadora: CT-e autorizado em 16/11/2026 09:00 (regra geral) → cancelar até 23/11/2026 09:00', calc1.some(x => /23\/11\/2026 09:00/.test(x)), JSON.stringify(calc1));
        await ev(`(() => { const sel = document.querySelectorAll('.mig-prazos select'); sel[1].value = 'MT'; sel[1].dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await L.sleep(120);
        const calc2 = await ev("[...document.querySelectorAll('.mig-prazo')].map(x => x.textContent)");
        t('calculadora: no Mato Grosso o cancelamento do CT-e vira 8 horas (16/11/2026 17:00) e avisa que é a regra do estado', calc2.some(x => /16\/11\/2026 17:00/.test(x) && /regra do seu estado \(8 h\)/.test(x)), JSON.stringify(calc2));
        await ev(`(() => { const sel = document.querySelectorAll('.mig-prazos select'); sel[0].value = 'MDF-e'; sel[0].dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await L.sleep(120);
        t('calculadora: MDF-e mostra o cancelamento (24 h) e o limite antes do bloqueio por MDF-e aberto (30 dias)', await ev("(() => { const t = [...document.querySelectorAll('.mig-prazo')].map(x => x.textContent).join('|'); return /Cancelar o MDF-e/.test(t) && /antes do bloqueio/.test(t); })()"));
        await print('07-passo-prazos');
        t('tela: o passo dos prazos (regras, calculadora e erros) não mostra "null" nem "undefined"', await semLixo('#colunaPasso'));
        await ev("document.querySelector('.mig-passo-card').scrollIntoView(); true");
        // marcar passos e concluir
        await ev('Mig.irPasso(0); true'); await L.sleep(60);
        for (let i = 0; i < 8; i++) { await clicarTexto('.mig-nav button', 'Próximo'); await L.sleep(40); }
        t('navegação: "Próximo" avança e marca o passo como feito (✔ na bolinha)', (await passoAtual()).idx === 8 && (await ev("document.querySelectorAll('.mig-step.feito').length")) === 8 && /✔/.test(await ev("document.querySelector('.mig-step.feito').textContent")));
        t('navegação: no último passo o botão vira "Concluir ✓"', await ev("[...document.querySelectorAll('.mig-nav button')].some(b => /Concluir/.test(b.textContent))"));
        await clicarTexto('.mig-nav button', 'Anterior'); await L.sleep(60);
        t('navegação: "Anterior" volta um passo', (await passoAtual()).idx === 7);
        await ev("document.querySelectorAll('.mig-step')[2].click(); true"); await L.sleep(60);
        t('navegação: clicar na bolinha vai direto ao passo', (await passoAtual()).idx === 2);
        await clicarTexto('.mig-nav button', 'Próximo'); await ev('Mig.irPasso(8); true'); await L.sleep(60);
        await clicarTexto('.mig-nav button', 'Concluir'); await L.sleep(200);
        t('fim: tela de parabéns, com o contato do Suporte e a volta ao passo a passo', /Passo a passo concluído/.test(await ev("document.getElementById('colunaPasso').textContent")) && /Suporte/.test(await ev("document.querySelector('.mig-suporte').textContent")));
        await print('08-fim');
        await clicarTexto('#colunaPasso button', 'Rever'); await L.sleep(120);
        t('fim: "Rever o passo a passo" volta ao primeiro passo', (await passoAtual()).idx === 0);

        // ═════════ voltar depois (recarregar a página) ═════════
        await ev('Mig.irPasso(5); true'); await L.sleep(700);
        const msgsAntes = await ev('Mig.atual.mentor.length');
        await carregar(URL_PG, false);
        const rest = await ev("({ idx: Mig.atual && Mig.atual.passoIdx, feitos: document.querySelectorAll('.mig-step.feito').length, tela: !document.getElementById('telaPassos').hidden, titulo: (document.querySelector('#passoCard h2') || {}).textContent, msgs: document.querySelectorAll('#chatLista .mig-msg').length, nm: Mig.atual && Mig.atual.mentor.length })");
        t('recarregar: continua no mesmo passo, com o progresso e a conversa da IA', rest.idx === 5 && rest.tela && rest.feitos >= 8 && rest.titulo === 'Emitir o MDF-e' && rest.nm === msgsAntes && rest.msgs === msgsAntes, JSON.stringify(rest));

        // ═════════ mudar respostas ═════════
        await clicarTexto('.mig-rodape-passos .mig-link', 'Mudar minhas respostas'); await L.sleep(200);
        const ed = await ev("({ titulo: document.querySelector('#telaInicio h1').textContent, trilha: document.querySelector('input[name=perf_trilha]:checked').value, docs: [...document.querySelectorAll('.mig-op input[type=checkbox]:checked')].length, seguro: document.querySelector('input[name=perf_seguro]:checked').value, num: document.querySelectorAll('.mig-numeracao input')[1].value, cancelar: [...document.querySelectorAll('#telaInicio button')].some(b => /Cancelar/.test(b.textContent)) })");
        t('mudar respostas: abre com as respostas atuais preenchidas e botão Cancelar', ed.titulo === 'Mudar as suas respostas' && ed.trilha === 'migracao' && ed.docs === 4 && ed.seguro === 'configurar' && ed.num === '1500' && ed.cancelar, JSON.stringify(ed));
        await clicarTexto('#telaInicio button', 'Cancelar'); await L.sleep(150);
        t('mudar respostas: Cancelar volta ao passo em que a pessoa estava, sem mudar nada', await ev("!document.getElementById('telaPassos').hidden && document.getElementById('telaInicio').hidden && Mig.atual.passoIdx === 5 && Mig.atual.perfil.docs.length === 4"));
        await clicarTexto('.mig-rodape-passos .mig-link', 'Mudar minhas respostas'); await L.sleep(200);
        await clicarTexto('.mig-op', 'CIOT da frota'); await clicarTexto('.mig-op', 'Contrato de frete'); await clicar('input[name=perf_seguro][value=configurado]');
        await clicar('.mig-form button[type=submit]'); await L.sleep(250);
        const novo = await ev("({ ids: Mig.rot.passos.map(p => p.id), idx: Mig.atual.passoIdx, feitos: Object.keys(Mig.atual.passos).filter(k => Mig.atual.passos[k].s === 'feito') })");
        t('mudar respostas: o passo a passo é refeito (sem CIOT, contrato nem seguro) e o que já foi feito continua marcado', JSON.stringify(novo.ids) === JSON.stringify(['numeracao', 'pessoas', 'veiculos', 'cte', 'mdfe', 'depois']) && novo.feitos.includes('cte') && novo.idx <= 5, JSON.stringify(novo));

        // ═════════ recomeçar ═════════
        await clicar('#btnRecomecar'); await L.sleep(250);
        t('recomeçar: pede confirmação avisando que apaga progresso e conversa', await ev("!!document.querySelector('dialog[open]') && /Recomeçar do zero/.test(document.querySelector('dialog[open]').textContent)"));
        await clicarTexto('dialog[open] button', 'Cancelar'); await L.sleep(200);
        t('recomeçar: "Cancelar" não apaga nada', !!(await ev('Mig.atual')) && !(await ev("document.getElementById('telaPassos').hidden")));
        await clicar('#btnRecomecar'); await L.sleep(200); await clicarTexto('dialog[open] button', 'Recomeçar'); await L.sleep(300);
        t('recomeçar: apaga o cliente e volta às perguntas com as respostas padrão', (await ev('Mig.atual')) === null && await ev("!document.getElementById('telaInicio').hidden && document.getElementById('telaPassos').hidden && document.getElementById('btnRecomecar').hidden && document.querySelector('input[name=perf_trilha]:checked').value === 'migracao'"));
        await L.sleep(600);
        t('recomeçar: nada sobra guardado no navegador', (await ev("JSON.parse(localStorage.getItem('bsoft_migracao_v1') || '{\"clientes\":[]}').clientes.length")) === 0);

        // ═════════ empresa nova ═════════
        await clicar('input[name=perf_trilha][value=nova]'); await L.sleep(100);
        await clicar('.mig-form button[type=submit]'); await L.sleep(250);
        const nova = await ev("({ ids: Mig.rot.passos.map(p => p.id), titulo: document.querySelector('#passoCard h2').textContent, resumo: document.querySelector('.mig-passo-resumo2').textContent })");
        t('empresa nova: começa explicando os documentos ("Entenda em 2 minutos") e não tem o passo de numeração', nova.ids[0] === 'entender' && !nova.ids.includes('numeracao') && /Entenda/.test(nova.titulo) && /CT-e/.test(await ev("document.getElementById('passoCard').textContent")), JSON.stringify(nova.ids));
        await print('09-empresa-nova');

        // ═════════ armazenamento do navegador corrompido ou malicioso ═════════
        erros.length = 0;
        // o conteúdo é colocado no navegador ANTES de a página abrir (senão a página, ao sair, gravaria por cima o que ela tinha na memória)
        const semear = async (conteudo) => {
            await L.navegar(c, 'about:blank');
            await c.send('Storage.clearDataForOrigin', { origin: new URL(URL_PG).origin, storageTypes: 'local_storage' });
            const { identifier } = await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { if (location.origin === ${JSON.stringify(new URL(URL_PG).origin)}) localStorage.setItem('bsoft_migracao_v1', ${JSON.stringify(conteudo)}); } catch (e) {}` });
            await carregar(URL_PG, false);
            await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
        };
        await semear(JSON.stringify({ versao: 1, atual: 'cmalicioso1', clientes: [
            { id: 'cmalicioso1', nome: '<img src=x onerror=window.__xss=9>', perfil: { trilha: 'migracao', docs: ['cte', '<script>', 'xyz'], seguro: 'hack', numeracao: { cteSerie: '9<b>', cteNumero: '12abc34', mdfeSerie: '', mdfeNumero: '' } }, passoIdx: 999,
              passos: { cte: { s: 'feito' }, passoQueNaoExiste: { s: 'feito' }, pessoas: { s: 'invasor' } },
              mentor: [{ papel: 'ia', texto: 'Oi <img src=x onerror=window.__xss=7> **ok**', fontes: [{ chave: 'banco:999999', titulo: '<b>x</b>' }] }, { papel: 'hacker', texto: 'não deve entrar' }, 'lixo'] },
            'texto solto', null, 42 ] }));
        const mal = await ev("({ xss: window.__xss === undefined, imgs: document.querySelectorAll('#colunaChat img').length, perfil: Mig.atual && Mig.atual.perfil, idx: Mig.atual && Mig.atual.passoIdx, passos: Mig.atual && Object.keys(Mig.atual.passos), msgs: Mig.atual && Mig.atual.mentor.length, chip: [...document.querySelectorAll('#colunaChat .mig-fontes-chips .mig-chip')].map(b => b.textContent), campos: Mig.atual && Object.keys(Mig.atual) })");
        t('armazenamento malicioso: a página abre sem erro e nada executa', mal.xss && mal.imgs === 0 && erros.length === 0, erros.join(' | '));
        t('armazenamento malicioso: só valores permitidos (documentos, seguro, números) e passo dentro do limite', JSON.stringify(mal.perfil.docs) === JSON.stringify(['cte']) && mal.perfil.seguro === 'configurado' && mal.perfil.numeracao.cteSerie === '9' && mal.perfil.numeracao.cteNumero === '1234' && mal.idx <= 8, JSON.stringify(mal));
        t('armazenamento malicioso: passos desconhecidos, status inventado, mensagens com papel inventado e o campo "nome" são descartados', JSON.stringify(mal.passos) === JSON.stringify(['cte']) && mal.msgs === 1 && !mal.campos.includes('nome'), JSON.stringify(mal));
        t('armazenamento malicioso: a fonte citada com HTML aparece como texto', mal.chip.length === 1 && /<b>x<\/b>/.test(mal.chip[0]));
        await semear('{isso nao e json');
        t('armazenamento ilegível: abre nas perguntas, sem erro', await ev("!document.getElementById('telaInicio').hidden && Mig.atual === null") && erros.length === 0, erros.join(' | '));

        // ═════════ celular ═════════
        await carregar(URL_PG, true);
        await c.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
        await L.sleep(250);
        let larg = await ev('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })');
        t('celular 375 px: as perguntas não rolam para o lado', larg.sw <= larg.iw + 1, JSON.stringify(larg));
        await print('m-01-perguntas');
        await clicar('.mig-form button[type=submit]'); await L.sleep(300);
        larg = await ev('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })');
        t('celular 375 px: o passo a passo não rola para o lado', larg.sw <= larg.iw + 1, JSON.stringify(larg));
        t('celular: o chat sai da coluna e vira um botão flutuante "Perguntar à IA"', await ev("getComputedStyle(document.getElementById('colunaChat')).display === 'none' && getComputedStyle(document.getElementById('btnChatCelular')).display !== 'none'"));
        await print('m-02-passo');
        await clicar('#btnChatCelular'); await L.sleep(250);
        const ov = await ev("(() => { const e = document.getElementById('colunaChat'), s = getComputedStyle(e), r = e.getBoundingClientRect(); return { disp: s.display, pos: s.position, w: Math.round(r.width), h: Math.round(r.height), exp: document.getElementById('btnChatCelular').getAttribute('aria-expanded') }; })()");
        t('celular: tocar no botão abre o chat em tela cheia', ov.disp === 'flex' && ov.pos === 'fixed' && ov.w >= 370 && ov.h >= 800 && ov.exp === 'true', JSON.stringify(ov));
        await print('m-03-chat');
        t('celular: o chat em tela cheia não mostra "null" nem "undefined"', await semLixo('#colunaChat'));
        await ev("document.querySelector('.mig-so-celular').click(); true"); await L.sleep(200);
        t('celular: o ✕ fecha o chat', await ev("getComputedStyle(document.getElementById('colunaChat')).display === 'none'"));
        await ev('Mig.irPasso(8); true'); await L.sleep(250);
        larg = await ev('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })');
        t('celular 375 px: o passo de prazos (com a calculadora) não rola para o lado', larg.sw <= larg.iw + 1, JSON.stringify(larg));
        await c.send('Emulation.clearDeviceMetricsOverride');
        t('erros de JavaScript durante todo o teste', erros.length === 0, erros.join(' | '));

        // ═════════ sem o banco de dados (o endereço do Supabase bloqueado) ═════════
        await c.send('Network.setBlockedURLs', { urls: ['*supabase.co*', '*youtube-nocookie.com*', '*youtube.com*'] });
        erros.length = 0;
        await carregar(URL_PG, false);
        t('sem o banco: a página abre e o passo a passo funciona', (await ev("Mig.dados.estado")) === 'erro' && (await ev("Mig.rot.passos.length")) >= 5 && await ev("!document.getElementById('telaPassos').hidden && document.querySelectorAll('#passoCard .mig-sec').length >= 3"), await ev('Mig.dados.estado'));
        await ev('Mig.irPasso(0); true'); await L.sleep(100);
        await clicarTexto('#passoCard .mig-chips .mig-chip', 'Rejeição 539'); await L.sleep(500); await ocioso();
        const sb = await ultimoPrompt();
        t('sem o banco: o botão de erro comum não abre artigo — vai direto para a IA no modo erro, que é avisada de que nenhum artigo combinou', !(await ev("!!document.querySelector('dialog[open]')")) && /DEU ERRO/.test(sb.usuario) && /nenhum artigo da base combinou/.test(sb.usuario), sb.usuario.slice(-200));
        t('sem o banco: prazos e calculadora continuam funcionando', await ev("(Mig.irPasso(8), true)") && (await ev("document.querySelectorAll('.mig-regras-mini .mig-detalhes').length")) === 4 && (await ev("document.querySelectorAll('.mig-prazo').length")) >= 1);
        t('sem o banco: só o erro de carga do banco aparece no console (nenhuma outra exceção)', erros.every(e => /\[migração\] BancoDados/.test(e) || /Failed to load|ERR_BLOCKED/.test(e)), erros.join(' | '));
        await c.send('Network.setBlockedURLs', { urls: [] });
    } catch (e) {
        falhas.push('exceção no teste: ' + (e && e.stack || e).toString().slice(0, 600));
    } finally {
        try { c.fechar(); } catch (e) { /* ok */ }
        // encerra SÓ o Edge de teste (o processo que este script abriu e os filhos dele) — nunca o Edge da pessoa
        try { require('child_process').execSync('taskkill /PID ' + edge.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) { try { edge.kill(); } catch (e2) { /* ok */ } }
    }
    console.log('\n' + ok + ' verificações ok · ' + falhas.length + ' falha(s)' + (visual ? ' · prints em ' + pastaPrints : ''));
    falhas.forEach(f => console.log('  ✘ ' + f));
    process.exit(falhas.length ? 1 : 0);
})();
