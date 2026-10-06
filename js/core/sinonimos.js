/* js/core/sinonimos.js — Sinônimos e termos de busca (usado pelo app e pela Área Administrativa). */
// ═══════════════════════════════════════════════════════════
//  SISTEMA DE SINÔNIMOS
// ═══════════════════════════════════════════════════════════
const SINONIMOS = {
    // 18/09/2026: "cadastrar" (e variações) tratado como sinônimo de "emitir" fazia "como cadastrar
    // um veículo" virar "como emitir um veículo" -- cadastro de registro (veículo/motorista/cliente)
    // é uma ação bem diferente de emissão de documento fiscal (CT-e/NF-e/MDF-e) neste sistema, e a
    // busca passava a priorizar artigos de emissão, empurrando o artigo de cadastro pra fora do topo
    // (onde o conteúdo é cortado). Tirado daqui -- ver também "veiculo" logo abaixo.
    emitir: ["emito","criar","emitir","gerar","lançar","fazer","abrir","montar","produzir","processar","emissão","geração","criação","lançamento","abertura"],
    cancelar: ["cancelar","estornar","desfazer","anular","reverter","excluir","deletar","remover","apagar","cancelamento","estorno"],
    // 23/09/2026: existiam DOIS grupos apontando um pro outro -- "cte" tinha "conhecimento" como
    // sinônimo, e mais embaixo um grupo "conhecimento" separado tinha "cte" como sinônimo dele (o
    // mesmo valia pra "mdfe"/"manifesto"). Como a normalização roda os grupos em sequência, o
    // ÚLTIMO da lista sempre desfazia o que o primeiro tinha acabado de trocar -- ex.: "manifesto
    // de carga" virava "mdfe" no grupo mdfe, e alguns grupos depois o grupo "manifesto" via esse
    // "mdfe" e trocava de volta pra "manifesto" sozinho, PERDENDO a palavra "de carga" no caminho.
    // Removidos os grupos duplicados "conhecimento" e "manifesto" (eram exatamente os mesmos
    // sinônimos, só que apontando pro nome "errado") -- mantido só "cte"/"mdfe", que já cobrem os
    // mesmos termos e batem com as mesmas chaves usadas em detectarDocumento().
    cte: ["conhecimento", "conhecimento de transporte", "ct-e", "cte"],
    mdfe: ["manifesto", "manifesto de carga", "mdf-e", "mdf", "mdfe"],
    nfse: ["nfs-e", "nfs", "nota fiscal de serviço", "notas fiscais de serviço", "nfse"],
    nfe: ["nf-e", "nfe", "nota fiscal eletrônica", "nota fiscal", "notas fiscais"],
    consultar: ["consultar","buscar","localizar","pesquisar","encontrar","ver","visualizar","verificar","checar","acessar","abrir","listar","mostrar","exibir","onde fica","como ver","como achar","como encontrar","onde encontrar","onde localizar"],
    motorista: ["motorista", "condutor", "piloto", "chofer", "colaborador", "funcionário", "pessoa"],
    // 18/09/2026: testei ao vivo (busca vetorial real) antes de decidir -- tirar "bitrem"/"dolly"/
    // "carreta"/"cavalo"/etc. daqui pra virarem só "veículo" pareceu mais preciso a princípio, mas
    // na prática piora a busca: o artigo "Como cadastrar um veículo" cobre TODOS esses tipos, mas o
    // embedding dele é dominado pela palavra "veículo" -- pesquisar só "bitrem" ou "dolly" sozinho
    // rankeava esse artigo mal (dolly nem entrava no top 12) ou fora do top 3 (corte de 1000
    // caracteres). Mantido/ampliado com os nomes de categoria reais do cadastro (Truck, Bitruck,
    // Cavalo, Carreta, Semi Reboque, Dolly, Bitrem, Rodotrem).
    veiculo: ["veículo", "caminhão", "carreta", "truck", "trucado", "bitruck", "bitrem", "rodotrem", "carro", "frota", "cavalo", "conjunto", "conjuntos", "dolly", "semi reboque", "semi-reboque", "semirreboque"],
    cliente: ["cliente", "contratante", "pagador", "remetente", "destinatário", "tomador", "pessoa"],
    transporte: ["transporte", "frete", "carga", "entrega", "coleta", "movimentação", "logística", "transferência"],
    financeiro: ["financeiro", "pagamento", "recebimento", "cobrança", "faturamento", "contas", "títulos", "caixa", "banco", "dinheiro", "valor"],
    nota: ["nota", "documento", "doc", "docs", "documentos", "papel"],
    difal: ["partilha icms", "partilha do icms", "partilha de icms"],
    estoque: ["estoque", "armazenagem", "armazém", "depósito", "inventário", "almoxarifado"],
    configuracao: ["configuração", "config", "parâmetro", "parametrização", "ajuste", "configurar", "parametrizar", "ajustar", "configurações", "parâmetros"],
    relatorio: ["relatório", "relatorio", "relatorios", "relatórios", "relação", "lista", "listagem", "impressão", "imprimir", "gerar relatório"],
    erro: ["erro", "problema", "falha", "defeito", "bug", "travamento", "mensagem de erro", "rejeição", "rejeicao", "rejeitado"],
    sefaz: ["sefaz", "receita", "fisco", "fazenda", "órgão", "orgão", "governo", "receita federal", "secretaria da fazenda", "validação", "validador"],
    talao: ["talão", "talao", "numeração", "série", "serie", "sequência", "sequencia", "faixa"],
    certificado: ["certificado", "digital", "a1", "a3", "token", "assinatura", "ssl", "validade", "vencimento", "cert"],
    tabela: ["tabela", "preço", "preco", "valor", "custo", "tarifa", "taxa", "tabela de preço", "tabela de preços"],
    contrato: ["contrato", "acordo", "negociação", "negociacao", "ajuste contratual", "contrato de frete", "CF"],
    ordem: ["ordem", "oc", "ordem de carregamento", "carregamento", "ordem de coleta"],
    minuta: ["minuta", "rascunho", "pré-conhecimento", "pre-conhecimento", "documento não fiscal"],
    // Busca pelo artigo de Substituição Tributária não estava achando o conteúdo certo (o artigo
    // no banco é indexado como "CST 60") -- tratando "substituição tributária"/"st" como sinônimo
    // direto de "cst 60" antes da busca, tanto a busca vetorial quanto a por palavra-chave passam
    // a encontrar o artigo certo.
    'cst 60': ["substituição tributária", "substituicao tributaria", "st"]
};

function normalizarSinonimos(texto) {
    if (!texto) return texto;
    let textoNormalizado = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let textoOriginal = texto.toLowerCase();
    for (const [termoPrincipal, sinonimos] of Object.entries(SINONIMOS)) {
        const sinonimosOrdenados = [...sinonimos].sort((a, b) => b.length - a.length);
        for (const sinonimo of sinonimosOrdenados) {
            const sinonimoNormalizado = sinonimo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const regex = new RegExp(`\\b${escapeRegExp(sinonimo)}\\b`, 'gi');
            if (regex.test(textoOriginal)) {
                textoOriginal = textoOriginal.replace(regex, termoPrincipal);
            }
            const regexNormalizado = new RegExp(`\\b${escapeRegExp(sinonimoNormalizado)}\\b`, 'gi');
            if (regexNormalizado.test(textoNormalizado)) {
                textoNormalizado = textoNormalizado.replace(regexNormalizado, termoPrincipal);
            }
        }
    }
    return textoOriginal;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extrairTermosComSinonimos(texto) {
    const textoNormalizado = normalizarSinonimos(texto);
    const sw = new Set([
        "como","que","qual","quais","para","com","sem","não","mas","por","mais","uma",
        "isso","este","esta","esse","essa","num","numa","meu","minha","meus","minhas",
        "tem","ter","ser","foi","vai","vou","tenho","posso","pode","quero","preciso",
        "saber","sobre","nao","onde","quando","porque","pois","também","ainda","mesmo",
        "tipo","ah","e","o","a","os","as","um","uns","umas","no","na","nos","nas",
        "do","da","dos","das","de","em"
    ]);
    return textoNormalizado
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 2 && !sw.has(t));
}

function detectarDocumento(texto) {
    const textoNormalizado = normalizarSinonimos(texto);
    const md = {
        'cte': ['cte', 'conhecimento', 'conhecimento de transporte', 'ct-e'],
        'nfse': ['nfse', 'nfs-e', 'nota fiscal de serviço', 'nota de serviço'],
        'nfe': ['nfe', 'nf-e', 'nota fiscal', 'nota fiscal eletrônica'],
        'mdfe': ['mdfe', 'mdf-e', 'manifesto', 'manifesto de carga'],
        'minuta': ['minuta', 'conhecimento não fiscal', 'rascunho'],
        'oc': ['ordem de carregamento', 'oc', 'ordem'],
        'contrato': ['contrato de frete', 'contrato'],
        'ciot': ['ciot', 'contrato de frete eletrônico'],
        'vpo': ['vpo', 'vale pedágio', 'vale-pedágio']
    };
    for (const [t, p] of Object.entries(md)) {
        if (p.some(palavra => textoNormalizado.includes(palavra.toLowerCase()))) {
            return t;
        }
    }
    return null;
}
