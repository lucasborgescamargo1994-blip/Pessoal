'use strict';
/* teste-simulador-local.js — testa a página simuladorlocal.html no Edge de verdade (via CDP) com uma biblioteca de IA DE MENTIRA no lugar do wllama (gancho window.IALOCAL_BIBLIOTECA):
   nada é baixado e nenhum modelo roda — o que se testa é o resto: o painel "IA local" (estados, barra, escolher/apagar modelo, carga automática do que já está guardado, erro e tentar de novo,
   navegador sem suporte), a fila do motor (cancela o que ficou para trás, limite de tempo, "ainda não pronta"), o fluxo do treino inteiro (abertura, conversa, dica em 3 níveis, "Já orientei tudo",
   resolução por regra) e a GARANTIA de que nada é gravado no banco (o banco é lido de verdade, só leitura). Também confere que o simulador original (simulador.html) continua igual.
   Rode (com o servidor do projeto em http://localhost:8080 — tools\servidor-local.bat — ou BSOFT_URL_BASE):
     $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-simulador-local.js | Out-String
   --verbose mostra cada verificação · --visual salva prints em %TEMP%\simlocal-prints */
const fs = require('fs'), path = require('path'), os = require('os');
const L = require('./lib-cdp.js');
const BASE = (process.env.BSOFT_URL_BASE || 'http://localhost:8080').replace(/\/+$/, '');
const verboso = process.argv.includes('--verbose'), visual = process.argv.includes('--visual');
const PORTA = 9557, pastaPrints = path.join(os.tmpdir(), 'simlocal-prints');
let ok = 0; const falhas = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 300) : '')); if (verboso) console.log((cond ? '  ✔ ' : '  ✘ ') + nome + (!cond && detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 200) : '')); };

// Se sobrou um Edge de TESTE desta porta (rodada interrompida), fecha só ele pelo protocolo de depuração (nunca encerra o Edge da pessoa).
async function fecharAntigo(porta) {
    try { const v = await (await fetch('http://127.0.0.1:' + porta + '/json/version')).json(); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await L.sleep(1800); } catch (e) { /* não havia */ }
}

// A biblioteca de mentira (roda dentro da página, ANTES de qualquer script dela). Imita a API do wllama que o modelo.js usa.
const FAKE = `(() => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const F = window.__fake = { cache: [], chamadas: [], carga: null, falhaCarga: null, removidos: [], saidas: 0, instancias: 0, atraso: 15, passos: 4, travar: false, atrasoToken: 0, resp: 'Estou com dificuldade nisso aqui no sistema.' };
    window.IALOCAL_BIBLIOTECA = { Wllama: class {
        constructor(paths, cfg) { F.instancias++; this.paths = paths; this.modelManager = { getModels: async () => F.cache.map(u => ({ url: u, remove: async () => { F.cache = F.cache.filter(x => x !== u); F.removidos.push(u); } })) }; }
        async loadModelFromUrl(url, params) {
            F.carga = { url, params: Object.assign({}, params, { progressCallback: undefined }) };
            if (!F.cache.includes(url)) { for (let i = 1; i <= F.passos; i++) { await sleep(F.atraso); params.progressCallback({ loaded: 1000 * i / F.passos, total: 1000 }); } }
            else params.progressCallback({ loaded: 1000, total: 1000 });
            await sleep(F.atraso);
            if (F.falhaCarga) { const e = F.falhaCarga; F.falhaCarga = null; throw new Error(e); }
            if (!F.cache.includes(url)) F.cache.push(url);
        }
        async exit() { F.saidas++; }
        async createChatCompletion(o) {
            F.chamadas.push({ messages: o.messages, max_tokens: o.max_tokens, temperature: o.temperature, stream: o.stream, cache_prompt: o.cache_prompt, return_progress: o.return_progress });
            const texto = typeof F.resp === 'function' ? F.resp(o.messages, F.chamadas.length) : F.resp;
            const aborta = () => { const e = new Error('Operation aborted'); e.name = 'WllamaAbortError'; return e; };
            return (async function* () {
                if (o.return_progress) yield { choices: [{ delta: {}, finish_reason: null }], prompt_progress: { total: 100, cache: 60, processed: 20, time_ms: 5 } };
                while (F.travar) { await sleep(10); if (o.abortSignal && o.abortSignal.aborted) throw aborta(); }
                for (const parte of texto.match(/\\S+\\s*/g) || []) { await sleep(F.atrasoToken); if (o.abortSignal && o.abortSignal.aborted) throw aborta(); yield { choices: [{ delta: { content: parte }, finish_reason: null }] }; }
                yield { choices: [{ delta: {}, finish_reason: 'stop' }], timings: { prompt_per_second: 3.5, predicted_per_second: 2.1, prompt_n: 30, cache_n: 200, predicted_n: 12 } };
            })();
        }
    } };
    window.__fases = [];
})();`;
// Servidor estático de TESTE com os cabeçalhos que "isolam" a página (COOP + COEP): é o que libera várias threads para a IA local. Porta 8083.
function servirIsolado() {
    const http = require('http'), raiz = path.resolve(__dirname, '..', '..');
    const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
    return new Promise((res, rej) => {
        const s = http.createServer((req, resp) => {
            const f = path.resolve(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
            if (!f.startsWith(raiz)) { resp.writeHead(403); return resp.end('403'); }
            fs.readFile(f, (e, b) => {
                if (e) { resp.writeHead(404); return resp.end('404'); }
                resp.writeHead(200, { 'Content-Type': tipos[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' }); resp.end(b);
            });
        });
        s.on('error', rej); s.listen(8083, '127.0.0.1', () => res({ base: 'http://localhost:8083', fechar: () => s.close() }));
    });
}
const ESCUTA_FASES =`(() => { ModeloLocal.aoMudar(e => window.__fases.push(e.fase)); return true; })()`;

(async () => {
    await fecharAntigo(PORTA);
    const edge = await L.lancar({ porta: PORTA, gpu: false, w: 1280, h: 900, args: ['--headless=new', '--force-prefers-no-reduced-motion'] });
    const c = await L.abrirPagina(PORTA);
    const ev = js => c.eval(js);
    const esperar = async (cond, ms = 15000, passo = 100) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda carregando */ } await L.sleep(passo); } return false; };
    const erros = [], escritas = [];
    c.on('Runtime.exceptionThrown', p => erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).slice(0, 240)));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') erros.push('console.error: ' + p.args.map(a => a.value || a.description || '').join(' ').slice(0, 240)); });
    c.on('Network.requestWillBeSent', p => { const m = p.request.method; if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && /supabase\.co/.test(p.request.url)) escritas.push(m + ' ' + p.request.url); });
    async function print(nome) { if (!visual) return; fs.mkdirSync(pastaPrints, { recursive: true }); const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(pastaPrints, nome + '.png'), Buffer.from(r.data, 'base64')); }
    let scriptId = null;
    // abre a página com o que o teste quer ANTES dos scripts dela (a biblioteca de mentira, o que já está "guardado", o que o navegador "suporta")
    const abrir = async (url, extra, base) => {
        base = base || BASE;
        if (scriptId) { try { await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId }); } catch (e) { /* ok */ } }
        await L.navegar(c, 'about:blank'); await c.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'local_storage' });
        scriptId = (await c.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE + (extra || '') })).identifier;
        await L.navegar(c, base + '/' + url);
        await esperar("typeof ModeloLocal !== 'undefined' && !!window.SimMotorIA && !!document.getElementById('slPreparar')", 20000);
        await ev(ESCUTA_FASES);
    };
    const nome = async () => { await esperar("!document.getElementById('modalNome').hidden", 10000); await ev("(() => { document.getElementById('inpNome').value = 'Maria da Silva Souza'; document.getElementById('formNome').requestSubmit(); return true; })()"); await esperar("document.getElementById('modalNome').hidden", 8000); };
    const txt = sel => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
    const clicar = sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const falasDoCliente = () => ev("[...document.querySelectorAll('#mensagens .sim-msg.cliente:not(.digitando) .txt')].map(x => x.textContent)");
    const sistema = () => ev("[...document.querySelectorAll('#mensagens .sim-msg.sistema .txt, #mensagens .sim-msg.dica .txt')].map(x => x.textContent)");
    const ocioso = () => esperar("!document.getElementById('digitando') && !Simulador.S.ocupado", 20000);
    const dizer = async texto => { await ev(`(() => { document.getElementById('txtSuporte').value = ${JSON.stringify(texto)}; document.getElementById('formEnvio').requestSubmit(); return true; })()`); await L.sleep(120); await ocioso(); };
    const chamadas = () => ev('window.__fake.chamadas.length');

    try {
        await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');

        // ═════════ 1) abertura: a IA ainda não está pronta ═════════
        await abrir('simuladorlocal.html');
        t('página: título e endereço (o "?teste=1" é forçado)', /IA local/.test(await ev('document.title')) && /[?&]teste=1/.test(await ev('location.search')), await ev('document.title + location.search'));
        t('página: o gancho da IA local existe e o MCP NÃO foi carregado', await ev("typeof window.SimMotorIA === 'object' && typeof mcpMontarCadeia === 'undefined' && typeof MCP_CFG === 'undefined'"));
        await nome();
        t('abertura: o treino e as provas ficam travados (inert) até a IA estar pronta', await ev("document.getElementById('blocoTreino').inert === true && document.getElementById('blocoProvas').inert === true && document.getElementById('telaInicio').classList.contains('sl-aguarda') && !document.getElementById('slAviso').hidden"));
        t('abertura: o selo do topo diz que a IA ainda não foi preparada', /ainda não preparada/.test(await txt('#simIA')), await txt('#simIA'));
        t('abertura: o modelo padrão é o Llama 3.2 1B e o botão mostra o tamanho do download', (await ev("document.getElementById('slModelo').value")) === 'llama' && /770 MB/.test(await txt('#slPreparar')), await txt('#slPreparar'));
        t('abertura: dois modelos para escolher', JSON.stringify(await ev("[...document.querySelectorAll('#slModelo option')].map(o => o.value)")) === '["llama","qwen"]');
        t('abertura: mostra o computador (processadores) e que roda em 1 núcleo', /processadores lógicos/.test(await txt('#slCompat')) && /1 núcleo/.test(await txt('#slCompat')), await txt('#slCompat'));
        t('abertura: nada foi baixado nem carregado sozinho (ninguém clicou)', (await ev('window.__fake.carga === null')) && (await ev('window.__fake.chamadas.length')) === 0);
        t('abertura: os casos do banco carregaram (leitura)', await esperar("/casos disponíveis/.test(document.getElementById('statusBanco').textContent)", 20000), await txt('#statusBanco'));
        await print('01-nao-pronta');
        t('abertura: sem erro de JavaScript', erros.length === 0, erros.join(' | '));

        // ═════════ 2) baixar e preparar ═════════
        await ev('window.__fake.atraso = 150; true');         // (devagar de propósito: o teste precisa ENXERGAR a barra e os percentuais, que numa carga instantânea passam em milissegundos)
        await clicar('#slPreparar');
        t('baixar: a barra aparece e o botão mostra "Baixando…"', await esperar("!document.getElementById('slBarra').hidden && /Baixando/.test(document.getElementById('slPreparar').textContent)", 5000), await txt('#slPreparar'));
        t('baixar: o texto mostra o andamento em % e em MB', await esperar("/Baixando o modelo… .* \\(\\d+%\\)/.test(document.getElementById('slStatus').textContent) || /Colocando o modelo/.test(document.getElementById('slStatus').textContent)", 5000), await txt('#slStatus'));
        t('baixar: chega em "pronto" passando por baixando e carregando', await esperar("ModeloLocal.estado().fase === 'pronto'", 10000) && JSON.stringify(await ev('window.__fases')).includes('"baixando"') && JSON.stringify(await ev('window.__fases')).includes('"carregando"'), JSON.stringify(await ev('window.__fases')));
        const carga = await ev('window.__fake.carga');
        t('baixar: pede o arquivo GGUF certo, só em CPU, 1 sequência e contexto de 2048', carga && /Llama-3\.2-1B-Instruct-Q4_K_M\.gguf$/.test(carga.url) && carga.params.n_gpu_layers === 0 && carga.params.n_parallel === 1 && carga.params.n_ctx === 2048 && carga.params.n_threads === undefined, JSON.stringify(carga));
        t('pronto: o treino destrava, a barra some e o selo mostra o modelo', await ev("document.getElementById('blocoTreino').inert === false && document.getElementById('slBarra').hidden && !document.getElementById('telaInicio').classList.contains('sl-aguarda') && document.getElementById('slAviso').hidden") && /Llama 3\.2 · 1B · neste computador/.test(await txt('#simIA')), await txt('#simIA'));
        t('pronto: o botão vira "Pronta" (desligado) e aparece "Apagar"', /Pronta/.test(await txt('#slPreparar')) && (await ev("document.getElementById('slPreparar').disabled")) && (await ev("!document.getElementById('slApagar').hidden")));
        t('pronto: lembra a escolha do modelo neste navegador', (await ev("localStorage.getItem('bsoft_simlocal_modelo')")) === 'llama');
        await ev('window.__fake.atraso = 15; true');
        await esperar('window.__fake.chamadas.length >= 1', 5000);
        const aq = await ev('window.__fake.chamadas[0]');
        t('aquecimento: logo que fica pronta, lê o trecho FIXO do prompt (1 token, nada mais)', aq && aq.max_tokens === 1 && aq.messages[0].role === 'system' && (await ev('SimLocalRegras.sistema({ titulo: "qualquer" }, "normal").startsWith(window.__fake.chamadas[0].messages[0].content)')), JSON.stringify(aq && aq.max_tokens));
        await print('02-pronta');

        // ═════════ 3) o treino, do começo ao fim ═════════
        const CASO = 305;                                    // "Como obrigar ou desobrigar informações dentro do cadastro de veículos."
        const caso = await ev(`SimDados.buscarCaso(${CASO}).then(x => ({ titulo: x.titulo, conteudo: x.conteudo }))`);
        t('treino: o caso de teste existe no banco (somente leitura)', caso && caso.titulo && caso.conteudo && caso.conteudo.length > 100, JSON.stringify(caso).slice(0, 120));
        await ev(`window.__fake.resp = (msgs, n) => msgs.length <= 2 ? 'Oi, não consigo deixar um campo obrigatório no cadastro de veículo.' : 'Hum, não sei onde fica isso, pode me ajudar?'; true`);
        const antes = await chamadas();
        await ev(`Simulador.iniciarCaso(${CASO}); true`);
        t('treino: o cliente abre a conversa com a fala do modelo', await esperar("document.querySelectorAll('#mensagens .sim-msg.cliente:not(.digitando)').length === 1", 15000) && (await falasDoCliente())[0] === 'Oi, não consigo deixar um campo obrigatório no cadastro de veículo.', JSON.stringify(await falasDoCliente()));
        const cAbertura = await ev(`window.__fake.chamadas[${antes}]`);
        t('treino: o prompt da abertura leva o título e NÃO leva a solução; 1 chamada só', cAbertura && cAbertura.messages[0].content.includes(caso.titulo) && !cAbertura.messages.map(m => m.content).join('\n').includes(caso.conteudo.slice(0, 60)) && (await chamadas()) === antes + 1);
        t('treino: o pedido ao motor é curto (máx. 80 trechos), usa o cache do prompt e pede o andamento', cAbertura.max_tokens === 80 && cAbertura.cache_prompt === true && cAbertura.return_progress === true && cAbertura.stream === true, JSON.stringify(cAbertura));
        t('treino: o selo da IA e a dica de erro vêm da IA local (nada de MCP)', /Llama/.test(await txt('#simIA')) && /painel "IA local"/.test(await ev('SimMotorIA.dicaErro')));
        await print('03-abertura');
        // dica por regra: 3 níveis diferentes, sem chamar o modelo
        const n0 = await chamadas();
        const dicas = [];
        for (let i = 0; i < 3; i++) { await clicar('#btnDica'); await esperar(`[...document.querySelectorAll('#mensagens .sim-msg.dica .txt')].length === ${i + 1} && !/Pensando/.test([...document.querySelectorAll('#mensagens .sim-msg.dica .txt')].pop().textContent)`, 5000); dicas.push((await ev("[...document.querySelectorAll('#mensagens .sim-msg.dica .txt')].pop().textContent"))); await ocioso(); }
        t('dica: três cliques → três dicas diferentes, cada uma começando com "Dica:"', new Set(dicas).size === 3 && dicas.every(d => /^Dica:/.test(d)), JSON.stringify(dicas));
        t('dica: nenhuma chamou o modelo (é por regra, instantâneo)', (await chamadas()) === n0);
        // uma orientação genérica → o cliente (modelo) responde, não resolve
        await dizer('Reinicia o computador e tenta de novo.');
        t('conversa: orientação genérica → o cliente responde com a fala do modelo e o caso segue aberto', (await falasDoCliente()).length === 2 && !(await ev('Simulador.S.encerrado')), JSON.stringify(await falasDoCliente()));
        const cResp = await ev('window.__fake.chamadas[window.__fake.chamadas.length - 1]');
        t('conversa: o prompt do 2º turno ACRESCENTA ao do 1º (a abertura e a fala do cliente continuam iguais) e leva a fala do suporte sem rótulo', cResp.messages.length === 4 && cResp.messages[2].role === 'assistant' && cResp.messages[2].content === 'Oi, não consigo deixar um campo obrigatório no cadastro de veículo.' && /^Reinicia o computador/.test(cResp.messages[3].content), JSON.stringify(cResp.messages.map(m => m.role)));
        // "Já orientei tudo" com orientação insuficiente → regra, sem modelo, com o que falta
        await dizer('Vou verificar com a equipe e te retorno.');
        const n1 = await chamadas();
        t('"Já orientei tudo" aparece depois de duas falas do suporte', await ev('!document.getElementById("btnJaOrientei").hidden'));
        await clicar('#btnJaOrientei'); await esperar("[...document.querySelectorAll('#mensagens .sim-msg.sistema.aviso .txt')].length >= 1", 5000);
        const aviso = (await ev("[...document.querySelectorAll('#mensagens .sim-msg.sistema.aviso .txt')].pop().textContent"));
        t('"Já orientei tudo" com orientação fraca: "Ainda não é o suficiente" + o que falta, sem chamar o modelo', /Ainda não é o suficiente: ainda não apareceu na orientação: «/.test(aviso) && (await chamadas()) === n1, aviso);
        // a orientação certa (o começo da solução, como um atendente que sabe a resposta diria) → o cliente agradece SEM chamar o modelo
        const n2 = await chamadas();
        await dizer(caso.conteudo.slice(0, 500));
        t('resolução: orientação completa → o caso termina como "Resolvido" (tela de resultado)', await esperar("!document.getElementById('telaFim').hidden", 8000) && /Resolvido/.test(await txt('#fimStats')), await txt('#tituloFim'));
        t('resolução: a última fala do cliente é a frase combinada, e foi decidida por REGRA (o modelo não foi chamado nesse turno)', (await ev("Simulador.S.hist[Simulador.S.hist.length - 1].texto")) === 'Deu certinho, muito obrigado pelo auxílio' && (await chamadas()) === n2);
        await print('04-resolvido');
        // nada gravado
        t('SEM GRAVAR: o treino tentou registrar a sessão e o banco bloqueou (somente leitura)', (await ev('window.BSOFT_SIM_BLOQUEIOS.join(",")')).includes('sim_sessoes.insert'), await ev('window.BSOFT_SIM_BLOQUEIOS.join(",")'));
        t('SEM GRAVAR: nenhuma requisição de escrita (POST/PATCH/PUT/DELETE) saiu para o Supabase', escritas.length === 0, escritas.join(' | '));
        t('treino inteiro sem erro de JavaScript', erros.length === 0, erros.join(' | '));

        // ═════════ 4) o motor: fila, cancelamento, limite de tempo, "não pronta" ═════════
        const msgs = [{ role: 'user', content: 'oi' }];
        await ev('window.__fake.travar = true; window.__p1 = ModeloLocal.gerar([{ role: "user", content: "um" }]).then(r => ({ ok: r.text }), e => ({ erro: e.message, cancelada: !!e.cancelada })); true');
        await L.sleep(120);
        await ev('window.__p2 = ModeloLocal.gerar([{ role: "user", content: "dois" }]).then(r => ({ ok: r.text }), e => ({ erro: e.message })); true');
        const r1 = await ev('window.__p1');
        t('motor: um pedido novo CANCELA o que ficou para trás (a conversa já seguiu)', r1 && r1.cancelada === true && /cancelada/.test(r1.erro), JSON.stringify(r1));
        await ev('window.__fake.travar = false; true');
        t('motor: …e o pedido novo termina normalmente depois', JSON.stringify(await ev('window.__p2')) === JSON.stringify({ ok: await ev('window.__fake.resp && typeof window.__fake.resp === "function" ? window.__fake.resp([], 0) : window.__fake.resp') }), JSON.stringify(await ev('window.__p2')));
        await ev('window.__fake.travar = true; true');
        const lim = await ev('ModeloLocal.gerar(' + JSON.stringify(msgs) + ', { limiteMs: 200 }).then(() => "terminou", e => e.message)');
        t('motor: passou do limite de tempo → erro "TIMEOUT" claro (e o pedido é abortado)', /^TIMEOUT: a IA local demorou mais de/.test(lim), lim);
        await ev('window.__fake.travar = false; true');
        t('motor: o progresso chega ao chamador ("lendo" com % e "escrevendo" com a contagem)', await ev(`ModeloLocal.gerar(${JSON.stringify(msgs)}, { aoProgresso: p => { (window.__prog = window.__prog || []).push(p.fase); } }).then(() => window.__prog.includes('lendo') && window.__prog.includes('escrevendo'))`));
        t('motor: a última velocidade medida (ler/escrever por segundo) fica no estado', JSON.stringify(await ev('ModeloLocal.estado().ultima')).includes('"lerTps":3.5') && JSON.stringify(await ev('ModeloLocal.estado().ultima')).includes('"escreverTps":2.1'));

        // ═════════ 5) falha ao carregar → erro → tentar de novo ═════════
        await abrir('simuladorlocal.html', 'window.__fake.falhaCarga = "Failed to fetch";');
        await nome();
        await clicar('#slPreparar');
        t('erro ao carregar: o painel mostra o problema com uma explicação (rede/Hugging Face)', await esperar("ModeloLocal.estado().fase === 'erro'", 8000) && /Não consegui baixar o modelo/.test(await txt('#slStatus')), await txt('#slStatus'));
        t('erro: o selo avisa, o treino continua travado e dá para tentar de novo', /problema/.test(await txt('#simIA')) && (await ev("document.getElementById('blocoTreino').inert")) && !(await ev("document.getElementById('slPreparar').disabled")));
        t('erro ao carregar: o problema foi registrado no console (para quem for investigar)', erros.some(e => e.includes('[IA local] preparar')), erros.join(' | ')); erros.length = 0;      // (esse erro é de propósito)
        await print('05-erro');
        await clicar('#slPreparar');
        t('tentar de novo: na 2ª vez carrega e fica pronta', await esperar("ModeloLocal.estado().fase === 'pronto'", 8000));

        // ═════════ 6) já guardado → carrega sozinho; trocar de modelo; apagar ═════════
        const URL_LLAMA = await ev('ModeloLocal.MODELOS.llama.url'), URL_QWEN = await ev('ModeloLocal.MODELOS.qwen.url');
        await abrir('simuladorlocal.html', `window.__fake.cache = [${JSON.stringify(URL_LLAMA)}];`);
        await nome();
        t('já guardado: abre e carrega SOZINHO, sem clicar (a carga termina e o aquecimento roda)', await esperar("ModeloLocal.estado().fase === 'pronto'", 8000) && (await esperar('window.__fake.chamadas.length >= 1', 5000)), JSON.stringify(await ev('window.__fases')));
        t('já guardado: o painel não oferece baixar de novo (botão "Pronta")', /Pronta/.test(await txt('#slPreparar')));
        await ev(`(() => { const s = document.getElementById('slModelo'); s.value = 'qwen'; s.dispatchEvent(new Event('change')); return true; })()`);
        t('trocar para o Qwen: o botão mostra o download de 469 MB e a licença do modelo', /469 MB/.test(await txt('#slPreparar')) && /Apache-2\.0/.test(await txt('#slLicenca')), await txt('#slPreparar') + ' | ' + await txt('#slLicenca'));
        await clicar('#slPreparar');
        t('trocar para o Qwen: descarrega o Llama e carrega o Qwen (arquivo certo)', await esperar("ModeloLocal.estado().fase === 'pronto' && ModeloLocal.estado().chave === 'qwen'", 8000) && /qwen2\.5-0\.5b-instruct-q4_k_m\.gguf$/.test((await ev('window.__fake.carga')).url) && (await ev('window.__fake.saidas')) >= 1);
        t('trocar para o Qwen: o selo e a escolha lembrada passam a ser do Qwen', /Qwen 2\.5/.test(await txt('#simIA')) && (await ev("localStorage.getItem('bsoft_simlocal_modelo')")) === 'qwen');
        await ev(`(() => { const s = document.getElementById('slModelo'); s.value = 'llama'; s.dispatchEvent(new Event('change')); return true; })()`);
        t('voltar para o Llama (já guardado): o botão oferece "Carregar a IA"', /Carregar a IA/.test(await txt('#slPreparar')), await txt('#slPreparar'));
        await ev('window.confirm = () => true; true');
        await clicar('#slApagar');
        t('apagar: remove o modelo guardado e o painel volta a oferecer o download', await esperar("window.__fake.removidos.length === 1 && /Baixar/.test(document.getElementById('slPreparar').textContent)", 8000) && (await ev('window.__fake.removidos[0]')) === URL_LLAMA, JSON.stringify(await ev('window.__fake.removidos')) + ' ' + await txt('#slPreparar'));

        // ═════════ 7) navegador sem suporte ═════════
        await abrir('simuladorlocal.html', 'WebAssembly.validate = () => false;');
        await nome();
        t('sem suporte (sem WebAssembly SIMD): avisa o motivo, desliga o botão e mantém o treino travado', /não consegue rodar a IA local/.test(await txt('#slCompat')) && /SIMD/.test(await txt('#slCompat')) && (await ev("document.getElementById('slPreparar').disabled && document.getElementById('blocoTreino').inert")), await txt('#slCompat'));
        t('sem suporte: pedir para preparar mesmo assim dá erro claro (e não baixa nada)', await ev('ModeloLocal.preparar("llama").then(() => "ok", e => e.message)').then(x => /não consegue rodar a IA local/.test(x)) && (await ev('window.__fake.carga === null')));
        t('sem suporte: gerar antes de estar pronta dá o aviso combinado', (await ev('ModeloLocal.gerar([{ role: "user", content: "oi" }]).then(() => "ok", e => e.message)')) === (await ev('ModeloLocal.FALTA_PRONTO')));

        // ═════════ 8) resposta ruim do modelo → tenta de novo, depois usa a fala reserva ═════════
        await abrir('simuladorlocal.html', 'window.__fake.cache = [' + JSON.stringify(URL_LLAMA) + '];');
        await nome();
        await esperar("ModeloLocal.estado().fase === 'pronto'", 8000);
        await ev(`window.__fake.resp = '我无法发送这个文件'; true`);
        const n3 = await chamadas();
        await ev(`Simulador.iniciarCaso(${CASO}); true`);
        t('modelo escreveu em outra língua: tenta 2 vezes e usa a fala reserva (o treino não trava)', await esperar("document.querySelectorAll('#mensagens .sim-msg.cliente:not(.digitando)').length === 1", 15000) && /^Oi, preciso de ajuda: /.test((await falasDoCliente())[0]) && (await chamadas()) === n3 + 2, JSON.stringify(await falasDoCliente()) + ' chamadas ' + ((await chamadas()) - n3));
        await ev(`window.__fake.resp = 'Desculpe, mas não posso atender a esse pedido.'; true`);
        await dizer('Me conta o que aparece na tela.');
        t('modelo RECUSOU o papel: a recusa nunca aparece como fala do cliente', !(await falasDoCliente()).some(x => /não posso atender/.test(x)), JSON.stringify(await falasDoCliente()));
        t('erros e escritas: nada ao longo de todas as páginas', erros.length === 0 && escritas.length === 0, erros.concat(escritas).join(' | '));

        // ═════════ 8b) página "isolada" (COOP/COEP) → vários núcleos ═════════
        const iso = await servirIsolado();
        await abrir('simuladorlocal.html', '', iso.base);
        await nome();
        t('isolada: o navegador libera o multi-núcleo (crossOriginIsolated) e o painel diz isso', (await ev('crossOriginIsolated')) === true && /vários núcleos liberados/.test(await txt('#slCompat')), await txt('#slCompat'));
        await clicar('#slPreparar');
        await esperar("ModeloLocal.estado().fase === 'pronto'", 8000);
        const nuc = Math.min(4, await ev('navigator.hardwareConcurrency'));
        t('isolada: pede ao motor várias threads (até 4) e mostra o número de núcleos', (await ev('window.__fake.carga')).params.n_threads === nuc && new RegExp(nuc + ' núcleos').test(await txt('#slStatus')) || nuc === 1, JSON.stringify((await ev('window.__fake.carga')).params) + ' | ' + await txt('#slStatus'));
        t('isolada: a página inteira carrega sem erro de JavaScript (Supabase, fontes e IA com COEP)', erros.length === 0 && (await esperar("/casos disponíveis/.test(document.getElementById('statusBanco').textContent)", 20000)), erros.join(' | ') + ' ' + await txt('#statusBanco'));
        iso.fechar();

        // ═════════ 9) o simulador ORIGINAL continua igual ═════════
        await L.navegar(c, 'about:blank'); await c.send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'local_storage' });
        if (scriptId) { await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId }); scriptId = null; }
        await L.navegar(c, BASE + '/simulador.html');
        await esperar("typeof Simulador !== 'undefined' && typeof mcpMontarCadeia === 'function'", 20000);
        t('simulador original: sem o gancho da IA local (usa os modelos do MCP como sempre)', await ev("typeof window.SimMotorIA === 'undefined' && typeof mcpMontarCadeia === 'function' && typeof SimLocalRegras === 'undefined'"));
        t('simulador original: o selo mostra o modelo do MCP (🤖), não a IA local', /🤖/.test(await txt('#simIA')) && !/IA local/.test(await txt('#simIA')), await txt('#simIA'));
        t('simulador original: os textos do SimLogica são os de sempre (prompt longo com a solução e o formato [ESTADO])', await ev("SimLogica.montarMensagens({ titulo: 'Dúvida X', conteudo: 'Solução Y' }, 'normal', [], '')[0].content.includes('Solução Y') && SimLogica.montarMensagens({ titulo: 'a', conteudo: 'b' }, 'normal', [], '')[0].content.includes('[ESTADO: CONTINUA]')"));
        t('simulador original: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
    } catch (e) {
        falhas.push('o teste parou por um erro inesperado: ' + (e && e.stack || e));
    }

    console.log('\n' + ok + ' verificações ok · ' + falhas.length + ' falha(s)');
    falhas.forEach(f => console.log('  ✘ ' + f));
    try { await c.send('Browser.close'); } catch (e) { /* ok */ }
    await L.sleep(500);
    try { process.kill(edge.pid); } catch (e) { /* já fechou */ }
    process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('erro no teste:', e); process.exit(2); });
