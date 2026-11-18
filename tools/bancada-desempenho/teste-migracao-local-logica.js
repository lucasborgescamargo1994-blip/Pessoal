'use strict';
/* teste-migracao-local-logica.js — testa SEM navegador e SEM modelo de IA o núcleo da Primeira emissão guiada com IA LOCAL (js/migracao-local/rag.js):
   o trecho do artigo que mais combina com a pergunta, o prompt CURTO (fixo no sistema, estável, sem dados pessoais), as respostas que NÃO passam pelo modelo (prazo/obrigação = a regra conferida;
   "o que é…?" = o glossário; configuração = "é com o Suporte"; erro com código que nenhum artigo tem = triagem; pergunta que não acha nada = "não encontrei"), a reordenação por código de rejeição,
   o orçamento de texto conforme a velocidade do computador, e as TRAVAS na resposta do modelo (outra língua, recusa, links, "[Nome]", número/prazo fora do material, "edite o talão" sem mandar ao Suporte).
   A parte final lê o banco REAL (somente leitura): as 14 perguntas de teste (os 9 cenários do chat + variações) caem no caminho certo e TODO artigo, perguntado pelo próprio título, traz a si mesmo no material.
   Rode:  $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-migracao-local-logica.js | Out-String
   Sem internet use  --offline  (a parte do banco real é pulada). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.resolve(__dirname, '..', '..');
const ler = rel => fs.readFileSync(path.join(raiz, rel), 'utf8');
const offline = process.argv.includes('--offline');

const ctx = { console: { log() {}, warn() {}, info() {}, error() {} } }; ctx.window = ctx; vm.createContext(ctx);
['config/menu-bsoft.js', 'js/app/menu-bsoft.js', 'js/app/prerequisitos.js', 'config/migracao-roteiro.js', 'config/migracao-regras.js', 'config/migracao-glossario.js'].forEach(f => vm.runInContext(ler(f), ctx, { filename: f }));
const M = vm.runInContext(ler('js/migracao/logica.js') + '\n;MigLogica', ctx, { filename: 'js/migracao/logica.js' });
const Rag = vm.runInContext(ler('js/migracao-local/rag.js') + '\n;MigLocalRag', ctx, { filename: 'js/migracao-local/rag.js' });
const R = ctx.BSOFT_MIG_ROTEIRO, G = ctx.BSOFT_MIG_REGRAS, GL = ctx.BSOFT_MIG_GLOSSARIO;

let ok = 0; const falhas = [], avisos = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 300) : '')); };
const eq = (nome, a, b) => t(nome, JSON.stringify(a) === JSON.stringify(b), 'veio ' + JSON.stringify(a) + ' · esperado ' + JSON.stringify(b));
const passoDe = id => R.passos.find(p => p.id === id) || null;
const NUMS = { cteSerie: '1', cteNumero: '1500', mdfeSerie: '1', mdfeNumero: '320' };
const PERFIL = { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: NUMS };

(async () => {
    // ═════════ o trecho que mais combina com a pergunta ═════════
    const art = 'Para emitir o CT-e acesse o menu Transporte.\nInforme o remetente e o destinatário da carga.\nSelecione a natureza da operação.\nPara cancelar um CT-e com erro, acesse Transporte > Conhecimentos e clique em Cancelar.\nInforme o motivo do cancelamento com no mínimo 15 caracteres.\nDepois transmita o evento para a SEFAZ.\nPara imprimir o DACTE use o botão Imprimir.';
    const q = M.tokens('Como cancelar o CT-e com erro?');
    const tr = Rag.melhorTrecho(art, q, 200);
    t('trecho: pega as linhas que falam do que foi perguntado (cancelar), não o começo do artigo', /cancelar/i.test(tr) && !/^Para emitir/.test(tr), tr);
    t('trecho: respeita o tamanho máximo (com as reticências)', tr.replace(/\[…\]/g, '').length <= 215, tr.length);
    t('trecho: marca com […] o que foi cortado antes e depois', /^\[…\]/.test(tr) && /\[…\]$/.test(tr), tr);
    t('trecho: pergunta que não casa com nada → o começo do artigo', /^Para emitir o CT-e/.test(Rag.melhorTrecho(art, M.tokens('xyzabc qwerty'), 120)));
    t('trecho: texto vazio → vazio', Rag.melhorTrecho('', q, 100) === '' && Rag.melhorTrecho(null, q, 100) === '');
    // um manual cuja resposta (outras palavras) está no começo e que termina numa lista cheia de "CT-e" e de uma linha com "Emitir"
    const manual = 'Acesse a tela Conhecimentos no menu e clique em adicionar.\nPreencha os dados básicos e clique em salvar.\n' + Array.from({ length: 12 }, (_, i) => '- Cancelar CT-e na SEFAZ opção ' + i).join('\n') + '\n- Emitir GNRE';
    const qEmitir = M.tokens('Como emito um CT-e?');
    t('trecho: sem ajuda do título, uma lista cheia de “CT-e” no fim do manual NÃO ganha do começo quando o começo é quase tão bom', /^Acesse a tela Conhecimentos/.test(Rag.melhorTrecho(manual, qEmitir, 160, { inicio: true })));
    t('trecho: com o título igual à pergunta (opção inicio) o começo do artigo vence sempre', /^Acesse a tela Conhecimentos/.test(Rag.melhorTrecho(manual, qEmitir, 160, { inicio: true })) && !/Emitir GNRE/.test(Rag.melhorTrecho(manual, qEmitir, 160, { inicio: true })));
    t('trecho: um parágrafo só, sem quebra de linha, é cortado em frases', Rag.unidades('Primeira frase aqui. Segunda frase aqui? ' + 'Terceira frase bem longa '.repeat(12) + 'fim. Quarta.').length >= 3);

    // ═════════ a pergunta ═════════
    const ped = M.montarPedidoErro({ doc: 'CT-e', mensagem: 'Rejeição 539: Duplicidade de CT-e', fazia: 'transmitindo' });
    eq('pergunta (modo erro): a busca usa só a MENSAGEM, não o pedido formatado', Rag.textoDaPergunta(ped, true), 'Rejeição 539: Duplicidade de CT-e');
    eq('pergunta (modo normal): fica como veio', Rag.textoDaPergunta('Como emito?', false), 'Como emito?');
    eq('códigos: 3 a 4 dígitos, sem repetir, sem ano', Rag.codigosDe('Rejeição 539 e 539, de 2026, também 1500 e 12'), ['539', '1500']);

    // ═════════ prazo/obrigação × passo a passo ═════════
    const regraSim = ['Emiti um CT-e ontem. Ainda consigo cancelar? Qual é o prazo?', 'Até quando posso cancelar o MDF-e?', 'Quanto tempo tenho para encerrar o manifesto?', 'Minha frota é própria. Preciso de CIOT?', 'Posso fazer carta de correção para mudar o valor do frete?', 'É obrigatório emitir o MDF-e?', 'Tem multa se eu não encerrar o MDF-e?', 'Ainda dá para corrigir o CT-e?'];
    const regraNao = ['Como emito um CT-e?', 'Como posso emitir um CT-e?', 'Preciso emitir um CT-e, como faço?', 'Como encerro o MDF-e?', 'Onde cadastro o motorista?', 'O que é CT-e?', 'Como confiro se a numeração continua?'];
    t('intenção de regra: perguntas de prazo/obrigação/“posso cancelar?” são reconhecidas', regraSim.every(p => Rag.temIntencaoDeRegra(p)), regraSim.filter(p => !Rag.temIntencaoDeRegra(p)).join(' | '));
    t('intenção de regra: “como faço…?”, “onde…”, “o que é…” NÃO (mesmo com “posso” ou “preciso” no meio)', regraNao.every(p => !Rag.temIntencaoDeRegra(p)), regraNao.filter(p => Rag.temIntencaoDeRegra(p)).join(' | '));
    const r1 = G.regras.find(r => r.id === 'cte-cancelar') || G.regras[0];
    const rt = Rag.regraTexto(r1);
    t('regra: o texto traz o título, a regra e o aviso de que é para confirmar com o contador, fiel ao arquivo de regras', rt.includes(r1.titulo) && rt.includes(r1.regra) && /Confirme com o seu contador/.test(rt) && !/undefined|null/.test(rt) && /conferida em \d\d\/\d\d\/\d{4}/.test(rt), rt.slice(0, 200));
    t('regra: prazo e “se não cumprir” aparecem quando a regra os tem', (!r1.prazo || rt.includes('**Prazo:** ' + r1.prazo)) && (!r1.seNaoCumprir || rt.includes(r1.seNaoCumprir)));
    t('regra “orientativa” é dita como orientativa', G.regras.some(r => r.nivel !== 'conferido') ? G.regras.filter(r => r.nivel !== 'conferido').every(r => /Regra orientativa/.test(Rag.regraTexto(r))) : true);

    // ═════════ "o que é…?" → glossário ═════════
    const defSim = ['O que é CT-e?', 'O que é CT-e e MDF-e? Qual a diferença?', 'qual a diferença entre cte e mdfe', 'Me explica o que é DACTE', 'O que significa averbação?', 'Oi, o que é CIOT?'];
    const defNao = ['Como emito um CT-e?', 'Deu rejeição 539. O que significa?', 'O que significa a rejeição 539 do MDF-e?', 'Preciso de CIOT?'];
    t('definição: “o que é…/qual a diferença…” é reconhecida', defSim.every(p => Rag.ehDefinicao(p)), defSim.filter(p => !Rag.ehDefinicao(p)).join(' | '));
    t('definição: pergunta com código de rejeição, ou que não é de definição, NÃO', defNao.every(p => !Rag.ehDefinicao(p)), defNao.filter(p => Rag.ehDefinicao(p)).join(' | '));
    const ixTermo = { termo: M.criarIndice(GL.termos.map(M.docDeTermo)) };
    eq('glossário: “CT-e e MDF-e” acha os DOIS termos (cada um separado)', Rag.termosDaPergunta(ixTermo, 'O que é CT-e e MDF-e? Qual a diferença?').map(a => a.doc.termo.termo), ['CT-e', 'MDF-e']);
    eq('glossário: um termo só', Rag.termosDaPergunta(ixTermo, 'O que é CIOT?').map(a => a.doc.termo.termo), ['CIOT']);
    t('glossário: termo que não existe → nada (cai nos artigos)', Rag.termosDaPergunta(ixTermo, 'O que é aquele negócio xyz?').length === 0);
    const tx = Rag.termoTexto(GL.termos.find(x => x.termo === 'CT-e'));
    t('glossário: o texto traz o nome, a sigla, a explicação, o exemplo e onde fica no Bsoft', /📖 \*\*CT-e\*\* \(Conhecimento de Transporte Eletrônico\)/.test(tx) && /_Exemplo:_/.test(tx) && /No Bsoft:/.test(tx) && !/undefined/.test(tx), tx.slice(0, 160));

    // ═════════ configuração → é com o Suporte ═════════
    const cfgSim = ['O sistema pediu o certificado digital. Como instalo? A empresa só tem um token.', 'Como instalo o certificado digital?', 'Como altero o talão do CT-e?', 'Preciso mudar a numeração inicial', 'Como cadastro uma regra de cálculo?', 'Quero configurar a tabela de preços', 'Onde importo o certificado?'];
    const cfgNao = ['Como emito um CT-e?', 'Já instalei o certificado. Como emito o CT-e?', 'Como confiro se o talão está certo?', 'Como confiro a numeração?', 'Deu rejeição 539, o que fazer?', 'O que é certificado digital?'];
    t('configuração: instalar/mudar certificado, talão, numeração inicial, regras e tabelas é reconhecido', cfgSim.every(p => Rag.ehConfiguracao(p)), cfgSim.filter(p => !Rag.ehConfiguracao(p)).join(' | '));
    t('configuração: emitir, conferir, “já instalei…”, rejeição e “o que é…” NÃO', cfgNao.every(p => !Rag.ehConfiguracao(p)), cfgNao.filter(p => Rag.ehConfiguracao(p)).join(' | '));
    t('configuração: a resposta manda ao Suporte (' + Rag.SUPORTE + ') e diz o que levar', Rag.CONFIG_RESPOSTA.includes(Rag.SUPORTE) && /mensagem exata/.test(Rag.CONFIG_RESPOSTA) && /print/.test(Rag.CONFIG_RESPOSTA) && !/\b(passo a passo|clique)\b/i.test(Rag.CONFIG_RESPOSTA));

    // ═════════ orçamento e o prompt ═════════
    eq('orçamento: PC lento (< 10 tokens/s) = 1 trecho de 480', [Rag.orcamento(3).docs, Rag.orcamento(3).chars, Rag.orcamento(0).docs, Rag.orcamento(undefined).chars], [1, 480, 1, 480]);
    eq('orçamento: médio (10–40) = 2 trechos; rápido (≥ 40) = 3', [Rag.orcamento(20).docs, Rag.orcamento(100).docs], [2, 3]);
    // base pequena e controlada
    const docs = [
        { id: 1, titulo: 'Como emitir um CT-e', conteudo: 'Acesse Transporte > Conhecimentos e clique em Novo. Informe o remetente, o destinatário e o valor do frete. Clique em Transmitir. ' + 'Texto de enchimento sobre campos. '.repeat(30), categoria: 'Ct-e', caminho_menu: 'Transporte > Conhecimentos' },
        { id: 2, titulo: 'Erro ou Rejeição SEFAZ 539: Duplicidade de CT-e', conteudo: 'A rejeição 539 significa que o número do CT-e já foi usado. Confira a numeração do talão. Peça ao Suporte para ajustar a numeração inicial.', categoria: 'Fiscal' },
        { id: 3, titulo: 'Como cadastrar um motorista', conteudo: 'Acesse Cadastros > Pessoas, clique em Novo e marque a opção Motorista. Informe CNH e validade.', categoria: 'Cadastros' },
        { id: 4, titulo: 'Manual do módulo de conhecimentos', conteudo: 'Introdução ao módulo de conhecimentos.\n' + Array.from({ length: 14 }, (_, i) => 'Linha ' + (i + 1) + ' de texto de enchimento do manual do módulo.').join('\n') + '\nPara estornar um conhecimento errado acesse Transporte > Conhecimentos e clique em Estornar.\nGuarde o protocolo do estorno.\n' + Array.from({ length: 6 }, (_, i) => 'Fim ' + (i + 1) + ' de mais enchimento.').join('\n'), categoria: 'Ct-e' },
    ];
    const ixMini = { banco: M.criarIndice(docs.map(M.docDeBanco)), rapida: M.criarIndice([]), faq: M.criarIndice([]), regra: M.criarIndice(G.regras.map(M.docDeRegra)), termo: ixTermo.termo };
    const montar = (pergunta, o, opc) => Rag.montar(Object.assign({ pergunta, historico: [], perfil: PERFIL, roteiro: R, passoAtual: passoDe('cte'), regras: [], modo: '' }, o || {}), Object.assign({ ix: ixMini, lerTps: 3 }, opc || {}));
    const m1 = montar('Como emito um CT-e? Cliente 12.345.678/0001-90'), m2 = montar('Como cadastro um motorista?');
    eq('prompt: duas mensagens (sistema fixo + pedido)', m1.map(x => x.role), ['system', 'user']);
    t('prompt: o sistema é FIXO (igual em qualquer pergunta: o servidor lê uma vez e reaproveita) e o do aquecimento é o mesmo', m1[0].content === m2[0].content && m1[0].content === Rag.SISTEMA && Rag.mensagensAquecimento()[0].content === Rag.SISTEMA);
    t('prompt: o sistema pede “só o TEXTO”, “NO MÁXIMO 2 frases” e “não acrescente nada” (o que fez o Llama 1B copiar em vez de inventar passos)', /usando só o TEXTO/.test(Rag.SISTEMA) && /NO MÁXIMO 2 frases/.test(Rag.SISTEMA) && /Não acrescente nada/.test(Rag.SISTEMA), Rag.SISTEMA);
    t('prompt: o sistema NÃO manda “dizer que não consta” (com isso o modelo pequeno respondia “Não consta.” a TUDO) nem pede lista/passo a passo (ele inventava passos)', !/n[aã]o consta/i.test(Rag.SISTEMA) && !/passo a passo|lista numerada/i.test(Rag.SISTEMA) && Rag.SISTEMA.length < 400, Rag.SISTEMA.length);
    t('prompt: leva o passo, o material e a pergunta (e termina pedindo a resposta curta)', /^Passo do cliente: /.test(m1[1].content) && /TEXTO:\n1\) Como emitir um CT-e/.test(m1[1].content) && /\n\nPergunta: Como emito/.test(m1[1].content) && /Resposta em até 2 frases:$/.test(m1[1].content), m1[1].content.slice(0, 400));
    t('prompt: sem “menu do passo” e sem o perfil genérico (cada 100 caracteres custam segundos de leitura no PC comum)', !/MENU DESTE PASSO|vem de outro sistema|Dados do cliente/.test(m1[1].content));
    t('prompt: dados pessoais saem (CNPJ vira “[CNPJ omitido]”)', !/12\.345\.678/.test(m1.map(x => x.content).join('\n')) && /CNPJ omitido/.test(m1[1].content));
    t('prompt: o material é um TRECHO (não o artigo inteiro, que tem 1.000+ caracteres de enchimento)', m1.local.material[0].trecho.length <= 520 && m1[1].content.length < 1300, m1[1].content.length);
    // (material de verdade: o artigo cujo TÍTULO é a pergunta entra pelo COMEÇO, mesmo que o fim dele repita mais as palavras da pergunta)
    const ixLista = { banco: M.criarIndice([{ id: 9, titulo: 'Como emitir o conhecimento de transporte', conteudo: manual, categoria: 'Ct-e' }].map(M.docDeBanco)), rapida: M.criarIndice([]), faq: M.criarIndice([]), regra: ixMini.regra, termo: ixMini.termo };
    const mLista = Rag.montar({ pergunta: 'Como emitir o conhecimento de transporte?', historico: [], perfil: PERFIL, roteiro: R, passoAtual: passoDe('cte'), regras: [], modo: '' }, { ix: ixLista, lerTps: 3 });
    t('material: artigo com o título da pergunta entra pelo começo (não pela lista do fim)', mLista.local.material[0] && /^Acesse a tela Conhecimentos/.test(mLista.local.material[0].trecho), mLista.local.material[0] && mLista.local.material[0].trecho.slice(0, 120));
    const mEst = montar('Como estorno um conhecimento errado?');
    t('material: o trecho escolhido é o que fala do que foi perguntado (estornar, que está no meio do manual), não o começo do artigo', mEst.local.material[0] && mEst.local.material[0].titulo === 'Manual do módulo de conhecimentos' && /Estornar/.test(mEst.local.material[0].trecho) && !/^Introdução/.test(mEst.local.material[0].trecho), JSON.stringify(mEst.local.material[0] || null).slice(0, 300));
    t('prompt: não carrega o roteiro inteiro, o glossário nem os parâmetros do prompt do MCP', !/ROTEIRO|GLOSSÁRIO|PARÂMETROS|VÍDEOS TUTORIAIS|REGRAS E PRAZOS/.test(m1[1].content));
    const nume = montar('Como confiro se a numeração continua?', { passoAtual: passoDe('numeracao') });
    t('perfil: a numeração que o cliente informou entra no passo da numeração (o próximo número já calculado)…', /último CT-e 1500 \(série 1\) → o próximo no Bsoft deve ser 1501/.test(nume[1].content) && /último MDF-e 320.*321/.test(nume[1].content), nume[1].content.slice(0, 300));
    t('…mas não polui as outras perguntas', !/último CT-e/.test(m1[1].content) && !/seguro/.test(m1[1].content));
    t('perfil: curto (menos de 220 caracteres)', Rag.perfilCurto({ perfil: PERFIL, roteiro: R, passoAtual: passoDe('numeracao'), pergunta: 'numeração' }).length < 220);
    // conversa
    const hist = [{ papel: 'voce', texto: 'Como cancelo o CT-e?' }, { papel: 'ia', texto: 'Acesse Transporte > Conhecimentos e clique em Cancelar.' }];
    t('conversa: pergunta curta (“e depois?”) leva o último par de conversa…', /Conversa anterior: cliente: Como cancelo o CT-e\? \| assistente: Acesse Transporte/.test(montar('e depois?', { historico: hist })[1].content));
    t('…pergunta completa não leva (poupa o que o computador precisa ler)', !/Conversa anterior/.test(montar('Como emito um CT-e com valor de frete?', { historico: hist })[1].content));
    // modo erro
    const pedErro = M.montarPedidoErro({ doc: 'CT-e', mensagem: 'Rejeição 539: Duplicidade de CT-e. O número já foi usado.' });
    const me = montar(pedErro, { modo: 'erro' });
    t('modo erro: o prompt pede as 3 partes (causa, como corrigir, se não resolver) e a busca usou a mensagem', /Causa provável/.test(me[1].content) && /Como corrigir/.test(me[1].content) && /Se não resolver/.test(me[1].content) && /539/.test(me.local.material[0] ? me.local.material[0].titulo : '') && me.local.erro === true, me.local.material.map(x => x.titulo).join(' | '));
    t('modo erro: o artigo com o código 539 vem em 1º', me.local.material[0] && /539/.test(me.local.material[0].titulo));
    // os caminhos que não passam pelo modelo
    const cam = (p, o, opc) => { const l = montar(p, o, opc).local; return l.direta ? l.diretaTipo : l.naoEncontrei ? 'nao-encontrei' : l.confiante ? 'banco-direto' : 'modelo'; };
    eq('caminho: prazo → regra; “o que é” → glossário; certificado → suporte; sem nada → não encontrei; título = pergunta → banco direto; título diferente → modelo', [cam('Ainda consigo cancelar o CT-e? Qual o prazo?'), cam('O que é CT-e e MDF-e?'), cam('Como instalo o certificado digital?'), cam('qual a cor do céu'), cam('Como emito um CT-e?'), cam('Como estorno um conhecimento errado?')], ['regra', 'glossario', 'suporte', 'nao-encontrei', 'banco-direto', 'modelo']);
    eq('caminho: erro com código que nenhum artigo tem → triagem; com código que o artigo traz no título → banco direto (3 partes)', [cam(M.montarPedidoErro({ doc: 'CT-e', mensagem: 'Rejeição 8888: erro xyzabc' }), { modo: 'erro' }), cam(pedErro, { modo: 'erro' })], ['triagem', 'banco-direto']);
    eq('caminho: pergunta de UMA palavra (“não consigo emitir”, “CT-e”) → pede detalhe, sem modelo e sem chutar artigo; com conversa anterior, não (completa pelo histórico)', [cam('não consigo emitir'), cam('CT-e'), montar('e depois?', { historico: hist }).local.direta], ['esclarecer', 'esclarecer', '']);
    t('caminho: o pedido de detalhe diz o que falta (o que quer fazer, em qual documento/tela, mensagem exata)', /o que você quer fazer/.test(Rag.ESCLARECER) && /em qual documento ou tela/.test(Rag.ESCLARECER) && /mensagem exata/.test(Rag.ESCLARECER));
    t('banco direto: o 1º material traz o quanto o título cobre da pergunta (noTitulo) e só ≥ 60% (com ≥ 2 palavras) vira “confiante”', montar('Como emito um CT-e?').local.material[0].noTitulo >= 0.6 && montar('Como estorno um conhecimento errado?').local.material[0].noTitulo < 0.6 && montar('Como emito um CT-e?').local.confiante === true && montar('Como estorno um conhecimento errado?').local.confiante === false);
    t('caminho: a triagem não chuta causa e manda o Suporte com código e mensagem', /não consta/.test(Rag.ERRO_NAO_CONSTA) && /talão e a numeração/.test(Rag.ERRO_NAO_CONSTA) && /Suporte/.test(Rag.ERRO_NAO_CONSTA) && /código e a mensagem exata/.test(Rag.ERRO_NAO_CONSTA));
    t('caminho: “não encontrei” manda reescrever a pergunta e falar com o Suporte', /outras palavras/.test(Rag.NAO_ENCONTREI) && /Suporte/.test(Rag.NAO_ENCONTREI));
    t('caminho: em modo erro a configuração NÃO é desviada (o erro pode citar o certificado; o artigo ajuda a triar)', cam(M.montarPedidoErro({ doc: 'CT-e', mensagem: 'Rejeição 539: Duplicidade. Certificado instalado' }), { modo: 'erro' }) !== 'suporte');
    t('local: a decisão fica em .local (não enumerável: não vai para o modelo)', !('local' in JSON.parse(JSON.stringify(m1))) && Object.keys(m1).join() === '0,1' && m1.local.tipo === 'mentor');
    t('extrativa: o trecho do banco como resposta (título, trecho, onde fica, “veja o artigo inteiro”)', /^\*\*Como emitir um CT-e\*\*/.test(m1.local.extrativa) && /Veja o artigo inteiro — e outros parecidos, se não for isso — em \*\*Baseado em\*\*/.test(m1.local.extrativa) && /📍 Onde fica: Transporte > Conhecimentos/.test(m1.local.extrativa), m1.local.extrativa);
    t('extrativa: sem material → “não encontrei”; com aviso, o aviso aparece em itálico', Rag.extrativa([]) === Rag.NAO_ENCONTREI && /_Teste de aviso_/.test(Rag.extrativa(m1.local.material, 'Teste de aviso')));

    // ═════════ as travas na resposta do modelo ═════════
    const f = (b, meta, fr) => Rag.finalizar(b, meta || m1.local, fr);
    t('trava: resposta boa passa inteira', f('Para emitir o CT-e acesse Transporte > Conhecimentos, clique em Novo e informe o remetente, o destinatário e o valor do frete. Depois clique em Transmitir.') .startsWith('Para emitir o CT-e acesse'));
    t('trava: texto em inglês ou outra escrita → ""', f('You can open the menu and click on the button to issue the document, then wait for the answer please.') === '' && f('我无法回答这个问题，请联系支持人员处理这个问题。') === '');
    t('trava: recusa do modelo → ""', f('Desculpe, mas não posso atender a esse pedido de ajuda com o sistema.') === '' && f('Como um modelo de linguagem, eu não consigo acessar o sistema Bsoft.') === '');
    t('trava: “[Nome]” literal → ""', f('Olá [Nome], para emitir o CT-e acesse o menu Transporte e clique em Novo.') === '');
    t('trava: texto curto demais → ""', f('Sim.') === '' && f('') === '' && f(null) === '');
    t('trava: links saem do texto', !/https?:/.test(f('Veja em https://exemplo.com/ajuda como emitir o CT-e: acesse Transporte > Conhecimentos e clique em Novo.')));
    t('trava: cercas de código e <think> saem', f('```markdown\nAcesse Transporte > Conhecimentos e clique em Novo para emitir o CT-e.\n```').startsWith('Acesse Transporte') && !/think/.test(f('<think>raciocínio</think>Acesse Transporte > Conhecimentos e clique em Novo para emitir o CT-e.')));
    const comPrazo = f('Você tem 15 dias para cancelar o CT-e, depois disso precisa emitir um CT-e de substituição no sistema.');
    t('trava: prazo que NÃO está no material (“15 dias”) vem com o aviso para confirmar', /⚠️ \*\*Atenção:\*\* o número\/prazo \(15 dias\)/.test(comPrazo), comPrazo);
    const meta7 = { permitidos: 'pergunta ate 7 dias para cancelar o ct-e na sefaz' };
    t('trava: prazo que ESTÁ no material passa sem aviso', !/Atenção/.test(f('O prazo para cancelar o CT-e é de até 7 dias, conforme a regra que consultei na base de conhecimento.', meta7)));
    const config = f('Para emitir o CT-e você deve instalar o certificado digital no computador.\nDepois clique em Novo e informe o remetente e o destinatário.');
    t('trava: linha que manda instalar/editar certificado/talão sem citar o Suporte → a linha SAI e entra o aviso “Esta etapa é feita pelo Suporte” (o resto da resposta fica)', config.startsWith(Rag.LINHA_SUPORTE) && !/instalar o certificado/.test(config) && /Depois clique em Novo e informe o remetente/.test(config), config);
    const config1 = f('Para emitir o CT-e você deve instalar o certificado digital no computador. Depois clique em Novo e informe o remetente e o destinatário.');
    t('trava: o modelo escreve parágrafo corrido → só a FRASE de configuração sai (a outra frase da mesma linha fica)', config1 === Rag.LINHA_SUPORTE + ' Depois clique em Novo e informe o remetente e o destinatário.', config1);
    t('trava: se o modelo só escreveu a etapa de configuração (sobra só o aviso, sem dizer do que se trata) → "" (o motor usa o trecho do banco, que leva o título)', f('Para resolver, altere a numeração inicial do talão do documento 1501 para a sequência correta.') === '' && f('Para imprimir o DACTE, você pode acessar o documento em Transporte/Configurações/Tipos de Talões, selecionar o talão do Ct-e, clica em editar e, em seguida, clique em imprimir.') === '');
    t('trava: …mas uma resposta que tem OUTRA coisa além da etapa de configuração continua (com o aviso no lugar da frase)', /^🔒/.test(f('Para resolver, altere a numeração inicial do talão do documento. Depois clique em Novo e transmita o CT-e para a SEFAZ.')) && /transmita o CT-e para a SEFAZ/.test(f('Para resolver, altere a numeração inicial do talão do documento. Depois clique em Novo e transmita o CT-e para a SEFAZ.')));
    t('trava: …e não mexe quando a linha já manda ao Suporte', !/Esta etapa é feita pelo Suporte/.test(f('A numeração inicial do talão é ajustada pelo Suporte: abra o chamado em Opções do Sistema > Suporte e leve o código do erro.')));
    t('trava: várias linhas de configuração → UM aviso só', (f('Altere a numeração inicial do talão.\nAjuste o talão liberado.\nDepois clique em Novo para emitir o CT-e agora.').match(/Esta etapa é feita pelo Suporte/g) || []).length === 1);
    // o modelo pequeno entra em ciclo (medido no Llama 1B, modo erro: a MESMA frase nas 3 partes) → não serve, o motor usa o trecho do banco
    const ciclo = '**Causa provável**: Alterar a numeração inicial para a sequência correta, caso não haja erro específico no número.\n\n**Como corrigir**: Alterar a numeração inicial para a sequência correta, ajustando a sequência do último documento emitido no antigo sistema.\n\n**Se não resolver**: Alterar a numeração inicial para a sequência correta, ajustando a sequência do último documento emitido no antigo sistema.';
    t('trava: a mesma frase repetida nas partes da resposta (ciclo do modelo pequeno) → ""', f(ciclo) === '' && Rag.repeticoes(ciclo).rep >= 2, JSON.stringify(Rag.repeticoes(ciclo)));
    t('trava: 3 partes DIFERENTES não são ciclo', f('**Causa provável**: o número do CT-e já foi autorizado antes.\n\n**Como corrigir**: confira se o último número emitido no sistema antigo foi informado ao Suporte.\n\n**Se não resolver**: leve o código e a mensagem do erro ao Suporte com um print.') !== '');
    t('trava: “Não consta.” / “não há informações” não é resposta (com o material na mão, o trecho do banco é melhor)', f('Não consta.') === '' && f('Não consta no material. Fale com o Suporte para saber mais sobre isso.') === '' && f('Não há informações sobre esse assunto no texto fornecido ao assistente.') === '');
    // o modelo pequeno inventa botão e tela entre aspas
    const mQ = montar('Como cadastro um motorista?').local;
    t('trava: nome entre aspas que NÃO está no material (“Salvar”, “menu superior”) → "" (invenção de botão/tela)', f('Clique em "Novo" e depois em "Salvar" para gravar o motorista no cadastro do sistema.', mQ) === '' && Rag.nomesInventados('Clique em "Novo" e depois em "Salvar".', mQ).includes('Salvar'), JSON.stringify(Rag.nomesInventados('Clique em "Novo" e depois em "Salvar".', mQ)));
    t('trava: nome entre aspas que ESTÁ no material passa', f('Acesse Transporte > Conhecimentos e clique em "Novo" para emitir o CT-e do cliente.') !== '' && Rag.nomesInventados('Clique em "Novo".', m1.local).length === 0);
    // os artigos do banco foram escritos para a equipe de suporte: a etapa de configuração sai do TRECHO também (extrativa), junto com o "Onde fica" da tela de configuração
    const art539 = [{ chave: 'banco:1', titulo: 'Erro ou Rejeição SEFAZ 539: Duplicidade de MDF-e ou Ct-e ou NF-e.', fonte: 'banco', caminho: 'Transporte > Configurações > Tipos de Talões', trecho: 'Alterar a numeração inicial de acordo com a sequência do último documento emitido no antigo sistema, vai em Transporte/Configurações/Tipos de talões, seleciona o talão do documento com erro, clica em visualizar, na guia Talões liberados ajuste a numeração inicial para a sequência correta. […]' }];
    const infoN = Rag.infoNumeracao(PERFIL);
    const ex1 = Rag.extrativa(art539, '', infoN);
    t('extrativa: etapa de configuração (“Alterar a numeração inicial…”) sai do trecho e entra o aviso do Suporte COM os números que o cliente informou', ex1.includes(Rag.LINHA_SUPORTE) && /CT-e 1500 \(série 1\)/.test(ex1) && /MDF-e 320/.test(ex1) && !/Alterar a numeração inicial/.test(ex1) && /^\*\*Erro ou Rejeição SEFAZ 539/.test(ex1), ex1);
    t('extrativa: …e o “Onde fica” do artigo (a tela de configuração) não vai para o cliente; sem configuração no trecho, vai', !/Onde fica/.test(ex1) && /📍 Onde fica: Transporte > Conhecimentos/.test(m1.local.extrativa));
    t('infoNumeracao: só o que o cliente informou; sem número → vazio', /^Diga a eles o último número que você emitiu no sistema antigo: CT-e 1500 \(série 1\) · MDF-e 320 \(série 1\)\.$/.test(infoN) && Rag.infoNumeracao({ trilha: 'nova' }) === '' && Rag.infoNumeracao(null) === '');
    const exe = Rag.extrativaErro(art539, 'aviso de teste', infoN);
    t('extrativaErro: as 3 partes de sempre (causa = título; como corrigir = trecho já sem configuração; se não resolver = Suporte com código e mensagem)', /^\*\*Causa provável:\*\* Erro ou Rejeição SEFAZ 539: Duplicidade de MDF-e ou Ct-e ou NF-e\.\n/.test(exe) && /\*\*Como corrigir:\*\*\n🔒/.test(exe) && /\*\*Se não resolver:\*\* fale com o \*\*Suporte\*\*/.test(exe) && /código e a mensagem exata/.test(exe) && /_aviso de teste_/.test(exe) && !/Alterar a numeração inicial/.test(exe), exe);
    t('extrativaErro: sem material → a triagem padrão', Rag.extrativaErro([]) === Rag.ERRO_NAO_CONSTA);
    eq('trava: resposta cortada pelo limite de tokens termina na última frase inteira', f('Acesse Transporte > Conhecimentos e clique em Novo para começar. Informe o remetente e o destinatário da carga. Depois escolha o valor do', undefined, 'length'), 'Acesse Transporte > Conhecimentos e clique em Novo para começar. Informe o remetente e o destinatário da carga.');
    t('trava: …e, se não houver frase inteira na 2ª metade, o corte é sinalizado com […]', /\[…\]$/.test(f('Acesse Transporte > Conhecimentos e clique em Novo e depois informe o remetente, o destinatário, a natureza da operação e o valor do', undefined, 'length')));
    t('trava: resposta que terminou sozinha (stop) não ganha […]', !/\[…\]/.test(f('Acesse Transporte > Conhecimentos e clique em Novo para emitir o CT-e.', undefined, 'stop')));
    t('trava: resposta enorme é cortada (≤ 1.800 caracteres)', f('Acesse o menu e siga os passos do sistema. '.repeat(100)).length <= 1810);

    // ═════════ a base REAL (somente leitura) ═════════
    if (!offline) {
        let base = null;
        try {
            const cfg = vm.runInNewContext(ler('config/app-config.js').replace('window.BSOFT_CONFIG', 'var C') + ';C', {});
            const get = async (tab, sel) => { const r = await fetch(cfg.supabaseUrl + '/rest/v1/' + tab + '?select=' + sel, { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, Range: '0-999', 'Range-Unit': 'items' } }); if (!r.ok) throw new Error(tab + ' HTTP ' + r.status); return r.json(); };
            base = { banco: await get('BancoDados', 'id,titulo,conteudo,como_emitir,categoria,caminho_menu'), rapidas: (await get('respostas_rapidas', '*').catch(() => [])).filter(r => r.ativo !== false), faq: await get('faq_itens', 'id,pergunta,resposta,categoria,caminho_menu,palavras_chave,videos').catch(() => []) };
        } catch (e) { avisos.push('sem acesso ao banco (' + e.message + '): a parte do banco real foi pulada'); }
        if (base) {
            const ix = { banco: M.criarIndice(base.banco.map(M.docDeBanco)), rapida: M.criarIndice(base.rapidas.map(M.docDeRapida)), faq: M.criarIndice(base.faq.map(M.docDeFaq)), regra: M.criarIndice(G.regras.map(M.docDeRegra)), termo: ixTermo.termo };
            const mr = (pergunta, passoId, perfil, erro, lerTps) => Rag.montar({ pergunta: erro ? M.montarPedidoErro({ doc: 'CT-e', mensagem: pergunta }) : pergunta, historico: [], perfil: perfil || PERFIL, roteiro: R, passoAtual: passoDe(passoId), regras: [], modo: erro ? 'erro' : '' }, { ix, lerTps: lerTps || 3 });
            const dest = l => l.direta ? l.diretaTipo + (l.regrasIds.length ? ':' + l.regrasIds.join('+') : '') : l.naoEncontrei ? 'nao-encontrei' : l.confiante ? 'banco' : 'modelo';
            const C = [
                ['numeracao', 'numeracao', 'Estou migrando de outro sistema. Como confiro se o Bsoft continua a numeração de CT-e e MDF-e sem dar rejeição 539?', false, /^banco$/, /539/],
                ['leigo', 'entender', 'O que é CT-e e MDF-e? Qual a diferença?', false, /^glossario$/],
                ['prazo', 'depois', 'Emiti um CT-e ontem em São Paulo com o valor errado. Ainda consigo cancelar? Qual é o prazo?', false, /^regra:.*cte-cancelar/],
                ['certificado', 'cte', 'O sistema pediu o certificado digital. Como instalo? A empresa só tem um token.', false, /^suporte$/],
                ['rejeicao', 'mdfe', 'Deu rejeição 539 ao autorizar o MDF-e. O que significa e como resolvo?', false, /^banco$/, /539/],
                ['ciot', 'ciotPropria', 'Minha frota é própria. Preciso de CIOT?', false, /^regra:.*ciot/],
                ['erro539', 'cte', 'Rejeição 539: Duplicidade de CT-e. O número já foi usado.', true, /^banco$/, /539/],
                ['erroduvida', 'cte', 'Rejeição 8888: erro xyzabc inexistente na validação do grupo ZZ99', true, /^triagem$/],
                ['seguro', 'seguro', 'Como cadastro a apólice do seguro e ligo a averbação automática?', false, /^modelo$/, /averba/i],
                ['sem-assunto', 'cte', 'qual a cor do céu', false, /^nao-encontrei$/],
                ['cce', 'depois', 'Posso fazer carta de correção para mudar o valor do frete?', false, /^regra:.*cte-cce/],
                ['como1', 'cte', 'Como emito um CT-e?', false, /^banco$/, /emitir um ct-e/i],
                ['como2', 'cte', 'Como posso emitir um CT-e?', false, /^banco$/],
                ['como3', 'cte', 'Preciso emitir um CT-e, como faço?', false, /^banco$/],
                ['motorista', 'pessoas', 'Como cadastro um motorista?', false, /^banco$/, /motorista/i],
                ['dacte', 'cte', 'Como imprimo o DACTE?', false, /^modelo$/, /dacte/i],
                ['vaga', 'cte', 'não consigo emitir', false, /^esclarecer$/],
            ];
            for (const [id, passo, perg, erro, esperado, tit] of C) {
                const l = mr(perg, passo, null, erro).local, d = dest(l);
                t('banco real · ' + id + ': caminho "' + d + '"', esperado.test(d), d);
                if (tit) t('banco real · ' + id + ': o artigo certo é o 1º do material', l.material[0] && tit.test(l.material[0].titulo), l.material.map(x => x.titulo).join(' | '));
            }
            // prompts curtos em todas as perguntas, nos dois orçamentos
            const maiorEco = Math.max.apply(null, C.map(([id, passo, perg, erro]) => mr(perg, passo, null, erro, 3).reduce((s, x) => s + x.content.length, 0)));
            const maiorMed = Math.max.apply(null, C.map(([id, passo, perg, erro]) => mr(perg, passo, null, erro, 20).reduce((s, x) => s + x.content.length, 0)));
            t('prompts: ≤ 1.200 caracteres (~330 tokens) no orçamento econômico e ≤ 1.800 no médio, em todas as perguntas', maiorEco <= 1200 && maiorMed <= 1800, 'econômico ' + maiorEco + ' · médio ' + maiorMed);
            // o que o cliente VÊ nos casos do banco direto (sem modelo): nada de “edite o talão”, o aviso do Suporte com os números dele, 3 partes no erro
            const e539 = mr('Rejeição 539: Duplicidade de CT-e. O número já foi usado.', 'cte', null, true).local.extrativa;
            t('banco real · erro 539 sem modelo: 3 partes + etapa do Suporte com os números informados + nada que ensine a editar o talão + sem “Onde fica” da tela de configuração', /\*\*Causa provável:\*\* Erro ou Rejeição SEFAZ 539/.test(e539) && /\*\*Como corrigir:\*\*/.test(e539) && /\*\*Se não resolver:\*\*/.test(e539) && /CT-e 1500/.test(e539) && !/Alterar a numeração inicial|ajuste a numeração inicial/i.test(e539) && !/Onde fica/.test(e539), e539);
            const num0 = mr('Estou migrando de outro sistema. Como confiro se o Bsoft continua a numeração de CT-e e MDF-e sem dar rejeição 539?', 'numeracao').local.extrativa;
            t('banco real · numeração (trecho do banco, caso o modelo falhe): etapa do Suporte com os números, sem “Alterar a numeração inicial”', num0.includes(Rag.LINHA_SUPORTE) && /CT-e 1500/.test(num0) && !/Alterar a numeração inicial/.test(num0), num0);
            const mot = mr('Como cadastro um motorista?', 'pessoas').local.extrativa;
            t('banco real · motorista sem modelo: o artigo (caminho Pessoas) na íntegra, com “Onde fica” quando o banco tem', /Pessoas\/Pessoas/.test(mot) && !/Esta etapa é feita pelo Suporte/.test(mot), mot);
            t('prompts: no econômico só 1 trecho; no médio até 2', C.every(([id, passo, perg, erro]) => mr(perg, passo, null, erro, 3).local.material.length <= 1 && mr(perg, passo, null, erro, 20).local.material.length <= 2));
            // TODO artigo, perguntado pelo próprio título, traz a si mesmo (recuperação do pipeline local)
            const bons = base.banco.filter(r => r.titulo && String(r.titulo).trim().length >= 12 && r.conteudo && String(r.conteudo).trim().length > 40);
            let top1 = 0, noMaterial2 = 0, semMaterial = 0, falhou = 0; const perdidos = [];
            const mesmo = (m, r) => m.chave === 'banco:' + r.id || (/^banco:/.test(m.chave) && M.tokens(m.titulo).join() === M.tokens(r.titulo).join());      // (o banco tem artigos com o MESMO título: um deles vale pelo outro)
            bons.forEach(r => {
                try {
                    const l1 = mr(String(r.titulo).trim(), 'cte', null, false, 3).local, l2 = mr(String(r.titulo).trim(), 'cte', null, false, 20).local;
                    if (l1.direta) return;      // (o título virou pergunta de prazo/glossário/configuração: o caminho é outro; não conta)
                    if (!l1.material.length) { semMaterial++; return; }
                    if (mesmo(l1.material[0], r)) top1++; else perdidos.push(r.titulo.slice(0, 50));
                    if (l2.material.some(m => mesmo(m, r))) noMaterial2++;
                } catch (e) { falhou++; }
            });
            const total = top1 + perdidos.length + semMaterial;
            t('recuperação: nenhum título de artigo derruba a montagem do prompt', falhou === 0, falhou + ' falha(s)');
            t('recuperação: o artigo, perguntado pelo próprio título, é o 1º do material em ≥ 75% (orçamento econômico, 1 trecho)', top1 / total >= 0.75, Math.round(100 * top1 / total) + '% de ' + total + ' · ex.: ' + perdidos.slice(0, 4).join(' | '));
            avisos.push('recuperação (título como pergunta): 1º do material ' + Math.round(100 * top1 / total) + '% · no material (2 trechos) ' + Math.round(100 * noMaterial2 / total) + '% · sem material ' + semMaterial + ' · ' + total + ' artigos');
            avisos.push('prompt (14 perguntas de teste): maior econômico ' + maiorEco + ' caracteres · maior médio ' + maiorMed);
        }
    } else avisos.push('--offline: a parte do banco real foi pulada');

    console.log('\n' + ok + ' verificações ok · ' + falhas.length + ' falha(s)');
    falhas.forEach(x => console.log('  ✘ ' + x));
    avisos.forEach(a => console.log('  ℹ ' + a));
    process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('erro no teste:', e); process.exit(2); });
