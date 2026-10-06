/* js/app/assistente-relatorios.js — Assistente de relatórios (gera .dat). */
// ═══════════════════════════════════════════════════════════
//  ASSISTENTE DE RELATÓRIOS (gera .dat pra importar no Bsoft)
// ═══════════════════════════════════════════════════════════

// Gera entradas de catálogo para grupos "tipo pessoa" (cliente, remetente, destinatário,
// expedidor, recebedor, contratado, emissor, motorista) — reaproveita os mesmos rótulos
// pros sufixos de campo em comum, evitando repetir manualmente ~90 linhas quase iguais.
const _LABELS_CAMPO_PESSOA = {
    CNPJ: 'CNPJ', IE: 'IE', bairro: 'Bairro', celular: 'Celular', cep: 'CEP', cidade: 'Cidade',
    documentoFormatado: 'Documento Formatado', endereco_telefone1: 'Telefone do Endereço 1',
    endereco_telefone2: 'Telefone do Endereço 2', inscricao_estadual: 'Inscrição Estadual',
    nome: 'Nome', numero: 'Número', razaoSocial: 'Razão Social', rua: 'Rua', telefone: 'Telefone',
    uf: 'UF', cpf: 'CPF', rg: 'RG', descricao: 'Descrição', empresa: 'Empresa',
    RG: 'RG', RNTRC: 'RNTRC', codCidade: 'Código Cidade', dataNascimento: 'Data Nascimento',
    documento: 'Documento', mae: 'Mãe', matriculaINSS: 'Matrícula INSS', dataCadastro: 'Data Cadastro',
    inscricaoEstadual: 'Inscrição Estadual'
};
function _CAT_PESSOA(prefixo, grupo, campos) {
    return campos.map(c => ({ grupo, exp: prefixo + '.' + c, label: `${_LABELS_CAMPO_PESSOA[c] || c} (${grupo})` }));
}

// Texto bruto de "Demais campos" (árvore avançada de tabelas do sistema, além dos grupos
// "Dados" curados acima) — colado como veio, uma linha por grupo: "grupo (tabela): grupo.campo1 grupo.campo2 ...".
// Convertido em catálogo pelo parser _parseDemaisCampos logo abaixo.
const _DEMAIS_CAMPOS_RAW_CTE = `
cte (transp_conhecimentoTransporteReais): cte.id cte.operacoes_id cte.operacoesMercadorias_id cte.agencias_id cte.agenciasComissao_id cte.tiposTaloes_id cte.pedidos_id cte.complementoPedido cte.ordensCarregamento_id cte.cfops_id cte.cliente_id cte.manifestador_usuarios_id cte.nroConhecimento cte.dataCriacao cte.dtEmissao cte.statusCancelado cte.remetente_id cte.destinatario_id cte.consignatario_id cte.redespacho_id cte.pagamentoFrete cte.calcAte cte.localColeta cte.localEntrega cte.precosConhecimento_id cte.regraFrete_id cte.tarifaDigitada cte.tarifaCalculada cte.valorFrete cte.aliquota cte.valorICMS cte.valoresOutros cte.valorSeguroAduaneiro cte.valorPedagio cte.valorPedagioConhecimento cte.totalPrestacao cte.motorista_id cte.veiculos_id cte.carreta_id cte.semireboque_id cte.quartoVeiculo_id cte.favorecido_id cte.imprimirProprietario cte.respSeg cte.seguradora_id cte.numeroApolice cte.regrasCarreto_id cte.tolerancia cte.pesoColeta cte.tarifaMotoristaCalculada cte.tarifaMotoristaDigitada cte.valorTotalOrigem cte.outrosDescontos cte.outrosAcrescimos cte.descontoINSS cte.totalDescontoINSS cte.descontoSEST cte.totalDescontoSEST cte.freteLiquido cte.valorAdiantamento cte.pesoChegada cte.tipoPedagio cte.descontoQuebraPeso cte.saldo cte.pesoChegadaReal cte.descontoQuebraPesoReal cte.valorFaturado cte.tarifaImpressa cte.statusBloqueado cte.dtAtualizacao cte.enderecoRemetente_id cte.enderecoDestinatario_id cte.enderecoConsignatario_id cte.enderecoRedespacho_id cte.enderecoCliente_id cte.parcelarAdiantamento cte.valorSeguro cte.mercadoriaAvariada cte.container cte.lacre cte.valorContainer cte.mercadoriaOrdem_id cte.substitui cte.substituidoPor cte.numeroCartao cte.dtPrevChegada cte.estadoColeta cte.estadoEntrega cte.processos_id cte.codigo_lancamento cte.cod_rateio cte.codigo_lancamentoCreditoViagem cte.diaria cte.diariaFrete cte.reciboFrete_id cte.gerouReciboFrete cte.chaveCTe cte.protocoloCTe cte.resultadoCTe cte.protocoloCancelamentoCTe cte.cMunIni cte.cMunFim cte.enderecoEntrega_id cte.UFIni cte.UFFim cte.manifestoCarga_id cte.procCTeVersao cte.km cte.rascunho cte.CST cte.tipoDocumentos cte.valorISS cte.gerouReciboFreteExterno cte.baseResultadoCT cte.anuladoPor_id cte.anulou_id cte.comboio cte.dtCancelamento cte.complementou_id cte.lotacao cte.tpCTe cte.emailEnviado cte.totalServico cte.tpServ cte.substituiSefaz_id cte.definirQuantCargasManualmente cte.perfisApropriacao_id cte.formaApropriacao cte.forPag cte.emitiuDeclaracaoAnulacao cte.rotaDistribuicao_id cte.globalizado cte.percurso_id
talao (transp_tiposTaloes): talao.id talao.descricao talao.layoutImpressao_id talao.empresas_id talao.numeroMinimoFolhas talao.tipo talao.layoutImpressao_recibo_frete_id
cteComplementar (transp_conhecimentoTransporteReais): cteComplementar.id cteComplementar.operacoes_id cteComplementar.operacoesMercadorias_id cteComplementar.agencias_id cteComplementar.agenciasComissao_id cteComplementar.tiposTaloes_id cteComplementar.pedidos_id cteComplementar.complementoPedido cteComplementar.ordensCarregamento_id cteComplementar.cfops_id cteComplementar.cliente_id cteComplementar.manifestador_usuarios_id cteComplementar.nroConhecimento cteComplementar.dataCriacao cteComplementar.dtEmissao cteComplementar.statusCancelado
totais (transp_conhecimentoTransporteTotais): totais.conhecimento_id totais.quantMercadorias totais.valorMercadorias totais.pesoMercadorias totais.cubagemMercadorias totais.nroMercadorias totais.nroContainers totais.valorContainers totais.valorProdutos totais.valorDespesasExtras totais.pesoCubadoMercadorias totais.pesoTaxadoMercadorias totais.predominanteTipoNatureza_id
iniPrest (bancoCeps.localidades): iniPrest.id iniPrest.localidade iniPrest.uf iniPrest.codIBGE iniPrest.mesoCod iniPrest.codANP iniPrest.usado
fimPrest (bancoCeps.localidades): fimPrest.id fimPrest.localidade fimPrest.uf fimPrest.codIBGE fimPrest.mesoCod fimPrest.codANP fimPrest.usado fimPrest.antigoId
configTransporte (pessoas_configTransporte): configTransporte.pessoas_id configTransporte.tomadorServico configTransporte.regraFrete_id configTransporte.observacoesConhecimento configTransporte.observacoesOrdemCarregamento configTransporte.observacoesPedido configTransporte.seguroProprio
apolicesSeguro (transp_apolicesSeguro): apolicesSeguro.id apolicesSeguro.seguradora_id apolicesSeguro.nroApolice apolicesSeguro.dtInicioVigencia apolicesSeguro.dtFimVigencia apolicesSeguro.valorMaximoMercadoria apolicesSeguro.descricao apolicesSeguro.premioLiquido apolicesSeguro.descontoSobreTabela apolicesSeguro.contratante_id apolicesSeguro.roubo apolicesSeguro.apoliceDeCliente apolicesSeguro.sugerirApoliceQuandoContratanteTomador apolicesSeguro.acidente apolicesSeguro.calculoSeguroRelatorios apolicesSeguro.descontoSobreTabelaRoubo apolicesSeguro.IOFAcidente apolicesSeguro.IOFRoubo apolicesSeguro.premioMinimoAcidente apolicesSeguro.premioMinimoRoubo apolicesSeguro.validaParaFiliaisContratante apolicesSeguro.ramoAverbacao apolicesSeguro.config_formaAverbacao apolicesSeguro.config_tipoAverbacao apolicesSeguro.config_emailsParaAverbacao apolicesSeguro.config_usuarioWS apolicesSeguro.config_senhaWS apolicesSeguro.config_senhaWSCrypt apolicesSeguro.config_codigoATM apolicesSeguro.config_codigoGUEP apolicesSeguro.config_formatoEDI_id apolicesSeguro.config_enviarTagRespSeg apolicesSeguro.config_seguradora apolicesSeguro.config_token apolicesSeguro.config_tokenCrypt apolicesSeguro.config_ordemEnvioVeiculo apolicesSeguro.operacaoCargaDescarga apolicesSeguro.web_service_ATM_campos apolicesSeguro.web_service_ATM_campos_extras apolicesSeguro.ativo apolicesSeguro.rcv_seguradora
cliente (pessoasPessoas): cliente.id cliente.carteiras_id cliente.cod_localidade cliente.fisica_juridica cliente.CNPJ cliente.razao_social cliente.CI
enderecoCliente (pessoasEnderecosPessoas): enderecoCliente.id enderecoCliente.pessoas_id enderecoCliente.pessoasInativo_id enderecoCliente.cep enderecoCliente.endereco enderecoCliente.bairro enderecoCliente.cidade enderecoCliente.estado enderecoCliente.UF_estrangeiro enderecoCliente.telefone1 enderecoCliente.telefone2 enderecoCliente.pais enderecoCliente.paises_id enderecoCliente.cobranca_preferencial enderecoCliente.endereco_preferencial enderecoCliente.inscricaoEstadual enderecoCliente.inscricaoMunicipal enderecoCliente.isento enderecoCliente.isencaoMun enderecoCliente.logradouro_id enderecoCliente.localidade enderecoCliente.nro enderecoCliente.complemento enderecoCliente.cidade_id enderecoCliente.historicoAlteracao enderecoCliente.dificilAcesso enderecoCliente.valorColeta enderecoCliente.valorEntrega enderecoCliente.codIBGE enderecoCliente.naoContribuinte enderecoCliente.referencia enderecoCliente.chaveBusca
finan_empresas: finan_empresas.id finan_empresas.descricao finan_empresas.logo finan_empresas.pessoas_id finan_empresas.atividades_id finan_empresas.endereco_id finan_empresas.codigoContabil
emissor (pessoasPessoas): emissor.id emissor.carteiras_id emissor.cod_localidade emissor.fisica_juridica emissor.CNPJ emissor.razao_social emissor.CI emissor.descricao emissor.nome emissor.sobrenome emissor.email emissor.site emissor.data_cadastro emissor.observacoes emissor.data_nascimento emissor.profissao emissor.sexo emissor.contato_tecnico_id emissor.contato_administrativo_id emissor.cod_fiscal_cliente emissor.cod_fiscal_fornecedor emissor.cnh emissor.categoria emissor.dtExpedicao emissor.dtPrimeiraExpedicao emissor.dtValidade emissor.orgaoExpedidor emissor.limite_credito emissor.matriculaINSS emissor.apelido emissor.celular emissor.cod_fiscal_processos emissor.telResidencial emissor.protocoloCNH emissor.naturalidade emissor.nacionalidade emissor.pai emissor.mae emissor.outrosTels emissor.PIS_PASEP emissor.referencias emissor.usuarios_id emissor.ultimaAtualizacao emissor.preferenciaImpressaoNF emissor.bloqueado emissor.grupoDespesaEspecifico emissor.contas_id emissor.estado_civil emissor.identificador emissor.alvara emissor.conjuge emissor.escala emissor.protestar emissor.nroDiasProtesto emissor.logo emissor.codISSQNAtividadePrincipal emissor.statusPessoa_id emissor.enquadramento emissor.consultor_id emissor.CI_Estado emissor.naturalidadeEstado emissor.categoriaCRM emissor.emailCobranca emissor.documentoFormatado emissor.emissaoRG emissor.lotacao_id emissor.nit emissor.RNTRC emissor.tipoTransportadora emissor.IEC emissor.dependentesIRRF emissor.CI_orgaoExpedidor emissor.suframa emissor.seguroCNH emissor.emailCotacaoEstoque emissor.celularNumerico emissor.grauInstruTrabalhador emissor.paisNascimento_id emissor.paisNacionalidade_id emissor.numeroCTPS emissor.serieCTPS emissor.ufExpedicaoCTPS emissor.raca emissor.radicalCNPJ emissor.emailOcorrenciasTransporte emissor.receberPesquisaAtendimento emissor.naturalidade_id emissor.usuarioCadastro emissor.dtValidadeExameToxicologico emissor.cidadeEmissaoCNH_id emissor.ignoraValidacaoNIS emissor.renachCNH emissor.CI_orgaoExpedidor_mdm emissor.nome_social
enderecoEmissor (pessoasEnderecosPessoas): enderecoEmissor.id enderecoEmissor.pessoas_id enderecoEmissor.pessoasInativo_id enderecoEmissor.cep enderecoEmissor.endereco enderecoEmissor.bairro enderecoEmissor.cidade
transp_manifestoCarga: transp_manifestoCarga.id transp_manifestoCarga.nro transp_manifestoCarga.stAberto transp_manifestoCarga.dtEmissao transp_manifestoCarga.dtSaida transp_manifestoCarga.munIni transp_manifestoCarga.munFim transp_manifestoCarga.UFIni transp_manifestoCarga.UFFim transp_manifestoCarga.motorista_id transp_manifestoCarga.veiculos_id transp_manifestoCarga.carreta_id transp_manifestoCarga.semireboque_id transp_manifestoCarga.quartoVeiculo_id transp_manifestoCarga.KmInicial transp_manifestoCarga.KmFinal transp_manifestoCarga.dtFechamento transp_manifestoCarga.observacao transp_manifestoCarga.manifestoOriginal_id transp_manifestoCarga.tipoManifesto_id transp_manifestoCarga.munIni_id transp_manifestoCarga.munFim_id transp_manifestoCarga.agencias_id transp_manifestoCarga.tiposTaloes_id transp_manifestoCarga.stLiberado transp_manifestoCarga.usuario_id transp_manifestoCarga.controleUsoInicio_id transp_manifestoCarga.controleUsoFim_id transp_manifestoCarga.suprimentos_id transp_manifestoCarga.descricao transp_manifestoCarga.descricaoAcerto transp_manifestoCarga.conferente_id transp_manifestoCarga.MDFeChaveAcesso transp_manifestoCarga.MDFeNumeroRecibo transp_manifestoCarga.MDFeProtocoloAutorizacao transp_manifestoCarga.MDFeDataAutorizacao transp_manifestoCarga.MDFeProtocoloCancelamento transp_manifestoCarga.MDFeDataCancelamento transp_manifestoCarga.MDFeProtocoloEncerramento transp_manifestoCarga.MDFeDataEncerramento transp_manifestoCarga.acertos_id transp_manifestoCarga.contratado_id transp_manifestoCarga.tpEmit transp_manifestoCarga.percurso_id transp_manifestoCarga.tiposDistribuicao_id transp_manifestoCarga.mobile_id transp_manifestoCarga.cancelado transp_manifestoCarga.dataCancelamento transp_manifestoCarga.motivoCancelamento transp_manifestoCarga.usuarioCancelamento_id transp_manifestoCarga.contingencia transp_manifestoCarga.dtEncerramentoAutomatico transp_manifestoCarga.definirSeguradorasManualmente transp_manifestoCarga.usuarioEncerramento_id transp_manifestoCarga.aeronave_id transp_manifestoCarga.numeroVoo transp_manifestoCarga.aerodromoEmbarque_id transp_manifestoCarga.aerodromoDestino_id transp_manifestoCarga.dataVoo transp_manifestoCarga.modalidade transp_manifestoCarga.responsavelOco_id transp_manifestoCarga.cepOrigem transp_manifestoCarga.cepDestino transp_manifestoCarga.reciboFrete_id transp_manifestoCarga.considerarMultiplosDestinos transp_manifestoCarga.data_atualizacao transp_manifestoCarga.operacao_alto_desempenho transp_manifestoCarga.coordenadas_carregamento transp_manifestoCarga.coordenadas_descarregamento transp_manifestoCarga.status_averbacao
remetente (pessoasPessoas): remetente.id remetente.carteiras_id remetente.cod_localidade remetente.fisica_juridica remetente.CNPJ remetente.razao_social remetente.CI remetente.descricao remetente.nome remetente.sobrenome remetente.email remetente.site remetente.data_cadastro remetente.observacoes remetente.data_nascimento remetente.profissao remetente.sexo remetente.contato_tecnico_id remetente.contato_administrativo_id remetente.cod_fiscal_cliente remetente.cod_fiscal_fornecedor remetente.cnh remetente.categoria remetente.dtExpedicao remetente.dtPrimeiraExpedicao remetente.dtValidade remetente.orgaoExpedidor remetente.limite_credito remetente.matriculaINSS remetente.apelido remetente.celular remetente.cod_fiscal_processos remetente.telResidencial remetente.protocoloCNH remetente.naturalidade remetente.nacionalidade remetente.pai remetente.mae remetente.outrosTels remetente.PIS_PASEP remetente.referencias remetente.usuarios_id remetente.ultimaAtualizacao remetente.preferenciaImpressaoNF remetente.bloqueado remetente.grupoDespesaEspecifico remetente.contas_id remetente.estado_civil remetente.identificador remetente.alvara remetente.conjuge remetente.cnae_id remetente.escala remetente.protestar remetente.nroDiasProtesto remetente.logo remetente.codISSQNAtividadePrincipal remetente.statusPessoa_id remetente.enquadramento remetente.consultor_id remetente.CI_Estado remetente.naturalidadeEstado remetente.categoriaCRM remetente.emailCobranca remetente.documentoFormatado remetente.emissaoRG remetente.lotacao_id remetente.nit remetente.RNTRC remetente.tipoTransportadora remetente.IEC remetente.dependentesIRRF remetente.CI_orgaoExpedidor remetente.suframa remetente.seguroCNH remetente.emailCotacaoEstoque remetente.celularNumerico remetente.grauInstruTrabalhador remetente.paisNascimento_id remetente.paisNacionalidade_id remetente.numeroCTPS remetente.serieCTPS remetente.ufExpedicaoCTPS remetente.raca remetente.radicalCNPJ remetente.emailOcorrenciasTransporte remetente.receberPesquisaAtendimento remetente.naturalidade_id remetente.usuarioCadastro remetente.dtValidadeExameToxicologico remetente.cidadeEmissaoCNH_id remetente.ignoraValidacaoNIS remetente.renachCNH remetente.CI_orgaoExpedidor_mdm remetente.nome_social
enderecoRemetente (pessoasEnderecosPessoas): enderecoRemetente.id enderecoRemetente.pessoas_id enderecoRemetente.pessoasInativo_id enderecoRemetente.cep enderecoRemetente.endereco enderecoRemetente.bairro enderecoRemetente.cidade
destinatario (pessoasPessoas): destinatario.id destinatario.carteiras_id destinatario.cod_localidade destinatario.fisica_juridica destinatario.CNPJ destinatario.razao_social destinatario.CI
enderecoDestinatario (pessoasEnderecosPessoas): enderecoDestinatario.id enderecoDestinatario.pessoas_id enderecoDestinatario.pessoasInativo_id enderecoDestinatario.cep enderecoDestinatario.endereco enderecoDestinatario.bairro enderecoDestinatario.cidade
expedidor (pessoasPessoas): expedidor.id expedidor.carteiras_id expedidor.cod_localidade expedidor.fisica_juridica expedidor.CNPJ expedidor.razao_social expedidor.CI
enderecoExpedidor (pessoasEnderecosPessoas): enderecoExpedidor.id enderecoExpedidor.pessoas_id enderecoExpedidor.pessoasInativo_id enderecoExpedidor.cep enderecoExpedidor.endereco enderecoExpedidor.bairro enderecoExpedidor.cidade
recebedor (pessoasPessoas): recebedor.id recebedor.carteiras_id recebedor.cod_localidade recebedor.fisica_juridica recebedor.CNPJ recebedor.razao_social recebedor.CI
enderecoRecebedor (pessoasEnderecosPessoas): enderecoRecebedor.id enderecoRecebedor.pessoas_id enderecoRecebedor.pessoasInativo_id enderecoRecebedor.cep enderecoRecebedor.endereco enderecoRecebedor.bairro enderecoRecebedor.cidade
contratado (pessoasPessoas): contratado.id contratado.carteiras_id contratado.cod_localidade contratado.fisica_juridica contratado.CNPJ contratado.razao_social contratado.CI
enderecoContratado (pessoasEnderecosPessoas): enderecoContratado.id enderecoContratado.pessoas_id enderecoContratado.pessoasInativo_id enderecoContratado.cep enderecoContratado.endereco enderecoContratado.bairro
transp_mercadoriasConhecimento: transp_mercadoriasConhecimento.id transp_mercadoriasConhecimento.conhecimentoTransporte_id transp_mercadoriasConhecimento.marcas_id transp_mercadoriasConhecimento.especies_id transp_mercadoriasConhecimento.naturezas_id transp_mercadoriasConhecimento.natureza transp_mercadoriasConhecimento.dtNotaFiscal
naturezaCarga (transp_naturezas): naturezaCarga.id naturezaCarga.descricao naturezaCarga.toleranciaQuebra naturezaCarga.stAtivo naturezaCarga.codigoBuonny naturezaCarga.tipoNatureza_id naturezaCarga.nONU naturezaCarga.xNomeAE naturezaCarga.xClaRisco naturezaCarga.NCM naturezaCarga.grupoEmbalagens naturezaCarga.codigo_opentech
transp_especies: transp_especies.id transp_especies.descricao transp_especies.possuiQuebra transp_especies.capacidade transp_especies.nomeInterno transp_especies.stAtivo transp_especies.cUnid
finan_cfops: finan_cfops.id finan_cfops.cfop finan_cfops.descricao finan_cfops.textoNotaFiscal finan_cfops.operacaoEstoque finan_cfops.operacaoEspecificaNFRetorno finan_cfops.programarContas finan_cfops.tipoProgramacao finan_cfops.operacaoICMS finan_cfops.operacaoIPI finan_cfops.operacaoISS finan_cfops.operacaoII finan_cfops.operacaoIRRF finan_cfops.operacaoFETHAB finan_cfops.historicoLancamentoEstoque finan_cfops.lancamento finan_cfops.fiscal finan_cfops.gerencial finan_cfops.rateios finan_cfops.modo_lancamento finan_cfops.conta_pis finan_cfops.conta_cofins finan_cfops.conta_irrf finan_cfops.conta_csll finan_cfops.conta_inss finan_cfops.conta_pis_gerencial finan_cfops.conta_cofins_gerencial finan_cfops.conta_irrf_gerencial finan_cfops.conta_csll_gerencial finan_cfops.conta_inss_gerencial finan_cfops.conta_FETHAB_gerencial finan_cfops.conta_ICMSDeson_gerencial finan_cfops.programacaoFaturaLancamento finan_cfops.aliquotaICMS finan_cfops.operacaoCSLL finan_cfops.operacaoPIS finan_cfops.operacaoCOFINS finan_cfops.operacaoINSS finan_cfops.operacoesEstoque_id finan_cfops.finalidadeMovimentacao_id finan_cfops.utilizaImpostos finan_cfops.stAtivo finan_cfops.stNaturezaTransp finan_cfops.conta_issqn_gerencial finan_cfops.modalidadeBCICMS
containers (transp_containersConhecimento): containers.id containers.conhecimentoTransporte_id containers.container containers.mercadoriaAvariada containers.lacre containers.valorContainer containers.tara
tamanhoContainers (cadTamanhosContainers): tamanhoContainers.id tamanhoContainers.nomeInterno tamanhoContainers.descricao tamanhoContainers.pesoLimite tamanhoContainers.teu
manifestador (ambiente_usuarios): manifestador.id manifestador.descricao manifestador.nome manifestador.senha manifestador.forca_troca_senha manifestador.email manifestador.stRemovido
obsConhecimento (transp_observacoesConhecimento): obsConhecimento.conhecimentoTransporte_id obsConhecimento.tipoObservacao obsConhecimento.observacao
obsConhecimentoPV (transp_observacoesConhecimento): obsConhecimentoPV.conhecimentoTransporte_id obsConhecimentoPV.tipoObservacao obsConhecimentoPV.observacao
motivoCancelamento (transp_observacoesConhecimento): motivoCancelamento.conhecimentoTransporte_id motivoCancelamento.tipoObservacao motivoCancelamento.observacao
transp_perfisApropriacao: transp_perfisApropriacao.id transp_perfisApropriacao.nome transp_perfisApropriacao.stAtivo transp_perfisApropriacao.cod_rateio transp_perfisApropriacao.tipo transp_perfisApropriacao.cod_gerencial_receita transp_perfisApropriacao.cod_gerencial_receita_fob
docRef (transp_conhecimentoTransporteDocReferencia): docRef.id docRef.conhecimento_id docRef.docReferencia docRef.tomador_id docRef.modelo docRef.serie docRef.subserie
outrosVal (transp_conhecimentoTransporteComposicaoOutros): outrosVal.conhecimentoTransporte_id outrosVal.tipoValoresOutros_id outrosVal.valor
transp_despesasExtras: transp_despesasExtras.id transp_despesasExtras.conhecimento_id transp_despesasExtras.fornecedor_id transp_despesasExtras.valor transp_despesasExtras.observacao transp_despesasExtras.tipoDespesasExtras_id transp_despesasExtras.tipoDocumento
fornecedorDespesasExtras (pessoasPessoas): fornecedorDespesasExtras.id fornecedorDespesasExtras.carteiras_id fornecedorDespesasExtras.cod_localidade fornecedorDespesasExtras.fisica_juridica fornecedorDespesasExtras.CNPJ fornecedorDespesasExtras.razao_social fornecedorDespesasExtras.CI
transp_tiposDespesasExtras: transp_tiposDespesasExtras.id transp_tiposDespesasExtras.descricao transp_tiposDespesasExtras.nomeInterno transp_tiposDespesasExtras.operacaoFinanceira transp_tiposDespesasExtras.codGerencialFaturaPagar_id transp_tiposDespesasExtras.codGerencialFaturaReceber_id transp_tiposDespesasExtras.codRateioFaturaPagar_id transp_tiposDespesasExtras.codRateioFaturaReceber_id transp_tiposDespesasExtras.tipoDocFaturaPagar transp_tiposDespesasExtras.tipoDocFaturaReceber transp_tiposDespesasExtras.comportamentoRelMultEmpresa transp_tiposDespesasExtras.definirTipoDocFaturaPagar transp_tiposDespesasExtras.definirTipoDocFaturaReceber transp_tiposDespesasExtras.formaApropriacaoFaturaPagar transp_tiposDespesasExtras.empresaFatura transp_tiposDespesasExtras.tipo transp_tiposDespesasExtras.permiteDefinirInfoVencimento transp_tiposDespesasExtras.numeracaoFaturaPagar transp_tiposDespesasExtras.numeracaoFaturaReceber transp_tiposDespesasExtras.dataEmissaoFatura transp_tiposDespesasExtras.dataEntradaFatura transp_tiposDespesasExtras.permite_definir_tipo_pagamento transp_tiposDespesasExtras.replicar_obs_titulo transp_tiposDespesasExtras.obriga_vinculo_documento
usuarioDespesasExtras (ambiente_usuarios): usuarioDespesasExtras.id usuarioDespesasExtras.descricao usuarioDespesasExtras.nome usuarioDespesasExtras.senha usuarioDespesasExtras.forca_troca_senha usuarioDespesasExtras.email usuarioDespesasExtras.stRemovido
tipoOutro (transp_tiposValoresOutrosReais): tipoOutro.id tipoOutro.nomeInterno tipoOutro.descricao tipoOutro.imprimir tipoOutro.ativo tipoOutro.totalizaOutrosCTRC tipoOutro.tipo
tagsCTeVal (transp_conhecimentoTransporteTagsCTe): tagsCTeVal.conhecmento_id tagsCTeVal.tagCTe_id tagsCTeVal.valor
tagsCTe (transp_tagsCTe): tagsCTe.id tagsCTe.nomeInterno tagsCTe.descricao tagsCTe.ativo tagsCTe.incluirNoXML tagsCTe.qlTag tagsCTe.imprime_no_dacte_remover
prevInicioViagem (transp_conhecimentoTransporteEventos): prevInicioViagem.conhecimento_id prevInicioViagem.tpEvento prevInicioViagem.nSeq prevInicioViagem.nProt prevInicioViagem.dhRecbto prevInicioViagem.usuario_id
`;

// Converte o texto bruto acima em entradas {grupo, exp, label}. Aceita tanto
// "grupo (tabela): ..." quanto "grupo: ..." (sem parênteses). Remove duplicatas
// (o texto original tem alguns campos repetidos). O label leva o grupo entre
// parênteses pra IA nunca confundir "id"/"nome"/"tipo" de tabelas diferentes.
function _parseDemaisCampos(raw) {
    const resultado = [];
    const vistos = new Set();
    raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(linha => {
        const m = linha.match(/^(\S+?)\s*(?:\(([^)]*)\))?:\s*(.+)$/);
        if (!m) return;
        const grupo = m[1];
        m[3].trim().split(/\s+/).forEach(tok => {
            if (vistos.has(tok)) return;
            vistos.add(tok);
            const dot = tok.indexOf('.');
            if (dot < 0) return;
            const campo = tok.substring(dot + 1);
            resultado.push({ grupo: `Demais campos: ${grupo}`, exp: tok, label: `${campo} (${grupo})` });
        });
    });
    return resultado;
}

// Mapeia a chave interna do catálogo (usada em CATALOGO_RELATORIOS e nos botões de Origem)
// para o valor real que deve ser gravado no campo "origem" do .dat. Ambos os valores (CTe e
// ContratoFrete = "CF") foram validados byte a byte contra arquivos de exemplo reais.
const _ORIGEM_VALOR_DAT = { CTe: 'CTe', ContratoFrete: 'CF' };

// Catálogo de campos disponíveis por origem.
const CATALOGO_RELATORIOS = {
    CTe: [
        { grupo: 'Ct-e', exp: 'cte.agencia', label: 'Agência' },
        { grupo: 'Ct-e', exp: 'cte.anoSaida', label: 'Ano Emissão' },
        { grupo: 'Ct-e', exp: 'cte.cancelado', label: 'Cancelado?' },
        { grupo: 'Ct-e', exp: 'cte.cfop', label: 'CFOP' },
        { grupo: 'Ct-e', exp: 'cte.chave', label: 'Chave' },
        { grupo: 'Ct-e', exp: 'cte.cidadeDestino', label: 'Cidade Destino' },
        { grupo: 'Ct-e', exp: 'cte.cidadeOrigem', label: 'Cidade Origem' },
        { grupo: 'Ct-e', exp: 'cte.codCidadeDestino', label: 'Código Cidade Destino' },
        { grupo: 'Ct-e', exp: 'cte.codCidadeOrigem', label: 'Código Cidade Origem' },
        { grupo: 'Ct-e', exp: 'cte.complementoPedido', label: 'Complemento do Pedido' },
        { grupo: 'Ct-e', exp: 'cte.cst', label: 'CST' },
        { grupo: 'Ct-e', exp: 'cte.diaSaida', label: 'Dia Emissão' },
        { grupo: 'Ct-e', exp: 'cte.dtCancelamento', label: 'Data Cancelamento' },
        { grupo: 'Ct-e', exp: 'cte.dtEmissao', label: 'Data Emissão' },
        { grupo: 'Ct-e', exp: 'cte.dtPrevChegada', label: 'Data Previsão Chegada' },
        { grupo: 'Ct-e', exp: 'cte.dtPrevInicio', label: 'Data Previsão Início' },
        { grupo: 'Ct-e', exp: 'cte.ehCTe', label: 'É CT-e' },
        { grupo: 'Ct-e', exp: 'cte.manifestador', label: 'Manifestador' },
        { grupo: 'Ct-e', exp: 'cte.mesSaida', label: 'Mês Emissão' },
        { grupo: 'Ct-e', exp: 'cte.motivoCancelamento', label: 'Motivo Cancelamento' },
        { grupo: 'Ct-e', exp: 'cte.naturezaOperacao', label: 'Natureza da Operação' },
        { grupo: 'Ct-e', exp: 'cte.nroCteComplementado', label: 'Número CT-e Complementado' },
        { grupo: 'Ct-e', exp: 'cte.nroCteSubstituido', label: 'Número CT-e Substituído' },
        { grupo: 'Ct-e', exp: 'cte.observacaoConhecimento', label: 'Observação do Conhecimento' },
        { grupo: 'Ct-e', exp: 'cte.observacaoConhecimentoPV', label: 'Observação do Conhecimento (PV)' },
        { grupo: 'Ct-e', exp: 'cte.perfilApropriacao', label: 'Perfil de Apropriação' },
        { grupo: 'Ct-e', exp: 'cte.serie', label: 'Série' },
        { grupo: 'Ct-e', exp: 'cte.talao', label: 'Talão' },
        { grupo: 'Ct-e', exp: 'cte.tipo', label: 'Tipo' },
        { grupo: 'Ct-e', exp: 'cte.tomadorServico', label: 'Tomador do Serviço' },
        { grupo: 'Ct-e', exp: 'cte.ufDestino', label: 'UF Destino' },
        { grupo: 'Ct-e', exp: 'cte.ufOrigem', label: 'UF Origem' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.aliq', label: 'Alíquota' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.baseCalculo', label: 'Base de Cálculo' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.diaria', label: 'Diária' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.freteValor', label: 'Valor do Frete' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.outros', label: 'Outros' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.pedagio', label: 'Pedágio' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.seguro', label: 'Seguro' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.tarifaFinal', label: 'Tarifa Final' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.tarifaReal', label: 'Tarifa Real' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.totalPrestacao', label: 'Total da Prestação' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.totalServico', label: 'Total do Serviço' },
        { grupo: 'Composição do frete', exp: 'composicaoFrete.valorICMS', label: 'Valor ICMS' },
        { grupo: 'Veículos', exp: 'veiculos.categoriaVeiculo', label: 'Categoria do Veículo' },
        { grupo: 'Veículos', exp: 'veiculos.conjuntoVeiculos', label: 'Conjunto de Veículos' },
        { grupo: 'Veículos', exp: 'veiculos.frotaPropria', label: 'Frota Própria' },
        { grupo: 'Veículos', exp: 'veiculos.grupoVeiculo', label: 'Grupo do Veículo' },
        { grupo: 'Veículos', exp: 'veiculos.marcaVeiculo', label: 'Marca do Veículo' },
        { grupo: 'Veículos', exp: 'veiculos.modeloVeiculo', label: 'Modelo do Veículo' },
        { grupo: 'Veículos', exp: 'veiculos.placaCarreta', label: 'Placa Carreta' },
        { grupo: 'Veículos', exp: 'veiculos.placaQuartoVeiculo', label: 'Placa Quarto Veículo' },
        { grupo: 'Veículos', exp: 'veiculos.placaSemireboque', label: 'Placa Semirreboque' },
        { grupo: 'Veículos', exp: 'veiculos.placaVeiculo', label: 'Placa Veículo' },
        { grupo: 'Veículos', exp: 'veiculos.proprietario', label: 'Proprietário' },
        { grupo: 'Veículos', exp: 'veiculos.proprietarioCarreta', label: 'Proprietário Carreta' },
        { grupo: 'Veículos', exp: 'veiculos.proprietarioQuartoVeiculo', label: 'Proprietário Quarto Veículo' },
        { grupo: 'Veículos', exp: 'veiculos.proprietarioSemireboque', label: 'Proprietário Semirreboque' },
        { grupo: 'Seguro', exp: 'seguro.acobertaRoubo', label: 'Acoberta Roubo' },
        { grupo: 'Seguro', exp: 'seguro.apolice', label: 'Apólice' },
        { grupo: 'Seguro', exp: 'seguro.proprio', label: 'Próprio' },
        { grupo: 'Seguro', exp: 'seguro.responsavel', label: 'Responsável' },
        { grupo: 'Documentos', exp: 'docs.quantidade', label: 'Quantidade de Documentos' },
        { grupo: 'Documentos', exp: 'docs.somaCubagem', label: 'Soma Cubagem' },
        { grupo: 'Documentos', exp: 'docs.somaPesos', label: 'Soma Pesos' },
        { grupo: 'Documentos', exp: 'docs.somaValores', label: 'Soma Valores' },
        { grupo: 'Documentos', exp: 'docs.somaValoresProdutos', label: 'Soma Valores dos Produtos' },
        { grupo: 'Conteineres', exp: 'containers.nroContainers', label: 'Número de Containers' },
        { grupo: 'Conteineres', exp: 'containers.quantidade', label: 'Quantidade de Containers' },
        { grupo: 'Conteineres', exp: 'containers.somaValores', label: 'Soma Valores Containers' },
        { grupo: 'Conteineres', exp: 'containers.tamanhoContainers', label: 'Tamanho dos Containers' },
        ..._CAT_PESSOA('cliente', 'Cliente', ['CNPJ', 'IE', 'bairro', 'celular', 'cidade', 'documentoFormatado', 'endereco_telefone1', 'endereco_telefone2', 'inscricao_estadual', 'nome', 'numero', 'razaoSocial', 'rua', 'telefone', 'uf']),
        ..._CAT_PESSOA('emissor', 'Emissor', ['CNPJ', 'IE', 'celular', 'descricao', 'empresa', 'endereco_telefone1', 'endereco_telefone2', 'inscricao_estadual', 'razaoSocial', 'telefone']),
        { grupo: 'Manifesto de carga', exp: 'transp_manifestoCarga.dtEmissao', label: 'Data Emissão do Manifesto' },
        { grupo: 'Manifesto de carga', exp: 'transp_manifestoCarga.dtSaida', label: 'Data Saída do Manifesto' },
        { grupo: 'Manifesto de carga', exp: 'transp_manifestoCarga.nro', label: 'Número do Manifesto' },
        ..._CAT_PESSOA('motorista', 'Motorista', ['IE', 'celular', 'cpf', 'endereco_telefone1', 'endereco_telefone2', 'inscricao_estadual', 'nome', 'rg', 'telefone']),
        { grupo: 'Faturamento', exp: 'faturamento.dtEmissao', label: 'Data Emissão da Fatura' },
        { grupo: 'Faturamento', exp: 'faturamento.dtVencimento', label: 'Data Vencimento' },
        { grupo: 'Faturamento', exp: 'faturamento.nroFatura', label: 'Número da Fatura' },
        ..._CAT_PESSOA('remetente', 'Remetente', ['CNPJ', 'IE', 'bairro', 'celular', 'cep', 'cidade', 'documentoFormatado', 'endereco_telefone1', 'endereco_telefone2', 'inscricao_estadual', 'nome', 'numero', 'razaoSocial', 'rua', 'telefone', 'uf']),
        ..._CAT_PESSOA('destinatario', 'Destinatário', ['CNPJ', 'IE', 'bairro', 'celular', 'cep', 'cidade', 'documentoFormatado', 'endereco_telefone1', 'endereco_telefone2', 'nome', 'numero', 'razaoSocial', 'rua', 'telefone', 'uf']),
        ..._CAT_PESSOA('expedidor', 'Expedidor', ['CNPJ', 'IE', 'bairro', 'celular', 'cep', 'cidade', 'documentoFormatado', 'endereco_telefone1', 'endereco_telefone2', 'inscricao_estadual', 'nome', 'numero', 'razaoSocial', 'rua', 'telefone', 'uf']),
        ..._CAT_PESSOA('recebedor', 'Recebedor', ['CNPJ', 'IE', 'bairro', 'celular', 'cep', 'cidade', 'documentoFormatado', 'endereco_telefone1', 'endereco_telefone2', 'inscricao_estadual', 'nome', 'numero', 'razaoSocial', 'rua', 'telefone', 'uf']),
        ..._CAT_PESSOA('contratado', 'Contratado', ['CNPJ', 'IE', 'bairro', 'celular', 'cep', 'cidade', 'documentoFormatado', 'endereco_telefone1', 'endereco_telefone2', 'inscricao_estadual', 'nome', 'numero', 'razaoSocial', 'rua', 'telefone', 'uf']),
        { grupo: 'Notas fiscais', exp: 'notasFiscais.NCM', label: 'NCM' },
        { grupo: 'Notas fiscais', exp: 'notasFiscais.chaveNotas', label: 'Chave das Notas' },
        { grupo: 'Notas fiscais', exp: 'notasFiscais.especies', label: 'Espécies' },
        { grupo: 'Notas fiscais', exp: 'notasFiscais.naturezasCarga', label: 'Natureza da Carga' },
        { grupo: 'Notas fiscais', exp: 'notasFiscais.nroNotas', label: 'Número das Notas' },
        { grupo: 'Notas fiscais', exp: 'notasFiscais.valorNotas', label: 'Valor das Notas' },
        { grupo: 'Pedido', exp: 'pedido.numero', label: 'Número do Pedido' },
        { grupo: 'Doc. Anterior', exp: 'docRef.chaveCTe', label: 'Chave do CT-e (Doc. Anterior)' },
        { grupo: 'Doc. Anterior', exp: 'docRef.dtEmissao', label: 'Data Emissão (Doc. Anterior)' },
        { grupo: 'Doc. Anterior', exp: 'docRef.numero', label: 'Número (Doc. Anterior)' },
        { grupo: 'Doc. Anterior', exp: 'docRef.numeroCTe', label: 'Número do CT-e (Doc. Anterior)' },
        { grupo: 'Doc. Anterior', exp: 'docRef.referencia', label: 'Referência (Doc. Anterior)' },
        { grupo: 'Doc. Anterior', exp: 'docRef.serie', label: 'Série (Doc. Anterior)' },
        { grupo: 'Doc. Anterior', exp: 'docRef.valor', label: 'Valor (Doc. Anterior)' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.dataLancamento', label: 'Data Lançamento' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.fornecedor', label: 'Fornecedor' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.nroDocumento', label: 'Número do Documento' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.observacao', label: 'Observação' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.tipo', label: 'Tipo' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.tipoDocumento', label: 'Tipo de Documento' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.usuarioLancamento', label: 'Usuário do Lançamento' },
        { grupo: 'Despesas extras', exp: 'despesasExtras.valor', label: 'Valor' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.baseCalculoCBSIBS', label: 'Base de Cálculo CBS/IBS' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.cbsAliquota', label: 'Alíquota CBS' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.cbsValor', label: 'Valor CBS' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.codigoClassificacaoTributaria', label: 'Código de Classificação Tributária' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.cst', label: 'CST (CBS/IBS)' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.ibsEstadualAliquota', label: 'Alíquota IBS Estadual' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.ibsEstadualValor', label: 'Valor IBS Estadual' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.ibsMunicipalAliquota', label: 'Alíquota IBS Municipal' },
        { grupo: 'Impostos CBS e IBS', exp: 'impostosCbsIbs.ibsMunicipalValor', label: 'Valor IBS Municipal' }
    ]
};
// Mescla o dump técnico "Demais campos" de uma origem no catálogo curado dela. Campos que já
// existem no catálogo curado (com rótulo amigável) são ignorados — o rótulo amigável vale
// sozinho. Só entra o que é realmente novo. Reaproveitado por CTe, ContratoFrete etc.
function _mesclarDemaisCampos(origemKey, rawText) {
    const jaExiste = new Set(CATALOGO_RELATORIOS[origemKey].map(c => c.exp));
    _parseDemaisCampos(rawText).forEach(c => {
        if (jaExiste.has(c.exp)) return;
        jaExiste.add(c.exp);
        CATALOGO_RELATORIOS[origemKey].push(c);
    });
}
_mesclarDemaisCampos('CTe', _DEMAIS_CAMPOS_RAW_CTE);

// ─── Origem: Contrato de Frete ───────────────────────────────────────────────
// Origem gravada no .dat: "CF" — confirmada byte a byte contra um arquivo de exemplo real
// (Exemplo_contrato_de_frete.dat).
CATALOGO_RELATORIOS.ContratoFrete = [
    { grupo: 'Contrato de Frete', exp: 'CF.contaDeposito', label: 'Conta Depósito' },
    { grupo: 'Contrato de Frete', exp: 'CF.descricaoUsuarioUltimaAlteracao', label: 'Descrição do Usuário (Última Alteração)' },
    { grupo: 'Contrato de Frete', exp: 'CF.destino', label: 'Destino' },
    { grupo: 'Contrato de Frete', exp: 'CF.emissao', label: 'Emissão' },
    { grupo: 'Contrato de Frete', exp: 'CF.fimViagem', label: 'Fim da Viagem' },
    { grupo: 'Contrato de Frete', exp: 'CF.inicioViagem', label: 'Início da Viagem' },
    { grupo: 'Contrato de Frete', exp: 'CF.nomeUsuarioUltimaAlteracao', label: 'Nome do Usuário (Última Alteração)' },
    { grupo: 'Contrato de Frete', exp: 'CF.nroRecibo', label: 'Número do Recibo' },
    { grupo: 'Contrato de Frete', exp: 'CF.obs', label: 'Observação' },
    { grupo: 'Contrato de Frete', exp: 'CF.pagamento', label: 'Pagamento' },
    { grupo: 'Contrato de Frete', exp: 'CF.usuarioFechouNegocio', label: 'Usuário que Fechou o Negócio' },
    { grupo: 'Valores envolvidos', exp: 'valores.adiantamento', label: 'Adiantamento' },
    { grupo: 'Valores envolvidos', exp: 'valores.baseCalculoIRRF', label: 'Base de Cálculo IRRF' },
    { grupo: 'Valores envolvidos', exp: 'valores.combustivel', label: 'Combustível' },
    { grupo: 'Valores envolvidos', exp: 'valores.complemento', label: 'Complemento' },
    { grupo: 'Valores envolvidos', exp: 'valores.cubagem', label: 'Cubagem' },
    { grupo: 'Valores envolvidos', exp: 'valores.descontoINSS', label: 'Desconto INSS' },
    { grupo: 'Valores envolvidos', exp: 'valores.descontoIRRF', label: 'Desconto IRRF' },
    { grupo: 'Valores envolvidos', exp: 'valores.descontoQuebraPeso', label: 'Desconto Quebra de Peso' },
    { grupo: 'Valores envolvidos', exp: 'valores.descontoQuebraPesoReal', label: 'Desconto Quebra de Peso Real' },
    { grupo: 'Valores envolvidos', exp: 'valores.descontoSEST', label: 'Desconto SEST/SENAT' },
    { grupo: 'Valores envolvidos', exp: 'valores.descontoSeguro', label: 'Desconto de Seguro' },
    { grupo: 'Valores envolvidos', exp: 'valores.diaria', label: 'Diária' },
    { grupo: 'Valores envolvidos', exp: 'valores.outrosAcrescimos', label: 'Outros Acréscimos' },
    { grupo: 'Valores envolvidos', exp: 'valores.outrosDescontos', label: 'Outros Descontos' },
    { grupo: 'Valores envolvidos', exp: 'valores.pesoChegada', label: 'Peso Chegada' },
    { grupo: 'Valores envolvidos', exp: 'valores.pesoChegadaReal', label: 'Peso Chegada Real' },
    { grupo: 'Valores envolvidos', exp: 'valores.pesoColeta', label: 'Peso Coleta' },
    { grupo: 'Valores envolvidos', exp: 'valores.saldo', label: 'Saldo' },
    { grupo: 'Valores envolvidos', exp: 'valores.saldoCombustivel', label: 'Saldo Combustível' },
    { grupo: 'Valores envolvidos', exp: 'valores.tarifaMotorista', label: 'Tarifa do Motorista' },
    { grupo: 'Valores envolvidos', exp: 'valores.tarifaMotoristaDigitada', label: 'Tarifa do Motorista Digitada' },
    { grupo: 'Valores envolvidos', exp: 'valores.tolerancia', label: 'Tolerância' },
    { grupo: 'Valores envolvidos', exp: 'valores.valorPedagio', label: 'Valor do Pedágio' },
    { grupo: 'Valores envolvidos', exp: 'valores.valorTotalOrigem', label: 'Valor Total Origem' },
    { grupo: 'Valores envolvidos', exp: 'valores.volumesColeta', label: 'Volumes Coleta' },
    ..._CAT_PESSOA('motorista', 'Motorista', ['RG', 'bairro', 'cidade', 'codCidade', 'dataNascimento', 'documento', 'mae', 'matriculaINSS', 'nome', 'numero', 'rua']),
    ..._CAT_PESSOA('contratado', 'Contratado', ['RG', 'RNTRC', 'bairro', 'cidade', 'codCidade', 'dataCadastro', 'dataNascimento', 'documento', 'inscricaoEstadual', 'matriculaINSS', 'nome', 'numero', 'rua']),
    { grupo: 'Veículo', exp: 'veiculo.categoriaVeiculo', label: 'Categoria do Veículo' },
    { grupo: 'Veículo', exp: 'veiculo.frotaPropria', label: 'Frota Própria' },
    { grupo: 'Veículo', exp: 'veiculo.placa', label: 'Placa' },
    { grupo: 'Veículo', exp: 'veiculo.proprietario', label: 'Proprietário' },
    { grupo: 'Despesas Extras', exp: 'despesasExtras.fornecedor', label: 'Fornecedor' },
    { grupo: 'Despesas Extras', exp: 'despesasExtras.observacao', label: 'Observação' },
    { grupo: 'Despesas Extras', exp: 'despesasExtras.quantidade', label: 'Quantidade' },
    { grupo: 'Despesas Extras', exp: 'despesasExtras.valor', label: 'Valor' },
    { grupo: 'Documentos vinculados', exp: 'documentosVinculados.emissao', label: 'Emissão' },
    { grupo: 'Documentos vinculados', exp: 'documentosVinculados.numero', label: 'Número' },
    { grupo: 'Documentos vinculados', exp: 'documentosVinculados.valorNotasFiscais', label: 'Valor das Notas Fiscais' },
    { grupo: 'Pontos intermediários', exp: 'pontosIntermediarios.codIBGE', label: 'Código IBGE' },
    { grupo: 'Pontos intermediários', exp: 'pontosIntermediarios.municipio', label: 'Município' }
];

const _DEMAIS_CAMPOS_RAW_CF = `
CF (transp_reciboFreteReais): CF.id CF.agencias_id CF.tiposTaloes_id CF.nroRecibo CF.dtEmissao CF.dataCriacao CF.motorista_id CF.favorecido_id CF.veiculos_id CF.carreta_id CF.semireboque_id CF.quartoVeiculo_id CF.valorFrete CF.valorPedagio CF.valorPedagioConhecimento CF.valorUnitarioMercadoria CF.regrasCarreto_id CF.tolerancia CF.pesoColeta CF.volumesColeta CF.tarifaMotoristaCalculada CF.tarifaMotoristaDigitada CF.valorTotalOrigem CF.outrosDescontos CF.outrosAcrescimos CF.descontoINSS CF.totalDescontoINSS CF.descontoSEST CF.totalDescontoSEST CF.descontoIRRF CF.freteLiquido CF.valorAdiantamento CF.valorCombustivel CF.pesoChegada CF.descontoQuebraPeso CF.saldo CF.saldoCombustivel CF.pesoChegadaReal CF.descontoQuebraPesoReal CF.valorFaturado CF.tarifaImpressa CF.parcelarAdiantamento CF.valorComplemento CF.diariaFrete CF.statusCancelado CF.impresso CF.reciboFretePrincipal_id CF.descontoSeguro CF.baseCalculoIRRF CF.forcarCalculoIRRF CF.obs CF.contasDeposito_id CF.tipoDocumento CF.formaPagamento CF.operadoraCredito_id CF.nroCartaoOperadoraCredito CF.nroContratoOperadora CF.veiculoGruposVeiculos_id CF.veiculoProprietario_id CF.veiculoAlienado_id CF.veiculoArrendatario_id CF.carretaGruposVeiculos_id CF.carretaProprietario_id CF.carretaAlienado_id CF.carretaArrendatario_id CF.semiReboqueGruposVeiculos_id CF.semiReboqueProprietario_id CF.semiReboqueAlienado_id CF.semiReboqueArrendatario_id CF.quartoVeiculoGruposVeiculos_id CF.quartoVeiculoProprietario_id CF.quartoVeiculoAlienado_id CF.quartoVeiculoArrendatario_id CF.CIOT CF.registrado CF.cidadeOrigem_id CF.cidadeDestino_id CF.dtInicioViagem CF.dtFimViagem CF.docsOriginalIntegracao CF.rascunho CF.dependentesIRRF CF.baseResultadoCF CF.descontoMesINSSFavorecido CF.informarDocs CF.usuarioUltimaAlteracao_id CF.enderecoRemetenteContrato_id CF.enderecoDestinatarioContrato_id CF.enderecoConsignatarioContrato_id CF.viaEmissorGratuito CF.formaPagamentoOperadora CF.statusOperadora CF.integracaoEmAndamento CF.cubagem CF.perfisApropriacao_id CF.formaApropriacao CF.solucaoPedagio CF.tabelaPrecosReciboFrete_id CF.kms CF.dtPrevisaoPagamento CF.tipoQuebra CF.cepOrigem CF.cepDestino CF.enderecoRedespachoContrato_id CF.usuarioFechouNegocio_id CF.NCM CF.tipoCFe CF.solucaoCombustivel CF.exportavel CF.dataAtualizacao CF.usuario_emissor_contrato_id CF.tipos_pagamentos_id CF.tipo_operacao CF.latitude_origem CF.longitude_origem CF.latitude_destino CF.longitude_destino CF.tipo_pontos_ciot
contratado (pessoasPessoas): contratado.id contratado.carteiras_id contratado.cod_localidade contratado.fisica_juridica contratado.CNPJ contratado.razao_social contratado.CI contratado.descricao contratado.nome contratado.sobrenome contratado.email contratado.site contratado.data_cadastro contratado.observacoes contratado.data_nascimento contratado.profissao contratado.sexo contratado.contato_tecnico_id contratado.contato_administrativo_id contratado.cod_fiscal_cliente contratado.cod_fiscal_fornecedor contratado.cnh contratado.categoria contratado.dtExpedicao contratado.dtPrimeiraExpedicao contratado.dtValidade contratado.orgaoExpedidor contratado.limite_credito contratado.matriculaINSS contratado.apelido contratado.celular contratado.cod_fiscal_processos contratado.telResidencial contratado.protocoloCNH contratado.naturalidade contratado.nacionalidade contratado.pai contratado.mae contratado.outrosTels contratado.PIS_PASEP contratado.referencias contratado.usuarios_id contratado.ultimaAtualizacao contratado.preferenciaImpressaoNF contratado.bloqueado contratado.grupoDespesaEspecifico contratado.contas_id contratado.estado_civil contratado.identificador contratado.alvara contratado.conjuge contratado.cnae_id contratado.escala contratado.protestar contratado.nroDiasProtesto contratado.logo contratado.codISSQNAtividadePrincipal contratado.statusPessoa_id contratado.enquadramento contratado.consultor_id contratado.CI_Estado contratado.naturalidadeEstado contratado.categoriaCRM contratado.emailCobranca contratado.documentoFormatado contratado.emissaoRG contratado.lotacao_id contratado.nit contratado.RNTRC contratado.tipoTransportadora contratado.IEC contratado.dependentesIRRF contratado.CI_orgaoExpedidor contratado.suframa contratado.seguroCNH contratado.emailCotacaoEstoque contratado.celularNumerico contratado.grauInstruTrabalhador contratado.paisNascimento_id contratado.paisNacionalidade_id contratado.numeroCTPS contratado.serieCTPS contratado.ufExpedicaoCTPS contratado.raca contratado.radicalCNPJ contratado.emailOcorrenciasTransporte contratado.receberPesquisaAtendimento contratado.naturalidade_id contratado.usuarioCadastro contratado.dtValidadeExameToxicologico contratado.cidadeEmissaoCNH_id contratado.ignoraValidacaoNIS contratado.renachCNH contratado.CI_orgaoExpedidor_mdm contratado.nome_social
usuarioFechouNegocio (ambiente_usuarios): usuarioFechouNegocio.id usuarioFechouNegocio.descricao usuarioFechouNegocio.nome usuarioFechouNegocio.senha usuarioFechouNegocio.forca_troca_senha usuarioFechouNegocio.email usuarioFechouNegocio.stRemovido
enderecoContratado (pessoasEnderecosPessoas): enderecoContratado.id enderecoContratado.pessoas_id enderecoContratado.pessoasInativo_id enderecoContratado.cep enderecoContratado.endereco enderecoContratado.bairro enderecoContratado.estado enderecoContratado.UF_estrangeiro enderecoContratado.telefone1 enderecoContratado.telefone2 enderecoContratado.fax enderecoContratado.pais enderecoContratado.paises_id enderecoContratado.cobranca_preferencial enderecoContratado.endereco_preferencial enderecoContratado.inscricaoEstadual enderecoContratado.inscricaoMunicipal enderecoContratado.isento enderecoContratado.isencaoMun enderecoContratado.logradouro_id enderecoContratado.localidade enderecoContratado.nro enderecoContratado.complemento enderecoContratado.cidade_id enderecoContratado.historicoAlteracao enderecoContratado.dificilAcesso enderecoContratado.valorColeta enderecoContratado.valorEntrega enderecoContratado.codIBGE enderecoContratado.naoContribuinte enderecoContratado.referencia enderecoContratado.chaveBusca
motorista (pessoasPessoas): motorista.id motorista.carteiras_id motorista.cod_localidade motorista.fisica_juridica motorista.CNPJ motorista.CI motorista.descricao motorista.nome motorista.sobrenome motorista.email motorista.site motorista.data_cadastro motorista.observacoes motorista.data_nascimento motorista.profissao motorista.sexo motorista.contato_tecnico_id motorista.contato_administrativo_id motorista.cod_fiscal_cliente motorista.cod_fiscal_fornecedor motorista.cnh motorista.categoria motorista.dtExpedicao motorista.dtPrimeiraExpedicao motorista.dtValidade motorista.orgaoExpedidor motorista.limite_credito motorista.matriculaINSS motorista.apelido motorista.celular motorista.cod_fiscal_processos motorista.telResidencial motorista.protocoloCNH motorista.naturalidade motorista.nacionalidade motorista.pai motorista.mae motorista.outrosTels motorista.PIS_PASEP motorista.referencias motorista.usuarios_id motorista.ultimaAtualizacao motorista.preferenciaImpressaoNF motorista.bloqueado motorista.grupoDespesaEspecifico motorista.contas_id motorista.estado_civil motorista.identificador motorista.alvara motorista.conjuge motorista.cnae_id motorista.escala motorista.protestar motorista.nroDiasProtesto motorista.logo motorista.codISSQNAtividadePrincipal motorista.statusPessoa_id motorista.enquadramento motorista.consultor_id motorista.CI_Estado motorista.naturalidadeEstado motorista.categoriaCRM motorista.emailCobranca motorista.documentoFormatado motorista.emissaoRG motorista.lotacao_id motorista.nit motorista.RNTRC motorista.tipoTransportadora motorista.IEC motorista.dependentesIRRF motorista.CI_orgaoExpedidor motorista.suframa motorista.seguroCNH motorista.emailCotacaoEstoque motorista.celularNumerico motorista.grauInstruTrabalhador motorista.paisNascimento_id motorista.paisNacionalidade_id motorista.numeroCTPS motorista.serieCTPS motorista.raca motorista.radicalCNPJ motorista.emailOcorrenciasTransporte motorista.receberPesquisaAtendimento motorista.naturalidade_id motorista.usuarioCadastro motorista.dtValidadeExameToxicologico motorista.cidadeEmissaoCNH_id motorista.ignoraValidacaoNIS motorista.renachCNH motorista.CI_orgaoExpedidor_mdm motorista.nome_social
enderecoMotorista (pessoasEnderecosPessoas): enderecoMotorista.id enderecoMotorista.pessoas_id enderecoMotorista.pessoasInativo_id enderecoMotorista.cep enderecoMotorista.endereco enderecoMotorista.bairro enderecoMotorista.cidade enderecoMotorista.estado enderecoMotorista.UF_estrangeiro enderecoMotorista.telefone1 enderecoMotorista.telefone2 enderecoMotorista.fax enderecoMotorista.pais enderecoMotorista.paises_id enderecoMotorista.cobranca_preferencial enderecoMotorista.endereco_preferencial enderecoMotorista.inscricaoEstadual enderecoMotorista.inscricaoMunicipal enderecoMotorista.isento enderecoMotorista.isencaoMun enderecoMotorista.localidade enderecoMotorista.nro enderecoMotorista.complemento enderecoMotorista.cidade_id enderecoMotorista.historicoAlteracao enderecoMotorista.dificilAcesso enderecoMotorista.valorColeta enderecoMotorista.valorEntrega enderecoMotorista.naoContribuinte enderecoMotorista.referencia enderecoMotorista.chaveBusca
origem (bancoCeps.localidades): origem.id origem.localidade origem.uf origem.codIBGE origem.mesoCod origem.codANP origem.usado origem.antigoId origem.codTOM
destino (bancoCeps.localidades): destino.id destino.localidade destino.uf destino.codIBGE destino.mesoCod destino.usado
veiculo (transp_veiculos): veiculo.id veiculo.marcasVeiculos_id veiculo.categoriasVeiculos_id veiculo.favorecido_id veiculo.placa veiculo.cidade
grupoVeiculo (transp_gruposVeiculos): grupoVeiculo.id grupoVeiculo.descricao grupoVeiculo.geraPrevisoesPagamento grupoVeiculo.geraViagem grupoVeiculo.geraCreditoViagem grupoVeiculo.descricaoViagem grupoVeiculo.nroDocViagem grupoVeiculo.valorCreditoViagem grupoVeiculo.cc_pai grupoVeiculo.controlaCentroDeCusto grupoVeiculo.criaEquipamento grupoVeiculo.cod_gerencialCredito grupoVeiculo.lucroMaximo grupoVeiculo.lucroMinimo grupoVeiculo.exibirSite grupoVeiculo.gruposEquipamentos_id grupoVeiculo.empresa_id grupoVeiculo.frotaPropria grupoVeiculo.modoApropriacao grupoVeiculo.valorAdiantamento grupoVeiculo.contas_financeiras_id grupoVeiculo.spedNaturezaCreditos grupoVeiculo.spedIndicadorCredito grupoVeiculo.ativo grupoVeiculo.alertarNotaTecnica2021002 grupoVeiculo.criarFinalidadeMovimentacao
proprietarioVeiculo (pessoasPessoas): proprietarioVeiculo.id proprietarioVeiculo.carteiras_id proprietarioVeiculo.cod_localidade proprietarioVeiculo.fisica_juridica proprietarioVeiculo.CNPJ proprietarioVeiculo.razao_social proprietarioVeiculo.CI proprietarioVeiculo.descricao proprietarioVeiculo.nome proprietarioVeiculo.sobrenome proprietarioVeiculo.email proprietarioVeiculo.site proprietarioVeiculo.data_cadastro proprietarioVeiculo.observacoes proprietarioVeiculo.data_nascimento proprietarioVeiculo.profissao proprietarioVeiculo.sexo proprietarioVeiculo.contato_tecnico_id proprietarioVeiculo.contato_administrativo_id proprietarioVeiculo.cod_fiscal_cliente proprietarioVeiculo.cod_fiscal_fornecedor proprietarioVeiculo.cnh proprietarioVeiculo.categoria proprietarioVeiculo.dtExpedicao proprietarioVeiculo.dtPrimeiraExpedicao proprietarioVeiculo.dtValidade proprietarioVeiculo.orgaoExpedidor proprietarioVeiculo.limite_credito proprietarioVeiculo.apelido proprietarioVeiculo.celular proprietarioVeiculo.cod_fiscal_processos proprietarioVeiculo.telResidencial proprietarioVeiculo.protocoloCNH proprietarioVeiculo.naturalidade proprietarioVeiculo.nacionalidade proprietarioVeiculo.pai proprietarioVeiculo.mae proprietarioVeiculo.outrosTels proprietarioVeiculo.PIS_PASEP proprietarioVeiculo.referencias proprietarioVeiculo.usuarios_id proprietarioVeiculo.ultimaAtualizacao proprietarioVeiculo.preferenciaImpressaoNF proprietarioVeiculo.bloqueado proprietarioVeiculo.grupoDespesaEspecifico proprietarioVeiculo.contas_id proprietarioVeiculo.estado_civil proprietarioVeiculo.identificador proprietarioVeiculo.alvara proprietarioVeiculo.conjuge proprietarioVeiculo.cnae_id proprietarioVeiculo.escala proprietarioVeiculo.protestar proprietarioVeiculo.nroDiasProtesto proprietarioVeiculo.logo proprietarioVeiculo.codISSQNAtividadePrincipal proprietarioVeiculo.statusPessoa_id proprietarioVeiculo.enquadramento proprietarioVeiculo.consultor_id proprietarioVeiculo.CI_Estado proprietarioVeiculo.naturalidadeEstado proprietarioVeiculo.categoriaCRM proprietarioVeiculo.emailCobranca proprietarioVeiculo.documentoFormatado proprietarioVeiculo.emissaoRG proprietarioVeiculo.lotacao_id proprietarioVeiculo.nit proprietarioVeiculo.RNTRC proprietarioVeiculo.tipoTransportadora proprietarioVeiculo.IEC proprietarioVeiculo.dependentesIRRF proprietarioVeiculo.CI_orgaoExpedidor proprietarioVeiculo.suframa proprietarioVeiculo.seguroCNH proprietarioVeiculo.emailCotacaoEstoque proprietarioVeiculo.celularNumerico proprietarioVeiculo.grauInstruTrabalhador proprietarioVeiculo.paisNascimento_id proprietarioVeiculo.paisNacionalidade_id proprietarioVeiculo.numeroCTPS proprietarioVeiculo.serieCTPS proprietarioVeiculo.ufExpedicaoCTPS proprietarioVeiculo.raca proprietarioVeiculo.radicalCNPJ proprietarioVeiculo.emailOcorrenciasTransporte proprietarioVeiculo.receberPesquisaAtendimento proprietarioVeiculo.naturalidade_id proprietarioVeiculo.usuarioCadastro proprietarioVeiculo.dtValidadeExameToxicologico proprietarioVeiculo.cidadeEmissaoCNH_id proprietarioVeiculo.ignoraValidacaoNIS proprietarioVeiculo.renachCNH proprietarioVeiculo.CI_orgaoExpedidor_mdm proprietarioVeiculo.nome_social
outrosVal (transp_reciboFreteComposicaoOutros): outrosVal.reciboFrete_id outrosVal.tipoValoresOutros_id outrosVal.valor
tipoOutro (transp_tiposValoresOutrosReais): tipoOutro.id tipoOutro.nomeInterno tipoOutro.descricao tipoOutro.imprimir tipoOutro.ativo tipoOutro.totalizaOutrosCTRC tipoOutro.tipo tipoOutro.tipoMoeda tipoOutro.visivelCRT tipoOutro.tagComposicao tipoOutro.visivelCotacao tipoOutro.visivelCTe tipoOutro.visivelCTeOS tipoOutro.visivelCTNaoFiscal tipoOutro.obrigaAplicacaoRegra tipoOutro.descricaoImportacaoXMLCTe tipoOutro.imprimeNaCotacaoDeFrete
usuarioAlteracao (ambiente_usuarios): usuarioAlteracao.id usuarioAlteracao.descricao usuarioAlteracao.nome usuarioAlteracao.senha usuarioAlteracao.forca_troca_senha usuarioAlteracao.email usuarioAlteracao.stRemovido usuarioAlteracao.inicioAcesso usuarioAlteracao.inicioAcessoAnterior usuarioAlteracao.ultimoAcessoTime usuarioAlteracao.sessionId usuarioAlteracao.ipAnterior usuarioAlteracao.ip usuarioAlteracao.ipProxy usuarioAlteracao.fuso usuarioAlteracao.telefone usuarioAlteracao.atualizou usuarioAlteracao.atualizarPermissoes usuarioAlteracao.dataCadastro usuarioAlteracao.sessionIdApp usuarioAlteracao.ultimoAcessoTimeApp usuarioAlteracao.validadeTrocaSenha usuarioAlteracao.somenteLeitura usuarioAlteracao.acessosAutorizados usuarioAlteracao.bloquearAcesso usuarioAlteracao.notificarResponsavelAcessoForaDoHorario usuarioAlteracao.dtUltimaTrocaSenha usuarioAlteracao.dtAlteracao usuarioAlteracao.superAdmin usuarioAlteracao.identificador usuarioAlteracao.contatoDaEmpresa usuarioAlteracao.sponsor
contaDeposito (pessoasContasDeposito): contaDeposito.id contaDeposito.agencia contaDeposito.contaCorrente contaDeposito.cod_banco contaDeposito.pessoas_id contaDeposito.tipoConta
bancoDeposito (finan_bancos): bancoDeposito.id bancoDeposito.cod_banco bancoDeposito.nome bancoDeposito.emite_bloqueto bancoDeposito.agencia_cobranca bancoDeposito.conta_cobranca bancoDeposito.cod_cedente bancoDeposito.convenio_dbt bancoDeposito.titulo_dbt bancoDeposito.layoutCheque_id bancoDeposito.layoutBoleto_id bancoDeposito.possuiDVA bancoDeposito.possuiDVC bancoDeposito.stAtivo bancoDeposito.cod_febraban bancoDeposito.ispb
transp_reciboFreteDespesas: transp_reciboFreteDespesas.id transp_reciboFreteDespesas.reciboFrete_id transp_reciboFreteDespesas.quantidade transp_reciboFreteDespesas.valor transp_reciboFreteDespesas.fornecedor_id transp_reciboFreteDespesas.observacao transp_reciboFreteDespesas.tipoDespesasExtras_id transp_reciboFreteDespesas.faturaPagar_id transp_reciboFreteDespesas.faturaReceber_id transp_reciboFreteDespesas.considerarComissionamento transp_reciboFreteDespesas.valorTotalDescontar
fornecedorDespesasExtras (pessoasPessoas): fornecedorDespesasExtras.id fornecedorDespesasExtras.carteiras_id fornecedorDespesasExtras.cod_localidade fornecedorDespesasExtras.fisica_juridica fornecedorDespesasExtras.CNPJ fornecedorDespesasExtras.razao_social fornecedorDespesasExtras.CI fornecedorDespesasExtras.descricao fornecedorDespesasExtras.nome fornecedorDespesasExtras.sobrenome fornecedorDespesasExtras.email fornecedorDespesasExtras.site fornecedorDespesasExtras.data_cadastro fornecedorDespesasExtras.observacoes fornecedorDespesasExtras.data_nascimento fornecedorDespesasExtras.profissao fornecedorDespesasExtras.sexo fornecedorDespesasExtras.contato_tecnico_id fornecedorDespesasExtras.contato_administrativo_id fornecedorDespesasExtras.cod_fiscal_cliente fornecedorDespesasExtras.cod_fiscal_fornecedor fornecedorDespesasExtras.cnh fornecedorDespesasExtras.categoria fornecedorDespesasExtras.dtExpedicao fornecedorDespesasExtras.dtPrimeiraExpedicao fornecedorDespesasExtras.dtValidade fornecedorDespesasExtras.orgaoExpedidor fornecedorDespesasExtras.limite_credito fornecedorDespesasExtras.matriculaINSS fornecedorDespesasExtras.apelido fornecedorDespesasExtras.celular fornecedorDespesasExtras.cod_fiscal_processos fornecedorDespesasExtras.telResidencial fornecedorDespesasExtras.protocoloCNH fornecedorDespesasExtras.naturalidade fornecedorDespesasExtras.nacionalidade fornecedorDespesasExtras.pai fornecedorDespesasExtras.mae fornecedorDespesasExtras.outrosTels fornecedorDespesasExtras.PIS_PASEP fornecedorDespesasExtras.referencias fornecedorDespesasExtras.usuarios_id fornecedorDespesasExtras.ultimaAtualizacao fornecedorDespesasExtras.preferenciaImpressaoNF fornecedorDespesasExtras.bloqueado fornecedorDespesasExtras.grupoDespesaEspecifico fornecedorDespesasExtras.contas_id fornecedorDespesasExtras.estado_civil fornecedorDespesasExtras.identificador fornecedorDespesasExtras.alvara fornecedorDespesasExtras.conjuge fornecedorDespesasExtras.cnae_id fornecedorDespesasExtras.escala fornecedorDespesasExtras.protestar fornecedorDespesasExtras.nroDiasProtesto fornecedorDespesasExtras.logo fornecedorDespesasExtras.codISSQNAtividadePrincipal fornecedorDespesasExtras.statusPessoa_id fornecedorDespesasExtras.enquadramento fornecedorDespesasExtras.consultor_id fornecedorDespesasExtras.CI_Estado fornecedorDespesasExtras.naturalidadeEstado fornecedorDespesasExtras.categoriaCRM fornecedorDespesasExtras.emailCobranca fornecedorDespesasExtras.documentoFormatado fornecedorDespesasExtras.emissaoRG fornecedorDespesasExtras.lotacao_id fornecedorDespesasExtras.nit fornecedorDespesasExtras.RNTRC fornecedorDespesasExtras.tipoTransportadora fornecedorDespesasExtras.IEC fornecedorDespesasExtras.dependentesIRRF fornecedorDespesasExtras.CI_orgaoExpedidor fornecedorDespesasExtras.suframa fornecedorDespesasExtras.seguroCNH fornecedorDespesasExtras.emailCotacaoEstoque fornecedorDespesasExtras.celularNumerico fornecedorDespesasExtras.grauInstruTrabalhador fornecedorDespesasExtras.paisNascimento_id fornecedorDespesasExtras.paisNacionalidade_id fornecedorDespesasExtras.numeroCTPS fornecedorDespesasExtras.serieCTPS fornecedorDespesasExtras.ufExpedicaoCTPS fornecedorDespesasExtras.raca fornecedorDespesasExtras.radicalCNPJ fornecedorDespesasExtras.emailOcorrenciasTransporte fornecedorDespesasExtras.receberPesquisaAtendimento fornecedorDespesasExtras.naturalidade_id fornecedorDespesasExtras.usuarioCadastro fornecedorDespesasExtras.dtValidadeExameToxicologico fornecedorDespesasExtras.cidadeEmissaoCNH_id fornecedorDespesasExtras.ignoraValidacaoNIS fornecedorDespesasExtras.renachCNH fornecedorDespesasExtras.CI_orgaoExpedidor_mdm fornecedorDespesasExtras.nome_social
transp_reciboFreteDocs: transp_reciboFreteDocs.reciboFrete_id transp_reciboFreteDocs.conhecimento_id transp_reciboFreteDocs.ordemCarregamento_id transp_reciboFreteDocs.manifestoCarga_id transp_reciboFreteDocs.manifestoCargaDoRecibo_id
transp_conhecimentoTransporteReais: transp_conhecimentoTransporteReais.id transp_conhecimentoTransporteReais.operacoes_id transp_conhecimentoTransporteReais.operacoesMercadorias_id transp_conhecimentoTransporteReais.agencias_id transp_conhecimentoTransporteReais.agenciasComissao_id transp_conhecimentoTransporteReais.tiposTaloes_id transp_conhecimentoTransporteReais.pedidos_id transp_conhecimentoTransporteReais.complementoPedido transp_conhecimentoTransporteReais.ordensCarregamento_id transp_conhecimentoTransporteReais.cfops_id transp_conhecimentoTransporteReais.cliente_id transp_conhecimentoTransporteReais.manifestador_usuarios_id transp_conhecimentoTransporteReais.nroConhecimento transp_conhecimentoTransporteReais.dataCriacao transp_conhecimentoTransporteReais.dtEmissao transp_conhecimentoTransporteReais.statusCancelado transp_conhecimentoTransporteReais.destinatario_id transp_conhecimentoTransporteReais.consignatario_id transp_conhecimentoTransporteReais.redespacho_id transp_conhecimentoTransporteReais.pagamentoFrete transp_conhecimentoTransporteReais.calcAte transp_conhecimentoTransporteReais.localColeta transp_conhecimentoTransporteReais.localEntrega transp_conhecimentoTransporteReais.precosConhecimento_id transp_conhecimentoTransporteReais.regraFrete_id transp_conhecimentoTransporteReais.tarifaDigitada transp_conhecimentoTransporteReais.tarifaCalculada transp_conhecimentoTransporteReais.valorFrete transp_conhecimentoTransporteReais.baseCalculo transp_conhecimentoTransporteReais.aliquota transp_conhecimentoTransporteReais.valorICMS transp_conhecimentoTransporteReais.valoresOutros transp_conhecimentoTransporteReais.valorSeguroAduaneiro transp_conhecimentoTransporteReais.valorPedagio transp_conhecimentoTransporteReais.valorPedagioConhecimento transp_conhecimentoTransporteReais.totalPrestacao transp_conhecimentoTransporteReais.motorista_id transp_conhecimentoTransporteReais.veiculos_id transp_conhecimentoTransporteReais.carreta_id transp_conhecimentoTransporteReais.semireboque_id transp_conhecimentoTransporteReais.quartoVeiculo_id transp_conhecimentoTransporteReais.favorecido_id transp_conhecimentoTransporteReais.imprimirProprietario transp_conhecimentoTransporteReais.respSeg transp_conhecimentoTransporteReais.seguradora_id transp_conhecimentoTransporteReais.numeroApolice transp_conhecimentoTransporteReais.regrasCarreto_id transp_conhecimentoTransporteReais.tolerancia transp_conhecimentoTransporteReais.pesoColeta transp_conhecimentoTransporteReais.tarifaMotoristaCalculada transp_conhecimentoTransporteReais.tarifaMotoristaDigitada transp_conhecimentoTransporteReais.valorTotalOrigem transp_conhecimentoTransporteReais.outrosDescontos transp_conhecimentoTransporteReais.outrosAcrescimos transp_conhecimentoTransporteReais.descontoINSS transp_conhecimentoTransporteReais.totalDescontoINSS transp_conhecimentoTransporteReais.descontoSEST transp_conhecimentoTransporteReais.totalDescontoSEST transp_conhecimentoTransporteReais.freteLiquido transp_conhecimentoTransporteReais.valorAdiantamento transp_conhecimentoTransporteReais.pesoChegada transp_conhecimentoTransporteReais.tipoPedagio transp_conhecimentoTransporteReais.descontoQuebraPeso transp_conhecimentoTransporteReais.saldo transp_conhecimentoTransporteReais.pesoChegadaReal transp_conhecimentoTransporteReais.descontoQuebraPesoReal transp_conhecimentoTransporteReais.valorFaturado transp_conhecimentoTransporteReais.tarifaImpressa transp_conhecimentoTransporteReais.statusBloqueado transp_conhecimentoTransporteReais.dtAtualizacao transp_conhecimentoTransporteReais.enderecoRemetente_id transp_conhecimentoTransporteReais.enderecoDestinatario_id transp_conhecimentoTransporteReais.enderecoConsignatario_id transp_conhecimentoTransporteReais.enderecoRedespacho_id transp_conhecimentoTransporteReais.enderecoCliente_id transp_conhecimentoTransporteReais.parcelarAdiantamento transp_conhecimentoTransporteReais.valorSeguro transp_conhecimentoTransporteReais.mercadoriaAvariada transp_conhecimentoTransporteReais.container transp_conhecimentoTransporteReais.lacre transp_conhecimentoTransporteReais.mercadoriaOrdem_id transp_conhecimentoTransporteReais.substitui transp_conhecimentoTransporteReais.substituidoPor transp_conhecimentoTransporteReais.numeroCartao transp_conhecimentoTransporteReais.dtPrevChegada transp_conhecimentoTransporteReais.estadoColeta transp_conhecimentoTransporteReais.estadoEntrega transp_conhecimentoTransporteReais.processos_id transp_conhecimentoTransporteReais.codigo_lancamento transp_conhecimentoTransporteReais.cod_rateio transp_conhecimentoTransporteReais.codigo_lancamentoCreditoViagem transp_conhecimentoTransporteReais.diaria transp_conhecimentoTransporteReais.diariaFrete transp_conhecimentoTransporteReais.reciboFrete_id transp_conhecimentoTransporteReais.gerouReciboFrete transp_conhecimentoTransporteReais.chaveCTe transp_conhecimentoTransporteReais.protocoloCTe transp_conhecimentoTransporteReais.resultadoCTe transp_conhecimentoTransporteReais.protocoloCancelamentoCTe transp_conhecimentoTransporteReais.cMunIni transp_conhecimentoTransporteReais.cMunFim transp_conhecimentoTransporteReais.enderecoColeta_id transp_conhecimentoTransporteReais.enderecoEntrega_id transp_conhecimentoTransporteReais.UFIni transp_conhecimentoTransporteReais.UFFim transp_conhecimentoTransporteReais.manifestoCarga_id transp_conhecimentoTransporteReais.procCTeVersao transp_conhecimentoTransporteReais.km transp_conhecimentoTransporteReais.Gris transp_conhecimentoTransporteReais.rascunho transp_conhecimentoTransporteReais.CST transp_conhecimentoTransporteReais.tipoDocumentos transp_conhecimentoTransporteReais.valorISS transp_conhecimentoTransporteReais.gerouReciboFreteExterno transp_conhecimentoTransporteReais.baseResultadoCT transp_conhecimentoTransporteReais.anuladoPor_id transp_conhecimentoTransporteReais.anulou_id transp_conhecimentoTransporteReais.comboio transp_conhecimentoTransporteReais.dtCancelamento transp_conhecimentoTransporteReais.complementou_id transp_conhecimentoTransporteReais.lotacao transp_conhecimentoTransporteReais.tpCTe transp_conhecimentoTransporteReais.emailEnviado transp_conhecimentoTransporteReais.totalServico transp_conhecimentoTransporteReais.tpServ transp_conhecimentoTransporteReais.substituiSefaz_id transp_conhecimentoTransporteReais.definirQuantCargasManualmente transp_conhecimentoTransporteReais.perfisApropriacao_id transp_conhecimentoTransporteReais.formaApropriacao transp_conhecimentoTransporteReais.forPag transp_conhecimentoTransporteReais.emitiuDeclaracaoAnulacao transp_conhecimentoTransporteReais.rotaDistribuicao_id transp_conhecimentoTransporteReais.globalizado transp_conhecimentoTransporteReais.percurso_id transp_conhecimentoTransporteReais.modalidade transp_conhecimentoTransporteReais.nroRegistroEstadual transp_conhecimentoTransporteReais.definirCSTManualmente transp_conhecimentoTransporteReais.tipoOperacaoTMS_id transp_conhecimentoTransporteReais.dtHoraPrevChegada transp_conhecimentoTransporteReais.statusAverbacao transp_conhecimentoTransporteReais.apolice_id transp_conhecimentoTransporteReais.origemAliquota transp_conhecimentoTransporteReais.numero_passageiros transp_conhecimentoTransporteReais.percentual_base_icms_excecao transp_conhecimentoTransporteReais.tipo_fretamento transp_conhecimentoTransporteReais.cst_cbs_ibs transp_conhecimentoTransporteReais.c_class_tributaria transp_conhecimentoTransporteReais.regra_excecoes_icms_id
transp_ordensCarregamentoPai: transp_ordensCarregamentoPai.id transp_ordensCarregamentoPai.agencias_id transp_ordensCarregamentoPai.tiposTaloes_id transp_ordensCarregamentoPai.reciboFrete_id transp_ordensCarregamentoPai.pedidos_id transp_ordensCarregamentoPai.complementoPedido transp_ordensCarregamentoPai.manifestador_usuarios_id transp_ordensCarregamentoPai.nroOrdem transp_ordensCarregamentoPai.dataCriacao transp_ordensCarregamentoPai.dtEmissao transp_ordensCarregamentoPai.statusCancelado transp_ordensCarregamentoPai.remetente_id transp_ordensCarregamentoPai.destinatario_id transp_ordensCarregamentoPai.redespacho_id transp_ordensCarregamentoPai.consignatario_id transp_ordensCarregamentoPai.enderecoRedespacho_id transp_ordensCarregamentoPai.enderecoConsignatario_id transp_ordensCarregamentoPai.motorista_id transp_ordensCarregamentoPai.veiculos_id transp_ordensCarregamentoPai.carreta_id transp_ordensCarregamentoPai.semireboque_id transp_ordensCarregamentoPai.quartoVeiculo_id transp_ordensCarregamentoPai.favorecido_id transp_ordensCarregamentoPai.imprimirProprietario transp_ordensCarregamentoPai.dtAtualizacao transp_ordensCarregamentoPai.enderecoDestinatario_id transp_ordensCarregamentoPai.enderecoRemetente_id transp_ordensCarregamentoPai.ufRemetente transp_ordensCarregamentoPai.ufDestinatario transp_ordensCarregamentoPai.ufConsignatario transp_ordensCarregamentoPai.ufRedespacho transp_ordensCarregamentoPai.nroOrdemCliente transp_ordensCarregamentoPai.multiplosDestinatarios transp_ordensCarregamentoPai.multiplosRemetentes transp_ordensCarregamentoPai.navio transp_ordensCarregamentoPai.nroViagem transp_ordensCarregamentoPai.armador transp_ordensCarregamentoPai.portoOrigem transp_ordensCarregamentoPai.portoDestino transp_ordensCarregamentoPai.booking transp_ordensCarregamentoPai.dtChegada transp_ordensCarregamentoPai.dtPrevisaoChegada transp_ordensCarregamentoPai.dtSaida transp_ordensCarregamentoPai.horaEmissao transp_ordensCarregamentoPai.portoTransbordo transp_ordensCarregamentoPai.dtPrevColeta transp_ordensCarregamentoPai.dtColeta transp_ordensCarregamentoPai.dtPrevEntrega transp_ordensCarregamentoPai.dtEntrega transp_ordensCarregamentoPai.forcarCarregada transp_ordensCarregamentoPai.ordenacaoCarregamento transp_ordensCarregamentoPai.cliente_id transp_ordensCarregamentoPai.enderecoCliente_id transp_ordensCarregamentoPai.gerouReciboFreteExterno transp_ordensCarregamentoPai.dtDeadLineEmbarque transp_ordensCarregamentoPai.local transp_ordensCarregamentoPai.despachante_id transp_ordensCarregamentoPai.terminalEntrega transp_ordensCarregamentoPai.seguradora_id transp_ordensCarregamentoPai.carregadoPorPai_id transp_ordensCarregamentoPai.dtDeadLineDraft transp_ordensCarregamentoPai.SHIP transp_ordensCarregamentoPai.rotaDistribuicao_id transp_ordensCarregamentoPai.classificador_id transp_ordensCarregamentoPai.codigoRastreamento transp_ordensCarregamentoPai.tipoDocumentos transp_ordensCarregamentoPai.regra_id transp_ordensCarregamentoPai.protocoloGerenciadoraRisco transp_ordensCarregamentoPai.tipoOperacaoTMS_id transp_ordensCarregamentoPai.responsavelOco_id transp_ordensCarregamentoPai.usuarioCriador_id transp_ordensCarregamentoPai.apolice_id transp_ordensCarregamentoPai.controle
transp_manifestoCarga: transp_manifestoCarga.id transp_manifestoCarga.nro transp_manifestoCarga.stAberto transp_manifestoCarga.dtEmissao transp_manifestoCarga.dtSaida transp_manifestoCarga.munIni transp_manifestoCarga.munFim transp_manifestoCarga.UFIni transp_manifestoCarga.UFFim transp_manifestoCarga.motorista_id transp_manifestoCarga.veiculos_id transp_manifestoCarga.carreta_id transp_manifestoCarga.semireboque_id transp_manifestoCarga.quartoVeiculo_id transp_manifestoCarga.KmInicial transp_manifestoCarga.KmFinal transp_manifestoCarga.dtFechamento transp_manifestoCarga.observacao transp_manifestoCarga.manifestoOriginal_id transp_manifestoCarga.tipoManifesto_id transp_manifestoCarga.munIni_id transp_manifestoCarga.munFim_id transp_manifestoCarga.agencias_id transp_manifestoCarga.tiposTaloes_id transp_manifestoCarga.stLiberado transp_manifestoCarga.usuario_id transp_manifestoCarga.controleUsoInicio_id transp_manifestoCarga.controleUsoFim_id transp_manifestoCarga.suprimentos_id transp_manifestoCarga.descricao transp_manifestoCarga.descricaoAcerto transp_manifestoCarga.usuarioFechamento_id transp_manifestoCarga.conferente_id transp_manifestoCarga.MDFeChaveAcesso transp_manifestoCarga.MDFeNumeroRecibo transp_manifestoCarga.MDFeProtocoloAutorizacao transp_manifestoCarga.MDFeDataAutorizacao transp_manifestoCarga.MDFeProtocoloCancelamento transp_manifestoCarga.MDFeDataCancelamento transp_manifestoCarga.MDFeProtocoloEncerramento transp_manifestoCarga.MDFeDataEncerramento transp_manifestoCarga.acertos_id transp_manifestoCarga.contratado_id transp_manifestoCarga.tpEmit transp_manifestoCarga.percurso_id transp_manifestoCarga.tiposDistribuicao_id transp_manifestoCarga.mobile_id transp_manifestoCarga.cancelado transp_manifestoCarga.dataCancelamento transp_manifestoCarga.motivoCancelamento transp_manifestoCarga.usuarioCancelamento_id transp_manifestoCarga.contingencia transp_manifestoCarga.dtEncerramentoAutomatico transp_manifestoCarga.definirSeguradorasManualmente transp_manifestoCarga.usuarioEncerramento_id transp_manifestoCarga.aeronave_id transp_manifestoCarga.numeroVoo transp_manifestoCarga.aerodromoEmbarque_id transp_manifestoCarga.aerodromoDestino_id transp_manifestoCarga.dataVoo transp_manifestoCarga.modalidade transp_manifestoCarga.responsavelOco_id transp_manifestoCarga.cepOrigem transp_manifestoCarga.cepDestino transp_manifestoCarga.reciboFrete_id transp_manifestoCarga.considerarMultiplosDestinos transp_manifestoCarga.data_atualizacao transp_manifestoCarga.operacao_alto_desempenho transp_manifestoCarga.coordenadas_carregamento transp_manifestoCarga.coordenadas_descarregamento transp_manifestoCarga.status_averbacao
transp_reciboFretePontosIntermediarios: transp_reciboFretePontosIntermediarios.id transp_reciboFretePontosIntermediarios.reciboFrete_id transp_reciboFretePontosIntermediarios.cidade_id transp_reciboFretePontosIntermediarios.eixoSuspenso
intermediarios (bancoCeps.localidades): intermediarios.id intermediarios.localidade intermediarios.uf intermediarios.codIBGE intermediarios.mesoCod intermediarios.codANP intermediarios.usado intermediarios.antigoId intermediarios.codTOM
`;
_mesclarDemaisCampos('ContratoFrete', _DEMAIS_CAMPOS_RAW_CF);

// Converte para Latin-1 (Windows-1252) "seguro": 1 char JS = 1 byte de saída — é o que
// o Bsoft espera no .dat (ex: "Relatório" grava o "ó" em 1 byte, não UTF-8). Caracteres
// fora do intervalo Latin-1 (raros em PT-BR) viram "?" pra nunca quebrar a contagem de bytes.
function _toLatin1Safe(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        out += code <= 0xFF ? str[i] : '?';
    }
    return out;
}
function _phpSerializeString(s) {
    const safe = _toLatin1Safe(String(s == null ? '' : s));
    return `s:${safe.length}:"${safe}";`;
}
function _phpSerializeAssoc(obj) {
    const entradas = Object.entries(obj);
    let out = `a:${entradas.length}:{`;
    for (const [k, v] of entradas) out += _phpSerializeString(k) + _phpSerializeString(v);
    return out + '}';
}

// Monta o JSON interno do campo "dados" a partir da lista de campos escolhidos.
function _construirDadosRelatorioJSON(campos) {
    const linha = campos.map(c => ({
        exp: c.exp, tipo: '', tamanho: [''], label: c.label,
        alinhamento: '', totalizador: '', tipoOrdenacao: '', ordemOrdenacao: ''
    }));
    return JSON.stringify({ formato: 'html', linhas: [linha] });
}

// Gera a string PHP-serializada completa (pronta pra virar bytes e baixar como .dat).
function _gerarConteudoDatRelatorio({ nome, nomeArquivo = '', origem = 'CTe', tamanhoRelatorio = '27cm', campos }) {
    const estrutura = { nome, nomeArquivo, origem, tamanhoRelatorio, dados: _construirDadosRelatorioJSON(campos) };
    return _phpSerializeAssoc(estrutura);
}

// Baixa a string serializada como arquivo .dat (bytes Latin-1/CP1252, sem BOM).
function _baixarDatRelatorio(conteudoSerializado, nomeArquivo) {
    const safe = _toLatin1Safe(conteudoSerializado);
    const bytes = new Uint8Array(safe.length);
    for (let i = 0; i < safe.length; i++) bytes[i] = safe.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo.endsWith('.dat') ? nomeArquivo : nomeArquivo + '.dat';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function ehAssistenteRelatorios(query) {
    const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const padroes = [
        'assistente de relatorio', 'assistente de relatórios', 'criar relatorio',
        'novo relatorio', 'gerar relatorio', 'montar relatorio', 'relatorio personalizado',
        'quero um relatorio', 'preciso de um relatorio', 'relatorio .dat', 'arquivo .dat', 'exportar relatorio'
    ];
    return padroes.some(p => q.includes(p)) || (/relat[oó]rio/.test(q) && /\b(criar|gerar|montar|novo|preciso|quero|fazer)\b/.test(q));
}

window._relOrigemSel = null;
function _relSelecionarOrigem(origem) {
    window._relOrigemSel = origem;
    document.querySelectorAll('._rel-origem-btn').forEach(b => {
        const ativo = b.dataset.origem === origem;
        b.style.background = ativo ? 'var(--primary)' : '#f3f4f6';
        b.style.color = ativo ? 'white' : '#374151';
        b.style.borderColor = ativo ? 'var(--primary)' : '#e5e7eb';
    });
    const step2 = document.getElementById('wRelStep2');
    if (step2) step2.style.display = 'block';
    // Cada origem tem seu próprio catálogo de campos — troca de origem reinicia a busca e as
    // colunas já montadas (senão ficaria coluna com campo de uma origem diferente da escolhida agora).
    window._relColunas = [{ nomeColuna: '', termos: [] }];
    window._relAcaoSel = null;
    const busca = document.getElementById('wRelBusca'); if (busca) busca.value = '';
    _relRenderResultadosBusca();
    _relRenderColunas();
    setTimeout(() => { if (!document.getElementById('wRelNome')?.value) document.getElementById('wRelNome')?.focus(); }, 80);
    ferrRolar('relatorios', true);
}
// Busca por nome do campo com pontuação por semelhança — substring completo do rótulo pontua mais
// (melhor ainda quanto mais cedo aparece), senão soma por palavra da busca encontrada no rótulo,
// no grupo (categoria) ou na expressão interna. Sem IA — instantâneo a cada tecla digitada.
// Grupos de termos equivalentes pra busca — pesquisar um encontra campos do(s) outro(s) do mesmo
// grupo, nos dois sentidos (ex.: buscar "conhecimento" acha campos do grupo "Ct-e", e buscar
// "ct-e" também acha os que só têm "conhecimento" no rótulo — e vice-versa). Todos os termos já
// em minúsculo/sem acento, no mesmo formato que _relCamposFiltrados normaliza a busca digitada.
const _REL_SINONIMOS_BUSCA = [
    ['ct-e', 'cte', 'conhecimento'],
    ['mdf-e', 'mdfe', 'manifesto'],
    ['numero', 'nro', 'nº'],
    // abreviações de campo comuns no catálogo (ex.: cte.tpCTe, cte.dtEmissao, cte.percGris) —
    // batem tanto com o nome técnico abreviado quanto com o rótulo em português por extenso.
    ['tipo', 'tp'],
    ['valor', 'vlr'],
    ['data', 'dt'],
    ['codigo', 'cod'],
    ['observacao', 'observacoes', 'obs'],
    ['documento', 'doc'],
    ['quantidade', 'qtd', 'quant'],
    ['transporte', 'transportador', 'transp'],
];
function _relTermosEquivalentes(termo) {
    for (const grupo of _REL_SINONIMOS_BUSCA) { if (grupo.includes(termo)) return grupo; }
    return [termo];
}
// acha `termo` dentro de `texto` (ambos já normalizados) respeitando borda de palavra quando o
// termo é curto (até 4 letras) — sem isso, abreviações como "cod" batem no meio de nomes colados
// por acaso (ex.: "enderecoDestinatario" tem "co"+"d" bem no meio, sem nenhuma relação com
// "código"). Termos com 5+ letras dificilmente colidem por acaso, então continuam batendo em
// qualquer posição, como antes.
function _relIndexOfComBorda(texto, termo) {
    if (termo.length > 4) return texto.indexOf(termo);
    let idx = texto.indexOf(termo);
    while (idx !== -1) {
        const antes = idx === 0 ? '' : texto[idx - 1];
        if (!/[a-z0-9]/.test(antes)) return idx;
        idx = texto.indexOf(termo, idx + 1);
    }
    return -1;
}
function _relCamposFiltrados(origemSel, query) {
    const catalogo = CATALOGO_RELATORIOS[origemSel] || CATALOGO_RELATORIOS.CTe;
    const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = norm(query).trim();
    if (!q) return [];
    const palavras = q.split(/\s+/).filter(Boolean);
    // cada palavra digitada já expande em si mesma + os sinônimos dela — a pontuação testa
    // qualquer um desses termos equivalentes, não só o que foi literalmente digitado.
    const palavrasEquiv = palavras.map(_relTermosEquivalentes);
    const qEquiv = _relTermosEquivalentes(q);
    const pontuados = catalogo.map(c => {
        const labelN = norm(c.label), grupoN = norm(c.grupo), expN = norm(c.exp);
        let pontos = 0;
        const termoCompletoBatido = qEquiv.find(t => _relIndexOfComBorda(labelN, t) !== -1);
        if (termoCompletoBatido) pontos += 100 - _relIndexOfComBorda(labelN, termoCompletoBatido);
        else {
            const acertos = palavrasEquiv.filter(equivs => equivs.some(t => _relIndexOfComBorda(labelN, t) !== -1 || _relIndexOfComBorda(grupoN, t) !== -1 || _relIndexOfComBorda(expN, t) !== -1)).length;
            pontos = (acertos / palavrasEquiv.length) * 60;
        }
        if (qEquiv.some(t => _relIndexOfComBorda(grupoN, t) !== -1)) pontos += 15;
        return { c, pontos };
    }).filter(x => x.pontos > 0).sort((a, b) => b.pontos - a.pontos);
    return pontuados.slice(0, 14).map(x => x.c);
}
function _relRenderResultadosBusca() {
    const cont = document.getElementById('wRelResultadosBusca');
    if (!cont) return;
    const query = document.getElementById('wRelBusca')?.value || '';
    const resultados = _relCamposFiltrados(window._relOrigemSel, query);
    if (!query.trim()) { cont.innerHTML = ''; return; }
    cont.innerHTML = resultados.length
        ? resultados.map(c => `<span class="_rel-chip" draggable="true" data-exp="${escapeHtml(c.exp)}" data-label="${escapeHtml(c.label)}" ondragstart="_relCampoDragStart(event)" title="${escapeHtml(c.grupo)} · ${escapeHtml(c.exp)}" style="display:inline-flex;align-items:center;padding:6px 12px;background:white;border:1.5px solid #93c5fd;border-radius:16px;font-size:12px;color:#1e40af;cursor:grab;user-select:none;">${escapeHtml(c.label)}</span>`).join('')
        : `<span style="font-size:11.5px;color:#9ca3af;">Nenhum campo encontrado pra "${escapeHtml(query)}".</span>`;
}
window._relAcaoSel = null;
// Mesmo sistema de ações do criador de regras (clicar OU arrastar ativa; clicar de novo na mesma
// desmarca; vale pro próximo campo arrastado em QUALQUER coluna) -- só com as 4 ações aritméticas,
// já que aqui é sempre pra montar um número (não uma condição).
function _relSelecionarAcao(acao){
    window._relAcaoSel=acao;
    document.querySelectorAll('._rel-acao-btn').forEach(b=>{
        const ativo=b.dataset.acao===acao;
        b.style.background=ativo?'var(--primary)':'#f3f4f6';
        b.style.color=ativo?'white':'#374151';
        b.style.borderColor=ativo?'var(--primary)':'#e5e7eb';
    });
    _relRenderColunas();
}
function _relClicarAcao(acao){
    _relSelecionarAcao(window._relAcaoSel===acao?null:acao);
}
function _relAcaoDragStart(e,acao){
    e.dataTransfer.setData('text/plain','acao:'+acao);
    e.dataTransfer.effectAllowed='copy';
}
function _relValorInputChange(){
    const val=(document.getElementById('wRelValorInput')?.value||'').trim();
    const chip=document.getElementById('wRelValorChip');
    if(!chip)return;
    const valido=val!==''&&!isNaN(Number(val.replace(',','.')));
    chip.style.opacity=valido?'1':'.4';
    chip.style.cursor=valido?'grab':'not-allowed';
}
function _relValorDragStart(e){
    const val=(document.getElementById('wRelValorInput')?.value||'').trim();
    const norm=val.replace(',','.');
    if(!val||isNaN(Number(norm))){e.preventDefault();return;}
    e.dataTransfer.setData('text/plain','valor:'+norm);
    e.dataTransfer.effectAllowed='copy';
}
function _relCampoDragStart(e) {
    e.dataTransfer.setData('text/plain', 'campo:'+e.target.dataset.exp);
    e.dataTransfer.effectAllowed = 'copy';
}
function _relDropZoneDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
// Diferente do selo do criador de regras (_acaoBadgeHtml), aqui NÃO mostra aviso vermelho quando
// nenhuma ação está selecionada -- pra relatório a ação é sempre opcional (só entra em jogo se o
// usuário realmente soltar 2 campos na mesma coluna), então não tem porque cobrar isso de cara.
// Só mostra o selo quando o usuário realmente ativou alguma.
function _relAcaoBadgeHtml(acaoSel, corBorda, corTexto){
    if(!acaoSel)return '';
    return `<span style="position:absolute;top:-9px;left:10px;background:white;border:1px solid ${corBorda};border-radius:10px;padding:1px 8px;font-size:10px;color:${corTexto};font-weight:700;white-space:nowrap;">Ação ativa: ${escapeHtml(_ACAO_LABELS[acaoSel]||acaoSel)}</span>`;
}
// Converte o payload do drop no termo que vai pra fórmula: campo entra com a expressão pura do
// catálogo (parênteses só entram na hora de montar a fórmula final, se houver 2+ termos -- ver
// _relFormulaDeTermos), valor numérico entra como está.
function _relTermoDeRaw(raw){
    if(raw.startsWith('campo:'))return raw.slice(6)||null;
    if(raw.startsWith('valor:')){ const n=raw.slice(6); return /^-?\d+(\.\d+)?$/.test(n)?n:null; }
    return null;
}
// Rótulo amigável do termo pro chip: número mostra como está, campo procura o rótulo no catálogo
// da origem selecionada (senão mostra a própria expressão).
function _relTermoParaLabel(termo, origemSel){
    if(/^-?\d+(\.\d+)?$/.test(termo))return termo;
    const catalogo=CATALOGO_RELATORIOS[origemSel]||CATALOGO_RELATORIOS.CTe;
    const achou=catalogo.find(c=>c.exp===termo);
    return achou?achou.label:termo;
}
// Monta a fórmula final a partir dos termos: 1 termo só -> expressão pura (coluna simples, igual
// sempre foi); 2+ termos -> cada CAMPO entre parênteses, número puro, unidos pelos símbolos das
// ações -- mesmo formato que a IA já gera a partir do texto livre (ver enviarWizardRelatorio),
// pra ficar consistente não importa se a coluna foi montada arrastando ou escrevendo.
function _relFormulaDeTermos(termos){
    if(!termos||!termos.length)return null;
    if(termos.length===1)return termos[0].termo;
    const ehNumero=t=>/^-?\d+(\.\d+)?$/.test(t);
    return termos.map((t,i)=>{
        const parte=ehNumero(t.termo)?t.termo:`(${t.termo})`;
        return i===0?parte:`${t.acao}${parte}`;
    }).join('');
}
// Solta SEMPRE acrescenta ao final dos termos já montados nessa coluna (permite montar uma conta
// com 2+ campos, igual ao criador de regras) -- MAS, diferente de lá, escolher uma ação nunca é
// obrigatório: a maioria das colunas de relatório é só 1 campo (sem conta nenhuma), então não faz
// sentido travar o usuário nesse passo. Se soltar um 2º campo sem ter escolhido uma ação, assume
// Somar (a mais comum) -- ele ainda pode clicar/arrastar outra ação antes de soltar, se quiser.
// Se o nome da coluna ainda estiver vazio, sugere o rótulo do PRIMEIRO campo (o usuário pode
// reescrever).
function _relDropZoneDrop(e, idx) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    if (raw.startsWith('acao:')) { _relSelecionarAcao(raw.slice(5)); return; }
    const termo = _relTermoDeRaw(raw);
    if (termo === null) return;
    const col = window._relColunas[idx]; if (!col) return;
    if (!col.termos) col.termos = [];
    col.termos.push({ termo, acao: col.termos.length ? (window._relAcaoSel || '+') : null });
    if (!col.nomeColuna.trim() && col.termos.length === 1) col.nomeColuna = _relTermoParaLabel(termo, window._relOrigemSel);
    _relRenderColunas();
}
function _relNomeColunaInput(idx, valor) {
    if (window._relColunas[idx]) window._relColunas[idx].nomeColuna = valor;
}
function _relRemoverTermoColuna(idx, termoIdx) {
    const col = window._relColunas[idx];
    if (!col || !col.termos) return;
    col.termos.splice(termoIdx, 1);
    _relRenderColunas();
}
function _relLimparTermosColuna(idx) {
    const col = window._relColunas[idx]; if (!col) return;
    col.termos = [];
    _relRenderColunas();
}
function _relRemoverColuna(idx) {
    if (window._relColunas.length <= 1) return;
    window._relColunas.splice(idx, 1);
    _relRenderColunas();
}
// "Nome coluna" é obrigatório pra liberar uma nova — sem isso o usuário poderia empilhar várias
// colunas em branco sem querer.
function _relAdicionarColuna() {
    const ultima = window._relColunas[window._relColunas.length - 1];
    if (!ultima.nomeColuna || !ultima.nomeColuna.trim()) {
        const inputs = document.querySelectorAll('.wRelNomeColunaInput');
        const alvo = inputs[inputs.length - 1];
        if (alvo) { alvo.style.borderColor = '#ef4444'; alvo.focus(); setTimeout(() => { alvo.style.borderColor = ''; }, 1200); }
        return;
    }
    window._relColunas.push({ nomeColuna: '', termos: [] });
    _relRenderColunas();
    setTimeout(() => { const inputs = document.querySelectorAll('.wRelNomeColunaInput'); inputs[inputs.length - 1]?.focus(); }, 30);
}
function _relRenderColunas() {
    const cont = document.getElementById('wRelColunasContainer');
    if (!cont) return;
    cont.innerHTML = window._relColunas.map((col, idx) => {
        const termos = col.termos || [];
        let canvasConteudo;
        if (termos.length) {
            canvasConteudo = termos.map((t, tIdx) => {
                const sep = tIdx > 0 ? `<span style="font-size:11px;color:#2563eb;font-weight:700;margin:0 3px;">${escapeHtml(_ACAO_NOMES[t.acao] || t.acao || '')}</span>` : '';
                const label = _relTermoParaLabel(t.termo, window._relOrigemSel);
                return `${sep}<span title="${escapeHtml(t.termo)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;margin:2px 0;background:white;border:1px solid #93c5fd;border-radius:12px;font-size:11px;font-family:monospace;color:#1e40af;">${escapeHtml(label)}<button onclick="_relRemoverTermoColuna(${idx},${tIdx})" title="Remover este item" style="border:none;background:none;color:#2563eb;cursor:pointer;font-size:12px;padding:0 3px;line-height:1;font-weight:700;">✕</button></span>`;
            }).join('') + _acaoPreviaTrailingHtml(window._relAcaoSel, '#2563eb');
        } else {
            canvasConteudo = `<span style="color:#9ca3af;font-size:11.5px;">arraste um campo aqui</span>`;
        }
        const btnRemover = window._relColunas.length > 1
            ? `<button onclick="_relRemoverColuna(${idx})" title="Remover esta coluna" style="padding:5px 8px;background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;border-radius:6px;cursor:pointer;font-size:11px;">🗑️</button>`
            : '';
        const btnLimpar = termos.length > 1
            ? `<div style="text-align:right;margin-top:4px;"><button onclick="_relLimparTermosColuna(${idx})" title="Remover tudo o que foi arrastado (mantém o nome da coluna)" style="padding:2px 6px;background:none;border:1px dashed #93c5fd;border-radius:6px;color:#2563eb;cursor:pointer;font-size:10px;">🧹 limpar</button></div>`
            : '';
        return `<div style="flex:0 0 210px;width:210px;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px;box-sizing:border-box;">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
                <input type="text" class="wRelNomeColunaInput" value="${escapeHtml(col.nomeColuna)}" oninput="_relNomeColunaInput(${idx}, this.value)" placeholder="Nome da coluna *" style="flex:1;min-width:0;padding:7px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;outline:none;box-sizing:border-box;">
                ${btnRemover}
            </div>
            <div ondragover="_relDropZoneDragOver(event)" ondrop="_relDropZoneDrop(event,${idx})" style="position:relative;min-height:40px;padding:8px 10px;border:1.5px dashed #93c5fd;border-radius:8px;background:#eff6ff;display:flex;align-items:center;flex-wrap:wrap;">
                ${_relAcaoBadgeHtml(window._relAcaoSel, '#93c5fd', '#1e40af')}
                ${canvasConteudo}
            </div>
            ${btnLimpar}
        </div>`;
    }).join('');
}

function mostrarWizardRelatorio(nomePrefill, camposPrefill, origemPrefill) {
    const s = Ferr.stream('relatorios');
    const old = document.getElementById('wizardRelatorioCard'); if (old) old.remove();
    window._relOrigemSel = null;
    window._relAcaoSel = null;
    const card = document.createElement('div');
    card.id = 'wizardRelatorioCard';
    card.className = 'answer-card';
    card.innerHTML = `
<div style="background:#eff6ff;padding:10px 15px;border-bottom:1px solid #bfdbfe;font-size:12px;color:#1e40af;font-weight:700;border-radius:12px 12px 0 0;">📊 Assistente de Relatórios — Bsoft TMS</div>
<div style="padding:12px 15px 4px;">
  <div class="wizard-section">
    <div class="wizard-label">🏢 Origem</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="_relSelecionarOrigem('CTe')" data-origem="CTe" class="_rel-origem-btn" style="padding:10px 22px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;">CT-e</button>
        <button onclick="_relSelecionarOrigem('ContratoFrete')" data-origem="ContratoFrete" class="_rel-origem-btn" style="padding:10px 22px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;">Contrato de Frete</button>
    </div>
    <div style="font-size:11px;color:#9ca3af;margin-top:6px;">Escolha a origem dos dados do relatório personalizado.</div>
  </div>
  <div id="wRelStep2" style="display:none;">
    <div class="wizard-section">
      <div class="wizard-label">📝 Nome do relatório</div>
      <input id="wRelNome" type="text" placeholder="Ex: Relatório de CT-e por região" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">
    </div>
    <div class="wizard-section">
      <div class="wizard-label">🧩 Colunas do relatório</div>
      <div style="font-size:12px;color:#1e40af;font-weight:700;margin-bottom:6px;">1. Clique ou arraste a ação pra ativar <span style="font-weight:400;color:#6b7280;">(só necessário pra montar uma conta com 2+ campos numa coluna, tipo Total Prestação − Valor do Frete)</span>:</div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <button class="_rel-acao-btn" data-acao="+" onclick="_relClicarAcao('+')" draggable="true" ondragstart="_relAcaoDragStart(event,'+')" style="padding:7px 12px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">➕ Somar</button>
        <button class="_rel-acao-btn" data-acao="-" onclick="_relClicarAcao('-')" draggable="true" ondragstart="_relAcaoDragStart(event,'-')" style="padding:7px 12px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">➖ Subtrair</button>
        <button class="_rel-acao-btn" data-acao="*" onclick="_relClicarAcao('*')" draggable="true" ondragstart="_relAcaoDragStart(event,'*')" style="padding:7px 12px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">✖️ Multiplicar</button>
        <button class="_rel-acao-btn" data-acao="/" onclick="_relClicarAcao('/')" draggable="true" ondragstart="_relAcaoDragStart(event,'/')" style="padding:7px 12px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">➗ Dividir</button>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">2. Pesquise pelo nome do campo e arraste o resultado pra dentro da coluna desejada — pra montar uma conta, arraste o 1º campo, ative uma ação, e arraste o 2º campo na MESMA coluna.</div>
      <input type="text" id="wRelBusca" oninput="_relRenderResultadosBusca()" placeholder="Pesquisar campos... (ex: agência, placa, valor frete)" style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12.5px;outline:none;box-sizing:border-box;margin-bottom:8px;">
      <div id="wRelResultadosBusca" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;min-height:0;"></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
        <span style="font-size:11px;color:#6b7280;">Ou valor fixo:</span>
        <input type="text" id="wRelValorInput" inputmode="decimal" placeholder="Ex: 0.02" oninput="_relValorInputChange()" style="width:90px;padding:6px 8px;border:1.5px solid #d1d5db;border-radius:6px;font-size:11.5px;font-family:monospace;">
        <span id="wRelValorChip" draggable="true" ondragstart="_relValorDragStart(event)" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:#fff7ed;border:1.5px solid #fdba74;border-radius:16px;font-size:11.5px;font-family:monospace;cursor:not-allowed;user-select:none;color:#9a3412;opacity:.4;transition:opacity .15s;">🔢 arrastar</span>
      </div>
      <div id="wRelColunasContainer" style="display:flex;align-items:flex-start;gap:8px;overflow-x:auto;padding:2px 2px 10px;margin-bottom:4px;"></div>
      <button onclick="_relAdicionarColuna()" style="width:100%;padding:8px;background:white;border:1.5px dashed #3b82f6;border-radius:8px;color:#1e40af;cursor:pointer;font-size:12.5px;font-weight:700;">➕ Adicionar coluna</button>
    </div>
    <div class="wizard-section" style="border:none;">
      <div class="wizard-label">✏️ Ou descreva em texto livre <span style="font-size:10px;color:#9ca3af;font-weight:400;">(opcional — a IA identifica os campos, inclusive colunas calculadas tipo "Frete vezes 0,02")</span></div>
      <textarea id="wRelCampos" class="wizard-textarea" placeholder="Ex: Agência, Ano emissão, Cancelado e CFOP" style="min-height:70px;"></textarea>
      <div style="font-size:11px;color:#6b7280;margin-top:6px;">Campos disponíveis: dados do conhecimento, composição do frete, veículos, seguro, documentos, conteineres, cliente, emissor, motorista, remetente, destinatário e mais.</div>
    </div>
    <div style="padding:12px 0 8px;">
      <button id="wRelBtnEnviar" class="wizard-submit" onclick="enviarWizardRelatorio()">🚀 Gerar Relatório</button>
    </div>
  </div>
</div>`;
    s.appendChild(card);
    // Atribuído via .value (não interpolado no HTML) pra não precisar escapar aspas/caracteres especiais do texto do usuário.
    if (nomePrefill) document.getElementById('wRelNome').value = nomePrefill;
    if (camposPrefill) document.getElementById('wRelCampos').value = camposPrefill;
    if (origemPrefill) {
        // Reabrindo via "Voltar" — já sabemos a origem usada, pula a seleção manual.
        _relSelecionarOrigem(origemPrefill);
        setTimeout(() => document.getElementById('wRelCampos')?.focus(), 80);
    } else {
        ferrRolar('relatorios', true);
    }
}

// Reabre o wizard com tudo que o usuário já tinha preenchido (nome, descrição livre e as colunas
// montadas arrastando), pra não perder o trabalho já feito caso precise ajustar algo antes de
// gerar de novo — mesma ideia do botão Voltar dos assistentes de criação de regra.
function _voltarParaWizardRelatorio(ts) {
    const dados = window['_relatorioDat_' + ts];
    if (!dados) return;
    const card = document.getElementById('_relatorioResultCard_' + ts); if (card) card.remove();
    mostrarWizardRelatorio(dados.nome, dados.camposTxt, dados.origemSel);
    if (dados.colunasRascunho && dados.colunasRascunho.length) {
        window._relColunas = dados.colunasRascunho.map(c => ({ nomeColuna: c.nomeColuna, termos: (c.termos || []).map(t => ({ ...t })) }));
        _relRenderColunas();
    }
}

function _renderizarCardResultadoRelatorio(nomeRelatorio, camposTxt, encontrados, naoEncontrados, conteudoSerializado, nomeArquivoSugerido, origemSel, colunasRascunho) {
    const s = Ferr.stream('relatorios');
    const card = document.createElement('div');
    card.className = 'answer-card';
    const listaOk = encontrados.map(c => `<li><b>${escapeHtml(c.label)}</b> <span style="color:#6b7280;font-family:monospace;font-size:11.5px;">(${escapeHtml(c.exp)})</span></li>`).join('');
    const listaNok = naoEncontrados.length
        ? `<div class="answer-section"><div class="section-label path">⚠️ Não identificado</div><div class="section-content">Não encontrei campo correspondente para: <b>${naoEncontrados.map(escapeHtml).join(', ')}</b>. Você pode baixar mesmo assim e adicionar manualmente pelo sistema, ou clicar em "Voltar" pra reformular.</div></div>`
        : '';
    const comoUsar = `<div class="answer-section"><div class="section-label tip"><div class="section-icon tip">📥</div>Como importar no sistema</div><div class="section-content"><ol style="margin:0;padding-left:18px;line-height:1.9;">
        <li>Clique em <b>⬇️ Baixar</b> abaixo para salvar o arquivo <code style="background:#f4f4f4;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px;color:#c0392b;">.dat</code>.</li>
        <li>No sistema, acesse o menu <b>Transporte &gt; EDI &gt; Assistente de Relatórios</b>.</li>
        <li>Clique em <b>➕</b> para adicionar um novo relatório.</li>
        <li>Clique em <b>"Escolher arquivo"</b> e selecione o arquivo que você baixou.</li>
        <li>Clique em <b>Salvar</b>. Pronto — relatório criado com sucesso.</li>
    </ol></div></div>`;
    const ts = Date.now();
    card.id = '_relatorioResultCard_' + ts;
    window['_relatorioDat_' + ts] = { conteudo: conteudoSerializado, nomeArquivo: nomeArquivoSugerido, nome: nomeRelatorio, camposTxt, origemSel, colunasRascunho };
    card.innerHTML = `<div style="background:#eff6ff;padding:8px 15px;border-bottom:1px solid #bfdbfe;font-size:11px;color:#1e40af;font-weight:600;">📊 Assistente de Relatórios — Bsoft TMS</div>
<div class="answer-section"><div class="section-label how">✅ Campos identificados (${encontrados.length})</div><div class="section-content"><ul style="margin:0;padding-left:18px;">${listaOk || '<li>Nenhum</li>'}</ul></div></div>
${comoUsar}
${listaNok}
<div class="feedback-area">
  <button onclick="_baixarDatRelatorio(window['_relatorioDat_${ts}'].conteudo, window['_relatorioDat_${ts}'].nomeArquivo)" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:8px;background:#1e40af;color:white;cursor:pointer;font-size:13px;font-weight:700;">⬇️ Baixar ${escapeHtml(nomeArquivoSugerido)}</button>
  <button onclick="_voltarParaWizardRelatorio(${ts})" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid #1e40af;border-radius:8px;background:white;color:#1e40af;cursor:pointer;font-size:13px;font-weight:700;">🔙 Voltar</button>
  ${ferrBotaoNovoHtml('relatorios')}
</div>`;
    s.appendChild(card);
    ferrRolar('relatorios', true);
}

// Valida/normaliza o "exp" devolvido pela IA: pode ser uma referência direta do catálogo,
// ou uma conta (soma/subtração/multiplicação/divisão) envolvendo campo(s) do catálogo.
// Numa conta: exige que cada campo.subcampo usado exista de fato no catálogo (nunca confia
// cegamente na IA), corrige vírgula decimal pra ponto, e garante parênteses ao redor de cada
// campo (o sistema TMS retorna null se o campo usado numa conta não estiver entre parênteses).
// Retorna a expressão normalizada, ou null se não for válida (referência inexistente ou sem operador).
function _normalizarExpressaoRelatorio(exp, expsValidas) {
    const s = String(exp || '').trim();
    if (!s) return null;
    if (expsValidas.has(s)) return s;
    if (!/[+\-*/]/.test(s)) return null;
    const campos = s.match(/[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    if (campos.length === 0 || !campos.every(c => expsValidas.has(c))) return null;
    let norm = s.replace(/(\d),(\d)/g, '$1.$2');
    campos.forEach(c => {
        const cEsc = c.replace(/\./g, '\\.');
        if (!new RegExp(`\\(\\s*${cEsc}\\s*\\)`).test(norm)) {
            norm = norm.replace(new RegExp(cEsc, 'g'), `(${c})`);
        }
    });
    return norm;
}

async function enviarWizardRelatorio() {
    const btn = document.getElementById('wRelBtnEnviar');
    const origemSel = window._relOrigemSel;
    if (!origemSel) { ferrRolar('relatorios', true); return; }
    const nome = (document.getElementById('wRelNome')?.value || '').trim();
    const camposTxt = (document.getElementById('wRelCampos')?.value || '').trim();
    // Colunas montadas arrastando (nome da coluna + ao menos 1 termo, os dois obrigatórios pra
    // contar) — vão pro relatório final direto, sem precisar de IA nenhuma pra elas. Coluna com só
    // 1 termo vira uma expressão simples (igual sempre foi); com 2+ termos (campos/valores unidos
    // por ações) vira uma fórmula, no mesmo formato que a IA já gera a partir do texto livre.
    const colunasEstruturadas = (window._relColunas || [])
        .filter(c => c.nomeColuna && c.nomeColuna.trim() && c.termos && c.termos.length)
        .map(c => ({ exp: _relFormulaDeTermos(c.termos), label: c.nomeColuna.trim() }))
        .filter(c => c.exp !== null);
    // Guarda uma cópia de TODAS as colunas (inclusive as ainda incompletas) só pro botão Voltar
    // conseguir devolver a tela exatamente como o usuário deixou, mesmo com coluna pela metade.
    const colunasRascunho = (window._relColunas || []).map(c => ({ nomeColuna: c.nomeColuna, termos: (c.termos || []).map(t => ({ ...t })) }));
    if (!nome || (!camposTxt && colunasEstruturadas.length === 0)) {
        if (!nome) document.getElementById('wRelNome')?.focus();
        else document.getElementById('wRelBusca')?.focus();
        return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Identificando campos...'; }

    const catalogo = CATALOGO_RELATORIOS[origemSel] || CATALOGO_RELATORIOS.CTe;

    try {
        let encontradosIA = [], naoEncontrados = [];
        // Só chama a IA se sobrou descrição em texto livre pra ela interpretar — colunas montadas
        // 100% arrastando não precisam disso, e pular a chamada deixa esse caminho instantâneo.
        if (camposTxt) {
            const catalogoTxt = catalogo.map(c => `${c.label} => ${c.exp}`).join('\n');
            const sysMsg = `Você identifica campos de relatório do Bsoft TMS a partir de uma descrição em português.\nAbaixo está o catálogo de campos disponíveis (rótulo => expressão). Use APENAS expressões desse catálogo, nunca invente uma expressão que não esteja listada.\n\nCATÁLOGO:\n${catalogoTxt}\n\n⚠️ REGRA ABSOLUTA — NÃO ADICIONE CAMPOS NÃO PEDIDOS: Inclua em "encontrados" SOMENTE campos que correspondem a algo que o usuário mencionou EXPLICITAMENTE no pedido — mesmo que o termo usado seja sinônimo, abreviado ou levemente diferente do rótulo do catálogo. É PROIBIDO incluir campos "relacionados", "que costumam aparecer junto", ou que pareçam úteis para o contexto do relatório, se o usuário não pediu por eles. Exemplo: se o usuário pediu "CFOP e Chave", a resposta deve conter exatamente esses 2 campos — nunca adicione um terceiro campo (como Agência ou Data Emissão) só porque é comum em relatórios de CT-e. Conte quantos itens distintos o usuário pediu e garanta que "encontrados" não tenha mais itens que isso (um pedido pode gerar menos itens, se algo não for encontrado, mas nunca mais).\n\n📐 COLUNAS CALCULADAS (contas): o usuário pode pedir uma coluna que é o resultado de uma conta (soma, subtração, multiplicação ou divisão) envolvendo um campo do catálogo e um número, ou dois campos do catálogo. Nesse caso, em vez de uma expressão simples do catálogo, monte a fórmula matemática como "exp", seguindo ESTAS DUAS REGRAS OBRIGATÓRIAS do sistema:\n1. Separador decimal SEMPRE ponto, NUNCA vírgula — o sistema TMS não aceita vírgula. Se o usuário disser "vezes 0,02", escreva 0.02.\n2. Todo campo do catálogo usado dentro de uma conta DEVE ficar entre parênteses — se não ficar entre parênteses, o relatório retorna null nessa coluna. Use APENAS parênteses ao redor do campo, nunca ao redor do número.\nExemplo real: pedido "a coluna Comissão seja o Total prestação do Ct-e vezes 0,02" → {"label":"Comissão","exp":"(composicaoFrete.totalPrestacao)*0.02"}. Outro exemplo com dois campos: "Frete mais pedágio" → {"label":"Frete mais pedágio","exp":"(composicaoFrete.freteValor)+(composicaoFrete.pedagio)"}. Toda expressão dentro dos parênteses tem que ser uma expressão EXATA do catálogo acima — nunca invente uma.\n\nResponda APENAS um JSON válido (sem texto antes ou depois, sem markdown), no formato:\n{"encontrados":[{"label":"<rótulo do catálogo, ou o nome da coluna calculada pedida pelo usuário>","exp":"<expressão exata do catálogo, ou a fórmula de conta seguindo as regras acima>"}],"naoEncontrados":["<termo do pedido do usuário que não bateu com nenhum campo>"]}\nNão repita o mesmo campo duas vezes. Em "naoEncontrados", liste os termos pedidos que não têm nenhum campo correspondente no catálogo.`;
            const userMsg = `Pedido do usuário: "${camposTxt}"`;

            const result = await callMCPSemPensamento(
                [{ role: 'system', content: sysMsg }, { role: 'user', content: userMsg }],
                { temperature: 0.1, maxTokens: 2000 }
            );
            let raw = (result.text || '').trim();
            raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('IA não retornou JSON válido.');
            const parsed = JSON.parse(jsonMatch[0]);

            const expsValidas = new Set(catalogo.map(c => c.exp));
            const porExp = new Map(catalogo.map(c => [c.exp, c]));
            const vistos = new Set();
            (parsed.encontrados || []).forEach(item => {
                if (!item) return;
                const expNorm = _normalizarExpressaoRelatorio(item.exp, expsValidas);
                if (expNorm === null || vistos.has(expNorm)) return;
                vistos.add(expNorm);
                const cat = porExp.get(expNorm);
                encontradosIA.push({ exp: expNorm, label: (item.label || (cat ? cat.label : expNorm)) });
            });
            naoEncontrados = Array.isArray(parsed.naoEncontrados) ? parsed.naoEncontrados.filter(Boolean) : [];
        }

        // Junta as colunas montadas arrastando com o que a IA achou no texto livre, sem repetir o
        // mesmo campo — a coluna montada arrastando vale sobre o que a IA achou pro mesmo campo,
        // já que o nome dela foi escolhido de propósito pelo usuário.
        const vistosFinal = new Set();
        const encontrados = [];
        colunasEstruturadas.forEach(c => { if (!vistosFinal.has(c.exp)) { vistosFinal.add(c.exp); encontrados.push(c); } });
        encontradosIA.forEach(c => { if (!vistosFinal.has(c.exp)) { vistosFinal.add(c.exp); encontrados.push(c); } });

        const wCard = document.getElementById('wizardRelatorioCard'); if (wCard) wCard.remove();

        if (encontrados.length === 0) {
            ferrMsg('relatorios', 'ai', '⚠️ Não consegui identificar nenhum campo do catálogo a partir da sua descrição. Tente detalhar melhor (ex: nomes como Agência, CFOP, Placa do Veículo, Valor do Frete...).');
            if (btn) { btn.disabled = false; btn.textContent = '🚀 Gerar Relatório'; }
            return;
        }

        const nomeArquivoBase = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'relatorio';
        const nomeArquivoDat = nomeArquivoBase + '.dat';
        // origemSel é a chave interna do catálogo (CATALOGO_RELATORIOS) — o valor gravado no
        // .dat pode ser diferente (ex: ContratoFrete -> "CF"), por isso o mapeamento abaixo.
        const origemValorDat = _ORIGEM_VALOR_DAT[origemSel] || origemSel;
        const conteudo = _gerarConteudoDatRelatorio({ nome, nomeArquivo: '', origem: origemValorDat, tamanhoRelatorio: '27cm', campos: encontrados });

        _renderizarCardResultadoRelatorio(nome, camposTxt, encontrados, naoEncontrados, conteudo, nomeArquivoDat, origemSel, colunasRascunho);
        ferrConversa('relatorios', 'ai', `Relatório "${nome}" gerado com ${encontrados.length} campo(s): ${encontrados.map(c => c.label).join(', ')}.`);
        ferrLog('relatorios', 'Assistente de Relatórios - ' + nome, true);
    } catch (e) {
        console.error('[Relatórios]', e);
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Gerar Relatório'; }
        ferrMsg('relatorios', 'ai', '❌ Erro ao identificar os campos do relatório. Tente novamente.');
    }
}

// ── ferramenta em aba (Workspace → "Assistente de Relatórios"): abre direto o formulário ──
// O log é gravado quando o relatório é gerado (enviarWizardRelatorio), não ao abrir a aba.
Ferr.registrar('relatorios', {
    iniciar() { mostrarWizardRelatorio(); },
});
