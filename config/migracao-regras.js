/* ═══════════════════════════════════════════════════════════════════════════
   REGRAS E PRAZOS  (config/migracao-regras.js)

   Os prazos e regras de migracao.html: o bloco "Prazos que você precisa conhecer" (último passo) e a calculadora "Até quando posso cancelar?".
   Também é a ÚNICA fonte de prazos e obrigações que a IA do chat pode afirmar: tudo o que não estiver aqui ela manda confirmar com o contador.

   ⚠️ LEGISLAÇÃO MUDA — e muda por estado. Cada regra tem a data em que foi conferida e um NÍVEL:
        'conferido'   várias fontes concordam (e/ou a própria base de conhecimento do Suporte Bsoft diz o mesmo);
        'orientativo' as fontes divergem, vale por estado, ou mudou há pouco: a página mostra "confirme com o seu contador".
   Quando a lei mudar, ajuste o texto, o nível e o "conferidoEm" e suba o arquivo no GitHub. Nada mais precisa mudar.

   Conferido em 16/11/2026 em fontes de mercado (blogs e manuais de fornecedores de software fiscal, portais de contabilidade) e na base de conhecimento do
   Suporte Bsoft. Os textos oficiais (Ajustes SINIEF, Manuais de Orientação do Contribuinte, resoluções da ANTT) NÃO foram lidos na íntegra — peça ao
   contador ou ao fiscal da empresa para validar antes de divulgar aos clientes.

   Campos de cada regra:
     id, doc ('CT-e' | 'MDF-e' | 'CIOT e ANTT' | 'Geral'), titulo, regra (uma frase), detalhe (lista), seNaoCumprir, varia (o que muda por estado),
     prazo (texto curto do prazo, ou vazio), nivel, conferidoEm, fontes [{ titulo, url }], onde (caminhos do menu), buscas (consultas ao banco), mentor (pergunta pronta).
   Calculadora: cada item soma um prazo a uma data (horas, dias ou anos).
   ═══════════════════════════════════════════════════════════════════════════ */
window.BSOFT_MIG_REGRAS = {
    revisadoEm: '2026-11-16',
    aviso: 'Resumo de apoio conferido em 16/11/2026 em fontes de mercado e na base do Suporte. Não substitui a orientação do contador nem a legislação do seu estado.',

    regras: [
        /* ═════════ CT-e ═════════ */
        {
            id: 'cte-emitir-antes', doc: 'CT-e', titulo: 'Emitir antes de começar o transporte',
            regra: 'O CT-e precisa estar autorizado pela SEFAZ antes de a carga sair: a emissão é anterior ao início da prestação do serviço de transporte.',
            detalhe: [
                'Não existe "validade" para um CT-e emitido antes da viagem: basta a emissão ser anterior ao início do transporte.',
                'O documento só pode ser emitido depois de conhecido o documento que originou a prestação (normalmente a nota fiscal da carga).',
            ],
            seNaoCumprir: 'Transportar sem o CT-e autorizado deixa a operação irregular e sujeita a autuação.',
            varia: 'Há exceções em protocolos específicos (por exemplo, transporte ferroviário). Para transporte rodoviário a regra geral é essa.',
            prazo: 'Antes do início da prestação', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Portal Nacional do CT-e — Perguntas frequentes', url: 'https://www.cte.fazenda.gov.br/portal/perguntasFrequentes.aspx?tipoConteudo=HC%2Fiuy94%2FRk%3D' }],
            onde: ['Transporte > Documentos > CT-e'], buscas: ['como emitir um ct-e'],
            mentor: 'Quando preciso emitir o CT-e em relação à saída da carga?',
        },
        {
            id: 'cte-cancelar', doc: 'CT-e', titulo: 'Cancelar um CT-e',
            regra: 'O CT-e pode ser cancelado em até 7 dias (168 horas) contados da autorização — desde que o transporte não tenha começado e não haja um MDF-e já encerrado ligado a ele.',
            detalhe: [
                'O prazo conta da autorização pela SEFAZ (data e hora do protocolo), não da meia-noite.',
                'Impedem o cancelamento: MDF-e vinculado já encerrado (ou com circulação verificada), carta de correção emitida para esse CT-e, CT-e de substituição ou complementar já ligados a ele e prestação já iniciada.',
                'Se existe MDF-e ainda autorizado, resolva o MDF-e primeiro (cancele ou desvincule dentro do prazo dele).',
            ],
            seNaoCumprir: 'Fora do prazo ou das condições: o contador pode pedir à SEFAZ o cancelamento extemporâneo (cada estado decide e pode cobrar). Se não for autorizado, as saídas são o CT-e complementar (quando faltou valor) ou o de substituição. O cancelamento "gerencial" vale só dentro do sistema: não tem efeito na SEFAZ.',
            varia: 'No Mato Grosso (MT) o prazo é de 8 horas, segundo a base do Suporte. Outros estados podem aceitar cancelamento extemporâneo.',
            prazo: '7 dias (168 h) após a autorização · MT: 8 h', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'Blog Bsoft — Como cancelar um CT-e', url: 'https://bsoft.com.br/blog/como-cancelar-um-cte' },
                { titulo: 'Qive — Como cancelar ou corrigir um CT-e', url: 'https://qive.com.br/blog/conhecimento-transporte-cancelar-corrigir-cte' },
                { titulo: 'Oobj — Ciclo de vida do CT-e', url: 'https://oobj.com.br/legislacao/ciclo-de-vida-cte/' },
            ],
            onde: ['Transporte > Documentos > CT-e'], buscas: ['como cancelar um ct-e na sefaz', 'como cancelar ct-e fora do prazo para cancelamento e substituição', 'como cancelar gerencialmente um ct-e'],
            mentor: 'Emiti um CT-e e preciso cancelar. Qual é o prazo e o que pode me impedir?',
        },
        {
            id: 'cte-cce', doc: 'CT-e', titulo: 'Carta de correção (CC-e)',
            regra: 'A carta de correção corrige dados informativos do CT-e, mas NÃO pode alterar valores e impostos, quem são as partes (remetente, destinatário, tomador) nem as datas.',
            detalhe: [
                'Serve para erros simples, como observações e alguns dados de transporte (veículo, motorista).',
                'Não há um prazo único nacional para a carta de correção; a regra pode variar por estado.',
                'Depois de emitir uma carta de correção para um CT-e, ele não pode mais ser cancelado (por isso, se o caminho é cancelar, cancele primeiro).',
            ],
            seNaoCumprir: 'Erro que a carta não pode corrigir (valor, tomador, data): cancelar (se ainda der), complementar ou substituir o CT-e.',
            varia: 'Quais campos aceitam correção pode mudar conforme a versão do leiaute e a orientação do estado: confirme na dúvida.',
            prazo: 'Sem prazo nacional único', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'Blog Bsoft — Como arrumar um CT-e emitido errado', url: 'https://bsoft.com.br/blog/gratis-manual-de-orientacao-o-que-fazer-ao-emitir-um-cte-errado' },
                { titulo: 'Oobj — Ciclo de vida do CT-e', url: 'https://oobj.com.br/legislacao/ciclo-de-vida-cte/' },
            ],
            onde: ['Transporte > Documentos > CT-e'], buscas: ['como emitir uma carta de correção para um ct-e'],
            mentor: 'O que posso e o que não posso corrigir com a carta de correção do CT-e?',
        },
        {
            id: 'cte-complementar', doc: 'CT-e', titulo: 'CT-e complementar',
            regra: 'O CT-e complementar serve para cobrar um valor que faltou (por exemplo, impostos ou frete a menos). Ele complementa valores; não corrige peso nem outros dados.',
            detalhe: [
                'Ordem que a base do Suporte recomenda para um CT-e errado: 1º cancelar (é o mais simples); se não der, 2º complementar; só em último caso, substituição.',
                'Dá para complementar também um CT-e emitido no sistema antigo, importando o XML dele.',
            ],
            seNaoCumprir: 'Se o erro não é só de valor, a saída é a substituição.',
            varia: 'Não há prazo nacional definido: o estado pode limitar. Confirme na dúvida.',
            prazo: 'Sem prazo nacional definido', nivel: 'orientativo', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Oobj — Ciclo de vida do CT-e', url: 'https://oobj.com.br/legislacao/ciclo-de-vida-cte/' }],
            onde: ['Transporte > Documentos > CT-e'], buscas: ['como emitir um ct-e complementar no sistema', 'quais são os tipos de ct-e e quando usá-los'],
            mentor: 'Esqueci de cobrar um valor no CT-e. Como faço o CT-e complementar?',
        },
        {
            id: 'cte-substituicao', doc: 'CT-e', titulo: 'CT-e de substituição (e o fim da anulação)',
            regra: 'O CT-e de substituição troca um CT-e emitido com erro quando já não dá mais para cancelar. No leiaute atual (4.00) ele ocupou o lugar do antigo CT-e de anulação, que deixou de existir.',
            detalhe: [
                'Se o erro foi no tomador ou em valores, o caminho costuma passar pelo evento de desacordo do tomador e depois pela substituição.',
                'Há condições: não pode alterar notas fiscais, o CT-e original não pode ter complementar e as regras de quem pode ser o novo tomador são restritas.',
            ],
            seNaoCumprir: 'Fora das condições, fale com o contador: pode ser necessário o cancelamento extemporâneo.',
            varia: 'O prazo para substituir aparece diferente nas fontes (de 60 a 90 dias). Não conte com ele sem confirmar com o contador ou a SEFAZ.',
            prazo: 'Confirme (fontes divergem)', nivel: 'orientativo', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'Blog Bsoft — Como arrumar um CT-e emitido errado', url: 'https://bsoft.com.br/blog/gratis-manual-de-orientacao-o-que-fazer-ao-emitir-um-cte-errado' },
                { titulo: 'Contmatic — Inutilizar CT-e: ainda é possível?', url: 'https://simplifique.contmatic.com.br/blogs/inutilizar-cte-ainda-e-possivel-o-que-mudou' },
            ],
            onde: ['Transporte > Documentos > CT-e'], buscas: ['como fazer ct-e de substituição passo a passo', 'posso cancelar um ct-e de substituição'],
            mentor: 'Quando devo usar o CT-e de substituição e o que preciso saber sobre o prazo?',
        },
        {
            id: 'cte-inutilizacao', doc: 'CT-e', titulo: 'Inutilização de numeração do CT-e',
            regra: 'Para o CT-e não é mais preciso inutilizar números que ficaram sem uso: o serviço de inutilização foi desativado em 2023.',
            detalhe: [
                'A mudança veio do Ajuste SINIEF 31/2022 e da Nota Técnica 2023.001.',
                'Isso vale para o CT-e. Para outros documentos (como a NF-e) a regra pode ser diferente: confirme com o contador.',
            ],
            seNaoCumprir: 'Nada a fazer: número pulado no CT-e não precisa mais ser comunicado.',
            varia: 'Fontes divergem sobre o mês exato do fim do serviço (junho de 2023 ou janeiro de 2024); o resultado prático é o mesmo.',
            prazo: 'Não existe mais', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Contmatic — Inutilizar CT-e: ainda é possível?', url: 'https://simplifique.contmatic.com.br/blogs/inutilizar-cte-ainda-e-possivel-o-que-mudou' }],
            onde: ['Transporte > Configurações > Tipos de Talões'], buscas: ['inutilizar numeração ct-e'],
            mentor: 'Preciso inutilizar números de CT-e que ficaram sem uso?',
        },
        {
            id: 'cte-guarda', doc: 'Geral', titulo: 'Guarda dos XML',
            regra: 'O que vale é o arquivo XML autorizado, não o PDF. Guarde sempre os XML de CT-e, MDF-e e NF-e.',
            detalhe: [
                'O prazo mínimo comum para o contribuinte é de 5 anos (prescrição tributária).',
                'O Ajuste SINIEF 2/2025 fixou 132 meses (11 anos) a partir de 01/05/2025 para a guarda dos documentos fiscais eletrônicos; as fontes divergem se isso obriga o contribuinte ou só o Fisco.',
                'Recomendação prática: guarde por 11 anos e mantenha cópia fora do computador do dia a dia.',
            ],
            seNaoCumprir: 'Sem o XML não dá para provar o documento, complementar ou responder ao Fisco.',
            varia: 'Alguns estados regulamentaram o prazo. Confirme com o contador.',
            prazo: '5 anos (mínimo comum) · 11 anos (recomendado)', nivel: 'orientativo', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'Machado Meyer — Novo prazo de guarda de documentos fiscais', url: 'https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/tributario-ij/novo-prazo-de-guarda-de-documentos-fiscais-esta-em-vigor' },
                { titulo: 'Contábeis — Guarda de documentos fiscais por 11 anos', url: 'https://www.contabeis.com.br/artigos/70492/novo-ajuste-sinief-exige-guarda-de-documentos-fiscais-por-11-anos/' },
            ],
            onde: ['eDoc > Repositório CT-e', 'eDoc > Download de arquivos XML'], buscas: ['download de arquivos xml', 'precisava dos xml de ct-e cancelados'],
            mentor: 'Por quanto tempo preciso guardar os XML dos documentos fiscais?',
        },

        /* ═════════ MDF-e ═════════ */
        {
            id: 'mdfe-emitir-antes', doc: 'MDF-e', titulo: 'Emitir antes de começar a viagem',
            regra: 'O MDF-e é emitido ao fim do carregamento e antes de a viagem começar, com os documentos da carga que estão no veículo.',
            detalhe: [
                'É o documento que a fiscalização consulta na estrada: a viagem não deve sair sem ele autorizado.',
                'Pode ser criado junto com o CT-e (opção Criar Manifesto) ou à parte, na tela de Manifesto de Carga.',
            ],
            seNaoCumprir: 'Viagem sem MDF-e autorizado fica irregular perante a fiscalização.',
            varia: 'Quais viagens exigem o MDF-e e as exceções variam conforme a carga, as UFs e a legislação estadual. Confirme com o contador.',
            prazo: 'Antes de iniciar a viagem', nivel: 'orientativo', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Blog Bsoft — Tudo sobre MDF-e', url: 'https://bsoft.com.br/blog/saiba-tudo-sobre-mdfe' }],
            onde: ['Transporte > Manifesto de Carga'], buscas: ['como emitir um mdf-e manualmente', 'como emitir um mdf-e juntamente com a emissão do ct-e'],
            mentor: 'Quando o MDF-e precisa ser emitido e o que ele tem que conter?',
        },
        {
            id: 'mdfe-cancelar', doc: 'MDF-e', titulo: 'Cancelar um MDF-e',
            regra: 'O MDF-e pode ser cancelado em até 24 horas contadas da autorização, e só se a viagem ainda não começou.',
            detalhe: [
                'A contagem parte do momento exato da autorização pela SEFAZ.',
                'Depois do prazo, em geral não dá mais para cancelar: a saída é encerrar o MDF-e e emitir outro.',
            ],
            seNaoCumprir: 'Alguns estados aceitam o cancelamento extemporâneo, outros não (São Paulo, por exemplo, não aceita para MDF-e). Peça ao contador que consulte a SEFAZ do estado.',
            varia: 'O pedido fora do prazo depende do estado.',
            prazo: '24 horas após a autorização', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'TecnoSpeed — MDF-e: cancelamento ou encerramento', url: 'https://blog.tecnospeed.com.br/mdf-e-cancelamento-ou-encerramento/' },
                { titulo: 'TecnoSpeed — Cancelamento extemporâneo', url: 'https://blog.tecnospeed.com.br/?p=19866' },
            ],
            onde: ['Transporte > Documentos > MDF-e', 'Transporte > Manifesto de Carga'], buscas: ['como cancelar na sefaz um mdf-e', 'mdf-e em circulação não sendo possível cancelamento'],
            mentor: 'Emiti um MDF-e errado. Até quando posso cancelar e o que faço depois do prazo?',
        },
        {
            id: 'mdfe-encerrar', doc: 'MDF-e', titulo: 'Encerrar o MDF-e',
            regra: 'O MDF-e precisa ser encerrado quando a viagem termina. Se ficar mais de 30 dias aberto, a SEFAZ passa a recusar novos MDF-e do mesmo CNPJ.',
            detalhe: [
                'O encerramento deve ser registrado após o fim do percurso e também em situações como transbordo, redespacho, subcontratação, troca do veículo ou do contêiner, retenção parcial da carga e inclusão de novas mercadorias para a mesma UF de descarregamento.',
                'MDF-e não encerrado há mais de 30 dias gera a rejeição 686 em novas emissões do emitente, até os pendentes serem encerrados.',
                'Encerramento "fora do prazo" continua possível: é justamente o que desbloqueia a emissão.',
            ],
            seNaoCumprir: 'Novas emissões bloqueadas e, segundo algumas fontes, risco de penalidade. Encerre os pendentes (também os emitidos em outro sistema).',
            varia: 'Multas e procedimentos de encerramento extemporâneo variam por estado.',
            prazo: 'Ao fim da viagem · limite de 30 dias da emissão antes do bloqueio', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'Fórum SPED Brasil — Ajuste SINIEF 17/2020 (encerramento)', url: 'https://portalspedbrasil.com.br/forum/mdf-e-do-encerramento-situacoes-7/' },
                { titulo: 'Webmania — Rejeição 686: MDF-e não encerrado há mais de 30 dias', url: 'https://ajuda.webmania.com.br/pt-BR/articles/12680477-rejeicao-686-existe-mdf-e-nao-encerrado-ha-mais-de-30-dias-para-o-emitente' },
                { titulo: 'TecnoSpeed — MDF-e: cancelamento ou encerramento', url: 'https://blog.tecnospeed.com.br/mdf-e-cancelamento-ou-encerramento/' },
            ],
            onde: ['Transporte > Manifesto de Carga', 'Transporte > Encerrar Manifestos não cadastrados'], buscas: ['como encerrar mdf-e que emiti em outro sistema', 'preciso encerrar mdfe em homologação'],
            mentor: 'Quando preciso encerrar o MDF-e e o que acontece se eu esquecer de encerrar?',
        },

        /* ═════════ CIOT e ANTT ═════════ */
        {
            id: 'ciot-antes', doc: 'CIOT e ANTT', titulo: 'Gerar o CIOT antes da viagem',
            regra: 'O CIOT precisa existir antes de a viagem começar. Não dá para gerá-lo depois.',
            detalhe: [
                'No Bsoft o CIOT sai do contrato de frete: emita o contrato vinculando os CT-e ou o MDF-e e gere o CIOT pelo ícone do contrato.',
                'O CIOT fica vinculado ao MDF-e da operação.',
            ],
            seNaoCumprir: 'Viagem sem CIOT, quando ele é exigido, expõe a empresa a multa e bloqueio da operação.',
            varia: 'Cancelar um CIOT já gerado tem regras próprias da ANTT e da operadora.',
            prazo: 'Antes de iniciar a viagem', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'Senior — Nova regra de CIOT', url: 'https://www.senior.com.br/blog/regra-ciot' },
                { titulo: 'TecnoSpeed — Exigência do CIOT no MDF-e', url: 'https://blog.tecnospeed.com.br/nota-tecnica-2026-001-exigencia-do-ciot-no-mdfe/' },
            ],
            onde: ['Transporte > Contrato de Frete'], buscas: ['como gerar ciot', 'como emitir um contrato de frete', 'como cancelar ciot gerado pelo sistema'],
            mentor: 'Quando devo gerar o CIOT e como faço no Bsoft?',
        },
        {
            id: 'ciot-2026', doc: 'CIOT e ANTT', titulo: 'CIOT em 2026: obrigatório para toda operação',
            regra: 'Desde 24/05/2026 o CIOT passou a ser exigido em toda operação de transporte rodoviário de cargas, não só na contratação de autônomos (TAC). Ele fica ligado ao MDF-e.',
            detalhe: [
                'Antes disso o CIOT era exigido na contratação de transportador autônomo (TAC), de TAC equiparado (empresa com até três veículos) e de cooperativas de transporte.',
                'A base do Suporte Bsoft resume a Medida Provisória nº 1.343/2026; o mercado também cita a Resolução ANTT 6.078/2026. As fontes divergem em números e datas: confirme o enquadramento da operação.',
                'A SEFAZ está passando a exigir o grupo CIOT no MDF-e (Nota Técnica 2026.001, com entrada em produção prevista para 23/11/2026 segundo fornecedores).',
            ],
            seNaoCumprir: 'A base do Suporte aponta multas pesadas, bloqueio da operação e suspensão do RNTRC para quem descumprir.',
            varia: 'É regra recente e ainda em adaptação: datas, valores e exceções podem mudar.',
            prazo: 'Vale desde 24/05/2026', nivel: 'orientativo', conferidoEm: '2026-11-16',
            fontes: [
                { titulo: 'Inventti — Resolução ANTT 6.078/2026: obrigatoriedade ampliada', url: 'https://inventti.com.br/resolucao-antt-no-6-078-2026-obrigatoriedade-do-ciot-e-ampliada-e-exige-rapida-adaptacao-das-transportadoras/' },
                { titulo: 'TecnoSpeed — Nota Técnica 2026.001 (CIOT no MDF-e)', url: 'https://blog.tecnospeed.com.br/nota-tecnica-2026-001-exigencia-do-ciot-no-mdfe/' },
            ],
            onde: ['Transporte > Contrato de Frete', 'Transporte > Configurações > Configuração CIOT Automático'], buscas: ['o que é ciot e informações sobre ciot', 'medida provisória 1.343/2026 ciot'],
            mentor: 'O que mudou no CIOT em 2026 e minha empresa precisa emitir mesmo com frota própria?',
        },
        {
            id: 'ciot-piso', doc: 'CIOT e ANTT', titulo: 'Piso mínimo de frete (ANTT)',
            regra: 'A política de pisos mínimos de frete da ANTT impede contratar frete abaixo do valor mínimo; a operação pode ser bloqueada no CIOT.',
            detalhe: [
                'No Bsoft existe a calculadora de frete mínimo na emissão do CT-e (depende de um parâmetro e de informar o km no CT-e).',
                'No contrato de frete há a seção de informações para o cálculo do frete mínimo (origem, destino, tabela, tipo de carga, km, eixos).',
            ],
            seNaoCumprir: 'Frete abaixo do piso pode ter o CIOT bloqueado e gerar multa.',
            varia: 'A tabela da ANTT é atualizada periodicamente.',
            prazo: 'Tabela atualizada periodicamente', nivel: 'orientativo', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Mundo Logística — Piso mínimo e novas regras do CIOT', url: 'https://mundologistica.com.br/noticias/piso-minimo-frete-novas-regras-antt-ciot-maio-2026' }],
            onde: ['Transporte > Contrato de Frete'], buscas: ['calculo da tabela de frete mínimo na emissão do cte', 'frete mínimo antt'],
            mentor: 'Como o piso mínimo de frete da ANTT afeta a minha emissão e onde vejo o cálculo no Bsoft?',
        },
        {
            id: 'vpo', doc: 'CIOT e ANTT', titulo: 'Vale-pedágio obrigatório (VPO)',
            regra: 'O vale-pedágio é obrigatório (Lei 10.209/2001, regulamentada pela ANTT) e, no Bsoft, é gerado a partir do contrato de frete, por meio da operadora configurada.',
            detalhe: ['É preciso configurar antes o módulo de VPO em Contratos com Operadoras de Crédito.'],
            seNaoCumprir: 'Sem VPO, o contrato de frete pode ser recusado e a operação, travada.',
            varia: 'Quem paga e como é informado depende do tipo de operação: confirme com a operadora e o contador.',
            prazo: 'Antes de iniciar a viagem', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Resposta aprovada do Suporte Bsoft — Como gerar VPO no sistema', url: '' }],
            onde: ['Transporte > Configurações > Contratos com Operadoras de Crédito', 'Transporte > Contrato de Frete'], buscas: ['como gerar vpo vale pedágio obrigatório no sistema', 'como configura o módulo vale pedágio vpo no sistema'],
            mentor: 'Como gero o vale-pedágio obrigatório e o que preciso configurar antes?',
        },

        /* ═════════ GERAL ═════════ */
        {
            id: 'geral-homologacao', doc: 'Geral', titulo: 'Homologação não vale: é só treino',
            regra: 'Documento emitido em Homologação não tem validade fiscal. Serve para testar. Só vale o que for emitido em Produção.',
            detalhe: ['No Bsoft o ambiente é escolhido no talão. A virada para Produção exige a autorização do gerente de recursos.', 'O mesmo número e série podem existir em Homologação e em Produção.'],
            seNaoCumprir: 'Transportar com documento de Homologação equivale a transportar sem documento.',
            varia: '', prazo: '', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Base de conhecimento do Suporte Bsoft', url: '' }],
            onde: ['Transporte > Configurações > Tipos de Talões'], buscas: ['como fazer a virada de produção de um talão de ct-e', 'preciso encerrar mdfe em homologação'],
            mentor: 'Qual a diferença entre homologação e produção e como faço a virada?',
        },
        {
            id: 'geral-rejeicao', doc: 'Geral', titulo: 'Rejeição não é emissão',
            regra: 'Quando a SEFAZ rejeita, o documento NÃO foi emitido. Leia o código e a mensagem, corrija o que ela pede e transmita de novo.',
            detalhe: ['Denegação é diferente: o uso do documento foi bloqueado por irregularidade e não se resolve reenviando.', 'Rejeição 539 = duplicidade: o número e a série já foram usados.'],
            seNaoCumprir: '', varia: '', prazo: '', nivel: 'conferido', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Base de conhecimento do Suporte Bsoft', url: '' }],
            onde: [], buscas: ['rejeição sefaz erro ao transmitir', 'erro ou rejeição sefaz 539 duplicidade'],
            mentor: 'Recebi uma rejeição da SEFAZ. Como descubro o que significa e como resolvo?',
        },
        {
            id: 'geral-contingencia', doc: 'Geral', titulo: 'SEFAZ fora do ar: contingência',
            regra: 'Se a SEFAZ estiver fora do ar, o sistema consegue enviar o CT-e por um servidor de contingência.',
            detalhe: ['Segundo o Suporte, no Bsoft não é preciso fazer nenhum procedimento depois: o envio é normal mesmo saindo pelo servidor de contingência.', 'A empresa tem a opção de CT-e em contingência no cadastro.'],
            seNaoCumprir: '', varia: 'Prazos e regras de regularização em contingência variam: confirme com o contador.', prazo: '', nivel: 'orientativo', conferidoEm: '2026-11-16',
            fontes: [{ titulo: 'Base de conhecimento do Suporte Bsoft', url: '' }],
            onde: ['eDoc > Contingência', 'eDoc > Consulta de serviços'], buscas: ['envio de cte pelo servidor de contingência'],
            mentor: 'O que faço se a SEFAZ estiver fora do ar na hora de emitir?',
        },
    ],

    /* ═════════ calculadora ═════════
       desde: 'autorizacao' | 'emissao'.  Uma das medidas: horas, dias ou anos.  porUF: { UF: horas } troca o prazo para esse estado.
       tipo: 'limite' (padrão) | 'bloqueio' (data a partir da qual vem o bloqueio) | 'guarda' (guardar até). */
    calculadora: [
        { id: 'cte-cancelar', doc: 'CT-e', rotulo: 'Cancelar o CT-e', regra: 'cte-cancelar', desde: 'autorizacao', horas: 168, porUF: { MT: 8 }, tipo: 'limite',
          nota: 'Vale se o transporte não começou e não há MDF-e encerrado ligado ao CT-e. Fora do prazo: complementar, substituir ou cancelamento extemporâneo pelo contador.' },
        { id: 'mdfe-cancelar', doc: 'MDF-e', rotulo: 'Cancelar o MDF-e', regra: 'mdfe-cancelar', desde: 'autorizacao', horas: 24, tipo: 'limite',
          nota: 'Só antes de a viagem começar. Depois do prazo, encerre e emita outro.' },
        { id: 'mdfe-bloqueio', doc: 'MDF-e', rotulo: 'Encerrar o MDF-e antes do bloqueio de novas emissões', regra: 'mdfe-encerrar', desde: 'emissao', dias: 30, tipo: 'bloqueio',
          nota: 'Encerre assim que a viagem terminar. Esta é só a data a partir da qual a SEFAZ pode recusar novos MDF-e do mesmo CNPJ (rejeição 686).' },
        { id: 'xml-min', doc: 'Geral', rotulo: 'Guardar o XML — mínimo comum', regra: 'cte-guarda', desde: 'emissao', anos: 5, tipo: 'guarda', nota: 'Prazo de prescrição tributária. Veja a regra completa.' },
        { id: 'xml-rec', doc: 'Geral', rotulo: 'Guardar o XML — recomendado', regra: 'cte-guarda', desde: 'emissao', anos: 11, tipo: 'guarda', nota: '132 meses (Ajuste SINIEF 2/2025). Mais seguro guardar por esse tempo.' },
    ],
};
