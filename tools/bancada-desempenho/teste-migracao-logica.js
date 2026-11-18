'use strict';
/* teste-migracao-logica.js — testa a lógica de js/migracao/logica.js SEM navegador (perguntas do começo, passo a passo, prazos, busca, textos da IA, o cliente guardado no navegador).
   Rode:  $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-migracao-logica.js | Out-String
   A parte da BUSCA lê o banco de dados de verdade (SOMENTE LEITURA, com a chave pública que o próprio sistema usa) e confere: se cada passo, cada pergunta pronta do chat e cada
   botão de "erro comum" acham o artigo certo; sem internet use  --offline  (a parte da busca é pulada). O que ficar sem artigo no banco aparece como "lacuna de conteúdo". */
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.resolve(__dirname, '..', '..');
const ler = rel => fs.readFileSync(path.join(raiz, rel), 'utf8');
const offline = process.argv.includes('--offline');

const ctx = { console: { log() {}, warn() {}, info() {}, error() {} } }; ctx.window = ctx; vm.createContext(ctx);
['config/menu-bsoft.js', 'js/app/menu-bsoft.js', 'js/app/prerequisitos.js', 'config/migracao-roteiro.js', 'config/migracao-regras.js', 'config/migracao-glossario.js']
    .forEach(f => vm.runInContext(ler(f), ctx, { filename: f }));
const M = vm.runInContext(ler('js/migracao/logica.js') + '\n;MigLogica', ctx, { filename: 'js/migracao/logica.js' });
const R = ctx.BSOFT_MIG_ROTEIRO, G = ctx.BSOFT_MIG_REGRAS, GL = ctx.BSOFT_MIG_GLOSSARIO;

let ok = 0; const falhas = [], avisos = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + detalhe : '')); };
const eq = (nome, a, b) => t(nome, JSON.stringify(a) === JSON.stringify(b), 'veio ' + JSON.stringify(a) + ' · esperado ' + JSON.stringify(b));
const ids = rot => rot.passos.map(p => p.id);
const perfilDe = o => M.sanearPerfil(o, R);

(async () => {
    // ═════════ perguntas do começo (perfil) ═════════
    const pm = M.perfilPadrao(R, 'migracao'), pn = M.perfilPadrao(R, 'nova');
    t('perfil "outro sistema": trilha, documentos padrão (CT-e e MDF-e), seguro "já configurado" e numeração em branco', pm.trilha === 'migracao' && pm.docs.join() === 'cte,mdfe' && pm.seguro === 'configurado' && typeof pm.numeracao === 'object' && pm.numeracao.cteNumero === '', JSON.stringify(pm));
    t('perfil "empresa nova": sem a numeração (só quem vem de outro sistema)', pn.trilha === 'nova' && !('numeracao' in pn) && pn.docs.join() === 'cte,mdfe');
    eq('trilha inválida vira "nova"', M.perfilPadrao(R, 'xx').trilha, 'nova');
    eq('perguntas da trilha nova: 3 (sem a numeração)', M.perguntasDoPerfil(R, 'nova').map(q => q.id), ['trilha', 'docs', 'seguro']);
    eq('perguntas da trilha migração: 4', M.perguntasDoPerfil(R, 'migracao').map(q => q.id), ['trilha', 'docs', 'seguro', 'numeracao']);
    const sujo = M.sanearPerfil({ trilha: 'migracao', docs: ['cte', 'hack', 'mdfe'], seguro: 'xx', numeracao: { cteSerie: '1abc22222', cteNumero: '12.345', mdfeSerie: '', mdfeNumero: '99999999999' }, __proto__: { x: 1 }, extra: 'lixo', uf: 'MT', anterior: 'x' }, R);
    t('sanear: documentos só os conhecidos (na ordem das opções)', sujo.docs.join() === 'cte,mdfe', sujo.docs.join());
    t('sanear: seguro inválido volta ao padrão', sujo.seguro === 'configurado');
    t('sanear: numeração só com dígitos e com os limites (série 3, número 9)', sujo.numeracao.cteSerie === '122' && sujo.numeracao.cteNumero === '12345' && sujo.numeracao.mdfeNumero === '999999999', JSON.stringify(sujo.numeracao));
    t('sanear: campo desconhecido não passa (nem os de versões antigas da página)', !('extra' in sujo) && !('x' in sujo) && !('uf' in sujo) && !('anterior' in sujo));
    t('sanear: lixo (null, número, texto) vira perfil padrão', M.sanearPerfil(null, R).trilha === 'nova' && M.sanearPerfil(42, R).trilha === 'nova' && M.sanearPerfil('x', R).docs.join() === 'cte,mdfe');
    t('sanear: a numeração de quem é "empresa nova" é descartada', !('numeracao' in M.sanearPerfil({ trilha: 'nova', numeracao: { cteNumero: '5' } }, R)));
    t('sanear: documentos vazios continuam vazios (a tela é que pede para marcar)', M.sanearPerfil({ trilha: 'nova', docs: [] }, R).docs.length === 0);
    eq('rótulo de uma opção', M.rotuloDe(R, 'seguro', 'configurar'), 'Sim, mas ainda não configurei no sistema');

    // ═════════ combinação ═════════
    t('combina: sem condição = sempre', M.combina(undefined, pm) && M.combina({}, pm));
    t('combina: OU dentro da lista', M.combina({ trilha: ['migracao', 'x'] }, pm));
    t('combina: E entre chaves', !M.combina({ trilha: ['migracao'], seguro: ['configurar'] }, pm) && M.combina({ trilha: ['migracao'], seguro: ['configurado'] }, pm));
    t('combina: valor do perfil em lista (documentos)', M.combina({ docs: ['cte', 'ciotPropria'] }, pm) && !M.combina({ docs: ['ciotPropria'] }, pm));

    // ═════════ passo a passo ═════════
    const tudo = perfilDe({ trilha: 'migracao', docs: ['cte', 'mdfe', 'ciotPropria', 'contratoFrete'], seguro: 'configurar' });
    eq('passo a passo completo (outro sistema, 4 documentos, seguro a configurar): 9 passos na ordem', ids(M.montarRoteiro(tudo, R)), ['numeracao', 'pessoas', 'veiculos', 'seguro', 'cte', 'mdfe', 'ciotPropria', 'contratoFrete', 'depois']);
    eq('empresa nova, só CT-e e MDF-e, seguro já configurado: começa em "entender" e não tem a numeração nem o seguro', ids(M.montarRoteiro(perfilDe({ trilha: 'nova', docs: ['cte', 'mdfe'], seguro: 'configurado' }), R)), ['entender', 'pessoas', 'veiculos', 'cte', 'mdfe', 'depois']);
    eq('só o contrato de frete: cadastros, o contrato e os prazos', ids(M.montarRoteiro(perfilDe({ trilha: 'nova', docs: ['contratoFrete'], seguro: 'nao' }), R)), ['entender', 'pessoas', 'veiculos', 'contratoFrete', 'depois']);
    const rot = M.montarRoteiro(tudo, R);
    t('passo a passo: as fases seguem o arquivo e cada passo aparece só uma vez', new Set(ids(rot)).size === rot.passos.length && rot.fases.length === 1 && rot.fases[0].id === 'passos');
    t('passo a passo: porId acha qualquer passo', rot.passos.every(p => rot.porId.get(p.id) === p));
    t('passo a passo: o status de um passo é "pendente" até o cliente avançar; status inventado também é pendente', M.statusDe({}, 'cte') === 'pendente' && M.statusDe({ cte: { s: 'feito' } }, 'cte') === 'feito' && M.statusDe({ cte: { s: 'hack' } }, 'cte') === 'pendente' && M.statusDe(null, 'cte') === 'pendente');
    // alertas que dependem das respostas
    const alertas = []; R.passos.forEach(p => (p.alertas || []).forEach(a => alertas.push([p, a])));
    t('alertas: os do roteiro aparecem só para quem combina com as respostas', alertas.length >= 1 && alertas.every(([p, a]) => { const comp = Object.keys(a.se || {}).length ? perfilDe({ trilha: 'migracao', docs: [].concat(a.se.docs || ['cte']), seguro: (a.se.seguro || ['configurado'])[0] }) : tudo; return M.alertasDoPasso(p, comp).includes(a) === M.combina(a.se, comp); }));
    const alertaCiot = R.passos.find(p => p.id === 'cte').alertas;
    if (alertaCiot && alertaCiot.length) t('alertas: o aviso da ordem com o CIOT só aparece para quem emite CIOT', M.alertasDoPasso(R.passos.find(p => p.id === 'cte'), perfilDe({ trilha: 'nova', docs: ['cte'] })).length < M.alertasDoPasso(R.passos.find(p => p.id === 'cte'), perfilDe({ trilha: 'nova', docs: ['cte', 'ciotPropria'] })).length || alertaCiot.every(a => !a.se));

    // ═════════ prazos ═════════
    const base = new Date(2026, 10, 16, 9, 0);   // 16/11/2026 09:00 (hora local)
    const cteCancel = G.calculadora.find(c => c.id === 'cte-cancelar');
    const r1 = M.somarPrazo(cteCancel, base, 'SP'), r2 = M.somarPrazo(cteCancel, base, 'MT');
    t('CT-e: 168 h depois da autorização', r1.ate.getTime() === base.getTime() + 168 * 3600e3 && !r1.porUF, r1.ate.toISOString());
    t('CT-e em MT: 8 h', r2.ate.getTime() === base.getTime() + 8 * 3600e3 && r2.porUF, r2.ate.toISOString());
    const agora = new Date(2026, 10, 17, 9, 0);
    const lista = M.calcularPrazos(G.calculadora, { doc: 'CT-e', base, uf: 'SP', agora });
    t('calculadora CT-e: cancelar + guarda do XML (mínimo e recomendado), sem itens de MDF-e', lista.map(x => x.id).join() === 'cte-cancelar,xml-min,xml-rec', lista.map(x => x.id).join());
    const lm = M.calcularPrazos(G.calculadora, { doc: 'MDF-e', base, uf: '', agora });
    t('calculadora MDF-e: cancelar 24 h + limite de 30 dias + guarda', lm.map(x => x.id).join() === 'mdfe-cancelar,mdfe-bloqueio,xml-min,xml-rec');
    t('MDF-e: 24 h depois (cancelar)', lm[0].ate.getTime() === base.getTime() + 24 * 3600e3);
    const d30 = lm.find(x => x.id === 'mdfe-bloqueio').ate; t('MDF-e: 30 dias no calendário (16/11 → 16/12)', d30.getDate() === 16 && d30.getMonth() === 11 && d30.getHours() === 9, d30.toString());
    const x5 = lista.find(x => x.id === 'xml-min').ate, x11 = lista.find(x => x.id === 'xml-rec').ate; t('guarda do XML: 5 e 11 anos', x5.getFullYear() === 2031 && x11.getFullYear() === 2037);
    t('estado: 24 h depois de 168 h = ok', lista[0].estado === 'ok');
    const quase = M.calcularPrazos(G.calculadora, { doc: 'CT-e', base, uf: 'SP', agora: new Date(base.getTime() + 160 * 3600e3) });
    t('estado: faltando 8 h = atenção', quase[0].estado === 'atencao');
    const passou = M.calcularPrazos(G.calculadora, { doc: 'CT-e', base, uf: 'SP', agora: new Date(base.getTime() + 169 * 3600e3) });
    t('estado: depois do prazo = vencido', passou[0].estado === 'vencido' && passou[0].restanteMs < 0);
    const mt = M.calcularPrazos(G.calculadora, { doc: 'CT-e', base, uf: 'MT', agora: new Date(base.getTime() + 7 * 3600e3) });
    t('MT: 7 h depois já está na faixa de atenção (prazo de 8 h)', mt[0].estado === 'atencao' && mt[0].porUF === true);
    t('data inválida não quebra', M.calcularPrazos(G.calculadora, { doc: 'CT-e', base: new Date('x'), agora }).length === 0);
    eq('duração: horas e minutos', M.duracao(90 * 60e3), '1 h e 30 min'); eq('duração: dias e horas', M.duracao((3 * 24 + 5) * 3600e3), '3 dias e 5 h');
    eq('duração: menos de 1 min', M.duracao(10e3), 'menos de 1 min'); eq('duração: anos', M.duracao(5 * 365 * 24 * 3600e3), '5 anos');
    eq('formatar restante: faltam', M.formatarRestante(2 * 3600e3), 'faltam 2 h'); eq('formatar restante: passou', M.formatarRestante(-2 * 3600e3), 'passou há 2 h');
    eq('data formatada', M.formatarData(new Date(2026, 0, 5, 7, 3)), '05/01/2026 07:03');
    eq('input local ida e volta', M.deInputLocal(M.paraInputLocal(base)).getTime(), base.getTime()); eq('input local inválido', M.deInputLocal('abc'), null);

    // ═════════ busca: texto ═════════
    eq('tokens: CT-e, MDF-e, NFS-e e NF-e viram uma palavra', M.tokens('CT-e e MDF-e, NFS-e, NF-e'), ['cte', 'mdfe', 'nfse', 'nfe']);
    t('tokens: ct e / cte / CT-e iguais', M.tokens('ct e')[0] === 'cte' && M.tokens('CTE')[0] === 'cte');
    t('radical: cancelar = cancelamento = cancelado', new Set(['cancelar', 'cancelamento', 'cancelado', 'cancelada'].map(M.radical)).size === 1, ['cancelar', 'cancelamento', 'cancelado'].map(M.radical).join());
    t('radical: certificado = certificados', M.radical('certificado') === M.radical('certificados'));
    t('radical: veículo = veículos, motorista = motoristas', M.radical('veiculos') === M.radical('veiculo') && M.radical('motoristas') === M.radical('motorista'));
    t('palavras vazias saem', M.tokens('como que para o de a').length === 0);
    t('número da rejeição fica (539)', M.tokens('rejeição 539').includes('539'));
    const dupl = M.criarIndice([{ chave: 'a', titulo: 'Como emitir um ct-e', texto: 'abra a tela de conhecimentos' }, { chave: 'b', titulo: 'Como emitir um ct-e', texto: 'abra a tela de conhecimentos' }, { chave: 'c', titulo: 'Cancelar mdf-e', texto: 'abra o manifesto' }]);
    t('busca: título repetido entra uma vez só', M.buscar(dupl, 'emitir ct-e').length === 1);
    t('busca: vazia ou só palavras vazias não acha nada', M.buscar(dupl, '').length === 0 && M.buscar(dupl, 'como para').length === 0 && M.buscar(null, 'x').length === 0);
    t('busca: respeita "max"', M.buscar(M.criarIndice(['alfa', 'beta', 'gama', 'delta', 'epsilon', 'zeta', 'eta', 'teta', 'iota'].map((w, i) => ({ chave: 'k' + i, titulo: 'cancelar documento ' + w, texto: 'x' }))), 'cancelar documento', { max: 3 }).length === 3);
    // índices de vídeo e de glossário (a IA recomenda o vídeo e explica a sigla)
    const ixVid = M.criarIndice(Object.keys(R.videos).map(k => M.docDeVideo(k, R.videos[k])));
    eq('busca de vídeo: "como emitir o MDF-e" acha o vídeo do MDF-e', M.buscar(ixVid, 'como emitir o MDF-e', { max: 1, minCobertura: 0.3 }).map(x => x.doc.id), ['mdfe']);
    eq('busca de vídeo: "cadastrar veículo placa" acha o vídeo de veículos', M.buscar(ixVid, 'como cadastrar o veículo e a placa', { max: 1, minCobertura: 0.3 }).map(x => x.doc.id), ['veiculos']);
    eq('busca de vídeo: "gerar ciot de frota própria" acha o da frota própria', M.buscar(ixVid, 'gerar ciot da frota própria', { max: 1, minCobertura: 0.3 }).map(x => x.doc.id), ['ciotPropria']);
    t('busca de vídeo: pergunta sem relação não recomenda vídeo', M.buscar(ixVid, 'receita de bolo de chocolate', { max: 1, minCobertura: 0.3 }).length === 0);
    const ixTermo = M.criarIndice(GL.termos.map(M.docDeTermo));
    t('busca de glossário: "o que é CIOT" acha o termo CIOT', M.buscar(ixTermo, 'o que é CIOT', { max: 2, minCobertura: 0.5 }).some(x => /CIOT/.test(x.doc.termo.termo)));

    // ═════════ anonimização ═════════
    const an = M.anonimizar('CNPJ 12.345.678/0001-90 ou 12345678000190, CPF 123.456.789-09, fulano@empresa.com.br, tel (11) 99999-8888 e 11 3333-4444, chave 33260956105166000208570010000056271280123456');
    t('anonimizar: CNPJ, CPF, e-mail, telefone e chave saem', !/\d{8}/.test(an.replace(/\[.*?\]/g, '')) && !/@/.test(an), an);
    t('anonimizar: números normais ficam (539, série 1, 168 horas, R$ 1.500,00, CT-e 1500)', M.anonimizar('rejeição 539 na série 1, 168 horas, R$ 1.500,00, CT-e 1500, MDF-e 654') === 'rejeição 539 na série 1, 168 horas, R$ 1.500,00, CT-e 1500, MDF-e 654');
    t('anonimizar: aceita null', M.anonimizar(null) === '');

    // ═════════ o que a IA recebe ═════════
    const perfil = perfilDe({ trilha: 'migracao', docs: ['cte', 'mdfe', 'ciotPropria'], seguro: 'configurar', numeracao: { cteSerie: '1', cteNumero: '1500', mdfeSerie: '1', mdfeNumero: '320' } });
    const rot2 = M.montarRoteiro(perfil, R), estado = { numeracao: { s: 'feito' }, pessoas: { s: 'andamento' } };
    const pIA = M.perfilParaIA(perfil, R);
    t('perfil para a IA: situação, momento (primeira emissão, o cliente não configura), documentos e seguro', /Situação: a empresa já emite documentos em OUTRO sistema/.test(pIA) && /Momento: PRIMEIRA EMISSÃO/.test(pIA) && /Não mande o cliente configurar o sistema/.test(pIA) && /Documentos que precisa emitir: CT-e; MDF-e; CIOT da frota própria/.test(pIA) && /Seguro de transporte \(apólice\): Sim, mas ainda não configurei no sistema/.test(pIA), pIA);
    t('perfil para a IA: leva os últimos números e o próximo esperado (1501 e 321)', /CT-e série 1, último número 1500 \(o próximo no Bsoft deve ser 1501\)/.test(pIA) && /MDF-e série 1, último número 320 \(o próximo no Bsoft deve ser 321\)/.test(pIA), pIA);
    t('perfil para a IA: não repete a linha do seguro e não tem nome nem CNPJ', (pIA.match(/Seguro de transporte/g) || []).length === 1 && !/nome|cnpj/i.test(pIA.replace(/Situação.*|Momento.*/g, '')));
    t('perfil para a IA: empresa nova não tem linha de numeração', !/Últimos números/.test(M.perfilParaIA(perfilDe({ trilha: 'nova', docs: ['cte'] }), R)) && /empresa nova no transporte/.test(M.perfilParaIA(perfilDe({ trilha: 'nova', docs: ['cte'] }), R)));
    t('perfil para a IA: só o número do CT-e informado → só a linha do CT-e', (() => { const s = M.perfilParaIA(perfilDe({ trilha: 'migracao', docs: ['cte'], numeracao: { cteNumero: '7' } }), R); return /CT-e série \?, último número 7 \(o próximo no Bsoft deve ser 8\)/.test(s) && !/MDF-e série/.test(s); })());
    const regras = [G.regras.find(r => r.id === 'cte-cancelar'), G.regras.find(r => r.id === 'ciot-2026')].filter(Boolean);
    const fakeArt = { doc: { fonte: 'banco', id: 89, titulo: 'Como cancelar um Ct-e na SEFAZ', texto: 'x'.repeat(5000), categoria: 'Ct-e/Conhecimento', caminho: 'Transporte > Conhecimentos', chave: 'banco:89' }, score: 1, cobertura: 1 };
    const hist = Array.from({ length: 9 }, (_, i) => ({ papel: i % 2 ? 'ia' : 'voce', texto: 'mensagem ' + i + ' com CNPJ 12.345.678/0001-90' }));
    const passoAtual = rot2.passos.find(p => p.id === 'cte');
    const base0 = { pergunta: 'O CNPJ 12.345.678/0001-90 pode cancelar o CT-e?', historico: hist, perfil, roteiro: R, rot: rot2, estado, passoAtual, achados: { banco: [fakeArt], rapida: [], faq: [] }, regras, parametros: '=== PARÂMETROS E FUNCIONALIDADES RELACIONADOS ===\n[PARÂMETRO]\n  Descrição: x\n', menu: '=== CAMINHOS DO MENU ===\nTransporte > Conhecimentos\n', videos: [{ chave: 'cte', titulo: R.videos.cte.titulo }], glossario: ['[CT-e — Conhecimento de Transporte Eletrônico] é o documento do transporte'] };
    const msgs = M.montarMensagensMentor(base0);
    t('IA: 1ª mensagem é a do sistema, com a regra de nunca escrever código de parâmetro', msgs[0].role === 'system' && /NUNCA ESCREVA O CÓDIGO/i.test(msgs[0].content));
    t('IA: o sistema fala com o CLIENTE, diz que ele só emite (não configura) e proíbe inventar prazos', /Fale diretamente com ele/.test(msgs[0].content) && /O CLIENTE SÓ EMITE/.test(msgs[0].content) && /Nunca crie um prazo novo/.test(msgs[0].content) && /REGRAS E PRAZOS CONFERIDOS/.test(msgs[0].content) && !/analista de suporte/i.test(msgs[0].content));
    t('IA: o sistema não menciona a "Mentor de Implantação" antiga nem pede para configurar certificado/talão', !/Mentor de Implanta/.test(msgs[0].content) && /não mande o cliente configurar/i.test(msgs[0].content));
    t('IA: histórico limitado a 6 mensagens + sistema + pergunta', msgs.length === 1 + 6 + 1, String(msgs.length));
    t('IA: papéis alternam usuário/assistente', msgs.slice(1, -1).every(m => m.role === 'user' || m.role === 'assistant'));
    const ultima = msgs[msgs.length - 1].content;
    t('IA: a pergunta e o histórico vão anonimizados', /\[CNPJ omitido\]/.test(ultima) && !/12\.345\.678/.test(JSON.stringify(msgs)), 'achou CNPJ');
    t('IA: o lembrete "o cliente só emite" fecha a mensagem, depois da pergunta (modelo gratuito dá mais peso ao fim)', ultima.indexOf('=== PERGUNTA ===') > 0 && ultima.indexOf('=== PERGUNTA ===') < ultima.indexOf('Lembrete: o cliente só emite') && ultima.trimEnd().endsWith('Conferir o que já está cadastrado é permitido.)'));
    t('IA: perfil e passo a passo no contexto (feito e em andamento) e o passo em que a pessoa está', /PERFIL DO CLIENTE/.test(ultima) && /JÁ FEITO: Confira se a numeração/.test(ultima) && /EM ANDAMENTO: Cadastre quem aparece/.test(ultima) && /A PESSOA ESTÁ NESTE PASSO DO ROTEIRO ===\nEmitir o CT-e/.test(ultima));
    t('IA: o que a tela mostra ao cliente no passo (passo a passo e cuidados) entra como orientação oficial que vale mais que o artigo do banco', /O QUE A TELA JÁ MOSTRA AO CLIENTE NESTE PASSO/.test(ultima) && passoAtual.como.every((c, i) => ultima.includes((i + 1) + '. ' + c)) && /Cuidados: /.test(ultima) && /vale esta orientação/.test(ultima));
    t('IA: o passo da numeração leva ao prompt a regra "diferente ou repetido? não emita e fale com o Suporte"', (() => { const n = rot2.passos.find(p => p.id === 'numeracao'); const m = M.montarMensagensMentor(Object.assign({}, base0, { passoAtual: n })), u = m[m.length - 1].content, bloco = u.split('=== O QUE A TELA')[1].split('\n\n')[0]; return /Diferente ou repetido\? Não emita ainda e fale com o Suporte/.test(bloco); })());
    t('IA: os caminhos do menu do passo atual (conferidos no menu real) entram — a IA usa exatamente esses', /CAMINHOS DO MENU DESTE PASSO/.test(ultima) && passoAtual.onde.length >= 1 && passoAtual.onde.every(c => ultima.includes('- ' + c)), JSON.stringify(passoAtual.onde));
    t('IA: os vídeos do passo e o glossário entram',/VÍDEOS TUTORIAIS DA EQUIPE/.test(ultima) && new RegExp(R.videos.cte.titulo).test(ultima) && /GLOSSÁRIO/.test(ultima) && /Conhecimento de Transporte Eletrônico\] é o documento/.test(ultima));
    t('IA: regra orientativa vem marcada para mandar confirmar, regra conferida com a data', /ORIENTATIVA — mandar confirmar/.test(ultima) && /conferida em 2026-11-16/.test(ultima), regras.map(r => r.id + ':' + r.nivel).join());
    t('IA: o artigo longo é cortado, mas entra', /Como cancelar um Ct-e na SEFAZ/.test(ultima) && ultima.length < 12000 && /\[…\]/.test(ultima));
    t('IA: parâmetros e menu entram no contexto', /PARÂMETROS E FUNCIONALIDADES RELACIONADOS/.test(ultima) && /CAMINHOS DO MENU/.test(ultima));
    t('IA: o prompt tem as seções na ordem certa (perfil → roteiro → passo → vídeos → regras → glossário → conhecimento → pergunta)', (() => { const ord = ['PERFIL DO CLIENTE', 'ROTEIRO (', 'NESTE PASSO DO ROTEIRO', 'VÍDEOS TUTORIAIS', 'REGRAS E PRAZOS', 'GLOSSÁRIO', 'CONHECIMENTO DO SISTEMA', '=== PERGUNTA ==='].map(s => ultima.indexOf(s)); return ord.every((p, i) => p >= 0 && (i === 0 || p > ord[i - 1])); })(), JSON.stringify(['PERFIL DO CLIENTE', 'ROTEIRO (', 'NESTE PASSO DO ROTEIRO', 'VÍDEOS TUTORIAIS', 'REGRAS E PRAZOS', 'GLOSSÁRIO', 'CONHECIMENTO DO SISTEMA', '=== PERGUNTA ==='].map(s => ultima.indexOf(s))));
    const semBase = M.montarMensagensMentor({ pergunta: 'x', historico: [], perfil, roteiro: R, rot: rot2, estado: {}, achados: {}, regras: [] });
    t('IA: sem artigo achado a IA é mandada dizer que não consta', /nenhum artigo da base combinou/.test(semBase[semBase.length - 1].content));
    t('IA: sem passo atual, sem vídeos e sem glossário esses blocos não aparecem', !/NESTE PASSO/.test(semBase[semBase.length - 1].content) && !/VÍDEOS TUTORIAIS/.test(semBase[semBase.length - 1].content) && !/GLOSSÁRIO/.test(semBase[semBase.length - 1].content));
    const comErro = M.montarMensagensMentor(Object.assign({}, base0, { modo: 'erro', pergunta: M.montarPedidoErro({ doc: 'CT-e', mensagem: 'Rejeição 539: Duplicidade' }) }));
    t('modo erro: o sistema ganha o formato causa → correção → depois → se não resolver e a regra "só os artigos fornecidos"', /MODO "DEU ERRO NA PRIMEIRA EMISSÃO"/.test(comErro[0].content) && /Causa provável/.test(comErro[0].content) && /Como corrigir no Bsoft/.test(comErro[0].content) && /Depois de corrigir/.test(comErro[0].content) && /Se não resolver/.test(comErro[0].content) && /esse erro não consta na base/.test(comErro[0].content));
    t('modo erro: quem lê é o cliente — nunca manda mexer em talão, certificado, regra ou tabela', /quem lê é o CLIENTE/.test(comErro[0].content) && /nunca mande mexer em talão, certificado, regras, tabelas ou parâmetros/.test(comErro[0].content) && !/analista de suporte/i.test(comErro[0].content));
    t('modo normal: o formato do modo erro NÃO entra', !/DEU ERRO NA PRIMEIRA EMISSÃO/.test(msgs[0].content));
    const pe = M.montarPedidoErro({ doc: 'CT-e', mensagem: '  Rejeição 539:\n Duplicidade  de CT-e  ', fazia: 'transmitindo o primeiro CT-e' });
    t('pedido de erro: documento, mensagem (espaços e quebras de linha arrumados) e o que a pessoa fazia', /Documento\/etapa: CT-e\nMensagem de erro \(copiada do sistema\): Rejeição 539: Duplicidade de CT-e\nO que a pessoa estava fazendo \/ já tentou: transmitindo o primeiro CT-e\nDiga a causa e como corrigir\./.test(pe), pe);
    t('pedido de erro: sem mensagem diz "(não informada)"; mensagem enorme é cortada em 1500', /\(não informada\)/.test(M.montarPedidoErro({ doc: 'x' })) && M.montarPedidoErro({ doc: 'x', mensagem: 'a'.repeat(5000) }).length < 1800);
    t('pedido de erro: a chave de acesso e o CNPJ da mensagem saem quando a pergunta é montada para a IA', (() => { const m = M.montarMensagensMentor(Object.assign({}, base0, { modo: 'erro', pergunta: M.montarPedidoErro({ doc: 'CT-e', mensagem: 'chave 33260956105166000208570010000056271280123456 do CNPJ 12.345.678/0001-90' }) })); const u = m[m.length - 1].content; return /chave de acesso omitida/.test(u) && /CNPJ omitido/.test(u) && !/3326095610516600/.test(u); })());
    // limpeza da resposta
    t('limpar resposta: tira cerca ```markdown e o código de parâmetro', M.limparResposta('```markdown\n**Verifique** o parâmetro 1117 - Regra\n```') === '**Verifique** o parâmetro: Regra', M.limparResposta('```markdown\n**Verifique** o parâmetro 1117 - Regra\n```'));
    t('limpar resposta: não mexe em "prazo de 168 horas" nem em rejeição 539', M.limparResposta('Cancele em 168 horas. Rejeição 539.') === 'Cancele em 168 horas. Rejeição 539.');
    t('limpar resposta: funcionalidade com número também perde o código', !/\b77\b/.test(M.limparResposta('Ative a funcionalidade 77 antes de emitir.')));

    // ═════════ o cliente guardado no navegador ═════════
    const cl = M.novoCliente(perfil);
    t('novo cliente: id no formato esperado, sem nome e sem dado pessoal, no passo 0', /^c[a-z0-9]{6,}$/.test(cl.id) && !('nome' in cl) && !('notas' in cl) && cl.passoIdx === 0 && cl.mentor.length === 0 && JSON.stringify(cl.passos) === '{}', JSON.stringify(Object.keys(cl)));
    t('registrar status: grava; repetir não muda nada', M.registrarStatus(cl, 'pessoas', 'feito') === true && M.registrarStatus(cl, 'pessoas', 'feito') === false && cl.passos.pessoas.s === 'feito' && cl.passos.pessoas.em > 0);
    const mal = { id: 'c' + 'a'.repeat(10), nome: '<img src=x onerror=alert(1)>', criadoEm: 'x', atualizadoEm: 1e15, perfil: { trilha: 'migracao', docs: ['cte'] }, passoIdx: '7', notas: 'n'.repeat(20000), historico: [{ passo: 'cte', s: 'feito' }],
        passos: { pessoas: { s: 'feito', em: 5, nota: 'x' }, 'passo-que-nao-existe': { s: 'feito' }, cte: { s: 'hackeado' }, numeracao: { s: 'pendente' }, __proto__: { s: 'feito' }, constructor: { s: 'feito' } },
        mentor: Array.from({ length: 60 }, (_, i) => ({ papel: i % 3 ? 'ia' : 'hacker', texto: 'm' + i, fontes: [{ chave: 'banco:1', titulo: 'x'.repeat(500) }, { titulo: 'sem chave' }] })) };
    const sc = M.sanearCliente(mal, R);
    t('sanear cliente: só os campos novos (sem nome, notas e histórico de versões antigas)', JSON.stringify(Object.keys(sc).sort()) === JSON.stringify(['atualizadoEm', 'criadoEm', 'id', 'mentor', 'passoIdx', 'passos', 'perfil']), JSON.stringify(Object.keys(sc)));
    t('sanear cliente: datas inválidas viram números e o passo guardado vira inteiro', Number.isFinite(sc.criadoEm) && Number.isFinite(sc.atualizadoEm) && sc.passoIdx === 7);
    t('sanear cliente: só passos que existem, com status válido e diferente de "pendente"', Object.keys(sc.passos).join() === 'pessoas' && sc.passos.pessoas.s === 'feito' && !('nota' in sc.passos.pessoas), Object.keys(sc.passos).join());
    t('sanear cliente: conversa limitada a 40, com papéis válidos e fontes só com chave e título curto', sc.mentor.length <= 40 && sc.mentor.every(m => m.papel === 'voce' || m.papel === 'ia') && sc.mentor.every(m => m.fontes.length === 1 && m.fontes[0].titulo.length <= 160));
    t('sanear cliente: protótipo não é poluído', vm.runInContext('({}).s === undefined && ({}).polluted === undefined', ctx) && sc.passos.s === undefined && Object.getPrototypeOf(sc.passos).constructor.name === 'Object');
    t('sanear cliente: lixo vira null', M.sanearCliente(null, R) === null && M.sanearCliente('x', R) === null && M.sanearCliente(42, R) === null);
    eq('passo guardado: texto, negativo e enorme', [M.sanearCliente({ passoIdx: 'abc' }, R).passoIdx, M.sanearCliente({ passoIdx: -5 }, R).passoIdx, M.sanearCliente({ passoIdx: 5000 }, R).passoIdx], [0, 0, 99]);
    t('sanear cliente: id inválido ganha um id novo (sem aceitar HTML)', /^c[a-z0-9]{6,}$/.test(M.sanearCliente({ id: '<b>x</b>' }, R).id));
    const proto = M.sanearCliente(JSON.parse('{"id":"cabcdefgh","perfil":{"__proto__":{"polluted":1}},"passos":{"__proto__":{"s":"feito"}}}'), R);
    t('sanear cliente com __proto__ no JSON: nada vaza', vm.runInContext('({}).polluted === undefined && ({}).s === undefined', ctx) && ({}).polluted === undefined && proto && Object.keys(proto.passos).length === 0);

    // ═════════ busca nos dados reais (somente leitura) ═════════
    let banco = null, rapidas = [], faq = [];
    if (!offline) {
        try {
            const cfg = vm.runInNewContext(ler('config/app-config.js').replace('window.BSOFT_CONFIG', 'var C') + ';C', {});
            const get = async (tab, sel) => { const r = await fetch(cfg.supabaseUrl + '/rest/v1/' + tab + '?select=' + sel, { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, Range: '0-999', 'Range-Unit': 'items' } }); if (!r.ok) throw new Error(tab + ' HTTP ' + r.status); return r.json(); };
            banco = await get('BancoDados', 'id,titulo,conteudo,como_emitir,categoria,caminho_menu');
            rapidas = (await get('respostas_rapidas', '*').catch(() => [])).filter(r => r.ativo !== false);
            faq = await get('faq_itens', 'id,pergunta,resposta,categoria,caminho_menu,palavras_chave,videos').catch(() => []);
        } catch (e) { avisos.push('sem acesso ao banco (' + e.message + '): a parte da busca foi pulada'); }
    } else avisos.push('--offline: a parte da busca foi pulada');
    if (banco) {
        const ix = { banco: M.criarIndice(banco.map(M.docDeBanco)), rapida: M.criarIndice(rapidas.map(M.docDeRapida)), faq: M.criarIndice(faq.map(M.docDeFaq)) };
        const ESPERADO = [
            ['como atualizar ou instalar o certificado digital no sistema', [283]], ['instalar certificado digital', [283, 284]], ['como fazer a virada de produção de um talão de ct-e', [313]],
            ['perfil de autorização gerente de recursos talão', [287, 313]], ['para corrigir a sequência dos números dos conhecimentos e manifestos', [13, 174]], ['rejeição sefaz 539 duplicidade', [95]],
            ['como cadastrar minha empresa no sistema', [65]], ['manual de configurações iniciais e vitais para funcionamento', [204]], ['como cadastrar um veículo placa no sistema', [155]],
            ['qual o caminho para cadastro de motorista no sistema', [31, 192]], ['importação de pessoas', [276]], ['importação de cadastros de veículos', [257]],
            ['cadastrar uma tabela de preços tabela de frete', [80]], ['como criar ou editar uma regra de cálculo de frete', [74]], ['como gerar ciot', [314]], ['o que é ciot e informações sobre ciot', [57]],
            ['como configura o módulo vale pedágio vpo no sistema', [474]], ['como configurar averbação automática de um ct-e', [119]], ['como emitir um ct-e', [67]], ['como emitir um mdf-e manualmente', [68]],
            ['como emitir um contrato de frete', [70]], ['como cancelar um ct-e na sefaz', [89, 376]], ['como cancelar na sefaz um mdf-e', [377]], ['como cancelar ct-e fora do prazo para cancelamento e substituição', [147]],
            ['como encerrar mdf-e que emiti em outro sistema', [294]], ['cliente perguntou como fazer ct-e complementar de um ct-e emitido no antigo sistema', [158]],
            ['como adicionar um ct-e de terceiro ou emitido em outro sistema em uma viagem', [394]], ['como fazer vinculação de motoristas', [266]], ['como cadastrar usuários do sistema', [206]],
            ['liberar acesso a uma tela ou opção no menu para um usuário', [473]], ['gestor libera permissão ao usuário e não aparece', [123]], ['alíquota simples nacional empresa', [213]], ['o que é tac agregado', [316]],
            ['envio de cte pelo servidor de contingência', [144]], ['preciso encerrar mdfe em homologação', [586]], ['opções disponíveis para configurar dentro do talão de mdf-e', [612]],
            ['quais operadoras de crédito são compatíveis', [319]], ['como configurar o sistema para emissão de nota fiscal de serviço nfs-e', [79]], ['como enviar automaticamente o ct-e para o e-mail do cliente', [117]],
            ['visualizar dacte e damdfe quando não está averbado', [140]], ['importar xml de antigo sistema talão série diferente', [159]],
            ['não consigo emitir o cte, aparece erro de duplicidade', [95]], ['preciso colocar o certificado no sistema', [283, 284, 204]], ['como eu cancelo um conhecimento errado', [89, 376, 147, 291]],
            ['onde eu crio a série do talão', [313, 13, 612, 287]],
        ];
        let rec = 0, top1 = 0; const perdidas = [];
        ESPERADO.forEach(([q, alvo]) => { const r = M.buscar(ix.banco, q, { max: 5 }), pos = r.findIndex(x => alvo.includes(x.doc.id)); if (pos >= 0) rec++; else perdidas.push(q); if (pos === 0) top1++; });
        t('busca real: o artigo certo está entre os 5 primeiros em ≥ 92 % das perguntas (' + rec + '/' + ESPERADO.length + ')', rec / ESPERADO.length >= 0.92, 'perdidas: ' + perdidas.join(' | '));
        t('busca real: o artigo certo é o 1º em ≥ 85 % (' + top1 + '/' + ESPERADO.length + ')', top1 / ESPERADO.length >= 0.85);
        t('busca real: pergunta sem relação não acha nada forte', M.buscar(ix.banco, 'receita de bolo de chocolate com cobertura', { max: 3 }).length === 0);
        // a primeira emissão em si: cada passo, cada pergunta pronta do chat e cada botão de "erro comum" precisam achar o artigo certo
        const semArtigo = [], semBanco = [];
        R.passos.forEach(p => { const k = M.conhecimento(ix, p.buscas); if (!k.banco.length && !k.rapida.length && !k.faq.length) semArtigo.push(p.id); if (!k.banco.length) semBanco.push(p.id); });
        t('cobertura: todo passo do passo a passo acha pelo menos um artigo no banco (lacunas: ' + (semArtigo.join(', ') || 'nenhuma') + ')', semArtigo.length === 0, semArtigo.join(', '));
        if (semBanco.length) avisos.push('passos sem artigo do banco (só resposta rápida/FAQ): ' + semBanco.join(', '));
        const semChat = R.passos.filter(p => { const k = M.conhecimento(ix, [p.mentor], { banco: 4, rapida: 2, faq: 3 }, { minCobertura: 0.2 }); return !k.banco.length && !k.rapida.length && !k.faq.length; }).map(p => p.id);
        t('cobertura: a pergunta pronta do chat de cada passo acha artigos (como o chat faz) — sem artigo: ' + (semChat.join(', ') || 'nenhum'), semChat.length === 0, semChat.join(', '));
        const chips = [], semChip = [];
        R.passos.forEach(p => (p.erros || []).forEach(e => { chips.push(e); const a = M.buscar(ix.banco, e.q, { max: 1, minCobertura: 0.3 })[0] || M.buscar(ix.rapida, e.q, { max: 1, minCobertura: 0.3 })[0]; if (!a) semChip.push(p.id + ': ' + e.t); }));
        t('erros comuns: cada botão abre um artigo do banco (' + (chips.length - semChip.length) + ' de ' + chips.length + '); os outros caem direto na IA no modo erro', semChip.length === 0, semChip.join(' | '));
        if (semChip.length) avisos.push('botões de erro sem artigo no banco (vão para a IA): ' + semChip.join(' | '));
        const regSem = G.regras.filter(r => { const k = M.conhecimento(ix, r.buscas); return !(k.banco.length || k.rapida.length || k.faq.length); }).map(r => r.id);
        t('cobertura: toda regra tem artigo relacionado no banco (lacunas: ' + (regSem.join(', ') || 'nenhuma') + ')', regSem.length <= 3, regSem.join(', '));
        if (regSem.length) avisos.push('regras sem artigo relacionado no banco: ' + regSem.join(', '));
        const glSem = GL.termos.filter(x => x.buscas && x.buscas.length).filter(x => { const k = M.conhecimento(ix, x.buscas); return !(k.banco.length || k.rapida.length || k.faq.length); }).map(x => x.termo);
        if (glSem.length) avisos.push('termos do glossário cujo "saiba mais" não acha artigo: ' + glSem.join(', '));
        t('cobertura: quase todo "saiba mais" do glossário acha artigo', glSem.length <= 4, glSem.join(', '));
        t('FAQ real: itens lidos e indexados', Array.isArray(faq));
        avisos.push('base lida: ' + banco.length + ' artigos, ' + rapidas.length + ' respostas rápidas, ' + faq.length + ' item(ns) de FAQ');
    }

    console.log('\n' + ok + ' verificações ok · ' + falhas.length + ' falha(s)');
    falhas.forEach(f => console.log('  ✘ ' + f));
    avisos.forEach(a => console.log('  ℹ ' + a));
    process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('erro no teste:', e); process.exit(2); });
