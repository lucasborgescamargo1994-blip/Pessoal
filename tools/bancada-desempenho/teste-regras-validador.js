'use strict';
// As CONFERÊNCIAS do Agente de Regras (v29.2.0) — js/app/regra-cte-passos.js: sintaxe, função/campo fora da documentação, def() perdido, loop.
// Roda em Node, sem navegador e sem IA (os dois arquivos do chat são carregados num "vm" com um document de mentira). Também prova que o caminho CLÁSSICO não mudou
// (sem ctx.agente nada de novo é cobrado) e que o código BOM que o sistema já tem (regras prontas, exemplo do artigo da equipe) não gera nenhum alarme falso.
// Uso: Code.exe teste-regras-validador.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..');
let ok = 0, falhas = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ✔ ' + nome); } else { falhas++; console.log('  ✘ ' + nome + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); } };

const el = () => ({ style: {}, classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, setAttribute() {}, getAttribute: () => null, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], innerHTML: '', dataset: {} });
const sandbox = { console, setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, navigator: { userAgent: 'node' }, location: { search: '', href: '' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), documentElement: el(), getElementsByName: () => [] } };
sandbox.Ferr = new Proxy({}, { get: () => () => el() });   // (assistente-regras.js fala com a tela da ferramenta ao carregar; aqui não há tela)
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of ['js/app/assistente-regras.js', 'js/app/regra-cte-passos.js']) {
    try { vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f }); } catch (e) { console.log('(aviso ao carregar ' + f + ': ' + String(e.message).slice(0, 120) + ')'); }
}
const G = n => vm.runInContext(n, ctx);
const sintaxe = G('_cnSintaxeDoCodigo'), funcoes = G('_cnFuncoesForaDaDoc'), nomesFn = G('_cnNomesDeFuncao'), conhecidos = G('_cnConhecidos'), campos = G('_cnCamposForaDaDoc'), perdidos = G('_cnDefsPerdidos'),
    doAgente = G('_cnProblemasDoAgente'), daResposta = G('_cnProblemasDaResposta');
const cerca = c => '```\n' + c + '\n```\n**O que foi alterado:** x\n**Pontos de atencao:** Nenhum.';

// trecho do artigo "Funções disponíveis…" da base da equipe (A76): é ele que diz que obtGlob, obtStr, montaObsPV, arredondaISS… existem
const DOCS = `obt() - Retornar o valor do campo e aplica formatação, caso necessária.
def() - Define o valor do campo e aplica formatação, caso necessária.
obtGlob(nome) - Retornar o valor de um acumulador global.
defGlob(nome,valor) - Define o valor de um acumulador global.
obtStr() - Obtem valor do campo sem aplicar formatação.
defStr() - Define valor do campo sem aplicar formatação.
montaObs() montaObsChave() montaObsPV() montaObsPVChave()
arredondaISS() - Aplica o arredondamento no valor do ISS calculado.
O objeto "tabelaPrecos" possui as seguintes propriedades: natureza, limiteMin, limiteMax, percentualPedagio, percentualSeguro, valorFreteMinimo, valorExcesso, Gris, percentualGris, valorSeguroAduaneiro, valorContainer.
def("outrosValores[nomeInterno]", valorAtribuído); obt("outrosValoresCF[nomeInterno]"); obtStr("tagsCTe[nomeInterno]"); defStr("tagsCTe[nomeInterno]", "valorAtribuído");
COM_RF.composicaoFrete("totalPrestacao"); COM_RF.permissaoVeiculoAbastecimento
totalPedagio, totalPeso, totalValor, totalValorMerc, totalBaseResultado, totalVolume, totalCubagem, totalPesoCubado, totalPesoTaxado
dados_tipoDocProprietario dados_tipoProp dados_enquadramentoProp dados_nroDependentes dados_frotaPropria $V(dados_tipoProp)`;
const EXEMPLO_KM = `var km = obt("km")
// Faixa 1: 0 a 100 km (valor fixo)
var faixa1 = tabelaPrecos.km0a100
var faixa2 = 0
if (km > 100) {
  faixa2 = tabelaPrecos.km101a500 * Math.min(km - 100, 400)
}
def("valorFrete", faixa1 + faixa2)
var valor = obt("valorFrete");
totPrest = (valor / ( 1 - (obt("aliquota")/100)));
def("baseCalculo", totPrest);
def("valorICMS",obt("baseCalculo") * (obt("aliquota")/100));
if ( obt("aliquota") < 0.01 )
   def("baseCalculo", 0 );
def('totalPrestacao', obt('valorFrete') + obt("valoresOutros") +obt('diaria'));
def('totalServico',obt('totalPrestacao'));`;

console.log('\n— sintaxe');
t('código certo: nada a dizer', sintaxe('def("a", (obt("b") + 1) * 2);\nif (obt("c") > 0) {\n   def("d", 1);\n}').length === 0);
t('parêntese que não fecha', sintaxe('def("a", (obt("b") + 1);').length === 1);
t('chave que sobra', sintaxe('def("a", 1);\n}').some(x => /sobrando/.test(x)));
t('aspas que não fecham', sintaxe('def("a, 1);\ndef("b", 2);').length >= 1);
t('comentário /* sem fechar', sintaxe('def("a", 1); /* esqueci').some(x => /comentario/.test(x)));
t('"(" fechado com "}" é erro', sintaxe('if (obt("a") > 1 {\n def("b",1);\n}').length >= 1);
t('parêntese dentro de texto e de comentário não conta', sintaxe('alert("atencao :)");  // ok ( sem fechar\ndef("a", 1);').length === 0);

console.log('\n— código do campo Validação (return true / return false)');
const valid = G('_cnValidacaoPerigosa');
t('o "return false" solto depois de um if sem chaves é pego (recusaria SEMPRE: o caso que a IA gerou de verdade)', valid('if (obt("merc_quantKg[]") / 1000 > 30)\n   alert("Peso acima");\nreturn false;').length === 1);
t('só "return false", sem "return true": pego', valid('return false;').length === 1);
t('com chaves e return true no fim: certo', valid('if (obt("merc_quantKg[]") > 30000) {\n   alert("Peso acima");\n   return false;\n}\nreturn true;').length === 0);
t('if sem chaves com o return na mesma instrução + return true: certo', valid('if (obt("merc_quantKg[]") > 30000) return false;\nreturn true;').length === 0);
t('"return true" condicional e "return false" no fim (padrão "não salvar"): certo', valid('if (obt("merc_quantKg[]") <= 30000) return true;\nreturn false;').length === 0);
t('else com return: certo', valid('if (obt("a") > 1) {\n  return false;\n} else {\n  return true;\n}').length === 0);
t('regra de cálculo (sem return) nunca é cobrada', valid('def("valorFrete", obt("a") * 2);').length === 0);

console.log('\n— funções que não existem');
const f1 = funcoes('if (obt("merc_quantKg[]") > 30000) {\n  msg("Peso acima");\n  preventSave();\n}');
t('msg() e preventSave() são pegos (o caso real de 14/10/2026)', f1.map(x => x.nome).sort().join() === 'msg,preventSave', f1);
t('objeto inventado (Sistema.bloquear) é pego', funcoes('Sistema.bloquear();').map(x => x.nome).join() === 'Sistema.bloquear');
t('IRRF.xyz() é pego, IRRF.defineDescontoIRRF() não', funcoes('IRRF.xyz(); IRRF.defineDescontoIRRF();').map(x => x.nome).join() === 'IRRF.xyz');
t('as funções do sistema não são cobradas (def, obt, $SV, $V, alert, montaObs, Math.*, COM_RF, document.getElementsByName)', funcoes('def("a",Math.max(obt("b"),1)); $SV("x",1); $V("y"); alert("a"); montaObs(true); COM_RF.composicaoFrete("totalPrestacao"); if (document.getElementsByName("T").length > 0) $SV("T", 1);', []).length === 0);
t('método de um valor (valor.toFixed) e função do próprio código não são cobrados', funcoes('function arredonda(v) { return Math.round(v * 100) / 100; }\nvar x = arredonda(obt("valorFrete"));\ndef("valorFrete", x.toFixed(2));').length === 0);
t('palavra seguida de "(" dentro de texto ou comentário não é chamada', funcoes('alert("use msg(x) aqui"); // msg(1)\ndef("a", 1);').length === 0);
t('obtGlob/defGlob/obtStr/defStr/montaObsPV/arredondaISS valem (estão no artigo da equipe e na lista fixa)', funcoes('defGlob("acc", obtGlob("acc") + 1); defStr("tagsCTe[x]", obtStr("tagsCTe[x]")); montaObsPV(true); arredondaISS();', []).length === 0);
t('uma função que só o artigo cita passa quando o artigo vem no contexto, e não passa sem ele', funcoes('funcaoRara(1);', nomesFn('funcaoRara(x) - faz algo')).length === 0 && funcoes('funcaoRara(1);', []).length === 1);
t('"validar()" (proibida no prompt) continua pega mesmo com o prompt citando', doAgente('validar(1);', { docs: 'validar() não existe', pedido: '' }).some(x => /validar\(\)/.test(x)));

console.log('\n— campos que não existem');
const conh = conhecidos([G('CONTEXTO_REGRAS'), DOCS]);
t('campo inventado é pego', campos('def("valorTaxaMagica", obt("pedagioTotalX"));', conh).join() === 'valorTaxaMagica,pedagioTotalX');
t('campos do sistema não são cobrados', campos('def("baseCalculo", obt("valorFrete") + obt("valorPedagioConhecimento") + obt("valoresOutros"));\ndef("Gris", obt("merc_valor[]") * 0.1);', conh).length === 0);
t('outrosValores[x], tagsCTe[x], dados_*, merc_*[i] passam', campos('obt("outrosValores[advalorem]"); obtStr("tagsCTe[abc]"); $V("dados_UFIni"); obt("merc_especie[3]"); obt("outrosValoresCF[perc]")', conh).length === 0);
t('o nome que o pedido cita passa', campos('def("valorTaxaMagica", 1);', conhecidos([G('CONTEXTO_REGRAS'), 'some o campo valorTaxaMagica no total'])).length === 0);
t('o nome que a regra original já usava passa', campos('def("campoDoCliente", 1);', conhecidos([G('CONTEXTO_REGRAS'), 'def("campoDoCliente", 2);'])).length === 0);
t('campo dentro de comentário não conta', campos('// def("inventado", 1)\ndef("valorFrete", 1);', conh).length === 0);

console.log('\n— def() que a regra original tinha e a nova perdeu');
const orig = 'def("valorFrete", obt("tarifaDigitada") * obt("merc_quantKg[]"));\ndef("valorSeguro", obt("valorFrete") * 0.01);\ndef("totalPrestacao", obt("valorFrete") + obt("valorSeguro"));';
const novo = 'def("valorFrete", obt("tarifaDigitada") * obt("merc_quantKg[]"));\ndef("totalPrestacao", obt("valorFrete") + obt("valorPedagioConhecimento"));';
t('o valorSeguro que sumiu é pego', perdidos(orig, novo, 'some o pedágio no total').join() === 'valorSeguro');
t('se o pedido mandou retirar, não cobra', perdidos(orig, novo, 'tire o seguro da regra').length === 0);
t('se o pedido é refazer/do zero, não cobra', perdidos(orig, novo, 'refaça a regra do zero').length === 0);
t('sem regra original, não há o que perder', perdidos('', novo, 'x').length === 0);

console.log('\n— loop');
const loop = doAgente('def("valorFrete", obt("totalPrestacao") * 0.9);\ndef("totalPrestacao", obt("valorFrete") + 10);', { docs: DOCS });
t('campos que dependem um do outro são pegos', loop.some(x => /^LOOP:/.test(x)), loop);

console.log('\n— junto, pelo caminho que o agente usa');
const ruim = cerca('if (obt("merc_quantKg[]") > 30000) {\n   msg("Peso acima do permitido");\n}\ndef("valorFrete", (obt("tarifaDigitada") * obt("merc_quantKg[]"));');
const pAg = daResposta(ruim, { agente: true, original: '', pedido: 'valide o peso total das notas', docs: DOCS });
t('com ctx.agente: pega a função e a sintaxe de uma vez', pAg.some(x => /msg\(\)/.test(x)) && pAg.some(x => /^SINTAXE/.test(x)), pAg);
const pCl = daResposta(ruim, { original: '', pedido: 'valide o peso total das notas' });
t('SEM ctx.agente (caminho clássico): nada de novo é cobrado — o clássico fica como era', !pCl.some(x => /msg\(\)|^SINTAXE|^LOOP|campo\(s\)/.test(x)), pCl);
t('resposta sem código (ex.: "LOOP DETECTADO: …") não gera cobrança', daResposta('LOOP DETECTADO: a -> b -> a', { agente: true }).length === 0);

console.log('\n— nenhum alarme falso no código que o sistema já tem como bom');
const bons = Object.assign({}, G('REGRAS_PREDEFINIDAS_CODE_CLASSICA'), G('REGRAS_PREDEFINIDAS_CODE'));
const nomes = Object.keys(bons);
t('as ' + nomes.length + ' regras prontas do Ct-e passam limpas (com e sem o artigo da equipe no contexto)', nomes.every(n => { const a = doAgente(bons[n], { docs: DOCS }), b = doAgente(bons[n], {}); return a.length === 0 && b.length === 0; }),
    nomes.map(n => [n, doAgente(bons[n], { docs: DOCS })]).filter(x => x[1].length).map(x => x[0] + ': ' + x[1].join(' | ')).join(' || '));
t('o exemplo de KM progressivo do artigo da equipe passa limpo', doAgente(EXEMPLO_KM, { docs: DOCS }).length === 0, doAgente(EXEMPLO_KM, { docs: DOCS }));
const receitas = G('REGRAS_CTE_RECEITAS');
const trechos = receitas.split(/\n(?=- )/).map(x => x.split('\n').filter(l => /^\s*(if|def|var)\b/.test(l) || /^   def/.test(l)).join('\n')).filter(x => /def\(/.test(x));
t('as ' + trechos.length + ' receitas do prompt (Gris, Seguro, frete por tarifa…) passam limpas', trechos.length >= 5 && trechos.every(x => doAgente(x, { docs: DOCS }).length === 0), trechos.map(x => [x, doAgente(x, { docs: DOCS })]).filter(y => y[1].length).slice(0, 2));
t('uma regra com loop pode ser a regra original sem a conferência confundir (sem def perdido quando nada mudou)', perdidos(bons.inverso, bons.inverso, 'ajuste') .length === 0);

console.log('\n' + ok + ' verificações ok · ' + falhas + ' falha(s)');
process.exit(falhas ? 1 : 0);
