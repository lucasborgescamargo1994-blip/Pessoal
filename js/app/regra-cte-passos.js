/* js/app/regra-cte-passos.js — biblioteca COMPARTILHADA dos assistentes em telas do Criar Regra › Ct-e / Conhecimento (Nova Versão: js/app/regra-cte-nova.js; Beta: js/app/regra-cte-beta.js). */
// ═══════════════════════════════════════════════════════════
//  Ct-e / CONHECIMENTO — CATÁLOGO E ANALISADORES COMPARTILHADOS
// ═══════════════════════════════════════════════════════════
// Aqui ficam só as peças que os dois assistentes usam do MESMO jeito (mexer aqui muda os dois ao mesmo tempo — a Nova Versão e o Beta):
//   • o catálogo de opções: CN_REGRAS_PRONTAS, CN_BUSCA (palavras extras do filtro), CN_SOMA_* / CN_OPCOES_DEMAIS (as contas "Somar X no Y"), _cnTodasOpcoes, _cnOpcaoSemEfeito...;
//   • as travas e analisadores puros: o ICMS não pode ser reduzido (CN_ICMS_*, _cnIcmsLinhasInvalidas, _cnPedeReduzirIcms), loop de dependência (_cnLoopsDoCodigo, _cnLoopNaResposta...) e o texto
//     que eles acrescentam ao pedido da IA (CN_PROMPT_REGRA).
// As TELAS (HTML, navegação, rodapé, estado e o registro em window.CTE_ASSISTENTES) de cada assistente ficam no arquivo dele. A interface antiga da "Nova Versão" (4 telas) foi aposentada na 28.12.0:
// a Nova Versão de hoje é a cópia estável do Beta (js/app/regra-cte-nova.js) — veja tools/gerar-nova-do-beta.js. Este arquivo precisa carregar ANTES dos dois (index.html).

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
// Só os assistentes em telas (Nova Versão e Beta) desenham este grupo, no FIM da lista (o montador clássico não): uma opção (caixinha) para cada "Somar <campo> no <campo>", para quem digita no filtro
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

const _cnEl = id => document.getElementById(id);
const _cnNorm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
// Só palavras (letras sem acento, números e %) separadas por um espaço — base do filtro das opções
const _cnPalavras = s => _cnNorm(s).replace(/[^a-z0-9%]+/g, ' ').trim();

// Nome interno = letras, números e _ (sem espaço, ponto, colchete, aspas...). Aceita vírgula, ponto e vírgula ou quebra de linha como separador.
function _cnNomesCampos(texto) {
    const validos = [], invalidos = [];
    String(texto || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(n => {
        if (/^[\p{L}\p{N}_]+$/u.test(n)) { if (!validos.includes(n)) validos.push(n); }
        else if (!invalidos.includes(n)) invalidos.push(n);
    });
    return { validos, invalidos };
}
function _cnTodasOpcoes() { return _cteGruposOpcoes().flatMap(g => g.itens); }
// Opção "Somar X no Y" marcada que não entrou em lugar nenhum porque a regra montada não calcula o campo Y (ver _aplicarSomaEmCampo): o termo não está em nenhuma definição dele.
function _cnOpcaoSemEfeito(it) {
    if (it.modo !== 'somarEm') return false;
    const c = _cnEl('wCteOpc_' + it.id); if (!c || !c.checked) return false;
    return !(window._cteBlocos || []).some(b => b.destino === it.campoAlvo && (b.termos || []).some(t => t.termo === it.termoNovo.termo));
}
// Opção marcada que pede um número ainda sem um valor válido (não entra na regra enquanto estiver assim)
function _cnOpcaoIncompleta() {
    return _cnTodasOpcoes().find(it => { if (!it.entrada) return false; const c = _cnEl('wCteOpc_' + it.id); return c && c.checked && _cteLerEntradaOpcao(it) === null; }) || null;
}
function _cnTemInstrucoes() { return ((_cnEl('wCteDescricao') || {}).value || '').trim() !== ''; }

// ── trava: o valor do ICMS não pode ser reduzido ─────────────────────────────
// A SEFAZ rejeita o Ct-e quando o valor do ICMS não é igual à Base de Cálculo × Alíquota. Por isso os assistentes em telas não geram regra que mexa no valor do ICMS (def("valorICMS", ...) com
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
// Depois que a IA responde: se mesmo assim a regra define o valorICMS de outro jeito, o cartão abre com um alerta em cima.
function _cnAvisoIcmsNaResposta(texto) {
    const blocos = [...String(texto || '').matchAll(/```[\w]*\n?([\s\S]*?)```/g)].map(m => m[1]);
    const ruins = _cnIcmsLinhasInvalidas(blocos.length ? blocos.join('\n') : texto);
    if (!ruins.length) return texto;
    const linha = ruins[0].replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '**⚠️ Atenção — não use esta regra como está:** ela define o valor do ICMS de um jeito diferente de Base de Cálculo × Alíquota (' + linha + '), e a SEFAZ rejeita o Ct-e quando isso acontece. Gere de novo ou troque essa linha por def("valorICMS", obt("baseCalculo") * (obt("aliquota")/100)); para pagar menos ICMS, reduza a Base de Cálculo.\n\n' + texto;
}

// ── trava: LOOP (dependência circular) na regra ──────────────────────────────
// Loop = campos que precisam do valor um do outro para serem calculados, ex.: def("valorFrete", … obt("totalPrestacao") …) e, em outra linha, def("totalPrestacao", … obt("valorFrete") …)
// (ou um ciclo maior: A usa B, B usa C, C usa A). A conta nunca fecha e o valor muda a cada recálculo. Cada def("A", conta) depende dos campos lidos com obt() na conta e nas condições (if)
// que mandam nele; ler o PRÓPRIO valor (ex.: frete mínimo) não é loop. Nada é entregue com loop: a pessoa é avisada do que causou e volta às opções para corrigir.
const CN_LOOP_PROMPT = 'VERIFICACAO DE LOOP (OBRIGATORIA ANTES DE ENTREGAR): confira quem depende de quem. Cada def("A", ...) depende de todos os campos lidos com obt() na conta dele (e na condicao do if que o controla). Se houver dependencia circular entre campos, ha LOOP: por exemplo def("valorFrete", ... obt("totalPrestacao") ...) e, em outra linha, def("totalPrestacao", ... obt("valorFrete") ...), ou um ciclo maior (A usa B, B usa C, C usa A). Com loop a conta nunca fecha. Se o pedido ou o que ja estava montado causar um loop, primeiro tente desfaze-lo SEM mudar o que foi pedido (ex.: calcular a partir dos campos de origem, nao de um total que ja inclui o campo). Se nao for possivel, NAO entregue a regra: responda SOMENTE com uma linha no formato "LOOP DETECTADO: <campo A> -> <campo B> -> <campo A>. <explicacao curta, em portugues, do que causou o loop>" e nada mais. Um campo ler o proprio valor (ex.: frete minimo) nao e loop.\n\n';
const CN_PROMPT_REGRA = CN_ICMS_PROMPT + CN_LOOP_PROMPT;   // o que os assistentes em telas acrescentam ao pedido enviado à IA (ver enviarWizardRegraDnd)
const _cnRotuloCampo = c => _ROTULOS_CAMPOS[c] || ((c.match(/^outrosValores\[(.*)\]$/) || [])[1]) || c;

// Cada def("campo", conta) do código, na ordem: { alvo, deps (campos lidos com obt() na conta e nas condições que mandam nele), texto }. Segue variáveis simples
// (valor = obt("x") * 2; def("y", valor)) e entende if/else, com ou sem chaves. Comentários e o que não é def()/atribuição são ignorados.
function _cnDefsDoCodigo(codigo) {
    // 1) tira os comentários (respeitando aspas)
    let s = '', q = null;
    const bruto = String(codigo || '');
    for (let k = 0; k < bruto.length; k++) {
        const c = bruto[k];
        if (q) { s += c; if (c === '\\') { s += bruto[++k] || ''; } else if (c === q) q = null; continue; }
        if (c === '"' || c === "'") { q = c; s += c; continue; }
        if (c === '/' && bruto[k + 1] === '/') { while (k < bruto.length && bruto[k] !== '\n') k++; s += '\n'; continue; }
        if (c === '/' && bruto[k + 1] === '*') { const f = bruto.indexOf('*/', k + 2); k = f === -1 ? bruto.length : f + 1; s += ' '; continue; }
        s += c;
    }
    const n = s.length, defs = [], vars = {};
    const campos = txt => { const r = new Set(), re = /obt\(\s*["']([^"']+)["']\s*\)/g; let m; while ((m = re.exec(txt))) r.add(m[1]); return r; };
    const depsDe = txt => {
        const r = campos(txt);
        (txt.replace(/(["'])(?:\\.|(?!\1).)*\1/g, ' ').match(/[A-Za-z_]\w*/g) || []).forEach(id => { if (vars[id]) vars[id].forEach(c => r.add(c)); });
        return r;
    };
    const fecha = i => {   // i aponta para "(": devolve o índice do ")" que a fecha (ou -1)
        let d = 0, a = null;
        for (let k = i; k < n; k++) {
            const c = s[k];
            if (a) { if (c === '\\') k++; else if (c === a) a = null; continue; }
            if (c === '"' || c === "'") a = c; else if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return k; }
        }
        return -1;
    };
    const fimDeclaracao = i => {   // fim da declaração que começa em i: ";" ou quebra de linha fora de parênteses (ou uma chave)
        let d = 0, a = null, k = i;
        for (; k < n; k++) {
            const c = s[k];
            if (a) { if (c === '\\') k++; else if (c === a) a = null; continue; }
            if (c === '"' || c === "'") a = c; else if (c === '(') d++; else if (c === ')') d--; else if (d <= 0 && (c === ';' || c === '\n' || c === '{' || c === '}')) break;
        }
        return k;
    };
    let i = 0, prof = 0, pendBloco = null, pendUma = null, ultima = null;
    const blocos = [];   // if com chaves abertos: { deps, prof }
    const condAtual = () => { const r = new Set(); blocos.forEach(b => b.deps.forEach(d => r.add(d))); if (pendUma) pendUma.forEach(d => r.add(d)); return r; };
    while (i < n) {
        const c = s[i];
        if (/[\s;]/.test(c)) { i++; continue; }
        if (c === '{') { prof++; if (pendBloco) { blocos.push({ deps: pendBloco, prof }); pendBloco = null; } i++; continue; }
        if (c === '}') { while (blocos.length && blocos[blocos.length - 1].prof === prof) blocos.pop(); prof--; i++; continue; }
        const resto = s.slice(i, i + 40);
        let m;
        if ((m = /^if\s*\(/.exec(resto))) {
            const ab = i + m[0].length - 1, fe = fecha(ab);
            if (fe < 0) break;
            const deps = depsDe(s.slice(ab + 1, fe));
            ultima = deps;
            let j = fe + 1; while (j < n && /\s/.test(s[j])) j++;
            if (s[j] === '{') pendBloco = deps; else pendUma = deps;
            i = fe + 1; continue;
        }
        if (/^else\b/.test(resto)) {   // "else if (...)" cai no if acima; "else {" / "else declaração" valem sob a condição do if anterior
            let j = i + 4; while (j < n && /\s/.test(s[j])) j++;
            if (!/^if\b/.test(s.slice(j, j + 3)) && ultima) { if (s[j] === '{') pendBloco = ultima; else pendUma = ultima; }
            i += 4; continue;
        }
        if ((m = /^def\s*\(/.exec(resto))) {
            const ab = i + m[0].length - 1, fe = fecha(ab);
            if (fe < 0) break;
            const a = /^\s*(["'])([^"']+)\1\s*,([\s\S]*)$/.exec(s.slice(ab + 1, fe));
            if (a) { const deps = depsDe(a[3]); condAtual().forEach(d => deps.add(d)); defs.push({ alvo: a[2], deps: [...deps], texto: s.slice(i, fe + 1) }); }
            pendUma = null; i = fe + 1; continue;
        }
        if ((m = /^(?:(?:var|let|const)\s+)?([A-Za-z_]\w*)\s*=(?!=)/.exec(resto))) {
            const ini = i + m[0].length, fim = fimDeclaracao(ini);
            vars[m[1]] = depsDe(s.slice(ini, fim));
            pendUma = null; i = Math.max(fim, ini); continue;
        }
        const fim = fimDeclaracao(i);   // outra declaração (chamada de método, for, try, return…): pula
        pendUma = null; i = fim > i ? fim : i + 1;
    }
    return defs;
}
// Loops do código: [{ campos, caminho, linhas:[{ de, para, texto }] }], um por grupo de campos que dependem uns dos outros (o caminho é o ciclo mais curto a partir do 1º campo definido do grupo).
function _cnLoopsDoCodigo(codigo) {
    const defs = _cnDefsDoCodigo(codigo);
    const adj = new Map(), texto = new Map();
    defs.forEach(d => {
        if (!adj.has(d.alvo)) adj.set(d.alvo, new Set());
        d.deps.forEach(x => { if (x !== d.alvo) { adj.get(d.alvo).add(x); if (!texto.has(d.alvo + '\u0001' + x)) texto.set(d.alvo + '\u0001' + x, d.texto); } });
    });
    const nos = [...adj.keys()], viz = v => [...adj.get(v)].filter(x => adj.has(x));   // só campos que alguma linha define fecham um ciclo
    // componentes fortemente conectados (Tarjan)
    const idx = new Map(), baixo = new Map(), pilha = [], naPilha = new Set(), comps = [];
    let cont = 0;
    const visita = v => {
        idx.set(v, cont); baixo.set(v, cont); cont++; pilha.push(v); naPilha.add(v);
        viz(v).forEach(w => { if (!idx.has(w)) { visita(w); baixo.set(v, Math.min(baixo.get(v), baixo.get(w))); } else if (naPilha.has(w)) baixo.set(v, Math.min(baixo.get(v), idx.get(w))); });
        if (baixo.get(v) === idx.get(v)) { const comp = []; let w; do { w = pilha.pop(); naPilha.delete(w); comp.push(w); } while (w !== v); if (comp.length > 1) comps.push(comp); }
    };
    nos.forEach(v => { if (!idx.has(v)) visita(v); });
    return comps.map(comp => {
        const dentro = new Set(comp), ini = nos.find(v => dentro.has(v));
        // ciclo mais curto que volta ao início (busca em largura)
        const ant = new Map([[ini, null]]), fila = [ini];
        let fecha = null;
        for (let f = 0; f < fila.length && !fecha; f++) for (const w of viz(fila[f])) { if (!dentro.has(w)) continue; if (w === ini) { fecha = fila[f]; break; } if (!ant.has(w)) { ant.set(w, fila[f]); fila.push(w); } }
        const caminho = []; for (let v = fecha; v !== null; v = ant.get(v)) caminho.unshift(v);
        caminho.push(ini);
        const linhas = []; for (let k = 0; k < caminho.length - 1; k++) linhas.push({ de: caminho[k], para: caminho[k + 1], texto: texto.get(caminho[k] + '\u0001' + caminho[k + 1]) || '' });
        return { campos: comp, caminho, linhas };
    });
}
// Opções marcadas (nos passos de cálculo) que criam alguma das dependências do loop: é por onde a pessoa corrige.
function _cnOpcoesDoLoop(ciclos) {
    const arestas = new Set();
    ciclos.forEach(c => c.linhas.forEach(l => arestas.add(l.de + '\u0001' + l.para)));
    const lista = [];
    _cnTodasOpcoes().forEach(it => {
        const c = _cnEl('wCteOpc_' + it.id); if (!c || !c.checked) return;
        let deps = [];
        if (it.termoNovo) { const m = /obt\(\s*['"]([^'"]+)['"]\s*\)/.exec(it.termoNovo.termo); if (m) deps = [{ alvo: it.campoAlvo, deps: [m[1]] }]; }
        else if (it.codigo) deps = _cnDefsDoCodigo(it.codigo.replace(/\{valor\}/g, '0'));
        if (deps.some(d => d.deps.some(x => arestas.has(d.alvo + '\u0001' + x)))) lista.push(it.label);
    });
    return lista;
}
const _cnResumoLinha = t => { const x = String(t || '').replace(/\s+/g, ' ').trim(); return x.length > 120 ? x.slice(0, 117) + '…' : x; };
// Texto do aviso (HTML) com o que causou o loop e como corrigir
function _cnLoopHtml(ciclos, opcoes) {
    const c = ciclos[0], rot = _cnRotuloCampo;
    const linhas = c.linhas.map(l => `<li><b>${esc(rot(l.de))}</b> usa <b>${esc(rot(l.para))}</b>${l.texto ? ': <code>' + esc(_cnResumoLinha(l.texto)) + '</code>' : ''}</li>`).join('');
    return `<b>Loop na regra:</b> ${esc(c.caminho.map(rot).join(' → '))}. Cada um desses campos precisa do valor do outro para ser calculado, então a conta nunca fecha e o valor muda a cada recálculo.`
        + `<ul class="cn-loop-lista">${linhas}</ul>`
        + (c.campos.length > c.caminho.length - 1 ? `<div>Também estão envolvidos: ${esc(c.campos.filter(x => !c.caminho.includes(x)).map(rot).join(', '))}. Pode haver outro caminho de loop: se este aviso voltar depois da correção, repita o mesmo passo.</div>` : '')
        + (ciclos.length > 1 ? `<div>Há mais ${ciclos.length - 1} grupo(s) de campos em loop na regra.</div>` : '')
        + (opcoes.length ? `<div><b>Opção(ões) marcada(s) que causam isso:</b> ${opcoes.map(o => '“' + esc(o) + '”').join(', ')}. Desmarque-a(s) ou escolha outra forma de calcular.</div>` : '<div>Corrija o pedido para a IA, a regra colada ou a montagem manual (passo 4): um dos campos tem que ser calculado só a partir dos campos de origem, não do outro.</div>')
        + '<div>A regra só é gerada depois que o loop for desfeito.</div>';
}
// Resposta da IA com loop? Devolve { html } (o aviso) ou null. Vale quando a própria IA recusou ("LOOP DETECTADO: …", como o prompt manda) ou quando o código que ela entregou tem loop.
function _cnLoopNaResposta(texto) {
    const t = String(texto || '');
    const recusa = /^[\s*`#>-]*LOOP DETECTADO[\s*`]*:\s*([\s\S]*)$/i.exec(t);
    if (recusa) {
        const motivo = recusa[1].replace(/```[\s\S]*$/, '').trim().slice(0, 600);
        return { html: '<b>A IA encontrou um loop e não entregou a regra:</b> ' + esc(motivo || 'campos que dependem um do outro') + '<div>Corrija o pedido ou as opções marcadas aqui no passo 3 e gere de novo.</div>' };
    }
    const blocos = [...t.matchAll(/```[\w]*\n?([\s\S]*?)```/g)].map(m => m[1]);
    const ciclos = _cnLoopsDoCodigo(blocos.length ? blocos.join('\n') : t);
    if (!ciclos.length) return null;
    return { html: _cnLoopHtml(ciclos, _cnOpcoesDoLoop(ciclos)).replace('<b>Loop na regra:</b>', '<b>A regra que a IA montou tem um loop e não foi entregue:</b>') };
}
