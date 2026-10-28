/* js/app/sistema-bsoft.js — Estrutura do Bsoft TMS (menus, documentos, atalhos) usada como contexto da IA.
   O MENU COMPLETO e fiel ao sistema fica em config/menu-bsoft.js (lido por js/app/menu-bsoft.js): é ele que responde "onde fica a tela X".
   Aqui ficam só o que o menu não diz: os documentos principais, os primeiros passos e os ATALHOS — nomes do dia a dia ("Motoristas",
   "Natureza da operação/CFOP") que apontam para a tela certa, e procedimentos que passam por dentro de uma tela (CIOT, Vale-Pedágio).
   Todo caminho de menu escrito aqui é conferido contra o menu real por teste automático (veja o README, seção "Menu real do sistema"). */
// ═══════════════════════════════════════════════════════════
//  CONSTANTE: ESTRUTURA DO SISTEMA BSOFT TMS
// ═══════════════════════════════════════════════════════════
const SISTEMA_BSOFT_TMS = {
    descricao: "Bsoft TMS é um sistema ERP completo para gestão de transportadoras, logística e emissão de documentos fiscais eletrônicos.",

    // Resumo do menu (módulos › pastas), usado só se o menu completo (config/menu-bsoft.js) não carregar. Fiel ao menu real capturado em 21/10/2026.
    estrutura_menus: {
        "Opções do Sistema": ["Atualizações", "Atualizar Permissões", "Auditoria", "Central de Ajuda", "Central de Segurança", "Painéis de Gestão", "Preferências", "Suporte", "Vídeo Aulas"],
        "Ambiente": ["Administração", "Alertas", "Controle de Acesso", "Estrutura", "Implantação", "Impressão", "Relatórios", "Integrações", "API Gateway"],
        "Recursos": [], "LogIn": ["Despachos Aduaneiros", "Configuração", "Histórico Documentos"],
        "Financeiro": ["Cadastros Básicos", "Configurações", "Caixa e Bancos", "Títulos a Pagar", "Títulos a Receber", "Integração Contábil", "Notas Fiscais", "Orçamento", "Relatórios", "Serviços Realizados", "EDI"],
        "Transporte": ["Configurações", "Relatórios", "Sintegra", "EDI", "Documentos", "Dashboards"],
        "Estoque": ["Configurações", "Relatórios", "Requisição de empenho", "Pedidos", "Volumes", "Programações"],
        "Pessoas": ["Relatórios", "Cadastros"], "CRM": [], "Ordens de Serviço": ["Configurações", "Relatórios"],
        "Manutenção": ["Configurações", "Relatórios", "Pneus", "Multas", "Dashboards"],
        "Banco de CEPs": [], "Configurações": ["Impressão", "Cadastros Básicos", "Terminais"], "BLs": [],
        "eDoc": ["Sped", "Relatórios"], "E-mail": [], "Painel": [], "Hub": [], "Portaria": ["Configurações", "Acessos", "Relatórios"],
        "Checklists": ["Dashboard"], "Controle de Viagens": ["Configurações", "Relatórios", "Dashboards"], "nsdocs": ["Relatórios", "Downloads"],
        "Apoio Contábil": ["Integração Contábil", "Integração Fiscal"]
    },

    primeiros_passos: [
        "1. Instalar certificado digital: eDoc > Certificados Digitais",
        "2. Criar talões de documentos: Transporte > Configurações > Tipos de Talões"
    ],

    documentos_principais: {
        "CT-e": { nome_completo: "Conhecimento de Transporte Eletrônico", emissao: "Transporte > Documentos > CT-e OU Transporte > Conhecimentos", cancelamento_sefaz: "Selecionar o CT-e > Ícone SEFAZ (CT-e) > Cancelar na SEFAZ", funcionalidades_relacionadas: ["CIOT", "Vale-Pedágio Avulso", "Ocorrência automática"] },
        "MDF-e": { nome_completo: "Manifesto de Carga Fiscal Eletrônico", emissao: "Transporte > Manifesto de Carga OU Transporte > Documentos > MDF-e", cancelamento_sefaz: "Selecionar o MDF-e > Ícone SEFAZ (MDF-e) > Cancelar na SEFAZ" },
        "NF-e": { nome_completo: "Nota Fiscal Eletrônica", emissao: "Financeiro > Notas Fiscais > Notas Fiscais" },
        "NFS-e": { nome_completo: "Nota Fiscal de Serviço Eletrônica", emissao: "Transporte > Documentos > NFS-e OU Financeiro > Notas Fiscais > Notas Fiscais" },
        "OC": { nome_completo: "Ordem de Carregamento", emissao: "Transporte > Ordem de Carregamento Simplificada OU Transporte > Ordem de Carregamento" },
        "Minuta": { nome_completo: "Conhecimento não fiscal", emissao: "Transporte > Documentos (pasta com CRT, CT-e, DC-e, MDF-e, MIC e NFS-e; a Minuta não tem item próprio no menu: siga o artigo do manual)" }
    },

    // ATALHOS: nome do dia a dia → tela. Cada caminho está no menu real (conferido por teste). Os que passam por dentro de uma tela ficam em "procedimentos".
    caminhos_rapidos: {
        "Veículos": "Transporte > Veículos", "Motoristas": "Pessoas > Pessoas", "Clientes": "Pessoas > Pessoas",
        "Fornecedores": "Pessoas > Pessoas", "Seguradora": "Pessoas > Pessoas (dados específicos da seguradora: Pessoas > Dados Seguradora)", "Transportadora": "Pessoas > Pessoas",
        "Proprietários Veículos": "Pessoas > Pessoas",
        "Natureza da Operação/CFOP": "Financeiro > Configurações > Fiscal > Tipos de Operações (no Transporte também existe: Transporte > Configurações > Tipos de operações)",
        "Apólice de Seguro": "Transporte > Configurações > Apólices de Seguro", "NF-e Pré-cadastrada": "Transporte > NF-e Pré-cadastrada",
        "Regra": "Transporte > Configurações > Regras", "Tabela de preços": "Transporte > Configurações > Tabelas de Preços > Tabela de Preços",
        "Parâmetros do sistema": "Ambiente > Administração > Parâmetros", "Funcionalidades do sistema": "Ambiente > Controle de Acesso > Funcionalidades",
        "Parâmetros EDI": "Transporte > EDI > Parâmetros", "Relatório personalizado (arquivo .dat do Assistente de Relatórios)": "Transporte > EDI > Assistente de Relatórios", "Relatórios personalizados (lista do Ambiente)": "Ambiente > Relatórios personalizados",
        "Importação/Exportação documentos": "Transporte > EDI > Importação/Exportação",
        "Tipos Valores Outros (CT-e)": "Transporte > Configurações > Tipos Valores Outros",
        "Tabela de preços Valores Outros": "Transporte > Configurações > Tabelas de Preços > Tabela de preços Valores Outros",
        "Regras Importação Notas": "Financeiro > Configurações > Fiscal > Regras de importação de notas",
        "Classificação Fiscal": "Financeiro > Configurações > Fiscal > Classificação Fiscal",
        "Configurações OC PDF": "Transporte > Configurações > Documentos PDF > Configurações de Ordem de Carregamento",
        "Contrato de frete PDF": "Transporte > Configurações > Documentos PDF > Configurações de Modelos de Contrato de Frete",
        "Ct-e/Conhecimento (Dacte)": "Transporte > Configurações > Documentos PDF > Configurações de Impressão do DACTE",
        "Manifesto de Carga/Mdf-e (PDF)": "Transporte > Configurações > Documentos PDF > Configurações de Manifesto de Carga",
        "Faturamento (PDF)": "Transporte > Configurações > Documentos PDF > Configurações de Faturamento",
        "Modelos de notas": "Financeiro > Configurações > Fiscal > Modelos de Notas",
        "Contratos Operadoras Crédito": "Transporte > Configurações > Contratos com Operadoras de Crédito",
        "Usuários do Sistema": "Ambiente > Controle de Acesso > Usuários do Sistema",
        "Remetente e-mails": "Ambiente > Administração > Remetente e-mails",
        "Abastecimentos": "Manutenção > Abastecimentos", "Relatório abastecimento": "Manutenção > Relatórios > Relação de Abastecimentos",
        "Recapagens": "Manutenção > Pneus > Recapagens", "Títulos a Pagar": "Financeiro > Títulos a Pagar > Títulos a Pagar",
        "Títulos a Receber": "Financeiro > Títulos a Receber > Títulos a Receber",
        "Consulta Lançamentos": "Financeiro > Caixa e Bancos > Consulta de Lançamentos",
        "Espécies": "Transporte > Configurações > Espécies", "Unidades": "Configurações > Cadastros Básicos > Unidades",
        "Produtos": "Financeiro > Configurações > Produtos e Serviços > Produtos",
        "Serviços": "Financeiro > Configurações > Produtos e Serviços > Serviços",
        "Centros de Custo": "Financeiro > Configurações > Centros de Custo",
        "Contas Financeiras": "Financeiro > Configurações > Contas Financeiras",
        "Plano de Contas Gerencial": "Financeiro > Configurações > Plano de Contas Gerencial",
        "Pagamento": "Financeiro > Caixa e Bancos > Pagamento", "Recebimento": "Financeiro > Caixa e Bancos > Recebimento",
        "Transferências": "Financeiro > Caixa e Bancos > Transferências", "Orçamento": "Financeiro > Orçamento > Orçamento",
        "Comissões motoristas": "Transporte > Relatórios > Comissionamento", "Comissões motoristas (Manutenção)": "Manutenção > Relatórios > Relatório de Comissões",
        "Contratos de Frete (relatório)": "Transporte > Relatórios > Relatório de Contratos de Frete",
        "Conciliação Bancária": "Financeiro > Caixa e Bancos > Conciliação Bancária",
        "Movimentação Estoque": "Estoque > Movimentação Estoque", "Solicitação interna compra": "Estoque > Solicitação interna de compra",
        "Certificado digital": "eDoc > Certificados Digitais", "Talões": "Transporte > Configurações > Tipos de Talões"
    },

    // Procedimentos que passam por DENTRO de uma tela (o início do caminho é do menu; o resto é o que se faz na tela do documento)
    procedimentos: {
        "CIOT (emitido pelo CT-e; as telas CIOT Frota Própria e CIOT Automático ficam direto em Transporte)": "Transporte > Documentos > CT-e > selecionar o CT-e > Contrato de frete Eletrônico",
        "VPO/Vale pedágio": "Transporte > Documentos > CT-e > selecionar o CT-e > Vale-Pedágio Avulso"
    },

    taloes_configuracoes: [
        "Os talões ficam em: Transporte > Configurações > Tipos de Talões",
        "Cada tipo de documento (CT-e, MDF-e, OC, Contrato de Frete, NFS-e, Pedidos) tem seu próprio talão",
        "Dentro do talão é possível configurar: numeração, série, ambiente (homologação/produção), ocorrência automática, campos obrigatórios, etc.",
        "Para gerar ocorrência automática no CT-e: editar o talão do CT-e e habilitar a opção 'ocorrência automática'"
    ],

    regras_gerais: [
        "Para problemas de SEFAZ, verifique a conexão com a internet e o status da SEFAZ",
        "Para erros de validação, revise todos os campos obrigatórios do documento",
        "O sistema possui busca rápida no menu lateral (campo de pesquisa no topo)",
        "Muitas opções e ações do sistema só funcionam, ou só aparecem na tela, depois que um PARÂMETRO (Ambiente > Administração > Parâmetros) ou uma FUNCIONALIDADE (Ambiente > Controle de Acesso > Funcionalidades) é habilitado; depois de alterar, vale atualizar as permissões (Opções do Sistema > Atualizar Permissões). Quando a seção PARÂMETROS E FUNCIONALIDADES RELACIONADOS trouxer um item que condiciona o assunto da pergunta, ele vem no INÍCIO da resposta, antes do passo a passo (regra 9)"
    ]
};
