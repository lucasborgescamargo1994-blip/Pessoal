/* js/app/assistente-regras.js — Assistente de criação de regras. */
// ═══════════════════════════════════════════════════════════
//  ASSISTENTE DE CRIAÇÃO DE REGRAS
// ═══════════════════════════════════════════════════════════
const CONTEXTO_REGRAS = `
Para definir um campo não visível como por exemplo o CST (definir apenas se o usuário solicitar), pode usar a função $SV colocando como no exemplo abaixo:
$SV("dados_CST", '40');
obs. Caso precisar adicionar algo em algum calculo, por exemplo o pedágio na base de cálculo do ICMS, ela ficaria def("baseCalculo", (obt("valorFrete") + obt("valoresOutros") + obt("valorPedagioConhecimento") ));
Campos que não vão aparecer no bloco de componentes do valor da prestação de serviço do DACTE: (Padrão todos os itens abaixo na coluna esquerda)
tarifaImpressa
diaria
Gris
valorFrete
valorICMS
valoresOutros
valorPedagioConhecimento
valorSeguro
valorSeguroAduaneiro
Tabela de preço - campos disponíveis para usar para fazer a regra, da esquerda nome real da direita nome que deve usar na regra, exemplo obt("valorFreteMinimo"):
L. max: limiteMaximo
L. min: limiteMinimo
Tarifa real: tarifaReal
Tarifa final: tarifaFinal
Outros: outros
Frete Mínimo: valorFreteMinimo
Diaria: diaria
Frete valor: freteValor
Total Prestação: totalPrestacao
Pedágio: pedagio
Fração pedágio: percPedagio
Seguro: seguro
%Seguro: percSeguro
Seg. aduaneiro: valorSeguroAduaneiro
Gris: gris
%Gris: percGris
Excesso: valorExcesso
Podem ser criados campos personalizados para a Tabela de preço, para criar é em Transporte > Configurações > Tabelas de Preços > Tabela de preços Valores Outros. Para criar pede um nome interno e uma descrição. O nome interno é o que deve ser usado na regra. Exemplo: Nome Interno: advalorem, Descrição: Valor Advalorem, na regra colocar sem obt e nem nada, apenas tabelaPrecos.nomeinterno, que ficaria tabelaPrecos.advalorem. Obs. todos os campos da tabela preço devem ser sem o obt("").
Ct-e(Conhecimento) - campos disponíveis para usar para fazer a regra, da esquerda nome real da direita nome que deve usar na regra, exemplo obt("tarifaDigitada"):
Tarifa Final: tarifaDigitada
Tarifa Real: tarifaCalculada
Frete Valor: valorFrete
Base Cálculo ICMS: baseCalculo
Alíquota ICMS: aliquota
Valor ICMS: valorICMS
Outros: valoresOutros
Pedágio: valorPedagioConhecimento
Gris: Gris
Diária: diaria
Seguro: valorSeguro
Total Serviço: totalServico
Total Prestação: totalPrestacao
Valor total das notas fiscais: merc_valor[]
Valor total do peso das Notas fiscais: merc_quantKg[]
Quantidade total das Notas fiscais: merc_quant[]
Podem ser criados campos personalizados para o Ct-e (conhecimento), para criar é em Transporte > Configurações > Tipos Valores Outros. Para criar pede um nome interno e uma descrição. O nome interno é o que deve ser usado na regra. Exemplo: Nome Interno: advalorem, Descrição: Valor Advalorem, na regra colocar obt("advalorem"). Obs: Para os campos personalizados do Ct-e, devem ser sempre chamados com a função obt.

Exemplo regra cálculo inverso:
def("tarifaCalculada",0);
if ( obt("tarifaDigitada") > 0)
   def("valorFrete", (obt("merc_quantKg[]")) * obt("tarifaDigitada"));
var inverso = ((100 - obt("aliquota")) /100)
if ( obt("aliquota") > 0)
def("baseCalculo", ((obt("valorFrete") + obt("valoresOutros")) / inverso));
if ( obt("aliquota") < 1)
def("baseCalculo", 0);
valor = obt("baseCalculo") * (obt("aliquota")/100);
def("valorICMS",valor);
def("totalPrestacao",  (obt("valorFrete") + obt("valorICMS")));

Exemplo regra ICMS Demonstrativo:
def("tarifaCalculada",0);
if ( obt("tarifaDigitada") > 0)
   def("valorFrete", (obt("merc_quantKg[]")) * obt("tarifaDigitada")/1000);
if ( obt("aliquota") > 0)
def("baseCalculo", (obt("valorFrete")));
if ( obt("aliquota") < 1)
def("baseCalculo",0);
valor = obt("baseCalculo") * (obt("aliquota")/100);
def("valorICMS",valor);
def("totalPrestacao",  (obt("valorFrete")));

Exemplo regra Somar ICMS:
def("tarifaCalculada",0);
if ( obt("tarifaDigitada") > 0)
   def("valorFrete", (obt("merc_quantKg[]")) * obt("tarifaDigitada"));
if ( obt("aliquota") > 0)
def("baseCalculo", (obt("valorFrete")));
if ( obt("aliquota") < 1)
def("baseCalculo", 0);
valor = obt("baseCalculo") * (obt("aliquota")/100);
def("valorICMS",valor);
def("totalPrestacao",  (obt("valorFrete") + obt("valorICMS")));

Exemplo regra Simples Nacional:
def("tarifaCalculada",0);
if ( obt("tarifaDigitada") > 0)
   def("valorFrete", (obt("merc_quantKg[]")) * obt("tarifaDigitada"));
def("totalPrestacao",  (obt("valorFrete")));
`;

// ─── PROMPT CONTRATO DE FRETE ──────────────────────────────
const CONTEXTO_CONTRATO_FRETE = `
Para puxar dados totais do Ct-e vinculado para o contrato de frete, pode ser usada a expressão COM_RF.
Exemplo: valorTotalPrestacao = COM_RF.composicaoFrete("totalPrestacao"); def("valorTotalOrigem", valorTotalPrestacao);
Campos do Contrato de Frete (nome real: variável na regra):
Tolerância: tolerancia | Tarifa do Motorista: tarifaMotoristaCalculada | Peso de Coleta: pesoColeta
Tarifa (kg): tarifaMotoristaDigitada | Valor do Contrato: valorTotalOrigem | Diária: diariaFrete
Outros Descontos: outrosDescontos | Outros Acréscimos: outrosAcrescimos | Valor Tonelada: outrosValoresCF[valorTon]
Desconto INSS (%): descontoINSS | Valor Desconto INSS: totalDescontoINSS
Desconto SEST (%): descontoSEST | Desconto SEST/SENAT (Valor): totalDescontoSEST
Base Cálculo IR: baseCalculoIRRF | Desconto IRRF: descontoIRRF | Desconto Seguro: descontoSeguro
Pedágio: valorPedagio | Frete Líquido: freteLiquido | Adiantamento: valorAdiantamento
Nro. parcelas: nroParcelas | Combustível: valorCombustivel | Peso Chegada: pesoChegada
Desconto Quebra Peso: descontoQuebraPeso | Saldo: saldo | Saldo Combustível: saldoCombustivel
Complemento: valorComplemento | Resultado: resultado

Exemplo regra COMBINADO MOTORISTA:
def("tarifaMotoristaCalculada", 0);
valor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoINSS") / 100)
def("totalDescontoINSS", valor);
valor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoSEST") / 100)
def("totalDescontoSEST", valor);
valorBase = (((obt("valorTotalOrigem"))*0.10)- obt("totalDescontoINSS"));
def("baseCalculoIRRF", valorBase);
IRRF.defineDescontoIRRF();
valor =  obt("valorTotalOrigem")  + obt("outrosAcrescimos") - obt("outrosDescontos") - obt("totalDescontoINSS") - obt("totalDescontoSEST")  - obt("descontoIRRF");
def("freteLiquido", valor);
valor = obt("freteLiquido")  - obt("descontoQuebraPeso");
def("saldo", valor - obt("valorAdiantamento"));
def("resultado", obt("totalPrestacaoTerceiraAba") - obt("valorTotalOrigem") );
`;

const CONTEXTO_FATURAMENTO = `
Exemplo de regra padrão de faturamento:
def("totalPrestacao", obt('freteValor') + obt('valorICMS'));

Campos disponíveis no faturamento:
notaFiscal, freteValor, valorICMS, valoresOutros, valoresPedagio, outrosDescontos, pesoColeta, pesoChegadaReal, descontoQuebraPesoReal, totalPrestacao, tolerancia, tarifaMotoristaDigitada, regraFrete

Para regras de faturamento também é possível utilizar os seguintes campos do conhecimento (Ct-e):
regraFrete, clienteCTRC_id, tiposTaloes_id, tipoQuebra
cidadeColeta, estadoColeta, nomeRemetente
cidadeDestino, estadoDestino
pesoMercadorias, quantMercadorias, valorMercadorias
totalPrestacaoCT, totalServicoCT

REGRA DE SINTAXE OBRIGATÓRIA:
- Campos do tipo TEXTO usam o método $V — exemplo: $V('tipoQuebra')
- Campos do tipo VALOR (numérico) usam o método obt — exemplo: obt('totalPrestacaoCT');
- Valores de "outros valores" do conhecimento usam obt('outrosValores[nomeInterno]') — troque nomeInterno pelo campo pedido.
`;

// ─── LIMITE DE TOKENS DA RESPOSTA DA IA NOS GERADORES DE REGRA ───
// Vale para todos os geradores (Ct-e clássico e Nova Versão, Contrato de Frete, Faturamento e a conversa de criação de regra). Os prompts de regra são grandes (documentação +
// regra montada + pedido) e os modelos grátis "pensam" antes de responder (o pensamento também gasta tokens): com 3000, a resposta chegava cortada e o mcp.js tinha que continuar
// sozinho ("[Continuação 1/3] Resposta truncada detectada…" no console). 8000 dá folga e fica dentro do teto de 8192 dos modelos Gemini (provedor "google"). Se ainda aparecer
// a continuação, a regra gerada é grande: suba aqui (e confira o teto do modelo).
const REGRAS_MAX_TOKENS = 8000;

// ─── WIZARD DE CRIAÇÃO DE REGRAS ───────────────────────────
let _regraWizardResolve=null,_wizardQueryOriginal='',_wizardCteBase64=null,_wizardTabelaBase64=null;
function _resolverEscolhaRegra(e){const c=document.getElementById('regraEscolhaCard');if(c)c.remove();if(_regraWizardResolve){_regraWizardResolve(e);_regraWizardResolve=null;}}
function perguntarAuxilioRegra(){return new Promise(resolve=>{_regraWizardResolve=resolve;const s=document.getElementById('chatStream');const card=document.createElement('div');card.id='regraEscolhaCard';card.className='answer-card';card.innerHTML=`<div style="background:#f0fdf4;padding:8px 15px;border-bottom:1px solid #bbf7d0;font-size:11px;color:#166534;font-weight:600;">⚙️ Criação de Regras</div><div class="answer-section"><div class="section-content"><div style="font-size:13px;color:#374151;margin-bottom:10px;">Precisa de auxílio para criar/editar a regra?</div><div style="display:flex;gap:10px;"><button onclick="_resolverEscolhaRegra('sim')" style="flex:1;padding:10px 16px;background:#16a34a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">✅ Sim — abrir assistente</button><button onclick="_resolverEscolhaRegra('nao')" style="flex:1;padding:10px 16px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">🔍 Não — buscar no banco</button></div></div></div>`;s.appendChild(card);scrollToBottom(true);});}
let _tipoRegraResolve=null,_wizardContratoQuery='';
function _resolverTipoRegra(tipo){const c=document.getElementById('tipoRegraCard');if(c)c.remove();if(_tipoRegraResolve){_tipoRegraResolve(tipo);_tipoRegraResolve=null;}}
function perguntarTipoRegra(){return new Promise(resolve=>{_tipoRegraResolve=resolve;const s=Ferr.stream('regra');const card=document.createElement('div');card.id='tipoRegraCard';card.className='answer-card';card.innerHTML=`<div style="background:#f5f3ff;padding:8px 15px;border-bottom:1px solid #ddd6fe;font-size:11px;color:#5b21b6;font-weight:600;">⚙️ Tipo de Regra</div><div class="answer-section"><div class="section-content"><div style="font-size:13px;color:#374151;margin-bottom:10px;">Para qual tipo de regra precisa de auxílio?</div><div style="display:flex;flex-wrap:wrap;gap:10px;"><button onclick="_resolverTipoRegra('cte')" style="flex:1 1 calc(50% - 10px);min-width:220px;padding:10px 16px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">📄 Ct-e / Conhecimento</button><button onclick="_resolverTipoRegra('cte-nova')" style="flex:1 1 calc(50% - 10px);min-width:220px;padding:10px 16px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">✨ Ct-e / Conhecimento Nova Versão <span style="background:#fde047;color:#713f12;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:800;vertical-align:1px;">NOVO</span><span style="display:block;font-size:10.5px;font-weight:500;opacity:.92;margin-top:2px;">Passo a passo, uma tela por vez</span></button><button onclick="_resolverTipoRegra('contrato')" style="flex:1 1 calc(50% - 10px);min-width:220px;padding:10px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">🚛 Contrato de Frete</button><button onclick="_resolverTipoRegra('faturamento')" style="flex:1 1 calc(50% - 10px);min-width:220px;padding:10px 16px;background:#059669;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">💰 Faturamento</button></div></div></div>`;s.appendChild(card);ferrRolar('regra', true);});}
let _modoContratoResolve=null;
function _resolverModoContrato(modo){const c=document.getElementById('modoContratoCard');if(c)c.remove();if(_modoContratoResolve){_modoContratoResolve(modo);_modoContratoResolve=null;}}
// 09/09/2026, a pedido: formulário clássico de Contrato de Frete desativado — vai direto pro
// montador novo (arrastar campos), sem perguntar mais o modo. O código do clássico continua no
// arquivo (mostrarWizardContrato e afins), só ficou inalcançável por segurança, caso precise
// reativar; não removi de vez pra não arriscar quebrar algo referenciado noutro lugar.
function perguntarModoContrato(){return Promise.resolve('dnd');}
let _modoCteResolve=null;
function _resolverModoCte(modo){const c=document.getElementById('modoCteCard');if(c)c.remove();if(_modoCteResolve){_modoCteResolve(modo);_modoCteResolve=null;}}
// 09/09/2026, a pedido: formulário clássico de Ct-e desativado — mesma ideia do Contrato de Frete
// acima (vai direto pro montador novo, código antigo mantido mas inalcançável).
function perguntarModoCte(){return Promise.resolve('dnd');}

// Base ESTÁVEL usada só pelo assistente clássico (o formulário antigo, mantido à parte como
// alternativa) — não muda conforme a lista de botões da ferramenta nova (arrastar campos) é
// curada/reorganizada, pra não quebrar silenciosamente as opções predefinidas de lá.
const REGRAS_PREDEFINIDAS_CODE_CLASSICA={
    icms_demo:`def("tarifaCalculada",0);\nvar valorcalculado = (obt("merc_quantKg[]")) * obt("tarifaDigitada")/1000;\nif ( obt("tarifaDigitada") > 0)\n   def("valorFrete", valorcalculado);\n//CÁLCULO FRETE MÍNIMO\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\nif ( obt("aliquota") > 0)\n   def("baseCalculo", (obt("valorFrete")));\nif ( obt("aliquota") < 1)\n   def("baseCalculo",0);\nvalor = obt("baseCalculo") * (obt("aliquota")/100);\ndef("valorICMS",valor);\ndef("totalPrestacao",  (obt("valorFrete")));`,
    simples:`def("tarifaCalculada",0);\nvar valorcalculado = (obt("merc_quantKg[]")) * obt("tarifaDigitada");\nif ( obt("tarifaDigitada") > 0)\n   def("valorFrete", valorcalculado);\n//CÁLCULO FRETE MÍNIMO\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\ndef("totalPrestacao",  (obt("valorFrete")));`,
    inverso:`def("tarifaCalculada",0);\nvar valorcalculado = (obt("merc_quantKg[]")) * obt("tarifaDigitada");\nif ( obt("tarifaDigitada") > 0)\n   def("valorFrete", valorcalculado);\n//CÁLCULO FRETE MÍNIMO\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\nvar inverso = ((100 - obt("aliquota")) /100)\nif ( obt("aliquota") > 0)\n   def("baseCalculo", ((obt("valorFrete") + obt("valoresOutros")) / inverso));\nif ( obt("aliquota") < 1)\n   def("baseCalculo", 0);\nvalor = obt("baseCalculo") * (obt("aliquota")/100);\ndef("valorICMS",valor);\ndef("totalPrestacao",  (obt("valorFrete") + obt("valorICMS")));`,
    soma_icms:`def("tarifaCalculada",0);\nvar valorcalculado = (obt("merc_quantKg[]")) * obt("tarifaDigitada");\nif ( obt("tarifaDigitada") > 0)\n   def("valorFrete", valorcalculado);\n//CÁLCULO FRETE MÍNIMO\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\nif ( obt("aliquota") > 0)\n   def("baseCalculo", (obt("valorFrete")));\nif ( obt("aliquota") < 1)\n   def("baseCalculo", 0);\nvalor = obt("baseCalculo") * (obt("aliquota")/100);\ndef("valorICMS",valor);\ndef("totalPrestacao",  (obt("valorFrete") + obt("valorICMS")));`,
    peso_cubado_gris:`var pesoReal = obt("merc_quantKg[]");\nvar pesoCubado = obt("merc_cubagem[]") * 150;\nvar pesoDeUso = 0;\n\nif (pesoCubado > pesoReal) {\n    pesoDeUso = pesoCubado;\n} else {\n    pesoDeUso = pesoReal;\n}\n\nvar freteBaseTabela = tabelaPrecos.valorFrete;\nvar valorFinalFrete = 0;\n\nif (pesoDeUso > 150) {\n    var kgExcedente = pesoDeUso - 150;\n    var valorDoExcesso = kgExcedente * tabelaPrecos.valorExcesso;\n    valorFinalFrete = freteBaseTabela + valorDoExcesso;\n} else {\n    valorFinalFrete = freteBaseTabela;\n}\n\ndef("valorFrete", valorFinalFrete);\n\n//CÁLCULO FRETE MÍNIMO\nif (valorFinalFrete < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\n\nvar vGris = obt("merc_valor[]") * (0.2 / 100);\ndef("Gris", vGris);\n\ndef("totalPrestacao", (\n    obt("valorFrete") + \n    obt("valoresOutros") + \n    obt("valorSeguro") + \n    obt("valorPedagioConhecimento") + \n    obt("diaria") +\n    obt("Gris")\n));`,
    tabela_simples:`def("aliquota", 0);\ndef("baseCalculo", 0);\ndef("valorICMS", 0);\n\nvar valorcalculado = (obt("tarifaDigitada")) * obt("merc_quantKg[]")/1000;\nif (obt("tarifaDigitada") > 0)\ndef("valorFrete", valorcalculado);\n\n//CÁLCULO FRETE MÍNIMO\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\n\ndef('totalPrestacao', obt('valorFrete'));`,
    tabela_icms_demo:`var valorcalculado = (obt("tarifaDigitada")) * obt("merc_quantKg[]")/1000;\nif (obt("tarifaDigitada") > 0)\ndef("valorFrete", valorcalculado);\n\n//CÁLCULO FRETE MÍNIMO\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\n\nif ( obt("aliquota") > 0)\ndef("baseCalculo", (obt("valorFrete")));\n\nif ( obt("aliquota") < 1)\ndef("baseCalculo",0);\n\ndef("valorICMS", obt("baseCalculo") * (obt("aliquota")/100));\n\ndef("totalPrestacao",  (obt("valorFrete")));`
};
// Lista curada usada só pela ferramenta nova (arrastar campos) — evolui conforme pedido, sem
// afetar o assistente clássico acima.
// Código-base compartilhado pelas 3 variações "REGRA BASE PARA: ..." abaixo — o texto é IDÊNTICO
// nas 3; a única diferença entre elas é qual opção do grupo "Cálculo do ICMS" já vem marcada ao
// selecionar cada uma (ver CTE_REGRA_PRE_OPCAO, em _cteUsarPredefinida).
const _CTE_CODIGO_REGRA_BASE=`//CÁLCULO FRETE MÍNIMO\nvar valorcalculado = (obt("tarifaDigitada") * obt("merc_quantKg[]")/1000);\nif (obt("tarifaDigitada") > 0)\ndef("valorFrete", valorcalculado);\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\n\n//CÁLCULO DO ICMS\nif ( obt("aliquota") == 0)\ndef("baseCalculo",0);\nif ( obt("aliquota") > 0)\ndef("baseCalculo", (obt("valorFrete")));\ndef("valorICMS", obt("baseCalculo") * (obt("aliquota")/100));\n//FIM CÁLCULO DO ICMS\n\n//CÁLCULO TOTAL PRESTAÇÃO\ndef('totalPrestacao', obt('valorFrete') + obt("valoresOutros") + obt('valoresOutros') + obt('valorPedagioConhecimento') + obt('Gris') + obt('valorSeguro') + obt('diaria'));\n//FIM CÁLCULO TOTAL PRESTAÇÃO\n\n//CÁLCULO TOTAL SERVIÇO\ndef('totalServico', obt('totalPrestacao')); \n//FIM CÁLCULO TOTAL SERVICO\n\nmontaObs()`;
const REGRAS_PREDEFINIDAS_CODE={
    regra_base_icms_demo:_CTE_CODIGO_REGRA_BASE,
    regra_base_icms_inverso:_CTE_CODIGO_REGRA_BASE,
    regra_base_icms_somar:_CTE_CODIGO_REGRA_BASE,
    peso_cubado_gris:`var pesoReal = obt("merc_quantKg[]");\nvar pesoCubado = obt("merc_cubagem[]") * 150;\nvar pesoDeUso = 0;\n\nif (pesoCubado > pesoReal) {\n    pesoDeUso = pesoCubado;\n} else {\n    pesoDeUso = pesoReal;\n}\n\nvar freteBaseTabela = tabelaPrecos.valorFrete;\nvar valorFinalFrete = 0;\n\nif (pesoDeUso > 150) {\n    var kgExcedente = pesoDeUso - 150;\n    var valorDoExcesso = kgExcedente * tabelaPrecos.valorExcesso;\n    valorFinalFrete = freteBaseTabela + valorDoExcesso;\n} else {\n    valorFinalFrete = freteBaseTabela;\n}\n\ndef("valorFrete", valorFinalFrete);\n\n//CÁLCULO FRETE MÍNIMO\nif (valorFinalFrete < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);\n//FIM CÁLCULO FRETE MÍNIMO\n\nvar vGris = obt("merc_valor[]") * (0.2 / 100);\ndef("Gris", vGris);\n\ndef("totalPrestacao", (\n    obt("valorFrete") + \n    obt("valoresOutros") + \n    obt("valorSeguro") + \n    obt("valorPedagioConhecimento") + \n    obt("diaria") +\n    obt("Gris")\n));`
};
const CALC_FRETE_MAP={
    nenhum:'Usuario digitara o valorFrete manualmente — NAO gere def("valorFrete") nem def("tarifaCalculada")',
    nao_calcular:'Nao calcular (def("tarifaCalculada",0))',
    tf_pt:'Tarifa final x peso total → def("valorFrete", obt("tarifaDigitada") * obt("merc_quantKg[]"))',
    tf_pt_1000:'Tarifa final x peso total / 1000 → def("valorFrete", obt("tarifaDigitada") * obt("merc_quantKg[]") / 1000)',
    tf_qt:'Tarifa final x quantidade total → def("valorFrete", obt("tarifaDigitada") * obt("merc_quant[]"))',
    tf_vt_doc:'Tarifa final x valor total (Valor do documento) → def("valorFrete", obt("tarifaDigitada") * obt("merc_valor[]"))',
    tf_vt_prod:'Tarifa final x valor total (Valor do produto) → def("valorFrete", obt("tarifaDigitada") * obt("merc_valor[]"))',
    prest_icms:'Total da prestacao - valor do ICMS (totalPrestacao inclui ICMS embutido)'
};

const REGRAS_PREDEFINIDAS_CONTRATO={
    combinado_motorista:`def("tarifaMotoristaCalculada", 0);\nvalor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoINSS") / 100)\ndef("totalDescontoINSS", valor);\nvalor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoSEST") / 100)\ndef("totalDescontoSEST", valor);\nvalorBase = (((obt("valorTotalOrigem"))*0.10)- obt("totalDescontoINSS"));\ndef("baseCalculoIRRF", valorBase);\nIRRF.defineDescontoIRRF();\nvalor =  obt("valorTotalOrigem")  + obt("outrosAcrescimos") - obt("outrosDescontos") - obt("totalDescontoINSS") - obt("totalDescontoSEST")  - obt("descontoIRRF");\ndef("freteLiquido", valor);\nvalor = obt("freteLiquido")  - obt("descontoQuebraPeso");\ndef("saldo", valor - obt("valorAdiantamento"));\ndef("resultado", obt("totalPrestacaoTerceiraAba") - obt("valorTotalOrigem") );`,
    combinado_motorista_frete_minimo:`def("tarifaMotoristaCalculada", 0);\nvalor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoINSS") / 100)\ndef("totalDescontoINSS", valor);\nvalor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoSEST") / 100)\ndef("totalDescontoSEST", valor);\nvalorBase = (((obt("valorTotalOrigem"))*0.10)- obt("totalDescontoINSS"));\ndef("baseCalculoIRRF", valorBase);\nIRRF.defineDescontoIRRF();\nvalor =  obt("valorTotalOrigem")  + obt("outrosAcrescimos") - obt("outrosDescontos") - obt("totalDescontoINSS") - obt("totalDescontoSEST")  - obt("descontoIRRF");\ndef("freteLiquido", valor);\nvalor = obt("freteLiquido")  - obt("descontoQuebraPeso");\ndef("saldo", valor - obt("valorAdiantamento"));\ndef("resultado", obt("totalPrestacaoTerceiraAba") - obt("valorTotalOrigem") );\nif (obt("valorTotalOrigem") < obt("freteMinimo_valor")) {\n    alert("Valor abaixo do frete mínimo, será preenchido com valor do frete mínimo");\n    def("valorTotalOrigem", obt("freteMinimo_valor"));\n}`,
    combinado_motorista_perc_adiantamento:`def("tarifaMotoristaCalculada", 0);\nvalor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoINSS") / 100)\ndef("totalDescontoINSS", valor);\nvalor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoSEST") / 100)\ndef("totalDescontoSEST", valor);\nvalorBase = (((obt("valorTotalOrigem"))*0.10)- obt("totalDescontoINSS"));\ndef("baseCalculoIRRF", valorBase);\nIRRF.defineDescontoIRRF();\nvalor =  obt("valorTotalOrigem")  + obt("outrosAcrescimos") - obt("outrosDescontos") - obt("totalDescontoINSS") - obt("totalDescontoSEST")  - obt("descontoIRRF");\ndef("freteLiquido", valor);\nvalor= (obt("freteLiquido") * obt("outrosValoresCF[percAdiantamento]") /100);\nif(obt("outrosValoresCF[percAdiantamento]") != 0)\ndef("valorAdiantamento", valor);\nvalor = obt("freteLiquido")  - obt("descontoQuebraPeso");\ndef("saldo", valor - obt("valorAdiantamento"));\ndef("resultado", obt("totalPrestacaoTerceiraAba") - obt("valorTotalOrigem") );`
};

function mostrarWizardRegra(queryOriginal){
    _wizardQueryOriginal=queryOriginal; _wizardCteBase64=null; _wizardTabelaBase64=null;
    const s=Ferr.stream('regra');
    const card=document.createElement('div');
    card.id='wizardRegraCard'; card.className='answer-card';
    card.style.cssText='max-height:680px;overflow-y:auto;';
    card.innerHTML=`
<div style="background:#f0fdf4;padding:10px 15px;border-bottom:1px solid #bbf7d0;font-size:12px;color:#166534;font-weight:700;position:sticky;top:0;z-index:2;border-radius:12px 12px 0 0;">⚙️ Assistente de Criação de Regras — Bsoft TMS</div>
<div class="wizard-section">
  <div class="wizard-label">📄 Regra base</div>
  <textarea id="wRegraCola" class="wizard-textarea" placeholder="Cole aqui a regra existente que deseja editar (opcional)..."></textarea>
  <div style="font-size:11px;color:#6b7280;margin:8px 0 4px;">Ou selecione uma predefinida como base:</div>
  <div style="display:flex;flex-direction:column;gap:3px;">
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="" checked onchange="wOnRegraPreChange(this.value)"> Nenhuma (criar do zero)</label>
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="icms_demo" onchange="wOnRegraPreChange(this.value)"> ICMS Demonstrativo</label>
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="simples" onchange="wOnRegraPreChange(this.value)"> Simples Nacional</label>
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="inverso" onchange="wOnRegraPreChange(this.value)"> Cálculo Inverso (ICMS por dentro)</label>
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="soma_icms" onchange="wOnRegraPreChange(this.value)"> Somar ICMS no Total</label>
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="peso_cubado_gris" onchange="wOnRegraPreChange(this.value)"> Frete Calculado Peso KG ou Peso Cubado</label>
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="tabela_simples" onchange="wOnRegraPreChange(this.value)"> Tabela de Preços (Tarifa × Peso/1000) — Simples Nacional, sem ICMS</label>
    <label class="wizard-radio-label"><input type="radio" name="wRegraPre" value="tabela_icms_demo" onchange="wOnRegraPreChange(this.value)"> Tabela de Preços (Tarifa × Peso/1000) — ICMS Demonstrativo</label>
  </div>
</div>
<div class="wizard-section">
  <div class="wizard-label">📎 Campos personalizados <span style="font-size:10px;color:#9ca3af;font-weight:400;">(opcional — a IA identifica os campos do print)</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div>
      <div style="font-size:11px;color:#374151;font-weight:600;margin-bottom:4px;">CT-e / Conhecimento</div>
      <div class="wizard-img-zone" id="wCteZone" onclick="document.getElementById('wizardImgCte').click()">📁 Clique para anexar print<input type="file" id="wizardImgCte" accept="image/*" style="display:none" onchange="wCarregarImagem('cte',this)"></div>
      <div id="wCtePreview"></div>
    </div>
    <div>
      <div style="font-size:11px;color:#374151;font-weight:600;margin-bottom:4px;">Tabela de Preços</div>
      <div class="wizard-img-zone" id="wTabelaZone" onclick="document.getElementById('wizardImgTabela').click()">📁 Clique para anexar print<input type="file" id="wizardImgTabela" accept="image/*" style="display:none" onchange="wCarregarImagem('tabela',this)"></div>
      <div id="wTabelaPreview"></div>
    </div>
  </div>
</div>
<div class="wizard-section">
  <div class="wizard-label">⚙️ Configuração da Regra</div>
  <div class="wizard-subsection">
    <b>Cálculo do frete</b>
    <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="nenhum" checked> Nenhum</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="nao_calcular"> Não calcular</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="tf_pt"> Tarifa final × peso total</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="tf_pt_1000"> Tarifa final × peso total / 1000</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="tf_qt"> Tarifa final × quantidade total</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="tf_vt_doc"> Tarifa final × valor total <small style="color:#6b7280;">(campo Valor do documento)</small></label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="tf_vt_prod"> Tarifa final × valor total <small style="color:#6b7280;">(campo Valor do produto)</small></label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="prest_icms"> Total da prestação - valor do ICMS</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcFrete" value="manter"> Manter da regra existente</label>
    </div>
  </div>
  <div class="wizard-subsection" style="margin-top:14px;">
    <b>Base de cálculo do ICMS</b>
    <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
      <label class="wizard-radio-label"><input type="radio" name="wBaseCalc" value="nenhum" checked onchange="wToggleBaseCalc(this.value)"> Nenhum</label>
      <label class="wizard-radio-label"><input type="radio" name="wBaseCalc" value="valorFrete" onchange="wToggleBaseCalc(this.value)"> Valor frete</label>
      <label class="wizard-radio-label"><input type="radio" name="wBaseCalc" value="totalPrestacao" onchange="wToggleBaseCalc(this.value)"> Total Prestação</label>
      <label class="wizard-radio-label"><input type="radio" name="wBaseCalc" value="manter" onchange="wToggleBaseCalc(this.value)"> Manter da regra existente</label>
    </div>
    <div id="wBaseCalcChecks" style="display:none;margin-top:8px;">
      <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Somar ao valor base:</div>
      <div class="wizard-cbx-grid">
        <label class="wizard-radio-label"><input type="checkbox" name="wBaseExtra" value="valorFrete"> Soma Frete</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wBaseExtra" value="valorICMS"> Soma ICMS</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wBaseExtra" value="valorPedagioConhecimento"> Soma Pedágio</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wBaseExtra" value="valoresOutros"> Soma Outros</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wBaseExtra" value="diaria"> Soma Diária</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wBaseExtra" value="valorSeguro"> Soma Seguro</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wBaseExtra" value="Gris"> Soma Gris</label>
      </div>
      <label class="wizard-radio-label" style="margin-top:6px;"><input type="checkbox" id="wBaseTodosOutros"> Somar todos campos outros do print (conhecimento)</label>
      <label class="wizard-radio-label" style="margin-top:2px;"><input type="checkbox" id="wBaseEspecificar" onchange="wToggleEspecificar(this.checked)"> Somar campos outros — especificar quais:</label>
      <textarea id="wBaseEspecificarTxt" class="wizard-textarea" style="display:none;margin-top:6px;min-height:50px;" placeholder="Ex: advalorem, taxa1, taxa2..."></textarea>
    </div>
  </div>
  <div class="wizard-subsection" style="margin-top:14px;">
    <b>Calcular total da prestação</b>
    <div style="display:flex;gap:16px;margin:4px 0 6px;">
      <label class="wizard-radio-label"><input type="radio" name="wCalcPrest" value="sim" checked onchange="wToggleChecks('prest',this.value)"> Sim</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcPrest" value="nao" onchange="wToggleChecks('prest',this.value)"> Não</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcPrest" value="manter" onchange="wToggleChecks('prest',this.value)"> Manter da regra existente</label>
    </div>
    <div id="wPrestChecks">
      <div class="wizard-cbx-grid">
        <label class="wizard-radio-label"><input type="checkbox" name="wPrest" value="valorFrete" checked> Soma Frete</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wPrest" value="valorICMS"> Soma ICMS</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wPrest" value="valorPedagioConhecimento"> Soma Pedágio</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wPrest" value="valoresOutros"> Soma Outros</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wPrest" value="diaria"> Soma Diária</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wPrest" value="valorSeguro"> Soma Seguro</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wPrest" value="Gris"> Soma Gris</label>
      </div>
      <label class="wizard-radio-label" style="margin-top:6px;"><input type="checkbox" id="wPrestTodosOutros"> Somar todos campos outros do print (conhecimento)</label>
      <label class="wizard-radio-label" style="margin-top:2px;"><input type="checkbox" id="wPrestEspecificar" onchange="wTogglePrestEspecificar(this.checked)"> Somar campos outros — especificar quais:</label>
      <textarea id="wPrestEspecificarTxt" class="wizard-textarea" style="display:none;margin-top:6px;min-height:50px;" placeholder="Ex: advalorem, taxa1, taxa2..."></textarea>
    </div>
  </div>
  <div class="wizard-subsection" style="margin-top:14px;">
    <b>Calcular total do serviço</b>
    <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
      <label class="wizard-radio-label"><input type="radio" name="wCalcServ" value="nao" checked onchange="wToggleServCalc(this.value)"> Nenhum</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcServ" value="valorFrete" onchange="wToggleServCalc(this.value)"> Valor frete</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcServ" value="totalPrestacao" onchange="wToggleServCalc(this.value)"> Total Prestação</label>
      <label class="wizard-radio-label"><input type="radio" name="wCalcServ" value="manter" onchange="wToggleServCalc(this.value)"> Manter da regra existente</label>
    </div>
    <div id="wServChecks" style="display:none;margin-top:8px;">
      <div class="wizard-cbx-grid">
        <label class="wizard-radio-label"><input type="checkbox" name="wServ" value="valorFrete" checked> Soma Frete</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wServ" value="valorICMS"> Soma ICMS</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wServ" value="valorPedagioConhecimento"> Soma Pedágio</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wServ" value="valoresOutros"> Soma Outros</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wServ" value="diaria"> Soma Diária</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wServ" value="valorSeguro"> Soma Seguro</label>
        <label class="wizard-radio-label"><input type="checkbox" name="wServ" value="Gris"> Soma Gris</label>
      </div>
      <label class="wizard-radio-label" style="margin-top:6px;"><input type="checkbox" id="wServTodosOutros"> Somar todos campos outros do print (conhecimento)</label>
      <label class="wizard-radio-label" style="margin-top:2px;"><input type="checkbox" id="wServEspecificar" onchange="wToggleServEspecificar(this.checked)"> Somar campos outros — especificar quais:</label>
      <textarea id="wServEspecificarTxt" class="wizard-textarea" style="display:none;margin-top:6px;min-height:50px;" placeholder="Ex: advalorem, taxa1, taxa2..."></textarea>
    </div>
  </div>
</div>
<div class="wizard-section" style="border:none;">
  <div class="wizard-label">📝 O que precisa criar/alterar na regra?</div>
  <textarea id="wDescricao" class="wizard-textarea" placeholder="Descreva o que necessita que crie ou modifique na regra..." style="min-height:100px;"></textarea>
</div>
<div style="padding:12px 15px 20px;">
  <button id="wBtnEnviar" class="wizard-submit" onclick="enviarWizardRegra()">🚀 Gerar Regra com IA</button>
</div>`;
    s.appendChild(card); ferrRolar('regra', true);
}

function wToggleChecks(tipo,valor){const id=tipo==='prest'?'wPrestChecks':'wServChecks';const el=document.getElementById(id);if(el)el.style.display=valor==='sim'?(tipo==='prest'?'block':'grid'):'none';}
function wOnRegraPreChange(val){
    const icms=document.querySelector('input[name="wPrest"][value="valorICMS"]');if(icms)icms.checked=(val==='soma_icms');
    if(val){
        // Predefinida selecionada: marca "Manter da regra existente" em todos os grupos,
        // pra IA não distorcer a base ao gerar a regra.
        const cf=document.querySelector('input[name="wCalcFrete"][value="manter"]'); if(cf)cf.checked=true;
        const bc=document.querySelector('input[name="wBaseCalc"][value="manter"]'); if(bc){bc.checked=true;wToggleBaseCalc('manter');}
        const cp=document.querySelector('input[name="wCalcPrest"][value="manter"]'); if(cp){cp.checked=true;wToggleChecks('prest','manter');}
        const cs=document.querySelector('input[name="wCalcServ"][value="manter"]'); if(cs){cs.checked=true;wToggleServCalc('manter');}
    }else{
        // "Nenhuma (criar do zero)": volta aos padrões originais do formulário.
        const cf=document.querySelector('input[name="wCalcFrete"][value="nenhum"]'); if(cf)cf.checked=true;
        const bc=document.querySelector('input[name="wBaseCalc"][value="nenhum"]'); if(bc){bc.checked=true;wToggleBaseCalc('nenhum');}
        const cp=document.querySelector('input[name="wCalcPrest"][value="sim"]'); if(cp){cp.checked=true;wToggleChecks('prest','sim');}
        const cs=document.querySelector('input[name="wCalcServ"][value="nao"]'); if(cs){cs.checked=true;wToggleServCalc('nao');}
    }
}
function wToggleBaseCalc(val){const el=document.getElementById('wBaseCalcChecks');if(el)el.style.display=(val==='nenhum'||val==='manter')?'none':'block';}
function wToggleEspecificar(checked){const el=document.getElementById('wBaseEspecificarTxt');if(el)el.style.display=checked?'block':'none';}
function wTogglePrestEspecificar(checked){const el=document.getElementById('wPrestEspecificarTxt');if(el)el.style.display=checked?'block':'none';}
function wToggleServCalc(val){const el=document.getElementById('wServChecks');if(el)el.style.display=(val==='nao'||val==='manter')?'none':'block';}
function wCfToggleFrete(val){const el=document.getElementById('wDescontoChecks');if(el)el.style.display=val==='manter'?'none':'block';}
function wToggleServEspecificar(checked){const el=document.getElementById('wServEspecificarTxt');if(el)el.style.display=checked?'block':'none';}
function wToggleDescontos(val){const el=document.getElementById('wDescontoChecks');if(el)el.style.display=val==='com_desconto'?'block':'none';}

function wCarregarImagem(tipo,input){
    if(!input.files||!input.files[0])return;
    const reader=new FileReader();
    reader.onload=(e)=>{
        const b64=e.target.result;
        if(tipo==='cte')_wizardCteBase64=b64;else _wizardTabelaBase64=b64;
        const zone=document.getElementById(tipo==='cte'?'wCteZone':'wTabelaZone');
        const prev=document.getElementById(tipo==='cte'?'wCtePreview':'wTabelaPreview');
        if(zone)zone.style.borderColor='#16a34a';
        if(prev)prev.innerHTML=`<img src="${b64}" style="max-width:100%;max-height:130px;border-radius:6px;margin-top:6px;">`;
    };
    reader.readAsDataURL(input.files[0]);
}

async function enviarWizardRegra(){
    const btn=document.getElementById('wBtnEnviar');
    if(btn){btn.disabled=true;btn.textContent='⏳ Gerando...';}
    const regraCola=(document.getElementById('wRegraCola')?.value||'').trim();
    const regraPre=document.querySelector('input[name="wRegraPre"]:checked')?.value||'';
    const calcFrete=document.querySelector('input[name="wCalcFrete"]:checked')?.value||'nenhum';
    const calcPrest=document.querySelector('input[name="wCalcPrest"]:checked')?.value||'sim';
    const calcServ=document.querySelector('input[name="wCalcServ"]:checked')?.value||'nao';
    const prestCbs=[...document.querySelectorAll('input[name="wPrest"]:checked')].map(c=>c.value);
    const prestTodosOutros=document.getElementById('wPrestTodosOutros')?.checked||false;
    const prestEspecificar=document.getElementById('wPrestEspecificar')?.checked||false;
    const prestEspecificarTxt=(document.getElementById('wPrestEspecificarTxt')?.value||'').trim();
    const servCbs=[...document.querySelectorAll('input[name="wServ"]:checked')].map(c=>c.value);
    const servTodosOutros=document.getElementById('wServTodosOutros')?.checked||false;
    const servEspecificar=document.getElementById('wServEspecificar')?.checked||false;
    const servEspecificarTxt=(document.getElementById('wServEspecificarTxt')?.value||'').trim();
    const baseCalc=document.querySelector('input[name="wBaseCalc"]:checked')?.value||'nenhum';
    const baseExtras=[...document.querySelectorAll('input[name="wBaseExtra"]:checked')].map(c=>c.value);
    const baseTodosOutros=document.getElementById('wBaseTodosOutros')?.checked||false;
    const baseEspecificar=document.getElementById('wBaseEspecificar')?.checked||false;
    const baseEspecificarTxt=(document.getElementById('wBaseEspecificarTxt')?.value||'').trim();
    const descricao=(document.getElementById('wDescricao')?.value||'').trim();
    let regraBase='';
    if(regraCola)regraBase='REGRA EXISTENTE PARA EDITAR:\n'+regraCola;
    else if(regraPre&&REGRAS_PREDEFINIDAS_CODE_CLASSICA[regraPre])regraBase='REGRA BASE ('+regraPre+'):\n'+REGRAS_PREDEFINIDAS_CODE_CLASSICA[regraPre];
    // Bug fix: gerar fórmula real em vez de descrição para que a IA copie exatamente
    const pParts=[...prestCbs.map(f=>'obt("'+f+'")')];
    if(prestTodosOutros)pParts.push('[identificar no print do CT-e TODOS os campos personalizados outros visíveis e incluir obt("nomeinterno") de cada um]');
    if(prestEspecificar&&prestEspecificarTxt)prestEspecificarTxt.split(',').forEach(s=>{s=s.trim();if(s)pParts.push('obt("'+s+'")')});
    const pCfg=calcPrest==='manter'?'MANTER DA REGRA BASE — nao alterar totalPrestacao':calcPrest==='nao'?'NAO calcular (omitir def("totalPrestacao"))':(pParts.length?'FORMULA OBRIGATORIA — copiar exatamente: def("totalPrestacao", ('+pParts.join(' + ')+'))':'NAO calcular totalPrestacao');
    const sExtra=[...servCbs.map(f=>'obt("'+f+'")')];
    if(servTodosOutros)sExtra.push('[identificar no print do CT-e TODOS os campos personalizados outros visíveis e incluir obt("nomeinterno") de cada um]');
    if(servEspecificar&&servEspecificarTxt)servEspecificarTxt.split(',').forEach(s=>{s=s.trim();if(s)sExtra.push('obt("'+s+'")')});
    const sParts=(calcServ!=='nao'&&calcServ!=='manter')?['obt("'+calcServ+'")',...sExtra]:[];
    const sCfg=calcServ==='manter'?'MANTER DA REGRA BASE — nao alterar totalServico':calcServ==='nao'?'NAO calcular (omitir def("totalServico"))':(sParts.length?'FORMULA OBRIGATORIA — copiar exatamente: def("totalServico", ('+sParts.join(' + ')+'))':'NAO calcular totalServico');
    // Construir formula da base de calculo a partir das selecoes do wizard
    let bFormulaPartes=null;
    if(baseCalc!=='nenhum'){
        bFormulaPartes=['obt("'+baseCalc+'")'];
        baseExtras.forEach(f=>bFormulaPartes.push('obt("'+f+'")'));
        if(baseTodosOutros)bFormulaPartes.push('[identificar no print do CT-e TODOS os campos personalizados outros visíveis e incluir obt("nomeinterno") de cada um]');
        if(baseEspecificar&&baseEspecificarTxt)baseEspecificarTxt.split(',').forEach(s=>{s=s.trim();if(s)bFormulaPartes.push('obt("'+s+'")')});
    }
    // Bloco ICMS especifico por tipo de regra
    const useInverso=regraPre==='inverso'||calcFrete==='prest_icms';
    const semIcms=regraPre==='simples';
    let icmsBloco='';
    if(baseCalc==='manter'){
        icmsBloco='__MANTER__';
    }else if(!semIcms){
        const bF=bFormulaPartes?bFormulaPartes.join(' + '):'obt("valorFrete")';
        if(useInverso){
            icmsBloco='var inverso = ((100 - obt("aliquota")) /100)\n'
                +'if ( obt("aliquota") > 0)\n'
                +'   def("baseCalculo", (('+bF+') / inverso));\n'
                +'if ( obt("aliquota") < 1)\n'
                +'   def("baseCalculo", 0);\n'
                +'valor = obt("baseCalculo") * (obt("aliquota")/100);\n'
                +'def("valorICMS",valor);';
        }else{
            icmsBloco='if ( obt("aliquota") > 0)\n'
                +'   def("baseCalculo", ('+bF+'));\n'
                +'if ( obt("aliquota") < 1)\n'
                +'   def("baseCalculo",0);\n'
                +'valor = obt("baseCalculo") * (obt("aliquota")/100);\n'
                +'def("valorICMS",valor);';
        }
    }
    const configTxt=['CONFIGURACAO DO USUARIO:',
        '- Calculo frete: '+(calcFrete==='manter'?'MANTER DA REGRA BASE — nao alterar calculo de valorFrete/tarifaCalculada existente':CALC_FRETE_MAP[calcFrete]||calcFrete),
        icmsBloco==='__MANTER__'?'- Base de calculo ICMS: MANTER DA REGRA BASE — nao alterar bloco ICMS existente':(icmsBloco?'- Bloco ICMS OBRIGATORIO — copiar exatamente:\n'+icmsBloco:'- ICMS: nao incluir calculo de ICMS'),
        '- totalPrestacao: '+pCfg,
        '- totalServico: '+sCfg,
        regraBase?'\n'+regraBase:'',
        descricao?'\nSOLICITACAO: '+descricao:'',
        _wizardQueryOriginal?'\nCONTEXTO: '+_wizardQueryOriginal:''
    ].filter(Boolean).join('\n');
    const sysMsg='Voce e um especialista em regras de frete do Bsoft TMS.\nREGRA CRITICA: As linhas marcadas como FORMULA OBRIGATORIA e BLOCO ICMS OBRIGATORIO devem ser copiadas EXATAMENTE como estao na regra gerada. NAO adicione campos extras nao listados. NAO remova campos listados. Os campos entre colchetes [] indicam que voce deve identificar os campos no print enviado pelo usuario e substituir pela formula correta com obt().\nGere APENAS o codigo da regra pronto para uso, entre triple backticks.\n\nEXEMPLO DE CONDICAO POR UF E OBSERVACAO:\nPara verificar UFIni e UFFim use $V(\'dados_UFIni\') e $V(\'dados_UFFim\').\nPara montar observacao cadastrada no sistema use montaObsChave(\'chave\', true); para observacao livre use montaObs(true).\nExemplo — quando UFIni for RS e UFFim for diferente de RS, montar observacao com chave 11:\nif ( $V(\'dados_UFIni\') == \'RS\' && $V(\'dados_UFFim\') != \'RS\' ) {\n   montaObsChave(\'11\', true);\n} else {\n   montaObs(true);\n}\n\nDEFINICAO DE CAMPOS OCULTOS ($SV):\nPara definir um campo oculto sem gerar erro de "campo nao encontrado", SEMPRE verifique se o elemento existe antes de usar $SV():\nif (document.getElementsByName(\'NOMECAMPO\').length > 0) {\n   $SV(\'NOMECAMPO\', obt("nomeInterno"));\n}\nNUNCA use $SV() direto sem essa verificacao. Exemplos reais:\nif (document.getElementsByName(\'TOTALFRETE\').length > 0) {\n   $SV(\'TOTALFRETE\', obt("totalPrestacao"));\n}\nif (document.getElementsByName(\'VALORNOTAS\').length > 0) {\n   $SV(\'VALORNOTAS\', obt("merc_valor[]"));\n}\nif (document.getElementsByName(\'PESOTOTAL\').length > 0) {\n   $SV(\'PESOTOTAL\', obt("merc_quantKg[]"));\n}\n\nDOCUMENTACAO:\n'+CONTEXTO_REGRAS;
    let userContent;
    if(_wizardCteBase64||_wizardTabelaBase64){
        userContent=[{type:'text',text:'Monte a regra conforme as configuracoes. Se houver imagens, identifique os campos personalizados visiveis e inclua-os conforme solicitado.\n'+configTxt}];
        if(_wizardCteBase64)userContent.push({type:'image_url',image_url:{url:_wizardCteBase64}});
        if(_wizardTabelaBase64)userContent.push({type:'image_url',image_url:{url:_wizardTabelaBase64}});
    }else{
        userContent='Monte a regra conforme as configuracoes abaixo.\n'+configTxt;
    }
    const wCard=document.getElementById('wizardRegraCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    const _cteExtra={cteB64:_wizardCteBase64,tabelaB64:_wizardTabelaBase64};
    if(wCard)wCard.remove();
    ferrMsg('regra', 'system','⚙️ <strong>Gerando regra personalizada...</strong>');
    const ld=ferrCarregando('regra', '⚙️ Elaborando regra de frete...');
    const li=Date.now();
    try{
        const result=await callMCPSemPensamento([{role:'system',content:sysMsg},{role:'user',content:userContent}],{temperature:0.15,maxTokens: REGRAS_MAX_TOKENS});
        ld.remove();
        renderizarCardRegra(result.text,li,result._iaUsada,result._iaModelo,'cte',{query:_wizardQueryOriginal,estadoForm:_estadoForm,cteExtra:_cteExtra});
        ferrConversa('regra', 'ai',result.text);
    }catch(e){ld.remove();ferrMsg('regra', 'ai','❌ Erro ao gerar regra. Tente novamente.');}
}

// ─── Ct-e / Conhecimento — Montador visual (arrastar e soltar) ───
// Mesma lógica/mecânica do montador de Contrato de Frete e Faturamento, adaptada aos campos de
// Ct-e. Reaproveita os mesmos helpers genéricos (_fatTermoParaExpressao, _recalcExprDeTermos,
// _termoParaLabel, _clonarBlocos, _seedTermosBase, _parseRegraParaBlocos, _decomporExpressao).
const CTE_CAMPOS=[
    {label:'Tarifa Final',campo:'tarifaDigitada'},
    {label:'Tarifa Real',campo:'tarifaCalculada'},
    {label:'Frete Valor',campo:'valorFrete'},
    {label:'Base de Cálculo',campo:'baseCalculo'},
    {label:'Alíquota (%)',campo:'aliquota'},
    {label:'Valor do ICMS',campo:'valorICMS'},
    {label:'Outros',campo:'valoresOutros'},
    {label:'Pedágio',campo:'valorPedagioConhecimento'},
    {label:'Gris',campo:'Gris'},
    {label:'Diária',campo:'diaria'},
    {label:'Seguro',campo:'valorSeguro'},
    {label:'Seg. Aduaneiro',campo:'valorSeguroAduaneiro'},
    {label:'Total do Serviço',campo:'totalServico'},
    {label:'Total Prestação',campo:'totalPrestacao'},
    {label:'Total Peso (kg) da Nf-e',campo:'merc_quantKg[]'},
    {label:'Total Valor Produtos da Nf-e',campo:'merc_vProd[]'},
    {label:'Total Valor das Nf-e',campo:'merc_valor[]'},
    {label:'Nº Eixos',campo:'freteMinimo_nroEixos'},
    {label:'Quantidade total das Notas fiscais',campo:'merc_quant[]'},
    {label:'KM',campo:'km'}
];
// Campos da Tabela de Preços (objeto externo "tabelaPrecos", ver peso_cubado_gris/CTE_OPCOES_MONTAGEM)
// — mostrados na MESMA área de arrastar dos campos de Ct-e acima, mas entram na regra SEM obt()
// (é acesso direto à propriedade, ex.: "tabelaPrecos.percSeguro") — só os campos do Ct-e (lista
// acima) usam obt('campo'); a diferença é feita em _fatTermoParaExpressao (pelo "." no nome).
const TABELA_PRECOS_CAMPOS=[
    {label:'Tarifa final',campo:'tabelaPrecos.tarifaDigitada'},
    {label:'Outros',campo:'tabelaPrecos.valoresOutros'},
    {label:'Frete mínimo',campo:'tabelaPrecos.valorFreteMinimo'},
    {label:'Diária',campo:'tabelaPrecos.diaria'},
    {label:'Frete valor',campo:'tabelaPrecos.valorFrete'},
    {label:'Total prestação',campo:'tabelaPrecos.totalPrestacao'},
    {label:'Pedágio',campo:'tabelaPrecos.valorPedagioConhecimento'},
    {label:'Fração pedágio',campo:'tabelaPrecos.percentualPedagio'},
    {label:'Valor fração',campo:'tabelaPrecos.valorFracao'},
    {label:'Seguro',campo:'tabelaPrecos.valorSeguro'},
    {label:'%Seguro',campo:'tabelaPrecos.percentualSeguro'},
    {label:'Seg. aduaneiro',campo:'tabelaPrecos.valorSeguroAduaneiro'},
    {label:'Gris',campo:'tabelaPrecos.Gris'},
    {label:'%Gris',campo:'tabelaPrecos.percentualGris'},
    {label:'Excesso',campo:'tabelaPrecos.valorExcesso'},
    {label:'Limite excedente',campo:'tabelaPrecos.excedente'}
];
// Opções prontas (checkbox) que podem ser mescladas na área de montagem — cada uma cobre um jeito
// diferente de calcular o mesmo campo (ex.: valorFrete por tonelada, por KG ou por valor dos
// documentos). Marcar uma sobrepõe, sem duplicar, o que já estiver montado pro(s) mesmo(s)
// "Campo a definir" (ver _cteAplicarOpcionais/_mesclarOpcaoRegra).
const CTE_OPCOES_MONTAGEM=[
    {titulo:'💰 Cálculo do Valor Frete', itens:[
        {id:'frete_tonelada', label:'Em cima do peso (tonelada)', codigo:'var valorcalculado = (obt("tarifaDigitada") * obt("merc_quantKg[]")/1000);\nif (obt("tarifaDigitada") > 0)\ndef("valorFrete", valorcalculado);\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);'},
        {id:'frete_kg', label:'Em cima do peso (KG)', codigo:'var valorcalculado = (obt("tarifaDigitada") * obt("merc_quantKg[]"));\nif (obt("tarifaDigitada") > 0)\ndef("valorFrete", valorcalculado);\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);'},
        {id:'frete_valor_docs', label:'Em cima do valor total dos documentos', codigo:'var valorcalculado = ((obt("tarifaDigitada")/100) * obt("merc_valor[]"));\nif (obt("tarifaDigitada") > 0)\ndef("valorFrete", valorcalculado);\nif (valorcalculado < tabelaPrecos.valorFreteMinimo)\ndef("valorFrete", tabelaPrecos.valorFreteMinimo);'}
    ]},
    {titulo:'📊 Cálculo do ICMS', itens:[
        {id:'icms_demonstrativo', label:'ICMS Demonstrativo', codigo:'if ( obt("aliquota") == 0)\ndef("baseCalculo",0);\nif ( obt("aliquota") > 0)\ndef("baseCalculo", (obt("valorFrete")));\ndef("valorICMS", obt("baseCalculo") * (obt("aliquota")/100));'},
        {id:'icms_inverso', label:'Cálculo Inverso (ICMS por dentro)', codigo:'if ( obt("aliquota") == 0)\ndef("baseCalculo",0);\nif ( obt("aliquota") > 0) \ndef("baseCalculo", ((obt("valorFrete")) / ((100 - obt("aliquota")) /100)));\ndef("valorICMS", obt("baseCalculo") * (obt("aliquota")/100));'},
        // Não é um jeito de CALCULAR o ICMS (por isso tem "grupoExclusivo" próprio, abaixo — não
        // entra na exclusividade de 1-por-grupo com as 2 opções acima): é um acréscimo, soma o
        // valorICMS já calculado (por qualquer uma das 2 opções acima, ou já definido de outro
        // jeito) no total da prestação — combinável com qualquer uma delas.
        {id:'icms_somar', label:'Somar ICMS no Total Prestação', grupoExclusivo:'icms_somar', modo:'somar', campoAlvo:'totalPrestacao', termoNovo:{termo:"obt('valorICMS')", acao:'+'}},
        // Idem: grupoExclusivo próprio pra poder ficar marcado JUNTO com o cálculo de ICMS (ICMS
        // Demonstrativo ou Cálculo Inverso) -- não substitui o cálculo, só adiciona os 3 campos de
        // retenção da Substituição Tributária em cima do que já foi calculado (baseCalculo,
        // aliquota, valorICMS). modo:'inserirApos' garante que entra logo depois de "valorICMS" --
        // dentro do bloco do cálculo de ICMS -- em vez de ir parar no final da regra (onde nenhum
        // dos 3 destinos novos bate com nada que já exista pra servir de referência de posição).
        {id:'icms_st', label:'Substituição Tributária', grupoExclusivo:'icms_st', modo:'inserirApos', ancoraDestino:'valorICMS', codigo:'def("outrosValores[vBCSTRet]", obt("baseCalculo"));\ndef("outrosValores[pICMSSTRet]", obt("aliquota"));\ndef("outrosValores[vICMSSTRet]", obt("valorICMS"));'},
        // GNRE manual: o valor do GNRE (campo personalizado outrosValores[vICMSGNRE]) pode ser digitado na tela do Ct-e; só quando
        // vier vazio/zerado (< 0,01) a regra preenche com o valorICMS. Também não é um jeito de CALCULAR o ICMS (grupoExclusivo próprio:
        // combina com qualquer cálculo acima) e precisa entrar DEPOIS de o valorICMS estar calculado -- por isso modo:'inserirApos', na
        // ÚLTIMA definição de valorICMS (ancoraUltima). substituirExistentes: se a regra já tiver o vICMSGNRE, troca em vez de duplicar.
        {id:'icms_gnre', label:'Definir valor manualmente GNRE?', grupoExclusivo:'icms_gnre', modo:'inserirApos', ancoraDestino:'valorICMS', ancoraUltima:true, substituirExistentes:true, codigo:'if (obt("outrosValores[vICMSGNRE]") < 0.01)\ndef("outrosValores[vICMSGNRE]", obt("valorICMS"));'},
        // Redução da base de cálculo: abre um campo para a % (0 a 100) e troca TODA definição de baseCalculo que já estiver montada
        // (ICMS Demonstrativo, Cálculo Inverso, regra base ou regra colada) por esta única linha -- é o modo padrão (mesclar), que
        // sobrepõe sem duplicar. Fica DEPOIS das opções de cálculo na lista de propósito: elas são aplicadas na ordem desta lista, então
        // a redução sempre vence, qualquer que seja a ordem em que as caixinhas foram clicadas. {valor} vira o número digitado (só entra
        // na regra quando for válido: ver _cteLerEntradaOpcao). Base = Frete × (100 − %) ÷ 100: 20 → 80 % do frete; 0 → sem redução; 100 → base zero.
        // antesDe: se a regra não tiver nenhuma definição de baseCalculo pra sobrepor, a nova entra antes de valorICMS (que é calculado em cima dela).
        {id:'icms_reducao', label:'Redução Base de cálculo?', grupoExclusivo:'icms_reducao', conflitoCampo:'baseCalculo', antesDe:['valorICMS'], codigo:'def("baseCalculo", obt("valorFrete") * (100 - {valor}) / 100);',
            entrada:{ rotulo:'Percentual de redução', placeholder:'0 a 100', sufixo:'%', min:0, max:100,
                vazio:'Digite o percentual de redução (de 0 a 100) para aplicar.',
                invalido:'Valor inválido: use um número de 0 a 100 (ex.: 20 ou 33,5).',
                ok:'✔ Base de Cálculo = Frete Valor × (100 − {valor}) ÷ 100. Substitui qualquer outra definição de Base de Cálculo que já estiver montada.',
                conflito:'⚠️ Existe outra definição de Base de Cálculo dentro de uma “Linha extra” da regra original (um bloco if/else). Ela não foi substituída: revise para a Base de Cálculo não ficar definida duas vezes.' } }
    ]},
    {titulo:'📋 Tabela de Preços — Fração do Pedágio', itens:[
        {id:'pedagio_peso', label:'Em cima do peso', codigo:'let qtdVezesMultiplica = Math.ceil(obt("merc_quantKg[]") / 100);\nlet vPedagio = tabelaPrecos.percentualPedagio * qtdVezesMultiplica;\ndef("valorPedagioConhecimento", vPedagio);'},
        {id:'pedagio_km', label:'Em cima do KM', codigo:'let qtdVezesMultiplica = Math.ceil(obt("km") / 100);\nlet vPedagio = tabelaPrecos.percentualPedagio * qtdVezesMultiplica;\ndef("valorPedagioConhecimento", vPedagio);'},
        {id:'pedagio_eixo', label:'Por eixo', codigo:'let qtdVezesMultiplica = Math.ceil(obt("freteMinimo_nroEixos") / 100);\nlet vPedagio = tabelaPrecos.percentualPedagio * qtdVezesMultiplica;\ndef("valorPedagioConhecimento", vPedagio);'}
    ]},
    {titulo:'📋 Tabela de Preços — Seguro (%)', itens:[
        {id:'seguro_frete', label:'Em cima do valor frete', codigo:'if (tabelaPrecos.percSeguro > 0)\ndef("valorSeguro", tabelaPrecos.percSeguro * obt("valorFrete"));'},
        {id:'seguro_prestacao', label:'Em cima do total prestação', codigo:'if (tabelaPrecos.percSeguro > 0)\ndef("valorSeguro", tabelaPrecos.percSeguro * obt("totalPrestacao"));'},
        {id:'seguro_merc_valor', label:'Em cima do total valor mercadorias', codigo:'if (tabelaPrecos.percSeguro > 0)\ndef("valorSeguro", tabelaPrecos.percSeguro * obt("merc_valor[]"));'},
        {id:'seguro_merc_peso', label:'Em cima do total peso mercadorias', codigo:'if (tabelaPrecos.percSeguro > 0)\ndef("valorSeguro", tabelaPrecos.percSeguro * obt("merc_quantKg[]"));'}
    ]},
    {titulo:'📋 Tabela de Preços — Gris (%)', itens:[
        {id:'gris_frete', label:'Em cima do valor frete', codigo:'if (tabelaPrecos.percGris > 0)\ndef("Gris", tabelaPrecos.percGris * obt("valorFrete"));'},
        {id:'gris_prestacao', label:'Em cima do total prestação', codigo:'if (tabelaPrecos.percGris > 0)\ndef("Gris", tabelaPrecos.percGris * obt("totalPrestacao"));'},
        {id:'gris_merc_valor', label:'Em cima do total valor mercadorias', codigo:'if (tabelaPrecos.percGris > 0)\ndef("Gris", tabelaPrecos.percGris * obt("merc_valor[]"));'},
        {id:'gris_merc_peso', label:'Em cima do total peso mercadorias', codigo:'if (tabelaPrecos.percGris > 0)\ndef("Gris", tabelaPrecos.percGris * obt("merc_quantKg[]"));'}
    ]}
];
let _wizardRegraDndQuery='';
function _cteChip(c,corBorda,corFundo,corTexto){
    return `<span class="_cte-chip" draggable="true" data-campo="${c.campo}" title="${escapeHtml(c.campo)}" ondragstart="_cteDragStart(event)" style="display:inline-block;padding:6px 12px;background:${corFundo};border:1.5px solid ${corBorda};border-radius:16px;font-size:12px;cursor:grab;user-select:none;color:${corTexto};">${escapeHtml(c.label)}</span>`;
}
// Nomes digitados no campo "Utiliza Valores outros" (separados por vírgula) — só valem se o
// checkbox estiver marcado. Cada nome vira um campo arrastável obt('outrosValores[nome]').
function _cteNomesOutrosValores(){
    const chk=document.getElementById('wCteOutrosValoresCheck');
    if(!chk||!chk.checked)return [];
    const raw=document.getElementById('wCteOutrosValoresInput')?.value||'';
    return raw.split(',').map(s=>s.trim()).filter(Boolean);
}
function _cteMontarPaletteHtml(){
    return CTE_CAMPOS.map(c=>_cteChip(c,'#86efac','#f0fdf4','#166534')).join('')
        +`<span style="width:100%;font-size:10px;color:#9ca3af;font-weight:700;margin:4px 0 2px;">📋 Tabela de Preços (usa direto, sem obt):</span>`
        +TABELA_PRECOS_CAMPOS.map(c=>_cteChip(c,'#fbbf24','#fffbeb','#92400e')).join('');
}
// Chips dos campos personalizados ("Utiliza Valores outros") — ficam numa área PRÓPRIA, logo
// abaixo do campo onde a pessoa acabou de digitar os nomes (não dentro da paleta grande lá em
// cima), pra arrastar sem precisar rolar até achar o que acabou de criar.
function _cteMontarChipsOutrosHtml(){
    return _cteNomesOutrosValores().map(nome=>_cteChip({label:nome,campo:'outrosValores['+nome+']'},'#f9a8d4','#fdf2f8','#9d174d')).join('');
}
// Reconstrói a paleta "Campos disponíveis" e os chips de "outros valores" — chamada ao
// marcar/desmarcar o checkbox de "Utiliza Valores outros" e a cada edição do campo de nomes.
function _cteRenderPalette(){
    const wrap=document.getElementById('wCteCamposPalette');
    if(wrap)wrap.innerHTML=_cteMontarPaletteHtml();
    const chipsOutros=document.getElementById('wCteOutrosValoresChips');
    if(chipsOutros)chipsOutros.innerHTML=_cteMontarChipsOutrosHtml();
}
function _cteToggleOutrosValores(marcado){
    const wrap=document.getElementById('wCteOutrosValoresWrap');
    if(wrap)wrap.style.display=marcado?'block':'none';
    _cteRenderPalette();
}
// Abre/fecha o modal amplo compartilhado pelos 3 criadores de regra (Ct-e, Contrato de Frete,
// Faturamento) -- cada um só injeta seu próprio conteúdo em #builderModalBody, o modal em si
// (moldura, overlay, botão fechar) é único e reaproveitado pelos três.
function _abrirBuilderModal(tipoTour){
    document.getElementById('builderModalOverlay')?.classList.add('active');
    // menu lateral e área de montagem rolam cada um na sua própria barra -- zera as duas ao abrir
    document.querySelectorAll('#builderModalBody .builder-grid-side, #builderModalBody .builder-grid-main').forEach(el=>{el.scrollTop=0;});
    document.body.style.overflow='hidden';
    let tourJaVisto=false;
    try { tourJaVisto=!!localStorage.getItem(_TOUR_LOCALSTORAGE_KEY); } catch(e){}
    if(tipoTour && !tourJaVisto){ setTimeout(()=>_iniciarTourBuilder(tipoTour), 250); }
}
function _fecharBuilderModal(){
    document.getElementById('builderModalOverlay')?.classList.remove('active');
    document.body.style.overflow='';
    _tourFechar();
}

// O montador (arrastar campos) abre numa janela por cima de tudo. Se ela for fechada sem gerar nada a aba ficaria vazia:
// este cartão fica no topo da aba e leva de volta ao montador (o que já foi montado continua lá) ou a escolher outro tipo.
function _regraAvisoMontador() {
    if (!Ferr.emAba('regra')) return;
    const c = document.createElement('div');
    c.className = 'answer-card'; c.id = 'regraAvisoMontador';
    const btn = 'display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:600;color:var(--text);';
    c.innerHTML = `<div class="answer-section"><div class="section-content">🧩 <b>Montador de regras</b> — monte a regra arrastando os campos. Fechou a janela sem querer? Volte a ela: o que você já montou continua lá.</div></div>
<div class="feedback-area"><button onclick="_regraReabrirMontador()" style="${btn}">🧩 Abrir o montador</button><button onclick="ferrNovo('regra')" style="${btn}">🔄 Escolher outro tipo de regra</button></div>`;
    Ferr.stream('regra').appendChild(c);
}
function _regraReabrirMontador() {
    const corpo = document.getElementById('builderModalBody');
    if (corpo && corpo.children.length) _abrirBuilderModal(null);
}

// ── ferramenta em aba (Workspace → "Criar Regra"): pergunta o tipo de regra e abre o montador ──
// O log é gravado quando o usuário escolhe o tipo de regra (não ao abrir a aba).
Ferr.registrar('regra', {
    async iniciar(o) {
        const q = (o && o.consulta) || '';   // pergunta digitada no chat que levou até aqui (pré-preenche o montador)
        const tipo = await perguntarTipoRegra();
        const nomes = { cte: 'Ct-e', 'cte-nova': 'Ct-e (Nova Versão)', contrato: 'Contrato de Frete', faturamento: 'Faturamento' };
        if (tipo) ferrLog('regra', 'Criar Regra - ' + (nomes[tipo] || tipo), true);
        if (tipo === 'cte') {
            const modo = await perguntarModoCte();
            if (modo === 'dnd') { _regraAvisoMontador(); mostrarWizardRegraDnd(q); }
            else if (modo === 'classico') mostrarWizardRegra(q);
        } else if (tipo === 'cte-nova') {
            _regraAvisoMontador(); mostrarWizardRegraCteNova(q);
        } else if (tipo === 'contrato') {
            const modo = await perguntarModoContrato();
            if (modo === 'dnd') { _regraAvisoMontador(); mostrarWizardContratoDnd(q); }
            else if (modo === 'classico') mostrarWizardContrato(q);
        } else if (tipo === 'faturamento') { _regraAvisoMontador(); mostrarWizardFaturamento(q); }
    },
});
