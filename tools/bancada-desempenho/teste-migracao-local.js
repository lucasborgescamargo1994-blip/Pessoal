'use strict';
/* teste-migracao-local.js — testa a página migracaolocal.html (Primeira emissão guiada com IA LOCAL) no Edge de verdade (via CDP) com uma biblioteca de IA DE MENTIRA no lugar do wllama
   (gancho window.IALOCAL_BIBLIOTECA): nada é baixado e nenhum modelo roda. O banco é lido de verdade (somente leitura). Confere:
     • o painel (estados, barra, escolher/apagar modelo, carga automática do que já está guardado, erro + tentar de novo, navegador sem suporte, placa de vídeo experimental com volta ao processador);
     • o chat SEM o modelo (responde direto do banco) e as respostas que NUNCA passam pelo modelo (prazo = a regra, “o que é”, “é com o Suporte”, “não encontrei”, erro que não consta);
     • o chat COM o modelo: o prompt curto que ele recebe, o que a bolha “digitando” mostra (andamento, texto parcial, fontes), as travas na resposta, o modo erro, cancelar, o orçamento de texto que
       cresce com a velocidade medida, e a falha da IA (“Tentar de novo”);
     • que a migracao.html ORIGINAL continua igual (o gancho só existe na migracaolocal.html) e que nada é gravado.
   Rode (servidor do projeto em http://localhost:8080 — tools\servidor-local.bat — ou BSOFT_URL_BASE):
     $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-migracao-local.js | Out-String
   --verbose mostra cada verificação · --visual salva prints em %TEMP%\migloc-prints */
const fs = require('fs'), path = require('path'), os = require('os');
const L = require('./lib-cdp.js');
const BASE = (process.env.BSOFT_URL_BASE || 'http://localhost:8080').replace(/\/+$/, '');
const verboso = process.argv.includes('--verbose'), visual = process.argv.includes('--visual');
const PORTA = 9559, pastaPrints = path.join(os.tmpdir(), 'migloc-prints');
let ok = 0; const falhas = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 300) : '')); if (verboso) console.log((cond ? '  ✔ ' : '  ✘ ') + nome + (!cond && detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 200) : '')); };

async function fecharAntigo(porta) {
    try { const v = await (await fetch('http://127.0.0.1:' + porta + '/json/version')).json(); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await L.sleep(1800); } catch (e) { /* não havia */ }
}

// A biblioteca de mentira (roda dentro da página ANTES de qualquer script dela). Imita a API do wllama que js/ia-local/modelo.js usa.
const FAKE = `(() => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const F = window.__fake = { cache: [], chamadas: [], carga: null, cargas: [], falhaCarga: null, falhaGpu: false, falhaGerar: null, removidos: [], saidas: 0, atraso: 15, passos: 4, travar: false, atrasoToken: 0, abortados: 0, tps: { ler: 3.5, escrever: 2.1 },
        resp: 'Acesse Transporte > Conhecimentos e clique em Novo para emitir o CT-e. Informe o remetente, o destinatário e o valor do frete e depois clique em Transmitir.' };
    window.IALOCAL_BIBLIOTECA = { Wllama: class {
        constructor() { this.modelManager = { getModels: async () => F.cache.map(u => ({ url: u, remove: async () => { F.cache = F.cache.filter(x => x !== u); F.removidos.push(u); } })) }; }
        async loadModelFromUrl(url, params) {
            F.carga = { url, params: Object.assign({}, params, { progressCallback: undefined }) }; F.cargas.push(F.carga);
            if (!F.cache.includes(url)) { for (let i = 1; i <= F.passos; i++) { await sleep(F.atraso); params.progressCallback({ loaded: 1000 * i / F.passos, total: 1000 }); } } else params.progressCallback({ loaded: 1000, total: 1000 });
            await sleep(F.atraso);
            if (F.falhaGpu && params.n_gpu_layers === undefined) throw new Error('WebGPU: device lost');
            if (F.falhaCarga) { const e = F.falhaCarga; F.falhaCarga = null; throw new Error(e); }
            if (!F.cache.includes(url)) F.cache.push(url);
        }
        async exit() { F.saidas++; }
        async createChatCompletion(o) {
            F.chamadas.push({ messages: o.messages, max_tokens: o.max_tokens, temperature: o.temperature, stream: o.stream, cache_prompt: o.cache_prompt, return_progress: o.return_progress });
            if (F.falhaGerar) { const e = F.falhaGerar; F.falhaGerar = null; throw new Error(e); }
            const texto = typeof F.resp === 'function' ? F.resp(o.messages, F.chamadas.length) : F.resp;
            const aborta = () => { F.abortados++; const e = new Error('Operation aborted'); e.name = 'WllamaAbortError'; return e; };
            return (async function* () {
                if (o.return_progress) yield { choices: [{ delta: {}, finish_reason: null }], prompt_progress: { total: 100, cache: 60, processed: 20, time_ms: 5 } };
                while (F.travar) { await sleep(10); if (o.abortSignal && o.abortSignal.aborted) throw aborta(); }
                for (const parte of texto.match(/\\S+\\s*/g) || []) { await sleep(F.atrasoToken); if (o.abortSignal && o.abortSignal.aborted) throw aborta(); yield { choices: [{ delta: { content: parte }, finish_reason: null }] }; }
                yield { choices: [{ delta: {}, finish_reason: F.fim || 'stop' }], timings: { prompt_per_second: F.tps.ler, predicted_per_second: F.tps.escrever, prompt_n: 30, cache_n: 200, predicted_n: 12 } };
            })();
        }
    } };
    window.__fases = [];
})();`;
const ESCUTA_FASES = `(() => { ModeloLocal.aoMudar(e => window.__fases.push(e.fase)); return true; })()`;

(async () => {
    await fecharAntigo(PORTA);
    const edge = await L.lancar({ porta: PORTA, gpu: false, w: 1280, h: 900, args: ['--headless=new', '--force-prefers-no-reduced-motion'] });
    const c = await L.abrirPagina(PORTA), ev = js => c.eval(js);
    const esperar = async (cond, ms = 15000, passo = 100) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda carregando */ } await L.sleep(passo); } return false; };
    const erros = [], escritas = [];
    c.on('Runtime.exceptionThrown', p => erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).slice(0, 240)));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') erros.push('console.error: ' + p.args.map(a => a.value || a.description || '').join(' ').slice(0, 240)); });
    c.on('Network.requestWillBeSent', p => { const m = p.request.method; if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && /supabase\.co/.test(p.request.url)) escritas.push(m + ' ' + p.request.url); });
    async function print(nome) { if (!visual) return; fs.mkdirSync(pastaPrints, { recursive: true }); const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(pastaPrints, nome + '.png'), Buffer.from(r.data, 'base64')); }
    let scriptId = null;
    const abrir = async (url, extra) => {
        if (scriptId) { try { await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId }); } catch (e) { /* ok */ } scriptId = null; }
        await L.navegar(c, 'about:blank'); await c.send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'local_storage' });
        if (extra !== null) scriptId = (await c.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE + (extra || '') })).identifier;
        await L.navegar(c, BASE + '/' + url);
        await esperar("typeof Mig !== 'undefined' && Mig.dados.estado === 'pronto' && !!document.getElementById('mlPreparar')", 40000);
        if (extra !== null) await ev(ESCUTA_FASES);
    };
    const txt = sel => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
    const clicar = sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const chamadas = () => ev('window.__fake.chamadas.length');
    const PERFIL = { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: { cteSerie: '1', cteNumero: '1500', mdfeSerie: '1', mdfeNumero: '320' } };
    const cliente = async passo => { await ev(`Mig.novoCliente(${JSON.stringify(PERFIL)}); Mig.mostrarPassos(); Mig.irPasso(Mig.rot.passos.findIndex(p => p.id === ${JSON.stringify(passo)})); true`); await L.sleep(250); };
    // pergunta no chat (como a pessoa faz) e espera a resposta (ou o balão de erro); devolve a última mensagem da IA
    const perguntar = async (texto, erro) => {
        const n0 = await ev('Mig.atual.mentor.length');
        await ev(`Mig.chatEnviar(${JSON.stringify(texto)}, { modoErro: ${erro ? 'true' : 'false'} }); true`);
        await esperar(`(() => { const m = Mig.atual.mentor; return (m.length >= ${n0 + 2} && m[m.length - 1].papel === 'ia') || !!document.querySelector('.mig-msg.erro'); })()`, 45000, 80);
        return ev("(() => { const m = Mig.atual.mentor, u = m[m.length - 1]; return u && u.papel === 'ia' ? { texto: u.texto, modelo: u.modelo || '', fontes: (u.fontes || []).map(f => f.titulo) } : { erro: !!document.querySelector('.mig-msg.erro') }; })()");
    };
    const esperarPronto = async () => esperar("ModeloLocal.estado().fase === 'pronto'", 10000);
    const prepararModelo = async (extraTeste) => { await clicar('#mlPreparar'); const r = await esperarPronto(); await esperar('window.__fake.chamadas.length >= 1', 5000); return r; };

    try {
        await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');

        // ═════════ 1) abertura ═════════
        await abrir('migracaolocal.html');
        t('página: título, e o gancho da IA local existe (e o MCP NÃO foi carregado)', /IA local/.test(await ev('document.title')) && (await ev("typeof window.MigMotorIA === 'object' && typeof mcpMontarCadeia === 'undefined' && typeof MCP_CFG === 'undefined'")));
        t('página: a base de conhecimento carregou (banco real, somente leitura)', (await ev('Mig.dados.banco.length')) > 300 && (await ev('Mig.ix.regra.N')) > 5 && (await ev('Mig.ix.termo.N')) > 30);
        t('abertura: o painel diz que a IA ainda não foi preparada e oferece baixar (770 MB, Llama por padrão)', /ainda não preparada/.test(await txt('#mlResumo')) && /770 MB/.test(await txt('#mlPreparar')) && (await ev("document.getElementById('mlModelo').value")) === 'llama', await txt('#mlResumo') + ' | ' + await txt('#mlPreparar'));
        t('abertura: os detalhes começam fechados e abrem no botão “Detalhes”', (await ev("document.getElementById('mlDetalhes').hidden")) === true && (await clicar('#mlMais')) && (await ev("!document.getElementById('mlDetalhes').hidden && document.getElementById('mlMais').getAttribute('aria-expanded') === 'true'")));
        t('abertura: dois modelos; a IA desligada até estar pronta; a opção de placa de vídeo existe e vem desmarcada', JSON.stringify(await ev("[...document.querySelectorAll('#mlModelo option')].map(o => o.value)")) === '["llama","qwen"]' && (await ev("document.getElementById('mlUsar').disabled")) && (await ev("!document.getElementById('mlGpu').checked")));
        t('abertura: nada foi baixado nem carregado sozinho', (await ev('window.__fake.carga === null')) && (await chamadas()) === 0);
        await print('01-painel');
        await clicar('#mlMais');

        // ═════════ 2) o chat SEM o modelo: responde direto do banco ═════════
        await cliente('cte');
        const r1 = await perguntar('Como emito um CT-e?');
        t('banco direto: o artigo cujo título é a pergunta vira a resposta NA HORA, avisando que não gastou IA (e sem mandar preparar a IA local, que aqui não faz falta)', r1.texto && /^\*\*Como emitir um ct-e\?\*\*/i.test(r1.texto) && /Resposta direta do banco de dados: o artigo já responde à sua pergunta, sem gastar IA/.test(r1.texto) && !/prepare a IA local/.test(r1.texto) && r1.modelo === 'banco', JSON.stringify(r1).slice(0, 300));
        const r1b = await perguntar('Como imprimo o DACTE?');
        t('sem modelo: pergunta que o banco não responde com um artigo-título → o trecho mais parecido, avisando que é resposta direta e mandando preparar a IA local', r1b.texto && /^\*\*Como faz para visualizar a DACTE/i.test(r1b.texto) && /Resposta direta do banco de dados\. Para respostas escritas pela IA, prepare a IA local/.test(r1b.texto) && r1b.modelo === 'banco', JSON.stringify(r1b).slice(0, 300));
        t('sem modelo: traz as fontes (“Baseado em”) e nada foi pedido ao modelo', r1.fontes.length >= 1 && r1b.fontes.length >= 1 && (await chamadas()) === 0);
        await cliente('cte');          // (conversa nova: com conversa anterior, uma pergunta curta é tratada como continuação dela)
        const rv = await perguntar('não consigo emitir');
        t('pergunta de uma palavra só (sem conversa anterior): pede detalhe (documento, o que tentou, mensagem), sem chutar artigo e sem modelo', /Preciso de um pouco mais de detalhe/.test(rv.texto) && /mensagem exata/.test(rv.texto) && rv.modelo === 'regras', JSON.stringify(rv).slice(0, 300));
        // as respostas que NUNCA passam pelo modelo
        const rp = await perguntar('Emiti um CT-e ontem em São Paulo com o valor errado. Ainda consigo cancelar? Qual é o prazo?');
        t('prazo: a resposta é a REGRA conferida (a de cancelar o CT-e vem primeiro, mesmo no passo de emitir), com o aviso do contador', rp.texto.startsWith('⏱️ **Cancelar um CT-e**') && /Prazo:/.test(rp.texto) && /Confirme com o seu contador/.test(rp.texto) && rp.modelo === 'regras', rp.texto.slice(0, 200));
        const rd = await perguntar('O que é CT-e e MDF-e? Qual a diferença?');
        t('“o que é…?”: a resposta é o glossário da equipe, com os dois termos', /📖 \*\*CT-e\*\*/.test(rd.texto) && /📖 \*\*MDF-e\*\*/.test(rd.texto) && rd.modelo === 'regras');
        const rc = await perguntar('O sistema pediu o certificado digital. Como instalo? A empresa só tem um token.');
        t('certificado: “é configuração do sistema, com o Suporte” (não ensina a instalar)', /configuração do sistema/.test(rc.texto) && /Opções do Sistema > Suporte/.test(rc.texto) && !/\b1\.\s/.test(rc.texto));
        const rn = await perguntar('qual a cor do céu');
        t('pergunta fora do assunto: “não encontrei” + Suporte (não inventa)', /Não encontrei isso na base/.test(rn.texto) && /Suporte/.test(rn.texto));
        const re = await perguntar('Rejeição 8888: erro xyzabc inexistente na validação do grupo ZZ99', true);
        t('erro com código que nenhum artigo tem: triagem padrão, sem chutar a causa', /Esse erro não consta/.test(re.texto) && /talão e a numeração/.test(re.texto) && /Suporte/.test(re.texto));
        t('nenhuma dessas respostas pediu nada ao modelo', (await chamadas()) === 0);
        t('o texto aparece na tela do chat (markdown renderizado, sem “undefined”/“null”)', await ev("(() => { const t = document.getElementById('chatLista').innerText; return /Cancelamento de CT-e/.test(t) && !/(^|[^\\w])(undefined|null)([^\\w]|$)/.test(t); })()"));
        await print('02-chat-sem-modelo');

        // (o gancho abaixo de ModeloLocal só existe no teste: guarda o que o modelo recebeu e devolveu)
        // ═════════ 3) baixar e preparar ═════════
        // (a pessoa ainda não mexeu em "Detalhes" nesta página: o painel abre sozinho quando há o que ler e fecha sozinho quando termina)
        await abrir('migracaolocal.html');
        await cliente('cte');
        await ev('window.__fake.atraso = 150; true');         // (devagar de propósito: o teste precisa ENXERGAR a barra, que numa carga instantânea passa em milissegundos)
        await clicar('#mlPreparar');
        t('baixar: os detalhes abrem SOZINHOS (há o que ler: barra e andamento)', await esperar("!document.getElementById('mlDetalhes').hidden", 5000));
        t('baixar: a barra aparece e o botão mostra “Baixando…”; o chat segue funcionando durante o download', await esperar("!document.getElementById('mlBarra').hidden && /Baixando/.test(document.getElementById('mlPreparar').textContent)", 5000));
        t('baixar: chega em “pronto” passando por baixando e carregando', await esperarPronto() && ['"baixando"', '"carregando"'].every(f => JSON.stringify([]).length >= 0 && true) && JSON.stringify(await ev('window.__fases')).includes('"baixando"') && JSON.stringify(await ev('window.__fases')).includes('"carregando"'), JSON.stringify(await ev('window.__fases')));
        const carga = await ev('window.__fake.carga');
        t('baixar: pede o GGUF certo, só em CPU (n_gpu_layers 0), 1 sequência e contexto de 2048', carga && /Llama-3\.2-1B-Instruct-Q4_K_M\.gguf$/.test(carga.url) && carga.params.n_gpu_layers === 0 && carga.params.n_parallel === 1 && carga.params.n_ctx === 2048, JSON.stringify(carga));
        await ev('window.__fake.atraso = 15; true');
        t('pronto: os detalhes que abriram sozinhos FECHAM sozinhos (o chat não fica empurrado para baixo)', await esperar("document.getElementById('mlDetalhes').hidden", 3000));
        t('pronto: o resumo diz “pronta · Llama 3.2 · 1B”, o botão some e a opção “Respostas escritas pela IA” liga', /pronta · Llama 3\.2 · 1B/.test(await txt('#mlResumo')) && (await ev("document.getElementById('mlPreparar').hidden")) && (await ev("!document.getElementById('mlUsar').disabled && document.getElementById('mlUsar').checked && !document.getElementById('mlTudo').disabled && !document.getElementById('mlTudo').checked")));
        await esperar('window.__fake.chamadas.length >= 1', 5000);
        const aq = await ev('window.__fake.chamadas[0]');
        t('aquecimento: logo que fica pronta, lê o trecho FIXO do prompt (1 token), igual ao sistema de toda pergunta', aq && aq.max_tokens === 1 && (await ev('window.__fake.chamadas[0].messages[0].content === MigLocalRag.SISTEMA')));

        // ═════════ 4) o chat COM o modelo ═════════
        // (aqui “A IA escreve TODA resposta” fica ligada: sem isso as perguntas cujo título já é a pergunta nem chegariam ao modelo — o atalho é testado no fim desta seção)
        await ev("(() => { const c = document.getElementById('mlTudo'); c.checked = true; c.dispatchEvent(new Event('change')); return true; })()");
        await ev('window.__fake.atrasoToken = 70; true');
        const n0 = await chamadas();
        await ev(`Mig.chatEnviar('Como emito um CT-e?', { modoErro: false }); true`);
        t('escrevendo: a bolha “digitando” mostra o andamento da IA local', await esperar("/IA local: (lendo|escrevendo)/.test((document.querySelector('.mig-digitando-tx') || {}).textContent || '')", 8000), await txt('.mig-digitando-tx'));
        t('escrevendo: mostra o texto que já saiu e as fontes do banco (clicáveis) enquanto escreve', await esperar("!!document.querySelector('.mig-msg.digitando .ml-parcial') && document.querySelector('.mig-msg.digitando .ml-parcial').textContent.length > 5 && document.querySelectorAll('.mig-msg.digitando .ml-fontes button').length >= 1", 8000));
        await ev("document.getElementById('colunaChat').scrollIntoView({ block: 'start' }); (() => { const l = document.getElementById('chatLista'); if (l) l.scrollTop = l.scrollHeight; })(); true");
        await print('03-escrevendo');
        await esperar(`(() => { const m = Mig.atual.mentor; return m.length >= 2 && m[m.length - 1].papel === 'ia' && !document.querySelector('.mig-msg.digitando'); })()`, 30000, 80);
        await ev('window.__fake.atrasoToken = 0; true');
        const ia = await ev('Mig.atual.mentor[Mig.atual.mentor.length - 1]');
        t('resposta: é o texto do modelo (passou pelas travas), com o nome do modelo e as fontes', /^Acesse Transporte > Conhecimentos e clique em Novo/.test(ia.texto) && ia.modelo === 'Llama 3.2 · 1B' && ia.fontes.length >= 1, JSON.stringify(ia).slice(0, 240));
        const cm = await ev(`window.__fake.chamadas[${n0}]`);
        t('prompt: 2 mensagens (sistema fixo + pedido), com o passo, o texto do artigo e a pergunta — e curto', cm && cm.messages.length === 2 && cm.messages[0].content === (await ev('MigLocalRag.SISTEMA')) && /^Passo do cliente: /.test(cm.messages[1].content) && /TEXTO:\n1\) /.test(cm.messages[1].content) && /Pergunta: Como emito um CT-e\?/.test(cm.messages[1].content) && /Resposta em até 2 frases:$/.test(cm.messages[1].content) && cm.messages[1].content.length < 1000, cm && cm.messages[1].content.length);
        t('pedido ao motor: até 100 tokens (2 frases), temperatura 0, cache de prompt e andamento ligados', cm.max_tokens === 100 && cm.temperature === 0 && cm.cache_prompt === true && cm.return_progress === true && cm.stream === true, JSON.stringify({ m: cm.max_tokens, t: cm.temperature }));
        t('o prompt NÃO leva o roteiro, o glossário, os parâmetros nem o prompt enorme do MCP', !/ROTEIRO|GLOSSÁRIO|PARÂMETROS|COMO RESPONDER/.test(cm.messages.map(m => m.content).join('\n')));
        t('o painel mostra a velocidade medida (lê 3,5 / escreve 2,1 tokens/s)', /lê 3\.5 e escreve 2\.1 tokens\/s/.test(await txt('#mlStatus')), await txt('#mlStatus'));
        // orçamento: PC lento (3,5 t/s) = 1 trecho; depois de medir um PC rápido, mais trechos
        t('orçamento: com a velocidade medida de 3,5 tokens/s o prompt usa 1 trecho (econômico)', /TEXTO:\n1\) /.test(cm.messages[1].content) && !/\n2\) /.test(cm.messages[1].content));
        await ev('window.__fake.tps = { ler: 80, escrever: 20 }; true');
        await perguntar('Como encerro o MDF-e?');                 // (esta mede a velocidade nova)
        const n1 = await chamadas();
        await perguntar('Como cadastro um motorista no sistema?');
        const cm2 = await ev(`window.__fake.chamadas[${n1}]`);
        t('orçamento: depois de medir 80 tokens/s o prompt passa a levar mais trechos (3)', cm2 && /\n2\) /.test(cm2.messages[1].content) && /\n3\) /.test(cm2.messages[1].content), cm2 && cm2.messages[1].content.slice(0, 120));
        await ev('window.__fake.tps = { ler: 3.5, escrever: 2.1 }; true');
        await perguntar('Como confiro se a numeração continua?');   // volta a medir o lento

        // as respostas que passam pelo modelo, mas pelas TRAVAS
        const n2 = await chamadas();
        await ev(`window.__fake.resp = 'Você tem 15 dias para cancelar o CT-e, depois disso precisa emitir um CT-e de substituição no sistema.'; true`);
        const rt = await perguntar('Como corrijo um CT-e emitido errado?');
        t('trava: número/prazo que não está no material vem com o aviso de confirmar', /⚠️ \*\*Atenção:\*\* o número\/prazo \(15 dias\)/.test(rt.texto), rt.texto.slice(0, 300));
        await ev(`window.__fake.resp = 'Hello, to issue the document you can open the menu and click on the button please.'; true`);
        const ri = await perguntar('Como imprimo o DACTE do CT-e?');
        t('trava: modelo respondeu em inglês → usa o trecho do banco e diz que a IA não conseguiu', /não conseguiu escrever uma resposta boa/.test(ri.texto) && ri.modelo === 'banco', ri.texto.slice(0, 200));
        await ev(`window.__fake.resp = 'Desculpe, mas não posso atender a esse pedido de ajuda com o sistema.'; true`);
        const rr = await perguntar('Como consulto um CT-e emitido?');
        t('trava: modelo RECUSOU → o chat nunca mostra a recusa, usa o trecho do banco', !/não posso atender/.test(rr.texto) && /não conseguiu escrever uma resposta boa/.test(rr.texto));
        await ev(`window.__fake.resp = 'Para emitir o CT-e você deve instalar o certificado digital no computador. Depois clique em Novo e informe o remetente e o destinatário.'; true`);
        const rg = await perguntar('Como faço o primeiro CT-e?');
        t('trava: a linha que manda instalar o certificado SAI da resposta e entra o aviso “Esta etapa é feita pelo Suporte” (o resto da resposta fica)', /Esta etapa é feita pelo Suporte/.test(rg.texto) && !/instalar o certificado/.test(rg.texto) && /Depois clique em Novo/.test(rg.texto), rg.texto.slice(0, 250));
        await ev(`window.__fake.resp = 'Acesse Transporte > Conhecimentos e clique em Novo para emitir o CT-e. Informe o remetente, o destinatário e o valor do frete e depois clique em Transmitir.'; true`);
        t('trava: nenhuma dessas respostas ficou sem passar pelo modelo (5 pedidos)', (await chamadas()) - n2 === 4, (await chamadas()) - n2);

        // modo erro: usa o modelo só quando o código existe nos artigos
        const n3 = await chamadas();
        await ev(`window.__fake.resp = '**Causa provável** — o número do CT-e já foi usado. **Como corrigir** — confira a numeração com o Suporte. **Se não resolver** — leve o código 539 ao Suporte.'; true`);
        const rm = await perguntar('Rejeição 539: Duplicidade de CT-e. O número já foi usado.', true);
        const ce = await ev(`window.__fake.chamadas[${n3}]`);
        t('modo erro (IA em toda resposta): pergunta o modelo (art. do 539 em 1º), pede as 3 partes e até 170 tokens', ce && /Responda em 3 partes curtas: Causa provável, Como corrigir, Se não resolver\.$/.test(ce.messages[1].content) && /Causa provável/.test(rm.texto) && ce.max_tokens === 170 && /TEXTO:\n1\) Erro ou Rejeição SEFAZ 539/i.test(ce.messages[1].content), ce && ce.messages[1].content.slice(0, 500));
        t('modo erro: o texto vindo do banco vai no pedido SEM o texto de apoio do formulário (“DEU ERRO NA PRIMEIRA EMISSÃO…”)', ce && !/DEU ERRO NA PRIMEIRA EMISSÃO|Documento\/etapa/.test(ce.messages[1].content));

        // o ciclo do modelo pequeno (a mesma frase nas 3 partes) → o chat usa o trecho do banco em 3 partes, com o aviso do Suporte e os números do cliente
        await ev(`window.__fake.resp = '**Causa provável**: Alterar a numeração inicial para a sequência correta, caso não haja erro específico no número.\\n\\n**Como corrigir**: Alterar a numeração inicial para a sequência correta, ajustando a sequência do último documento emitido no antigo sistema.\\n\\n**Se não resolver**: Alterar a numeração inicial para a sequência correta, ajustando a sequência do último documento emitido no antigo sistema.'; true`);
        const rciclo = await perguntar('Rejeição 539: Duplicidade de CT-e. O número já foi usado.', true);
        t('ciclo do modelo no erro 539: descartado; o chat mostra as 3 partes do banco, com a etapa do Suporte + os números do cliente (CT-e 1500) e nada de “Alterar a numeração inicial”', rciclo.modelo === 'banco' && /não conseguiu escrever uma resposta boa/.test(rciclo.texto) && /\*\*Causa provável:\*\* Erro ou Rejeição SEFAZ 539/.test(rciclo.texto) && /Esta etapa é feita pelo Suporte/.test(rciclo.texto) && /CT-e 1500/.test(rciclo.texto) && !/Alterar a numeração inicial/.test(rciclo.texto), rciclo.texto.slice(0, 400));
        await ev(`window.__fake.resp = 'Acesse Transporte > Conhecimentos e clique em Novo para emitir o CT-e. Informe o remetente, o destinatário e o valor do frete e depois clique em Transmitir.'; true`);

        // opção “Respostas escritas pela IA” desligada
        await clicar('#mlMais');
        await ev("(() => { const c = document.getElementById('mlUsar'); c.checked = false; c.dispatchEvent(new Event('change')); return true; })()");
        const n4 = await chamadas();
        const rs = await perguntar('Como emito um CT-e?');
        t('IA desligada: responde direto com o trecho do banco, avisa o motivo e NÃO chama o modelo', /desligada/.test(rs.texto) && (await chamadas()) === n4 && (await ev("localStorage.getItem('bsoft_migloc_usar')")) === '0');
        await ev("(() => { const c = document.getElementById('mlUsar'); c.checked = true; c.dispatchEvent(new Event('change')); return true; })()");

        // cancelar: o modelo para na hora
        await ev('window.__fake.travar = true; window.__fake.abortados = 0; true');
        await ev(`Mig.chatEnviar('Como emito um CT-e com frete?', { modoErro: false }); true`);
        await esperar("!!document.querySelector('.mig-msg.digitando .mig-mini')", 8000);
        await clicar('.mig-msg.digitando .mig-mini');
        t('cancelar: o modelo é abortado na hora e o texto volta para o campo', await esperar('window.__fake.abortados >= 1', 5000) && (await ev("document.getElementById('chatCampo').value")) === 'Como emito um CT-e com frete?', await ev('window.__fake.abortados'));
        await ev('window.__fake.travar = false; true');

        // a IA falha → balão de erro com “Tentar de novo”
        await ev(`window.__fake.falhaGerar = 'boom'; true`);
        const rf = await perguntar('Como emito o MDF-e do CT-e?');
        t('falha do modelo: o chat mostra “A IA não respondeu agora” com as fontes e o botão “Tentar de novo”', rf.erro === true && !!(await ev("document.querySelector('.mig-msg.erro .mig-btn.primario')")) && /Enquanto isso, veja o que o banco/.test(await txt('.mig-msg.erro')), await txt('.mig-msg.erro'));
        await clicar('.mig-msg.erro .mig-btn.primario');
        t('“Tentar de novo” funciona (2ª vez o modelo responde)', await esperar("(() => { const m = Mig.atual.mentor; return m[m.length - 1].papel === 'ia' && !document.querySelector('.mig-msg.erro'); })()", 30000));
        // ═════ o atalho do banco (o padrão) × “A IA escreve TODA resposta” ═════
        await ev("(() => { const c = document.getElementById('mlTudo'); c.checked = false; c.dispatchEvent(new Event('change')); return true; })()");
        t('“A IA escreve TODA resposta”: a escolha (desligada) fica lembrada neste navegador', (await ev("localStorage.getItem('bsoft_migloc_tudo')")) === '0');
        const n5 = await chamadas();
        const rdir = await perguntar('Como emito um CT-e?');
        t('padrão: o artigo cujo título é a pergunta responde NA HORA, mesmo com a IA pronta — o modelo não é chamado e a resposta avisa que não gastou IA', /^\*\*Como emitir um ct-e\?\*\*/i.test(rdir.texto) && /sem gastar IA/.test(rdir.texto) && rdir.modelo === 'banco' && (await chamadas()) === n5, JSON.stringify(rdir).slice(0, 200));
        const rdir2 = await perguntar('Rejeição 539: Duplicidade de CT-e. O número já foi usado.', true);
        t('padrão, erro 539: as 3 partes do banco, com a etapa do Suporte e os números do cliente, SEM chamar o modelo', /\*\*Causa provável:\*\* Erro ou Rejeição SEFAZ 539/.test(rdir2.texto) && /\*\*Se não resolver:\*\*/.test(rdir2.texto) && /CT-e 1500/.test(rdir2.texto) && rdir2.modelo === 'banco' && (await chamadas()) === n5, rdir2.texto.slice(0, 300));
        const rmod = await perguntar('Como imprimo o DACTE?');
        t('padrão: a pergunta que NÃO tem artigo-título (DACTE) continua indo ao modelo', (await chamadas()) === n5 + 1 && rmod.modelo === 'Llama 3.2 · 1B', JSON.stringify(rmod).slice(0, 200));
        await ev("(() => { const c = document.getElementById('mlTudo'); c.checked = true; c.dispatchEvent(new Event('change')); return true; })()");
        const rtudo = await perguntar('Como emito um CT-e?');
        t('“A IA escreve TODA resposta” ligada: o mesmo pedido de antes agora vai ao modelo (e a escolha fica lembrada)', (await chamadas()) === n5 + 2 && rtudo.modelo === 'Llama 3.2 · 1B' && (await ev("localStorage.getItem('bsoft_migloc_tudo')")) === '1', JSON.stringify(rtudo).slice(0, 200));
        await ev("(() => { const c = document.getElementById('mlTudo'); c.checked = false; c.dispatchEvent(new Event('change')); return true; })()");
        await print('04-chat-com-modelo');
        t('chat inteiro sem erro de JavaScript e sem nenhuma escrita no Supabase', erros.filter(e => !/boom|Failed to fetch/.test(e)).length === 0 && escritas.length === 0, erros.concat(escritas).join(' | '));
        erros.length = 0;

        // ═════════ 5) falha ao carregar → erro → tentar de novo ═════════
        await abrir('migracaolocal.html', 'window.__fake.falhaCarga = "Failed to fetch";');
        await clicar('#mlPreparar');
        t('erro ao carregar: o painel mostra o problema (rede/Hugging Face) e abre os detalhes sozinho', await esperar("ModeloLocal.estado().fase === 'erro'", 8000) && /Não consegui baixar o modelo/.test(await txt('#mlStatus')) && (await ev("!document.getElementById('mlDetalhes').hidden")), await txt('#mlStatus'));
        t('erro: o resumo avisa, dá para tentar de novo e o chat continua respondendo direto do banco', /problema/.test(await txt('#mlResumo')) && !(await ev("document.getElementById('mlPreparar').disabled")));
        await cliente('cte');
        const rb = await perguntar('Como emito um CT-e?');
        t('erro: mesmo com a IA com problema o chat responde (trecho do banco)', /Resposta direta do banco de dados/.test(rb.texto));
        erros.length = 0;
        await clicar('#mlPreparar');
        t('tentar de novo: na 2ª vez carrega e fica pronta', await esperarPronto());

        // ═════════ 6) já guardado → carrega sozinho; trocar de modelo; apagar ═════════
        const URL_LLAMA = await ev('ModeloLocal.MODELOS.llama.url');
        await abrir('migracaolocal.html', `window.__fake.cache = [${JSON.stringify(URL_LLAMA)}];`);
        t('já guardado: abre e carrega SOZINHO, sem clicar', await esperarPronto(), JSON.stringify(await ev('window.__fases')));
        await ev(`(() => { const s = document.getElementById('mlModelo'); s.value = 'qwen'; s.dispatchEvent(new Event('change')); return true; })()`);
        t('trocar para o Qwen: o botão mostra 469 MB e a licença (Apache-2.0)', /469 MB/.test(await txt('#mlPreparar')) && /Apache-2\.0/.test(await txt('#mlLicenca')), await txt('#mlPreparar'));
        await clicar('#mlPreparar');
        t('trocar para o Qwen: descarrega o Llama e carrega o Qwen', await esperar("ModeloLocal.estado().fase === 'pronto' && ModeloLocal.estado().chave === 'qwen'", 8000) && /qwen2\.5-0\.5b-instruct-q4_k_m\.gguf$/.test((await ev('window.__fake.carga')).url) && (await ev('window.__fake.saidas')) >= 1);
        t('a escolha do modelo fica lembrada neste navegador', (await ev("localStorage.getItem('bsoft_migloc_modelo')")) === 'qwen');
        await ev(`(() => { const s = document.getElementById('mlModelo'); s.value = 'llama'; s.dispatchEvent(new Event('change')); return true; })()`);
        await ev('window.confirm = () => true; true');
        await clicar('#mlApagar');
        t('apagar: remove o modelo guardado e volta a oferecer o download', await esperar("window.__fake.removidos.length === 1 && /Baixar/.test(document.getElementById('mlPreparar').textContent)", 8000) && (await ev('window.__fake.removidos[0]')) === URL_LLAMA);

        // ═════════ 7) placa de vídeo (experimental) ═════════
        await abrir('migracaolocal.html', '');
        await clicar('#mlMais');
        await ev("(() => { const c = document.getElementById('mlGpu'); c.checked = true; c.dispatchEvent(new Event('change')); return true; })()");
        await clicar('#mlPreparar'); await esperarPronto();
        t('placa de vídeo: marcada, NÃO manda n_gpu_layers 0 (deixa a biblioteca usar a placa) e o painel diz “placa de vídeo”', (await ev('window.__fake.carga')).params.n_gpu_layers === undefined && /placa de vídeo/.test(await txt('#mlStatus')) && (await ev("localStorage.getItem('bsoft_migloc_gpu')")) === '1', await txt('#mlStatus'));
        await abrir('migracaolocal.html', 'window.__fake.falhaGpu = true; localStorage.setItem("bsoft_migloc_gpu", "1");');
        await clicar('#mlPreparar'); await esperarPronto();
        const cg = await ev('window.__fake.cargas.map(x => x.params.n_gpu_layers)');
        t('placa de vídeo que falha ao carregar: volta SOZINHA para o processador (2ª carga com n_gpu_layers 0) e avisa', JSON.stringify(cg) === '[null,0]' || (cg.length === 2 && cg[0] == null && cg[1] === 0), JSON.stringify(cg));
        t('…e fica pronta, avisando que a placa falhou', /A placa de vídeo falhou ao carregar: usei o processador/.test(await txt('#mlStatus')), await txt('#mlStatus'));

        // ═════════ 8) navegador sem suporte ═════════
        await abrir('migracaolocal.html', 'WebAssembly.validate = () => false;');
        t('sem suporte (sem WebAssembly SIMD): avisa o motivo, desliga o botão e diz que o chat segue direto do banco', /não consegue rodar a IA local/.test(await txt('#mlCompat')) && /SIMD/.test(await txt('#mlCompat')) && (await ev("document.getElementById('mlPreparar').disabled")) && /continua respondendo direto do banco/.test(await txt('#mlCompat')), await txt('#mlCompat'));
        await cliente('cte');
        const rsu = await perguntar('Como emito um CT-e?');
        t('sem suporte: o chat funciona (trecho do banco)', /Resposta direta do banco de dados/.test(rsu.texto));
        erros.length = 0;

        // ═════════ 9) a migracao.html ORIGINAL continua igual ═════════
        await abrir('migracao.html', null);
        await ev("window.__ch = []; window.callMCPAPI = async (p, m, k, b, msgs) => { window.__ch.push(msgs); return { text: 'Resposta de teste do MCP.', finishReason: 'stop' }; }; true");
        await cliente('cte');
        t('migracao.html: sem o gancho da IA local (usa os modelos do MCP como sempre) e sem o painel', await ev("typeof window.MigMotorIA === 'undefined' && typeof mcpMontarCadeia === 'function' && typeof MigLocalRag === 'undefined' && !document.getElementById('painelLocal')"));
        t('migracao.html: o prompt continua o ENORME de sempre (SISTEMA_BASE + base completa)', await ev("MigLogica.montarMensagensMentor({ pergunta: 'x', historico: [], perfil: { trilha: 'nova', docs: ['cte'], seguro: 'configurado' }, roteiro: Mig.R, rot: Mig.rot, estado: {}, passoAtual: null, achados: { banco: [], rapida: [], faq: [] }, regras: [], parametros: '', menu: '', modo: '' })[0].content.includes('COMO RESPONDER')"));
        const ro = await perguntar('Como emito um CT-e?');
        t('migracao.html: o chat chama o MCP (a IA de mentira do MCP respondeu) com o prompt completo', ro.texto === 'Resposta de teste do MCP.' && (await ev('window.__ch.length')) === 1 && (await ev('window.__ch[0][0].content.length')) > 2500, JSON.stringify(ro).slice(0, 200));
        t('migracao.html: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
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
