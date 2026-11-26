'use strict';
/* teste-geolocaliza-retorno-vazio.js — a regra da ANTT "tipo de carga × Retorno Vazio" no Analisador de Erros (IA) do GEOLOCALIZADOR (geolocaliza.html, página separada que fica em
   Documentos\Projeto pessoal\Geolocalização IA; publicada em …github.io/Pessoal/geolocaliza), no Edge de verdade (via CDP) com a IA SIMULADA (nada de rede de IA).
   Para carga GRANEL PRESSURIZADO e CONTEINERIZADA a ANTT está OBRIGANDO "Retorno vazio = Sim": com RetornoVazio=false no REQUEST o frete mínimo que o Bsoft mostra na tela sai menor que o da
   ANTT e a operação é rejeitada ("O valor do frete informado é menor do que o valor mínimo de frete estabelecido"). Confere:
     • o prompt do SISTEMA (o que a IA recebe sempre) traz a regra: quando se aplica, como conferir no REQUEST (CodigoTipoCarga 12 = Granel Pressurizado, 4 = Conteinerizada; RetornoVazio),
       o que acontece, e a orientação (marcar “Retorno” = “Sim” no cálculo do Frete Mínimo do CIOT) — antes das bases de CIOT, com a regra crítica nº 5 e os campos nas bases;
     • a página LÊ o REQUEST (CodigoTipoCarga e RetornoVazio, com ou sem prefixo de namespace, em vários arquivos ou no texto colado) e põe o RESULTADO no FIM do pedido à IA:
       tipo de carga que exige × RetornoVazio false/ausente = ERRADO (+ a causa provável quando o RESPONSE traz a rejeição do frete mínimo, que chega com “�” no lugar do “í” e dos “ç/ã”);
       RetornoVazio true = correto; outro tipo de carga = a regra não se aplica; nada de carga no conteúdo = nenhuma seção.
   Rode (o arquivo é lido do disco; use --arquivo=… ou GEOLOCALIZA_HTML para outro caminho):
     $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-geolocaliza-retorno-vazio.js | Out-String
   --verbose mostra cada verificação */
const path = require('path'), { pathToFileURL } = require('url');
const L = require('./lib-cdp.js');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const ARQUIVO = arg('arquivo', process.env.GEOLOCALIZA_HTML || 'C:/Users/LucasBorgesCamargo/OneDrive - NSTECH GR LTDA/Documentos/Projeto pessoal/Geolocalização IA/geolocaliza.html');
const verboso = process.argv.includes('--verbose');
const PORTA = 9563;
let ok = 0; const falhas = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 500) : '')); if (verboso) console.log((cond ? '  ✔ ' : '  ✘ ') + nome + (!cond && detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 200) : '')); };

// trechos mínimos de REQUEST/RESPONSE do eFrete (sem dados pessoais): só o que a regra lê
const REQ = (tipo, retorno) => '<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:adic="http://schemas.ipc.adm.br/efrete/pefV2/AdicionarOperacaoTransporte"><SOAP-ENV:Body><AdicionarOperacaoTransporte><adic:AdicionarOperacaoTransporteRequest>' +
    '<adic:CodigoNCMNaturezaCarga>2523</adic:CodigoNCMNaturezaCarga><adic:PesoCarga>38970</adic:PesoCarga>' + (tipo === null ? '' : '<adic:CodigoTipoCarga>' + tipo + '</adic:CodigoTipoCarga>') + '<adic:AltoDesempenho>false</adic:AltoDesempenho>' +
    '<adic:DistanciaPercorrida>462</adic:DistanciaPercorrida>' + (retorno === null ? '' : '<adic:RetornoVazio>' + retorno + '</adic:RetornoVazio>') + '</adic:AdicionarOperacaoTransporteRequest></AdicionarOperacaoTransporte></SOAP-ENV:Body></SOAP-ENV:Envelope>';
const RESP_REJEICAO = '<soap:Envelope><soap:Body><Sucesso>false</Sucesso><Excecao><Mensagem>[ANTT] (Protocolo: 1.316.220.853) Erro adicionando opera\uFFFD\uFFFDo de transporte: ["Rejei\uFFFD\uFFFDo: O valor do frete informado \uFFFD menor do que o valor m\uFFFDnimo de frete estabelecido."]</Mensagem></Excecao></soap:Body></soap:Envelope>';
const RESP_OUTRO = '<soap:Envelope><soap:Body><Sucesso>false</Sucesso><Excecao><Mensagem>[ANTT] Rejei\uFFFD\uFFFDo: RNTRC do transportador est\uFFFD vencido.</Mensagem></Excecao></soap:Body></soap:Envelope>';

(async () => {
    try { const v = await (await fetch('http://127.0.0.1:' + PORTA + '/json/version')).json(); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await L.sleep(1800); } catch (e) { /* não havia */ }
    const edge = await L.lancar({ porta: PORTA, gpu: false, w: 1366, h: 900, args: ['--headless=new'] });
    const c = await L.abrirPagina(PORTA), ev = js => c.eval(js);
    const erros = [];
    c.on('Runtime.exceptionThrown', p => erros.push('exceção: ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text).slice(0, 240)));
    const esperar = async (cond, ms = 15000, passo = 150) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda */ } await L.sleep(passo); } return false; };
    try {
        await c.send('Runtime.enable'); await c.send('Page.enable');
        await L.navegar(c, pathToFileURL(path.resolve(ARQUIVO)).href);
        const pronto = await esperar("typeof montarConferenciaCarga === 'function' && typeof analisarErroLivre === 'function' && typeof callAILegado === 'function'", 30000);
        t('a página carrega e tem a conferência de carga (montarConferenciaCarga) — arquivo: ' + ARQUIVO, pronto);
        if (!pronto) throw new Error('página sem a função montarConferenciaCarga');
        const conf = (fontes, colado) => ev(`montarConferenciaCarga(${JSON.stringify(fontes)}, ${JSON.stringify(colado || '')})`);

        // ═════════ 1) o prompt do SISTEMA (sempre vai à IA) ═════════
        await ev(`window.__bodies = []; window.fetch = async (url, o) => { window.__bodies.push(JSON.parse(o.body)); return { ok: true, status: 200, text: async () => '', json: async () => ({ choices: [{ message: { content: 'resposta de teste' }, finish_reason: 'stop' }] }) }; }; true`);
        await ev(`callAILegado('pedido de teste', undefined, { provider: 'openrouter', model: 'modelo-teste', apiKey: 'chave-de-teste', baseUrl: 'https://exemplo.invalid/api' }).then(r => { window.__r = r; return true; })`);
        const msgs = await ev('window.__bodies[0].messages');
        const sis = msgs[0].content, usr = msgs[1].content;
        t('o prompt do sistema leva a REGRA DA ANTT: TIPO DE CARGA × RETORNO VAZIO (FRETE MÍNIMO)', /=== REGRA DA ANTT: TIPO DE CARGA × RETORNO VAZIO \(FRETE MÍNIMO\) ===/.test(sis));
        t('…diz quando se aplica: granel pressurizado ou conteinerizada, e que a ANTT está OBRIGANDO Retorno Vazio “Sim”', /GRANEL PRESSURIZADO ou CONTEINERIZADA, a ANTT está OBRIGANDO que o Retorno Vazio seja "Sim"/.test(sis));
        t('…diz como conferir no REQUEST: CodigoTipoCarga 12 = Granel Pressurizado · 4 = Conteinerizada, e RetornoVazio tem que ser true', /CodigoTipoCarga: 12 = Granel Pressurizado · 4 = Conteinerizada/.test(sis) && /RetornoVazio: para esses dois tipos de carga TEM que ser true/.test(sis));
        t('…explica o que acontece (frete mínimo da tela menor que o da ANTT → rejeição “valor do frete informado é menor do que o valor mínimo”)', /frete mínimo calculado e mostrado na tela do Bsoft sai MENOR/.test(sis) && /O valor do frete informado é menor do que o valor mínimo de frete estabelecido/.test(sis));
        t('…e orienta: marcar, dentro do CIOT, no cálculo do Frete Mínimo, “Retorno” = “Sim” (a tela passa a mostrar o frete mínimo REAL), conferir o Valor do Frete e gerar o CIOT de novo', /marcar, dentro do CIOT, no cálculo do Frete Mínimo, a opção "Retorno" como "Sim"/.test(sis) && /valor REAL do frete mínimo/.test(sis) && /igual ou maior que o frete mínimo mostrado DEPOIS de marcar/.test(sis) && /RetornoVazio = true/.test(sis));
        t('…vale para QUALQUER erro: se o tipo for esse e o RetornoVazio estiver false, avisar (mesmo que o erro seja outro)', /mesmo que o erro seja outro, avise se o RetornoVazio estiver false/.test(sis));
        t('…e diz onde fica o CIOT (Contrato de Frete Eletrônico / CIOT Frota Própria → Dados Gerais → campo Retorno), só com caminhos que o prompt já tinha', /Transporte\/Contrato de Frete → Contrato de Frete Eletrônico/.test(sis) && /Transporte\/CIOT Frota Própria → quadro Dados Gerais \(campo "Retorno"\)/.test(sis));
        t('a REGRA CRÍTICA nº 5 manda SEMPRE conferir o tipo de carga e o RetornoVazio do REQUEST', /\n5\. SEMPRE confira o TIPO DE CARGA \(CodigoTipoCarga\) e o RetornoVazio do REQUEST/.test(sis));
        t('a regra vem ANTES das bases de CIOT (Frota Própria e Terceiros) no prompt', sis.indexOf('=== REGRA DA ANTT') > 0 && sis.indexOf('=== REGRA DA ANTT') < sis.indexOf('BASE DE Conhecimento: CIOT FROTA PRÓPRIA') && sis.indexOf('BASE DE Conhecimento: CIOT FROTA PRÓPRIA') < sis.indexOf('BASE DE CONHECIMENTO: CIOT +FÁCIL EFRETE'));
        t('a base da Frota Própria lembra a regra no campo “Retorno” e a base de Terceiros lista CodigoTipoCarga e RetornoVazio entre os campos do REQUEST', /- Retorno: se há pagamento de retorno \(ida \+ retorno vazio do veículo\)\. Para tipo de carga Granel Pressurizado ou Conteinerizada a ANTT EXIGE Retorno = "Sim"/.test(sis) && /- Carga: CodigoTipoCarga \(tipo de carga da ANTT: 12 = Granel Pressurizado · 4 = Conteinerizada\)/.test(sis) && /- RetornoVazio \(true\/false\)/.test(sis));
        t('o resto do prompt continua (idioma, regras críticas 1–4, caminhos de menu) e o pedido vai como estava', /IDIOMA: Você DEVE responder EXCLUSIVAMENTE em português brasileiro/.test(sis) && /1\. Nunca oriente o usuário a editar manualmente um arquivo REQUEST/.test(sis) && /Gerar CIOT: Transporte\/Documentos\/CT-e/.test(sis) && usr === 'pedido de teste');

        // ═════════ 2) a conferência automática (a página lê o REQUEST) ═════════
        const c1 = await conf({ 'REQUEST_1.log': REQ(12, 'false'), 'RESPONSE_1.log': RESP_REJEICAO });
        t('Granel Pressurizado (12) com RetornoVazio=false + rejeição do frete mínimo no RESPONSE: ERRADO, ANTT EXIGE Sim e a causa provável é o Retorno Vazio não marcado', /REQUEST_1\.log: CodigoTipoCarga=12 \(Granel Pressurizado\) e RetornoVazio=false → ERRADO: para Granel Pressurizado a ANTT EXIGE Retorno Vazio = Sim \(RetornoVazio=true\)\./.test(c1) && /O RESPONSE traz a rejeição do valor mínimo de frete: a causa provável é o Retorno Vazio não marcado/.test(c1) && /marcar "Retorno" = "Sim" no cálculo do Frete Mínimo do CIOT/.test(c1), c1);
        t('…o RESPONSE (sem tipo de carga) não vira linha própria e a mensagem com “�” no lugar de acentos é reconhecida', !/RESPONSE_1\.log/.test(c1));
        const c2 = await conf({ 'REQUEST.log': REQ(4, 'false') });
        t('Conteinerizada (4) com RetornoVazio=false, SEM a rejeição: ERRADO, e a linha diz para avisar mesmo que o erro analisado seja outro (sem afirmar a rejeição)', /CodigoTipoCarga=4 \(Conteinerizada\) e RetornoVazio=false → ERRADO/.test(c2) && /Mesmo que o erro analisado seja outro, avise que o Retorno Vazio precisa ser "Sim"/.test(c2) && !/traz a rejeição do valor mínimo/.test(c2), c2);
        const c3 = await conf({ 'REQUEST.log': REQ(12, 'true'), 'RESPONSE.log': RESP_REJEICAO });
        t('Granel Pressurizado com RetornoVazio=true: “correto” — e NÃO chuta o Retorno como causa mesmo com a rejeição do frete mínimo (outros fatores: km, eixos, tabela)', /RetornoVazio=true → correto: para Granel Pressurizado a ANTT exige Retorno Vazio = Sim\./.test(c3) && !/ERRADO/.test(c3) && !/causa provável/.test(c3) && !/Mesmo que o erro/.test(c3), c3);
        const c4 = await conf({ 'REQUEST.log': REQ(12, null) });
        t('Granel Pressurizado SEM a tag RetornoVazio: conta como errado (“RetornoVazio não aparece no REQUEST”)', /RetornoVazio não aparece no REQUEST → ERRADO/.test(c4), c4);
        const c5 = await conf({ 'REQUEST.log': REQ(5, 'false'), 'RESPONSE.log': RESP_REJEICAO });
        t('Carga Geral (5) com RetornoVazio=false: a regra NÃO se aplica (não manda marcar Retorno nem culpa o Retorno Vazio)', /CodigoTipoCarga=5 \(não é Granel Pressurizado nem Conteinerizada: a regra de Retorno Vazio obrigatório da ANTT não se aplica por este critério\) e RetornoVazio=false\./.test(c5) && !/ERRADO/.test(c5) && !/causa provável/.test(c5), c5);
        t('conteúdo sem tipo de carga nem RetornoVazio (só um RESPONSE de outro erro) → nenhuma conferência', (await conf({ 'RESPONSE.log': RESP_OUTRO })) === '' && (await conf({})) === '' && (await conf(null, '')) === '');
        const c7 = await conf({ 'REQUEST_A.log': REQ(12, 'false'), 'REQUEST_B.log': REQ(5, 'true'), 'RESPONSE_A.log': RESP_REJEICAO });
        t('vários arquivos: cada REQUEST tem a sua linha (A errado, B de outro tipo) e a rejeição vem do RESPONSE', /REQUEST_A\.log: CodigoTipoCarga=12 \(Granel Pressurizado\)[^\n]*ERRADO/.test(c7) && /REQUEST_B\.log: CodigoTipoCarga=5 \(não é Granel/.test(c7) && /causa provável/.test(c7), c7);
        const c8 = await conf({}, REQ(4, 'false'));
        t('texto COLADO (sem arquivo): vira a fonte “conteúdo colado”', /conteúdo colado: CodigoTipoCarga=4 \(Conteinerizada\) e RetornoVazio=false → ERRADO/.test(c8), c8);
        const c9 = await conf({ 'req.xml': '<CodigoTipoCarga> 12 </CodigoTipoCarga>\n<x:RetornoVazio>\n TRUE \n</x:RetornoVazio>', 'req2.xml': '<a.b:CodigoTipoCarga>12</a.b:CodigoTipoCarga><RetornoVazio>False</RetornoVazio>', 'req3.xml': '<CodigoTipoCarga>abc</CodigoTipoCarga>' });
        t('tags sem prefixo, com prefixo, com espaços/quebras e em maiúsculas: lidas do mesmo jeito (true/True/TRUE); código que não é número não é tipo conhecido', /req\.xml: CodigoTipoCarga=12 \(Granel Pressurizado\) e RetornoVazio=true → correto/.test(c9) && /req2\.xml: CodigoTipoCarga=12 \(Granel Pressurizado\) e RetornoVazio=false → ERRADO/.test(c9) && /req3\.xml: CodigoTipoCarga=abc \(não é Granel/.test(c9), c9);

        // ═════════ 3) o pedido que vai à IA (analisarErroLivre) ═════════
        await ev(`window.callAI = async (p, s) => { window.__pedido = p; window.__sist = s; return 'resposta de teste da IA'; }; true`);
        const analisar = async (arquivos, colado) => {
            await ev(`uploadedFiles = ${JSON.stringify(arquivos)}; document.getElementById('combinedContentInput').value = ${JSON.stringify(colado || '')}; window.__pedido = null; analisarErroLivre().then(() => true)`);
            await esperar('window.__pedido !== null', 5000, 50); await L.sleep(100);
            return ev('window.__pedido');
        };
        const p1 = await analisar({ 'REQUEST_1.log': REQ(12, 'false'), 'RESPONSE_1.log': RESP_REJEICAO });
        t('o pedido à IA leva os 2 arquivos e termina com a CONFERÊNCIA AUTOMÁTICA DA PÁGINA (no fim, onde os modelos pequenos mais obedecem)', /^## ARQUIVO: REQUEST_1\.log\n/.test(p1) && /## ARQUIVO: RESPONSE_1\.log\n/.test(p1) && /\n## CONFERÊNCIA AUTOMÁTICA DA PÁGINA \(já verificada no REQUEST — use na análise e siga a REGRA DA ANTT: TIPO DE CARGA × RETORNO VAZIO\):\n- REQUEST_1\.log: CodigoTipoCarga=12 \(Granel Pressurizado\) e RetornoVazio=false → ERRADO/.test(p1) && /conferir o Valor do Frete\.\n\n$/.test(p1), p1.slice(-700));
        t('…e a análise aparece na tela (a resposta da IA) sem erro', /ANÁLISE DA IA/.test(await ev("document.getElementById('analiseAlertContainer').textContent")) && /resposta de teste da IA/.test(await ev("document.getElementById('analiseAlertContainer').textContent")));
        const p2 = await analisar({ 'RESPONSE.log': RESP_OUTRO });
        t('arquivo sem tipo de carga: o pedido fica EXATAMENTE como era (sem a seção de conferência)', /^## ARQUIVO: RESPONSE\.log\n```\n[\s\S]*\n```\n\n$/.test(p2) && !/CONFERÊNCIA AUTOMÁTICA/.test(p2), p2.slice(0, 200));
        const p3 = await analisar({}, REQ(4, 'false'));
        t('só texto colado: o pedido leva “## CONTEÚDO:” e depois a conferência (“conteúdo colado”)', /^## CONTEÚDO:\n```\n/.test(p3) && /conteúdo colado: CodigoTipoCarga=4 \(Conteinerizada\) e RetornoVazio=false → ERRADO/.test(p3) && p3.indexOf('## CONTEÚDO:') < p3.indexOf('## CONFERÊNCIA AUTOMÁTICA'), p3.slice(-400));
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
