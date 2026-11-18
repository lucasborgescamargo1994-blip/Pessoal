/* ═══════════════════════════════════════════════════════════════════════════
   PASSO A PASSO DA PRIMEIRA EMISSÃO  (config/migracao-roteiro.js)

   É o conteúdo da página migracao.html — uma área SÓ PARA O CLIENTE, feita para a primeira emissão ser rápida e sem fila no Suporte:
   o cliente responde 4 perguntas (de onde vem, quais documentos, seguro e últimos números emitidos) e segue um passo a passo
   (Anterior / Próximo) com o vídeo de cada passo e um chat com a IA ao lado.

   O QUE NÃO ENTRA AQUI: configuração do sistema (empresa, certificado, talões, regras, tabelas, usuários…). Isso é da Implantação ou do Suporte.
   A única configuração ensinada é a do SEGURO (cadastrar a apólice e ligar a averbação automática), a pedido da equipe.

   Cada PASSO:
     id        único e sem espaços (o progresso do cliente é guardado por ele — não mude o id de um passo em uso)
     titulo / resumo (uma frase: "o que vamos fazer")
     quando    (opcional) só aparece para quem combina com as respostas. Cada chave precisa combinar (E); dentro da lista basta uma (OU):
                 { trilha: ['nova'] }   { docs: ['cte'] }   { seguro: ['configurar'] }   (chaves: trilha, docs, seguro)
     tempo     estimativa curta           precisa   lista "tenha em mãos"
     onde      caminhos do MENU REAL do sistema ("Módulo > Pasta > Tela"); o teste automático confere contra config/menu-bsoft.js
     como      passo a passo curto (cada item é uma ação)        cuidados   as pegadinhas
     alertas   [{ se: {respostas…}, tipo: 'aviso'|'dica', texto }] — avisos que dependem das respostas do cliente
     video     lista de chaves do mapa "videos" (abaixo): os vídeos tutoriais anexados ao passo
     erros     os erros que mais aparecem no passo: [{ t: 'texto curto do botão', q: 'consulta ao banco de dados' }] — cada um abre o artigo com a solução
     buscas    consultas que a página faz no banco de dados (artigos, respostas aprovadas e FAQ) para ajudar a IA nesse passo
     mentor    a pergunta pronta que aparece como sugestão no chat        dinamico   (opcional) bloco especial do passo: 'numeracao' | 'prazos'

   PERGUNTAS (mais abaixo): cada uma tem id, tipo ('escolha' | 'multi' | 'numeracao'), rotulo, opcoes [{ v, r }], padrao e, no máximo, "so" (só para uma trilha).
     "ia" = o nome curto da pergunta no que a IA recebe (ex.: "Seguro de transporte (apólice)"); sem ele vale o rótulo. As respostas viram "quando" dos passos (chave = id da pergunta).

   REGRAS DE OURO
     • Linguagem simples: quem lê é o cliente, muitas vezes de uma empresa nova no transporte.
     • NUNCA escreva o código (número) de parâmetro ou funcionalidade. Prazos e regras fiscais ficam em config/migracao-regras.js.
   ═══════════════════════════════════════════════════════════════════════════ */
window.BSOFT_MIG_ROTEIRO = {
    revisadoEm: '2026-11-16',

    /* ───────────── vídeos tutoriais (canal da Bsoft no YouTube) ─────────────
       titulo = o título do vídeo; palavras = palavras que a IA usa para recomendar o vídeo quando a pergunta combina. */
    videos: {
        pessoas: { titulo: 'Cadastro de Pessoas - Clientes, Fornecedores, Motoristas e Proprietários de Veículos', url: 'https://www.youtube.com/watch?v=PQyEQINmHYA', palavras: 'cadastro pessoas cliente fornecedor motorista proprietário remetente destinatário' },
        veiculos: { titulo: 'Cadastro de Veículos', url: 'https://www.youtube.com/watch?v=3r39C32s6hQ', palavras: 'cadastro veículo placa caminhão cavalo carreta renavam antt categoria vinculação motorista' },
        cte: { titulo: 'Emissão de CT-e', url: 'https://www.youtube.com/watch?v=-JXA2O8ZVic', palavras: 'emitir emissão cte conhecimento transporte importar xml nota fiscal tomador pagador transmitir' },
        mdfe: { titulo: 'Emissão de MDF-e', url: 'https://www.youtube.com/watch?v=CHA-2165w9c', palavras: 'emitir emissão mdfe manifesto percurso documentos encerrar viagem' },
        ciotPropria: { titulo: 'Passo a passo CIOT Frota Própria', url: 'https://www.youtube.com/watch?v=ICTTOTKO3nY', palavras: 'ciot frota própria efrete frete mínimo tabela operação' },
        contratoFrete: { titulo: 'Contrato de Frete', url: 'https://www.youtube.com/watch?v=CLWs1ZHdk8Q', palavras: 'contrato frete ciot terceiros autônomo agregado vale pedágio vpo operadora' },
    },

    /* ───────────── de onde o cliente vem ───────────── */
    trilhas: {
        migracao: { icone: '🔄', titulo: 'Já emite em outro sistema', sub: 'Estou trocando para o Bsoft TMS e conheço os documentos.', ajuda: 'O foco é o jeito do Bsoft e continuar a numeração de onde parou.' },
        nova: { icone: '🌱', titulo: 'É uma empresa nova no transporte', sub: 'Nunca emiti documentos fiscais de transporte.', ajuda: 'Começa com uma explicação curta do que cada documento faz.' },
    },

    /* ───────────── as perguntas do começo ───────────── */
    perguntas: [
        { id: 'trilha', tipo: 'escolha', grande: true, rotulo: 'Sua empresa…', padrao: 'migracao',
          opcoes: [
            { v: 'migracao', r: '🔄 Já emite em outro sistema', d: 'Estou trocando para o Bsoft TMS e já conheço os documentos.' },
            { v: 'nova', r: '🌱 É uma empresa nova no transporte', d: 'Nunca emiti documentos fiscais de transporte.' },
          ] },
        { id: 'docs', tipo: 'multi', rotulo: 'Com quais documentos você quer ajuda para emitir?', ia: 'Documentos que precisa emitir', padrao: ['cte', 'mdfe'],
          ajuda: 'Marque só o que você vai emitir agora. Dá para mudar depois.',
          opcoes: [
            { v: 'cte', r: 'CT-e (conhecimento de transporte)' },
            { v: 'mdfe', r: 'MDF-e (manifesto da viagem)' },
            { v: 'ciotPropria', r: 'CIOT da frota própria' },
            { v: 'contratoFrete', r: 'Contrato de frete e CIOT (motorista de terceiros)' },
          ] },
        { id: 'seguro', tipo: 'escolha', rotulo: 'Você tem seguro de transporte (apólice)?', ia: 'Seguro de transporte (apólice)', padrao: 'configurado',
          opcoes: [
            { v: 'configurado', r: 'Sim, e já está configurado no sistema' },
            { v: 'configurar', r: 'Sim, mas ainda não configurei no sistema' },
            { v: 'nao', r: 'Não tenho / não sei' },
          ] },
        { id: 'numeracao', tipo: 'numeracao', so: ['migracao'], rotulo: 'Últimos números que você emitiu no sistema anterior (opcional)',
          ajuda: 'Vamos usar para conferir se o Bsoft continua de onde o outro sistema parou. Fica só neste computador.' },
    ],

    /* ───────────── uma só "fase": o passo a passo ───────────── */
    fases: [{ id: 'passos', icone: '🚀', titulo: 'Passo a passo', resumo: 'Da conferência à primeira emissão.' }],

    passos: [
        {
            id: 'entender', fase: 'passos', nivel: 'recomendado', quando: { trilha: ['nova'] },
            titulo: 'Entenda em 2 minutos o que vamos emitir',
            resumo: 'Cada serviço de transporte gera documentos fiscais. Veja para que serve cada um e em que ordem eles saem.',
            tempo: '2 min',
            como: [
                'CT-e (Conhecimento de Transporte Eletrônico): é o documento do serviço de transporte de uma carga. Precisa estar autorizado antes de a carga viajar.',
                'MDF-e (Manifesto Eletrônico): reúne, numa viagem, os documentos da carga que estão no veículo. É o que a fiscalização consulta na estrada.',
                'CIOT: é o código que registra a operação de transporte na ANTT. Desde 24/05/2026 vale para toda operação, inclusive de frota própria, e precisa existir antes de a viagem começar.',
                'Contrato de frete: é o acordo com o motorista autônomo ou agregado. É ele que gera o CIOT e o vale-pedágio.',
                'A ordem costuma ser: CT-e → CIOT (quando houver) → MDF-e → viagem. Os próximos passos mostram cada um.',
            ],
            cuidados: ['Quais documentos valem para a sua carga e rota depende da legislação: confirme com o seu contador.'],
            buscas: ['quais são os tipos de ct-e e quando usá-los', 'o que é um manifesto mdf-e', 'o que é ciot'],
            mentor: 'Explique, como se eu fosse leigo, para que serve cada documento e em que ordem eu emito.',
        },
        {
            id: 'numeracao', fase: 'passos', nivel: 'obrigatorio', quando: { trilha: ['migracao'] }, dinamico: 'numeracao',
            titulo: 'Confira se a numeração continua de onde o outro sistema parou',
            resumo: 'Cada série tem uma sequência única. Se o Bsoft começar de um número que você já usou, a SEFAZ rejeita (rejeição 539, duplicidade).',
            tempo: '3 min',
            precisa: ['O último número que você emitiu de cada série (CT-e e MDF-e) no sistema anterior'],
            onde: ['Transporte > Configurações > Tipos de Talões'],
            como: [
                'No Bsoft, abra Transporte > Configurações > Tipos de Talões e localize o talão do CT-e e o do MDF-e.',
                'Clique em visualizar e abra a guia Talões liberados: veja qual é o próximo número liberado.',
                'Compare com o seu último número: o Bsoft tem que continuar do número seguinte.',
                'Igual? Pode seguir. Diferente ou repetido? Não emita ainda e fale com o Suporte para acertar a sequência.',
            ],
            cuidados: ['Nunca emita a mesma série nos dois sistemas ao mesmo tempo: se precisar operar em paralelo, use uma série diferente em cada um.'],
            buscas: ['rejeição sefaz 539 duplicidade', 'para corrigir a sequência dos números dos conhecimentos e manifestos'],
            erros: [{ t: 'Rejeição 539 (duplicidade)', q: 'rejeição sefaz 539 duplicidade' }],
            mentor: 'Como confiro se a numeração do Bsoft continua de onde o sistema antigo parou?',
        },
        {
            id: 'pessoas', fase: 'passos', nivel: 'obrigatorio',
            titulo: 'Cadastre quem aparece no documento e o motorista',
            resumo: 'Quem envia, quem recebe, quem paga o frete e o motorista precisam estar cadastrados antes de emitir.',
            tempo: '5 min',
            precisa: ['CNPJ/CPF e inscrição estadual de cada cliente', 'Endereço completo e e-mail', 'Nome e CPF do motorista'],
            onde: ['Pessoas > Pessoas'],
            como: [
                'Abra Pessoas > Pessoas e clique em adicionar (+).',
                'Preencha os campos obrigatórios (os que têm asterisco). Para o motorista, marque o grupo Motoristas.',
                'Salve. Repita para cada cliente e motorista.',
            ],
            cuidados: ['Confira o CNPJ/CPF e a inscrição estadual: dado errado vira rejeição na hora de emitir.', 'Já está cadastrado? Pesquise antes, para não duplicar.'],
            video: ['pessoas'],
            buscas: ['qual o caminho para cadastro de motorista no sistema', 'importação de pessoas', 'cadastro de pessoas endereço não aparece'],
            erros: [{ t: 'O endereço não aparece no cadastro', q: 'não estava aparecendo o endereço para preencher no cadastro de pessoas' }],
            mentor: 'Como cadastro um cliente e um motorista no Bsoft?',
        },
        {
            id: 'veiculos', fase: 'passos', nivel: 'obrigatorio',
            titulo: 'Cadastre o veículo e ligue o motorista à placa',
            resumo: 'Cada placa precisa estar na categoria certa, com o proprietário correto, e ligada ao motorista da viagem.',
            tempo: '5 min',
            precisa: ['Placa e Renavam', 'Quem é o proprietário (como consta no documento do veículo) e, se a ANTT estiver em nome de outra pessoa, quem é', 'Categoria do veículo (truck, cavalo, carreta…)'],
            onde: ['Transporte > Veículos', 'Transporte > Vinculação de Motoristas'],
            como: [
                'Abra Transporte > Veículos e clique em adicionar (+).',
                'Informe a placa, o grupo (frota própria, terceiros ou agregado), a categoria e o proprietário. Preencha o Renavam, o ano, o chassi e o número de eixos.',
                'Abra Transporte > Vinculação de Motoristas e ligue o motorista à(s) placa(s) da viagem.',
            ],
            cuidados: [
                'Categoria errada (um truck cadastrado como carreta) obriga a informar uma segunda placa e trava o CIOT e o MDF-e.',
                'O importante é constar como proprietário ou arrendatário quem tem a ANTT ligada ao Renavam do veículo. Na dúvida, use a consulta pública da ANTT.',
            ],
            alertas: [{ se: { docs: ['ciotPropria'] }, tipo: 'aviso', texto: 'Para o CIOT da frota própria, o veículo precisa estar no grupo Frota própria.' }],
            video: ['veiculos'],
            buscas: ['como cadastrar um veículo placa no sistema', 'como fazer vinculação de motoristas', 'veículo em nome de uma empresa antt em nome de pessoa física'],
            erros: [{ t: 'Pede segunda placa', q: 'vincular terceira quarta placa conjunto de veículos não permite assumir posição' }, { t: 'ANTT em nome de outra pessoa', q: 'veículo em nome de uma empresa antt em nome de pessoa física motorista' }],
            mentor: 'Como cadastro um veículo e ligo o motorista à placa, e que erros devo evitar?',
        },
        {
            id: 'seguro', fase: 'passos', nivel: 'recomendado', quando: { seguro: ['configurar'] },
            titulo: 'Seguro: cadastre a apólice e ligue a averbação automática',
            resumo: 'Averbar é avisar a seguradora de cada CT-e emitido. Configurado uma vez, o sistema faz isso sozinho.',
            tempo: '10 min',
            precisa: ['A apólice do seguro (número, vigência e seguradora)', 'Confirmação de que o módulo de averbação está contratado com a Bsoft', 'Os dados de acesso da integração, fornecidos pelo seu averbador'],
            onde: ['Transporte > Configurações > Apólices de Seguro'],
            como: [
                'Confirme com a Bsoft que o módulo Averbação de Carga está contratado (ele aparece nos módulos adicionais da empresa).',
                'Abra Transporte > Configurações > Apólices de Seguro e clique em adicionar (+). Preencha os dados da apólice.',
                'No fim do cadastro, em Forma de averbação, escolha Automática.',
                'Informe os dados da integração do seu averbador (meio de averbação, usuário, senha e código, conforme o averbador).',
                'Salve. Os próximos CT-e passam a ser averbados sozinhos.',
            ],
            cuidados: [
                'Sem averbação, o DACTE e o DAMDFE podem ficar bloqueados para visualização.',
                'Os dados de acesso são do seu averbador: peça a ele. Não existe um padrão para copiar.',
            ],
            buscas: ['como configurar averbação automática de um ct-e', 'operadoras e sistemas compatíveis para averbação automática', 'visualizar dacte e damdfe quando não está averbado'],
            erros: [{ t: 'Erro de averbação', q: 'erro averbação valor da is maior que o limite permitido' }, { t: 'DACTE bloqueado (não averbado)', q: 'visualizar dacte e damdfe quando não está averbado' }],
            mentor: 'Como cadastro a apólice de seguro e ligo a averbação automática dos CT-e?',
        },
        {
            id: 'cte', fase: 'passos', nivel: 'obrigatorio', quando: { docs: ['cte'] },
            titulo: 'Emitir o CT-e',
            resumo: 'Importar o XML da nota fiscal preenche quase tudo. O resto é conferir quem paga, o talão e o frete.',
            tempo: '10 min',
            precisa: ['O XML da nota fiscal (NF-e) do seu cliente, ou os dados dela', 'Quem paga o frete (o pagador/tomador)', 'O motorista e a(s) placa(s) que vão levar a carga'],
            onde: ['Transporte > Documentos > CT-e', 'Transporte > Conhecimentos'],
            como: [
                'Abra Transporte > Documentos > CT-e (ou Transporte > Conhecimentos) e clique em adicionar (+).',
                'Escolha como começar: Importar arquivo XML de NF-e (o mais rápido) ou Preenchimento manual, quando não há XML.',
                'Dados básicos: confira o talão, a agência, o pagador (tomador) e o tipo de CT-e (normal). Campos com asterisco são obrigatórios.',
                'Dados do frete: confira o valor, o ICMS e o CFOP; ajuste o que for preciso.',
                'Se quiser emitir junto, marque Criar Manifesto (MDF-e) e/ou Emitir contrato de frete.',
                'Salve e transmita. Confira que o status ficou autorizado e guarde o protocolo.',
            ],
            cuidados: [
                'Depois de importar o XML, confira se o pagador continua sendo o correto: o sistema pode trocar esse campo.',
                'Rejeição quer dizer que o CT-e NÃO foi emitido: leia o código e a mensagem, corrija e transmita de novo.',
            ],
            alertas: [
                { se: { docs: ['ciotPropria'] }, tipo: 'aviso', texto: 'Você vai emitir o CIOT da frota própria: salve o CT-e, mas NÃO transmita ainda. A ordem certa é salvar o CT-e e o MDF-e, gerar o CIOT e só então transmitir os dois.' },
                { se: { docs: ['contratoFrete'] }, tipo: 'dica', texto: 'Motorista de terceiros: marque Emitir contrato de frete na emissão do CT-e (ou use o passo do contrato de frete) para gerar o CIOT antes de transmitir o MDF-e.' },
            ],
            video: ['cte'],
            buscas: ['como emitir um ct-e', 'como lançar um ct-e no sistema', 'quais são os tipos de ct-e e quando usá-los'],
            erros: [
                { t: 'Erro Digest ao importar a nota', q: 'erro digest ao tentar importar uma nota fiscal para emitir ct-e' },
                { t: 'modFrete diferente', q: 'ao criar ct-e a partir de nf-e pré cadastrada erro modFrete informações diferentes' },
                { t: 'O pagador trocou sozinho', q: 'ao importar xml de nf-e ele altera automaticamente o campo do pagador' },
                { t: 'CFOP não aparece', q: 'cfop natureza da operação não aparece' },
                { t: 'Erro ao salvar com isenção de ICMS', q: 'erro para salvar ct-e com isenção de icms' },
                { t: 'Rejeição 539 (duplicidade)', q: 'rejeição sefaz 539 duplicidade' },
            ],
            mentor: 'Como emito o meu primeiro CT-e no Bsoft TMS, passo a passo e rápido?',
        },
        {
            id: 'mdfe', fase: 'passos', nivel: 'obrigatorio', quando: { docs: ['mdfe'] },
            titulo: 'Emitir o MDF-e',
            resumo: 'O manifesto reúne os CT-e (e notas) da viagem. Pode ser criado junto com o CT-e ou à parte.',
            tempo: '8 min',
            precisa: ['O CT-e (ou a NF-e) da viagem já salvo ou autorizado', 'O motorista e o veículo cadastrados e ligados', 'Origem, destino e os estados por onde a viagem passa', 'O produto predominante e o NCM da carga'],
            onde: ['Transporte > Manifesto de Carga', 'Transporte > Documentos > MDF-e'],
            como: [
                'Jeito mais rápido: na emissão do CT-e, marque Criar Manifesto na guia Dados Básicos.',
                'Ou abra Transporte > Manifesto de Carga, clique em adicionar (+) e escolha a agência e o talão (série).',
                'Informe a origem e o destino. O percurso pode ser sugerido automaticamente.',
                'Vincule os documentos (CT-e, notas ou chave de acesso) e confira os totais de peso, quantidade e valor.',
                'Detalhamento da carga: produto predominante, tipo de carga, NCM e CEPs de carregamento e descarregamento.',
                'Salve e transmita. Confira o status e o protocolo.',
            ],
            cuidados: [
                'O motorista e o veículo do MDF-e precisam bater com os do CT-e e do contrato de frete.',
                'Quando a viagem terminar, encerre o MDF-e (veja o último passo).',
            ],
            alertas: [
                { se: { docs: ['ciotPropria'] }, tipo: 'aviso', texto: 'CIOT da frota própria: salve o MDF-e, mas NÃO transmita ainda. Gere o CIOT primeiro e depois transmita o CT-e e o MDF-e.' },
                { se: { docs: ['contratoFrete'] }, tipo: 'aviso', texto: 'Motorista de terceiros: gere o CIOT pelo contrato de frete antes de transmitir o MDF-e (o CIOT fica ligado a ele).' },
            ],
            video: ['mdfe'],
            buscas: ['como emitir um mdf-e manualmente', 'como emitir um mdf-e juntamente com a emissão do ct-e', 'exemplo de instrução para emissão de mdf-e'],
            erros: [
                { t: 'xNome inválido (nome do tomador)', q: 'erro ao tentar enviar mdf-e para o sefaz xNome não é válido' },
                { t: 'Produto predominante sai como Diversos', q: 'produto predominante sai com nome diversos' },
                { t: 'Não aparece o pagamento do frete', q: 'não aparece para colocar informações de pagamento no mdf-e' },
                { t: 'Circulação do MDF-e verificada', q: 'rejeição circulação do mdf-e verificada' },
                { t: 'Trocar o motorista de um MDF-e autorizado', q: 'como incluir motorista em mdfe autorizado' },
            ],
            mentor: 'Como emito o meu primeiro MDF-e no Bsoft TMS, passo a passo e rápido?',
        },
        {
            id: 'ciotPropria', fase: 'passos', nivel: 'obrigatorio', quando: { docs: ['ciotPropria'] },
            titulo: 'CIOT da frota própria',
            resumo: 'Desde 24/05/2026 toda operação precisa de CIOT, inclusive a de frota própria. O CIOT sai ANTES de transmitir o CT-e e o MDF-e.',
            tempo: '8 min',
            precisa: ['O módulo CIOT Frota Própria contratado e a integração com a efrete ativa', 'O veículo no grupo Frota própria', 'Valor do frete, tipo de operação (lotação ou fracionado), km percorridos (use o portal Qualp), número de eixos e se há retorno'],
            onde: ['Transporte > CIOT Frota Própria', 'Transporte > Documentos > CT-e', 'Transporte > Documentos > MDF-e'],
            como: [
                'Ordem certa: 1) salve o CT-e e o MDF-e SEM transmitir; 2) gere o CIOT Frota Própria; 3) só então transmita o CT-e e o MDF-e.',
                'Para gerar: no CT-e ou no MDF-e, selecione o registro e clique em Gerar CIOT Frota Própria, ou abra Transporte > CIOT Frota Própria e clique em Adicionar.',
                'Confira os campos: agência e talão, valor do frete, tipo de operação, tabela (A, B, C ou D), tipo de carga, km, retorno, número de eixos, motorista e veículos.',
                'O sistema calcula o frete mínimo: o valor do frete não pode ficar abaixo dele, senão a ANTT e a operadora rejeitam.',
                'Gere o CIOT, confira na listagem e então transmita o CT-e e o MDF-e.',
            ],
            cuidados: [
                'Veículo de terceiro não funciona aqui: para terceiros o CIOT sai pelo contrato de frete.',
                'Tabela A = cavalo + implemento (a mais comum). B = só o cavalo. C e D = o mesmo, para alto desempenho. No tipo fracionado não se preenche tabela nem eixos.',
                'Não achou a tela? O módulo de CIOT Frota Própria é contratado à parte: fale com o Comercial da Bsoft.',
            ],
            video: ['ciotPropria'],
            buscas: ['como emitir ciot frota própria', 'como emitir ciot frota própria pelo ct-e', 'quais campos preencher no ciot frota própria'],
            erros: [
                { t: 'Veículo de terceiro não funciona', q: 'ciot frota própria com veículo terceiro não funciona' },
                { t: 'CIOT rejeitado pela ANTT', q: 'por que meu ciot está sendo rejeitado pela antt' },
                { t: 'Frete abaixo do mínimo', q: 'o que é frete mínimo no ciot' },
                { t: 'Erro de conta financeira bancária', q: 'erro conta financeira bancária para emitir ciot frota própria' },
                { t: 'O que é tabela A, B, C, D', q: 'o que significa tabela a no ciot' },
            ],
            mentor: 'Como emito o CIOT da frota própria e em que ordem em relação ao CT-e e ao MDF-e?',
        },
        {
            id: 'contratoFrete', fase: 'passos', nivel: 'obrigatorio', quando: { docs: ['contratoFrete'] },
            titulo: 'Contrato de frete e CIOT (motorista de terceiros)',
            resumo: 'Quando o motorista é autônomo ou agregado, o CIOT (e o vale-pedágio) saem pelo contrato de frete.',
            tempo: '10 min',
            precisa: ['Dados do motorista e do contratado (proprietário do veículo), com a ANTT em dia', 'O veículo e a(s) carreta(s)', 'Forma de pagamento e dados da operadora (efrete, por exemplo)', 'Origem, destino e dados do frete mínimo'],
            onde: ['Transporte > Contrato de Frete', 'Transporte > Documentos > CT-e'],
            como: [
                'Pelo CT-e: marque Emitir contrato de frete (aparece uma terceira guia). Ou abra Transporte > Contrato de Frete e clique em adicionar (+).',
                'Use o filtro para trazer o CT-e ou o MDF-e. Escolha o motorista, o veículo principal, os vinculados e o contratado.',
                'Informe a agência, o talão e a forma de pagamento: para gerar CIOT escolha Depósito ou Operadora de crédito.',
                'Na efrete, escolha Depósito e marque Via emissor gratuito: Sim; preencha a operadora de crédito, a data programada do saldo e o tipo de embalagem.',
                'Preencha as datas da viagem e as informações do frete mínimo (origem, destino, tabela, tipo de carga, km e eixos). Salve.',
                'Gere o CIOT pelo ícone CFe do contrato (opção incluir). Para o vale-pedágio, escolha o tipo de pedágio no contrato.',
                'Com o CIOT gerado, transmita o MDF-e.',
            ],
            cuidados: [
                'Os erros mais comuns vêm de cadastro: motorista ou veículo incompletos, ANTT em nome de quem não é o proprietário, CEP inexistente e peso zerado.',
                'Se aparecer erro de falta de preenchimento em um cadastro (motorista, placa), corrija o cadastro e tente gerar de novo.',
            ],
            video: ['contratoFrete'],
            buscas: ['como emitir um contrato de frete', 'como gerar ciot', 'como configura o módulo vale pedágio vpo no sistema'],
            erros: [
                { t: 'Contrato sem operadora de crédito', q: 'contrato de frete selecionado não possui uma operadora de crédito definida' },
                { t: 'ANTT incorreta (proprietário)', q: 'erros que pode apresentar de antt incorreta referente ao proprietário informado ao tentar gerar ciot' },
                { t: 'Faltam dados de vale-pedágio', q: 'é necessário definir os dados de vale-pedágio no contrato de frete' },
                { t: 'efrete: peso maior que zero', q: 'erro adicionando operação de transporte verifique se peso da carga é maior que zero' },
                { t: 'efrete: ao menos um pagamento', q: 'erro adicionando operação de transporte ao menos um pagamento deve ser preenchido' },
                { t: 'Obriga o Perfil da Carga', q: 'contrato de frete dando erro para salvar obrigando a preencher campo perfil da carga' },
            ],
            mentor: 'Como emito o contrato de frete e gero o CIOT de um motorista autônomo, passo a passo?',
        },
        {
            id: 'depois', fase: 'passos', nivel: 'recomendado', dinamico: 'prazos',
            titulo: 'Depois de emitir: conferir, encerrar e prazos',
            resumo: 'Confirme o resultado, encerre o MDF-e quando a viagem terminar e saiba até quando dá para cancelar ou corrigir.',
            tempo: '5 min',
            como: [
                'Confira o status (autorizado) e o protocolo. Abra o DACTE (CT-e) e o DAMDFE (MDF-e) e confira os dados.',
                'Guarde sempre o XML: é ele o documento fiscal, não o PDF.',
                'Quando a viagem terminar, encerre o MDF-e. MDF-e esquecido aberto por mais de 30 dias trava as próximas emissões.',
                'Errou algum dado? Cancelar tem prazo curto: veja abaixo e use a calculadora.',
            ],
            cuidados: ['Rejeição quer dizer que o documento NÃO foi emitido. Corrija e transmita de novo.', 'Deu erro? Use o chat ao lado: cole a mensagem e a IA mostra a causa e a correção.'],
            buscas: ['como encerrar mdf-e que emiti em outro sistema', 'como cancelar um ct-e na sefaz', 'como cancelar na sefaz um mdf-e'],
            erros: [{ t: 'Cancelar CT-e fora do prazo', q: 'como cancelar ct-e fora do prazo para cancelamento e substituição' }, { t: 'Encerrar um MDF-e', q: 'como encerrar mdf-e que emiti em outro sistema' }],
            mentor: 'Depois de emitir, o que devo fazer e quais são os prazos para cancelar e encerrar?',
        },
    ],

    /* ───────────── sugestões de pergunta no chat (além da pergunta pronta de cada passo) ───────────── */
    sugestoes: {
        geral: ['O que preciso ter em mãos para este passo?', 'Em que ordem emito o CT-e, o MDF-e e o CIOT?', 'Quais são os prazos mais importantes?'],
    },
};
