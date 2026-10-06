/* js/app/sistema-bsoft.js — Estrutura do Bsoft TMS (menus, documentos, caminhos) usada como contexto da IA. */
// ═══════════════════════════════════════════════════════════
//  CONSTANTE: ESTRUTURA COMPLETA DO SISTEMA BSOFT TMS
// ═══════════════════════════════════════════════════════════
const SISTEMA_BSOFT_TMS = {
    descricao: "Bsoft TMS é um sistema ERP completo para gestão de transportadoras, logística e emissão de documentos fiscais eletrônicos.",
    
    estrutura_menus: {
        "Opções do Sistema": ["Suporte", "Sobre", "Atualizações"],
        "Ambiente": ["Administração", "Controle de Acesso", "Listagens"],
        "Recursos": ["Gráficos", "Dashboards"],
        "Financeiro": ["Títulos a Pagar", "Títulos a Receber", "Caixas e Bancos", "Notas Fiscais", "Configurações", "Relatórios", "Orçamento", "Cadastros Básicos"],
        "Transporte": ["Documentos", "Conhecimentos", "Manifesto de Carga", "Ordem de Carregamento", "Contrato de Frete", "Veículos", "Configurações", "Relatórios", "EDI", "Cotação de Frete", "Vinculação de Motoristas", "Conjuntos de Veículos"],
        "Estoque": ["Movimentação Estoque", "Relatórios", "Configurações", "Solicitação interna de compra"],
        "Pessoas": ["Pessoas"],
        "Ordens de Serviço": [],
        "Manutenção": ["Abastecimentos", "Pneus", "Relatórios", "Configurações"],
        "Configurações": ["Cadastros Básicos"],
        "eDoc": ["Certificados Digitais"],
        "E-mail": [],
        "Hub": [],
        "Controle de Viagens": [],
        "nsdocs": []
    },

    primeiros_passos: [
        "1. Instalar certificado digital: eDoc > Certificados Digitais",
        "2. Criar talões de documentos: Transporte > Configurações > Tipos de talões"
    ],

    documentos_principais: {
        "CT-e": { nome_completo: "Conhecimento de Transporte Eletrônico", emissao: "Transporte > Documentos > Ct-e OU Transporte > Conhecimentos", cancelamento_sefaz: "Selecionar o CT-e > Ícone SEFAZ (CT-e) > Cancelar na SEFAZ", funcionalidades_relacionadas: ["CIOT", "Vale-Pedágio Avulso", "Ocorrência automática"] },
        "MDF-e": { nome_completo: "Manifesto de Carga Fiscal Eletrônico", emissao: "Transporte > Manifesto de Carga", cancelamento_sefaz: "Selecionar o MDF-e > Ícone SEFAZ (MDF-e) > Cancelar na SEFAZ" },
        "NF-e": { nome_completo: "Nota Fiscal Eletrônica", emissao: "Financeiro > Notas Fiscais > Notas Fiscais" },
        "NFS-e": { nome_completo: "Nota Fiscal de Serviço Eletrônica", emissao: "Financeiro > Notas Fiscais > Notas Fiscais" },
        "OC": { nome_completo: "Ordem de Carregamento", emissao: "Transporte > Ordem de Carregamento Simplificada" },
        "Minuta": { nome_completo: "Conhecimento não fiscal", emissao: "Transporte > Documentos" }
    },

    caminhos_rapidos: {
        "Veículos": "Transporte > Veículos", "Motoristas": "Pessoas > Pessoas", "Clientes": "Pessoas > Pessoas",
        "Fornecedores": "Pessoas > Pessoas", "Seguradora": "Pessoas > Pessoas", "Transportadora": "Pessoas > Pessoas",
        "Proprietários Veículos": "Pessoas > Pessoas", "Natureza da Operação/CFOP": "Financeiro > Fiscal > Tipos de Operações",
        "Apólice de Seguro": "Transporte > Configurações > Apólices de Seguro", "NF-e Pré-cadastrada": "Transporte > NF-e Pré-cadastrada",
        "Regra": "Transporte > Configurações > Regras", "Tabela de preços": "Transporte > Configurações > Tabela de Preços > Tabela de Preços",
        "Parâmetros do sistema": "Ambiente > Administração > Parâmetros", "Funcionalidades do sistema": "Ambiente > Controle de Acesso > Funcionalidades",
        "Parâmetros EDI": "Transporte > EDI > Parâmetros", "Relatório personalizado": "Transporte > EDI > Assistente de Relatórios",
        "Importação/Exportação documentos": "Transporte > EDI > Importação/Exportação",
        "CIOT": "Transporte > Documentos > Ct-e > selecionar > Contrato de frete Eletrônico",
        "VPO/Vale pedágio": "Transporte > Documentos > Ct-e > selecionar > Vale-Pedágio Avulso",
        "Tipos Valores Outros (CT-e)": "Transporte > Configurações > Tipos Valores Outros",
        "Tabela de preços Valores Outros": "Transporte > Configurações > Tabela de Preços > Tabela de Preços Valores Outros",
        "Regras Importação Notas": "Financeiro > Configurações > Fiscal > Regras de Importação de Notas",
        "Classificação Fiscal": "Financeiro > Configurações > Fiscal > Classificação Fiscal",
        "Configurações OC PDF": "Transporte > Configurações > Documentos PDF > Configurações de Ordem de Carregamento",
		"Contrato de frete PDF": "Transporte>Configurações>Documentos PDF>Configurações de Modelos de Contrato de Frete",
		"Ct-e/Conhecimento (Dacte)": "Transporte>Configurações>Documentos PDF>Configurações de Impressão do DACTE",
		"Manifesto de Carga/Mdf-e": "Transporte>Configurações>Documentos PDF>Configurações de Manifesto de Carga",
		"Faturamento": "Transporte>Configurações>Documentos PDF>Configurações de Faturamento",
        "Modelos de notas": "Financeiro > Configurações > Fiscal > Modelos de notas",
        "Contratos Operadoras Crédito": "Transporte > Configurações > Contratos com Operadoras de Crédito",
        "Usuários do Sistema": "Ambiente > Controle de Acesso > Usuários do Sistema",
        "Remetente e-mails": "Ambiente > Administração > Remetente e-mails",
        "Abastecimentos": "Manutenção > Abastecimentos", "Relatório abastecimento": "Manutenção > Relatórios > Relação de Abastecimentos",
        "Recapagens": "Manutenção > Pneus > Recapagens", "Títulos a Pagar": "Financeiro > Títulos a Pagar > Títulos a Pagar",
        "Títulos a Receber": "Financeiro > Títulos a Receber > Títulos a Receber",
        "Consulta Lançamentos": "Financeiro > Caixas e Bancos > Consulta Lançamentos",
        "Espécies": "Transporte > Configurações > Espécies", "Unidades": "Configurações > Cadastros Básicos > Unidades",
        "Produtos": "Financeiro > Configurações > Produtos e Serviços > Produtos",
        "Serviços": "Financeiro > Configurações > Produtos e Serviços > Serviços",
        "Centros de Custo": "Financeiro > Configurações > Centros de Custo",
        "Contas Financeiras": "Financeiro > Configurações > Contas Financeiras",
        "Plano de Contas Gerencial": "Financeiro > Configurações > Plano de Contas Gerencial",
        "Pagamento": "Financeiro > Caixa e Bancos > Pagamento", "Recebimento": "Financeiro > Caixa e Bancos > Recebimento",
        "Transferências": "Financeiro > Caixas e Bancos > Transferências", "Orçamento": "Financeiro > Orçamento > Orçamento",
        "Comissões motoristas": "Transporte > Relatórios > Comissões dos motoristas",
        "Contratos de Frete (relatório)": "Transporte > Relatórios > Relatório de Contratos de Frete",
        "Conciliação Bancária": "Financeiro > Caixa e Bancos > Conciliação Bancária",
        "Movimentação Estoque": "Estoque > Movimentação Estoque", "Solicitação interna compra": "Estoque > Solicitação interna de compra"
    },

    taloes_configuracoes: [
        "Os talões ficam em: Transporte > Configurações > Tipos de talões",
        "Cada tipo de documento (CT-e, MDF-e, OC, Contrato de Frete, NFS-e, Pedidos) tem seu próprio talão",
        "Dentro do talão é possível configurar: numeração, série, ambiente (homologação/produção), ocorrência automática, campos obrigatórios, etc.",
        "Para gerar ocorrência automática no CT-e: editar o talão do CT-e e habilitar a opção 'ocorrência automática'"
    ],

    regras_gerais: [
        "Para problemas de SEFAZ, verifique a conexão com a internet e o status da SEFAZ",
        "Para erros de validação, revise todos os campos obrigatórios do documento",
        "O sistema possui busca rápida no menu lateral (campo de pesquisa no topo)"
    ]
};
