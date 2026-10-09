/* js/app/regra-cte-passos.js — Criar Regra › "Ct-e / Conhecimento Nova Versão": o mesmo montador de Ct-e, só que em TELAS (uma por vez, como slides). */
// ═══════════════════════════════════════════════════════════
//  Ct-e / CONHECIMENTO — NOVA VERSÃO (assistente em telas)
// ═══════════════════════════════════════════════════════════
// O montador clássico ("Ct-e / Conhecimento", js/app/tutorial-regras.js) junta tudo numa tela só e assusta quem está começando. Esta versão leva a
// pessoa pelas mesmas etapas do tutorial, uma tela de cada vez:
//   1. Regra base ............. colar a regra que o cliente já usa OU escolher uma regra pronta;
//   2. Campos personalizados .. "Irá utilizar campos personalizados?" (os nomes vão para a caixa "Utiliza Valores outros" da montagem);
//   3. O que configurar ....... todo o "Monte com um clique" com filtro + caixa para explicar à IA; botões "Gerar Regra" e "Avançar para montagem manual";
//   4. Montagem manual ........ a área de montagem de sempre (o MESMO HTML: _cteHtmlAreaMontagem()).
//
// Nada da lógica do montador foi copiado: as 4 telas existem ao mesmo tempo no DOM (só uma visível) e usam os MESMOS ids do montador clássico
// (wCteColarRegra, wCteOpc_*, wCteDescricao, wCteOutrosValoresCheck, wCteBlocosContainer...). Por isso colar / regras prontas / opções / arrastar / gerar / "Voltar"
// continuam sendo feitos pelas funções _cte* de sempre, e o estado (window._cteBlocos, _cteExtras, _cteOpcionaisBase) é um só.
// O montador clássico continua intacto; os dois dividem a mesma janela (#builderModalBody), então nunca aparecem juntos.

const CN_PASSOS = [
    { id: 'base',     nome: 'Regra base' },
    { id: 'campos',   nome: 'Campos personalizados' },
    { id: 'opcoes',   nome: 'O que configurar' },
    { id: 'montagem', nome: 'Montagem manual' }
];
// As regras prontas são as mesmas do montador clássico (REGRAS_PREDEFINIDAS_CODE, em assistente-regras.js).
const CN_REGRAS_PRONTAS = [
    { chave: 'regra_base_icms_demo',    icone: '👑', texto: 'REGRA BASE PARA: ICMS DEMONSTRATIVO, SIMPLES NACIONAL, SEM TABELA, COM TABELA' },
    { chave: 'regra_base_icms_inverso', icone: '👑', texto: 'REGRA BASE PARA: CÁLCULO INVERSO, SIMPLES NACIONAL, SEM TABELA, COM TABELA' },
    { chave: 'regra_base_icms_somar',   icone: '👑', texto: 'REGRA BASE PARA: SOMAR ICMS, SIMPLES NACIONAL, SEM TABELA, COM TABELA' },
    { chave: 'peso_cubado_gris',        icone: '📐', texto: 'Frete Calculado Peso KG ou Peso Cubado' }
];
// Palavras extras que o filtro "O que deseja configurar ou alterar?" também entende (além do título do grupo e do nome da opção, que sempre contam).
// Opção nova em CTE_OPCOES_MONTAGEM sem entrada aqui continua aparecendo e sendo filtrada pelo nome — a lista só deixa a busca mais esperta.
const CN_BUSCA = {
    frete_tonelada:     'frete peso tonelada ton tarifa 1000 minimo',
    frete_kg:           'frete peso kg quilo quilograma tarifa minimo',
    frete_valor_docs:   'frete valor documentos notas fiscais nf nfe mercadoria percentual tarifa minimo',
    icms_demonstrativo: 'icms imposto demonstrativo base calculo aliquota',
    icms_inverso:       'icms imposto inverso por dentro base calculo aliquota',
    icms_somar:         'icms imposto somar soma total prestacao acrescentar',
    icms_st:            'icms st substituicao tributaria retencao retido',
    icms_gnre:          'icms gnre guia recolhimento manual manualmente digitar difal',
    icms_reducao:       'icms reducao reduzir reduz base calculo percentual desconto diminuir',
    pedagio_peso:       'pedagio fracao peso kg tabela precos',
    pedagio_km:         'pedagio fracao km quilometro distancia tabela precos',
    pedagio_eixo:       'pedagio fracao eixo eixos tabela precos',
    seguro_frete:       'seguro percentual % tabela precos frete valor',
    seguro_prestacao:   'seguro percentual % tabela precos total prestacao',
    seguro_merc_valor:  'seguro percentual % tabela precos mercadorias notas valor',
    seguro_merc_peso:   'seguro percentual % tabela precos mercadorias peso kg',
    gris_frete:         'gris gerenciamento risco percentual % tabela precos frete valor',
    gris_prestacao:     'gris gerenciamento risco percentual % tabela precos total prestacao',
    gris_merc_valor:    'gris gerenciamento risco percentual % tabela precos mercadorias notas valor',
    gris_merc_peso:     'gris gerenciamento risco percentual % tabela precos mercadorias peso kg'
};

// ── "Demais opções": as contas prontas "Somar X no Y" ─────────────────────────
// Só esta versão desenha este grupo, no FIM da lista (o montador clássico não): uma opção (caixinha) para cada "Somar <campo> no <campo>", para quem digita no filtro
// "Somar ICMS" já ver "Somar ICMS no Frete Valor". Marcada, a opção soma o campo dentro da conta que a regra JÁ faz do campo de destino (ver _aplicarSomaEmCampo).
// Ficam de fora: somar um campo nele mesmo (ex.: Total do Serviço no Total Serviço, que dobraria o valor) e o Valor do ICMS na Base de Cálculo (é a base que gera o ICMS).
// "Somar ICMS no Total Prestação" já existia (icms_somar, grupo do ICMS): continua sendo ela — a mesma opção — só que aparece aqui, junto das outras.
const CN_TITULO_DEMAIS = '➕ Demais opções';
const CN_SOMA_FONTES = {
    valorICMS:                { curto: 'ICMS',             busca: 'icms imposto valor' },
    valoresOutros:            { curto: 'Outros',           busca: 'outros valores' },
    valorPedagioConhecimento: { curto: 'Pedágio',          busca: 'pedagio' },
    Gris:                     { curto: 'Gris',             busca: 'gris gerenciamento risco' },
    diaria:                   { curto: 'Diária',           busca: 'diaria' },
    valorSeguro:              { curto: 'Seguro',           busca: 'seguro' },
    valorSeguroAduaneiro:     { curto: 'Seg. Aduaneiro',   busca: 'seguro aduaneiro' },
    totalServico:             { curto: 'Total do Serviço', busca: 'total servico' },
    totalPrestacao:           { curto: 'Total Prestação',  busca: 'total prestacao' }
};
const CN_SOMA_ALVOS = [
    { campo: 'valorFrete',     nome: 'Frete Valor',     prep: 'no', busca: 'frete valor',     fontes: ['valorICMS', 'valoresOutros', 'valorPedagioConhecimento', 'Gris', 'diaria', 'valorSeguro', 'valorSeguroAduaneiro', 'totalServico', 'totalPrestacao'] },
    { campo: 'baseCalculo',    nome: 'Base de Cálculo', prep: 'na', busca: 'base calculo bc', fontes: ['valoresOutros', 'valorPedagioConhecimento', 'Gris', 'diaria', 'valorSeguro', 'valorSeguroAduaneiro', 'totalServico', 'totalPrestacao'] },
    { campo: 'totalServico',   nome: 'Total Serviço',   prep: 'no', busca: 'total servico',   fontes: ['valorICMS', 'valoresOutros', 'valorPedagioConhecimento', 'Gris', 'diaria', 'valorSeguro', 'valorSeguroAduaneiro', 'totalPrestacao'] },
    { campo: 'totalPrestacao', nome: 'Total Prestação', prep: 'no', busca: 'total prestacao', fontes: ['valorICMS', 'valoresOutros', 'valorPedagioConhecimento', 'Gris', 'diaria', 'valorSeguro', 'valorSeguroAduaneiro', 'totalServico'] }
];
// { ref } = opção que já existe em CTE_OPCOES_MONTAGEM (só é mostrada aqui); as demais são geradas e aplicadas por _cteAplicarOpcionais (modo:'somarEm').
const CN_SOMA_BLOCOS = CN_SOMA_ALVOS.map(a => ({
    titulo: 'Somar ' + a.prep + ' ' + a.nome,
    itens: a.fontes.map(f => (a.campo === 'totalPrestacao' && f === 'valorICMS')
        ? { ref: 'icms_somar' }
        : {
            id: 'somar_' + a.campo + '_' + f,
            label: 'Somar ' + CN_SOMA_FONTES[f].curto + ' ' + a.prep + ' ' + a.nome,
            grupoExclusivo: 'somar_' + a.campo + '_' + f,   // cada uma tem o seu: dá para marcar várias ao mesmo tempo
            modo: 'somarEm', campoAlvo: a.campo, alvoNome: a.nome, termoNovo: { termo: "obt('" + f + "')", acao: '+' },
            buscaExtra: 'somar soma adicionar incluir acrescentar ' + CN_SOMA_FONTES[f].busca + ' ' + a.busca
        })
}));
const CN_OPCOES_DEMAIS = [{ titulo: CN_TITULO_DEMAIS, itens: CN_SOMA_BLOCOS.flatMap(b => b.itens).filter(it => !it.ref) }];
const CN_MOVIDAS_PARA_DEMAIS = CN_SOMA_BLOCOS.flatMap(b => b.itens).filter(it => it.ref).map(it => it.ref);   // saem do grupo de origem (aqui) para não aparecerem duas vezes

let _cnPasso = 0;                 // tela atual (0 a 3)
let _cnVisitados = new Set([0]);  // telas já abertas (a trilha do topo mostra ✓ nas anteriores)
let _cnTourVisto = false;         // o tutorial da montagem só abre sozinho 1 vez por abertura da janela
let _cnManualOk = false;          // "Desejo fazer a montagem manual da regra" (tela 3) marcado: só então o botão "Avançar para montagem manual" é liberado — vale também para a trilha do topo

const _cnEl = id => document.getElementById(id);
const _cnNorm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
// Só palavras (letras sem acento, números e %) separadas por um espaço — base do filtro da tela 3
const _cnPalavras = s => _cnNorm(s).replace(/[^a-z0-9%]+/g, ' ').trim();

// ── HTML das telas ───────────────────────────────────────────────────────────
function _cnHtmlTopo() {
    const trilha = CN_PASSOS.map((p, i) => `<li><button type="button" class="cn-passo-btn" data-passo="${i}" onclick="_cnIrPassoClicado(${i})" title="Ir para: ${esc(p.nome)}"><span class="cn-num">${i + 1}</span><span class="cn-nome">${esc(p.nome)}</span></button></li>`).join('');
    return `<div class="cn-topo">
        <div class="cn-titulo">📄 Ct-e / Conhecimento <span class="cn-selo">Nova versão</span></div>
        <ol class="cn-passos" aria-label="Passos do assistente">${trilha}</ol>
    </div>`;
}
// Tela 1 — colar a regra do cliente OU escolher uma das prontas
function _cnHtmlBase() {
    const prontas = CN_REGRAS_PRONTAS.map(r => `<button type="button" class="cn-pre" data-pre="${r.chave}" aria-pressed="false" onclick="_cnEscolherPronta('${r.chave}')"><span class="cn-pre-ic">${r.icone}</span><span class="cn-pre-tx">${esc(r.texto)}</span><span class="cn-pre-ok" aria-hidden="true">✓</span></button>`).join('');
    return `<section class="cn-slide" id="cnSlide0" aria-labelledby="cnT0">
      <div class="cn-wrap">
        <div class="cn-etapa">Passo 1 de 4</div>
        <h2 class="cn-h2" id="cnT0" tabindex="-1">Por onde você quer começar?</h2>
        <p class="cn-sub">Cole a regra que o cliente já usa <b>ou</b> escolha uma das regras prontas como base. Se for começar do zero, é só clicar em <b>Avançar</b>.</p>
        <div class="cn-colunas">
          <div class="cn-cartao">
            <label class="cn-cartao-titulo" for="wCteColarRegra">📋 Colar a regra que o cliente já usa</label>
            <textarea id="wCteColarRegra" class="cn-codigo" placeholder="Cole aqui a regra que já existe no sistema do cliente..." spellcheck="false" oninput="_cnColarInput()"></textarea>
            <div class="cn-resumo" id="wCteNovaResumoColar" role="status"></div>
          </div>
          <div class="cn-ou" aria-hidden="true">ou</div>
          <div class="cn-cartao">
            <div class="cn-cartao-titulo" id="cnTProntas">📚 Usar uma regra pronta como base</div>
            <div class="cn-prontas" role="group" aria-labelledby="cnTProntas">${prontas}</div>
            <div class="cn-resumo" id="wCteNovaResumoPronta" role="status"></div>
          </div>
        </div>
        <div class="cn-nota">ℹ️ Trocar a regra base aqui recomeça a montagem: as opções marcadas no passo 3 são desmarcadas.</div>
      </div>
    </section>`;
}
// Tela 2 — campos personalizados
function _cnHtmlCampos() {
    return `<section class="cn-slide" id="cnSlide1" aria-labelledby="cnT1" hidden>
      <div class="cn-wrap">
        <div class="cn-etapa">Passo 2 de 4</div>
        <h2 class="cn-h2" id="cnT1" tabindex="-1">Irá utilizar campos personalizados?</h2>
        <p class="cn-sub">(São campos criados em <b>Transporte &gt; Configurações &gt; Tipos Valores Outros</b> ou <b>Transporte &gt; Tabelas de Preços &gt; Tabela de preços Valores Outros</b>)</p>
        <div class="cn-escolhas" role="radiogroup" aria-labelledby="cnT1">
          <label class="cn-escolha"><input type="radio" name="wCteNovaUsaCampos" value="nao" checked onchange="_cnRadioMudou()"><span class="cn-escolha-corpo"><b>Não</b><small>Vou usar só os campos que já existem no sistema</small></span></label>
          <label class="cn-escolha"><input type="radio" name="wCteNovaUsaCampos" value="sim" onchange="_cnRadioMudou()"><span class="cn-escolha-corpo"><b>Sim</b><small>Vou informar o nome interno dos campos</small></span></label>
        </div>
        <div class="cn-sugestao" id="wCteNovaSugestao" hidden></div>
        <div class="cn-campos-grupo" id="wCteNovaCamposBox" hidden>
          <p class="cn-campos-instr">Se sim, preencha com o nome interno dos campos abaixo, separados por vírgula. Preencha só o que for usar.</p>
          <div class="cn-aviso" id="wCteNovaCamposGeral" role="status"></div>
          <div class="cn-campos-duplo">
            <div class="cn-cartao cn-campos-box">
              <label class="cn-cartao-titulo" for="wCteNovaCamposInput">🧾 Ct-e / Contrato de Frete</label>
              <div class="cn-campos-origem">Criados em Transporte &gt; Configurações &gt; Tipos Valores Outros</div>
              <textarea id="wCteNovaCamposInput" class="cn-input" rows="3" placeholder="Ex.: advalorem, taxa1, taxa2" autocomplete="off" spellcheck="false" oninput="_cnCamposMudou()"></textarea>
              <div class="cn-aviso" id="wCteNovaCamposAviso" role="status"></div>
              <div class="cn-chips" id="wCteNovaCamposChips"></div>
            </div>
            <div class="cn-cartao cn-campos-box cn-tabela">
              <label class="cn-cartao-titulo" for="wCteNovaCamposTabelaInput">📋 Tabela de Preços</label>
              <div class="cn-campos-origem">Criados em Transporte &gt; Tabelas de Preços &gt; Tabela de preços Valores Outros</div>
              <textarea id="wCteNovaCamposTabelaInput" class="cn-input cn-tabela" rows="3" placeholder="Ex.: advalorem, taxaextra" autocomplete="off" spellcheck="false" oninput="_cnCamposMudou()"></textarea>
              <div class="cn-aviso" id="wCteNovaCamposTabelaAviso" role="status"></div>
              <div class="cn-chips" id="wCteNovaCamposTabelaChips"></div>
            </div>
          </div>
          <div class="cn-dica">Esses campos ficam prontos para arrastar na montagem (passo 4): os do <b>Ct-e / Contrato de Frete</b> dentro da caixa <b>Utiliza Valores outros (Campos Personalizados)?</b> e os da <b>Tabela de Preços</b> na faixa <b>Campos personalizados da Tabela de Preços</b>, logo abaixo dela.</div>
        </div>
      </div>
    </section>`;
}
// Tela 3 — tudo do "Monte com um clique", com filtro, mais a caixa para explicar à IA
// Uma opção (caixinha) da tela 3. busca = palavras que o filtro compara (título do grupo + nome + palavras-chave); gi = grupo "de exclusividade" das opções que não têm o seu próprio.
function _cnHtmlOpcao(item, gi, busca) {
    return `<div class="cn-opcao" data-busca="${esc(_cnPalavras(busca + ' ' + item.label + ' ' + (CN_BUSCA[item.id] || item.buscaExtra || '')))}">
            <label class="cn-opcao-rotulo"><input type="checkbox" id="wCteOpc_${item.id}" class="wCteOpcCheckbox" data-grupo="${esc(item.grupoExclusivo || gi)}" onchange="_cnOpcaoClicada(this)"><span>${esc(item.label)}</span></label>
            ${item.entrada ? _cteEntradaOpcaoHtml(item) : ''}
          </div>`;
}
// Recado fixo embaixo do título de um grupo
function _cnNotaGrupo(grupo) {
    if (/Cálculo do ICMS/.test(grupo.titulo)) return `<p class="cn-grupo-nota alerta"><span aria-hidden="true">⛔</span><span><b>O valor do ICMS não pode ser reduzido.</b> Ele tem que ser sempre <b>Base de Cálculo × Alíquota</b>: se não bater, a SEFAZ rejeita o Ct-e. Para pagar menos ICMS, reduza a <b>Base de Cálculo</b> (opção “Redução Base de cálculo?”, logo abaixo).</span></p>`;
    return '';
}
function _cnHtmlOpcoes() {
    const grupos = CTE_OPCOES_MONTAGEM.map((grupo, gi) => `<section class="cn-grupo" aria-labelledby="cnG${gi}">
          <h3 class="cn-grupo-titulo" id="cnG${gi}">${esc(grupo.titulo)}</h3>
          ${_cnNotaGrupo(grupo)}
          ${grupo.itens.filter(item => !CN_MOVIDAS_PARA_DEMAIS.includes(item.id)).map(item => _cnHtmlOpcao(item, gi, grupo.titulo)).join('')}
        </section>`).join('')
        // "Demais opções": por último, com as contas "Somar X no Y" separadas por campo de destino
        + (gd => `<section class="cn-grupo" aria-labelledby="cnG${gd}">
          <h3 class="cn-grupo-titulo" id="cnG${gd}">${esc(CN_TITULO_DEMAIS)}</h3>
          <p class="cn-grupo-nota"><span aria-hidden="true">ℹ️</span><span>Contas prontas para somar um campo em outro (ex.: “Somar ICMS no Frete Valor”). Marque quantas precisar. Cada uma entra na conta que a regra base já faz do campo de destino: escolha uma regra base no passo 1 ou monte esse campo no passo 4.</span></p>
          ${CN_SOMA_BLOCOS.map(bl => `<div class="cn-sub-bloco"><h4 class="cn-sub-titulo">${esc(bl.titulo)}</h4>${bl.itens.map(it => _cnHtmlOpcao(it.ref ? _cnTodasOpcoes().find(o => o.id === it.ref) : it, gd, CN_TITULO_DEMAIS + ' ' + bl.titulo)).join('')}</div>`).join('')}
        </section>`)(CTE_OPCOES_MONTAGEM.length);
    return `<section class="cn-slide" id="cnSlide2" aria-labelledby="cnT2" hidden>
      <div class="cn-wrap">
        <div class="cn-topo-aviso" id="wCteNovaAvisoManual"><span aria-hidden="true">💡</span><span>Se preferir montar a regra manualmente, marque a opção <b>“Desejo fazer a montagem manual da regra”</b> no rodapé e clique em <b>avançar para montagem manual</b></span></div>
        <div class="cn-etapa">Passo 3 de 4</div>
        <h2 class="cn-h2" id="cnT2" tabindex="-1">O que deseja configurar ou alterar?</h2>
        <input type="search" id="wCteNovaFiltro" class="cn-filtro" placeholder="🔎 Digite para filtrar as opções — ex.: frete, ICMS, seguro, pedágio, GNRE..." autocomplete="off" spellcheck="false" aria-label="O que deseja configurar ou alterar? Digite para filtrar as opções" oninput="_cnFiltrar()" onkeydown="_cnFiltroTecla(event)">
        <div class="cn-filtro-info" id="wCteNovaFiltroInfo" role="status" aria-live="polite"></div>
        <div class="cn-marcadas" id="wCteNovaMarcadas" hidden></div>
        <div class="cn-colunas-opcoes">
          <div>
            <div class="cn-legenda">🧱 Monte com um clique — marque o que a regra precisa</div>
            <div id="wCteNovaOpcoes">${grupos}
              <div class="cn-sem-resultado" id="wCteNovaSemResultado" hidden></div>
            </div>
          </div>
          <aside class="cn-ia" id="wCteNovaIA">
            <label class="cn-ia-titulo" for="wCteDescricao">✨ Ou se preferir, explique diretamente para a IA o que o cliente necessita, seja bem claro</label>
            <textarea id="wCteDescricao" class="cn-ia-texto" placeholder="Ex.: o cliente quer o frete calculado pelo peso em toneladas, com ICMS por dentro e seguro de 0,3% sobre o valor das notas."></textarea>
            <div class="cn-aviso erro" id="wCteNovaAvisoIcmsTexto" role="alert"></div>
            <div class="cn-dica">A IA junta o que você marcou ao lado com o que você escrever aqui.</div>
            <div class="cn-dica">⛔ Não peça para reduzir o <b>valor do ICMS</b>: a SEFAZ rejeita. Para pagar menos ICMS, peça a redução da <b>base de cálculo</b>.</div>
          </aside>
        </div>
      </div>
    </section>`;
}
// Tela 4 — a área de montagem de sempre
function _cnHtmlMontagem() {
    return `<section class="cn-slide cn-slide-montagem" id="cnSlide3" aria-labelledby="cnT3" hidden>
      <div class="cn-wrap">
        <div class="cn-montagem-topo">
          <div>
            <div class="cn-etapa">Passo 4 de 4</div>
            <h2 class="cn-h2 pequeno" id="cnT3" tabindex="-1">Montagem manual</h2>
            <p class="cn-sub">A regra já vem com o que você escolheu nos passos anteriores. Ajuste do seu jeito arrastando os campos e, no fim, clique em <b>Gerar Regra Montada</b>.</p>
          </div>
          <div class="cn-montagem-acoes">
            <button type="button" class="cn-btn sec peq" onclick="_cnVoltar()">◀ Voltar ao passo 3</button>
            <button type="button" id="wCteBtnTutorial" class="tour-btn-abrir cn-tour" onclick="_iniciarTourBuilder('cte')">🎓 Ver tutorial passo a passo</button>
          </div>
        </div>
        <div class="cn-ia-aviso" id="wCteNovaAvisoIA" hidden></div>
        ${_cteHtmlAreaMontagem()}
      </div>
    </section>`;
}

// ── abrir ────────────────────────────────────────────────────────────────────
function mostrarWizardRegraCteNova(queryOriginal) {
    _wizardRegraDndQuery = queryOriginal || '';   // (declarada em assistente-regras.js) usada por enviarWizardRegraDnd / "Voltar"
    window._cteAcaoSel = null;
    window._cteBlocos = [{ destino: '', expr: null }];
    window._cteExtras = [];
    window._cteOpcionaisBase = null;
    window._cteTabelaCustom = [];   // campos personalizados da Tabela de Preços (tela 2); o montador clássico nunca preenche isto
    _cnPasso = 0; _cnVisitados = new Set([0]); _cnTourVisto = false; _cnManualOk = false;
    const corpo = _cnEl('builderModalBody');
    corpo.innerHTML = '';
    const card = document.createElement('div');
    card.id = 'wizardRegraNovaCard';
    card.className = 'builder-card cn-card';
    card.innerHTML = _cnHtmlTopo()
        + '<div class="cn-aviso-icms" id="wCteNovaAvisoIcms" role="alert" hidden></div>'   // trava do ICMS: aparece em qualquer tela enquanto a regra montada alterar o valor do ICMS (ver _cnAtualizarAvisoIcms)
        + '<div class="cn-corpo" id="wCteNovaCorpo">' + _cnHtmlBase() + _cnHtmlCampos() + _cnHtmlOpcoes() + _cnHtmlMontagem() + '</div>'
        + '<div class="cn-rodape" id="wCteNovaRodape"></div>';
    corpo.appendChild(card);
    // Faixa dos campos personalizados da Tabela de Preços: só existe nesta versão, logo abaixo da caixa "Utiliza Valores outros" (que é dos campos do Ct-e) e só aparece
    // quando há nomes (ver _cnRenderTabelaCustom). Fica fora do HTML compartilhado (_cteHtmlAreaMontagem), então o montador clássico não muda em nada.
    const caixaRosa = _cnEl('wCteOutrosValoresWrap') && _cnEl('wCteOutrosValoresWrap').parentElement;
    if (caixaRosa) caixaRosa.insertAdjacentHTML('afterend', '<div class="cn-tab-custom" id="wCteTabCustomBox" hidden><div class="cn-tab-custom-t">📋 Campos personalizados da Tabela de Preços <span>(entram sem obt)</span></div><div class="cn-chips" id="wCteTabCustomChips"></div></div>');
    card.addEventListener('input', _cnAoDigitar);
    _cteRenderBlocos();
    _abrirBuilderModal(null);   // sem o tutorial automático: ele só faz sentido na tela da montagem (ver _cnTourPrimeiraVez)
    _cnIrPara(0);
}

// ── navegação entre as telas ─────────────────────────────────────────────────
function _cnIrPara(n, opcoes) {
    const card = _cnEl('wizardRegraNovaCard');
    if (!card) return;
    n = Math.max(0, Math.min(CN_PASSOS.length - 1, Number(n) || 0));
    if (_cnPasso === 3 && n !== 3 && typeof _tourFechar === 'function') _tourFechar();   // o tutorial só vale na montagem
    _cnPasso = n; _cnVisitados.add(n);
    card.dataset.passo = String(n);
    CN_PASSOS.forEach((p, i) => { const s = _cnEl('cnSlide' + i); if (s) s.hidden = i !== n; });
    card.querySelectorAll('.cn-passo-btn').forEach(b => {
        const i = Number(b.dataset.passo), feito = i < n && _cnVisitados.has(i), num = b.querySelector('.cn-num');
        b.classList.toggle('atual', i === n); b.classList.toggle('feito', feito);
        if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        if (num) num.textContent = feito ? '✓' : String(i + 1);
    });
    if (n === 1) { _cnLerCamposDaMontagem(); _cnAtualizarSugestao(); }
    if (n === 2) { _cnAtualizarMarcadas(); _cnFiltrar(); }
    if (n === 3) { _cteRenderBlocos(); _cteRenderPalette(); }
    _cnRodape();
    const corpo = _cnEl('wCteNovaCorpo'); if (corpo) corpo.scrollTop = 0;
    if (!(opcoes && opcoes.semFoco)) { const t = _cnEl('cnT' + n); if (t) t.focus({ preventScroll: true }); }
    if (n === 3) _cnTourPrimeiraVez();
}
// Para ir adiante a pessoa resolve antes o que ficou pendente: "Sim" sem nenhum nome (tela 2), a caixa "Desejo fazer a montagem manual da regra" desmarcada (entrada na
// montagem, tela 4 — vale pelo botão e pela trilha do topo, para ninguém pular a leitura da tela 3) e opção marcada que pede um número sem valor (tela 3). Voltar é sempre livre.
function _cnIrPassoClicado(i) {
    if (i > _cnPasso) {
        if (_cnPasso === 1 && !_cnValidarCampos()) return;
        if (i === 3 && _cnBloqueiaManual()) return;
        if (i === 3 && _cnBloqueiaOpcaoIncompleta()) return;
    }
    _cnIrPara(i);
}
// Tentou entrar na montagem manual sem marcar "Desejo fazer a montagem manual da regra": leva à tela 3 (se veio de outra), põe o cursor na caixa, pisca e explica. true = bloqueou.
function _cnBloqueiaManual() {
    if (_cnManualOk) return false;
    if (_cnPasso !== 2) _cnIrPara(2, { semFoco: true });
    const c = _cnEl('wCteNovaManualOk');
    if (c) {
        c.focus();
        const rot = c.closest('.cn-manual-chk');
        if (rot) { rot.classList.remove('chama'); void rot.offsetWidth; rot.classList.add('chama'); }   // reinicia a animação de destaque a cada tentativa
    }
    _cnMsg('Para ir para a montagem manual, marque primeiro a opção “Desejo fazer a montagem manual da regra”.', 'aviso');
    return true;
}
// Marcar/desmarcar a caixa libera/trava o botão (sem refazer o rodapé, para o foco ficar na caixa).
function _cnManualMudou(marcado) {
    _cnManualOk = !!marcado;
    const rot = document.querySelector('#wCteNovaRodape .cn-manual-chk'); if (rot) rot.classList.remove('chama');   // tira o destaque (com "reduzir movimento" ele é estático e ficaria preso)
    const b = _cnEl('wCteNovaBtnManual');
    if (b) {
        b.classList.toggle('bloq', !_cnManualOk);
        b.setAttribute('aria-disabled', _cnManualOk ? 'false' : 'true');
        b.title = _cnManualOk ? '' : 'Marque a opção acima para liberar este botão';
    }
    _cnMsg('');
}
function _cnProximo() { _cnIrPassoClicado(_cnPasso + 1); }
function _cnVoltar() { _cnIrPara(_cnPasso - 1); }
// Mensagem curta acima dos botões (erro / aviso). Some sozinha ao trocar de tela.
function _cnMsg(texto, tipo) {
    const el = _cnEl('wCteNovaMsg'); if (!el) return;
    el.textContent = texto || '';
    el.className = 'cn-msg' + (tipo ? ' ' + tipo : '');
}
// Rodapé fixo com os botões de cada tela. Na montagem (tela 4) ele some para dar a altura toda à área de arrastar: lá o "Voltar" fica no topo da tela.
function _cnRodape() {
    const r = _cnEl('wCteNovaRodape'); if (!r) return;
    const n = _cnPasso;
    r.hidden = n === 3;
    if (n === 3) { r.innerHTML = ''; _cnAtualizarAvisoIA(); return; }
    const botao = (cls, acao, texto, dica) => `<button type="button" class="cn-btn ${cls}" onclick="${acao}"${dica ? ` title="${esc(dica)}"` : ''}>${texto}</button>`;
    const esq = n > 0 ? botao('sec', '_cnVoltar()', '◀ Voltar') : '<span></span>';
    let dir = '';
    if (n < 2) dir = botao('pri', '_cnProximo()', 'Avançar ▶');
    else {
        // Tela 3: "Avançar para montagem manual" (sem seta) vem ANTES do "Gerar Regra" e começa travado e cinza; a caixa de cima o libera. Fica com aria-disabled (e não
        // "disabled") de propósito: clicar no botão travado explica o que falta em vez de não fazer nada.
        const ok = _cnManualOk;
        const manual = `<div class="cn-manual">
            <label class="cn-manual-chk"><input type="checkbox" id="wCteNovaManualOk"${ok ? ' checked' : ''} onchange="_cnManualMudou(this.checked)"><span>Desejo fazer a montagem manual da regra</span></label>
            <button type="button" id="wCteNovaBtnManual" class="cn-btn pri${ok ? '' : ' bloq'}" aria-disabled="${ok ? 'false' : 'true'}" onclick="_cnProximo()"${ok ? '' : ' title="Marque a opção acima para liberar este botão"'}>Avançar para montagem manual</button>
        </div>`;
        dir = manual + botao('ok', '_cnGerar()', '✨ Gerar Regra', 'Gera a regra agora, com o que você marcou e/ou escreveu para a IA');
    }
    r.innerHTML = `<div class="cn-msg" id="wCteNovaMsg" role="status" aria-live="polite"></div><div class="cn-rodape-btns">${esq}<div class="cn-rodape-dir">${dir}</div></div>`;
}
// Tela 4: quem escreveu instruções para a IA na tela 3 e mesmo assim veio para a montagem manual precisa saber que elas NÃO entram no "Gerar Regra Montada":
// o aviso explica e oferece o botão que usa a montagem + as instruções (o mesmo caminho do "Gerar Regra" da tela 3).
function _cnAtualizarAvisoIA() {
    const el = _cnEl('wCteNovaAvisoIA'); if (!el) return;
    if (!_cnTemInstrucoes()) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<span>✨ <b>Você escreveu instruções para a IA no passo 3.</b> Elas só entram na regra se você usar o botão ao lado. Se continuar montando à mão e clicar em <b>Gerar Regra Montada</b>, elas não serão usadas.</span><button type="button" class="cn-btn ia peq" onclick="_cnGerar()" title="Usa a regra montada aqui + o texto que você escreveu para a IA no passo 3">✨ Gerar com a IA (usar minhas instruções)</button>`;
}

// ── tela 1: regra base ───────────────────────────────────────────────────────
function _cnColarInput() {
    _cteColarRegraInput();   // lê o texto e já monta na área de montagem (zera as opções marcadas)
    _cnMarcarPronta(null);
    _cnResumoColar();
}
function _cnResumoColar() {
    const el = _cnEl('wCteNovaResumoColar'); if (!el) return;
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
        + (trechos ? ' e ' + trechos + (trechos === 1 ? ' trecho mantido' : ' trechos mantidos') + ' como estão' : '') + '. Já está na montagem (passo 4).';
    el.className = 'cn-resumo ok';
}
function _cnEscolherPronta(chave) {
    _cteUsarPredefinida(chave);   // preenche a área de montagem (e o campo de colar) e já marca as opções dessa base
    _cnMarcarPronta(chave);
    const r = _cnEl('wCteNovaResumoColar'); if (r) { r.textContent = ''; r.className = 'cn-resumo'; }
}
function _cnMarcarPronta(chave) {
    document.querySelectorAll('#wizardRegraNovaCard .cn-pre').forEach(b => {
        const sel = b.dataset.pre === chave;
        b.classList.toggle('sel', sel);
        b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
    const r = _cnEl('wCteNovaResumoPronta'); if (!r) return;
    if (chave) { r.textContent = '✔ Regra base carregada. Já está na montagem (passo 4).'; r.className = 'cn-resumo ok'; }
    else { r.textContent = ''; r.className = 'cn-resumo'; }
}

// ── tela 2: campos personalizados ────────────────────────────────────────────
// A fonte da verdade é a caixa "Utiliza Valores outros (Campos Personalizados)?" da montagem (wCteOutrosValoresCheck / wCteOutrosValoresInput):
// esta tela escreve nela a cada digitação e a relê ao ser aberta (assim, o que for mudado na montagem não fica desencontrado).
const _cnRadio = () => { const r = document.querySelector('#wizardRegraNovaCard input[name="wCteNovaUsaCampos"]:checked'); return r ? r.value : 'nao'; };
// Nome interno = letras, números e _ (sem espaço, ponto, colchete, aspas...). Aceita vírgula, ponto e vírgula ou quebra de linha como separador.
function _cnNomesCampos(texto) {
    const validos = [], invalidos = [];
    String(texto || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(n => {
        if (/^[\p{L}\p{N}_]+$/u.test(n)) { if (!validos.includes(n)) validos.push(n); }
        else if (!invalidos.includes(n)) invalidos.push(n);
    });
    return { validos, invalidos };
}
// A tela tem DOIS campos de nomes: Ct-e / Contrato de Frete (Tipos Valores Outros → viram outrosValores[nome]) e Tabela de Preços (Valores Outros da tabela → viram
// tabelaPrecos.nome, sem obt). Mostra/esconde a caixa, os chips e os avisos de cada um conforme o que está escrito. Devolve o estado:
// validos/invalidos = do Ct-e / Contrato (nomes dos campos que sempre existiram), tabela/tabelaInvalidos = da Tabela de Preços.
function _cnCamposUi() {
    const sim = _cnRadio() === 'sim';
    const box = _cnEl('wCteNovaCamposBox'); if (box) box.hidden = !sim;
    const geral = _cnEl('wCteNovaCamposGeral'); if (geral) { geral.className = 'cn-aviso'; geral.textContent = ''; }
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
    const ct = campo('wCteNovaCamposInput', 'wCteNovaCamposChips', 'wCteNovaCamposAviso', 'cn-chip-campo');
    const tab = campo('wCteNovaCamposTabelaInput', 'wCteNovaCamposTabelaChips', 'wCteNovaCamposTabelaAviso', 'cn-chip-campo cn-tabela');
    return { sim, validos: ct.validos, invalidos: ct.invalidos, tabela: tab.validos, tabelaInvalidos: tab.invalidos };
}
// Faixa da montagem com os campos personalizados da Tabela de Preços (chips amarelos, arrastáveis; entram na regra como tabelaPrecos.nome, SEM obt).
function _cnRenderTabelaCustom() {
    const box = _cnEl('wCteTabCustomBox'), chips = _cnEl('wCteTabCustomChips');
    if (!box || !chips) return;
    const nomes = window._cteTabelaCustom || [];
    chips.innerHTML = nomes.map(n => _cteChip({ label: n, campo: 'tabelaPrecos.' + n }, '#fbbf24', '#fffbeb', '#92400e')).join('');
    nomes.forEach(n => { _ROTULOS_CAMPOS['tabelaPrecos.' + n] = n + ' (tabela)'; });   // nome amigável do chip depois de solto na área de montagem (o termo completo fica no title)
    box.hidden = !nomes.length;
}
function _cnEscreverCamposNaMontagem() {
    const { sim, validos, tabela } = _cnCamposUi();
    window._cteTabelaCustom = sim ? tabela : [];
    _cnRenderTabelaCustom();
    const usa = sim && validos.length > 0;
    const chk = _cnEl('wCteOutrosValoresCheck'), inp = _cnEl('wCteOutrosValoresInput');
    if (!chk || !inp) return;
    chk.checked = usa;
    inp.value = usa ? validos.join(', ') : '';
    _cteToggleOutrosValores(usa);   // mostra a caixa de nomes da montagem e refaz os chips arrastáveis
}
function _cnCamposMudou() { _cnEscreverCamposNaMontagem(); _cnAtualizarSugestao(); }
function _cnRadioMudou() {
    _cnCamposMudou();
    if (_cnRadio() === 'sim') { const i = _cnEl('wCteNovaCamposInput'); if (i) i.focus(); }
}
// Ao abrir a tela: reflete o que está na montagem. Ct-e / Contrato: a fonte é a caixa "Utiliza Valores outros" (marcada e com nomes = "Sim"; o que foi mudado lá aparece aqui).
// Tabela de Preços: não há caixa na montagem, a fonte é o próprio campo desta tela (window._cteTabelaCustom é só o reflexo dele); com nomes da tabela também vale "Sim".
function _cnLerCamposDaMontagem() {
    const chk = _cnEl('wCteOutrosValoresCheck'), inp = _cnEl('wCteOutrosValoresInput'), mine = _cnEl('wCteNovaCamposInput');
    if (!chk || !inp || !mine) return;
    const nomes = inp.value.trim();
    const simCt = chk.checked && nomes !== '';
    const simTabela = (window._cteTabelaCustom || []).length > 0;
    if (simCt) mine.value = nomes;
    const r = document.querySelector(`#wizardRegraNovaCard input[name="wCteNovaUsaCampos"][value="${simCt || simTabela ? 'sim' : 'nao'}"]`);
    if (r) r.checked = true;
    _cnCamposUi();
}
// "Sim" precisa de pelo menos um nome válido em QUALQUER dos dois campos (dá para usar só o do Ct-e ou só o da Tabela de Preços).
function _cnValidarCampos() {
    const { sim, validos, tabela } = _cnCamposUi();
    if (sim && !validos.length && !tabela.length) {
        const geral = _cnEl('wCteNovaCamposGeral');
        if (geral) { geral.className = 'cn-aviso erro'; geral.textContent = 'Escreva pelo menos um nome interno (no Ct-e / Contrato de Frete ou na Tabela de Preços), ou escolha “Não” para seguir sem campos personalizados.'; }
        const i = _cnEl('wCteNovaCamposInput'); if (i) i.focus();
        return false;
    }
    return true;
}
// Campos personalizados que aparecem na regra colada (outrosValores[nome]) e ainda não estão na lista — oferece usar.
function _cnSugeridos() {
    const txt = (_cnEl('wCteColarRegra') || {}).value || '';
    const achados = [], re = /outrosValores\[([^\]\s"']+)\]/g;
    let m;
    while ((m = re.exec(txt))) if (/^[\p{L}\p{N}_]+$/u.test(m[1]) && !achados.includes(m[1])) achados.push(m[1]);
    const ja = _cnNomesCampos((_cnEl('wCteNovaCamposInput') || {}).value).validos;
    return achados.filter(n => !ja.includes(n));
}
function _cnAtualizarSugestao() {
    const box = _cnEl('wCteNovaSugestao'); if (!box) return;
    const novos = _cnSugeridos();
    if (!novos.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<span>💡 Encontramos estes campos personalizados na regra que você colou: <b>${novos.map(esc).join(', ')}</b></span><button type="button" class="cn-btn mini" onclick="_cnUsarSugestao()">Usar estes nomes</button>`;
}
function _cnUsarSugestao() {
    const inp = _cnEl('wCteNovaCamposInput'); if (!inp) return;
    const todos = _cnNomesCampos(inp.value).validos.concat(_cnSugeridos());
    inp.value = todos.join(', ');
    const sim = document.querySelector('#wizardRegraNovaCard input[name="wCteNovaUsaCampos"][value="sim"]'); if (sim) sim.checked = true;
    _cnCamposMudou();
}

// ── tela 3: o que configurar ─────────────────────────────────────────────────
function _cnOpcaoClicada(chk) {
    _cteOpcaoClicada(chk);   // no máximo 1 por grupo, aplica na área de montagem e leva o cursor ao campo de número (se a opção tiver)
    _cnAtualizarMarcadas();
    _cnMsg('');
}
function _cnTodasOpcoes() { return _cteGruposOpcoes().flatMap(g => g.itens); }
// Opção "Somar X no Y" marcada que não entrou em lugar nenhum porque a regra montada não calcula o campo Y (ver _aplicarSomaEmCampo): o termo não está em nenhuma definição dele.
function _cnOpcaoSemEfeito(it) {
    if (it.modo !== 'somarEm') return false;
    const c = _cnEl('wCteOpc_' + it.id); if (!c || !c.checked) return false;
    return !(window._cteBlocos || []).some(b => b.destino === it.campoAlvo && (b.termos || []).some(t => t.termo === it.termoNovo.termo));
}
function _cnAtualizarMarcadas() {
    const box = _cnEl('wCteNovaMarcadas'); if (!box) return;
    const marcadas = _cnTodasOpcoes().filter(it => { const c = _cnEl('wCteOpc_' + it.id); return c && c.checked; });
    if (!marcadas.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<span class="cn-marcadas-t">✔ Marcadas (${marcadas.length}):</span>`
        + marcadas.map(it => {
            const falta = it.entrada && _cteLerEntradaOpcao(it) === null;
            const sem = !falta && _cnOpcaoSemEfeito(it);
            return `<span class="cn-chip-marcada${falta || sem ? ' falta' : ''}">${esc(it.label)}${falta ? ' — falta o número' : sem ? ' — sem efeito: a regra não calcula ' + esc(it.alvoNome) : ''}<button type="button" class="cn-chip-x" onclick="_cnDesmarcar('${it.id}')" aria-label="Desmarcar ${esc(it.label)}" title="Desmarcar">✕</button></span>`;
        }).join('')
        + `<button type="button" class="cn-link" onclick="_cnDesmarcarTodas()">Desmarcar todas</button>`;
}
function _cnDesmarcar(id) {
    const c = _cnEl('wCteOpc_' + id); if (!c) return;
    c.checked = false;
    _cteAplicarOpcionais();
    _cnAtualizarMarcadas();
}
function _cnDesmarcarTodas() {
    _cteDesmarcarOpcionais();   // desmarca tudo e zera os campos de número
    _cteAplicarOpcionais();     // refaz a área de montagem só com a regra base
    _cnAtualizarMarcadas();
}
// Filtro: cada palavra digitada precisa começar uma palavra do grupo, do nome ou das palavras-chave da opção (sem diferenciar acento nem maiúscula;
// "documentos" também acha "documento"). Por começo de palavra, "st" acha só a Substituição Tributária e "ton" acha "tonelada".
// Só esconde — quem está marcado continua marcado e valendo na regra (a faixa "Marcadas" mostra o que está marcado).
function _cnFiltrar() {
    const f = _cnEl('wCteNovaFiltro'); if (!f) return;
    const palavras = _cnPalavras(f.value).split(' ').filter(Boolean);
    const acha = (busca, p) => (' ' + busca).includes(' ' + p) || (p.length > 3 && p.endsWith('s') && (' ' + busca).includes(' ' + p.slice(0, -1)));
    let total = 0, visiveis = 0;
    document.querySelectorAll('#wCteNovaOpcoes .cn-grupo').forEach(g => {
        let algum = false;
        g.querySelectorAll('.cn-opcao').forEach(o => {
            total++;
            const ok = palavras.every(p => acha(o.dataset.busca || '', p));
            o.hidden = !ok;
            if (ok) { algum = true; visiveis++; }
        });
        g.hidden = !algum;
        g.querySelectorAll('.cn-sub-bloco').forEach(sb => { sb.hidden = !sb.querySelector('.cn-opcao:not([hidden])'); });   // "Demais opções": o subtítulo some junto quando nenhuma conta dele aparece
    });
    const vazio = _cnEl('wCteNovaSemResultado');
    if (vazio) {
        vazio.hidden = !(palavras.length && visiveis === 0);
        if (!vazio.hidden) vazio.textContent = 'Nenhuma opção encontrada para “' + f.value.trim() + '”. Tente outra palavra ou explique para a IA, na caixa ao lado, o que precisa.';
    }
    const info = _cnEl('wCteNovaFiltroInfo');
    if (info) info.textContent = palavras.length && visiveis ? 'Mostrando ' + visiveis + ' de ' + total + ' opções.' : '';
}
function _cnFiltroTecla(e) {
    // Esc com texto no filtro só limpa o filtro (sem texto, segue o comportamento normal e fecha a janela)
    if (e.key === 'Escape' && e.target.value) { e.target.value = ''; _cnFiltrar(); e.stopPropagation(); }
}
// Digitar o número de uma opção (ex.: % da redução) atualiza a faixa "Marcadas"
function _cnAoDigitar(e) {
    const t = e.target;
    if (t && typeof t.id === 'string' && t.id.indexOf('wCteOpcEntrada_') === 0) _cnAtualizarMarcadas();
    if (t && t.id === 'wCteDescricao') _cnAvisoTextoIcms();
}
// Opção marcada que pede um número ainda sem um valor válido (não entra na regra enquanto estiver assim)
function _cnOpcaoIncompleta() {
    return _cnTodasOpcoes().find(it => { if (!it.entrada) return false; const c = _cnEl('wCteOpc_' + it.id); return c && c.checked && _cteLerEntradaOpcao(it) === null; }) || null;
}
// Se há uma opção marcada sem o número que ela pede: leva à tela 3, põe o cursor no campo e explica. Devolve true quando bloqueou (quem chamou deve parar).
function _cnBloqueiaOpcaoIncompleta() {
    const falta = _cnOpcaoIncompleta();
    if (!falta) return false;
    if (_cnPasso !== 2) _cnIrPara(2, { semFoco: true });
    _cnMostrarOpcao(falta.id);
    const campo = _cnEl('wCteOpcEntrada_' + falta.id);
    if (campo) { campo.scrollIntoView({ block: 'center' }); campo.focus(); }
    const e = falta.entrada || {};
    _cnMsg('Falta preencher o número de “' + falta.label + '” (de ' + e.min + ' a ' + e.max + ') para essa opção valer na regra. Digite o número ou desmarque a opção.', 'erro');
    return true;
}
// Se há uma opção "Somar X no Y" marcada que não entrou na regra (a regra montada não calcula Y): sem este aviso a regra sairia sem ela, em silêncio.
function _cnBloqueiaOpcaoSemEfeito() {
    const it = _cnTodasOpcoes().find(_cnOpcaoSemEfeito);
    if (!it) return false;
    if (_cnPasso !== 2) _cnIrPara(2, { semFoco: true });
    _cnMostrarOpcao(it.id);
    const c = _cnEl('wCteOpc_' + it.id); if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); }
    _cnMsg('A opção “' + it.label + '” não tem onde entrar: a regra montada ainda não calcula ' + it.alvoNome + '. Escolha uma regra base no passo 1 (ou monte esse campo na montagem manual) ou desmarque a opção.', 'erro');
    return true;
}
// Garante que a opção apareça na lista (limpa o filtro da tela 3 se ele a estiver escondendo)
function _cnMostrarOpcao(id) {
    const c = _cnEl('wCteOpc_' + id), op = c && c.closest('.cn-opcao');
    if (!op || !op.closest('[hidden]')) return;
    const f = _cnEl('wCteNovaFiltro'); if (f) { f.value = ''; _cnFiltrar(); }
}
function _cnTemInstrucoes() { return ((_cnEl('wCteDescricao') || {}).value || '').trim() !== ''; }

// ── trava: o valor do ICMS não pode ser reduzido ─────────────────────────────
// A SEFAZ rejeita o Ct-e quando o valor do ICMS não é igual à Base de Cálculo × Alíquota. Por isso esta versão não gera regra que mexa no valor do ICMS (def("valorICMS", ...) com
// outra conta), não aceita pedido escrito para a IA de "reduzir o ICMS" e manda a IA nunca fazer isso. Quem quer pagar menos ICMS reduz a BASE DE CÁLCULO (“Redução Base de cálculo?”).
const CN_ICMS_PROMPT = 'TRAVA DO ICMS (OBRIGATORIA): o valor do ICMS NUNCA pode ser reduzido, descontado, abatido nem alterado diretamente. O valorICMS tem que ser SEMPRE igual a baseCalculo * (aliquota / 100); se nao bater, a SEFAZ rejeita o Ct-e. NUNCA escreva def("valorICMS", ...) com qualquer conta diferente de obt("baseCalculo") * (obt("aliquota")/100) (nada de multiplicar o valorICMS por um fator, subtrair desconto, somar outro campo etc.; apenas def("valorICMS", 0) junto com baseCalculo e aliquota zerados e permitido). Se o pedido for "reduzir o ICMS", reduza a BASE DE CALCULO e nunca o valor do ICMS: def("baseCalculo", obt("valorFrete") * (100 - PERCENTUAL) / 100); e depois calcule o ICMS normalmente: def("valorICMS", obt("baseCalculo") * (obt("aliquota")/100)).\n\n';
const CN_ICMS_MSG = 'Não dá para reduzir o valor do ICMS: a SEFAZ rejeita o Ct-e quando o ICMS não é igual à Base de Cálculo × Alíquota. Para pagar menos ICMS, reduza a BASE DE CÁLCULO: marque a opção “Redução Base de cálculo?” ou escreva para a IA “reduzir a base de cálculo em X%”.';

// Calculadora mínima (números, + - * / e parênteses, e as letras de `vars`), para conferir uma conta sem eval.
function _cnCalc(expr, vars) {
    const s = String(expr).replace(/\s+/g, ''); let i = 0;
    const erro = () => { throw new Error('conta'); };
    const prim = () => {
        if (s[i] === '(') { i++; const v = soma(); if (s[i] !== ')') erro(); i++; return v; }
        if (s[i] === '-') { i++; return -prim(); }
        if (s[i] === '+') { i++; return prim(); }
        let m = /^(\d+(\.\d+)?|\.\d+)/.exec(s.slice(i));
        if (m) { i += m[0].length; return parseFloat(m[0]); }
        m = /^[A-Za-z]\w*/.exec(s.slice(i));
        if (m && Object.prototype.hasOwnProperty.call(vars, m[0])) { i += m[0].length; return vars[m[0]]; }
        return erro();
    };
    const prod = () => { let v = prim(); while (s[i] === '*' || s[i] === '/') { const op = s[i++], d = prim(); v = op === '*' ? v * d : v / d; } return v; };
    const soma = () => { let v = prod(); while (s[i] === '+' || s[i] === '-') { const op = s[i++], d = prod(); v = op === '+' ? v + d : v - d; } return v; };
    const r = soma(); if (i !== s.length) erro();
    return r;
}
// A conta do valor do ICMS dá sempre Base de Cálculo × Alíquota ÷ 100? true = sim (ou é só o número 0); false = não (altera o valor); null = não dá para saber (usa outras variáveis/funções) — só false trava.
function _cnIcmsContaOk(expr) {
    let e = String(expr == null ? '' : expr), n = 0;
    const outros = {};
    e = e.replace(/obt\(\s*["']([^"']+)["']\s*\)/g, (_, campo) => campo === 'baseCalculo' ? 'B' : campo === 'aliquota' ? 'A' : (outros['o:' + campo] = outros['o:' + campo] || 'X' + (++n)));
    e = e.replace(/\btabelaPrecos\.[A-Za-z_]\w*/g, m => (outros[m] = outros[m] || 'X' + (++n)));
    if (/[A-Za-z_]/.test(e.replace(/\b(?:B|A|X\d+)\b/g, ''))) return null;
    const amostras = [[1000, 12], [2500, 7], [333.33, 18], [0, 12]];
    const iguais = [], zeros = [];
    try {
        for (const [B, A] of amostras) {
            const vars = { B, A }; for (let k = 1; k <= n; k++) vars['X' + k] = 37 + 53 * k + B / 100;
            const v = _cnCalc(e, vars), esp = B * A / 100;
            iguais.push(Math.abs(v - esp) <= 1e-6 * Math.max(1, Math.abs(esp)));
            zeros.push(v === 0);
        }
    } catch (x) { return null; }
    if (iguais.every(Boolean) || zeros.every(Boolean)) return true;
    return false;
}
// Linhas da regra que definem o valorICMS com uma conta diferente de Base de Cálculo × Alíquota. Acompanha variáveis simples (valor = ...; def("valorICMS", valor);).
function _cnIcmsLinhasInvalidas(codigo) {
    const ruins = [], vars = {};
    const subst = e => Object.keys(vars).reduce((acc, nome) => acc.replace(new RegExp('\\b' + nome + '\\b', 'g'), '(' + vars[nome] + ')'), e);
    String(codigo || '').split('\n').forEach(linha => {
        const l = linha.trim();
        const d = l.match(/^def\(\s*["']valorICMS["']\s*,\s*(.+)\)\s*;?\s*$/);
        if (d) { if (_cnIcmsContaOk(subst(d[1])) === false) ruins.push(l); return; }
        const a = l.match(/^(?:var\s+|let\s+|const\s+)?([A-Za-z_]\w*)\s*=(?!=)\s*(.+?)\s*;?\s*$/);
        if (a && !/^(?:if|else|for|while|def)\b/.test(l)) vars[a[1]] = subst(a[2]);
    });
    return ruins;
}
// O texto escrito para a IA pede para reduzir o valor do ICMS? Devolve a frase (ou ''). Só pega "reduzir/descontar/abater... o ICMS" (a palavra ICMS logo depois, com só palavras de ligação no meio);
// "reduzir a base de cálculo do ICMS", "reduzir o frete" e frases com "não/sem" ficam livres.
const CN_RED_RAIZ = /^(reduz|reduc|diminu|abat|descont|deduz|deduc|subtra|baix|minimiz)/;
const CN_RED_LIGACAO = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'ao', 'pelo', 'pela', 'por', 'para', 'ate', 'que', 'se', 'seja', 'ser', 'sera', 'deve', 'devem', 'deverao', 'precisa', 'pode', 'fica', 'ficar', 'fique', 'vai', 'com', 'valor', 'valores', 'total', 'imposto', 'cento', 'porcento', 'percentual', 'percentuais', 'pct', 'cliente', 'cobrado', 'cobrar', 'calculado', 'gerado']);
const CN_RED_OUTRO_OBJETO = new Set(['base', 'calculo', 'bc', 'aliquota', 'frete', 'tarifa', 'peso', 'prestacao', 'servico', 'seguro', 'pedagio', 'gris', 'tabela', 'nota', 'notas', 'mercadoria', 'diaria', 'outros']);
function _cnPedeReduzirIcms(texto) {
    const solto = x => CN_RED_LIGACAO.has(x) || /^\d+%?$/.test(x) || x === '%';
    for (const frase of String(texto || '').split(/[.;!?\n]+/)) {
        const t = _cnPalavras(frase).split(' ').filter(Boolean);
        for (let i = 0; i < t.length; i++) {
            if (!CN_RED_RAIZ.test(t[i])) continue;
            if (t.slice(Math.max(0, i - 3), i).some(x => x === 'nao' || x === 'sem' || x === 'nunca' || x === 'jamais' || x === 'evitar')) continue;
            for (let j = i + 1; j < t.length && j <= i + 9; j++) { if (/icms/.test(t[j])) return frase.trim(); if (!solto(t[j])) break; }   // reduzir [o valor do] ICMS
            let k = i + 1; while (k < t.length && solto(t[k])) k++;
            if (k < t.length && CN_RED_OUTRO_OBJETO.has(t[k])) continue;                                                                                 // "ICMS com redução de base...": o que reduz é outra coisa
            for (let j = i - 1; j >= 0 && j >= i - 9; j--) { if (/icms/.test(t[j])) return frase.trim(); if (!solto(t[j])) break; }              // ICMS [deve ser] reduzido
        }
    }
    return '';
}
// Embaixo da caixa de texto da IA (tela 3): avisa enquanto a pessoa escreve
function _cnAvisoTextoIcms() {
    const el = _cnEl('wCteNovaAvisoIcmsTexto'); if (!el) return;
    const pede = !!_cnPedeReduzirIcms((_cnEl('wCteDescricao') || {}).value);
    el.textContent = pede ? '⛔ ' + CN_ICMS_MSG : '';
    const msg = _cnEl('wCteNovaMsg');
    if (!pede && msg && msg.textContent.indexOf(CN_ICMS_MSG) === 0) _cnMsg('');   // corrigiu o texto: some também a mensagem vermelha que o "Gerar Regra" deixou no rodapé
}
// Faixa vermelha no topo (qualquer tela) enquanto a regra montada alterar o valor do ICMS — vem de regra colada, regra base editada ou da montagem manual.
function _cnAtualizarAvisoIcms(linhas) {
    const el = _cnEl('wCteNovaAvisoIcms'); if (!el) return;
    const ruins = _cnIcmsLinhasInvalidas((linhas || _cteLinhasValidas()).join('\n'));
    if (!ruins.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<span aria-hidden="true">⛔</span><span><b>A regra montada altera o valor do ICMS</b> (<code>${esc(ruins[0])}</code>${ruins.length > 1 ? ' e mais ' + (ruins.length - 1) : ''}). O ICMS tem que ser sempre <b>Base de Cálculo × Alíquota ÷ 100</b>, senão a SEFAZ rejeita o Ct-e — por isso a regra não pode ser gerada assim. Corrija na montagem manual (passo 4) ou, para pagar menos ICMS, reduza a Base de Cálculo (opção “Redução Base de cálculo?”, passo 3).</span>`;
}
// true = BLOQUEOU (quem chamou deve parar). soCodigo: só confere a regra montada (é o caso do "Gerar Regra Montada", onde o texto da IA não entra).
function _cnBloqueiaReducaoIcms(opcoes) {
    if (!_cnEl('wizardRegraNovaCard')) return false;   // só vale na Nova Versão: o montador clássico (que usa as mesmas funções de gerar) continua como sempre foi
    if (!(opcoes && opcoes.soCodigo) && _cnTemInstrucoes() && _cnPedeReduzirIcms(_cnEl('wCteDescricao').value)) {
        if (_cnPasso !== 2) _cnIrPara(2, { semFoco: true });
        _cnAvisoTextoIcms();
        const t = _cnEl('wCteDescricao'); if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); }
        _cnMsg(CN_ICMS_MSG + ' Ajuste o texto da IA para continuar.', 'erro');
        return true;
    }
    if (_cnIcmsLinhasInvalidas(_cteLinhasValidas().join('\n')).length) {
        _cnAtualizarAvisoIcms();
        const el = _cnEl('wCteNovaAvisoIcms');
        if (el) { el.classList.remove('chama'); void el.offsetWidth; el.classList.add('chama'); }   // pisca a faixa (ela fica no topo, visível em qualquer tela)
        _cnMsg('A regra montada altera o valor do ICMS (veja a faixa vermelha no topo): corrija na montagem manual (passo 4) antes de gerar.', 'erro');
        return true;
    }
    return false;
}
// Depois que a IA responde: se mesmo assim a regra define o valorICMS de outro jeito, o cartão abre com um alerta em cima.
function _cnAvisoIcmsNaResposta(texto) {
    const blocos = [...String(texto || '').matchAll(/```[\w]*\n?([\s\S]*?)```/g)].map(m => m[1]);
    const ruins = _cnIcmsLinhasInvalidas(blocos.length ? blocos.join('\n') : texto);
    if (!ruins.length) return texto;
    const linha = ruins[0].replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '**⚠️ Atenção — não use esta regra como está:** ela define o valor do ICMS de um jeito diferente de Base de Cálculo × Alíquota (' + linha + '), e a SEFAZ rejeita o Ct-e quando isso acontece. Gere de novo ou troque essa linha por def("valorICMS", obt("baseCalculo") * (obt("aliquota")/100)); para pagar menos ICMS, reduza a Base de Cálculo.\n\n' + texto;
}

// "Gerar Regra": com texto para a IA, a IA monta (usando também o que foi marcado/carregado); só com marcações/regra base, gera direto, sem IA.
function _cnGerar() {
    _cnMsg('');
    if (_cnBloqueiaOpcaoIncompleta()) return;
    if (_cnBloqueiaOpcaoSemEfeito()) return;
    if (_cnBloqueiaReducaoIcms()) return;
    if (_cnTemInstrucoes()) { enviarWizardRegraDnd(); return; }
    if (_cteLinhasValidas().length) { _cteGerarRegraCustom(); return; }
    _cnMsg('Ainda não há nada para gerar: marque pelo menos uma opção, explique para a IA o que precisa ou, se prefere montar à mão, marque “Desejo fazer a montagem manual da regra” e clique em “Avançar para montagem manual”.', 'aviso');
}

// ── tela 4: montagem manual ──────────────────────────────────────────────────
// Na primeira vez que a pessoa chega na montagem abre o tutorial de sempre (só os passos que existem nesta tela), a não ser que ela já tenha pedido para não mostrar mais.
function _cnTourPrimeiraVez() {
    if (_cnTourVisto) return;
    _cnTourVisto = true;
    let visto = false;
    try { visto = !!localStorage.getItem(_TOUR_LOCALSTORAGE_KEY); } catch (e) {}
    if (visto) return;
    setTimeout(() => { if (_cnPasso === 3 && _cnEl('wizardRegraNovaCard') && typeof _iniciarTourBuilder === 'function') _iniciarTourBuilder('cte'); }, 300);
}

// ── quando a IA falha ────────────────────────────────────────────────────────
// O assistente fecha assim que a IA é chamada; se ela falhar, a pessoa não pode perder o que montou: o cartão de erro traz o "Voltar" de sempre
// (o estado é o mesmo que o cartão da regra gerada guardaria — ver enviarWizardRegraDnd).
function _cnCardErroIA(estadoVoltar) {
    const s = Ferr.stream('regra'), c = document.createElement('div'), ts = Date.now();
    c.className = 'answer-card'; c.id = '_regraResultCard_' + ts;
    window['_regraVoltar_' + ts] = { tipo: 'cte-nova', ...estadoVoltar };
    c.innerHTML = `<div class="answer-section"><div class="section-content">❌ Não consegui gerar a regra agora. Clique em <b>Voltar</b> para tentar de novo — o que você montou e escreveu continua guardado.</div></div>`
        + `<div class="feedback-area"><button onclick="_voltarParaWizardRegra(${ts})" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #1e40af;border-radius:8px;background:white;color:#1e40af;cursor:pointer;font-size:13px;font-weight:600;">🔙 Voltar</button>${ferrBotaoNovoHtml('regra')}</div>`;
    s.appendChild(c);
    ferrRolar('regra', true);
}

// ── "Voltar" (do cartão da regra gerada) ─────────────────────────────────────
// Chamada por _voltarParaWizardRegra depois de reabrir o assistente e restaurar os campos / a área de montagem: realinha as telas com o estado e volta à tela em que a pessoa estava.
function _cnAposRestaurar(info) {
    const chk = _cnEl('wCteOutrosValoresCheck');
    if (chk) _cteToggleOutrosValores(chk.checked);   // o "restaurar" só marca a caixinha: reabre a caixa de nomes e refaz os chips
    // os campos da Tabela de Preços só existem nesta tela: a lista da montagem volta do texto e do Sim/Não restaurados
    const { sim, tabela } = _cnCamposUi();
    window._cteTabelaCustom = sim ? tabela : [];
    _cnRenderTabelaCustom();
    _cnLerCamposDaMontagem();
    _cnAtualizarMarcadas();
    _cnFiltrar();
    const passo = info && Number.isInteger(info.passo) ? info.passo : 2;
    for (let i = 0; i < passo; i++) _cnVisitados.add(i);
    _cnManualOk = !!(info && info.manualOk) || passo === 3;   // quem estava na montagem já tinha marcado; quem gerou da tela 3 volta com a caixa como estava
    _cnTourVisto = true;   // quem voltou já viu a montagem: sem tutorial automático (tem que valer ANTES do _cnIrPara, que é quem dispara o tutorial ao chegar na tela 4)
    _cnIrPara(passo, { semFoco: true });
}
