/* ═══════════════════════════════════════════════════════════════════════════
   MENU REAL DO BSOFT TMS  (config/menu-bsoft.js)

   É a árvore COMPLETA do menu lateral do sistema (módulos › pastas › telas), copiada do próprio sistema. A IA consulta este menu a cada
   pergunta para dizer o caminho de cada tela — por isso ele precisa ser fiel ao menu de verdade.
   Cada linha:   + Pasta      - Tela  {id da rotina}      (2 espaços de recuo por nível; o {id} é o "Nome Interno" da rotina e liga a tela ao link c.php?id=…)

   COMO ATUALIZAR (quando o menu do sistema mudar): abra o Bsoft no Chrome, aperte F12 › Console, cole o conteúdo de tools/capturar-menu.js e
   aperte Enter — o menu inteiro é copiado. Cole no lugar do texto abaixo (entre as duas crases) e suba o arquivo no GitHub. Detalhes no README.

   Capturado em 21/10/2026 do ambiente de teste (usuário "suporte"). O menu que cada cliente vê pode ter menos módulos/telas, conforme as
   permissões do usuário e os módulos contratados.
   ═══════════════════════════════════════════════════════════════════════════ */
window.BSOFT_MENU_TXT = String.raw`
+ Opções do Sistema
  - Atualizações
  - Atualizar Permissões
  - Auditoria  {ambiente_auditoria}
  - Central de Ajuda
  - Central de Segurança
  - Deixe aqui sua opinião!
  - Painéis de Gestão
  - Preferências
  - Suporte
  - Vídeo Aulas
  - Catálogo Sisweb
+ Ambiente
  + Administração
    + Central de avisos
      - Central de avisos  {ambiente_centralAvisos}
    - Consulta de logs  {ambiente_logs}
    - Dados formulários  {ambiente_dadosFormulario}
    - Download de logs  {ambiente_downloadLogs}
    - Envio de documentos  {ambiente_envioDoc}
    - Logotipo da área  {ambiente_logotipo}
    - Parâmetros  {ambiente_parametros}
    - Remetente e-mails  {ambiente_remetentes}
  + Alertas
    - Alertas  {ambiente_alertas}
    - Tipos de Alertas  {ambiente_tipos_alertas}
  + Controle de Acesso
    - Funcionalidades  {ambFuncionalidades}
    - Grupos de Usuários  {grupos_usuarios}
    - Parâmetros do usuário  {ambiente_parametrosUsuariosGeral}
    - Permissão as rotinas  {permissoes_usuarios_rotinas}
    - Permissões as rotinas  {permissoes_grupos_usuarios_rotinas}
    - Usuários  {usuarios}
    - Usuários do Sistema  {ambiente_usuariosSistema}
  + Estrutura
    + Módulos
      - Módulos por empresa  {ambiente_modulos_empresas}
    - Categorias de Parâmetros  {ambiente_categoriasParametros}
    - Configurações  {ambiente_configuracoes_projetos}
    - Grupos de Rotinas  {grupos_rotinas}
    - Pastas  {pastas}
    - Projetos  {projetos}
    - Rotinas  {rotinas}
  + Implantação
    - Envio Manual para a SEFAZ  {ambiente_teste_envio_sefaz}
  + Impressão
    - Spools  {ambiente_spools}
  + Relatórios
    - Relatório mensal para gestores  {ambiente_form_rel_mensalParaGestores}
  + Integrações
    - Dados App  {ambiente_integracoesDadosApp}
    - Integrações  {ambiente_integracoes}
  + API Gateway
    - Rotas  {ambiente_rotas}
  - Auditoria  {ambiente_auditoria}
  - Campos personalizados das rotinas genéricas  {ambiente_camposPersonalizadosRotinasGenericas}
  - Consultas SQL  {ambiente_cadConsultas}
  - Controle de Concorrência  {ambiente_estrutura_redis}
  - Credenciais  {ambiente_credenciais}
  - Espelhos Personalizados  {ambiente_espelhos_personalizados}
  - Gestão de Filas  {ambiente_gestaoFilas}
  - Histórico alterações de registros  {ambiente_historicoAlteracaoRegistros}
  - Histórico da Integração QualP  {ambiente_historico_integracoes}
  - Histórico de Envio de Documentos  {ambiente_historicoEnvioDocumentos}
  - Listagens  {ambiente_listagens}
  - Meu Plano  {ambiente_meu_plano}
  - Perfis de autorizações  {ambiente_perfilAutorizacao}
  - Pré-autorizações  {ambiente_preAutorizacoes}
  - Relatórios  {ambiente_relatorioConsultasSQL}
  - Relatórios personalizados  {ambiente_relatoriosCustomizados}
  - Relatórios Rápidos  {ambiente_relatoriosRapidos}
+ Recursos
  - Log Horas Trabalhadas  {rec_menuLogHorasTrabalhadas}
  - Recursos  {rec_recursos}
+ LogIn
  + Despachos Aduaneiros
    + Cadastros Básicos
      - Agenda Navios / Portos  {login_agendaNaviosPortos2}
      - Cidades  {login_cidades}
      - Navios  {login_navios}
      - Países  {login_paises}
      - Terminais  {despTerminais}
    - Cadastro de Operações  {desp_cadastroOperacoes}
  + Configuração
    - Moedas  {login_moedas}
    - Tipos de Processos  {login_tipos_processo}
  + Histórico Documentos
    - Histórico Prestação de Contas  {login_historicoPrestacaoContas}
+ Financeiro
  + Cadastros Básicos
    - Bancos  {finan_bancos}
    - CNAE  {cad_CNAE}
    - Condições de Pagamento  {finan_cond_pgto}
    - Empresas  {finan_empresas}
    - Modelos de Cobrança  {finan_modelosCobranca}
    - Tipos de Contas Financeiras  {finan_tipos_de_contas_financeiras}
    - Tipos de Documentos  {finan_tipos_de_documentos}
    - Tipos de Pagamentos  {finan_tiposPagamentos}
    - Tipos de Recibos  {finan_tiposRecibos}
    - Tipos de Sinalizadores  {finan_tiposSinalizadores}
    - Tipos de Transações  {finan_tiposTransacoes}
  + Configurações
    + Fiscal
      - Alíquotas de CBS e IBS  {finan_aliquotas_cbs_ibs}
      - CFOP x Acumuladores Domínio  {finan_naturezaOperacaoAcumulador}
      - Classificação Fiscal  {finan_classificacoes_fiscais}
      - Classificação Fiscal - CBS e IBS  {finan_classificacao_fiscal_cbs_ibs}
      - Modelos de Notas  {finan_modelos_notas}
      - Observações Notas Fiscais  {finan_observacoes_notas_fiscais}
      - Produtos relacionados  {finan_classificacaoFiscalCbsIbsProdutos}
      - Regras de importação de notas  {finan_regrasImportacaoNotas}
      - Tipos de Operações  {finan_naturezas_operacao}
    + Produtos e Serviços
      - Conversões medidas  {finan_conversoesMedidas}
      - Embalagens  {est_embalagens}
      - Família Produtos Serviços  {finan_familia_produtos_servicos}
      - Lista de Preços  {finan_listaPrecos}
      - Produtos  {produtos}
      - Propriedades dos Produtos  {finan_propriedades_dos_produtos}
      - Serviços  {finan_servicos}
    - Bloqueio de contas financeiras  {finan_bloqueioContasFinanceiras}
    - Bloqueio de Movimentações Financeiras  {finan_bloqueisMovimentacoes}
    - Bloqueio Tipo Lançamento  {finan_bloqueioTiposLancamentos}
    - Centros de Custo  {finan_centros_de_custo}
    - Contas Financeiras  {finan_contas_financeiras}
    - Domínios  {finan_dominios}
    - Formas de Contato  {formaContato}
    - Formas de Pagamento  {finan_convenios}
    - Grupos Contas Financeiras  {finan_grupos_contas_financeiras}
    - Grupos de Entrada e Saída Gerencial  {finan_grupos_entrada_saida_gerencial}
    - Instruções de Boleto  {finan_cadastroInstrucoesBoletos}
    - Modelos de Histórico  {finan_modelosHistorico}
    - Padrão Impostos  {finan_padraoImpostos}
    - Plano de Contas Fiscal  {finan_plano_contas_fiscal}
    - Plano de Contas Fiscal Manual  {finan_planoContasFiscalManual}
    - Plano de Contas Gerencial  {finan_plano_contas_gerencial}
    - Rateios  {finan_rateios}
    - Regras de Automatização para NF-e Recebidas  {finan_regrasAutomatizarNFRecebidas}
    - Tipos de Protesto  {tipoProtesto}
  + Caixa e Bancos
    + Convênios
      - Arquivos Remessa  {finan_historicoArquivosRemessa}
      - Arquivos Retorno  {finan_arquivosRetornos}
      - Arquivos Retorno - Operadoras de Crédito  {transp_retornoRodocred}
      - Envio de cobranças  {finan_envioCobrancas}
      - Gerador de Boletos  {finan_boletosEmMassa}
      - Histórico de Cobranças  {finan_historico_cobranca}
    + Suprimentos de Fundos
      - Abertura de Suprimentos  {finan_aberturaSuprimentos}
      - Fechamento de Suprimento  {finan_fechamentoSuprimentos}
    + Cheques
      - Cheques Avulsos  {finan_cheques_avulsos}
      - Cheques Cancelados  {cheques}
      - Impressão de Cheques  {finan_impressao_de_cheques}
    - Adiantamento a fornecedores  {finan_adiantamento_fornecedores}
    - Adiantamento de clientes  {finan_adiantamento_clientes}
    - Arquivos Importados via Conciliação Bancaria  {finan_lancamentosArquivosImportacao}
    - Conciliação Bancária  {finan_conciliacao_bancaria_api}
    - Conciliação Bancária - OFX  {finan_conciliacaoBancaria}
    - Consulta de Lançamentos  {finan_consulta_lancamentos}
    - Pagamento  {financeiro_pagamento}
    - Recebimento  {financeiro_recebimento}
    - Recibos Impressos  {finan_recibos_impressos_externo}
    - Remessa de Lançamentos da Conta Digital  {finan_remessa_pagamento_conta_digital}
    - Remessa de Pagamentos  {finan_remessaPagamento}
    - Transferências  {finan_transferencia}
    - Transferências Gerenciais  {finan_transferencias_gerenciais}
  + Títulos a Pagar
    - Geração de Faturas  {finan_gerar_faturas_folha_dominio}
    - Liberações de Pagamentos  {finan_liberacoesPagamento}
    - Lotes a Pagar  {finan_lotesTitulosPagar}
    - Lotes/Duplicatas a Pagar  {finan_lotesDuplicatasPagar}
    - Múltiplas faturas  {finan_multiplasFaturas}
    - Renegociação - pagar  {finan_renegociacaoFinanceiraPagar}
    - Retenções das Faturas  {finan_retencoes_faturas}
    - Títulos a Pagar  {finan_faturas_pagar}
  + Títulos a Receber
    - Eventos de cobrança  {finan_eventosDeCobranca}
    - Geração de Faturas  {finan_gerar_faturas_receber_em_massa}
    - Lotes a Receber  {finan_lotesTitulosReceber}
    - Lotes/Duplicatas a Receber  {finan_lotesDuplicatasReceber}
    - Renegociação - receber  {finan_renegociacaoFinanceira}
    - Títulos a Receber  {finan_faturas_receber}
  + Integração Contábil
    - Integração Contábil  {finan_rel_int_contabil_listagem}
    - Integração Contábil (Geração de Arquivo)  {finan_extrato_fiscal_ler_dados}
    - Mapa Integração Contábil  {finan_mapaIntegracaoContabil}
  + Notas Fiscais
    - Abastecimentos  {manutencao_notas_fiscais_multiplos_abastecimentos}
    - Coleta de seriais / lotes  {est_coletaSeriais}
    - Exportar ISS  {finan_exportarISS}
    - Histórico de Regras Aplicadas na Importação de NF-e e CT-e  {finan_historico_regras_aplicadas_importacao_nfe}
    - Importar NFS  {finan_importarNFS}
    - Impressão Notas Fiscais em Lote  {finan_impressaoNotasFiscaisLotes}
    - Notas Fiscais  {finan_cadastro_notas_fiscais}
  + Orçamento
    - Orçamento  {finanOrc_orcamento}
  + Relatórios
    + Movimentação Financeira
      - Contas a pagar  {finan_rel_documentosPagarFormulario}
      - Contas a receber  {finan_rel_documentosReceberFormulario}
      - Extrato Bancário  {finan_rel_extrato_bancario_ler_dados}
      - Livro Caixa  {finan_rel_livro_caixa_ler_dados}
      - Movimento Resumido  {finan_rel_movimento_resumido_ler_dados}
      - Relação de Cheques  {finan_rel_relacao_cheques_ler_dados}
      - Relatório de Descontos e Acréscimos  {finan_descontos_acrescimos}
      - Relatório de Transferências  {finan_form_rel_transferencias}
    + Gerenciais
      - 12 Meses Gerencial Competência  {finan_rel_gerencialCompetenciaForm}
      - 12 Meses Gerencial Demonstrativo  {finan_rel_gerencialDemonstrativoForm}
      - Disponibilidade Financeira  {finan_rel_disponibilidade_financeira_ler_dados}
      - Extrato da Apropriação  {finan_relatorio_apropriacao_formulario}
      - Fluxo de Caixa  {finan_relatorios_relatorioDinamico_form}
      - Gerencial por Conta  {finan_rel_gerencial_conta_ler_dados}
      - Gerencial por Conta Competência  {finan_relatorio_gerencialContaCompetencia_formulario}
      - Razão do Cliente/Fornecedor  {finan_razao_cliente_fornecedor_ler_dados}
    - Eventos de cobranças  {finan_relatorio_eventosCobranca_formulario}
    - Recebimento  {finan_recebimento_form}
    - Recibos Impressos  {finan_form_rel_recibosImpressos}
    - Relação de Pagamentos Realizados  {finan_relatorio_relacaoPagamentoRealizado_formulario}
    - Relatório de Lista de Preços  {finan_relatorio_listaPrecos_formulario}
    - Relatório de Notas Fiscais  {finan_relatorio_faturamento_ler_dados}
    - Relatório de Notas Fiscais PDF  {finan_rel_notasFiscaisPdf_form}
    - Relatório de Orçamento  {finan_relatorioOrcamentoFormulario}
    - Resumo Cobranças  {finan_relatorios_resumoCobrancasForm}
    - Tempo Médio Pagamento & Recebimento  {finan_relatorio_tempoMedioPagReceb_form}
  + Serviços Realizados
    - Cadastro de Operações  {desp_cadastroOperacoes}
    - Faturamento Central de Fretes  {finan_fatSolicitacoesServicos}
    - Faturamento Serviços Realizados  {finan_faturamentoServicosRealizados}
    - Serviços Realizados  {finan_servicosRealizados}
  + EDI
    - EDI Financeiro  {finan_ediFinanceiro}
  - Lotes a Receber  {finan_lotesTitulosReceber2}
  - Recibo Motorista  {login_relatorio_extrato_processo_recibo}
  - Regras para conciliação financeira  {finan_regrasConciliacaoBancaria}
+ Transporte
  + Configurações
    + Cadastros Básicos
      - Categorias de Tipo de Documento  {categoriaTipoDocumento}
      - Tipos de Operações dos Pedidos  {tipoOperacao}
      - Tipos de Rastreador  {tipoRastreador}
    + Documentos PDF
      - Configurações de Etiquetas de Conhecimento  {transp_configEtiquetasConhecimento}
      - Configurações de Faturamento  {transp_configuracoesFaturamentoPdf}
      - Configurações de Impressão do DACTE  {transp_configuracoes_impressao_dacte}
      - Configurações de Manifesto de Carga  {transp_configuracaoManifestoCargaPDF}
      - Configurações de Modelos de Contrato de Frete  {transp_modelos_configuracoes_contrato_frete_pdf}
      - Configurações de Ordem de Carregamento  {transp_configuracaoOrdemCarregamentoPdf}
      - Etiquetas NF-e Pré-cadastrada  {transp_config_etiquetas_notas_carregamento_pdf}
    + Tabelas de Preços
      - Tabela de Pagamento de Frete  {transp_tabelaPagFrete}
      - Tabela de preços  {transp_gruposClientes}
      - Tabela de Preços  {transp_tabelaPrecos}
      - Tabela de preços Valores Outros  {tabelaPrecosValoresOutros}
    - Agências  {trans_agencias}
    - Alíquotas de CBS e IBS  {finan_aliquotas_cbs_ibs}
    - Alíquotas internas do ICMS  {transp_aliquotaInternaICMS}
    - Alíquotas ISS x Municípios  {transp_aliquotaISSMunicipios}
    - Alíquotas Padrões de ICMS  {transp_aliquotasICMS}
    - Apólices de Seguro  {trans_apolicesSeguro}
    - Categorias de Veículos  {trans_categoriasVeiculos}
    - Cláusulas - Contrato Afretamento  {transp_clausulasPadraoContratoReciboFrete}
    - Configuração CIOT Automático  {transp_configuracoes_ciot_automatico}
    - Configuração Padrão QualP  {transp_configuracao_qualp}
    - Configurações Cotações de Frete  {transp_configuracoesCotacaoFrete}
    - Contratos com Operadoras de Crédito  {transp_operadoraCredito}
    - Definições de títulos a partir de GNRE  {transp_definicoes_geracao_titulos_pagar}
    - Definições dos valores do Pagamento do Frete do MDF-e  {transp_definicoes_pagamento_frete_mdfe}
    - Documentos dos Conhecimentos  {transp_documentosConhecimentos}
    - Documentos dos Veículos  {transp_documentosDosVeiculos}
    - Domínios  {transp_dominios}
    - Espécies  {trans_especies}
    - Exceções ICMS, CBS/IBS e CST  {transp_excecoes_icms_cst}
    - Grupos de Ocorrências  {transp_gruposOcorrencias}
    - Grupos de Veículos  {transp_gruposVeiculos}
    - Índices Seguros  {transp_indiceSeguros}
    - Informações de cobrança padrão  {transp_informacoesCobrancaPadraoEmpresa}
    - Marcas  {trans_marcas}
    - Marcas de Veículos  {trans_marcasVeiculos}
    - Natureza de Cargas  {trans_natureza}
    - Parâmetros criação de Manifesto  {transp_parametrosCriacaoMDFe}
    - Parâmetros de criação de CT-e a partir de NF-e  {transp_paramCriaCteViaNFe}
    - Parâmetros de criação de CT-e a partir de um CT-e  {transp_param_cria_cte_via_cte}
    - Percursos  {transp_rotasManifesto}
    - Perfis de apropriação  {transp_perfisApropriacao}
    - Perfis de Serviços  {transp_perfilServicos}
    - Personalização de campos do conhecimento  {trans_personalizacao_campos_conhecimento}
    - Plataformas de Rastreamento de Cargas  {transp_config_plataformas_rastreamento_cargas}
    - Regras  {trans_regrasConhecimentos}
    - Regras de Isenções e Exceções ICMS  {transp_regras_isencoes_excecoes_icms}
    - Requisições à gerenciadora  {transp_requisicoesGerenciadoraRiscos}
    - Rotas de distribuição  {transp_rotasDistribuicao}
    - Serviços Executar  {transp_servicosExecutar}
    - Sinalizadores  {transp_sinalizadores}
    - Sistemas de Gerenciadoras de Risco  {sistemaGerenciadorasRisco}
    - Status dos Pedidos TMS  {trans_statusPedidos}
    - Tags CT-e  {transp_tagsCTe}
    - Tipos de Agrupadores para NF-es pré-cadastradas  {transp_tiposAgrupadoresNfePreCadastrada}
    - Tipos de Bloqueios  {transp_configuracoesTiposBloqueios}
    - Tipos de Cargas ANTT  {transp_tiposCargasANTT}
    - Tipos de Despesas Extras  {transp_tiposDespesasExtras}
    - Tipos de Documentos  {transp_tiposDocumentos}
    - Tipos de Manifestos de Carga  {transp_tiposManifesto}
    - Tipos de Naturezas de Cargas  {trans_tipoNatureza}
    - Tipos de Ocorrências  {transp_tiposOcorrencias}
    - Tipos de Ocorrências - Cotações de Frete  {transp_tiposOcorrenciasCotacoesFrete}
    - Tipos de operações  {transp_naturezaOperacoesTransporte}
    - Tipos de operações TMS  {transp_tiposOperacoesTMS}
    - Tipos de Regras  {transp_tiposRegras}
    - Tipos de Talões  {trans_tiposTaloes}
    - Tipos de Verificação de UF  {transp_tiposDistribuicao}
    - Tipos Pagamentos  {trans_tiposPagamentos}
    - Tipos Valores Outros  {transp_tiposValoresOutros}
  + Relatórios
    - Apólices de Seguro  {transp_form_rel_apolicesSeguro}
    - Comissionamento  {trans_rel_comissoes_formulario}
    - Conhecimentos não faturados  {transp_formularioConhecimentosNaoFaturados}
    - Despesas Extras Contrato de Frete  {transp_rel_despesasExtrasCf_form}
    - Destinos Motoristas  {trans_formRelDestinosMotoristas}
    - Ficha cadastral do Motorista  {transp_fichaMotorista}
    - Planilha de Resumo CSV  {planilha_resumoCtrcCSV}
    - Planilha Despesas Extras  {transp_rel_planilhaDespesasExtras_form}
    - Relatório de Checklist  {transp_formRelCheckList}
    - Relatório de Conhecimentos  {trans_rel_conhecimento_formulario}
    - Relatório de Contratos de Frete  {trans_rel_recibosFrete_formulario}
    - Relatório de Cotações de Frete  {transp_rel_cotacoesFrete_formulario}
    - Relatório de Faturamento de Conhecimentos  {trans_rel_faturamento_conhecimento_formulario}
    - Relatório de Manifestos de Carga  {transp_formularioManifestoCarga}
    - Relatório de NF-e pré-cadastrada  {transp_rel_notasCarregamento_form}
    - Relatório de Ocorrências  {transp_rel_ocorrenciasEmTransito_form}
    - Relatório de Ordens de Carregamento  {trans_rel_ordensCarregamento_formulario}
    - Relatório de Pedidos PDF  {trans_rel_pedidosTransportePDF_form}
    - Relatório de Tabela de Preços  {trans_rel_tabelaPrecos_formulario}
    - Relatório de Veículos  {transp_formVeiculos}
  + Sintegra
    - Pessoas Endereços  {transp_pessoasEnderecos}
    - Remessa SINTEGRA  {trans_sintegra}
  + EDI
    - Assistente de Relatórios  {transp_assistente_relatorios}
    - EDI Transporte  {transp_ediTransporte}
    - Histórico de EDIs  {transp_HistoricoImportacaoEdi}
    - Importação EDI  {transp_importarEDI}
    - Importação/Exportação  {trans_importacoesEDI}
    - Parâmetros  {transp_parametros}
  + Documentos
    - CRT  {transp_crt}
    - CT-e  {transp_cte}
    - DC-e  {transp_dce}
    - MDF-e  {transp_mdfe}
    - MIC  {transp_mic}
    - NFS-e  {transp_nfse}
  + Dashboards
    - Gestão de Faturamento  {transp_gestao_faturamento}
  - Agrupador de NF-e Pré-cadastrada  {transp_agrupadorNfePreCadastrada}
  - Análise de Cadastro de Motorista  {transp_analise_cadastro_motorista}
  - Análise de Cadastro de Motorista  {transp_veiculos_dtl_analise_cadastro_motorista}
  - Antecipação de Recebíveis - nsflow  {transp_antecipacaoRecebiveisNsflow}
  - Automatização de manifestos  {transp_automatizacaoManifestos}
  - Checklist  {transp_checkList}
  - CIOT Automático  {transp_ciot_automatico_processo}
  - CIOT Frota Própria  {transp_ciot}
  - Conferência de Agrupador de NF-e Pré-cadastrada  {transp_conferenciaAgrupadorNfePreCadastrada}
  - Conhecimentos  {trans_conhecimento}
  - Conhecimentos do Transporte  {trans_conhecimentosPedidosGranel}
  - Conjuntos de Veículos  {transp_conjuntosVeiculos}
  - Contêineres  {transp_containers}
  - Contrato de Frete  {transp_contratoFrete}
  - Controle de Comissionamento de Agências  {transp_controleComissionamentoAgencias}
  - Cotações de frete  {transp_cotacoesFrete}
  - CT-e Pré-cadastrado  {transp_cte_pre_cadastrado}
  - Despesas Extras do Conhecimento  {transp_despesasExtras}
  - Despesas Extras do Contrato de Frete  {transp_despesasExtrasReciboFrete}
  - Encerrar Manifestos não cadastrados  {transp_manifestoCargaNaoCadastrados}
  - Envio de cobranças  {transp_envioCobrancas}
  - Etiquetas de conhecimento  {transp_etiquetasConhecimento}
  - Etiquetas Personalizadas  {transp_etiquetas_personalizadas}
  - Faturamento  {trans_faturamento}
  - Faturamento em lote  {transp_faturamentoEmMassa}
  - Guia de Entrega  {transp_guiaEntrega}
  - Histórico de averbação  {transp_historicoAverbacao}
  - Histórico de Status da Cotação de Frete  {transp_historicoStatusCotacoesFrete}
  - Kanban Cotações de frete  {transp_cotacoesFreteKanban}
  - Lotes  {trans_pedidosGranel}
  - Lotes / Duplicatas a Pagar  {transp_lotesDuplicatasPagar}
  - Manifesto de Carga  {transp_cadManifestoCarga}
  - Manifesto de carga - Fechamento  {transp_manifestoCargaFechamento}
  - NF-e Pré-cadastrada  {transp_notasCarregamento}
  - Notificações dos motoristas  {transp_notificacoesDosMotoristas}
  - Ocorrências  {transp_ocorrenciasTransporte}
  - Ordem de Carregamento  {transp_ordensCarregamentoPai}
  - Ordem de Carregamento Simplificada  {transp_ordensCarregamentoSimplificada}
  - Pedidos  {trans_pedidos}
  - Pedidos contêineres  {transp_pedidosConteiner}
  - Percursos  {transp_rotasManifesto}
  - Programação de Pagamentos  {transp_comprovanteEntrega}
  - Rastreamento de cargas  {transp_integracaoRastreamentoCargas}
  - Requisições à gerenciadora  {transp_requisicoesGerenciadoraRiscos}
  - Rotas de distribuição  {transp_rotasDistribuicao}
  - Solicitação de Monitoramento  {solicitacao_monitoramento}
  - Sugestão de corretores  {transp_corretores}
  - Veículos  {trans_veiculos}
  - Vinculação de Motoristas  {transp_vinculacaoMotorista}
+ Estoque
  + Configurações
    + Cadastros Básicos
      - Agrupadores de Saídas  {est_agrupamentoSaida}
      - Destino Ferramentas  {est_destinosFerramentas}
      - Empenhos Projetos  {empenhosProjetos}
      - Empenhos Unidades  {empenhosUnidades}
      - Finalidades  {est_dominio_finalidades}
      - Motivos de Ordem de Dosagem Adicional  {motivosOrdemDosagemAdicional}
      - Motivos de Uso Extra de Sacaria  {motivosUsoExtraSacaria}
      - Tipos de Docas  {tiposDocas}
    - Almoxarifados  {est_almoxarifado}
    - Armazém  {est_armazem}
    - Cadastro de E-commerce  {est_cadastroEcommerce}
    - Cadastro de Métodos de Envio  {est_metodosEnvio}
    - Configuração da Confêrencia Cega PDF  {est_configuracaoConferenciaCegaPdf}
    - Configuração Mapa de Separação PDF  {transp_configuracaoMapaSeparacaoPdf}
    - Configurações de Etiquetas  {est_configuracaoEtiquetas}
    - Domínios  {est_dominios}
    - Família Produtos Serviços  {finan_familia_produtos_servicos}
    - Ferramentas  {est_ferramentas}
    - Finalidades de Movimentação  {est_finalidadesMovimentacao}
    - Itens de classificação  {est_itensClassificacao}
    - Modalidades de Frete  {est_modalidadesFrete}
    - Operações do Estoque  {est_operacoesEstoque}
    - Perfis relatório Curva ABC  {est_perfilRelCurvaAbc}
    - Produtos Obsoletos  {est_produtosObsoletos}
    - Status Cotações  {est_status}
    - Status das Ferramentas  {est_statusFerramentas}
    - Status dos Pedidos (Estoque)  {est_statusPedidos}
    - Subinventários  {est_subinventarios}
    - Tipos de Avarias  {est_tiposAvarias}
    - Tipos de Ferramentas  {est_tiposFerramentas}
    - Tipos de Locais  {est_tiposLocais}
    - Tipos de Ocorrências  {est_tiposOcorrencias}
    - Tipos de Operações WMS  {est_tiposOperacoesWMS}
    - Tipos de Programações  {est_tiposProgramacoes}
    - Tipos de Unitizadoes  {est_tiposDeUnitizadores}
  + Relatórios
    - Controle de Acessos Pessoas  {est_rel_controleAcessosTerceiros_formulario}
    - Desempenho  {est_form_rel_desempenho}
    - Estoque  {est_rel_estoque_formulario}
    - Pedidos  {est_rel_pedidos_form}
    - Pedidos WMS  {est_rel_pedidos_formulario}
    - Relatório de Cotações  {est_rel_cotacoes_formulario}
    - Relatório de reabastecimento de área picking  {est_relatorio_reabastecimentoAreaPicking_form}
    - Relatórios Controle de Ferramentaria  {est_rel_controleFerramentaria_form}
    - Relatórios de Conferência do Faturamento  {est_rel_formularioConferenciaFaturamento}
    - Relatórios do Estoque  {est_rel_relatoriosDoEstoque_formulario}
  + Requisição de empenho
    - Boletim Contábil  {est_form_boletimContabil}
  + Pedidos
    - Pedidos de Compra  {est_pedidosCompra}
    - Pedidos de Venda  {est_pedidosVenda}
    - Volumes do pedido  {est_volumesPedido}
  + Volumes
    - Volumes de entrada  {est_volumesEntrada}
    - Volumes do pedido  {est_volumesPedido}
  + Programações
    - Entrada  {est_progEntrada}
    - Saída  {est_progSaida}
  - Abastecimentos  {manutencao_notas_fiscais_multiplos_abastecimentos}
  - Agrupador de lotes  {est_agrupadorLotes}
  - Avarias  {est_avarias}
  - Coleta de seriais / lotes  {est_coletaSeriais}
  - Conferência de Pedidos - Check out  {est_conferenciaPedidosCheckOut}
  - Conferências de pedidos  {est_conferenciasSaidas}
  - Configuração Mapa de Separação PDF  {transp_configuracaoMapaSeparacaoPdf}
  - Controle de Acessos Pessoas  {est_controleAcessosTerceiros}
  - Conversões medidas  {finan_conversoesMedidas}
  - Cotações de Compra  {est_cotacoes}
  - Devolução de Ferramentas  {est_devolucaoFerramentas}
  - Distribuição de coleta de pedido  {est_distribuicaoColetaPedido}
  - EDI Estoque  {est_ediEstoque}
  - Embalagens  {est_embalagens}
  - Empréstimo de Ferramentas  {est_emprestimoFerramentas}
  - Empréstimos  {est_emprestimos}
  - Entrada  {est_entradas}
  - Estoque  {est_estoque}
  - Exportar ISS  {finan_exportarISS}
  - Faturamento  {est_faturamentoItens}
  - Gestão de Atividades  {est_gestaoAtividades}
  - Gestão de Atividades - Painel  {est_rest_gestaoAtividades}
  - Importar NFS  {finan_importarNFS}
  - Impressão Notas Fiscais em Lote  {finan_impressaoNotasFiscaisLotes}
  - Informação de Estimativas  {est_infoEstimativas}
  - Inventários  {est_inventarios}
  - Lotes Produtos  {est_lotesProdutos}
  - Mapeamento de Empréstimos  {est_mapeamentoEmprestimos}
  - Movimentação Estoque  {est_movimentacao}
  - Notas Fiscais  {finan_cadastro_notas_fiscais}
  - Notas fiscais de saída  {est_notasFiscaisSaida}
  - Ocorrências das programações  {est_form_ocorrenciasPedidos}
  - Operações das Programações  {est_operacoesDasProgramacoes}
  - Operações WMS  {est_operacoesWMS}
  - Posicionamento de mercadorias  {est_posicionamentoMercadorias}
  - Produção  {est_producao}
  - Produtos  {produtos}
  - Reabastecimento  {est_reabastecimentoWMS}
  - Registro de Balanço  {est_registro_balanco}
  - Saídas  {est_saidas}
  - Separações de pedidos em andamento  {est_separacoesPedidosEmAndamento}
  - Seriais dos produtos  {est_serialsProduto}
  - Solicitação interna de compra  {est_solicitacaoCotacoes}
  - TFEA  {est_termoFaltaExcessosAvarias}
  - Unitizadores  {est_unitizadores}
  - Visualização de Armazéns  {est_visualizacaoAlmoxarifado}
+ Pessoas
  + Relatórios
    - Relatório Pessoas  {pessoasRelatorioPessoas_formulario}
  + Cadastros
    - CNPJ Repetidos  {cnpj_repetidos}
    - Detalhes  {pessoas_tiposDetalhesPessoas}
    - Domínios  {pessoas_dominios}
    - Grupos de Pessoas  {grupos_de_pessoas}
    - Localidades  {cadastro_de_localidades}
    - Setores  {pessoas_setores}
    - Tipos de Relação de Dependentes  {tiposRelacaoDependentes}
  - Contas para Pagamento  {pessoas_contasDepositos}
  - Contatos  {pessoas_contatos}
  - Dados Seguradora  {pessoas_dadosSeguradora}
  - Dependentes  {pessoas_dtl_dependentesPessoas}
  - Dificuldade de Acesso ao Endereço  {pessoas_dificuldadeEndereco}
  - Documentos  {pessoas_documentos}
  - Exportar Dados  {pessoas_exportacao_dados_ler_dados}
  - Importação de pessoas  {pessoas_importacaoPessoas}
  - Pessoas  {cadastro_pessoas}
  - Preferências de Transporte  {pessoas_dtl_prefConhecimento}
+ CRM
  - BCI  {crm_baseConhecimentoInformacoes}
  - Contribuições BCI  {crm_contribuicoesBCI}
  - Sinalizadores  {crm_sinalizadores}
  - Tipos de BCI  {crm_tiposBaseConhecimentoInformacoes}
+ Ordens de Serviço
  + Configurações
    - Categorias  {os_categorias}
    - Domínios  {os_dominios}
    - Locais dos Ativos  {locaisDosAtivos}
    - Status  {os_status}
    - Tipos  {os_tipos}
  + Relatórios
    - Ocorrências  {OS_rel_ocorrencias_form}
    - OS em Andamento  {OS_rel_ordemServicoAndamento_formulario}
    - Relatório de Ordens de Serviço  {os_filtroOrdemServico}
  - Faturamento  {os_faturamentoOS}
  - Ocorrências  {os_ocorrenciasOS}
  - Ordens de Serviço  {os_ordensServico}
+ Manutenção
  + Configurações
    + Comissionamento
      - Comissão por Operador  {man_tipoComissaoOperador}
      - Comissões  {man_tiposComissoes}
      - Indexador  {man_tiposIndexadorComissoes}
    - Bandas de Rodagem de Pneus  {man_pneusBandaRodagem}
    - Classificação Viagem  {man_classificacaoViagem}
    - Detalhes equipamentos  {man_tiposEquipamentosDetalhes}
    - Diagrama de pneus  {manDiagramaPneus}
    - Domínios  {man_dominios}
    - Envio relatório de alertas  {manEquipamentosEncaminhamentoRelatoriosAlertas}
    - Estrutura de Pneus  {man_pneusEstrutura}
    - Formas de Avaliação  {man_formasAvaliacao}
    - Formulário de Avaliação  {man_formulariosAvaliacao}
    - Grupos de Demonstrativo Financeiro  {man_gruposDemonstrativoFinanceiro}
    - Grupos de entrada e saída gerencial da manutenção  {man_grupos_entrada_saida_gerencial}
    - Grupos de Equipamentos  {man_gruposEquipamentos}
    - Indisponibilidade dos pneus  {man_indisponibilidadeDosPneus}
    - Marcas  {man_pneusMarca}
    - Modelos de Pneus  {man_modelosPneus}
    - Planos de Manutenção  {manPlanosManutencao}
    - Restrição adiantamento motoristas x empresas  {man_restricaoAdiantamentoMotoristasEmpresa}
    - Sistemas de abastecimento  {man_sistemasAbastecimento}
    - Situação do equipamento  {man_situacaoEquipamento}
    - Tabela de Comissões  {man_tabelaComissoes}
    - Tamanho Pneu  {man_pneusTamanho}
    - Tipos de Auxiliares  {man_tipoAuxiliar}
    - Tipos de Componentes  {manTiposComponentes}
    - Tipos de Despesas do Acerto  {man_acertosDespesasTipos}
    - Tipos de Diárias  {man_tiposDiarias}
    - Tipos de Documentos  {manTiposDocumentos}
    - Tipos de Entregas da Viagem  {man_viagensTipoEntrega}
    - Tipos de Equipamentos  {manTiposEquipamentos}
    - Tipos de Ocorrências da Viagem  {man_viagensTipoOcorrencia}
    - Tipos de Paradas  {manTiposParadas}
    - Tipos de Pneus  {man_pneusTipo}
    - Tipos de Recapagens  {man_pneusTipoRecapagem}
    - Tipos de Valores Outros  {man_tiposValoresOutros}
  + Relatórios
    - Adiantamentos e Devoluções  {man_formAdiantamentosDevolucoes}
    - Alertas dos Equipamentos  {man_relAlertasFormulario}
    - Detalhes Equipamentos  {man_form_detalhesEquipamento}
    - Diárias  {manFormRelDiarias}
    - Documentos dos Equipamentos  {man_rel_documentosEquipamentos_formulario}
    - Extrato do Motorista  {manFormularioExtratoMotorista}
    - Faturamento de Viagens  {manRelFaturamentoViagensFormulario}
    - Financeiro dos Equipamentos  {man_formRelFinanceiroEquipamento}
    - Histórico de Componentes  {manFormHistoricoComponentes}
    - Listas de Verificações  {man_formRelListasVerificacoes}
    - Mapa dos Equipamentos  {man_formRelMapaEquipamentos}
    - Multas  {man_form_multas}
    - Ordens de Abastecimento  {man_rel_ordensAbastecimento_form}
    - Rastreamento de Componentes  {manFormRastreamentoComponentes}
    - Relação de Abastecimentos  {man_frotaFormRelAbastecimentos}
    - Relatório de Acertos  {man_relatorioAcertos}
    - Relatório de Comissões  {manRelComissaoMotoritasFormulario}
    - Relatório de Medições  {man_rel_medicao_formulario}
    - Relatório de Paradas  {man_rel_paradas_formulario}
    - Relatório de Pneus  {man_form_pneus}
    - Relatório de Tacógrafos  {man_rel_tacografos_formulario}
    - Seguro dos Veículos  {man_formRelSeguroVeiculos}
    - Viagens dos Equipamentos  {manRelViagensFormulario}
  + Pneus
    - Custos  {manPneusCustos}
    - Manutenção de Pneus  {manManutencaoPneus}
    - Pneus  {manPneus}
    - Recapagens  {manPneusRecapagens}
  + Multas
    - Multas  {man_multas}
    - Tipos de Infrações  {man_multasTiposInfracoes}
  + Dashboards
    - Gestão de Documentos  {man_gestao_documentos}
    - Gestão de Multas  {man_gestaoMultas}
  - Abastecimentos  {manEquipamentosAbastecimentosExterna}
  - Abastecimentos  {manEquipamentosAbastecimentos}
  - Abastecimentos Gerais  {manAbastecimentosGerais}
  - Abastecimentos Próprios  {manAbastecimentosProprios}
  - Acerto Motorista  {man_acertosMotoristas}
  - Alertas de Equipamentos  {man_alertas_equipamentos}
  - Bombas de Combustíveis  {man_bombasCombustiveis}
  - Checklists - Respostas via App  {man_formulariosAvaliacaoRespostas}
  - Controle Adiantamento/Devoluções  {man_controleAdiantamentoDevolucoes}
  - Controle de Diárias dos Operadores  {man_controleDiariasOperadores}
  - Despesas Acerto Motorista  {man_acertosMotoristasDespesas}
  - Despesas do Equipamento  {manDespesas}
  - Documentos dos Equipamentos  {man_documentosEquipamentos}
  - Equipamentos  {manEquipamentos}
  - Histórico Importações Abastecimentos  {man_historicoImportacoes}
  - Importar abastecimentos  {man_importarAbastecimentos}
  - Importar Viagens  {manImportacaoViagens}
  - Leitura de Uso  {manEquipamentosLeituraUso}
  - Manutenção do medidor  {manManutencaoMedidor}
  - Ordens de abastecimento  {man_ordensAbastecimentos}
  - Paradas  {manEquipamentosParadas}
  - Previsão de Alertas de Manutenção  {previsaoAlertasManutencao}
  - Serviço / Requisição / Lote de Viagens  {man_lotesViagens}
  - Serviços  {manServicos}
  - Serviços / Requisições  {manServicosRequisicoes}
  - Serviços / Viagens  {manServicosViagens}
  - Serviços Ordem Carregamento  {manServicosOrdemCarregamento}
  - Sinalizadores  {man_sinalizadores}
+ Banco de CEPs
  - Localidades  {ceps_localidades}
  - Mesorregiões  {ceps_mesoregioes}
+ Configurações
  + Impressão
    - Layouts de Impressão  {impressaoPosicionada_layouts}
    - Tipos de Impressões  {impressaoPosicionada_tipos}
  + Cadastros Básicos
    + Hub
      - Históricos  {cad_hub_historicos}
      - Importação/Exportação  {cad_hub_importacaoExportacao}
      - Parâmetros  {cad_hub_parametros}
    - Aeronaves  {cad_aeronaves}
    - Atividades  {cad_atividades}
    - Cadastro de Feriados  {cad_feriados}
    - Cidades  {login_cidades}
    - CNAE  {cad_CNAE}
    - Domínios  {cadDominios}
    - Embarcações  {cad_embarcacoes}
    - Formulários HTML  {cad_formulariosHTML}
    - Grupos de Atividades  {cad_atividadesGrupos}
    - Grupos de Cidades  {cadGrupoCidades}
    - Modelos de conteúdo  {cad_modelosDeConteudo}
    - Moedas  {login_moedas}
    - Navios  {login_navios}
    - NCM  {cad_NCM}
    - Padrão dos Contêineres  {cad_padraoContainers}
    - Países  {login_paises}
    - Portos  {cad_portos}
    - Tamanhos Contêineres  {cad_tamanhoContainers}
    - Terminais  {cad_terminais}
    - Tipos de Contêineres  {cad_tiposContainers}
    - Tipos de Documentos de Pessoas  {cadTiposDocsPessoas}
    - Unidades  {cad_unidades}
    - Vinculação de códigos entre Sistemas  {cad_vinculacaoCodigosSistemas}
  + Terminais
    + Cadastros Básicos
      - Navios  {login_navios}
      - NCM  {cad_NCM}
    - Padrão dos Contêineres  {cad_padraoContainers}
+ BLs
  - Agenda Navios / Portos  {login_agendaNaviosPortos2}
+ eDoc
  + Sped
    - Modificação de PIS/COFINS dos Conhecimentos  {edoc_valores_pre_definidos_sped_listagem}
    - Registros do Inventário  {eDoc_registrosInventario}
  + Relatórios
    - Relatório de Eventos/Manifestações  {eDoc_relatorios_form_eventosManifestacoes}
  - Base XML NF-e  {eDoc_baseXMLNFe}
  - Certificados Digitais  {eDoc_certificadosDigitaisUsuarios}
  - Certificados Digitais (Interno)  {eDoc_certificadosDigitais}
  - Consulta de serviços  {eDoc_consultaServico}
  - Contingência  {eDoc_contingencia}
  - Definições EFD  {edoc_efd}
  - Download de arquivos XML  {edoc_download}
  - Download de documentos  {eDoc_donloadDocumentos}
  - Geração Sped  {eDoc_gerarSped}
  - Histórico CFe  {eDoc_historicoCFe}
  - Histórico de chaves CT-e  {eDoc_historicoChavesCTe}
  - Histórico de chaves MDF-e  {eDoc_historicoChavesMDFe}
  - Histórico de chaves NF-e  {eDoc_historicoChavesNFe}
  - Histórico NFS-e  {eDoc_historicoNFSe}
  - Inutilização de intervalo de numeração  {eDoc_inutilizacaoDeIntervaloDeNumeracao}
  - Lei da transparência fiscal  {eDoc_leiTransparenciaFiscal}
  - Repositório CT-e  {edoc_repositorioCTe}
  - Repositório NF-e  {edoc_repositorioNFe}
  - Repositório NFS-e  {edoc_repositorioNFSe}
  - Sinalizadores Repositório NF-e  {cad_sinalizadores_repositorioNfe}
+ E-mail
  - Envio de e-mail  {ambiente_emails}
  - Logs de envio  {ambiente_logs_emails}
+ Painel
  - Painéis  {painel_paineis}
  - Usuários Painéis  {painel_usuariosPaineis}
+ Hub
  - Históricos  {cad_hub_historicos}
  - Importação/Exportação  {cad_hub_importacaoExportacao}
  - Parâmetros  {cad_hub_parametros}
+ Portaria
  + Configurações
    - Categoria dos veículos  {portaria_categoriasVeiculos}
    - Configurações dos acessos  {portaria_configuracoesAcessos}
    - Marcas de Veículos  {portaria_marcasVeiculos}
    - Setores  {portaria_setores}
    - Tipos de acessantes  {portaria_tiposAcessantes}
    - Tipos de acessos  {portaria_tiposAcessos}
    - Tipos de documentos  {portaria_tiposDocumentos}
    - Tipos de ocorrências  {portaria_tiposOcorrencias}
  + Acessos
    - Acessos auxiliares  {portaria_acessosAuxiliares}
    - Acessos contêineres  {portaria_acessosConteineres}
    - Acessos motoristas  {portaria_acessosMotoristas}
    - Acessos placas  {portaria_acessosPlacas}
    - Acessos visitantes  {portaria_acessosVisitantes}
  + Relatórios
    - Controle de Acessos  {portaria_rel_controleAcessos_formulario}
  - Contêineres  {portaria_conteineres}
  - Controle de acesso  {portaria_controleAcesso}
  - Veículos  {portaria_veiculos}
+ Checklists
  + Dashboard
    - Gestão de checklists  {checklists_gestaoChecklists}
  - Checklists  {checklists_aplicacao}
  - Modelos  {checklists_modelos}
  - Questões  {checklists_questoes}
+ Controle de Viagens
  + Configurações
    + Despesas
      - Modelos  {controle_viagens_despesas_configuracoes_modelos}
      - Tipos de Item  {controle_viagens_despesas_configuracoes_tipos_item}
      - Viagem  {controle_viagens_viagem_analise_resultado_viagem}
    + Viagens
      + Documentos
        - Regras de Cálculo  {controle_viagens_viagens_documentos_cte_regras_calculos}
      - Classificações de Viagem  {controle_viagens_viagens_classificacoes}
      - Regras de Comissionamento  {controle_viagens_viagens_regras_comissionamento}
    - Faixas  {controle_viagens_viagens_regras_comissionamento_faixas}
    - Parâmetros  {controle_viagens_parametros}
  + Relatórios
    - Documentos das Viagens  {controle_viagens_relatorio_documentos_viagens_form}
    - Listagens  {controle_viagens_listagens}
    - Recebimentos pelos Motoristas  {controle_viagens_relatorio_recebimentos_form}
    - Relatório de Acertos de Motoristas  {controle_viagens_relatorio_acertos_form}
    - Relatório de Adiantamentos e Devoluções  {controle_viagens_relatorio_movimentacoes_financeiras_form}
    - Relatório de Despesas  {controle_viagens_relatorio_despesas_form}
    - Relatório de Motoristas  {controle_viagens_relatorio_motoristas_form}
    - Relatório de Receitas  {controle_viagens_relatorio_receitas_form}
    - Relatório de Resultado  {controle_viagens_relatorio_resultado_form}
    - Relatório de Veículos  {controle_viagens_relatorio_veiculos_form}
    - Relatório de Viagens  {controle_viagens_form_relatorios_viagens}
  + Dashboards
    - Gestão Operacional  {controle_viagens_dashboards_gestao_operacional}
  - Acertos de Motoristas  {controle_viagens_acertos}
  - Adiantamentos e Devoluções  {controle_viagens_movimentacoes_financeiras}
  - Anexos  {controle_viagens_viagens_anexos}
  - Despesas  {controle_viagens_despesas}
  - Documentos  {controle_viagens_documentos}
  - Recebimentos pelos Motoristas  {controle_viagens_recebimentos}
  - Receitas  {controle_viagens_receitas}
  - Viagem  {controle_viagens_viagem_analise_resultado_viagem}
  - Viagens  {controle_viagens_viagens}
+ nsdocs
  + Relatórios
    - Relatório de Eventos/Manifestações  {eDocNsdocs_relatorios_form_eventosManifestacoes}
    - Relatório nsdocs  {edocNsdocs_relatorios_form_XMLProtegido}
  + Downloads
    - Download de documentos  {eDocNsdocs_downloadDocumentos}
  - Site nsdocs
  - Repositório CT-e  {edocNsdocs_repositorioCTe}
  - Repositório de NFCe  {edocNsdocs_repositorioNFCe}
  - Repositório de NFS-e  {edocNsdocs_repositorioNFSe}
  - Repositório NF-e  {edocNsdocs_repositorioNFe}
+ Apoio Contábil
  + Integração Contábil
    + Configurações
      - Exceções da Integração Contábil  {finan_apoioContabil_tipoDocumentosIntegracaoContabil}
      - Mapa Integração Contábil  {finan_apoioContabil_mapaIntegracaoContabil}
      - Plano de Contas Contábil  {finan_apoioContabil_plano_contas_fiscal}
    - EDI Integração Contábil  {finan_apoioContabil_ediFinanceiro}
    - Integração Contábil  {finan_apoioContabil_rel_int_contabil_listagem}
  + Integração Fiscal
    + Sped
      + Configurações
        - Definições EFD  {fiscal_apoioContabil_definicoesEFD}
      - Modificação de PIS/COFINS dos Conhecimentos  {edoc_valores_pre_definidos_sped_listagem}
      - Registros do Inventário  {fiscal_apoioContabil_registrosInventario}
      - Sped  {eDoc_historicoSpedGerados}
    - EDI  {fiscal_apoioContabil_edi}
`;
