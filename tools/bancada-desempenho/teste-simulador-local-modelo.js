'use strict';
/* teste-simulador-local-modelo.js — o simulador LOCAL (simuladorlocal.html) com o MODELO DE VERDADE rodando no processador do Edge desta máquina (llama.cpp/WebAssembly via wllama).
   Faz o caminho da pessoa: abre a página, escolhe o modelo, BAIXA (1ª vez: 469 MB o Qwen · 770 MB o Llama; depois fica no perfil de teste) e carrega, sorteia casos reais do banco (somente leitura),
   conversa como o suporte (pergunta → orientação genérica → a orientação certa) e mede o que importa: quanto tempo cada fala do cliente leva, a velocidade (ler/escrever por segundo),
   e se a fala presta (português, curta, sem virar atendente, sem recusar, sem copiar a solução, no assunto) e se o caso termina como "Resolvido" pela regra.
   É LENTO de propósito (a IA roda no processador: dezenas de segundos por fala num i3) e gasta rede só na 1ª vez. A IA varia: rode mais de uma vez.
   Rode (servidor do projeto em http://localhost:8080 — ou  tools\servidor-local.bat 8080 isolado  para testar vários núcleos, com BSOFT_URL_BASE):
     $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-simulador-local-modelo.js --modelo=llama --casos=305,108 | Out-String
   Parâmetros: --modelo=llama|qwen (padrão llama) · --casos=305,108 (ids do banco; padrão 305,108) · --verbose · --visual (prints em %TEMP%\simlocal-prints)
   O perfil de teste fica em %TEMP%\edge-simlocal-9558 (guarda o modelo baixado; apague a pasta para liberar o espaço). */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const L = require('./lib-cdp.js');
const BASE = (process.env.BSOFT_URL_BASE || 'http://localhost:8080').replace(/\/+$/, '');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const MODELO = arg('modelo', 'llama'), CASOS = arg('casos', '305,108').split(',').map(Number).filter(Boolean);
const verboso = process.argv.includes('--verbose'), visual = process.argv.includes('--visual');
const PORTA = 9558, DIR = path.join(os.tmpdir(), 'edge-simlocal-' + PORTA), pastaPrints = path.join(os.tmpdir(), 'simlocal-prints');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let ok = 0; const falhas = [], avisos = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 300) : '')); if (verboso) console.log((cond ? '  ✔ ' : '  ✘ ') + nome + (!cond && detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 200) : '')); };
const seg = ms => (ms / 1000).toFixed(1) + ' s';

const semAcento = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => semAcento(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const ngrams = (x, n) => { const w = norm(x).split(' ').filter(Boolean), o = new Set(); for (let i = 0; i + n <= w.length; i++) o.add(w.slice(i, i + n).join(' ')); return o; };
const VOZ_ATENDENTE = /\b(posso (?:te )?ajudar|como posso|estou aqui para|em que posso|vou te ajudar)\b|\bvoc[eê]\s+(?:pode|deve|precisa|tem que)\s+(?!me\b)|(?:^|[.!?]\s+)(?:tente|verifique|confira|experimente|clique|acesse)\b/i;
const RECUSA = /n[aã]o posso (?:atender|ajudar)|desculpe,? mas|como (?:um )?(?:modelo de linguagem|assistente)/i;
const ESTRANHO = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]/;

(async () => {
    // abre o Edge de teste com um perfil que NÃO é apagado (é nele que o modelo baixado fica guardado)
    try { const v = await (await fetch('http://127.0.0.1:' + PORTA + '/json/version')).json(); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await L.sleep(2000); } catch (e) { /* não havia */ }
    const edge = spawn(EDGE, ['--remote-debugging-port=' + PORTA, '--user-data-dir=' + DIR, '--headless=new', '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
        '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--force-prefers-no-reduced-motion', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', 'about:blank'], { stdio: 'ignore' });
    for (let i = 0; i < 150; i++) { try { const r = await fetch('http://127.0.0.1:' + PORTA + '/json/version'); if (r.ok) break; } catch (e) { /* subindo */ } await L.sleep(200); }
    const c = await L.abrirPagina(PORTA), ev = js => c.eval(js);
    const esperar = async (cond, ms = 15000, passo = 150) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda carregando */ } await L.sleep(passo); } return false; };
    const erros = [];
    c.on('Runtime.exceptionThrown', p => erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).slice(0, 240)));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') erros.push('console.error: ' + p.args.map(a => a.value || a.description || '').join(' ').slice(0, 240)); });
    async function print(nome) { if (!visual) return; fs.mkdirSync(pastaPrints, { recursive: true }); const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(pastaPrints, nome + '.png'), Buffer.from(r.data, 'base64')); }
    const txt = sel => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
    const falasCliente = () => ev("[...document.querySelectorAll('#mensagens .sim-msg.cliente:not(.digitando) .txt')].map(x => x.textContent)");
    const ocioso = ms => esperar("!document.getElementById('digitando') && !Simulador.S.ocupado", ms);
    const metricas = [];

    try {
        await c.send('Runtime.enable'); await c.send('Page.enable');
        await L.navegar(c, BASE + '/simuladorlocal.html');
        await esperar("typeof ModeloLocal !== 'undefined' && !!document.getElementById('slPreparar')", 20000);
        t('a página abre e o navegador tem o que a IA local precisa', (await ev('ModeloLocal.suporte().ok')) === true, JSON.stringify(await ev('ModeloLocal.suporte()')));
        console.log('Navegador:', JSON.stringify(await ev('(({ nucleos, memoriaGB, multiThread }) => ({ nucleos, memoriaGB, multiThread }))(ModeloLocal.suporte())')), '| página isolada (multi-núcleo):', await ev('crossOriginIsolated'));
        await esperar("!document.getElementById('modalNome').hidden", 10000);
        await ev("(() => { document.getElementById('inpNome').value = 'Maria da Silva Souza'; document.getElementById('formNome').requestSubmit(); return true; })()");
        await esperar("document.getElementById('modalNome').hidden", 8000);

        // ── baixar e carregar ──
        await ev(`(() => { const s = document.getElementById('slModelo'); s.value = ${JSON.stringify(MODELO)}; s.dispatchEvent(new Event('change')); return true; })()`);
        const jaTinha = await ev("(async () => (await ModeloLocal.verificarCache())[document.getElementById('slModelo').value])()");
        console.log('Modelo:', MODELO, jaTinha ? '(já estava guardado no perfil de teste)' : '(será BAIXADO agora)');
        const t0 = Date.now();
        await ev("document.getElementById('slPreparar').click(); true");
        let ult = '';
        for (let i = 0; i < 900; i++) {          // até 15 min
            const e = await ev('ModeloLocal.estado()');
            const s = e.fase + (e.total ? ' ' + Math.round(100 * e.carregado / e.total) + '%' : '');
            if (s !== ult && (i % 5 === 0 || e.fase !== 'baixando')) { ult = s; if (verboso) console.log('  [' + seg(Date.now() - t0) + '] ' + s); }
            if (e.fase === 'pronto' || e.fase === 'erro') break;
            await L.sleep(1000);
        }
        const tPronta = Date.now() - t0;
        const est = await ev('ModeloLocal.estado()');
        t('o modelo baixou e carregou (fase "pronto")', est.fase === 'pronto', est.erro);
        console.log('Pronta em', seg(tPronta), '| núcleos usados:', est.nucleos);
        if (est.fase !== 'pronto') throw new Error('modelo não ficou pronto: ' + est.erro);
        await print('m-01-pronta');

        // ── os casos ──
        for (let k = 0; k < CASOS.length; k++) {
            const id = CASOS[k];
            const caso = await ev(`SimDados.buscarCaso(${id}).then(x => ({ titulo: x.titulo, conteudo: x.conteudo, categoria: x.categoria }))`);
            console.log('\n══ Caso #' + id + ' [' + (caso.categoria || '—') + '] ' + caso.titulo.slice(0, 100));
            const solucao = norm(caso.conteudo), tituloTermos = new Set(norm(caso.titulo).split(' ').filter(w => w.length >= 5));
            const tinicio = Date.now();
            await ev(`Simulador.iniciarCaso(${id}); true`);
            const abriu = await esperar("document.querySelectorAll('#mensagens .sim-msg.cliente:not(.digitando)').length >= 1", 6 * 60 * 1000, 500);
            const tAbertura = Date.now() - tinicio;
            t('caso #' + id + ': o cliente abriu a conversa (em até 6 min)', abriu, seg(tAbertura));
            if (!abriu) continue;
            const turnos = [{ de: 'cliente', texto: (await falasCliente())[0], ms: tAbertura, tipo: 'abertura' }];
            await print('m-02-abertura-' + id);
            const passos = [['investigação', 'Oi! Pode me contar o que aparece na tela quando você tenta fazer isso?'], ['orientação genérica', 'Tenta fechar o sistema e abrir de novo, depois me avisa.']];
            for (const [tipo, fala] of passos) {
                const n0 = (await falasCliente()).length, ti = Date.now();
                await ev(`(() => { document.getElementById('txtSuporte').value = ${JSON.stringify(fala)}; document.getElementById('formEnvio').requestSubmit(); return true; })()`);
                turnos.push({ de: 'suporte', texto: fala });
                const r = await esperar(`document.querySelectorAll('#mensagens .sim-msg.cliente:not(.digitando)').length > ${n0}`, 6 * 60 * 1000, 500);
                const f = await falasCliente();
                turnos.push({ de: 'cliente', texto: r ? f[f.length - 1] : '(sem resposta)', ms: Date.now() - ti, tipo });
                t('caso #' + id + ': o cliente respondeu à ' + tipo + ' (em até 6 min)', r, seg(Date.now() - ti));
                if (!r) break;
                await ocioso(30000);
            }
            // a orientação certa (o começo da solução, como um atendente que sabe diria) → resolve por REGRA, sem esperar o modelo
            const ti = Date.now();
            await ev(`(() => { document.getElementById('txtSuporte').value = ${JSON.stringify(caso.conteudo.slice(0, 500))}; document.getElementById('formEnvio').requestSubmit(); return true; })()`);
            const resolveu = await esperar("!document.getElementById('telaFim').hidden", 30000, 200);
            turnos.push({ de: 'suporte', texto: caso.conteudo.slice(0, 500).replace(/\s+/g, ' ') });
            turnos.push({ de: 'cliente', texto: resolveu ? (await ev('Simulador.S.hist[Simulador.S.hist.length - 1].texto')) : '(não resolveu)', ms: Date.now() - ti, tipo: 'orientação certa' });
            t('caso #' + id + ': a orientação certa encerra como "Resolvido" (pela regra, em poucos segundos)', resolveu && /Resolvido/.test(await txt('#fimStats')) && Date.now() - ti < 15000, seg(Date.now() - ti));
            await print('m-03-resolvido-' + id);

            // ── a transcrição e a análise de cada fala do cliente ──
            turnos.forEach(x => {
                if (x.de === 'suporte') { console.log('   SUPORTE : ' + x.texto.slice(0, 110) + (x.texto.length > 110 ? '…' : '')); return; }
                const pal = x.texto.split(/\s+/).filter(Boolean).length;
                const vaz = Array.from(ngrams(x.texto, 4)).filter(g => solucao.includes(g) && ![...ngrams(caso.titulo, 4)].includes(g));
                const flags = { lingua: !ESTRANHO.test(x.texto), curta: pal >= 2 && pal <= 40, papel: !VOZ_ATENDENTE.test(x.texto), semRecusa: !RECUSA.test(x.texto), semVazamento: vaz.length === 0 };
                if (x.tipo === 'abertura') flags.noAssunto = norm(x.texto).split(' ').some(w => tituloTermos.has(w));
                const bad = Object.entries(flags).filter(([, v]) => !v).map(([k]) => k);
                const reserva = /^Oi, preciso de ajuda: |^Hum, não entendi direito/.test(x.texto);
                console.log('   CLIENTE : ' + x.texto + '\n             [' + x.tipo + ' · ' + seg(x.ms) + (bad.length ? ' · ⚠ ' + bad.join(',') : ' · ok') + (reserva ? ' · FALA RESERVA' : '') + ']');
                if (x.tipo !== 'orientação certa') metricas.push({ caso: id, tipo: x.tipo, ms: x.ms, pal, flags, bad, reserva });
            });
            const est2 = await ev('ModeloLocal.estado().ultima');
            console.log('   velocidade medida: lê ' + (est2 && est2.lerTps) + '/s · escreve ' + (est2 && est2.escreverTps) + '/s (última geração)');
        }

        // ── resumo ──
        const bons = metricas.filter(m => m.bad.length === 0).length;
        const lentas = metricas.filter(m => m.ms > 120000).length;
        const mediana = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
        console.log('\n══ Resumo (' + MODELO + ') ══');
        console.log('  falas do cliente analisadas:', metricas.length, '· sem nenhum defeito:', bons, '(' + Math.round(100 * bons / Math.max(1, metricas.length)) + '%) · caíram na fala reserva:', metricas.filter(m => m.reserva).length);
        console.log('  tempo por fala: mediana', seg(mediana(metricas.map(m => m.ms))), '· pior', seg(Math.max.apply(null, metricas.map(m => m.ms))), '· aberturas', metricas.filter(m => m.tipo === 'abertura').map(m => seg(m.ms)).join(', '));
        const cont = {}; metricas.forEach(m => m.bad.forEach(b => { cont[b] = (cont[b] || 0) + 1; })); console.log('  defeitos por tipo:', JSON.stringify(cont));
        t('pelo menos 70% das falas do cliente sem defeito (português, curta, no papel, sem recusa, sem copiar a solução)', bons / Math.max(1, metricas.length) >= 0.7, bons + ' de ' + metricas.length);
        t('nenhuma fala demorou mais de 2 minutos', lentas === 0, lentas + ' fala(s)');
        t('sem erro de JavaScript do começo ao fim', erros.length === 0, erros.join(' | '));
    } catch (e) {
        falhas.push('o teste parou por um erro inesperado: ' + (e && e.stack || e));
    }

    console.log('\n' + ok + ' verificações ok · ' + falhas.length + ' falha(s)');
    falhas.forEach(f => console.log('  ✘ ' + f));
    avisos.forEach(a => console.log('  ℹ ' + a));
    try { await c.send('Browser.close'); } catch (e) { /* ok */ }
    await L.sleep(800);
    try { process.kill(edge.pid); } catch (e) { /* já fechou */ }
    process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('erro no teste:', e); process.exit(2); });
