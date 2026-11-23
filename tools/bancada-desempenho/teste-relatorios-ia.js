'use strict';
/* teste-relatorios-ia.js — Assistente de Relatórios (texto livre → a IA identifica os campos), no Edge de verdade (via CDP) em ?sim=1, com a API de IA SIMULADA (nada de rede de IA).
   Reproduz o defeito de 23/11/2026: com 27 campos no texto livre o modelo de RACIOCÍNIO gastava os 2.000 tokens pensando e devolvia texto VAZIO (finish_reason "length"); o chat continuava a
   resposta vazia 3 vezes e mostrava só "Erro ao identificar os campos do relatório". Confere:
     • a cadeia de modelos do mundo real (um com limite de uso 429, um fora do ar 404, um que raciocina): o relatório sai, o 404 NÃO é repetido e o pedido leva reasoning:{enabled:false};
     • modelo que NÃO deixa desligar o raciocínio (HTTP 400 "Reasoning is mandatory"): é chamado de novo sem o pedido e a cadeia lembra dele;
     • resposta vazia com "length": o pedido é repetido com 3× o limite (4.740 → 14.220 → 16.000) em vez de "continuar" o nada;
     • resposta cortada (JSON incompleto): aproveita os campos que vieram inteiros e AVISA; JSON dentro de ``` e com texto em volta; sem nada legível → erro com causa;
     • o mesmo campo pedido duas vezes (a IA devolveu "Gris" como Diária): fica o que tem o nome do campo e o outro vai para "não identificado"; expressão que não existe no catálogo também;
     • as mensagens de erro dizem a CAUSA (IA fora do ar × resposta vazia) e o que a pessoa digitou continua na tela; o prompt leva a regra de nunca "empurrar" um termo para outro campo.
   Rode (servidor do projeto em http://localhost:8080 — tools\servidor-local.bat — ou BSOFT_URL):
     $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-relatorios-ia.js | Out-String
   --verbose mostra cada verificação */
const L = require('./lib-cdp.js');
const BASE = (process.env.BSOFT_URL_BASE || 'http://localhost:8080').replace(/\/+$/, '');
const verboso = process.argv.includes('--verbose');
const PORTA = 9562;
let ok = 0; const falhas = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 400) : '')); if (verboso) console.log((cond ? '  ✔ ' : '  ✘ ') + nome + (!cond && detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 200) : '')); };

// o pedido real (27 linhas) e o que um modelo de verdade devolveu para ele (campos do catálogo real do CT-e), com a armadilha "Gris" → Diária e uma fórmula
const PEDIDO = ['Data de Emissão', 'Número', 'Remetente - Nome e CNPJ', 'Cidade/UF Origem', 'Destinatário - Nome e CNPJ', 'Cidade/UF Destino', 'Pagador Nome e CNPJ', 'Placa', 'Motorista', 'CFOP', 'Quantidade', 'Peso ',
    'Número das notas fiscais', 'Valor. NFs', 'Frete Valor', 'Outros', 'Pedágio', 'Gris', 'Diária', 'Seguro', 'CST ICMS', 'Base Cálc.', 'Alíq.', 'Vlr. ICMS', 'CST IBS e CBS', 'Valor IBS e CBS', 'Total da Prestação'];
const RESP = [['Data de Emissão', 'cte.dtEmissao'], ['Número', 'cte.nroConhecimento'], ['Remetente - Nome', 'remetente.nome'], ['Remetente - CNPJ', 'remetente.CNPJ'], ['Cidade Origem', 'cte.cidadeOrigem'], ['UF Origem', 'cte.ufOrigem'],
    ['Destinatário - Nome', 'destinatario.nome'], ['Destinatário - CNPJ', 'destinatario.CNPJ'], ['Cidade Destino', 'cte.cidadeDestino'], ['UF Destino', 'cte.ufDestino'], ['Pagador Nome', 'cliente.nome'], ['Pagador CNPJ', 'cliente.CNPJ'],
    ['Placa Veículo', 'veiculos.placaVeiculo'], ['Motorista', 'motorista.nome'], ['CFOP', 'cte.cfop'], ['Quantidade', 'docs.quantidade'], ['Peso', 'docs.somaPesos'], ['Número das notas fiscais', 'notasFiscais.nroNotas'],
    ['Valor. NFs', 'notasFiscais.valorNotas'], ['Frete Valor', 'composicaoFrete.freteValor'], ['Outros', 'composicaoFrete.outros'], ['Pedágio', 'composicaoFrete.pedagio'], ['Gris', 'composicaoFrete.diaria'], ['Diária', 'composicaoFrete.diaria'],
    ['Seguro', 'composicaoFrete.seguro'], ['CST ICMS', 'cte.cst'], ['Base Cálc.', 'composicaoFrete.baseCalculo'], ['Alíq.', 'composicaoFrete.aliq'], ['Vlr. ICMS', 'composicaoFrete.valorICMS'], ['CST IBS e CBS', 'impostosCbsIbs.cst'],
    ['Valor IBS e CBS', '(impostosCbsIbs.cbsValor)+(impostosCbsIbs.ibsEstadualValor)+(impostosCbsIbs.ibsMunicipalValor)'], ['Total da Prestação', 'composicaoFrete.totalPrestacao']];
const JSON_BOM = JSON.stringify({ encontrados: RESP.map(([label, exp]) => ({ label, exp })), naoEncontrados: [] });

// ── dentro da página: a API simulada (cada cenário diz o que cada modelo faz) ──
const FAKE = `(() => {
    window.__chamadas = []; window.__msgsIA = null; window.__comporta = () => ({ erro: { status: 500, message: 'sem cenário' } });
    window.gerarEmbedding = async () => null;
    MCP_VERIFICACAO.desligado = true;                                   // (senão, 4 s depois de abrir, a página relê o arquivo e troca a cadeia de teste pela de verdade)
    mcpAplicar(mcpNormalizar({ versao: 99, provedor: { tipo: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', chave: ['x'] }, cadeia: [] }), 'teste');
    window.__cadeia = lista => mcpAplicar(mcpNormalizar({ versao: 99, provedor: { tipo: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', chave: ['x'] }, cadeia: lista.map(m => ({ modelo: m, ativo: true })) }), 'teste');
    window.callMCPAPI = async function (provider, model, apiKey, baseUrl, messages, config) {
        window.__msgsIA = messages;
        const reg = { model, maxTokens: config.maxTokens, reasoning: config.reasoning ? JSON.stringify(config.reasoning) : null, temperature: config.temperature };
        window.__chamadas.push(reg);
        const r = window.__comporta(model, config, window.__chamadas.filter(x => x.model === model).length);
        if (r.erro) { const e = new Error('[openrouter] ' + r.erro.message); e.status = r.erro.status; throw e; }
        return { text: r.text, finishReason: r.fim || 'stop', full: {} };
    };
    return true; })()`;

(async () => {
    try { const v = await (await fetch('http://127.0.0.1:' + PORTA + '/json/version')).json(); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await L.sleep(1800); } catch (e) { /* não havia */ }
    const edge = await L.lancar({ porta: PORTA, gpu: false, w: 1366, h: 900, args: ['--headless=new', '--force-prefers-no-reduced-motion'] });
    const c = await L.abrirPagina(PORTA), ev = js => c.eval(js);
    const erros = [];
    c.on('Runtime.exceptionThrown', p => erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).slice(0, 240)));
    const esperar = async (cond, ms = 15000, passo = 100) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda */ } await L.sleep(passo); } return false; };
    try {
        await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf'); localStorage.removeItem('bsoft_v27_prefs')}catch(e){}" });
        await L.navegar(c, BASE + '/index.html?sim=1');
        await esperar("typeof Workspace !== 'undefined' && !!document.getElementById('wsStage') && typeof Ferr !== 'undefined' && typeof enviarWizardRelatorio === 'function' && typeof mcpAplicar === 'function'", 60000, 300);
        await L.sleep(1200);
        await ev(FAKE);

        // abre o assistente do zero, escolhe CT-e, preenche o nome e o texto livre
        const novoWizard = async (texto, nome) => {
            await ev("Ferr.abrir('relatorios', { novo: true }); true");
            await esperar("!!document.getElementById('wRelCampos') || !!document.querySelector('._rel-origem-btn')", 8000, 100);
            await ev(`(() => { _relSelecionarOrigem('CTe'); document.getElementById('wRelNome').value = ${JSON.stringify(nome || 'Relatorio de teste')}; document.getElementById('wRelCampos').value = ${JSON.stringify(texto)}; window.__chamadas.length = 0; return true; })()`);
        };
        const rodar = async () => { await ev('enviarWizardRelatorio().then(() => true)'); await L.sleep(150); };
        const tela = () => ev("(() => { const s = document.getElementById('ftStream_relatorios'); return s ? s.innerText : ''; })()");
        const campos = () => ev("(() => [...document.querySelectorAll('#ftStream_relatorios [id^=_relatorioResultCard_] .section-content ul li b')].map(b => b.textContent))()");
        const chamadas = () => ev('window.__chamadas');
        const cenario = async (cadeia, comporta) => { await ev('window.__cadeia(' + JSON.stringify(cadeia) + '); window.__comporta = ' + comporta + '; true'); };
        const TEXTO27 = PEDIDO.join('\n');
        await ev(`window.__JSON_BOM = ${JSON.stringify(JSON_BOM)}; true`);

        // ═════════ 1) o caso real: a cadeia de hoje (429, 404, modelo que raciocina) ═════════
        await cenario(['ernie-fake:free', 'morto-fake:free', 'raciocina-fake:free'], `(model, cfg, n) => {
            if (model === 'ernie-fake:free') return { erro: { status: 429, message: 'Provider returned error' } };
            if (model === 'morto-fake:free') return { erro: { status: 404, message: 'morto-fake:free is no longer available on OpenRouter: no provider serves this model anymore.' } };
            // modelo de raciocínio: se o raciocínio NÃO foi desligado, gasta o limite pensando e devolve vazio; desligado, responde
            if (!cfg.reasoning || cfg.reasoning.enabled !== false) return cfg.maxTokens >= 12000 ? { text: window.__JSON_BOM } : { text: '', fim: 'length' };
            return { text: window.__JSON_BOM };
        }`);
        await novoWizard(TEXTO27); await rodar();
        let f1 = await campos(), ch1 = await chamadas(), tl1 = await tela();
        t('27 campos no texto livre: o relatório SAI (antes: “Erro ao identificar os campos do relatório”)', f1.length >= 28 && /Campos identificados \(\d+\)/i.test(tl1) && !/Erro ao identificar/.test(tl1), JSON.stringify({ n: f1.length, tl: tl1.slice(-300) }));
        t('…com os rótulos que a pessoa escreveu e a fórmula de IBS/CBS (soma dos 3 valores)', f1.includes('Data de Emissão') && f1.includes('Valor. NFs') && f1.includes('Valor IBS e CBS'), JSON.stringify(f1));
        const rac = ch1.filter(x => x.model === 'raciocina-fake:free');
        t('o pedido leva reasoning:{enabled:false} e o limite sobe com a quantidade (27 itens → 4.740, não 2.000)', rac.length === 1 && rac[0].reasoning === '{"enabled":false}' && rac[0].maxTokens === 1500 + 120 * 27, JSON.stringify(rac));
        t('modelo fora do ar (404) é chamado UMA vez só (não repete); o com limite de uso (429) tenta 2 vezes', ch1.filter(x => x.model === 'morto-fake:free').length === 1 && ch1.filter(x => x.model === 'ernie-fake:free').length === 2, JSON.stringify(ch1.map(x => x.model)));
        t('“Gris” (não existe no catálogo; a IA devolveu Diária) vai para “Não identificado” e a coluna Diária de verdade fica', /Não encontrei campo correspondente para:[^\n]*Gris/.test(tl1) && f1.includes('Diária') && !f1.includes('Gris'), tl1.slice(-400));
        const dat = await ev("(() => { const k = Object.keys(window).filter(x => x.indexOf('_relatorioDat_') === 0).pop(); return k ? { n: window[k].nome, arq: window[k].nomeArquivo, len: window[k].conteudo.length, tem: window[k].conteudo.indexOf('Data de Emiss') >= 0 } : null; })()");
        t('o arquivo .dat é gerado (nome, conteúdo com os campos)', dat && dat.arq === 'Relatorio_de_teste.dat' && dat.len > 2000 && dat.tem, JSON.stringify(dat));
        const sys = await ev('(window.__msgsIA || []).filter(m => m.role === "system").map(m => m.content).join("")');
        t('o prompt leva a regra de NUNCA empurrar um termo para outro campo (exemplo Gris → Diária) e o catálogo', /NUNCA associe um termo a um campo de significado DIFERENTE/.test(sys) && /composicaoFrete\.diaria/.test(sys) && sys.length > 40000, sys.length);

        // ═════════ 2) modelo que NÃO deixa desligar o raciocínio ═════════
        await cenario(['obrigatorio-fake:free', 'reserva-fake:free'], `(model, cfg, n) => {
            if (model === 'obrigatorio-fake:free' && cfg.reasoning) return { erro: { status: 400, message: 'Reasoning is mandatory for this endpoint and cannot be disabled.' } };
            return { text: window.__JSON_BOM };
        }`);
        await novoWizard(TEXTO27); await rodar();
        let ch2 = await chamadas();
        t('HTTP 400 “Reasoning is mandatory”: o MESMO modelo é chamado de novo, sem o pedido, e responde (a cadeia não passa para o reserva)', ch2.length === 2 && ch2[0].model === 'obrigatorio-fake:free' && ch2[0].reasoning && ch2[1].model === 'obrigatorio-fake:free' && ch2[1].reasoning === null && (await campos()).length >= 28, JSON.stringify(ch2));
        await novoWizard(TEXTO27); await rodar();
        ch2 = await chamadas();
        t('…e a cadeia LEMBRA desse modelo: no pedido seguinte ele já vai sem o raciocínio, numa chamada só', ch2.length === 1 && ch2[0].model === 'obrigatorio-fake:free' && ch2[0].reasoning === null, JSON.stringify(ch2));

        // ═════════ 3) resposta VAZIA com “length” (o modelo gastou o limite pensando) ═════════
        await ev('MCP_RACIOCINIO_OBRIGATORIO.clear(); true');
        await cenario(['pensa-fake:free'], `(model, cfg, n) => (cfg.maxTokens >= 12000 ? { text: window.__JSON_BOM } : { text: '', fim: 'length' })`);
        await novoWizard(TEXTO27); await rodar();
        const ch3 = await chamadas();
        t('vazio + “length”: repete o MESMO pedido com 3× o limite (4.740 → 14.220), sem “continuar” o nada, e o relatório sai', ch3.length === 2 && ch3[0].maxTokens === 4740 && ch3[1].maxTokens === 14220 && (await campos()).length >= 28, JSON.stringify(ch3.map(x => x.maxTokens)));
        // nunca sai nada: 3 tentativas (4.740 → 14.220 → 16.000) e o erro diz a causa
        await cenario(['pensa-fake:free'], `() => ({ text: '', fim: 'length' })`);
        await novoWizard(TEXTO27); await rodar();
        const ch3b = await chamadas(), tl3 = await tela();
        t('vazio sempre: 3 tentativas com limite crescente (4.740, 14.220, 16.000 — nunca passa disso) e para', JSON.stringify(ch3b.map(x => x.maxTokens)) === '[4740,14220,16000]', JSON.stringify(ch3b.map(x => x.maxTokens)));
        t('…o erro diz que a IA devolveu resposta VAZIA/incompleta, sugere dividir a lista e mostra o detalhe técnico', /Erro ao identificar os campos do relatório\./.test(tl3) && /resposta vazia ou incompleta/.test(tl3) && /divida a lista em duas partes/.test(tl3) && /Detalhe técnico: A IA devolveu uma resposta vazia/.test(tl3) && /fim: length/.test(tl3), tl3.slice(-500));
        t('…e o que a pessoa digitou CONTINUA na tela (nome, texto livre) com o botão liberado', await ev("document.getElementById('wRelCampos') && document.getElementById('wRelCampos').value.split('\\n').length === 27 && document.getElementById('wRelNome').value === 'Relatorio de teste' && !document.getElementById('wRelBtnEnviar').disabled && /Gerar Relat/.test(document.getElementById('wRelBtnEnviar').textContent)"));

        // ═════════ 4) todos os modelos fora do ar / com limite de uso ═════════
        await cenario(['a-fake:free', 'b-fake:free'], `(model) => ({ erro: { status: 429, message: 'Provider returned error' } })`);
        await novoWizard('Agência, Ano emissão, Cancelado e CFOP'); await rodar();
        const tl4 = await tela(), ch4 = await chamadas();
        t('todos os modelos falham: a mensagem diz que a IA não respondeu (limite de uso/fora do ar), manda esperar e tentar de novo', /A IA não respondeu agora/.test(tl4) && /limite de uso ou fora do ar/.test(tl4) && /Detalhe técnico: Todos os provedores falharam/.test(tl4), tl4.slice(-400));
        t('lista curta (3 itens separados por vírgula): o limite é 1.500 + 120 × 3 = 1.860 tokens', ch4.length > 0 && ch4.every(x => x.maxTokens === 1860 && x.reasoning === '{"enabled":false}'), JSON.stringify(ch4.map(x => x.maxTokens)));

        // ═════════ 5) resposta cortada, com cerca ``` e com texto em volta ═════════
        const corte = JSON_BOM.slice(0, JSON_BOM.indexOf('{"label":"Cidade Origem"')) + '{"label":"Cidade Ori';        // termina no meio de um item
        await ev(`window.__CORTADO = ${JSON.stringify(corte)}; true`);
        await cenario(['corta-fake:free'], `() => ({ text: window.__CORTADO, fim: 'stop' })`);
        await novoWizard(TEXTO27); await rodar();
        const f5 = await campos(), tl5 = await tela();
        t('JSON cortado no meio de um item: aproveita os 4 campos que vieram inteiros e AVISA (“Resposta da IA veio cortada”)', f5.length === 4 && /Resposta da IA veio cortada/i.test(tl5) && /aproveitei só os 4 campos/.test(tl5), JSON.stringify({ f5, aviso: /veio cortada/i.test(tl5) }));
        await ev(`window.__CERCA = ${JSON.stringify('Aqui está o resultado:\n```json\n' + JSON_BOM + '\n```\nEspero ter ajudado!')}; true`);
        await cenario(['cerca-fake:free'], `() => ({ text: window.__CERCA })`);
        await novoWizard(TEXTO27); await rodar();
        t('JSON dentro de ```json e com texto em volta: lido normalmente, SEM aviso de corte', (await campos()).length >= 28 && !/veio cortada/i.test(await tela()));
        await cenario(['lixo-fake:free'], `() => ({ text: 'Desculpe, não consegui identificar os campos.' })`);
        await novoWizard(TEXTO27); await rodar();
        t('texto sem nenhum JSON: erro com a causa (“resposta vazia ou incompleta”), sem relatório', /resposta vazia ou incompleta/.test(await tela()) && (await campos()).length === 0);

        // ═════════ 6) o mesmo campo duas vezes, referência que não existe, fórmula ═════════
        await ev(`window.__DUP = ${JSON.stringify(JSON.stringify({ encontrados: [{ label: 'Gris', exp: 'composicaoFrete.diaria' }, { label: 'Pedágio', exp: 'composicaoFrete.pedagio' }, { label: 'Diária', exp: 'composicaoFrete.diaria' }, { label: 'Campo Inventado', exp: 'cte.naoExiste' }, { label: 'Frete mais pedágio', exp: 'composicaoFrete.freteValor+composicaoFrete.pedagio' }], naoEncontrados: ['Gris'] }))}; true`);
        await cenario(['dup-fake:free'], `() => ({ text: window.__DUP })`);
        await novoWizard('Gris, Pedágio, Diária, Campo Inventado, Frete mais pedágio'); await rodar();
        const f6 = await campos(), tl6 = await tela();
        t('mesmo campo pedido duas vezes: fica o que tem o NOME do campo (Diária), “Gris” sai; ordem preservada (Pedágio antes)', JSON.stringify(f6.slice(0, 2)) === '["Pedágio","Diária"]', JSON.stringify(f6));
        t('referência que não existe no catálogo (cte.naoExiste) NÃO vira coluna e é dita em “Não identificado” (antes sumia em silêncio)', !f6.includes('Campo Inventado') && /Não encontrei campo correspondente para:[^\n]*Campo Inventado/.test(tl6), tl6.slice(-300));
        t('conta com 2 campos do catálogo: ganha os parênteses que o sistema exige', f6.includes('Frete mais pedágio') && /\(composicaoFrete\.freteValor\)\+\(composicaoFrete\.pedagio\)/.test(tl6), tl6.slice(-500));
        t('“Gris” aparece UMA vez em “Não identificado” (a IA já tinha dito e o descarte repetiu)', (tl6.match(/Gris/g) || []).length === 1, (tl6.match(/Gris/g) || []).length);

        // ═════════ 7) o leitor da resposta, direto ═════════
        const lei = await ev(`(() => { const L = _lerRespostaIARelatorio, J = '{"encontrados":[{"label":"A","exp":"cte.cfop"},{"exp":"cte.dtEmissao","label":"B"}],"naoEncontrados":["x",""]}';
            return { ok: L(J), cerca: L('\`\`\`json\\n' + J + '\\n\`\`\`'), texto: L('veja: ' + J + ' fim'), invertido: L('{"encontrados":[{"exp":"cte.cfop","label":"A"},{"exp":"cte.dtEmissao","label":"B"},{"exp":"cte.ci'), vazio: L(''), nulo: L(null), lixo: L('sem json'), array: L('[1,2,3]'), semItens: L('{"encontrados":[],"naoEncontrados":["x"]}') }; })()`);
        t('leitor: JSON completo, com cerca e com texto em volta dão os 2 itens, sem “parcial”; naoEncontrados sem vazios', lei.ok && lei.ok.encontrados.length === 2 && !lei.ok.parcial && JSON.stringify(lei.ok.naoEncontrados) === '["x"]' && lei.cerca.encontrados.length === 2 && lei.texto.encontrados.length === 2 && !lei.cerca.parcial && !lei.texto.parcial, JSON.stringify(lei));
        t('leitor: cortado com itens em outra ordem (exp antes de label) → aproveita os 2 completos, parcial = true', lei.invertido && lei.invertido.encontrados.length === 2 && lei.invertido.parcial === true && lei.invertido.encontrados[0].exp === 'cte.cfop', JSON.stringify(lei.invertido));
        t('leitor: vazio, nulo, sem JSON e array solto → null; objeto válido sem itens → lista vazia (e o assistente diz “não consegui identificar nenhum campo”)', lei.vazio === null && lei.nulo === null && lei.lixo === null && lei.array === null && lei.semItens && lei.semItens.encontrados.length === 0 && !lei.semItens.parcial, JSON.stringify([lei.vazio, lei.nulo, lei.lixo, lei.array]));
        const q100 = await ev("Math.min(6000, 1500 + 120 * 100)");
        t('limite de tokens da resposta tem teto (6.000) para listas enormes', q100 === 6000);

        t('a página inteira rodou sem exceção de JavaScript', erros.length === 0, erros.join(' | '));
    } catch (e) {
        falhas.push('o teste parou por um erro inesperado: ' + (e && e.stack || e));
    }
    console.log('\n' + ok + ' verificações ok · ' + falhas.length + ' falha(s)');
    falhas.forEach(f => console.log('  ✘ ' + f));
    try { await c.send('Browser.close'); } catch (e) { /* ok */ }
    await L.sleep(800); try { process.kill(edge.pid); } catch (e) { /* ok */ }
    process.exit(falhas.length ? 1 : 0);
})();
