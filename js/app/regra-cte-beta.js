/* js/app/regra-cte-beta.js — Criar Regra › "Ct-e / Conhecimento Beta": a linha de DESENVOLVIMENTO do assistente em telas (a Nova Versão, js/app/regra-cte-nova.js, é uma cópia deste arquivo com outros nomes). */
// ═══════════════════════════════════════════════════════════
//  Ct-e / CONHECIMENTO — BETA (assistente em telas, em teste)
// ═══════════════════════════════════════════════════════════
// Só aparece quando a pessoa liga "Criador de regra Beta" em Personalizar › Recursos em teste (vem DESLIGADO): é onde as novidades são feitas e testadas ANTES de irem para a Nova Versão, que todos usam e que é uma
// CÓPIA deste arquivo com outros nomes (_nv…/NV_…/nv-… no lugar de _cb…/CB_…/cb-…; ids wCteNova…). Para levar novidades do Beta para a Nova Versão: tools/gerar-nova-do-beta.js (sem argumentos mostra o que o Beta
// tem a mais) e a seção "Promover do Beta para a Nova Versão" do README. Mexeu AQUI e quer que a Nova Versão acompanhe? Só vale depois de promover. Os passos:
//   1. Regra base ............. colar a regra do cliente, escolher uma regra pronta OU marcar "Para montar do zero clique em avançar" (o Avançar só libera com uma das 3);
//   2. Campos personalizados .. igual à Nova Versão;
//   3. Cálculo do Frete Valor . a tela de opções da Nova Versão, só com as opções que calculam o Frete Valor;
//   4. Cálculo do ICMS ........ idem, só com as opções do ICMS;
//   5. Cálculo Total Prestação  idem, só com as opções do Total Prestação;
//   6. Montagem manual ........ a área de montagem de sempre (o MESMO HTML: _cteHtmlAreaMontagem()).
// Os passos 3, 4 e 5 são UMA tela só (cbSlide2) que troca de título e de opções (painéis .cb-etapa-opcoes); a caixa da IA e o rodapé são os mesmos, e a IA recebe tudo o que foi marcado nos três.
// O que é próprio deste arquivo (e da cópia dele, a Nova Versão): telas, navegação, rodapé, estado e as travas (ICMS/loop) como aparecem na tela. O que é COMPARTILHADO pelos dois (js/app/regra-cte-passos.js, carregado antes — mexer lá muda os dois): o catálogo
// de opções (CN_BUSCA, CN_SOMA_*, CN_OPCOES_DEMAIS, que _cteGruposOpcoes() aplica), as regras prontas, os textos do prompt (CN_PROMPT_REGRA) e os analisadores puros (_cnLoopsDoCodigo, _cnIcmsLinhasInvalidas,
// _cnPedeReduzirIcms, _cnLoopNaResposta, _cnNomesCampos...). Os ids de opção (wCteOpc_*) e da montagem (wCteColarRegra, wCteDescricao, wCteBlocosContainer...) são os mesmos do montador clássico,
// então colar / opções / arrastar / gerar / "Voltar" continuam sendo feitos pelas funções _cte* de sempre, com um estado só (window._cteBlocos/_cteExtras/_cteOpcionaisBase).
// Ficam FORA do Beta, por enquanto (não pertencem a nenhum dos passos pedidos): Fração do Pedágio, Seguro (%), Gris (%) e "Somar no Total Serviço".

const CB_PASSOS = [
    { id: 'base',     nome: 'Regra base',              slide: 0 },
    { id: 'campos',   nome: 'Campos personalizados',   slide: 1 },
    { id: 'frete',    nome: 'Cálculo do Frete Valor',  slide: 2, etapa: 'frete' },
    { id: 'icms',     nome: 'Cálculo do ICMS',         slide: 2, etapa: 'icms' },
    { id: 'total',    nome: 'Cálculo Total Prestação', slide: 2, etapa: 'total' },
    { id: 'montagem', nome: 'Montagem manual',         slide: 3 }
];
const CB_MONTAGEM = CB_PASSOS.length - 1;                  // índice do passo da montagem manual
const CB_PRIMEIRO_CALCULO = CB_PASSOS.findIndex(p => p.etapa);   // índice do 1º passo de cálculo
const CB_ETAPAS = {
    // grupos = pedaço do título do grupo em CTE_OPCOES_MONTAGEM; somar = campo de destino das contas "Somar X no Y" (CN_SOMA_ALVOS)
    frete: { grupos: ['Cálculo do Valor Frete'], somar: ['valorFrete'],     dica: 'tonelada, kg, peso, documentos, somar pedágio...' },
    icms:  { grupos: ['Cálculo do ICMS'],        somar: ['baseCalculo'],    dica: 'demonstrativo, inverso, st, gnre, reduzir, somar seguro...' },
    total: { grupos: [],                         somar: ['totalPrestacao'], dica: 'somar frete, somar ICMS, somar pedágio...' }
};
// Opção que SÓ este assistente tem (o montador clássico não): "Somar Frete Valor no Total Prestação". Vem MARCADA por padrão (ver _cbMarcarPadrao) — o Total Prestação sempre parte do Frete Valor — e é a única das contas "Somar"
// que CRIA o campo quando a regra ainda não o calcula (criaSeAusente, em _aplicarSomaEmCampo): numa regra montada do zero é ela que cria def("totalPrestacao", obt('valorFrete')), e as outras
// contas "Somar … no Total Prestação" passam a ter onde entrar. Com uma regra base/colada que já soma o frete no total, não muda nada (o termo já está lá, não duplica).
const CB_ID_PADRAO = 'somar_totalPrestacao_valorFrete';
const CB_ITEM_SOMAR_FRETE = {
    id: CB_ID_PADRAO, label: 'Somar Frete Valor no Total Prestação', grupoExclusivo: CB_ID_PADRAO,
    modo: 'somarEm', campoAlvo: 'totalPrestacao', alvoNome: 'Total Prestação', termoNovo: { termo: "obt('valorFrete')", acao: '+' }, criaSeAusente: true,
    buscaExtra: 'somar soma adicionar incluir acrescentar frete valor total prestacao'
};
// "Preencher manualmente" (Cálculo do Frete Valor): a pessoa vai digitar o Frete Valor na própria tela do Ct-e, então a regra NÃO calcula o frete. É só uma escolha marcável: NÃO coloca nada na regra
// (modo:'nada' em _cteAplicarOpcionais). Fica no mesmo grupo das contas de frete (mesmo data-grupo = gi), então é EXCLUSIVA com elas: ou a regra calcula o frete, ou ele é preenchido à mão. Para a IA
// ela vira um aviso no pedido (dicasIA, no fim do arquivo): não criar nenhum cálculo novo de valorFrete.
const CB_ID_FRETE_MANUAL = 'frete_manual';
const CB_ITEM_FRETE_MANUAL = {
    id: CB_ID_FRETE_MANUAL, label: 'Preencher manualmente', rotuloMarcada: 'Frete Valor: preencher manualmente', modo: 'nada',
    buscaExtra: 'preencher manual manualmente digitar informar sem calculo nao calcular frete valor'
};
// Nomes das opções NESTE assistente (o catálogo compartilhado — Nova Versão e clássico — mantém os nomes antigos). Valem na lista, na faixa "Marcadas" e na busca (que ainda acha pelo nome antigo).
const CB_ROTULOS = {
    frete_tonelada:   'Tarifa x peso (Tonelada)',
    frete_kg:         'Tarifa x peso (KG)',
    frete_valor_docs: 'Tarifa x Valor Total das Notas'
};
// "Somar Frete Valor na Base de Cálculo" (passo 4, caixa "Somar na Base de Cálculo"): a Base de Cálculo parte do Frete Valor. Ela é DERIVADA da regra: vem marcada quando a base montada usa o Frete Valor — numa regra colada,
// numa regra base e quando um cálculo padrão (ICMS Demonstrativo, Cálculo Inverso, Redução) é escolhido, pois todos eles calculam em cima do frete — e desmarca sozinha quando a base deixa de usá-lo (ver _cbSincronizar).
// É EXCLUSIVA de "Somar Total Prestação na Base de Cálculo" (mesmo grupo de exclusividade): o total prestação já inclui o frete, então marcar o total TIRA o frete da base — não soma os dois (ver _cbAposAplicar).
const CB_ID_FRETE_BASE = 'somar_baseCalculo_valorFrete';
const CB_ID_TOTAL_BASE = 'somar_baseCalculo_totalPrestacao';       // do catálogo compartilhado (CN_OPCOES_DEMAIS); aqui só ganha o grupo de exclusividade abaixo
const CB_GRUPO_FRETE_OU_TOTAL = 'cb_base_frete_ou_total';
const CB_ITEM_FRETE_BASE = {
    id: CB_ID_FRETE_BASE, label: 'Somar Frete Valor na Base de Cálculo', grupoExclusivo: CB_GRUPO_FRETE_OU_TOTAL,
    modo: 'somarEm', campoAlvo: 'baseCalculo', alvoNome: 'Base de Cálculo', termoNovo: { termo: "obt('valorFrete')", acao: '+' },
    buscaExtra: 'somar soma adicionar incluir acrescentar frete valor base calculo bc'
};
// "Somar ICMS" (passo 4, logo depois de ICMS Demonstrativo e Cálculo Inverso): a TERCEIRA escolha de como calcular o ICMS. As três (Demonstrativo, Inverso, Somar ICMS) são EXCLUSIVAS: não tem grupoExclusivo próprio, então cai
// no mesmo grupo das duas (ver _cbHtmlOpcao). Marcada, ela PREENCHE a regra com o cálculo da base e do valorICMS do Demonstrativo (aliquota == 0 → base 0; aliquota > 0 → base = Frete Valor; valorICMS = base × alíquota)
// E marca "Somar ICMS no Total Prestação" (passo 5, icms_somar): é a "regra base SOMAR ICMS" como opção. Quando a regra colada/base já tem os dois (o cálculo do Demonstrativo + o ICMS somado no total) é ELA que aparece
// marcada, no lugar do Demonstrativo (ver _cbPresente e _cbSincronizar, que mantém as duas pontas coerentes: tirar o ICMS do total a transforma em Demonstrativo e vice-versa).
const CB_ID_DEMONSTRATIVO = 'icms_demonstrativo', CB_ID_ICMS_SOMAR = 'icms_somar';
const CB_ID_SOMAR_ICMS = 'cb_espelho_somar_icms';   // (o id do atalho antigo foi mantido)
const CB_EQUIVALENTE_ICMS = { [CB_ID_DEMONSTRATIVO]: CB_ID_SOMAR_ICMS, [CB_ID_SOMAR_ICMS]: CB_ID_DEMONSTRATIVO };   // "Somar ICMS" = Demonstrativo + ICMS no total: a regra colada pode estar lida como um e a caixinha trocar para o outro (ver _cbSincronizar)
const CB_ITEM_SOMAR_ICMS = {
    id: CB_ID_SOMAR_ICMS, label: 'Somar ICMS', codigo: (CTE_OPCOES_MONTAGEM.flatMap(g => g.itens).find(i => i.id === CB_ID_DEMONSTRATIVO) || {}).codigo,   // = o cálculo do ICMS Demonstrativo
    antesDe: ['totalPrestacao', 'totalServico'],   // numa regra SEM cálculo de ICMS o bloco entra ANTES do total (o total soma o valorICMS: ele tem que estar calculado antes) em vez de ir para o fim
    nota: 'ICMS demonstrativo + soma o Valor do ICMS no Total Prestação', buscaExtra: 'somar soma adicionar incluir icms imposto valor total prestacao demonstrativo'
};
const CB_GRUPO_EXTRAS = { 'Cálculo do Valor Frete': [CB_ITEM_FRETE_MANUAL] };   // opções só deste assistente no FIM de um grupo do clássico (pelo pedaço do título)
const CB_GRUPO_APOS = { icms_inverso: [CB_ITEM_SOMAR_ICMS] };   // opções só deste assistente logo DEPOIS de uma opção do clássico (pelo id dela); _cteGruposOpcoes (assistente-regras.js) as lê do registro (grupoApos, no fim deste arquivo) e as põe nessa ordem para o motor aplicar
const CB_GRUPO_FORCADO = { [CB_ID_TOTAL_BASE]: CB_GRUPO_FRETE_OU_TOTAL };   // grupo de exclusividade (data-grupo) imposto a opções do catálogo compartilhado, só nesta tela
const CB_SOMA_EXTRAS = { totalPrestacao: [CB_ITEM_SOMAR_FRETE], baseCalculo: [CB_ITEM_FRETE_BASE] };   // contas extras deste assistente no começo do bloco "Somar no <campo>"
const CB_OPCOES_EXTRAS = [{ titulo: '➕ Demais opções (Beta)', itens: [CB_ITEM_SOMAR_FRETE, CB_ITEM_FRETE_MANUAL, CB_ITEM_FRETE_BASE] }];   // lido por _cteGruposOpcoes() (assistente-regras.js), pelo registro (opcoesExtras, no fim deste arquivo), para aplicar as opções

let _cbPasso = 0;                 // passo atual (0 a 5; ver CB_PASSOS)
let _cbVisitados = new Set([0]);  // passos já abertos (a trilha do topo mostra ✓ nos anteriores)
let _cbTourVisto = false;         // o tutorial da montagem só abre sozinho 1 vez por abertura da janela
let _cbManualOk = false;          // "Desejo fazer a montagem manual da regra" (passos de cálculo) marcado: só então o botão "Avançar para montagem manual" é liberado — vale também para a trilha do topo
let _cbPadraoDesmarcado = false;  // a pessoa DESMARCOU "Somar Frete Valor no Total Prestação" de propósito: então ela não é marcada de novo sozinha (ver _cbMarcarPadrao)
let _cbAvisoTroca = '';           // aviso de uma troca AUTOMÁTICA entre as 3 escolhas de ICMS (Demonstrativo / Inverso / Somar ICMS), mostrado depois do clique (ver _cbMostrarAvisoTroca)
let _cbFreteBaseManual = false;   // a pessoa MARCOU "Somar Frete Valor na Base" à mão: só então o motor a aplica na regra (marcada pela regra/cálculo, ela só reflete — senão, ao tirar o cálculo, o frete ficaria grudado na base)
let _cbFreteBaseTirado = false;   // a pessoa DESMARCOU "Somar Frete Valor na Base de Cálculo" de propósito (e o frete era uma parcela somada, que dá para tirar): só então o frete sai da base da regra colada (ver _cbPrepararBase)
let _cbJaNaRegraAtual = new Set();   // ids reconhecidos e ainda marcados na rodada atual do motor das opções (preenchido por _cbPrepararBase, lido por _cbAposAplicar)
let _cbAvisoBaseDupla = false;    // a regra de fora soma o Frete Valor E o Total Prestação na Base de Cálculo (o frete entra duas vezes): avisado no passo 1
let _cbBaseExterna = false;       // a regra veio de fora (colada, ou uma regra base escolhida): então as caixinhas só refletem o que ela já tem e a opção padrão NÃO é marcada/aplicada sozinha (ver "marcar conforme a regra")
const _cbTotalPassos = CB_PASSOS.length;
// o passo é um passo de cálculo (3, 4 ou 5)? — todos usam a mesma tela (cbSlide2)
const _cbEhCalculo = n => !!(CB_PASSOS[n] && CB_PASSOS[n].etapa);

// ── HTML das telas ───────────────────────────────────────────────────────────
function _cbHtmlTopo() {
    const trilha = CB_PASSOS.map((p, i) => `<li><button type="button" class="cn-passo-btn" data-passo="${i}" onclick="_cbIrPassoClicado(${i})" title="Ir para: ${esc(p.nome)}"><span class="cn-num">${i + 1}</span><span class="cn-nome">${esc(p.nome)}</span></button></li>`).join('');
    return `<div class="cn-topo">
        <div class="cn-titulo">📄 Ct-e / Conhecimento <span class="cn-selo cb-selo">Beta</span></div>
        <ol class="cn-passos" aria-label="Passos do assistente">${trilha}</ol>
    </div>`;
}
// Passo 1 — colar a regra do cliente, OU escolher uma das prontas, OU marcar "Para montar do zero clique em avançar" (o Avançar só libera com uma das três: ver _cbBaseOk)
function _cbHtmlBase() {
    const prontas = CN_REGRAS_PRONTAS.map(r => `<button type="button" class="cn-pre" data-pre="${r.chave}" aria-pressed="false" onclick="_cbEscolherPronta('${r.chave}')"><span class="cn-pre-ic">${r.icone}</span><span class="cn-pre-tx">${esc(r.texto)}</span><span class="cn-pre-ok" aria-hidden="true">✓</span></button>`).join('');
    return `<section class="cn-slide" id="cbSlide0" aria-labelledby="cbT0">
      <div class="cn-wrap">
        <div class="cb-cab"><div class="cn-etapa">Passo 1 de ${_cbTotalPassos}</div>
        <h2 class="cn-h2" id="cbT0" tabindex="-1">Por onde você quer começar?</h2></div>
        <p class="cn-sub">Cole a regra que o cliente já usa, escolha uma das regras prontas como base <b>ou</b> marque a opção de montar do zero. Só depois de escolher um dos três o botão <b>Avançar</b> é liberado.</p>
        <div class="cn-colunas">
          <div class="cn-cartao">
            <label class="cn-cartao-titulo" for="wCteColarRegra">📋 Colar a regra que o cliente já usa</label>
            <textarea id="wCteColarRegra" class="cn-codigo" placeholder="Cole aqui a regra que já existe no sistema do cliente..." spellcheck="false" oninput="_cbColarInput()"></textarea>
            <div class="cn-resumo" id="wCteBetaResumoColar" role="status"></div>
          </div>
          <div class="cn-ou" aria-hidden="true">ou</div>
          <div class="cn-cartao">
            <div class="cn-cartao-titulo" id="cbTProntas">📚 Usar uma regra pronta como base</div>
            <div class="cn-prontas" role="group" aria-labelledby="cbTProntas">${prontas}</div>
            <div class="cn-resumo" id="wCteBetaResumoPronta" role="status"></div>
          </div>
        </div>
        <div class="cb-zero-ou" aria-hidden="true">ou</div>
        <label class="cb-zero" id="wCteBetaZeroRot" for="wCteBetaZero">
          <input type="checkbox" id="wCteBetaZero" onchange="_cbZeroMudou(this.checked)">
          <span class="cb-zero-tx"><b>Para montar do zero clique em avançar</b><small>Marque esta opção para começar com a montagem vazia. Ela descarta a regra colada ou a regra base escolhida.</small></span>
        </label>
        <div class="cn-nota">ℹ️ Trocar a regra base aqui recomeça a montagem: as opções marcadas nos passos de cálculo (3 a 5) são desmarcadas.</div>
      </div>
    </section>`;
}
// Tela 2 — campos personalizados
function _cbHtmlCampos() {
    return `<section class="cn-slide" id="cbSlide1" aria-labelledby="cbT1" hidden>
      <div class="cn-wrap">
        <div class="cb-cab"><div class="cn-etapa">Passo 2 de ${_cbTotalPassos}</div>
        <h2 class="cn-h2" id="cbT1" tabindex="-1">Irá utilizar campos personalizados?</h2></div>
        <p class="cn-sub">(São campos criados em <b>Transporte &gt; Configurações &gt; Tipos Valores Outros</b> ou <b>Transporte &gt; Tabelas de Preços &gt; Tabela de preços Valores Outros</b>)</p>
        <div class="cn-escolhas" role="radiogroup" aria-labelledby="cbT1">
          <label class="cn-escolha"><input type="radio" name="wCteBetaUsaCampos" value="nao" checked onchange="_cbRadioMudou()"><span class="cn-escolha-corpo"><b>Não</b><small>Vou usar só os campos que já existem no sistema</small></span></label>
          <label class="cn-escolha"><input type="radio" name="wCteBetaUsaCampos" value="sim" onchange="_cbRadioMudou()"><span class="cn-escolha-corpo"><b>Sim</b><small>Vou informar o nome interno dos campos</small></span></label>
        </div>
        <div class="cn-sugestao" id="wCteBetaSugestao" hidden></div>
        <div class="cn-campos-grupo" id="wCteBetaCamposBox" hidden>
          <p class="cn-campos-instr">Se sim, preencha com o nome interno dos campos abaixo, separados por vírgula. Preencha só o que for usar.</p>
          <div class="cn-aviso" id="wCteBetaCamposGeral" role="status"></div>
          <div class="cn-campos-duplo">
            <div class="cn-cartao cn-campos-box">
              <label class="cn-cartao-titulo" for="wCteBetaCamposInput">🧾 Ct-e / Contrato de Frete</label>
              <div class="cn-campos-origem">Criados em Transporte &gt; Configurações &gt; Tipos Valores Outros</div>
              <textarea id="wCteBetaCamposInput" class="cn-input" rows="3" placeholder="Ex.: advalorem, taxa1, taxa2" autocomplete="off" spellcheck="false" oninput="_cbCamposMudou()"></textarea>
              <div class="cn-aviso" id="wCteBetaCamposAviso" role="status"></div>
              <div class="cn-chips" id="wCteBetaCamposChips"></div>
            </div>
            <div class="cn-cartao cn-campos-box cn-tabela">
              <label class="cn-cartao-titulo" for="wCteBetaCamposTabelaInput">📋 Tabela de Preços</label>
              <div class="cn-campos-origem">Criados em Transporte &gt; Tabelas de Preços &gt; Tabela de preços Valores Outros</div>
              <textarea id="wCteBetaCamposTabelaInput" class="cn-input cn-tabela" rows="3" placeholder="Ex.: advalorem, taxaextra" autocomplete="off" spellcheck="false" oninput="_cbCamposMudou()"></textarea>
              <div class="cn-aviso" id="wCteBetaCamposTabelaAviso" role="status"></div>
              <div class="cn-chips" id="wCteBetaCamposTabelaChips"></div>
            </div>
          </div>
          <div class="cn-dica">Esses campos ficam prontos para arrastar na montagem manual (passo ${_cbTotalPassos}): os do <b>Ct-e / Contrato de Frete</b> dentro da caixa <b>Utiliza Valores outros (Campos Personalizados)?</b> e os da <b>Tabela de Preços</b> na faixa <b>Campos personalizados da Tabela de Preços</b>, logo abaixo dela.</div>
        </div>
      </div>
    </section>`;
}
// Uma opção (caixinha) dos passos de cálculo. busca = palavras que o filtro compara (título do grupo + nome + palavras-chave); gi = grupo "de exclusividade" das opções que não têm o seu próprio.
function _cbHtmlOpcao(item, gi, busca) {
    const rot = CB_ROTULOS[item.id] || item.label;   // nome mostrado; o nome antigo (do catálogo compartilhado) continua valendo na busca
    return `<div class="cn-opcao" data-busca="${esc(_cnPalavras(busca + ' ' + rot + ' ' + item.label + ' ' + (CN_BUSCA[item.id] || item.buscaExtra || '')))}">
            <label class="cn-opcao-rotulo"><input type="checkbox" id="wCteOpc_${item.id}" class="wCteOpcCheckbox" data-grupo="${esc(CB_GRUPO_FORCADO[item.id] || item.grupoExclusivo || gi)}" onchange="_cbOpcaoClicada(this)"><span>${esc(rot)}${item.nota ? ' <small class="cb-opc-nota">— ' + esc(item.nota) + '</small>' : ''}</span></label>
            ${item.entrada ? _cteEntradaOpcaoHtml(item) : ''}
          </div>`;
}
// Recado fixo embaixo do título de um grupo
function _cbNotaGrupo(grupo) {
    if (/Cálculo do ICMS/.test(grupo.titulo)) return `<p class="cn-grupo-nota alerta"><span aria-hidden="true">⛔</span><span><b>O valor do ICMS não pode ser reduzido.</b> Ele tem que ser sempre <b>Base de Cálculo × Alíquota</b>: se não bater, a SEFAZ rejeita o Ct-e. Para pagar menos ICMS, reduza a <b>Base de Cálculo</b> (opção “Redução Base de cálculo?”, logo abaixo).</span></p>`;
    return '';
}
// Painel de opções de UMA etapa de cálculo (frete / icms / total): os grupos dela em CTE_OPCOES_MONTAGEM + o "Demais opções" só com as contas "Somar X no <campo da etapa>".
// Só o painel da etapa atual aparece (ver _cbMostrarEtapa); os outros ficam escondidos com as caixinhas dentro, então o que foi marcado antes continua valendo.
function _cbHtmlPainelEtapa(chave) {
    const e = CB_ETAPAS[chave], gd = CTE_OPCOES_MONTAGEM.length;
    const grupos = e.grupos.map(tit => {
        const gi = CTE_OPCOES_MONTAGEM.findIndex(g => g.titulo.indexOf(tit) !== -1), grupo = CTE_OPCOES_MONTAGEM[gi];
        if (!grupo) return '';
        const extras = Object.keys(CB_GRUPO_EXTRAS).filter(k => grupo.titulo.indexOf(k) !== -1).flatMap(k => CB_GRUPO_EXTRAS[k]);   // as opções só deste assistente vêm no fim do grupo
        return `<section class="cn-grupo" aria-labelledby="cbG${gi}">
          <h3 class="cn-grupo-titulo" id="cbG${gi}">${esc(grupo.titulo)}</h3>
          ${_cbNotaGrupo(grupo)}
          ${grupo.itens.filter(item => !CN_MOVIDAS_PARA_DEMAIS.includes(item.id)).flatMap(item => [item].concat(CB_GRUPO_APOS[item.id] || [])).concat(extras).map(item => _cbHtmlOpcao(item, gi, grupo.titulo)).join('')}
        </section>`;
    }).join('');
    // "Somar no <campo>": uma CAIXA (id wCteBetaSomar_<campo>) abre/fecha as contas prontas — elas só aparecem com a caixa marcada (ver _cbSomarToggle)
    const blocos = e.somar.map(campo => {
        const bl = CN_SOMA_BLOCOS[CN_SOMA_ALVOS.findIndex(a => a.campo === campo)];
        const itens = (CB_SOMA_EXTRAS[campo] || []).concat(bl ? bl.itens : []);   // as contas só deste assistente vêm primeiro
        return bl ? `<div class="cn-sub-bloco cb-sub-recolhivel" data-somar="${campo}">
            <label class="cn-sub-titulo cb-sub-toggle"><input type="checkbox" id="wCteBetaSomar_${campo}" onchange="_cbSomarToggle(this)"><span>${esc(bl.titulo)}</span><small class="cb-sub-dica" data-padrao="Marque para ver as ${itens.length} contas prontas">Marque para ver as ${itens.length} contas prontas</small></label>
            <div class="cb-sub-itens" hidden>${itens.map(it => _cbHtmlOpcao(it.ref ? _cnTodasOpcoes().find(o => o.id === it.ref) : it, gd, CN_TITULO_DEMAIS + ' ' + bl.titulo)).join('')}</div>
          </div>` : '';
    }).join('');
    const demais = `<section class="cn-grupo" aria-labelledby="cbGd-${chave}">
          <h3 class="cn-grupo-titulo" id="cbGd-${chave}">${esc(CN_TITULO_DEMAIS)}</h3>
          <p class="cn-grupo-nota"><span aria-hidden="true">ℹ️</span><span>Contas prontas para somar um campo em outro (ex.: “Somar ICMS no Frete Valor”). Marque a caixa abaixo para ver as contas e marque quantas precisar. Cada uma entra na conta que a regra base já faz do campo de destino: escolha uma regra base no passo 1 ou monte esse campo na montagem manual (passo ${_cbTotalPassos}).</span></p>
          ${blocos}
        </section>`;
    return `<div class="cb-etapa-opcoes" data-etapa="${chave}" hidden>${grupos}${demais}</div>`;
}
// Passos 3, 4 e 5 — a MESMA tela da Nova Versão (filtro, opções, caixa da IA), só que cada passo mostra apenas as opções de um cálculo (título e painel trocam em _cbMostrarEtapa)
function _cbHtmlOpcoes() {
    const paineis = Object.keys(CB_ETAPAS).map(_cbHtmlPainelEtapa).join('');
    return `<section class="cn-slide" id="cbSlide2" aria-labelledby="cbT2" hidden>
      <div class="cn-wrap">
        <div class="cn-topo-aviso" id="wCteBetaAvisoManual"><span aria-hidden="true">💡</span><span>Se preferir montar a regra manualmente, marque a opção <b>“Desejo fazer a montagem manual da regra”</b> no rodapé e clique em <b>avançar para montagem manual</b></span></div>
        <div class="cb-cab"><div class="cn-etapa" id="wCteBetaEtapa">Passo 3 de ${_cbTotalPassos}</div>
        <h2 class="cn-h2" id="cbT2" tabindex="-1">${esc(CB_PASSOS[CB_PRIMEIRO_CALCULO].nome)}</h2></div>
        <div class="cb-filtro-linha"><input type="search" id="wCteBetaFiltro" class="cn-filtro" placeholder="🔎 Digite para filtrar as opções..." autocomplete="off" spellcheck="false" aria-label="Digite para filtrar as opções deste passo" oninput="_cbFiltrar()" onkeydown="_cbFiltroTecla(event)">
        <div class="cn-filtro-info" id="wCteBetaFiltroInfo" role="status" aria-live="polite"></div></div>
        <div class="cn-marcadas vazio" id="wCteBetaMarcadas"></div>
        <div class="cn-colunas-opcoes">
          <div>
            <div class="cn-legenda">🧱 Monte com um clique — marque o que a regra precisa</div>
            <div id="wCteBetaOpcoes">${paineis}
              <div class="cn-sem-resultado" id="wCteBetaSemResultado" hidden></div>
            </div>
          </div>
          <aside class="cn-ia" id="wCteBetaIA">
            <label class="cn-ia-titulo" for="wCteDescricao">✨ Ou se preferir, explique diretamente para a IA o que o cliente necessita, seja bem claro</label>
            <textarea id="wCteDescricao" class="cn-ia-texto" placeholder="Ex.: o cliente quer o frete calculado pelo peso em toneladas, com ICMS por dentro e seguro de 0,3% sobre o valor das notas."></textarea>
            <div class="cn-aviso erro" id="wCteBetaAvisoIcmsTexto" role="alert"></div>
            <div class="cn-dica">A IA junta o que você marcou ao lado com o que você escrever aqui.</div>
            <div class="cn-dica">⛔ Não peça para reduzir o <b>valor do ICMS</b>: a SEFAZ rejeita. Para pagar menos ICMS, peça a redução da <b>base de cálculo</b>.</div>
          </aside>
        </div>
      </div>
    </section>`;
}
// Passo 6 — a área de montagem de sempre
function _cbHtmlMontagem() {
    return `<section class="cn-slide cn-slide-montagem" id="cbSlide3" aria-labelledby="cbT3" hidden>
      <div class="cn-wrap">
        <div class="cn-montagem-topo">
          <div>
            <div class="cn-etapa">Passo ${_cbTotalPassos} de ${_cbTotalPassos}</div>
            <h2 class="cn-h2 pequeno" id="cbT3" tabindex="-1">Montagem manual</h2>
            <p class="cn-sub">A regra já vem com o que você escolheu nos passos anteriores. Ajuste do seu jeito arrastando os campos e, no fim, clique em <b>Gerar Regra Montada</b>.</p>
          </div>
          <div class="cn-montagem-acoes">
            <button type="button" class="cn-btn sec peq" onclick="_cbVoltar()">◀ Voltar ao passo ${_cbTotalPassos - 1}</button>
            <button type="button" id="wCteBtnTutorial" class="tour-btn-abrir cn-tour" onclick="_iniciarTourBuilder('cte')">🎓 Ver tutorial passo a passo</button>
          </div>
        </div>
        <div class="cn-ia-aviso" id="wCteBetaAvisoIA" hidden></div>
        <div class="cb-montagem-grid">${_cteHtmlAreaMontagem()}</div>
      </div>
    </section>`;
}

// ── abrir ────────────────────────────────────────────────────────────────────
function mostrarWizardRegraCteBeta(queryOriginal) {
    window._cteAssistenteAberto = 'cte-beta';   // o motor das opções (_cteGruposOpcoes) precisa saber qual assistente é, mesmo antes do cartão entrar na tela
    _wizardRegraDndQuery = queryOriginal || '';   // (declarada em assistente-regras.js) usada por enviarWizardRegraDnd / "Voltar"
    window._cteAcaoSel = null;
    window._cteBlocos = [{ destino: '', expr: null }];
    window._cteExtras = [];
    window._cteOpcionaisBase = null;
    window._cteTabelaCustom = [];   // campos personalizados da Tabela de Preços (tela 2); o montador clássico nunca preenche isto
    _cbPasso = 0; _cbVisitados = new Set([0]); _cbTourVisto = false; _cbManualOk = false; _cbAlertaLoopIA = ''; _cbPadraoDesmarcado = false; _cbBaseExterna = false; _cbDetBase = null; _cbFreteBaseTirado = false; _cbFreteBaseManual = false; _cbAvisoBaseDupla = false; _cbJaNaRegraAtual = new Set();
    const corpo = _cnEl('builderModalBody');
    corpo.innerHTML = '';
    const card = document.createElement('div');
    card.id = 'wizardRegraBetaCard';
    card.className = 'builder-card cn-card cb-anti';   // cb-anti = layout anti-scroll (ver _cbAjustar e o bloco ".cb-anti" de css/regra-passos.css)
    card.innerHTML = _cbHtmlTopo()
        + '<div class="cn-aviso-icms" id="wCteBetaAvisoIcms" role="alert" hidden></div>'   // trava do ICMS: aparece em qualquer tela enquanto a regra montada alterar o valor do ICMS (ver _cbAtualizarAvisoIcms)
        + '<div class="cn-aviso-icms cn-aviso-loop" id="wCteBetaAvisoLoop" role="alert" hidden></div>'   // trava de loop: idem, enquanto campos da regra dependerem um do outro (ver _cbAtualizarAvisoLoop)
        + '<div class="cn-corpo" id="wCteBetaCorpo">' + _cbHtmlBase() + _cbHtmlCampos() + _cbHtmlOpcoes() + _cbHtmlMontagem() + '</div>'
        + '<div class="cn-rodape" id="wCteBetaRodape"></div>';
    corpo.appendChild(card);
    // Faixa dos campos personalizados da Tabela de Preços: só existe nesta versão, logo abaixo da caixa "Utiliza Valores outros" (que é dos campos do Ct-e) e só aparece
    // quando há nomes (ver _cbRenderTabelaCustom). Fica fora do HTML compartilhado (_cteHtmlAreaMontagem), então o montador clássico não muda em nada.
    const caixaRosa = _cnEl('wCteOutrosValoresWrap') && _cnEl('wCteOutrosValoresWrap').parentElement;
    if (caixaRosa) caixaRosa.insertAdjacentHTML('afterend', '<div class="cn-tab-custom" id="wCteTabCustomBox" hidden><div class="cn-tab-custom-t">📋 Campos personalizados da Tabela de Preços <span>(entram sem obt)</span></div><div class="cn-chips" id="wCteTabCustomChips"></div></div>');
    card.addEventListener('input', _cbAoDigitar);
    _cteRenderBlocos();
    _cbMarcarPadrao();          // "Somar Frete Valor no Total Prestação" já nasce marcada
    _abrirBuilderModal(null);   // sem o tutorial automático: ele só faz sentido na tela da montagem (ver _cbTourPrimeiraVez)
    _cbSomarSync();
    _cbLigarAjuste(card);
    _cbIrPara(0);
}

// ── layout ANTI-SCROLL ───────────────────────────────────────────────────────
// Cada passo é desenhado no tamanho natural (as opções viram colunas conforme a largura) e encolhido — só o necessário — para caber INTEIRO na área do corpo, sem barra de rolagem,
// qualquer que seja a resolução do monitor (CSS em css/regra-passos.css, bloco ".cb-anti"). O encolhimento é um transform: scale() do .cn-wrap do passo visível: o .cn-wrap ganha largura e altura
// de (área ÷ escala), então tudo é diagramado "maior" e depois reduzido. A escala é a MAIOR em que nada estoura (busca binária); se nem a escala mínima cabe (janela minúscula ou zoom do navegador
// bem alto), o ajuste desiste e aparece a rolagem (.cb-rola) — é a única hora em que a barra existe. Medido sem o filtro da tela: a escala não "respira" enquanto a pessoa digita.
const CB_ESCALA_MIN = 0.58;              // menor escala dos passos 1 a 5 (abaixo disso a letra fica pequena demais; a prioridade é caber tudo na tela)
const CB_ESCALA_MIN_MONTAGEM = 0.58;      // menor escala da montagem manual (passo 6): é a tela mais cheia (todos os campos + a lista de campos montados)
let _cbEscala = 1, _cbAjusteTimer = 0, _cbObservador = null;
function _cbAjustar() {
    const card = _cnEl('wizardRegraBetaCard'), corpo = _cnEl('wCteBetaCorpo');
    if (!card || !corpo) return;
    const slide = _cnEl('cbSlide' + CB_PASSOS[_cbPasso].slide), wrap = slide && !slide.hidden && slide.querySelector('.cn-wrap');
    if (!wrap) return;
    const W = corpo.clientWidth, H = corpo.clientHeight;
    if (!W || !H) return;
    const rolagemAntes = corpo.scrollTop;   // com a barra de rolagem (janela minúscula) a medição tira e põe a rolagem: guarda onde a pessoa estava para não voltar ao topo a cada clique
    card.querySelectorAll('.cn-wrap').forEach(w => { w.style.transform = ''; w.style.width = ''; w.style.height = ''; });
    corpo.classList.remove('cb-rola');
    card.classList.add('cb-medindo');   // mostra todas as opções (como se o filtro estivesse vazio) só durante a medição
    // as caixas "Somar no …" que a BUSCA abriu contam como fechadas nesta medição: a escala não pode mudar só porque a pessoa pesquisou (o que a busca mostra costuma caber com folga, porque o filtro esconde o resto)
    const abertasPelaBusca = [...card.querySelectorAll('.cb-sub-recolhivel[data-auto="1"] .cb-sub-itens')].filter(it => !it.hidden);
    abertasPelaBusca.forEach(it => { it.hidden = true; });
    const min = _cbPasso === CB_MONTAGEM ? CB_ESCALA_MIN_MONTAGEM : CB_ESCALA_MIN;
    const cabe = s => { wrap.style.width = (W / s) + 'px'; wrap.style.height = (H / s) + 'px'; return wrap.scrollHeight <= wrap.clientHeight + 1 && wrap.scrollWidth <= wrap.clientWidth + 1; };
    const procurar = (teto) => { let lo = min, hi = teto; for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (cabe(m)) lo = m; else hi = m; } return Math.floor(lo * 100 + 1e-6) / 100; };   // arredonda PARA BAIXO: menor escala sempre cabe
    let s = 1, rola = false;
    if (!cabe(1)) {
        if (!cabe(min)) { s = min; rola = true; }
        else s = procurar(1);
    }
    if (abertasPelaBusca.length) {
        // agora o estado REAL (caixas abertas pela busca, filtro aplicado): se não couber na escala achada, baixa só o necessário
        abertasPelaBusca.forEach(it => { it.hidden = false; });
        card.classList.remove('cb-medindo');
        if (!rola && !cabe(s)) {
            if (!cabe(min)) { s = min; rola = true; }
            else s = procurar(s);
        }
    }
    wrap.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    wrap.style.width = (W / s) + 'px';
    wrap.style.height = rola ? 'auto' : (H / s) + 'px';
    corpo.classList.toggle('cb-rola', rola);
    card.classList.remove('cb-medindo');
    if (rola) corpo.scrollTop = rolagemAntes;
    _cbEscala = s;
}
// Refaz o ajuste daqui a pouco (junta vários pedidos seguidos num só)
function _cbAjustarAgendado(ms) {
    clearTimeout(_cbAjusteTimer);
    _cbAjusteTimer = setTimeout(() => { _cbAjusteTimer = 0; _cbAjustar(); }, ms == null ? 30 : ms);
}
// Liga o ajuste ao assistente recém-aberto: tamanho da área do corpo mudou (janela redimensionada, zoom do navegador, faixas de aviso que abrem/fecham, rodapé que cresce) e qualquer clique/digitação
// dentro dele (abrir uma caixa, adicionar um campo na montagem, marcar uma opção...) pode mudar a altura do conteúdo.
function _cbLigarAjuste(card) {
    if (_cbObservador) { _cbObservador.disconnect(); _cbObservador = null; }
    const corpo = _cnEl('wCteBetaCorpo');
    if (typeof ResizeObserver !== 'undefined' && corpo) { _cbObservador = new ResizeObserver(() => _cbAjustarAgendado(0)); _cbObservador.observe(corpo); }
    card.addEventListener('click', () => _cbAjustarAgendado());
    card.addEventListener('change', () => _cbAjustarAgendado());
    card.addEventListener('input', () => _cbAjustarAgendado(150));
    if (!window.__cbResizeLigado) { window.__cbResizeLigado = true; window.addEventListener('resize', () => { if (_cnEl('wizardRegraBetaCard')) _cbAjustarAgendado(0); }); }
}
// "Somar Frete Valor no Total Prestação" vem MARCADA por padrão. Trocar a regra base no passo 1 (colar, escolher uma regra pronta, "do zero") desmarca todas as opções, então esta é marcada de novo
// logo depois — a não ser que a pessoa a tenha desmarcado de propósito (_cbPadraoDesmarcado). Com uma regra base que já soma o frete no total, marcar não muda a regra (não duplica).
// Só vale para a regra montada do zero: com uma regra colada / regra base escolhida (_cbBaseExterna) NADA é marcado nem aplicado sozinho — as caixinhas só refletem o que a regra já tem
// (ver "marcar conforme a regra", logo abaixo), para não editar a regra da pessoa sem ela querer.
// "Desmarquei a opção padrão de propósito" só vale numa regra montada do zero: numa regra de fora, desmarcá-la é tirar uma parte DAQUELA regra (não uma preferência), e não pode valer para a próxima regra.
function _cbNotaPadrao(desmarcou) { if (!_cbBaseExterna) _cbPadraoDesmarcado = !!desmarcou; }
function _cbMarcarPadrao() {
    if (_cbPadraoDesmarcado || _cbBaseExterna) { _cbSomarSync(); return; }
    const c = _cnEl('wCteOpc_' + CB_ID_PADRAO);
    if (!c || c.checked) { _cbSomarSync(); return; }
    c.checked = true;
    _cbSomarSync();           // a opção fica dentro da caixa "Somar no Total Prestação": conta marcada abre a caixa
    _cteAplicarOpcionais();   // aplica na área de montagem junto das outras opções marcadas
    _cbAtualizarMarcadas();
}

// ── marcar conforme a regra ──────────────────────────────────────────────────
// Ao COLAR uma regra ou ESCOLHER uma regra base, as caixinhas dos passos 3 a 5 já vêm marcadas conforme o que a regra JÁ tem (ex.: "Somar Gris no Total Prestação" só vem marcada se o Total Prestação da
// regra já soma o Gris; "Somar Frete Valor no Total Prestação" idem), para ninguém editar a regra sem querer. Marcar assim NÃO mexe na regra: ela fica exatamente como entrou.
// A leitura é feita sobre a BASE das opções (window._cteOpcionaisBase = a regra como entrou), nunca sobre o resultado já mexido, então a mesma regra dá sempre a mesma resposta (também depois do "Voltar").
// Depois disso as caixinhas funcionam nos dois sentidos, pelo gancho prepararBase do motor das opções (_cteAplicarOpcionais): desmarcar uma que veio da regra TIRA da regra o que ela fazia (a soma sai
// da conta; o cálculo sai com as linhas dele) e marcar de novo volta ao que estava; marcar OUTRA do mesmo grupo (outro jeito de calcular o frete, por exemplo) troca no lugar, sem mudar a ordem da regra.
// "Preencher manualmente" não é lido da regra (não é um trecho dela, é uma escolha da pessoa): continua só sendo marcada pela pessoa.
const _cbMARCA = '987654321';      // entra no lugar do {valor} das opções que pedem um número, para montar o padrão de leitura
const _cbCodigos = {};             // opção -> { blocos, extras, destinos } do código dela, já lido (memória)
let _cbDetBase = null, _cbDetMapa = new Map();   // leitura da base atual (memorizada pela identidade da base: muda quando a regra é trocada ou restaurada)
const _cbEscRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Conta sem espaços e sem parênteses que não mudam nada: (obt('a')) = obt('a'), ((a*b)) = (a*b), (a*b) inteiro entre parênteses = a*b. Chamada de função (f(x)) fica como está.
function _cbNorm(s) {
    let t = String(s == null ? '' : s).replace(/\s+/g, '');
    for (let k = 0; k < 60; k++) {
        const par = new Array(t.length).fill(-1), pilha = [];   // par[i] = posição do parêntese que fecha/abre o de i
        for (let i = 0; i < t.length; i++) {
            if (t[i] === '(') pilha.push(i);
            else if (t[i] === ')') { const o = pilha.pop(); if (o === undefined) return t; par[o] = i; par[i] = o; }
        }
        if (pilha.length) return t;   // parênteses desencontrados: deixa como está
        let tirou = false;
        for (let i = 0; i < t.length && !tirou; i++) {
            if (t[i] !== '(' || (i > 0 && /[\w\])]/.test(t[i - 1]))) continue;   // "f(x)" é chamada de função: os parênteses são dela
            const j = par[i], dentro = t.slice(i + 1, j);
            const duplo = t[i + 1] === '(' && par[i + 1] === j - 1;                                  // ((x)) -> (x)
            const atomo = /^(?:obt\('[^']*'\)|[\w.]+(?:\[[^\]]*\])?)$/.test(dentro);                 // (campo) ou (número) -> campo / número
            const tudo = i === 0 && j === t.length - 1;                                             // a conta inteira entre parênteses
            if (duplo || atomo || tudo) { t = t.slice(0, i) + dentro + t.slice(j + 1); tirou = true; }
        }
        if (!tirou) return t;
    }
    return t;
}
const _cbMesmoTermo = (a, b) => _cbNorm(a) === _cbNorm(b);
const _cbFixo = b => { const e = String(b.expr == null ? '' : b.expr).trim(); return !e || /^\(*\s*-?\d+([.,]\d+)?\s*\)*$/.test(e); };   // o mesmo critério de _aplicarSomaEmCampo: definição que só vale um número fixo não é uma conta
function _cbBlocoIgual(a, b) {
    return a.destino === b.destino && !!a.temCondicao === !!b.temCondicao && _cbNorm(a.expr) === _cbNorm(b.expr) && (!a.temCondicao || _cbNorm(a.condicaoRaw) === _cbNorm(b.condicaoRaw));
}
// Posição do termo numa definição, se ele é uma PARCELA da soma (e dá para tirá-lo sem estragar a conta): entra com "+" (ou é o 1º termo, seguido de "+"), e depois dele só vêm "+" ou "-".
// Subtraído, multiplicado/dividido (ex.: valorFrete * 1.1) ou o 1º termo de uma conta que continua com "-" não é "somar" (e tirá-lo mudaria o sinal/o valor do resto).
function _cbIndiceTermo(b, termo) {
    const ts = b.termos || [];
    if (ts.some(t => t.acao === '-' && _cbMesmoTermo(t.termo, termo))) return -1;   // o mesmo campo também é SUBTRAÍDO na conta (ex.: + Gris - Gris): não é "somar", e tirar só a parcela "+" mudaria o valor
    return ts.findIndex((t, k) => _cbMesmoTermo(t.termo, termo)
        && (k === 0 ? (ts.length === 1 || ts[1].acao === '+') : t.acao === '+')
        && ts.slice(k + 1).every(x => x.acao === '+' || x.acao === '-'));
}
// o código da opção já lido em blocos (como a regra colada é lida, então os dois são comparáveis); destinos = campos que o cálculo dela define
function _cbCodigoDaOpcao(it) {
    if (_cbCodigos[it.id]) return _cbCodigos[it.id];
    const { blocos, extras } = _parseRegraParaBlocos(String(it.codigo || '').replace(/\{valor\}/g, _cbMARCA));
    blocos.forEach(_seedTermosBase);
    return (_cbCodigos[it.id] = { blocos, extras, destinos: [...new Set(blocos.map(b => b.destino))] });
}
// o cálculo da opção SUBSTITUI as definições dos campos dele (o modo padrão, e o GNRE): é isso que marca outra do mesmo campo "no lugar"
const _cbSubstitui = it => it.modo !== 'somar' && it.modo !== 'somarEm' && it.modo !== 'nada' && (it.modo !== 'inserirApos' || !!it.substituirExistentes);
// A opção já está na regra? null = não está; { destinos, valor } = está (valor = o número, nas opções que pedem um). Só diz que sim quando a regra tem EXATAMENTE o que a opção poria — na dúvida, não marca.
// O texto de uma conta (já normalizado) casa com o do código da opção? Opção com número (redução): o número é o que estiver no lugar da marca, dentro da faixa dela.
function _cbCasaTexto(x, modelo, it) {
    if (it.entrada && modelo.includes(_cbMARCA)) {
        const m = new RegExp('^' + _cbEscRe(modelo).replace(_cbMARCA, '(\\d{1,3}(?:\\.\\d{1,4})?)') + '$').exec(x);
        const n = m ? Number(m[1]) : NaN;
        return m && n >= it.entrada.min && n <= it.entrada.max ? { valor: String(n) } : null;
    }
    return x === modelo ? { valor: null } : null;
}
// Uma definição da regra (a) é a definição da opção (b)? Igual, OU a conta da opção com parcelas SOMADAS por cima (as contas "Somar X no Y": ex.: Tarifa x peso (KG) + Outros, ou Cálculo Inverso + Seguro na base).
function _cbCasaBloco(a, b, it) {
    if (a.destino !== b.destino || !!a.temCondicao !== !!b.temCondicao) return null;
    if (b.temCondicao && _cbNorm(a.condicaoRaw) !== _cbNorm(b.condicaoRaw)) return null;
    const inteira = _cbCasaTexto(_cbNorm(a.expr), _cbNorm(b.expr), it);
    if (inteira) return inteira;
    const ta = _seedTermosBase({ ...a, termos: (a.termos || []).map(t => ({ ...t })) }).termos || [], tb = b.termos || [];
    if (!tb.length || ta.length <= tb.length) return null;
    let valor = null;
    for (let i = 0; i < tb.length; i++) {
        if ((ta[i].acao || null) !== (tb[i].acao || null)) return null;
        const r = _cbCasaTexto(_cbNorm(ta[i].termo), _cbNorm(tb[i].termo), it);
        if (!r) return null;
        if (r.valor != null) valor = r.valor;
    }
    return ta.slice(tb.length).every(t => t.acao === '+') ? { valor } : null;
}
// A Base de Cálculo montada usa o Frete Valor? (em TODAS as definições dela que calculam algo: somado, ou dentro do cálculo — ICMS Demonstrativo, Cálculo Inverso, Redução...)
const _cbTermoFrete = "obt('valorFrete')", _cbTermoTotal = "obt('totalPrestacao')";
const _cbBaseDefs = blocos => (blocos || []).filter(b => b.destino === 'baseCalculo' && !_cbFixo(b));
const _cbUsaTermo = (b, termo) => _cbNorm(b.expr).includes(_cbNorm(termo));
function _cbBaseUsaFrete(blocos) { const defs = _cbBaseDefs(blocos); return defs.length > 0 && defs.every(b => _cbUsaTermo(b, _cbTermoFrete)); }
function _cbPresente(it, blocos, extras) {
    if (it.id === CB_ID_SOMAR_ICMS) {   // "Somar ICMS" = o cálculo do Demonstrativo + o ICMS somado no Total Prestação (tem que ter os dois)
        const todas = _cnTodasOpcoes(), dem = todas.find(o => o.id === CB_ID_DEMONSTRATIVO), som = todas.find(o => o.id === CB_ID_ICMS_SOMAR);
        const a = dem && _cbPresente(dem, blocos, extras);
        return a && som && _cbPresente(som, blocos, extras) ? a : null;
    }
    if (it.id === CB_ID_FRETE_BASE) return _cbBaseUsaFrete(blocos) ? { destinos: ['baseCalculo'] } : null;   // derivada: "o Frete Valor faz parte da base", seja qual for o jeito (ver CB_ITEM_FRETE_BASE)
    if (it.modo === 'somar' || it.modo === 'somarEm') {
        const defs = blocos.filter(b => b.destino === it.campoAlvo && !(it.modo === 'somarEm' && _cbFixo(b)));
        if (!defs.length) return null;
        const tem = b => _cbIndiceTermo(b, it.termoNovo.termo) !== -1;
        return (it.modo === 'somar' ? tem(defs[0]) : defs.every(tem)) ? { destinos: [it.campoAlvo] } : null;   // o "Somar" do clássico soma só na 1ª definição; as da Nova Versão/Beta, em todas as que calculam algo
    }
    const { blocos: nb, destinos } = _cbCodigoDaOpcao(it);
    if (!nb.length) return null;
    if (it.modo === 'inserirApos') return nb.every(b => blocos.some(x => _cbBlocoIgual(x, b))) ? { destinos } : null;
    let valor = null;
    for (const d of destinos) {
        const re = new RegExp('def\\(\\s*["\']' + _cbEscRe(d) + '["\']');
        if (extras.some(x => re.test(_semLinhasComentario(x.linha)))) return null;   // o campo também é definido numa "linha extra" (if/else): não é só isto
        const deles = blocos.filter(b => b.destino === d), meus = nb.filter(b => b.destino === d);
        if (deles.length !== meus.length) return null;
        for (let i = 0; i < meus.length; i++) {
            const r = _cbCasaBloco(deles[i], meus[i], it);   // (igual, ou com parcelas somadas por cima; opção com número: lê o número da conta)
            if (!r) return null;
            if (r.valor != null) valor = r.valor;
        }
    }
    return { destinos, valor };
}
// Lê a base e devolve Map(id da opção -> { destinos, valor }) com tudo o que a regra já tem. No máximo 1 por grupo (como as caixinhas).
function _cbDetectar(base) {
    const mapa = new Map();
    if (!base) return mapa;
    const blocos = _clonarBlocos(base.blocos || []).map(_seedTermosBase), extras = base.extras || [];
    const grupos = new Set();
    // "Somar Total Prestação na Base" é lida ANTES de "Somar Frete Valor na Base" (mesmo grupo): se a base da regra soma os dois, vale o total (o frete já está nele) e o aviso de duplicidade é dado no passo 1
    // (e "Somar ICMS" antes do Demonstrativo: se a regra tem o cálculo do Demonstrativo E o ICMS somado no total, quem aparece marcada é "Somar ICMS", e não as duas — são exclusivas)
    const prioridade = it => (it.id === CB_ID_TOTAL_BASE || it.id === CB_ID_SOMAR_ICMS) ? 1 : 0;
    const ordem = _cnTodasOpcoes().slice().sort((a, b) => prioridade(b) - prioridade(a));
    ordem.forEach(it => {
        const c = _cnEl('wCteOpc_' + it.id);
        if (!c || it.modo === 'nada') return;   // só as caixinhas que existem nesta tela; "Preencher manualmente" não se lê da regra
        const r = _cbPresente(it, blocos, extras);
        if (!r) return;
        if (it.id === CB_ID_FRETE_BASE && mapa.has(CB_ID_TOTAL_BASE)) mapa.dupla = true;   // a base soma o frete E o total prestação: o frete entra duas vezes na regra do cliente
        if (grupos.has(c.dataset.grupo)) return;
        grupos.add(c.dataset.grupo);
        mapa.set(it.id, r);
    });
    return mapa;
}
// O que a regra de fora já tinha (vazio quando a regra é montada do zero)
function _cbDetectadas() {
    const b = window._cteOpcionaisBase;
    if (!_cbBaseExterna || !b) return new Map();
    if (b !== _cbDetBase) { _cbDetBase = b; _cbDetMapa = _cbDetectar(b); }
    return _cbDetMapa;
}
// Marca as caixinhas conforme a regra que acabou de entrar (colada ou escolhida) e fixa a base das opções nela. NÃO mexe na regra. Devolve quantas caixinhas marcou.
function _cbMarcarConformeRegra() {
    _cbBaseExterna = true;
    _cteDesmarcarOpcionais();   // caixinhas e números em branco: só fica marcado o que a regra tem
    window._cteOpcionaisBase = { blocos: _clonarBlocos(window._cteBlocos || []), extras: (window._cteExtras || []).map(e => ({ ...e })) };
    _cbDetBase = null;
    const det = _cbDetectadas();
    det.forEach((r, id) => {
        const c = _cnEl('wCteOpc_' + id); if (!c) return;
        c.checked = true;
        if (r.valor != null) { const inp = _cnEl('wCteOpcEntrada_' + id); if (inp) inp.value = r.valor; }
    });
    _cbPadraoDesmarcado = false; _cbFreteBaseTirado = false; _cbAvisoBaseDupla = !!det.dupla;
    // as caixas "Somar no …" voltam a ser "fechadas, a não ser que tenha conta marcada" (a do Total Prestação nasceu aberta por causa da opção padrão, que numa regra de fora não vale)
    _cbSomarCaixas().forEach(sub => {
        const c = sub.querySelector('input[id^="wCteBetaSomar_"]'), it = sub.querySelector('.cb-sub-itens'); if (!c || !it) return;
        c.checked = !!it.querySelector('.wCteOpcCheckbox:checked'); it.hidden = !c.checked;
        delete sub.dataset.auto; delete sub.dataset.naoAbrir;
    });
    _cbSomarSync();                   // conta marcada abre a caixa "Somar no …" dela
    _cteSincronizarEntradasOpcao();   // o número da redução aparece
    _cbAtualizarMarcadas();
    return det.size;
}
// Tira de uma lista de definições a soma de um termo (todas as vezes que ele soma). Devolve a definição como ficou, a mesma se não deu para tirar, ou null se não sobrou nada nela.
function _cbTirarTermo(b, termo) {
    const ts = _seedTermosBase({ ...b, termos: (b.termos || []).map(t => ({ ...t })) }).termos.map(t => ({ ...t }));
    let mudou = false;
    for (;;) {
        const i = _cbIndiceTermo({ termos: ts }, termo);   // só tira o que é parcela da soma (ver _cbIndiceTermo): o resto da conta não muda
        if (i === -1) break;
        ts.splice(i, 1); mudou = true;
        if (ts.length) ts[0].acao = null;
    }
    if (!mudou) return b;
    if (!ts.length) return null;
    const novo = { ...b, termos: ts };
    _recalcExprDeTermos(novo);
    return novo;
}
// Desfaz na base o que uma opção reconhecida na regra fazia (ela foi DESMARCADA)
function _cbRemoverEfeito(it, d, blocos, extras) {
    // Quando um campo sai por INTEIRO da regra: os comentários ligados a ele só descreviam o que saiu (saem junto); as linhas extras COM CÓDIGO ligadas a ele ficam, mas passam a ficar antes do próximo campo
    // que sobrou (senão, sem o campo onde se ancorar, elas pulariam para o fim da regra e rodariam fora de ordem).
    const concluir = (fora, saida) => {
        const foram = new Set([...fora].filter(dst => !saida.some(b => b.destino === dst)));
        const proximo = dst => {
            const i = blocos.findIndex(b => b.destino === dst);
            for (let k = i + 1; k < blocos.length; k++) if (saida.some(s => s.destino === blocos[k].destino)) return blocos[k].destino;
            return null;
        };
        const ex = [];
        extras.forEach(x => {
            if (x.antesDe === null || !foram.has(x.antesDe)) { ex.push(x); return; }
            if (!_semLinhasComentario(x.linha)) return;
            ex.push({ ...x, antesDe: proximo(x.antesDe) });
        });
        return { blocos: saida, extras: ex };
    };
    if (it.modo === 'somar' || it.modo === 'somarEm') {
        const saida = [], fora = new Set();
        blocos.forEach(b => {
            if (b.destino !== it.campoAlvo || (it.modo === 'somarEm' && _cbFixo(b))) { saida.push(b); return; }
            const novo = _cbTirarTermo(b, it.termoNovo.termo);
            if (novo === b && it.id === CB_ID_TOTAL_BASE && _cbUsaTermo(b, _cbTermoTotal)) { saida.push(_cbTrocarNaBase([b], _cbTermoTotal, _cbTermoFrete)[0]); return; }   // o total está DENTRO do cálculo (Inverso/Redução sobre o total): sem o total a base volta a ser em cima do frete
            if (novo) saida.push(novo); else fora.add(b.destino);   // não sobrou nenhuma parcela: a definição inteira sai
        });
        return concluir(fora, saida);
    }
    if (it.modo === 'inserirApos') {
        const nb = _cbCodigoDaOpcao(it).blocos;
        return concluir(new Set(nb.map(b => b.destino)), blocos.filter(b => !nb.some(x => _cbBlocoIgual(x, b))));
    }
    const fora = new Set(d.destinos);
    return concluir(fora, blocos.filter(b => !fora.has(b.destino)));
}
// Gancho do motor das opções (ver _cteAplicarOpcionais): recebe a base (cópia) e devolve ela já sem o que as opções reconhecidas e DESMARCADAS faziam, mais jaNaRegra = as reconhecidas e ainda marcadas,
// que o motor não aplica de novo (já estão na regra). Reconhecida e marcada com OUTRO número (redução) não entra em jaNaRegra: a própria opção troca a conta no lugar. Reconhecida e desmarcada
// não é tirada quando outra opção marcada vai trocar os mesmos campos no lugar (ex.: "Tarifa x peso (KG)" no lugar de "(Tonelada)"): sem isso a nova iria parar no fim da regra, fora de ordem.
function _cbPrepararBase(blocos, extras) {
    const det = _cbDetectadas(), jaNaRegra = new Set();
    _cbJaNaRegraAtual = jaNaRegra;   // (lido por _cbAposAplicar, na mesma rodada do motor)
    const marcada = id => { const c = _cnEl('wCteOpc_' + id); return !!(c && c.checked); };
    if (marcada(CB_ID_FRETE_BASE) && !_cbFreteBaseManual) jaNaRegra.add(CB_ID_FRETE_BASE);   // "Somar Frete Valor na Base" marcada sozinha (pela regra ou por um cálculo) só REFLETE a regra: o motor não a aplica
    if (!det.size) return { blocos, extras, jaNaRegra };
    const todas = _cnTodasOpcoes(), porId = {}; todas.forEach(it => { porId[it.id] = it; });
    // um cálculo reconhecido e marcado (Demonstrativo, Inverso, Redução...) é o dono da definição da base: tirar o frete "à parte" a estragaria
    const donoBase = todas.some(it => marcada(it.id) && det.has(it.id) && _cbSubstitui(it) && det.get(it.id).destinos.includes('baseCalculo'));
    const igual = (it, d) => !it.entrada || _cteLerEntradaOpcao(it) === d.valor;   // o número continua o da regra
    const trocados = new Set();   // campos que alguma opção marcada (e que vai ser aplicada) troca no lugar
    todas.forEach(it => {
        if (!marcada(it.id) || !_cbSubstitui(it)) return;
        const d = det.get(it.id);
        if (d && igual(it, d)) return;
        _cbCodigoDaOpcao(it).destinos.forEach(x => trocados.add(x));
    });
    det.forEach((d, id) => {
        const it = porId[id];
        // "Somar Frete Valor na Base de Cálculo" é DERIVADA (ver CB_ITEM_FRETE_BASE): desmarcada por ela mesma (por exemplo ao marcar o total prestação na base) NÃO tira o frete da regra — só tira quando a pessoa a
        // desmarcou de propósito (_cbFreteBaseTirado); marcada, vale como as outras (a regra já tem o frete na base)
        if (id === CB_ID_FRETE_BASE) {
            if (marcada(id)) { if (!d.destinos.some(x => trocados.has(x))) jaNaRegra.add(id); }
            else if (_cbFreteBaseTirado && !donoBase) ({ blocos, extras } = _cbRemoverEfeito(it, d, blocos, extras));
            return;
        }
        // O Total Prestação na base veio da regra e a pessoa marcou o Frete Valor (as duas são exclusivas): é uma TROCA — o total sai e o frete entra no lugar (tirar o total e deixar a base sem nada
        // faria o frete não ter onde entrar)
        if (id === CB_ID_TOTAL_BASE && !marcada(id) && marcada(CB_ID_FRETE_BASE)) { blocos = _cbTrocarNaBase(blocos, _cbTermoTotal, _cbTermoFrete); return; }
        // reconhecida e marcada: fica como está — salvo se outra opção marcada troca os MESMOS campos (ex.: marcou "Inverso" numa regra que tinha a redução da base): aí o que ela tinha foi trocado e ela
        // é aplicada de novo, depois, na ordem de sempre (a redução volta por cima do Inverso, como numa regra montada do zero)
        if (marcada(id)) { if (igual(it, d) && !d.destinos.some(x => trocados.has(x))) jaNaRegra.add(id); return; }
        if (_cbSubstitui(it) && d.destinos.some(x => trocados.has(x))) return;
        ({ blocos, extras } = _cbRemoverEfeito(it, d, blocos, extras));
    });
    return { blocos, extras, jaNaRegra };
}
// As caixinhas MARCADAS que vieram da regra (desmarcar uma delas tira a parte correspondente da regra)
function _cbMarcadasDaRegra() {
    return _cnTodasOpcoes().filter(it => _cbEhDaRegra(it.id) && _cnEl('wCteOpc_' + it.id) && _cnEl('wCteOpc_' + it.id).checked);
}
// Esta caixinha veio da regra colada/base? ("Somar ICMS" e "ICMS Demonstrativo" contam como a mesma parte: a caixinha pode ter trocado de uma para a outra sem a regra mudar)
function _cbEhDaRegra(id) {
    const det = _cbDetectadas(), eq = CB_EQUIVALENTE_ICMS[id];
    return det.has(id) || (!!eq && det.has(eq));
}
const _cbNomeOpcao = it => it.rotuloMarcada || CB_ROTULOS[it.id] || it.label;

// ── Frete Valor × Total Prestação na Base de Cálculo, e o espelho "Somar ICMS" ───────────────
// O cálculo padrão de ICMS marcado (Demonstrativo, Inverso, Redução) que está montando a Base de Cálculo em cima do Frete Valor — ou null
function _cbCalcDaBase() {
    return _cnTodasOpcoes().find(o => {
        const c = _cnEl('wCteOpc_' + o.id);
        if (!c || !c.checked || !_cbSubstitui(o) || !o.codigo || !_cbCodigoDaOpcao(o).destinos.includes('baseCalculo')) return false;
        return !o.entrada || _cteLerEntradaOpcao(o) !== null;   // a redução sem o número ainda não vale (o motor não a aplica)
    }) || null;
}
// Deixa as caixinhas "derivadas" de acordo com a regra montada (chamada sempre que a faixa "Marcadas" é refeita, isto é, depois de cada mudança):
//  • as escolhas de ICMS: "Somar ICMS" (passo 4) = Demonstrativo + "Somar ICMS no Total Prestação" (passo 5). Tirou o ICMS do total com "Somar ICMS" marcada → sobra o Demonstrativo (a regra é a mesma); marcou o ICMS no total
//    com o Demonstrativo marcado → vira "Somar ICMS" (também a mesma regra). Assim nunca ficam duas das três marcadas e as duas pontas combinam;
//  • "Somar Frete Valor na Base de Cálculo" = a base montada usa o Frete Valor (regra colada, regra base, cálculo padrão escolhido...). Com "Somar Total Prestação na Base" marcado ela fica desmarcada (o total já inclui o frete).
function _cbSincronizar() {
    const dem = _cnEl('wCteOpc_' + CB_ID_DEMONSTRATIVO), som = _cnEl('wCteOpc_' + CB_ID_SOMAR_ICMS), icmsTotal = _cnEl('wCteOpc_' + CB_ID_ICMS_SOMAR);
    if (dem && som && icmsTotal) {
        if (som.checked && !icmsTotal.checked) { som.checked = false; dem.checked = true; _cbAvisoTroca = '“Somar ICMS” virou “ICMS Demonstrativo”: o ICMS saiu do Total Prestação (o cálculo da base continua).'; }
        else if (dem.checked && icmsTotal.checked) { dem.checked = false; som.checked = true; _cbAvisoTroca = '“ICMS Demonstrativo” virou “Somar ICMS”: o ICMS está somado no Total Prestação.'; }
    }
    const f = _cnEl('wCteOpc_' + CB_ID_FRETE_BASE), t = _cnEl('wCteOpc_' + CB_ID_TOTAL_BASE);
    if (!f) return;
    const usa = !(t && t.checked) && _cbBaseUsaFrete(window._cteBlocos);
    if (!usa) _cbFreteBaseManual = false;                 // sem frete na base, a marcação "à mão" não vale mais
    if (usa && !f.checked) _cbFreteBaseTirado = false;   // o frete voltou à base (por um cálculo, por exemplo): a escolha de "tirar" não vale mais
    f.checked = usa;
    // conta marcada nunca fica escondida: a caixa "Somar na Base de Cálculo" abre quando o frete é marcado sozinho (como "aberta pelo sistema": fecha de volta quando o frete sai e nada mais ficou marcado nela)
    const sub = f.closest('.cb-sub-recolhivel'), cx = sub && sub.querySelector('input[id^="wCteBetaSomar_"]'), itens = sub && sub.querySelector('.cb-sub-itens');
    if (!cx || !itens) return;
    if (usa && !cx.checked) { cx.checked = true; itens.hidden = false; sub.dataset.auto = '1'; }
    else if (!usa && sub.dataset.auto === '1' && cx.checked && !itens.querySelector('.wCteOpcCheckbox:checked') && !((_cnEl('wCteBetaFiltro') || {}).value || '').trim()) { cx.checked = false; itens.hidden = true; delete sub.dataset.auto; }
}
// Troca um campo por outro na Base de Cálculo montada (ex.: total prestação → frete valor): onde ele está dentro de um cálculo (Inverso, Redução, termo composto) troca o texto; onde era uma parcela somada, a parcela passa a
// ser o outro campo (e se o outro já estava somado na mesma conta, não fica duas vezes).
function _cbTrocarNaBase(blocos, de, para) {
    const rx = new RegExp('obt\\(\\s*[\'"]' + String(de).replace(/^obt\('|'\)$/g, '') + '[\'"]\\s*\\)', 'g');
    return blocos.map(b => {
        if (b.destino !== 'baseCalculo' || _cbFixo(b) || !_cbUsaTermo(b, de)) return b;
        const sem = _seedTermosBase({ ...b, termos: (b.termos || []).map(x => ({ ...x })) });
        const ts = sem.termos.map(x => ({ ...x }));
        ts.forEach(x => { x.termo = x.termo.replace(rx, para); });
        for (let k = ts.length - 1; k > 0; k--) if (ts[k].acao === '+' && _cbMesmoTermo(ts[k].termo, para) && ts.some((y, j) => j < k && _cbMesmoTermo(y.termo, para))) ts.splice(k, 1);   // (sem repetir a parcela)
        const novo = { ...sem, termos: ts };
        _recalcExprDeTermos(novo);
        return novo;
    });
}
// Depois de aplicar todas as opções: com "Somar Total Prestação na Base de Cálculo" marcada, o Frete Valor SAI da base (o total prestação já o inclui — somar os dois contaria o frete duas vezes). Frete somado
// ("frete + …") é tirado da soma; frete dentro do cálculo (Cálculo Inverso, Redução: "frete ÷ (100 − alíq.)") é TROCADO pelo total prestação, e a parcela "+ total" que a opção acrescentou sai (já está no lugar do frete).
// Não mexe numa regra que veio de fora já com o total na base (o total estava marcado ao colar: é a regra do cliente, avisada no passo 1).
function _cbAposAplicar(blocos, extras) {
    // "Somar ICMS no Total Prestação" numa regra que NÃO calcula o Total Prestação: o motor clássico CRIARIA def("totalPrestacao", obt('valorICMS')) e o total ficaria só o ICMS, sem o frete. Aqui não cria: a opção
    // fica "sem efeito" (aviso na faixa e no Gerar), como as outras contas "Somar". (Na regra montada do zero o total criado já ganha o frete da opção padrão e fica com 2 parcelas: esse não é desfeito.)
    // (Só não desfaz quando o total da PRÓPRIA regra colada já era só o ICMS: aí é do cliente.)
    const ic = _cnEl('wCteOpc_' + CB_ID_ICMS_SOMAR), soIcms = b => b.destino === 'totalPrestacao' && (b.termos || []).length === 1 && _cbMesmoTermo(b.termos[0].termo, "obt('valorICMS')");
    if (ic && ic.checked && !(((window._cteOpcionaisBase || {}).blocos) || []).some(soIcms)) blocos = blocos.filter(b => !soIcms(b));
    const t = _cnEl('wCteOpc_' + CB_ID_TOTAL_BASE);
    if (!t || !t.checked || _cbJaNaRegraAtual.has(CB_ID_TOTAL_BASE)) return { blocos, extras };
    const novos = blocos.map(b => {
        if (b.destino !== 'baseCalculo' || _cbFixo(b)) return b;
        const sem = _seedTermosBase({ ...b, termos: (b.termos || []).map(x => ({ ...x })) });
        if (!_cbUsaTermo(sem, _cbTermoFrete)) return b;   // (a conta não usa o frete: nada a trocar)
        const tirado = _cbTirarTermo(sem, _cbTermoFrete);   // frete como parcela somada: sai
        if (tirado && tirado !== sem && !_cbUsaTermo(tirado, _cbTermoFrete)) return tirado;
        const ts = (tirado && tirado !== sem ? tirado : sem).termos.map(x => ({ ...x }));   // frete dentro do cálculo (ou dentro de um termo composto: "frete × 1,1", "Math.round(frete…)"): vira o total prestação
        ts.forEach(x => { x.termo = x.termo.replace(/obt\(\s*['"]valorFrete['"]\s*\)/g, _cbTermoTotal); });
        const iSomado = ts.findIndex((x, k) => k > 0 && x.acao === '+' && _cbMesmoTermo(x.termo, _cbTermoTotal));
        if (iSomado !== -1) ts.splice(iSomado, 1);           // o "+ total" que a opção acrescentou: já está no lugar do frete
        const novo = { ...sem, termos: ts };
        _recalcExprDeTermos(novo);
        return novo;
    });
    return { blocos: novos, extras };
}

// ── navegação entre os passos ────────────────────────────────────────────────
function _cbIrPara(n, opcoes) {
    const card = _cnEl('wizardRegraBetaCard');
    if (!card) return;
    n = Math.max(0, Math.min(CB_PASSOS.length - 1, Number(n) || 0));
    if (_cbPasso === CB_MONTAGEM && n !== CB_MONTAGEM && typeof _tourFechar === 'function') _tourFechar();   // o tutorial só vale na montagem
    _cbPasso = n; _cbVisitados.add(n);
    card.dataset.passo = String(n);
    const slide = CB_PASSOS[n].slide;   // 0 = regra base, 1 = campos, 2 = cálculo (passos 3, 4 e 5), 3 = montagem
    [0, 1, 2, 3].forEach(i => { const s = _cnEl('cbSlide' + i); if (s) s.hidden = i !== slide; });
    card.querySelectorAll('.cn-passo-btn').forEach(b => {
        const i = Number(b.dataset.passo), feito = i < n && _cbVisitados.has(i), num = b.querySelector('.cn-num');
        b.classList.toggle('atual', i === n); b.classList.toggle('feito', feito);
        if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        if (num) num.textContent = feito ? '✓' : String(i + 1);
    });
    if (n === 1) { _cbLerCamposDaMontagem(); _cbAtualizarSugestao(); }
    if (_cbEhCalculo(n)) _cbMostrarEtapa(n);
    if (n === CB_MONTAGEM) { _cteRenderBlocos(); _cteRenderPalette(); }
    _cbRodape();
    const corpo = _cnEl('wCteBetaCorpo'); if (corpo) corpo.scrollTop = 0;
    _cbAjustar();                // já na 1ª pintura o passo aparece encaixado (e de novo daqui a pouco, quando fontes/layout assentarem)
    _cbAjustarAgendado(60);
    if (!(opcoes && opcoes.semFoco)) { const t = _cnEl('cbT' + slide); if (t) t.focus({ preventScroll: true }); }
    if (n === CB_MONTAGEM) _cbTourPrimeiraVez();
}
// Passos de cálculo (3, 4 e 5): a tela é a mesma; troca o nome/numeração do passo, mostra só o painel de opções da etapa e zera o filtro. O que já foi marcado nas outras etapas continua marcado.
function _cbMostrarEtapa(n) {
    const chave = CB_PASSOS[n].etapa;
    document.querySelectorAll('#wCteBetaOpcoes .cb-etapa-opcoes').forEach(p => { p.hidden = p.dataset.etapa !== chave; });
    const t = _cnEl('cbT2'); if (t) t.textContent = CB_PASSOS[n].nome;
    const e = _cnEl('wCteBetaEtapa'); if (e) e.textContent = 'Passo ' + (n + 1) + ' de ' + _cbTotalPassos;
    const f = _cnEl('wCteBetaFiltro');
    if (f) { f.value = ''; f.placeholder = '🔎 Digite para filtrar as opções — ex.: ' + CB_ETAPAS[chave].dica; f.setAttribute('aria-label', CB_PASSOS[n].nome + ': digite para filtrar as opções'); }
    _cbSomarSync();
    _cbAtualizarMarcadas(); _cbFiltrar();
}
// Leva a um passo de cálculo — é onde ficam as opções, a caixa da IA e o rodapé com o "Gerar Regra". Com n (passo de cálculo) vai até ele; sem n fica no atual se já for de cálculo, senão vai ao 1º (Cálculo do Frete Valor).
function _cbIrParaCalculo(n) {
    if (Number.isInteger(n) && _cbEhCalculo(n)) { if (_cbPasso !== n) _cbIrPara(n, { semFoco: true }); return; }
    if (!_cbEhCalculo(_cbPasso)) _cbIrPara(CB_PRIMEIRO_CALCULO, { semFoco: true });
}
// Passo (de cálculo) onde está a caixinha de uma opção — ou null se ela não aparece neste assistente
function _cbPassoDaOpcao(id) {
    const c = _cnEl('wCteOpc_' + id), p = c && c.closest('.cb-etapa-opcoes');
    const i = p ? CB_PASSOS.findIndex(x => x.etapa === p.dataset.etapa) : -1;
    return i === -1 ? null : i;
}
// Passo 1: o Avançar só libera com UMA das três: regra colada, regra base escolhida ou "Para montar do zero clique em avançar" marcado.
function _cbBaseOk() {
    const col = _cnEl('wCteColarRegra'), zero = _cnEl('wCteBetaZero');
    return !!((col && col.value.trim()) || document.querySelector('#wizardRegraBetaCard .cn-pre.sel') || (zero && zero.checked));
}
// Tentou avançar do passo 1 sem escolher nada: pisca a caixa "do zero", põe o foco nela e explica. true = bloqueou.
function _cbBloqueiaBase() {
    if (_cbBaseOk()) return false;
    const z = _cnEl('wCteBetaZero'), rot = _cnEl('wCteBetaZeroRot');
    if (rot) { rot.classList.remove('chama'); void rot.offsetWidth; rot.classList.add('chama'); }   // reinicia a animação de destaque a cada tentativa
    if (z) z.focus();
    _cbMsg('Para avançar, cole a regra do cliente, escolha uma regra base ou marque “Para montar do zero clique em avançar”.', 'aviso');
    return true;
}
// Libera/trava o botão Avançar do passo 1 conforme as escolhas (sem refazer o rodapé).
function _cbAtualizarAvancar() {
    const ok = _cbBaseOk(), b = _cnEl('wCteBetaBtnAvancar');
    const rot = _cnEl('wCteBetaZeroRot'); if (rot) rot.classList.remove('chama');   // tira o destaque (com "reduzir movimento" ele é estático e ficaria preso)
    if (b) {
        b.classList.toggle('bloq', !ok);
        b.setAttribute('aria-disabled', ok ? 'false' : 'true');
        b.title = ok ? '' : 'Cole a regra, escolha uma regra base ou marque “Para montar do zero clique em avançar” para liberar este botão';
    }
    if (ok) _cbMsg('');
}
// Marcar "do zero" descarta a regra colada, a regra base e as opções marcadas (a montagem fica vazia); desmarcar só trava o Avançar de novo se nada mais foi escolhido.
function _cbZeroMudou(marcado) {
    if (marcado) { _cbBaseExterna = false; _cbFreteBaseTirado = false; _cbFreteBaseManual = false; _cbAvisoBaseDupla = false; _cteLimparCanvas(); _cbMarcarPronta(null); _cbResumoColar(); _cbAtualizarMarcadas(); _cbMarcarPadrao(); }   // do zero: o Total Prestação começa pelo Frete Valor
    _cbAtualizarAvancar();
}
// Colou texto ou escolheu uma regra base: então "do zero" não vale mais
function _cbDesmarcarZero() { const z = _cnEl('wCteBetaZero'); if (z) z.checked = false; }
// Para ir adiante a pessoa resolve antes o que ficou pendente: no passo 1, escolher como começar; no 2, "Sim" sem nenhum nome; e, para entrar na montagem manual (passo 6, pelo botão e também
// pela trilha do topo, para ninguém pular a leitura), marcar "Desejo fazer a montagem manual da regra" e preencher o número de uma opção que o pede. Voltar é sempre livre.
function _cbIrPassoClicado(i) {
    if (i > _cbPasso) {
        if (_cbPasso === 0 && _cbBloqueiaBase()) return;
        if (_cbPasso === 1 && !_cbValidarCampos()) return;
        if (i === CB_MONTAGEM && _cbBloqueiaManual()) return;
        if (i === CB_MONTAGEM && _cbBloqueiaOpcaoIncompleta()) return;
    }
    _cbIrPara(i);
}
// Tentou entrar na montagem manual sem marcar "Desejo fazer a montagem manual da regra": leva a um passo de cálculo (se veio de outro), põe o cursor na caixa, pisca e explica. true = bloqueou.
function _cbBloqueiaManual() {
    if (_cbManualOk) return false;
    _cbIrParaCalculo();
    const c = _cnEl('wCteBetaManualOk');
    if (c) {
        c.focus();
        const rot = c.closest('.cn-manual-chk');
        if (rot) { rot.classList.remove('chama'); void rot.offsetWidth; rot.classList.add('chama'); }   // reinicia a animação de destaque a cada tentativa
    }
    _cbMsg('Para ir para a montagem manual, marque primeiro a opção “Desejo fazer a montagem manual da regra”.', 'aviso');
    return true;
}
// Marcar/desmarcar a caixa libera/trava o botão (sem refazer o rodapé, para o foco ficar na caixa).
function _cbManualMudou(marcado) {
    _cbManualOk = !!marcado;
    const rot = document.querySelector('#wCteBetaRodape .cn-manual-chk'); if (rot) rot.classList.remove('chama');   // tira o destaque (com "reduzir movimento" ele é estático e ficaria preso)
    const b = _cnEl('wCteBetaBtnManual');
    if (b) {
        b.classList.toggle('bloq', !_cbManualOk);
        b.setAttribute('aria-disabled', _cbManualOk ? 'false' : 'true');
        b.title = _cbManualOk ? '' : 'Marque a opção acima para liberar este botão';
    }
    _cbMsg('');
}
function _cbProximo() { _cbIrPassoClicado(_cbPasso + 1); }
function _cbVoltar() { _cbIrPara(_cbPasso - 1); }
// Mensagem curta acima dos botões (erro / aviso). Some sozinha ao trocar de tela.
function _cbMsg(texto, tipo) {
    const el = _cnEl('wCteBetaMsg'); if (!el) return;
    el.textContent = texto || '';
    el.className = 'cn-msg' + (tipo ? ' ' + tipo : '');
}
// Rodapé fixo com os botões de cada passo. Na montagem (passo 6) ele some para dar a altura toda à área de arrastar: lá o "Voltar" fica no topo da tela.
function _cbRodape() {
    const r = _cnEl('wCteBetaRodape'); if (!r) return;
    const n = _cbPasso;
    r.hidden = n === CB_MONTAGEM;
    if (n === CB_MONTAGEM) { r.innerHTML = ''; _cbAtualizarAvisoIA(); return; }
    const botao = (cls, acao, texto, dica) => `<button type="button" class="cn-btn ${cls}" onclick="${acao}"${dica ? ` title="${esc(dica)}"` : ''}>${texto}</button>`;
    const esq = n > 0 ? botao('sec', '_cbVoltar()', '◀ Voltar') : '<span></span>';
    let dir = '';
    if (n === 0) {
        // Passo 1: o Avançar começa travado e cinza e só libera com uma das três escolhas (aria-disabled, e não "disabled": clicar no botão travado explica o que falta)
        const ok = _cbBaseOk();
        dir = `<button type="button" id="wCteBetaBtnAvancar" class="cn-btn pri${ok ? '' : ' bloq'}" aria-disabled="${ok ? 'false' : 'true'}" onclick="_cbProximo()"${ok ? '' : ' title="Cole a regra, escolha uma regra base ou marque “Para montar do zero clique em avançar” para liberar este botão"'}>Avançar ▶</button>`;
    } else if (n === 1) dir = botao('pri', '_cbProximo()', 'Avançar ▶');
    else {
        // Passos de cálculo: "Avançar para montagem manual" (sem seta) vem ANTES do "Gerar Regra" e começa travado e cinza; a caixa de cima o libera. Fica com aria-disabled (e não
        // "disabled") de propósito: clicar no botão travado explica o que falta em vez de não fazer nada. O "Próximo: …" leva ao cálculo seguinte (o último passo de cálculo não tem).
        const ok = _cbManualOk, prox = CB_PASSOS[n + 1];
        const manual = `<div class="cn-manual">
            <label class="cn-manual-chk"><input type="checkbox" id="wCteBetaManualOk"${ok ? ' checked' : ''} onchange="_cbManualMudou(this.checked)"><span>Desejo fazer a montagem manual da regra</span></label>
            <button type="button" id="wCteBetaBtnManual" class="cn-btn pri${ok ? '' : ' bloq'}" aria-disabled="${ok ? 'false' : 'true'}" onclick="_cbIrPassoClicado(${CB_MONTAGEM})"${ok ? '' : ' title="Marque a opção acima para liberar este botão"'}>Avançar para montagem manual</button>
        </div>`;
        const proximo = prox && prox.etapa ? botao('pri', '_cbProximo()', 'Próximo: ' + esc(prox.nome) + ' ▶', 'Vai para o passo ' + (n + 2) + ' — o que você marcou aqui continua marcado') : '';
        dir = manual + proximo + botao('ok', '_cbGerar()', '✨ Gerar Regra', 'Gera a regra agora, com o que você marcou (em qualquer passo) e/ou escreveu para a IA');
    }
    r.innerHTML = `<div class="cn-msg" id="wCteBetaMsg" role="status" aria-live="polite"></div><div class="cn-rodape-btns">${esq}<div class="cn-rodape-dir">${dir}</div></div>`;
}
// Passo 6: quem escreveu instruções para a IA nos passos de cálculo e mesmo assim veio para a montagem manual precisa saber que elas NÃO entram no "Gerar Regra Montada":
// o aviso explica e oferece o botão que usa a montagem + as instruções (o mesmo caminho do "Gerar Regra" dos passos de cálculo).
function _cbAtualizarAvisoIA() {
    const el = _cnEl('wCteBetaAvisoIA'); if (!el) return;
    if (!_cnTemInstrucoes()) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<span>✨ <b>Você escreveu instruções para a IA nos passos de cálculo (3 a 5).</b> Elas só entram na regra se você usar o botão ao lado. Se continuar montando à mão e clicar em <b>Gerar Regra Montada</b>, elas não serão usadas.</span><button type="button" class="cn-btn ia peq" onclick="_cbGerar()" title="Usa a regra montada aqui + o texto que você escreveu para a IA nos passos de cálculo">✨ Gerar com a IA (usar minhas instruções)</button>`;
}

// ── passo 1: regra base ──────────────────────────────────────────────────────
function _cbColarInput() {
    _cbBaseExterna = false; _cbDetBase = null; _cbFreteBaseTirado = false; _cbFreteBaseManual = false; _cbAvisoBaseDupla = false;   // a leitura da regra ANTERIOR não vale mais para o que vai ser montado agora (senão o motor das opções tiraria da regra nova as somas que a caixinha ainda não marcou)
    _cteColarRegraInput();   // lê o texto e já monta na área de montagem (zera as opções marcadas)
    _cbMarcarPronta(null);
    let marcadas = 0;
    if (((_cnEl('wCteColarRegra') || {}).value || '').trim()) {
        _cbDesmarcarZero();                   // colou uma regra: "montar do zero" não vale mais
        marcadas = _cbMarcarConformeRegra();  // as caixinhas dos passos 3 a 5 ficam marcadas conforme o que a regra colada já tem (sem mexer nela)
    } else {
        // apagou o texto: a regra volta a ser montada do zero (a montagem foi esvaziada; as caixinhas e a base antiga das opções não podem ficar para trás)
        _cbBaseExterna = false; window._cteOpcionaisBase = null; _cbDetBase = null; _cteDesmarcarOpcionais();
        _cbMarcarPadrao();   // "Somar Frete Valor no Total Prestação" volta a ficar marcada
    }
    _cbResumoColar(marcadas);
    _cbAtualizarMarcadas();
    _cbAtualizarAvancar();
}
function _cbResumoColar(marcadas) {
    const el = _cnEl('wCteBetaResumoColar'); if (!el) return;
    const t = (_cnEl('wCteColarRegra').value || '').trim();
    if (!t) { el.textContent = ''; el.className = 'cn-resumo'; return; }
    const calculos = (window._cteBlocos || []).filter(b => b.destino && b.expr).length;
    const trechos = (window._cteExtras || []).filter(x => _semLinhasComentario(x.linha)).length;
    if (!calculos) {   // o montador guarda qualquer linha que não entende como "linha extra", então texto qualquer também vira "trecho" — mas sem nenhum cálculo não parece uma regra
        el.textContent = trechos
            ? '⚠️ Não encontrei nenhum cálculo neste texto (nada do tipo def("campo", valor)). Confira se colou a regra inteira — o que foi colado fica na montagem só como “linha extra”.'
            : '⚠️ Não consegui reconhecer nada neste texto. Confira se colou a regra inteira.';
        el.className = 'cn-resumo aviso'; return;
    }
    el.textContent = '✔ Regra lida: ' + calculos + (calculos === 1 ? ' cálculo reconhecido' : ' cálculos reconhecidos')
        + (trechos ? ' e ' + trechos + (trechos === 1 ? ' trecho mantido' : ' trechos mantidos') + ' como estão' : '') + '. Já está na montagem (passo ' + _cbTotalPassos + ').' + _cbTextoMarcadas(marcadas);
    el.className = 'cn-resumo ok';
}
// Frase final do aviso do passo 1: quantas caixinhas dos passos 3 a 5 foram marcadas por já fazerem parte da regra (e que marcar não muda a regra)
function _cbTextoMarcadas(n) {
    if (n === undefined || n === null) return '';
    const dupla = _cbAvisoBaseDupla ? ' ⚠️ Atenção: a Base de Cálculo desta regra soma o Frete Valor E o Total Prestação (o frete entra duas vezes).' : '';
    return (n ? ' Marquei nos passos 3 a 5 o que ela já tem (' + n + (n === 1 ? ' opção' : ' opções') + '): a regra segue como está.' : ' Nenhuma opção dos passos 3 a 5 foi marcada: a regra segue como está.') + dupla;
}
function _cbEscolherPronta(chave) {
    // a leitura da regra ANTERIOR (colada ou outra base) não vale mais: _cteUsarPredefinida já roda o motor das opções, que não pode tirar da regra nova as somas que a caixinha ainda não marcou
    _cbBaseExterna = false; _cbDetBase = null; _cbFreteBaseTirado = false; _cbFreteBaseManual = false; _cbAvisoBaseDupla = false;
    _cteUsarPredefinida(chave);   // preenche a área de montagem (e o campo de colar); as opções que essa base aplica já estão aplicadas na regra
    _cbDesmarcarZero();           // escolheu uma regra base: "montar do zero" não vale mais
    const r = _cnEl('wCteBetaResumoColar'); if (r) { r.textContent = ''; r.className = 'cn-resumo'; }
    const marcadas = _cbMarcarConformeRegra();   // as caixinhas ficam marcadas conforme o que a regra (já com essas opções) tem — a regra não muda
    // o campo de colar mostrava o código CRU da base (as 3 bases têm o mesmo código; a diferença — inverso, somar ICMS — está nas opções já aplicadas): passa a mostrar a regra como ela está, senão a 1ª tecla
    // digitada ali releria o texto cru e trocaria a regra (inverso viraria demonstrativo)
    const colar = _cnEl('wCteColarRegra'), atual = _cteLinhasValidas().join('\n');
    if (colar && atual) colar.value = atual;
    _cbMarcarPronta(chave, marcadas);
    _cbAtualizarAvancar();
}
function _cbMarcarPronta(chave, marcadas) {
    document.querySelectorAll('#wizardRegraBetaCard .cn-pre').forEach(b => {
        const sel = b.dataset.pre === chave;
        b.classList.toggle('sel', sel);
        b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
    const r = _cnEl('wCteBetaResumoPronta'); if (!r) return;
    if (chave) { r.textContent = '✔ Regra base carregada. Já está na montagem (passo ' + _cbTotalPassos + ').' + _cbTextoMarcadas(marcadas); r.className = 'cn-resumo ok'; }
    else { r.textContent = ''; r.className = 'cn-resumo'; }
}

// ── tela 2: campos personalizados ────────────────────────────────────────────
// A fonte da verdade é a caixa "Utiliza Valores outros (Campos Personalizados)?" da montagem (wCteOutrosValoresCheck / wCteOutrosValoresInput):
// esta tela escreve nela a cada digitação e a relê ao ser aberta (assim, o que for mudado na montagem não fica desencontrado).
const _cbRadio = () => { const r = document.querySelector('#wizardRegraBetaCard input[name="wCteBetaUsaCampos"]:checked'); return r ? r.value : 'nao'; };
// A tela tem DOIS campos de nomes: Ct-e / Contrato de Frete (Tipos Valores Outros → viram outrosValores[nome]) e Tabela de Preços (Valores Outros da tabela → viram
// tabelaPrecos.nome, sem obt). Mostra/esconde a caixa, os chips e os avisos de cada um conforme o que está escrito. Devolve o estado:
// validos/invalidos = do Ct-e / Contrato (nomes dos campos que sempre existiram), tabela/tabelaInvalidos = da Tabela de Preços.
function _cbCamposUi() {
    const sim = _cbRadio() === 'sim';
    const box = _cnEl('wCteBetaCamposBox'); if (box) box.hidden = !sim;
    const geral = _cnEl('wCteBetaCamposGeral'); if (geral) { geral.className = 'cn-aviso'; geral.textContent = ''; }
    const campo = (idInput, idChips, idAviso, classeChip) => {
        const inp = _cnEl(idInput);
        const { validos, invalidos } = _cnNomesCampos(inp ? inp.value : '');
        const chips = _cnEl(idChips);
        if (chips) chips.innerHTML = sim ? validos.map(n => `<span class="${classeChip}">${esc(n)}</span>`).join('') : '';
        const av = _cnEl(idAviso);
        if (av) {
            if (sim && invalidos.length) { av.className = 'cn-aviso erro'; av.textContent = '⚠️ Estes nomes têm espaço ou símbolo e foram ignorados: ' + invalidos.join(', ') + '. O nome interno é escrito junto, sem espaços (ex.: valorExtra).'; }
            else { av.className = 'cn-aviso'; av.textContent = ''; }
        }
        return { validos, invalidos };
    };
    const ct = campo('wCteBetaCamposInput', 'wCteBetaCamposChips', 'wCteBetaCamposAviso', 'cn-chip-campo');
    const tab = campo('wCteBetaCamposTabelaInput', 'wCteBetaCamposTabelaChips', 'wCteBetaCamposTabelaAviso', 'cn-chip-campo cn-tabela');
    return { sim, validos: ct.validos, invalidos: ct.invalidos, tabela: tab.validos, tabelaInvalidos: tab.invalidos };
}
// Faixa da montagem com os campos personalizados da Tabela de Preços (chips amarelos, arrastáveis; entram na regra como tabelaPrecos.nome, SEM obt).
function _cbRenderTabelaCustom() {
    const box = _cnEl('wCteTabCustomBox'), chips = _cnEl('wCteTabCustomChips');
    if (!box || !chips) return;
    const nomes = window._cteTabelaCustom || [];
    chips.innerHTML = nomes.map(n => _cteChip({ label: n, campo: 'tabelaPrecos.' + n }, '#fbbf24', '#fffbeb', '#92400e')).join('');
    nomes.forEach(n => { _ROTULOS_CAMPOS['tabelaPrecos.' + n] = n + ' (tabela)'; });   // nome amigável do chip depois de solto na área de montagem (o termo completo fica no title)
    box.hidden = !nomes.length;
}
function _cbEscreverCamposNaMontagem() {
    const { sim, validos, tabela } = _cbCamposUi();
    window._cteTabelaCustom = sim ? tabela : [];
    _cbRenderTabelaCustom();
    const usa = sim && validos.length > 0;
    const chk = _cnEl('wCteOutrosValoresCheck'), inp = _cnEl('wCteOutrosValoresInput');
    if (!chk || !inp) return;
    chk.checked = usa;
    inp.value = usa ? validos.join(', ') : '';
    _cteToggleOutrosValores(usa);   // mostra a caixa de nomes da montagem e refaz os chips arrastáveis
}
function _cbCamposMudou() { _cbEscreverCamposNaMontagem(); _cbAtualizarSugestao(); }
function _cbRadioMudou() {
    _cbCamposMudou();
    if (_cbRadio() === 'sim') { const i = _cnEl('wCteBetaCamposInput'); if (i) i.focus(); }
}
// Ao abrir a tela: reflete o que está na montagem. Ct-e / Contrato: a fonte é a caixa "Utiliza Valores outros" (marcada e com nomes = "Sim"; o que foi mudado lá aparece aqui).
// Tabela de Preços: não há caixa na montagem, a fonte é o próprio campo desta tela (window._cteTabelaCustom é só o reflexo dele); com nomes da tabela também vale "Sim".
function _cbLerCamposDaMontagem() {
    const chk = _cnEl('wCteOutrosValoresCheck'), inp = _cnEl('wCteOutrosValoresInput'), mine = _cnEl('wCteBetaCamposInput');
    if (!chk || !inp || !mine) return;
    const nomes = inp.value.trim();
    const simCt = chk.checked && nomes !== '';
    const simTabela = (window._cteTabelaCustom || []).length > 0;
    if (simCt) mine.value = nomes;
    const r = document.querySelector(`#wizardRegraBetaCard input[name="wCteBetaUsaCampos"][value="${simCt || simTabela ? 'sim' : 'nao'}"]`);
    if (r) r.checked = true;
    _cbCamposUi();
}
// "Sim" precisa de pelo menos um nome válido em QUALQUER dos dois campos (dá para usar só o do Ct-e ou só o da Tabela de Preços).
function _cbValidarCampos() {
    const { sim, validos, tabela } = _cbCamposUi();
    if (sim && !validos.length && !tabela.length) {
        const geral = _cnEl('wCteBetaCamposGeral');
        if (geral) { geral.className = 'cn-aviso erro'; geral.textContent = 'Escreva pelo menos um nome interno (no Ct-e / Contrato de Frete ou na Tabela de Preços), ou escolha “Não” para seguir sem campos personalizados.'; }
        const i = _cnEl('wCteBetaCamposInput'); if (i) i.focus();
        return false;
    }
    return true;
}
// Campos personalizados que aparecem na regra colada (outrosValores[nome]) e ainda não estão na lista — oferece usar.
function _cbSugeridos() {
    const txt = (_cnEl('wCteColarRegra') || {}).value || '';
    const achados = [], re = /outrosValores\[([^\]\s"']+)\]/g;
    let m;
    while ((m = re.exec(txt))) if (/^[\p{L}\p{N}_]+$/u.test(m[1]) && !achados.includes(m[1])) achados.push(m[1]);
    const ja = _cnNomesCampos((_cnEl('wCteBetaCamposInput') || {}).value).validos;
    return achados.filter(n => !ja.includes(n));
}
function _cbAtualizarSugestao() {
    const box = _cnEl('wCteBetaSugestao'); if (!box) return;
    const novos = _cbSugeridos();
    if (!novos.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<span>💡 Encontramos estes campos personalizados na regra que você colou: <b>${novos.map(esc).join(', ')}</b></span><button type="button" class="cn-btn mini" onclick="_cbUsarSugestao()">Usar estes nomes</button>`;
}
function _cbUsarSugestao() {
    const inp = _cnEl('wCteBetaCamposInput'); if (!inp) return;
    const todos = _cnNomesCampos(inp.value).validos.concat(_cbSugeridos());
    inp.value = todos.join(', ');
    const sim = document.querySelector('#wizardRegraBetaCard input[name="wCteBetaUsaCampos"][value="sim"]'); if (sim) sim.checked = true;
    _cbCamposMudou();
}

// ── passos 3, 4 e 5: cálculo do Frete Valor / do ICMS / do Total Prestação ───────────────────
// Texto de quando a pessoa tenta tirar o Frete Valor da base mas ele faz parte do cálculo de ICMS escolhido
const _cbAvisoFreteNoCalculo = calc => 'O Frete Valor faz parte do cálculo “' + _cbNomeOpcao(calc) + '” (a Base de Cálculo é calculada em cima dele). Para tirá-lo da base, desmarque esse cálculo ou marque “Somar Total Prestação na Base de Cálculo”.';
function _cbOpcaoClicada(chk) {
    const id = chk.id.replace('wCteOpc_', ''), quis = chk.checked;
    _cbAvisoTroca = '';
    _cbPreIcms(id, quis);
    if (id === CB_ID_FRETE_BASE) {
        if (!quis) {
            const calc = _cbCalcDaBase();
            if (calc) { chk.checked = true; _cbMsg(_cbAvisoFreteNoCalculo(calc), 'aviso'); return; }   // o cálculo escolhido usa o frete: não dá para tirar sem desmarcá-lo
            _cbFreteBaseTirado = true; _cbFreteBaseManual = false;   // tira o frete da base (se for uma parcela somada)
        } else { _cbFreteBaseTirado = false; _cbFreteBaseManual = true; }   // marcou à mão: só então o motor a aplica na regra
    } else if (quis) {   // marcou um cálculo que define a Base de Cálculo (Demonstrativo/Inverso/Redução): ele traz o próprio frete, então a escolha antiga de "tirar o frete" não vale mais
        const it0 = _cnTodasOpcoes().find(o => o.id === id);
        if (it0 && _cbSubstitui(it0) && it0.codigo && _cbCodigoDaOpcao(it0).destinos.includes('baseCalculo')) _cbFreteBaseTirado = false;
    }
    if (chk.id === 'wCteOpc_' + CB_ID_PADRAO) _cbNotaPadrao(!chk.checked);   // desmarcou a opção padrão de propósito: não marca de novo sozinha (marcar de novo desfaz isso)
    const daRegra = _cbEhDaRegra(id), baseTinhaFrete = id === CB_ID_TOTAL_BASE && quis && _cbBaseUsaFrete(window._cteBlocos);
    _cteOpcaoClicada(chk);   // no máximo 1 por grupo, aplica na área de montagem e leva o cursor ao campo de número (se a opção tiver)
    _cbAtualizarMarcadas();  // (também refaz as caixinhas derivadas: as 3 escolhas de ICMS e "Somar Frete Valor na Base")
    _cbMsg('');
    if (daRegra && !chk.checked) _cbAvisoTirou(id);
    if (id === CB_ID_FRETE_BASE && quis && !chk.checked) _cbMsg('“Somar Frete Valor na Base de Cálculo” precisa de uma Base de Cálculo montada: escolha antes um cálculo de ICMS (ICMS Demonstrativo ou Cálculo Inverso) — ela é marcada sozinha quando a base usa o frete.', 'aviso');
    else if (id === CB_ID_FRETE_BASE && !quis && chk.checked) _cbMsg('Não deu para tirar o Frete Valor da base: ele faz parte da conta que a regra já tem para a Base de Cálculo. Ajuste na montagem manual ou marque “Somar Total Prestação na Base de Cálculo”.', 'aviso');
    else if (baseTinhaFrete && chk.checked) {
        const loop = typeof _cnLoopsDoCodigo === 'function' && _cnLoopsDoCodigo(_cteLinhasValidas().join('\n')).length;
        _cbMsg(loop
            ? '“Somar Total Prestação na Base de Cálculo” marcada, mas isso cria um loop: a base lê o Total Prestação, o total soma o ICMS e o ICMS é calculado em cima da base. Desmarque o ICMS no Total Prestação (ou o “Somar ICMS”) ou use o Frete Valor na base.'
            : _cbBaseUsaFrete(window._cteBlocos)
                ? '“Somar Total Prestação na Base de Cálculo” marcada, mas o Frete Valor ainda aparece na conta da base: confira na montagem manual para o frete não contar duas vezes.'
                : '“Somar Total Prestação na Base de Cálculo” marcada: o Frete Valor saiu da base (o Total Prestação já o inclui — não conta duas vezes).', 'aviso');
    }
    if (chk.checked && (id === CB_ID_SOMAR_ICMS || id === CB_ID_ICMS_SOMAR || id === CB_ID_DEMONSTRATIVO || id === 'icms_inverso') && _cbTotalAntesDoIcms())
        _cbAvisoTroca = (_cbAvisoTroca ? _cbAvisoTroca + ' ' : '') + 'Atenção: nesta regra o Total Prestação (que soma o ICMS) vem ANTES do cálculo do valorICMS — na execução ele leria o ICMS ainda não calculado. Mova o cálculo do ICMS para antes do total na montagem manual.';
    _cbMostrarAvisoTroca();   // (por último: as trocas automáticas entre as 3 escolhas de ICMS e o aviso de ordem acompanham a mensagem do clique)
}
// O Total Prestação soma o valorICMS mas aparece ANTES do cálculo dele na regra (regra do cliente com o total antes do ICMS)
function _cbTotalAntesDoIcms() {
    const bl = window._cteBlocos || [];
    const iTot = bl.findIndex(b => b.destino === 'totalPrestacao' && _cbUsaTermo(b, "obt('valorICMS')")), iIcms = bl.findIndex(b => b.destino === 'valorICMS');
    return iTot !== -1 && iIcms !== -1 && iTot < iIcms;
}
// As três escolhas de ICMS (Demonstrativo / Inverso / Somar ICMS) são exclusivas. "Somar ICMS" marca (ou desmarca) junto o ICMS no Total Prestação (passo 5, e a caixa dele abre); trocar "Somar ICMS" por outro cálculo
// tira esse ICMS do total, que era dele (e avisa). Usada tanto pelo clique na caixinha quanto pelo ✕ da faixa "Marcadas".
function _cbPreIcms(id, quis) {
    const somIcms = _cnEl('wCteOpc_' + CB_ID_SOMAR_ICMS), icmsTotal = _cnEl('wCteOpc_' + CB_ID_ICMS_SOMAR);
    if (!somIcms || !icmsTotal) return;
    if (id === CB_ID_SOMAR_ICMS) { icmsTotal.checked = quis; if (quis) _cbSomarSync(); }
    else if (quis && (id === CB_ID_DEMONSTRATIVO || id === 'icms_inverso') && somIcms.checked && icmsTotal.checked) {
        icmsTotal.checked = false;
        _cbAvisoTroca = '“Somar ICMS no Total Prestação” saiu do total: o cálculo escolhido não soma o ICMS (marque-o de novo no passo 5 se precisar).';
    }
}
// Mostra o aviso de uma troca automática entre as 3 escolhas de ICMS (se houve), depois do resto da mensagem do clique
function _cbMostrarAvisoTroca() {
    if (!_cbAvisoTroca) return;
    const el = _cnEl('wCteBetaMsg'), antes = el && el.textContent ? el.textContent + ' ' : '';
    _cbMsg(antes + _cbAvisoTroca, 'aviso'); _cbAvisoTroca = '';
}
// Desmarcou uma caixinha que veio da regra: a parte dela saiu da regra — avisa, para não ser surpresa (marcar de novo recoloca)
function _cbAvisoTirou(id) {
    const it = _cnTodasOpcoes().find(o => o.id === id); if (!it) return;
    _cbMsg('Tirei da regra o que “' + _cbNomeOpcao(it) + '” fazia (ela já estava na regra)' + (_cbSubstitui(it) ? '; se havia contas “Somar …” dentro dessa conta, elas saíram junto' : '') + '. Marque de novo para recolocar.', 'aviso');
}
function _cbAtualizarMarcadas() {
    _cbSincronizar();   // caixinhas derivadas da regra montada (espelho "Somar ICMS", "Somar Frete Valor na Base de Cálculo") antes de listar (e mesmo que a faixa não exista)
    const box = _cnEl('wCteBetaMarcadas'); if (!box) return;
    const marcadas = _cnTodasOpcoes().filter(it => { const c = _cnEl('wCteOpc_' + it.id); return c && c.checked; });
    // anti-scroll: a faixa nunca some (com nada marcado mostra um aviso), para a altura da tela não pular quando a primeira opção é marcada
    if (!marcadas.length) { box.hidden = false; box.className = 'cn-marcadas vazio'; box.innerHTML = '<span class="cn-marcadas-t">Nada marcado ainda — marque abaixo o que a regra precisa.</span>'; _cbAjustarAgendado(); return; }
    box.hidden = false; box.className = 'cn-marcadas';
    _cbAjustarAgendado();   // a faixa pode passar de 1 para 2 linhas
    box.innerHTML = `<span class="cn-marcadas-t">✔ Marcadas (${marcadas.length}):</span>`
        + marcadas.map(it => {
            const falta = it.entrada && _cteLerEntradaOpcao(it) === null;
            const sem = falta ? '' : _cbMotivoSemEfeito(it);
            const nome = _cbNomeOpcao(it);
            return `<span class="cn-chip-marcada${falta || sem ? ' falta' : ''}">${esc(nome)}${falta ? ' — falta o número' : sem === 'calc' ? ' — sem efeito: a regra não calcula ' + esc(it.alvoNome || 'Total Prestação') : sem === 'soma' ? ' — sem efeito: já aparece na conta de ' + esc(it.alvoNome) + ' sem ser somado' : ''}<button type="button" class="cn-chip-x" onclick="_cbDesmarcar('${it.id}')" aria-label="Desmarcar ${esc(nome)}" title="Desmarcar">✕</button></span>`;
        }).join('')
        + `<button type="button" class="cn-link" onclick="_cbDesmarcarTodas()">Desmarcar todas</button>`;
}
function _cbDesmarcar(id) {
    const c = _cnEl('wCteOpc_' + id); if (!c) return;
    if (id === CB_ID_PADRAO) _cbNotaPadrao(true);   // tirou a opção padrão pelo ✕ da faixa "Marcadas": é de propósito
    if (id === CB_ID_FRETE_BASE) {
        const calc = _cbCalcDaBase();
        if (calc) { _cbMsg(_cbAvisoFreteNoCalculo(calc), 'aviso'); return; }   // o cálculo escolhido usa o frete: não dá para tirar sem desmarcá-lo
        _cbFreteBaseTirado = true;
    }
    const daRegra = _cbEhDaRegra(id);
    _cbAvisoTroca = '';
    c.checked = false;
    _cbPreIcms(id, false);   // ✕ em "Somar ICMS" tira também o ICMS do Total Prestação (como desmarcar a caixinha)
    _cteAplicarOpcionais();
    _cbAtualizarMarcadas();
    _cbMsg('');
    if (daRegra) _cbAvisoTirou(id);
    _cbMostrarAvisoTroca();
}
// Texto do aviso de quem ia tirar partes da regra colada: "Somar Gris no Total Prestação, Somar Pedágio no Total Prestação e outras 2"
function _cbListaNomes(opcoes) {
    const nomes = opcoes.map(_cbNomeOpcao);
    return nomes.length <= 3 ? nomes.join(', ') : nomes.slice(0, 3).join(', ') + ' e outras ' + (nomes.length - 3);
}
function _cbDesmarcarTodas() {
    // com uma regra colada / regra base, o que está marcado É a regra: desmarcar tudo tira essas partes dela — pergunta antes, para ninguém perder o que colou sem querer
    const daRegra = _cbMarcadasDaRegra();
    if (daRegra.length && !confirm('Desmarcar todas vai TIRAR da regra ' + (daRegra.length === 1 ? 'a parte que já estava nela' : 'as ' + daRegra.length + ' partes que já estavam nela') + ' (' + _cbListaNomes(daRegra) + '). Continuar?')) return;
    _cbNotaPadrao(true);   // "Desmarcar todas" é todas mesmo, inclusive a opção padrão
    _cbFreteBaseTirado = true;   // e o Frete Valor da base (se for uma parcela somada)
    _cteDesmarcarOpcionais();   // desmarca tudo e zera os campos de número
    _cteAplicarOpcionais();     // refaz a área de montagem só com a regra base (menos o que a regra colada tinha e agora está desmarcado)
    _cbAtualizarMarcadas();
}
// Filtro: cada palavra digitada precisa começar uma palavra do grupo, do nome ou das palavras-chave da opção (sem diferenciar acento nem maiúscula;
// "documentos" também acha "documento"). Por começo de palavra, "st" acha só a Substituição Tributária e "ton" acha "tonelada".
// Só esconde — quem está marcado continua marcado e valendo na regra (a faixa "Marcadas" mostra o que está marcado). Só olha as opções do passo atual (o painel da etapa que está aparecendo).
function _cbFiltrar() {
    const f = _cnEl('wCteBetaFiltro'); if (!f) return;
    const palavras = _cnPalavras(f.value).split(' ').filter(Boolean);
    const acha = (busca, p) => (' ' + busca).includes(' ' + p) || (p.length > 3 && p.endsWith('s') && (' ' + busca).includes(' ' + p.slice(0, -1)));
    // Quem pesquisa não pode achar que "não existe" só porque a conta está dentro de uma caixa "Somar no …" fechada: a caixa do passo que tem conta combinando com a busca ABRE SOZINHA (marca a caixa e já mostra
    // o resultado) e, quando a busca muda para algo que não combina mais (ou é apagada), FECHA de volta — só se ela foi aberta pela busca e nada dentro dela ficou marcado. Abrir assim não é "reabrir a caixa":
    // não traz de volta a opção padrão do Total Prestação. Se a pessoa fechar a caixa à mão enquanto a mesma busca está escrita, ela não é reaberta (até a busca mudar).
    document.querySelectorAll('#wCteBetaOpcoes .cb-sub-recolhivel').forEach(sub => {
        const chk = sub.querySelector('input[id^="wCteBetaSomar_"]'), itens = sub.querySelector('.cb-sub-itens');
        if (!chk || !itens) return;
        const combina = palavras.length > 0 && !sub.closest('.cb-etapa-opcoes[hidden]') && [...sub.querySelectorAll('.cn-opcao')].some(o => palavras.every(p => acha(o.dataset.busca || '', p)));
        if (!combina) delete sub.dataset.naoAbrir;   // "fechei à mão" só vale enquanto a busca continuar combinando com a caixa (refinar a busca, espaço ou maiúscula não a reabrem; apagar ou trocar por outra coisa libera)
        if (combina && !chk.checked && sub.dataset.naoAbrir === undefined) { chk.checked = true; itens.hidden = false; sub.dataset.auto = '1'; }
        else if (sub.dataset.auto === '1' && (!combina || !chk.checked) && !itens.querySelector('.wCteOpcCheckbox:checked')) { chk.checked = false; itens.hidden = true; delete sub.dataset.auto; }
    });
    let total = 0, visiveis = 0, escondidas = 0;   // escondidas = combinam com a busca mas estão dentro de uma caixa "Somar no …" ainda fechada
    document.querySelectorAll('#wCteBetaOpcoes .cb-etapa-opcoes:not([hidden]) .cn-grupo').forEach(g => {
        let algum = false;
        g.querySelectorAll('.cn-opcao').forEach(o => {
            const ok = palavras.every(p => acha(o.dataset.busca || '', p));
            o.hidden = !ok;
            if (ok) algum = true;
            if (o.closest('.cb-sub-itens[hidden]')) { if (ok && palavras.length) escondidas++; return; }   // as contas de uma caixa fechada não contam como "opções da tela"
            total++;
            if (ok) visiveis++;
        });
        g.hidden = !algum;
        g.querySelectorAll('.cn-sub-bloco').forEach(sb => { sb.hidden = !sb.querySelector('.cn-opcao:not([hidden])'); });   // "Demais opções": o subtítulo some junto quando nenhuma conta dele aparece
    });
    // a dica ao lado de cada caixa "Somar no …": fechada, avisa quantas contas combinam com a busca (é por ela que a pessoa vê o que a caixa guarda); aberta, só diz quantas contas há
    document.querySelectorAll('#wCteBetaOpcoes .cb-sub-recolhivel').forEach(sub => {
        const dica = sub.querySelector('.cb-sub-dica'), chk = sub.querySelector('input[id^="wCteBetaSomar_"]'), todas = sub.querySelectorAll('.cn-opcao');
        if (!dica || !chk) return;
        const acham = [...todas].filter(o => !o.hidden).length;
        if (chk.checked && sub.dataset.auto === '1' && palavras.length) { dica.textContent = 'aberta pela busca — ' + acham + (acham === 1 ? ' conta combina' : ' contas combinam'); dica.classList.add('achou'); }
        else if (chk.checked) { dica.textContent = todas.length + ' contas prontas'; dica.classList.remove('achou'); }
        else if (palavras.length && acham) { dica.textContent = acham + (acham === 1 ? ' conta combina' : ' contas combinam') + ' com a busca — marque esta caixa para ver'; dica.classList.add('achou'); }
        else { dica.textContent = 'Marque para ver as ' + todas.length + ' contas prontas'; dica.classList.remove('achou'); }
    });
    const vazio = _cnEl('wCteBetaSemResultado');
    if (vazio) {
        vazio.hidden = !(palavras.length && visiveis === 0 && escondidas === 0);
        if (!vazio.hidden) vazio.textContent = 'Nenhuma opção encontrada para “' + f.value.trim() + '”. Tente outra palavra ou explique para a IA, na caixa ao lado, o que precisa.';
    }
    const info = _cnEl('wCteBetaFiltroInfo');
    if (info) info.textContent = palavras.length && (visiveis || escondidas) ? 'Mostrando ' + visiveis + ' de ' + total + ' opções' + (escondidas ? ' (+' + escondidas + ' na caixa “Somar”)' : '') + '.' : '';
    _cbAjustarAgendado();   // o filtro pode abrir/fechar uma caixa "Somar" sem nenhum clique/tecla da pessoa (Esc, voltar de um passo...): reencaixa o passo
}
// ── caixas "Somar no <campo>" ────────────────────────────────────────────────
// Em cada passo de cálculo, as contas prontas "Somar X no <campo>" ficam atrás de uma CAIXA (id wCteBetaSomar_<campo>): só aparecem com ela marcada. Desmarcar a caixa fecha e DESMARCA as contas que
// estavam marcadas lá dentro (escondidas, continuariam valendo na regra sem a pessoa ver). Conta marcada nunca fica escondida: _cbSomarSync abre a caixa se houver alguma marcada (ex.: a opção
// padrão do Total Prestação, ou "Somar ICMS no Total Prestação" que a regra base "SOMAR ICMS" já marca).
const _cbSomarCaixas = () => [...document.querySelectorAll('#wCteBetaOpcoes .cb-sub-recolhivel')];
function _cbSomarToggle(chk) {
    const sub = chk.closest('.cb-sub-recolhivel'), itens = sub.querySelector('.cb-sub-itens');
    const eraAuto = sub.dataset.auto;
    delete sub.dataset.auto;   // a pessoa mexeu na caixa: deixou de ser "aberta pela busca" (não fecha sozinha quando a busca mudar)
    if (chk.checked) {
        delete sub.dataset.naoAbrir;
        itens.hidden = false;
        if (itens.querySelector('#wCteOpc_' + CB_ID_PADRAO)) { _cbNotaPadrao(false); _cbMarcarPadrao(); }   // reabrir o Total Prestação traz de volta a opção padrão
    } else {
        const marcadas = [...itens.querySelectorAll('.wCteOpcCheckbox:checked')];
        // "Somar Frete Valor na Base" marcada por um cálculo de ICMS (Demonstrativo/Inverso/Redução) não sai fechando a caixa: a base é calculada em cima do frete — a caixa fica aberta e a pessoa é avisada
        if (marcadas.some(c => c.id === 'wCteOpc_' + CB_ID_FRETE_BASE)) {
            const calc = _cbCalcDaBase();
            if (calc) { chk.checked = true; if (eraAuto) sub.dataset.auto = eraAuto; _cbMsg(_cbAvisoFreteNoCalculo(calc), 'aviso'); return; }   // (recusou: a caixa continua como estava)
            _cbFreteBaseTirado = true;   // fechar a caixa tira o frete da base (se for uma parcela somada), como desmarcá-lo
        }
        // fechar a caixa desmarca as contas dela; as que já faziam parte da regra colada SAIRIAM da regra: pergunta antes (quem só quer arrumar a tela não perde nada)
        const daRegra = marcadas.map(c => _cnTodasOpcoes().find(o => 'wCteOpc_' + o.id === c.id)).filter(it => it && _cbEhDaRegra(it.id));
        if (daRegra.length && !confirm('Fechar esta caixa vai TIRAR da regra ' + (daRegra.length === 1 ? 'a conta que já estava nela' : 'as ' + daRegra.length + ' contas que já estavam nela') + ' (' + _cbListaNomes(daRegra) + '). Continuar?')) { chk.checked = true; if (eraAuto) sub.dataset.auto = eraAuto; return; }
        if (marcadas.some(c => c.id === 'wCteOpc_' + CB_ID_PADRAO)) _cbNotaPadrao(true);
        marcadas.forEach(c => { c.checked = false; });
        itens.hidden = true;
        const fl = _cnEl('wCteBetaFiltro'); if (fl && fl.value.trim()) sub.dataset.naoAbrir = '1';   // fechou à mão com uma busca escrita: a busca não reabre a caixa enquanto continuar combinando com ela
        if (marcadas.length) {
            _cteAplicarOpcionais();
            _cbMsg(marcadas.length + (marcadas.length === 1 ? ' conta que estava marcada em “' : ' contas que estavam marcadas em “') + sub.querySelector('.cn-sub-titulo span').textContent + (marcadas.length === 1 ? '” foi desmarcada.' : '” foram desmarcadas.'), 'aviso');
        }
    }
    _cbAtualizarMarcadas(); _cbFiltrar(); _cbAjustarAgendado();
}
function _cbSomarSync() {
    _cbSomarCaixas().forEach(sub => {
        const chk = sub.querySelector('input[id^="wCteBetaSomar_"]'), itens = sub.querySelector('.cb-sub-itens');
        if (!chk || !itens) return;
        if (!chk.checked && itens.querySelector('.wCteOpcCheckbox:checked')) chk.checked = true;
        itens.hidden = !chk.checked;
    });
}
function _cbFiltroTecla(e) {
    // Esc com texto no filtro só limpa o filtro (sem texto, segue o comportamento normal e fecha a janela)
    if (e.key === 'Escape' && e.target.value) { e.target.value = ''; _cbFiltrar(); e.stopPropagation(); }
}
// Digitar o número de uma opção (ex.: % da redução) atualiza a faixa "Marcadas"
function _cbAoDigitar(e) {
    const t = e.target;
    if (t && typeof t.id === 'string' && t.id.indexOf('wCteOpcEntrada_') === 0) _cbAtualizarMarcadas();
    if (t && t.id === 'wCteDescricao') _cbAvisoTextoIcms();
}
// Se há uma opção marcada sem o número que ela pede: leva ao passo dela, põe o cursor no campo e explica. Devolve true quando bloqueou (quem chamou deve parar).
function _cbBloqueiaOpcaoIncompleta() {
    const falta = _cnOpcaoIncompleta();
    if (!falta) return false;
    _cbMostrarOpcao(falta.id);
    const campo = _cnEl('wCteOpcEntrada_' + falta.id);
    if (campo) { campo.scrollIntoView({ block: 'center' }); campo.focus(); }
    const e = falta.entrada || {};
    _cbMsg('Falta preencher o número de “' + falta.label + '” (de ' + e.min + ' a ' + e.max + ') para essa opção valer na regra. Digite o número ou desmarque a opção.', 'erro');
    return true;
}
// Se há uma opção "Somar X no Y" marcada que não entrou na regra (a regra montada não calcula Y): sem este aviso a regra sairia sem ela, em silêncio.
function _cbBloqueiaOpcaoSemEfeito() {
    // a opção marcada por padrão (Somar Frete Valor no Total Prestação) nunca bloqueia: a pessoa não a escolheu; se ela ficou sem efeito (ex.: o Total Prestação está dentro de um if/else da regra colada),
    // o aviso continua na faixa "Marcadas" e basta desmarcá-la se incomodar
    const it = _cnTodasOpcoes().find(o => o.id !== CB_ID_PADRAO && _cbMotivoSemEfeito(o));
    if (!it) return false;
    const motivo = _cbMotivoSemEfeito(it);
    _cbMostrarOpcao(it.id);
    const c = _cnEl('wCteOpc_' + it.id); if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); }
    _cbMsg(motivo === 'soma'
        ? 'A opção “' + it.label + '” não soma nada: ' + it.alvoNome + ' da regra já usa esse campo, mas subtraindo/multiplicando/dividindo (ou como 1º termo de uma conta que continua com subtração). Ajuste isso na montagem manual ou desmarque a opção.'
        : 'A opção “' + it.label + '” não tem onde entrar: a regra montada ainda não calcula ' + (it.alvoNome || 'Total Prestação') + '. Escolha uma regra base no passo 1 (ou monte esse campo na montagem manual) ou desmarque a opção.', 'erro');
    return true;
}
// Opção "Somar X no Y" marcada que NÃO entrou na regra: 'calc' = a regra não calcula Y (ver _cnOpcaoSemEfeito); 'soma' = X já aparece na conta de Y mas não como parcela somada (subtraindo, multiplicando...): o motor
// entende que "já tem" e não soma nada. Vazio = está tudo certo.
function _cbMotivoSemEfeito(it) {
    if (it.id === CB_ID_ICMS_SOMAR) {   // o ICMS somado no total precisa de um Total Prestação montado (não é criado só com o ICMS: ver _cbAposAplicar)
        const c = _cnEl('wCteOpc_' + it.id);
        return c && c.checked && !(window._cteBlocos || []).some(b => b.destino === 'totalPrestacao') ? 'calc' : '';
    }
    if (it.id === CB_ID_FRETE_BASE || it.id === CB_ID_TOTAL_BASE) {   // as duas da Base de Cálculo valem também "dentro do cálculo" (o Frete Valor no Inverso/Redução/"frete × 1,1", o total que troca o frete): só ficam sem efeito se não há Base de Cálculo montada
        const c = _cnEl('wCteOpc_' + it.id);
        return c && c.checked && !_cbBaseDefs(window._cteBlocos).length ? 'calc' : '';
    }
    if (_cnOpcaoSemEfeito(it)) return 'calc';
    if (it.modo !== 'somarEm') return '';
    const c = _cnEl('wCteOpc_' + it.id); if (!c || !c.checked) return '';
    const defs = (window._cteBlocos || []).filter(b => b.destino === it.campoAlvo && !_cbFixo(b));
    const soma = b => _cbIndiceTermo(_seedTermosBase({ ...b, termos: (b.termos || []).map(t => ({ ...t })) }), it.termoNovo.termo) !== -1;
    return defs.length && !defs.every(soma) ? 'soma' : '';
}
// Garante que a opção apareça na tela: vai ao passo de cálculo dela e limpa o filtro se ele a estiver escondendo
function _cbMostrarOpcao(id) {
    const n = _cbPassoDaOpcao(id); if (n !== null) _cbIrParaCalculo(n);
    const c = _cnEl('wCteOpc_' + id), op = c && c.closest('.cn-opcao');
    const itens = c && c.closest('.cb-sub-itens');   // a opção está dentro de uma caixa "Somar no …" fechada: abre a caixa
    if (itens && itens.hidden) { const chk = itens.parentElement.querySelector('input[id^="wCteBetaSomar_"]'); if (chk) chk.checked = true; itens.hidden = false; }
    if (!op || !op.closest('[hidden]')) return;
    const f = _cnEl('wCteBetaFiltro'); if (f) { f.value = ''; _cbFiltrar(); }
}
// Embaixo da caixa de texto da IA (passos de cálculo): avisa enquanto a pessoa escreve
function _cbAvisoTextoIcms() {
    const el = _cnEl('wCteBetaAvisoIcmsTexto'); if (!el) return;
    const pede = !!_cnPedeReduzirIcms((_cnEl('wCteDescricao') || {}).value);
    el.textContent = pede ? '⛔ ' + CN_ICMS_MSG : '';
    const msg = _cnEl('wCteBetaMsg');
    if (!pede && msg && msg.textContent.indexOf(CN_ICMS_MSG) === 0) _cbMsg('');   // corrigiu o texto: some também a mensagem vermelha que o "Gerar Regra" deixou no rodapé
}
// Faixa vermelha no topo (qualquer tela) enquanto a regra montada alterar o valor do ICMS — vem de regra colada, regra base editada ou da montagem manual.
function _cbAtualizarAvisoIcms(linhas) {
    const el = _cnEl('wCteBetaAvisoIcms'); if (!el) return;
    const ruins = _cnIcmsLinhasInvalidas((linhas || _cteLinhasValidas()).join('\n'));
    if (!ruins.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<span aria-hidden="true">⛔</span><span><b>A regra montada altera o valor do ICMS</b> (<code>${esc(ruins[0])}</code>${ruins.length > 1 ? ' e mais ' + (ruins.length - 1) : ''}). O ICMS tem que ser sempre <b>Base de Cálculo × Alíquota ÷ 100</b>, senão a SEFAZ rejeita o Ct-e — por isso a regra não pode ser gerada assim. Corrija na montagem manual (passo ${_cbTotalPassos}) ou, para pagar menos ICMS, reduza a Base de Cálculo (opção “Redução Base de cálculo?”, passo ${CB_PASSOS.findIndex(p => p.etapa === 'icms') + 1}).</span>`;
}
// true = BLOQUEOU (quem chamou deve parar). soCodigo: só confere a regra montada (é o caso do "Gerar Regra Montada", onde o texto da IA não entra).
function _cbBloqueiaReducaoIcms(opcoes) {
    if (!_cnEl('wizardRegraBetaCard')) return false;   // só vale no assistente em telas: o montador clássico (que usa as mesmas funções de gerar) continua como sempre foi
    if (!(opcoes && opcoes.soCodigo) && _cnTemInstrucoes() && _cnPedeReduzirIcms(_cnEl('wCteDescricao').value)) {
        _cbIrParaCalculo();   // a caixa da IA está em todos os passos de cálculo
        _cbAvisoTextoIcms();
        const t = _cnEl('wCteDescricao'); if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); }
        _cbMsg(CN_ICMS_MSG + ' Ajuste o texto da IA para continuar.', 'erro');
        return true;
    }
    if (_cnIcmsLinhasInvalidas(_cteLinhasValidas().join('\n')).length) {
        _cbAtualizarAvisoIcms();
        const el = _cnEl('wCteBetaAvisoIcms');
        if (el) { el.classList.remove('chama'); void el.offsetWidth; el.classList.add('chama'); }   // pisca a faixa (ela fica no topo, visível em qualquer tela)
        _cbMsg('A regra montada altera o valor do ICMS (veja a faixa vermelha no topo): corrija na montagem manual (passo ' + _cbTotalPassos + ') antes de gerar.', 'erro');
        return true;
    }
    return false;
}
let _cbAlertaLoopIA = '';   // aviso (HTML) de um loop que veio da IA: mostrado ao voltar para o passo de cálculo, até a pessoa fechar ou gerar de novo (o do que está montado é calculado ao vivo)

function _cbAtualizarAvisoLoop(linhas) {
    const el = _cnEl('wCteBetaAvisoLoop'); if (!el) return;
    const ciclos = _cnLoopsDoCodigo((linhas || _cteLinhasValidas()).join('\n'));
    let html = '';
    if (ciclos.length) html = _cnLoopHtml(ciclos, _cnOpcoesDoLoop(ciclos));
    else if (_cbAlertaLoopIA) html = _cbAlertaLoopIA + '<div><button type="button" class="cn-link" onclick="_cbFecharAlertaLoop()">Entendi, fechar este aviso</button></div>';
    if (!html) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<span aria-hidden="true">🔁</span><span class="cn-aviso-corpo">${html}</span>`;
}
function _cbFecharAlertaLoop() { _cbAlertaLoopIA = ''; _cbAtualizarAvisoLoop(); }
function _cbAtualizarAvisos(linhas) { _cbAtualizarAvisoIcms(linhas); _cbAtualizarAvisoLoop(linhas); _cbAjustarAgendado(); }   // (as faixas abrem/fecham e a montagem muda de altura: reencaixa o passo)   // chamado a cada vez que a área de montagem muda (ver _cteAtualizarPreview)
// Passo de cálculo da 1ª opção marcada que cria uma das dependências do loop (é por onde corrigir); null se não for por opção (regra colada, montagem manual).
function _cbPassoDoLoop(ciclos) {
    // a opção marcada por padrão (Somar Frete Valor no Total Prestação) vai por último: se o loop também envolve uma opção que a PESSOA marcou, é nela que se corrige
    const rotulos = _cnOpcoesDoLoop(ciclos).sort((a, b) => (a === CB_ITEM_SOMAR_FRETE.label) - (b === CB_ITEM_SOMAR_FRETE.label));
    for (const r of rotulos) {
        const it = _cnTodasOpcoes().find(o => o.label === r), n = it ? _cbPassoDaOpcao(it.id) : null;
        if (n !== null) return n;
    }
    return null;
}
// true = BLOQUEOU: o que está montado tem loop. Leva ao passo de cálculo da opção que o causa (ou ao atual/1º, se não for por opção), pisca o aviso e explica no rodapé.
function _cbBloqueiaLoop() {
    if (!_cnEl('wizardRegraBetaCard')) return false;
    const ciclos = _cnLoopsDoCodigo(_cteLinhasValidas().join('\n'));
    if (!ciclos.length) return false;
    const n = _cbPassoDoLoop(ciclos);
    _cbIrParaCalculo(n === null ? undefined : n);
    _cbAtualizarAvisoLoop();
    const el = _cnEl('wCteBetaAvisoLoop');
    if (el) { el.classList.remove('chama'); void el.offsetWidth; el.classList.add('chama'); el.scrollIntoView({ block: 'nearest' }); }
    _cbMsg('A regra não foi gerada: ela tem um loop (' + ciclos[0].caminho.map(_cnRotuloCampo).join(' → ') + '). Veja o aviso no topo e corrija aqui (desmarque a opção que causa o loop ou ajuste o pedido para a IA).', 'erro');
    return true;
}
function _cbBloqueiaGeracao(opcoes) { return _cbBloqueiaReducaoIcms(opcoes) || _cbBloqueiaLoop(); }
// Resposta da IA com loop (a análise é a mesma da Nova Versão): devolve { html, passo } — passo = onde corrigir (a opção que causa o loop), ou null.
function _cbLoopNaResposta(texto) {
    const r = _cnLoopNaResposta(texto); if (!r) return null;
    const t = String(texto || ''), blocos = [...t.matchAll(/```[\w]*\n?([\s\S]*?)```/g)].map(m => m[1]);
    const ciclos = _cnLoopsDoCodigo(blocos.length ? blocos.join('\n') : t);
    r.passo = ciclos.length ? _cbPassoDoLoop(ciclos) : null;
    return r;
}
// Reabre o assistente no passo de cálculo certo, com tudo como estava (a mesma volta do cartão da regra gerada), e mostra o aviso do loop.
function _cbVoltarPorLoop(loop, estado) {
    const ts = Date.now(), passo = Number.isInteger(loop.passo) ? loop.passo : CB_PRIMEIRO_CALCULO;
    window['_regraVoltar_' + ts] = { tipo: 'cte-beta', ...estado, cteBeta: { ...(estado.cteBeta || {}), passo, alertaLoop: loop.html } };
    ferrMsg('regra', 'system', '🔁 <strong>A regra gerada tinha um loop e não foi entregue.</strong> Voltei para o passo ' + (passo + 1) + ' (' + esc(CB_PASSOS[passo].nome) + ') do assistente para você corrigir (o aviso lá explica o que causou).');
    _voltarParaWizardRegra(ts);
}

// "Gerar Regra": com texto para a IA, a IA monta (usando também o que foi marcado/carregado); só com marcações/regra base, gera direto, sem IA.
function _cbGerar() {
    _cbMsg('');
    if (_cbAlertaLoopIA) { _cbAlertaLoopIA = ''; _cbAtualizarAvisoLoop(); }   // um novo "Gerar" descarta o aviso de loop que a IA deixou da vez anterior
    if (_cbBloqueiaOpcaoIncompleta()) return;
    if (_cbBloqueiaOpcaoSemEfeito()) return;
    if (_cbBloqueiaGeracao()) return;
    if (_cnTemInstrucoes()) { enviarWizardRegraDnd(); return; }
    if (_cteLinhasValidas().length) { _cteGerarRegraCustom(); return; }
    _cbMsg('Ainda não há nada para gerar: marque pelo menos uma opção, explique para a IA o que precisa ou, se prefere montar à mão, marque “Desejo fazer a montagem manual da regra” e clique em “Avançar para montagem manual”.', 'aviso');
}

// ── passo 6: montagem manual ─────────────────────────────────────────────────
// Na primeira vez que a pessoa chega na montagem abre o tutorial de sempre (só os passos que existem nesta tela), a não ser que ela já tenha pedido para não mostrar mais.
function _cbTourPrimeiraVez() {
    if (_cbTourVisto) return;
    _cbTourVisto = true;
    let visto = false;
    try { visto = !!localStorage.getItem(_TOUR_LOCALSTORAGE_KEY); } catch (e) {}
    if (visto) return;
    setTimeout(() => { if (_cbPasso === CB_MONTAGEM && _cnEl('wizardRegraBetaCard') && typeof _iniciarTourBuilder === 'function') _iniciarTourBuilder('cte'); }, 300);
}

// ── quando a IA falha ────────────────────────────────────────────────────────
// O assistente fecha assim que a IA é chamada; se ela falhar, a pessoa não pode perder o que montou: o cartão de erro traz o "Voltar" de sempre
// (o estado é o mesmo que o cartão da regra gerada guardaria — ver enviarWizardRegraDnd).
function _cbCardErroIA(estadoVoltar) {
    const s = Ferr.stream('regra'), c = document.createElement('div'), ts = Date.now();
    c.className = 'answer-card'; c.id = '_regraResultCard_' + ts;
    window['_regraVoltar_' + ts] = { tipo: 'cte-beta', ...estadoVoltar };
    c.innerHTML = `<div class="answer-section"><div class="section-content">❌ Não consegui gerar a regra agora. Clique em <b>Voltar</b> para tentar de novo — o que você montou e escreveu continua guardado.</div></div>`
        + `<div class="feedback-area"><button onclick="_voltarParaWizardRegra(${ts})" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #1e40af;border-radius:8px;background:white;color:#1e40af;cursor:pointer;font-size:13px;font-weight:600;">🔙 Voltar</button>${ferrBotaoNovoHtml('regra')}</div>`;
    s.appendChild(c);
    ferrRolar('regra', true);
}

// ── "Voltar" (do cartão da regra gerada) ─────────────────────────────────────
// Chamada por _voltarParaWizardRegra depois de reabrir o assistente e restaurar os campos / a área de montagem: realinha as telas com o estado e volta à tela em que a pessoa estava.
function _cbAposRestaurar(info) {
    // a regra veio de fora (colada / regra base)? Então as caixinhas refletem o que ela tem (ver "marcar conforme a regra"); a leitura é refeita da base restaurada
    _cbBaseExterna = !!(info && info.baseExterna); _cbDetBase = null; _cbFreteBaseTirado = !!(info && info.freteBaseTirado); _cbFreteBaseManual = !!(info && info.freteBaseManual);
    // a opção padrão já nasceu marcada ao reabrir (a regra aberta é a do zero); o "restaurar" só sabe marcar caixinhas, não desmarcar: as caixinhas voltam EXATAMENTE como estavam
    if (info && Array.isArray(info.marcadas)) {
        _cnTodasOpcoes().forEach(it => { const c = _cnEl('wCteOpc_' + it.id); if (c) c.checked = info.marcadas.includes(it.id); });
        _cteSincronizarEntradasOpcao();
    }
    // a opção padrão: se a pessoa a tinha desmarcado, ela volta desmarcada
    _cbPadraoDesmarcado = !!(info && info.padraoDesmarcado);
    if (_cbPadraoDesmarcado) { const p = _cnEl('wCteOpc_' + CB_ID_PADRAO); if (p) p.checked = false; }
    // as caixas "Somar no …" voltam abertas/fechadas como estavam (a do Total Prestação já nasceu aberta por causa da opção padrão); conta marcada mantém a sua caixa aberta
    if (info && Array.isArray(info.somarAbertos)) _cbSomarCaixas().forEach(sub => { const c = sub.querySelector('input[id^="wCteBetaSomar_"]'); if (c) c.checked = info.somarAbertos.includes(sub.dataset.somar); });
    _cbSomarSync();
    const chk = _cnEl('wCteOutrosValoresCheck');
    if (chk) _cteToggleOutrosValores(chk.checked);   // o "restaurar" só marca a caixinha: reabre a caixa de nomes e refaz os chips
    // os campos da Tabela de Preços só existem nesta tela: a lista da montagem volta do texto e do Sim/Não restaurados
    const { sim, tabela } = _cbCamposUi();
    window._cteTabelaCustom = sim ? tabela : [];
    _cbRenderTabelaCustom();
    _cbLerCamposDaMontagem();
    _cbAtualizarMarcadas();
    _cbFiltrar();
    const passo = info && Number.isInteger(info.passo) ? info.passo : CB_PRIMEIRO_CALCULO;
    for (let i = 0; i < passo; i++) _cbVisitados.add(i);
    _cbManualOk = !!(info && info.manualOk) || passo === CB_MONTAGEM;   // quem estava na montagem já tinha marcado; quem gerou de um passo de cálculo volta com a caixa como estava
    _cbTourVisto = true;   // quem voltou já viu a montagem: sem tutorial automático (tem que valer ANTES do _cbIrPara, que é quem dispara o tutorial ao chegar na montagem)
    _cbAlertaLoopIA = (info && info.alertaLoop) || '';   // a IA devolveu uma regra com loop: o aviso do que causou volta junto (ver _cbVoltarPorLoop)
    _cbAtualizarAvisoLoop();
    _cbIrPara(passo, { semFoco: true });
}

// ── ligação com o resto do sistema ───────────────────────────────────────────
// Os assistentes em telas se registram em window.CTE_ASSISTENTES; o código compartilhado (gerar com/sem IA, "Voltar", avisos ao vivo — js/app/tutorial-regras.js) pergunta
// "qual está aberto?" por _cteAssistenteAtivo() e usa estas funções, sem saber qual é qual. A Nova Versão (regra-cte-nova.js) se registra do mesmo jeito.
(window.CTE_ASSISTENTES = window.CTE_ASSISTENTES || {})['cte-beta'] = {
    tipo: 'cte-beta',
    cardId: 'wizardRegraBetaCard',
    chaveEstado: 'cteBeta',                                     // onde o estado do assistente fica guardado no "Voltar" (window['_regraVoltar_'+ts])
    prompt: CN_PROMPT_REGRA,                                    // regras extras (trava do ICMS + loop) acrescentadas ao pedido da IA
    opcoesExtras: CB_OPCOES_EXTRAS,                             // grupos de opções que só este assistente tem (o motor, _cteGruposOpcoes, os aplica no fim da lista)
    grupoApos: CB_GRUPO_APOS,                                   // opções que entram LOGO DEPOIS de uma do clássico (id dela -> lista), para o motor aplicar na ordem certa
    estadoVoltar: () => ({ cteBeta: { passo: _cbPasso, manualOk: _cbManualOk, padraoDesmarcado: _cbPadraoDesmarcado, baseExterna: _cbBaseExterna, freteBaseTirado: _cbFreteBaseTirado, freteBaseManual: _cbFreteBaseManual,
        marcadas: _cnTodasOpcoes().filter(it => { const c = _cnEl('wCteOpc_' + it.id); return c && c.checked; }).map(it => it.id),   // as caixinhas marcadas (o "restaurar" do formulário só sabe marcar, não desmarcar)
        somarAbertos: _cbSomarCaixas().filter(s => s.querySelector('input[id^="wCteBetaSomar_"]').checked && (s.dataset.auto !== '1' || s.querySelector('.wCteOpcCheckbox:checked'))).map(s => s.dataset.somar) } }),   // (caixa aberta só pela busca e sem conta marcada não conta: a busca não volta junto)   // quais caixas "Somar no …" estavam abertas
    aposAplicar: (blocos, extras) => _cbAposAplicar(blocos, extras),     // gancho do motor das opções: "Somar Total Prestação na Base" troca o frete da base pelo total
    prepararBase: (blocos, extras) => _cbPrepararBase(blocos, extras),   // gancho do motor das opções: desfaz na base o que as opções reconhecidas da regra colada e desmarcadas faziam
    // aviso extra no pedido à IA: com "Preencher manualmente" marcada o Frete Valor é digitado na tela do Ct-e, então a IA não pode criar cálculo de frete
    dicasIA: () => { const c = _cnEl('wCteOpc_' + CB_ID_FRETE_MANUAL); return c && c.checked ? '\nFRETE VALOR PREENCHIDO MANUALMENTE: o usuario escolheu preencher o Frete Valor na propria tela do Ct-e. NAO adicione nenhum calculo novo de valorFrete (nenhum def("valorFrete", ...) novo); use obt("valorFrete") nos outros calculos quando precisar.' : ''; },
    aposRestaurar: info => _cbAposRestaurar(info),
    bloqueia: o => _cbBloqueiaGeracao(o),                       // true = não gera (ICMS reduzido ou loop)
    atualizarAvisos: l => _cbAtualizarAvisos(l),
    loopNaResposta: t => _cbLoopNaResposta(t),
    voltarPorLoop: (loop, estado) => _cbVoltarPorLoop(loop, estado),
    avisoIcmsNaResposta: t => _cnAvisoIcmsNaResposta(t),
    cardErro: estado => _cbCardErroIA(estado)
};
