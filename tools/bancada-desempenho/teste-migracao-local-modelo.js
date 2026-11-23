'use strict';
/* teste-migracao-local-modelo.js — o chat da migracaolocal.html (Primeira emissão guiada com IA LOCAL) com o MODELO DE VERDADE rodando no processador do Edge desta máquina (llama.cpp/WebAssembly via wllama).
   Baixa o modelo na 1ª vez (469 MB o Qwen · 770 MB o Llama; fica no perfil de teste %TEMP%\edge-miglocal-9560), faz as MESMAS perguntas do teste da IA da nuvem (teste-migracao-ia-real.js: numeração, “o que é CT-e”,
   prazo, certificado, rejeição 539, CIOT, erro 539, erro desconhecido, seguro) mais 4 de “como faço…?”, pelo fluxo da página (busca no banco → prompt curto → resposta), e para cada resposta confere:
     ✔ português · ✔ nenhum código de parâmetro · ✔ caminhos de menu que existem no MENU REAL · ✔ prazos/números só do material (nada inventado) · ✔ sem link · ✔ trouxe as fontes · ✔ o que o cenário exige/proíbe
   e mostra: por qual caminho foi respondida (regra/glossário/Suporte/não encontrei = SEM modelo; modelo; ou trecho do banco quando o modelo não serviu), quanto tempo levou, a velocidade medida e o texto inteiro.
   É LENTO de propósito (dezenas de segundos a minutos por resposta do modelo num i3) e a IA varia: rode mais de uma vez.
   Rode (servidor do projeto; para vários núcleos use  tools\servidor-local.bat 8080 isolado  e BSOFT_URL_BASE=http://localhost:8080):
     $env:ELECTRON_RUN_AS_NODE = "1"; $env:BSOFT_URL_BASE = "http://localhost:8080"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-migracao-local-modelo.js --modelo=llama | Out-String
   Parâmetros: --modelo=llama|qwen (padrão llama) · --cenarios=a,b,c (padrão todos) · --saida=arquivo.txt · --visual
               --tudo = liga “A IA escreve TODA resposta”: até as perguntas que o banco já responde (título = pergunta) vão ao modelo (sem isso elas saem direto do banco, na hora) */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const L = require('./lib-cdp.js');
const BASE = (process.env.BSOFT_URL_BASE || 'http://localhost:8080').replace(/\/+$/, '');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const MODELO = arg('modelo', 'llama'), SAIDA = arg('saida', ''), visual = process.argv.includes('--visual'), tudo = process.argv.includes('--tudo');
const PORTA = 9560, DIR = path.join(os.tmpdir(), 'edge-miglocal-' + PORTA), pastaPrints = path.join(os.tmpdir(), 'migloc-prints');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const NUMS = { cteSerie: '1', cteNumero: '1500', mdfeSerie: '1', mdfeNumero: '320' };
// o cliente só emite: uma linha que manda ele ajustar/editar a numeração inicial do talão (sem dizer que é com o Suporte) quebra a regra
const ensinaEditarTalao = t => t.split('\n').some(l => /(ajust|edit|alter|defin|habilit|corrij|mude|troque)[^\n]{0,80}(numeração inicial|número inicial|pode definir)/i.test(l) && !/Suporte|Implanta|configuração|não é algo|peça /i.test(l));
const NAO_TALAO = [ensinaEditarTalao, 'o cliente a editar o talão / numeração inicial'];
const P_MIG = { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: NUMS }, P_NOVA = { trilha: 'nova', docs: ['cte', 'mdfe'], seguro: 'configurado' };
// perfil · passo · erro · deve (o que a resposta precisa dizer) · nao (o que NÃO pode dizer) · via (caminho esperado: 'sem-modelo' = regra/glossário/Suporte/triagem/não encontrei; 'modelo' = pode ser o modelo)
const TODOS = {
    numeracao: { perfil: P_MIG, passo: 'numeracao', pergunta: 'Estou migrando de outro sistema. Como confiro se o Bsoft continua a numeração de CT-e e MDF-e sem dar rejeição 539?', deve: [[/talõ|numera|sequência/i, 'fala de talão/numeração']], nao: [NAO_TALAO], via: 'banco' },
    leigo: { perfil: P_NOVA, passo: 'entender', pergunta: 'O que é CT-e e MDF-e? Qual a diferença?', deve: [[/CT-e/, 'CT-e'], [/MDF-e/, 'MDF-e'], [/conhecimento de transporte/i, 'explica a sigla do CT-e'], [/manifesto/i, 'explica o manifesto']], via: 'sem-modelo' },
    prazo: { perfil: P_NOVA, passo: 'depois', pergunta: 'Emiti um CT-e ontem em São Paulo com o valor errado. Ainda consigo cancelar? Qual é o prazo?', deve: [[/168|7 dias|sete dias/i, 'prazo de 7 dias / 168 h'], [/contador|SEFAZ/i, 'manda confirmar com o contador/SEFAZ']], via: 'sem-modelo' },
    certificado: { perfil: P_MIG, passo: 'cte', pergunta: 'O sistema pediu o certificado digital. Como instalo? A empresa só tem um token.', deve: [[/Suporte/i, 'manda falar com o Suporte']], nao: [[/Passo a passo no Bsoft[\s\S]{0,40}\n\s*1\.[\s\S]{0,200}(instal|import)/i, 'ensinar o cliente a instalar o certificado']], via: 'sem-modelo' },
    rejeicao: { perfil: P_MIG, passo: 'mdfe', pergunta: 'Deu rejeição 539 ao autorizar o MDF-e. O que significa e como resolvo?', deve: [[/duplicidade|já foi usad|já usad|número/i, 'explica a duplicidade/número já usado']], nao: [NAO_TALAO], via: 'banco' },
    ciot: { perfil: { trilha: 'nova', docs: ['cte', 'ciotPropria'], seguro: 'configurado' }, passo: 'ciotPropria', pergunta: 'Minha frota é própria. Preciso de CIOT?', deve: [[/24\/05\/2026|2026/, 'cita a mudança de 2026'], [/confirm|contador|ANTT/i, 'manda confirmar']], via: 'sem-modelo' },
    erro539: { perfil: P_MIG, passo: 'cte', erro: true, pergunta: 'Rejeição 539: Duplicidade de CT-e. O número já foi usado.', deve: [[/Causa provável/i, 'seção Causa provável'], [/Como corrigir/i, 'seção Como corrigir'], [/Se não resolver/i, 'seção Se não resolver'], [/duplicidade|já foi usad|já usad|número/i, 'explica a duplicidade']], nao: [NAO_TALAO], via: 'banco' },
    erroduvida: { perfil: P_MIG, passo: 'cte', erro: true, pergunta: 'Rejeição 8888: erro xyzabc inexistente na validação do grupo ZZ99', deve: [[/não consta|não encontrei|não há/i, 'diz que o erro não consta na base'], [/Suporte/i, 'manda levar ao Suporte']], nao: [NAO_TALAO], via: 'sem-modelo' },
    seguro: { perfil: Object.assign({}, P_MIG, { seguro: 'configurar' }), passo: 'seguro', pergunta: 'Como cadastro a apólice do seguro e ligo a averbação automática?', deve: [[/averba/i, 'fala da averbação']], via: 'modelo' },
    como1: { perfil: P_NOVA, passo: 'cte', pergunta: 'Como emito um CT-e?', deve: [[/CT-e|conhecimento/i, 'fala do CT-e'], [/Transporte|Conhecimentos|Novo|Transmitir|XML/i, 'cita um passo/tela do sistema']], via: 'banco' },
    como2: { perfil: P_NOVA, passo: 'pessoas', pergunta: 'Como cadastro um motorista?', deve: [[/motorista/i, 'fala do motorista']], via: 'banco' },
    como3: { perfil: P_NOVA, passo: 'mdfe', pergunta: 'Como encerro o MDF-e?', deve: [[/encerr/i, 'fala de encerrar']], via: 'banco' },
    como4: { perfil: P_NOVA, passo: 'cte', pergunta: 'Como imprimo o DACTE?', deve: [[/DACTE|imprim/i, 'fala de imprimir/DACTE'], [/Esta etapa é feita pelo Suporte/, 'o artigo é uma configuração da equipe: vira o aviso do Suporte']], nao: [[/Imprime DACTE sem averbar|marcar como sim|basta marcar/, 'passo de configuração do talão (a equipe, não o cliente)']], via: 'banco' },
};
const escolhidos = (arg('cenarios', '') ? arg('cenarios', '').split(',') : Object.keys(TODOS)).filter(k => TODOS[k]);
const linhas = []; const log = s => { linhas.push(s); console.log(s); };

(async () => {
    try { const v = await (await fetch('http://127.0.0.1:' + PORTA + '/json/version')).json(); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await L.sleep(2000); } catch (e) { /* não havia */ }
    const edge = spawn(EDGE, ['--remote-debugging-port=' + PORTA, '--user-data-dir=' + DIR, '--headless=new', '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
        '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--force-prefers-no-reduced-motion', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', 'about:blank'], { stdio: 'ignore' });
    for (let i = 0; i < 150; i++) { try { const r = await fetch('http://127.0.0.1:' + PORTA + '/json/version'); if (r.ok) break; } catch (e) { /* subindo */ } await L.sleep(200); }
    const c = await L.abrirPagina(PORTA), ev = js => c.eval(js);
    const esperar = async (cond, ms = 15000, passo = 300) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda */ } await L.sleep(passo); } return false; };
    const erros = [];
    c.on('Runtime.exceptionThrown', p => erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).slice(0, 240)));
    c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') erros.push('console.error: ' + p.args.map(a => a.value || a.description || '').join(' ').slice(0, 240)); });
    const resumo = { total: 0, ok: 0 }; const caminhos = {}; const tempos = [];
    try {
        await c.send('Runtime.enable'); await c.send('Page.enable');
        await L.navegar(c, BASE + '/migracaolocal.html');
        await esperar("typeof Mig !== 'undefined' && Mig.dados.estado === 'pronto' && typeof ModeloLocal !== 'undefined'", 60000);
        log('Base: ' + (await ev("Mig.dados.banco.length + ' artigos · ' + Mig.dados.rapidas.length + ' respostas aprovadas · ' + Mig.dados.faq.length + ' FAQ'")) + ' · navegador: ' + JSON.stringify(await ev('(({ nucleos, memoriaGB, multiThread }) => ({ nucleos, memoriaGB, multiThread }))(ModeloLocal.suporte())')) + ' · página isolada (multi-núcleo): ' + (await ev('crossOriginIsolated')));
        if (!(await ev('ModeloLocal.suporte().ok'))) throw new Error('este navegador não roda a IA local');

        // ── baixar e carregar (pela tela, como a pessoa faz) ──
        // A página carrega SOZINHA o último modelo lembrado no perfil (e lembra a opção “IA em toda resposta”): é preciso esperar essa carga terminar ANTES de escolher o modelo (senão o clique em “Preparar”
        // cai com o botão desligado e o teste mede o modelo ERRADO — foi o que aconteceu numa rodada “Qwen” que na verdade rodou o Llama) e CONFERIR no fim qual modelo está carregado.
        await esperar("['pronto', 'erro', 'ocioso'].includes(ModeloLocal.estado().fase)", 240000, 500);
        await ev(`(() => { const s = document.getElementById('mlModelo'); s.value = ${JSON.stringify(MODELO)}; s.dispatchEvent(new Event('change')); return true; })()`);
        const jaTinha = await ev("(async () => (await ModeloLocal.verificarCache())[document.getElementById('mlModelo').value])()");
        log('Modelo: ' + MODELO + (jaTinha ? ' (já estava guardado no perfil de teste)' : ' (será BAIXADO agora)'));
        const t0 = Date.now();
        const jaCarregado = await ev('ModeloLocal.estado()');
        if (!(jaCarregado.fase === 'pronto' && jaCarregado.chave === MODELO)) await ev("document.getElementById('mlPreparar').click(); true");
        for (let i = 0; i < 1200; i++) { const e = await ev('ModeloLocal.estado()'); if (e.fase === 'pronto' || e.fase === 'erro') break; await L.sleep(1000); }
        const est = await ev('ModeloLocal.estado()');
        if (est.fase !== 'pronto') throw new Error('o modelo não ficou pronto: ' + est.erro);
        if (est.chave !== MODELO) throw new Error('o modelo carregado é “' + est.chave + '”, não “' + MODELO + '”: a medida seria do modelo errado');
        log('IA local pronta em ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s · modelo carregado: ' + est.chave + ' · núcleos: ' + est.nucleos);
        await ev("(() => { const c = document.getElementById('mlTudo'); c.checked = " + (tudo ? 'true' : 'false') + "; c.dispatchEvent(new Event('change')); return true; })()");      // (sempre explícito: o perfil lembra o valor da rodada anterior)
        log('Modo: ' + (tudo ? 'A IA escreve TODA resposta (sem o atalho do banco)' : 'padrão (o banco responde direto quando o artigo já é a resposta)'));
        // grava o que o modelo recebe (para conferir os números contra o material)
        await ev("window.__msgs = null; window.__cru = null; (() => { const o = ModeloLocal.gerar; ModeloLocal.gerar = function (m) { window.__msgs = m; const p = o.apply(this, arguments); p.then(r => { window.__cru = r && r.text; window.__fim = r && r.finishReason; }, e => { window.__cru = '(erro: ' + (e && e.message) + ')'; }); return p; }; })(); true");
        await L.sleep(1500);

        for (const id of escolhidos) {
            const cen = TODOS[id];
            await ev("Mig.novoCliente(" + JSON.stringify(cen.perfil) + "); Mig.mostrarPassos(); Mig.irPasso(Mig.rot.passos.findIndex(p => p.id === " + JSON.stringify(cen.passo) + ")); window.__msgs = null; window.__cru = null; true");
            await L.sleep(300);
            const ti = Date.now();
            await ev("Mig.chatEnviar(" + JSON.stringify(cen.pergunta) + ", { modoErro: " + (cen.erro ? 'true' : 'false') + " }); true");
            const respondeu = await esperar("(() => { const m = Mig.atual.mentor; return (m.length >= 2 && m[m.length - 1].papel === 'ia') || !!document.querySelector('.mig-msg.erro'); })()", 12 * 60 * 1000, 500);
            const seg = (Date.now() - ti) / 1000;
            const r = await ev(`(() => { const m = Mig.atual.mentor, ia = m[m.length - 1], erro = !!document.querySelector('.mig-msg.erro');
                if (!ia || ia.papel !== 'ia') return { erro, texto: '', fontes: [] };
                const ctx = (window.__msgs || []).map(x => typeof x.content === 'string' ? x.content : '').join('\\n');
                const texto = ia.texto;
                const paresNumero = [...texto.matchAll(/(\\d+)\\s*(dias?|horas?|anos?|meses)/gi)].map(x => x[1] + ' ' + x[2].toLowerCase().replace(/s$/, ''));
                const noCtx = n => { const [num, un] = n.split(' '); return new RegExp('\\\\b' + num + '\\\\s*(' + un + 's?|h\\\\b)', 'i').test(ctx + ' ' + texto.split('Atenção')[0] ) && ctx.length > 0 || /Atenção:/.test(texto) || ctx.length === 0; };
                const caminhos = [...texto.matchAll(/(?:(?:e(?=[A-Z]))?[A-ZÀ-Ý][\\wÀ-ÿ\\/\\-]*(?: [\\wÀ-ÿ\\/\\-]+){0,4})(?: >[\\wÀ-ÿ\\/\\-\\.]+(?: [\\wÀ-ÿ\\/\\-\\.]+){0,5})+/g)].map(x => x[0].trim());
                const okCaminho = cm => { const partes = cm.split(' > '), ini = partes[0].split(' '), fim = partes[partes.length - 1].split(' '); for (let i = 0; i < ini.length; i++) for (let j = fim.length; j >= 1; j--) { const cand = [ini.slice(i).join(' ')].concat(partes.slice(1, -1), [fim.slice(0, j).join(' ').replace(/[.,;:]+$/, '')]).join(' > '); if (MenuBsoft.validarCaminho(cand).ok) return true; } return false; };
                // fidelidade ao que o modelo RECEBEU: que fração das palavras (≥ 4 letras, pelo radical de 5) da resposta aparece no prompt? (o que sobra é invenção ou "enfeite" do modelo)
                const sa = s => String(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
                const baseP = new Set(sa(ctx).split(/[^a-z0-9]+/).filter(w => w.length >= 4).map(w => w.slice(0, 5)));
                // (o aviso do Suporte 🔒 e os avisos em itálico/⚠️ são do SISTEMA, não do modelo: não entram na conta)
                const palavras = sa(texto.split('Atenção')[0].replace(/🔒[^\\n]*/g, '').replace(/_[^_\\n]*_/g, '')).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
                const fora = Array.from(new Set(palavras.filter(w => !baseP.has(w.slice(0, 5)))));
                const apoio = palavras.length ? Math.round(100 * (1 - palavras.filter(w => !baseP.has(w.slice(0, 5))).length / palavras.length)) : 100;
                return { erro, texto, fontes: ia.fontes.map(f => f.titulo), modelo: ia.modelo || '', usouModelo: ctx.length > 0, rep: MigLocalRag.repeticoes(texto).rep, apoio, novas: fora.slice(0, 12),
                    ptBR: !MigLocalRag.pareceOutraLingua(texto), semCodigo: Prereq.semCodigo(texto) === texto,
                    caminhos: caminhos.map(cm => ({ cm, ok: okCaminho(cm) })), numeros: paresNumero.map(n => ({ n, noCtx: noCtx(n) })), temLink: /https?:\\/\\//.test(texto) || /c\\.php\\?id=/.test(texto),
                    velocidade: ModeloLocal.estado().ultima };
            })()`);
            const checks = [];
            if (!respondeu || r.erro || !r.texto) checks.push(['a IA respondeu', false, 'sem resposta (erro ou tempo esgotado) — ' + seg.toFixed(0) + ' s']);
            else {
                checks.push(['a IA respondeu', true]); checks.push(['português (sem inglês)', r.ptBR]); checks.push(['sem código de parâmetro/funcionalidade', r.semCodigo]);
                checks.push(['resposta com corpo (> 120 caracteres)', r.texto.length > 120]);
                const ruins = r.caminhos.filter(x => !x.ok && x.cm.split(' > ').length >= 2);
                checks.push(['caminhos de menu existem no menu real', ruins.length === 0, ruins.map(x => x.cm).join(' | ')]);
                const inventados = r.numeros.filter(x => !x.noCtx);
                checks.push(['prazos citados vieram do material fornecido (ou vêm com o aviso)', inventados.length === 0, inventados.map(x => x.n).join(', ')]);
                checks.push(['sem link/endereço de tela', !r.temLink]);
                checks.push(['trouxe as fontes', r.fontes.length >= 1 || /Suporte/.test(r.texto)]);
                cen.deve.forEach(([re, nome]) => checks.push(['cita: ' + nome, re.test(r.texto)]));
                (cen.nao || []).forEach(([re, nome]) => checks.push(['NÃO manda ' + nome, typeof re === 'function' ? !re(r.texto) : !re.test(r.texto)]));
                const viaMod = r.usouModelo; if (cen.via === 'sem-modelo') checks.push(['respondida SEM modelo (regra/glossário/Suporte/triagem)', !viaMod]);
                if (cen.via === 'banco') checks.push([tudo ? 'foi ao modelo (modo “IA em toda resposta”)' : 'respondida direto do banco (sem modelo)', tudo ? viaMod : !viaMod]);
                checks.push(['não é só “Não consta.”', !/^\W*N[aã]o consta\.?\W*$/i.test(r.texto.trim())]);
                if (r.usouModelo) checks.push(['sem frase repetida em ciclo', r.rep === 0, r.rep + ' repetição(ões)']);      // (só na resposta que o modelo escreveu: a regra e o glossário da equipe têm frases parecidas de propósito)
                if (r.usouModelo && !/não conseguiu escrever uma resposta boa/.test(r.texto)) checks.push(['fiel ao material: ≥ 75% das palavras da resposta estão no que o modelo recebeu', r.apoio >= 75, r.apoio + '% · fora: ' + (r.novas || []).join(', ')]);
            }
            const via = !r.texto ? 'sem resposta' : r.usouModelo ? (/não conseguiu escrever uma resposta boa/.test(r.texto) ? 'modelo falhou → trecho do banco' : 'modelo ' + (r.modelo || '')) : (r.modelo === 'regras' ? 'sem modelo (regra/glossário/Suporte/não encontrei)' : 'banco direto (sem IA)');
            caminhos[via] = (caminhos[via] || 0) + 1; if (r.usouModelo) tempos.push(seg);
            resumo.total += checks.length; resumo.ok += checks.filter(x => x[1]).length;
            log('\n══════ ' + id + ' · ' + seg.toFixed(0) + ' s · ' + via + (r.velocidade && r.usouModelo ? ' · lê ' + r.velocidade.lerTps + '/s escreve ' + r.velocidade.escreverTps + '/s' : '') + ' ══════');
            log('PERGUNTA: ' + cen.pergunta);
            log('CHECAGENS: ' + checks.map(x => (x[1] ? '✔' : '✘') + x[0] + (x[1] || !x[2] ? '' : ' [' + x[2] + ']')).join('  '));
            log('FONTES: ' + (r.fontes || []).join(' | '));
            if (r.usouModelo) { const cru = await ev('window.__cru'); log('O QUE O MODELO ESCREVEU (cru, antes das travas; fim: ' + (await ev('window.__fim')) + '):\n' + (cru || '(nada)')); log('O QUE O MODELO RECEBEU (' + (await ev('(window.__msgs || []).reduce((s, x) => s + String(x.content).length, 0)')) + ' caracteres):\n' + (await ev("(window.__msgs || []).filter(x => x.role === 'user').map(x => x.content).join('\\n')"))); }
            log('RESPOSTA (a que o cliente vê):\n' + (r.texto || '(nenhuma)'));
            if (visual && r.texto) { try { await ev("document.getElementById('colunaChat').scrollIntoView({ block: 'start' }); true"); const sh = await c.send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(pastaPrints, { recursive: true }); fs.writeFileSync(path.join(pastaPrints, 'real-' + MODELO + '-' + id + '.png'), Buffer.from(sh.data, 'base64')); } catch (e) { /* ok */ } }
        }
        log('\nCAMINHOS: ' + JSON.stringify(caminhos));
        if (tempos.length) log('TEMPO das respostas do modelo (s): ' + tempos.map(x => x.toFixed(0)).join(', ') + ' · mediana ' + tempos.slice().sort((a, b) => a - b)[Math.floor(tempos.length / 2)].toFixed(0));
        if (erros.length) log('ERROS DE JAVASCRIPT: ' + erros.join(' | '));
    } catch (e) { log('ERRO NO TESTE: ' + String(e && e.stack || e).slice(0, 600)); }
    finally {
        try { await c.send('Browser.close'); } catch (e) { /* ok */ }
        await L.sleep(800);
        try { process.kill(edge.pid); } catch (e) { /* já fechou */ }
    }
    log('\nRESUMO (' + MODELO + '): ' + resumo.ok + ' de ' + resumo.total + ' checagens ✔ em ' + escolhidos.length + ' cenário(s)');
    if (SAIDA) { try { fs.writeFileSync(SAIDA, linhas.join('\n')); } catch (e) { /* ok */ } }
    process.exit(resumo.ok === resumo.total ? 0 : 1);
})();
