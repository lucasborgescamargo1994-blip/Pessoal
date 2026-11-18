'use strict';
/* teste-simulador-local-logica.js — testa SEM navegador e SEM IA a parte do simulador LOCAL que decide as coisas (js/simulador-local/regras.js) e o encaixe dela no SimLogica original:
   termos da solução, o juiz por regras (completo / só o menu / outro assunto / genérico), a dica em 3 níveis, o prompt curto do cliente (estável de um turno para o outro,
   sem a solução, com o trecho fixo reaproveitável), a limpeza do texto do modelo (outra língua, recusa, voz de atendente, saudação repetida) e a CALIBRAÇÃO do juiz em artigos
   REAIS do banco (somente leitura): respostas completas passam, só o menu não, outro assunto e respostas genéricas nunca.
   Rode:  $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-simulador-local-logica.js | Out-String
   Sem internet use  --offline  (a calibração nos artigos reais é pulada). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.resolve(__dirname, '..', '..');
const ler = rel => fs.readFileSync(path.join(raiz, rel), 'utf8');
const offline = process.argv.includes('--offline');

const ctx = { console: { log() {}, warn() {}, info() {}, error() {} } }; ctx.window = ctx; vm.createContext(ctx);
const L = vm.runInContext(ler('js/simulador/logica.js') + '\n;SimLogica', ctx, { filename: 'js/simulador/logica.js' });
const R = vm.runInContext(ler('js/simulador-local/regras.js') + '\n;SimLocalRegras', ctx, { filename: 'js/simulador-local/regras.js' });

let ok = 0; const falhas = [], avisos = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe !== undefined ? ' → ' + String(detalhe).slice(0, 300) : '')); };
const eq = (nome, a, b) => t(nome, JSON.stringify(a) === JSON.stringify(b), 'veio ' + JSON.stringify(a) + ' · esperado ' + JSON.stringify(b));
const S = texto => ({ de: 'suporte', texto }), C = texto => ({ de: 'cliente', texto });

(async () => {
    // ═════════ encaixe com o simulador original ═════════
    t('a frase final do cliente é a mesma do simulador original', R.FRASE_FINAL === L.FRASE_FINAL, R.FRASE_FINAL + ' × ' + L.FRASE_FINAL);
    eq('juiz: o texto que as regras devolvem é entendido por SimLogica.interpretarJuiz (aprovado)', L.interpretarJuiz(R.vereditoJson({ ok: true, falta: '' })), { ok: true, falta: '' });
    eq('juiz: …e reprovado, com o que falta', L.interpretarJuiz(R.vereditoJson({ ok: false, falta: 'ainda não apareceu: «x»' })), { ok: false, falta: 'ainda não apareceu: «x»' });
    eq('cliente: "[ESTADO: RESOLVIDO]" + frase final vira RESOLVIDO', L.interpretarCliente('[ESTADO: RESOLVIDO]\n' + R.FRASE_FINAL), { estado: 'RESOLVIDO', mensagem: L.FRASE_FINAL });
    eq('cliente: "[ESTADO: CONTINUA]" + fala continua', L.interpretarCliente('[ESTADO: CONTINUA]\nNão achei esse botão.'), { estado: 'CONTINUA', mensagem: 'Não achei esse botão.' });

    // ═════════ termos da solução ═════════
    eq('radicais: sem acento, 5 letras, sem palavras vazias', R.radicais('Acesse o menu Emissão e clique em Visualizar'), ['emiss', 'visua']);
    t('radicais: "CT-e", "MDF-e" e "NF-e" viram termos (siglas curtas valem)', ['cte', 'mdfe', 'nfe'].every(s => R.radicais('CT-e, MDF-e e NF-e').includes(s)), JSON.stringify(R.radicais('CT-e, MDF-e e NF-e')));
    t('radicais: siglas como KM e UF valem; "de", "o", "a" não', R.radicais('KM da UF').join() === 'km,uf', R.radicais('KM da UF').join());
    t('radicais: emitir ≈ emitido (mesmo radical)', R.radicais('emitir')[0] === R.radicais('emitido')[0]);
    const caso = { id: 1, titulo: 'Como configurar protesto para emissão dos boletos?', categoria: 'Financeiro', caminho_menu: '', conteudo: 'Acesse no menu Financeiro/Configurações/Contas Financeiras, seleciona o banco desejado e clica em Visualizar. Vai na guia Formas de Pagamento, clica em editar a opção de boleto e preenche os campos de protesto: dias para protesto e tipo de protesto. Salve.' };
    const ess = R.essenciais(caso).map(x => x.palavra);
    t('essenciais: vêm do começo da solução (caminho e ação)', ['financeiro', 'contas', 'guia', 'formas', 'pagamento', 'editar'].every(p => ess.includes(p)), ess.join(','));
    t('essenciais: o que já está na dúvida do cliente (título) não conta', !ess.includes('protesto') && !ess.includes('emissao'), ess.join(','));
    t('essenciais: o caminho do menu (coluna caminho_menu) entra', R.essenciais(Object.assign({}, caso, { caminho_menu: 'Fiscal > Parametrizações' })).map(x => x.palavra).includes('parametrizacoes'));
    const longa = Object.assign({}, caso, { conteudo: 'Vai em Financeiro e salva. ' + ' blablabla'.repeat(200) + ' tokenfinalraro' });
    t('essenciais: só o começo da solução vale (o fim de um texto enorme não)', !R.essenciais(longa).map(x => x.palavra).includes('tokenfinalraro'));
    t('essenciais: solução vazia → nenhum termo (e o juiz nunca aprova)', R.essenciais({ titulo: 'x', conteudo: '' }).length === 0 && R.veredito({ titulo: 'x', conteudo: '' }, [S('qualquer coisa longa aqui')], 'botao').ok === false);

    // ═════════ o juiz por regras ═════════
    const completo = [C('Como configuro o protesto?'), S('Vai em Financeiro, Configurações e Contas Financeiras. Seleciona o banco e clica em Visualizar.'), C('Achei.'), S('Agora na guia Formas de Pagamento edita a opção de boleto e preenche os dias de protesto e o tipo de protesto, depois salva.')];
    const soMenu = completo.slice(0, 2);
    const v1 = R.veredito(caso, completo, 'auto'), v2 = R.veredito(caso, soMenu, 'auto'), v2b = R.veredito(caso, soMenu, 'botao');
    t('juiz: orientação completa (em duas falas) → aprovada', v1.ok && v1.falta === '', JSON.stringify(v1));
    t('juiz: só o caminho do menu, sem a ação → NÃO aprovada (nem pelo botão)', !v2.ok && !v2b.ok, JSON.stringify(v2));
    t('juiz: o que falta aponta para a ação (2ª metade)', /formas|pagamento|editar|preenche|dias|tipo|salve/.test(v2.falta), v2.falta);
    t('juiz: resposta genérica ("reinicia o computador…") → não aprovada', !R.veredito(caso, [C('x'), S('Reinicia o computador e tenta de novo, qualquer coisa me avisa.')], 'botao').ok);
    t('juiz: resposta de OUTRO assunto → não aprovada', !R.veredito(caso, [C('x'), S('Para emitir o CT-e abra o menu Transporte, clique em Novo e informe o remetente e o destinatário da carga.')], 'botao').ok);
    t('juiz: ninguém do suporte falou ainda → não aprovada', !R.veredito(caso, [C('Oi, preciso de ajuda')], 'botao').ok && !R.veredito(caso, [], 'botao').ok);
    t('juiz: só as falas do SUPORTE contam (o cliente repetir os termos não adianta)', !R.veredito(caso, [C('Financeiro Contas Financeiras banco Visualizar guia Formas Pagamento editar boleto dias tipo salve'), S('Ok, entendi o seu caso, vou te ajudar com isso agora mesmo.')], 'botao').ok);
    // o botão "Já orientei tudo" é mais tolerante que o cliente decidir sozinho: um texto que cobre ~33% passa só no botão
    const parcial = [S('Vai em Financeiro e Contas Financeiras, depois na guia Formas de Pagamento, edita o boleto e preenche.')];
    const vp = { auto: R.veredito(caso, parcial, 'auto'), botao: R.veredito(caso, parcial, 'botao') };
    t('juiz: o botão aprova com menos cobertura que o cliente sozinho (modo "botao" ≥ "auto")', vp.botao.cob === vp.auto.cob && R.LIM.botao < R.LIM.auto && (!vp.auto.ok || vp.botao.ok), JSON.stringify(vp));
    t('juiz: cobertura é um número de 0 a 1 e vem com os totais', v1.cob > 0 && v1.cob <= 1 && v1.total > 0 && v1.achados > 0 && v1.ini >= 0 && v1.fim >= 0, JSON.stringify(v1));
    const mini = { titulo: 'Como integrar a qualp', conteudo: 'É necessário adquirir o módulo. Como ele você consegue já na emissão do Ct-e roteirizar o trajeto.' };
    t('juiz: solução curta (poucos termos) também se resolve — e uma resposta que não diz nada, não', R.veredito(mini, [S('Você precisa adquirir o módulo para roteirizar o trajeto na emissão do CT-e.')], 'auto').ok && !R.veredito(mini, [S('Vou verificar com a equipe e te retorno.')], 'botao').ok, JSON.stringify(R.veredito(mini, [S('Você precisa adquirir o módulo para roteirizar o trajeto na emissão do CT-e.')], 'auto')));

    // ═════════ dica em 3 níveis ═════════
    const d1 = R.dica(caso, [C('x')], 1), d2 = R.dica(caso, [C('x')], 2), d3 = R.dica(caso, [C('x')], 3);
    t('dica 1: cita a área (categoria) e manda investigar', /Financeiro/.test(d1) && /Dica:/.test(d1) && /tela/.test(d1), d1);
    t('dica 2: sem caminho do menu, orienta a pedir a descrição da tela; com caminho, cita o 1º item', !/«/.test(d2) && /Fiscal/.test(R.dica(Object.assign({}, caso, { caminho_menu: 'Fiscal > Parametrizações' }), [], 2)), d2);
    t('dica 3: cita termos que o suporte AINDA não disse (e não o que já disse)', /«[^»]+»/.test(d3) && !/«financeiro»/i.test(R.dica(caso, [S('Vai em Financeiro, contas, banco, visualizar')], 3)) , d3 + ' | ' + R.dica(caso, [S('Vai em Financeiro, contas, banco, visualizar')], 3));
    t('dicas: as 3 são diferentes entre si e curtas', new Set([d1, d2, d3]).size === 3 && [d1, d2, d3].every(d => d.length < 220), [d1.length, d2.length, d3.length].join(','));
    t('dica nenhuma entrega a solução inteira (nenhuma tem mais de 2 termos entre « »)', [d1, d2, d3].every(d => (d.match(/«/g) || []).length <= 2));

    // ═════════ o prompt do cliente ═════════
    const hist = [C('Oi, não consigo configurar o protesto nos boletos.'), S('Oi! Me conta o que aparece na tela.'), C('Não aparece nada de protesto.'), S('Vai na guia Formas de Pagamento.')];
    const m = R.mensagens(caso, 'leigo', hist, '');
    eq('prompt: papéis na ordem (system, pedido de abertura, cliente=assistant, suporte=user…)', m.map(x => x.role), ['system', 'user', 'assistant', 'user', 'assistant', 'user']);
    t('prompt: o sistema leva o título do caso e o jeito do cliente', m[0].content.includes('Como configurar protesto para emissão dos boletos?') && /pouco jeito com sistema/.test(m[0].content));
    t('prompt: a fala do suporte vai como veio (sem o rótulo "Atendente:", que o modelo pequeno imitava) e a abertura é uma saudação natural do suporte', m[3].content === 'Oi! Me conta o que aparece na tela.' && m[1].content === R.ABERTURA_DO_SUPORTE && !/Atendente:/.test(m.map(x => x.content).join('\n')), m[3].content);
    t('prompt: o cliente tem um nome fixo por caso (primeira pessoa; evita "[Nome]")', /Você é [A-ZÁ-Ú][a-zá-ú]+\. Seu problema:/.test(m[0].content) && R.nomeDoCaso(caso) === R.nomeDoCaso(caso) && R.nomeDoCaso({ id: 1 }) !== R.nomeDoCaso({ id: 2 }));
    t('prompt: a SOLUÇÃO não vai para o modelo (nem uma frase dela)', !m.map(x => x.content).join('\n').includes('preenche os campos de protesto') && !m[0].content.includes('Contas Financeiras'));
    t('prompt: curto (o sistema tem menos de 1.200 caracteres)', m[0].content.length < 1200, m[0].content.length);
    // estável: o prompt do turno N+1 começa exatamente pelo prompt do turno N + a resposta (senão o servidor releria tudo a cada turno)
    const turno1 = R.mensagens(caso, 'normal', hist.slice(0, 2), ''), turno2 = R.mensagens(caso, 'normal', hist.slice(0, 4), '');
    t('prompt estável: o turno seguinte só ACRESCENTA ao anterior (cache de prefixo)', JSON.stringify(turno2.slice(0, turno1.length)) === JSON.stringify(turno1), 'primeira diferença na mensagem ' + turno1.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(turno2[i])));
    const comNota = R.mensagens(caso, 'normal', hist, 'Responda ao que o atendente disse');      // (hist tem DUAS falas do suporte: a nota só pode ir na última)
    t('prompt: o aviso interno só vai na ÚLTIMA fala do suporte', comNota[comNota.length - 1].content.includes('Responda ao que o atendente disse') && !comNota.slice(0, -1).some(x => x.content.includes('Responda ao que o atendente')));
    t('prompt: sem fala do suporte ainda → só o pedido de abertura', R.mensagens(caso, 'normal', [], '').length === 2);
    t('aviso do eco vira UMA frase curta; outros avisos não entram', R.notaCurta('sua resposta anterior não respondeu ao suporte (devolveu a pergunta dele…').length < 100 && R.notaCurta('a orientação do suporte AINDA NÃO resolve') === '' && R.notaCurta('') === '');
    // conversa muito longa: continua cabendo
    const longaH = []; for (let i = 0; i < 40; i++) { longaH.push(C('fala do cliente número ' + i + ' ' + 'x'.repeat(60))); longaH.push(S('fala do suporte número ' + i + ' ' + 'y'.repeat(120))); }
    const ml = R.mensagens(caso, 'normal', longaH.slice(0, -1), '');
    t('conversa longa: o histórico é cortado, a abertura e a última fala ficam', ml.length < 2 + longaH.length && ml[2].content.includes('número 0') && ml[ml.length - 1].content.includes('número 39') && ml.slice(2).reduce((s, x) => s + x.content.length, 0) < 4200, ml.length + ' mensagens');
    // aquecimento: o trecho fixo tem que ser exatamente o começo do prompt real (senão não adianta ler antes)
    const aq = R.mensagensAquecimento();
    t('aquecimento: o sistema do aquecimento é o COMEÇO do sistema de qualquer caso e perfil', Object.keys(R.PERFIS).every(p => R.sistema(caso, p).startsWith(aq[0].content)) && R.sistema({ titulo: 'Qualquer outro título' }, 'normal').startsWith(aq[0].content));
    t('aquecimento: a abertura do suporte é a mesma do prompt real', aq[1].content === m[1].content && aq.length === 2);

    // ═════════ limpeza do texto do modelo ═════════
    const lf = (b, o) => R.limparFala(b, o);
    eq('fala: tira "Cliente:" e aspas', lf('"Cliente: Oi, não consigo emitir."', { abertura: true }), 'Oi, não consigo emitir.');
    eq('fala: o modelo escreveu o diálogo inteiro → fica só a 1ª fala do cliente', lf('Cliente: Não achei o botão.\nAtendente: Veja no menu.\nCliente: Obrigado', { abertura: true }), 'Não achei o botão.');
    eq('fala: primeiro parágrafo só', lf('Não aparece nada.\n\nEspero ter ajudado!'), 'Não aparece nada.');
    eq('fala: tira etiqueta [ESTADO] e negrito', lf('[ESTADO: CONTINUA]\n**Não** achei'), 'Não achei');
    eq('fala: saudação repetida é cortada (fora da abertura)', lf('Olá! Estou tentando mas não aparece.'), 'Estou tentando mas não aparece.');
    eq('fala: …mas na abertura ela fica', lf('Olá! Estou com um problema no sistema.', { abertura: true }), 'Olá! Estou com um problema no sistema.');
    eq('fala: "Oi, não achei" mantém o conteúdo (só a saudação sai)', lf('Oi, não achei esse botão.'), 'Não achei esse botão.');
    eq('fala: conselho de atendente é descartado ("Você pode precisar verificar…")', lf('Quando tento emitir não aparece o campo. Você pode precisar verificar se está preenchido.', { abertura: true }), 'Quando tento emitir não aparece o campo.');
    eq('fala: "Tente fechar e abrir" (imperativo de atendente) é descartado', lf('Estou tentando fechar o sistema. Tente fechar novamente.'), 'Estou tentando fechar o sistema.');
    eq('fala: pedido de cliente ("Você pode me explicar…?") fica', lf('Você pode me explicar onde fica isso?'), 'Você pode me explicar onde fica isso?');
    eq('fala: "posso ajudar" (voz de atendente) → inútil', lf('Claro! Como posso ajudar você hoje?', { abertura: true }), 'Claro!');
    t('fala: narração em 3ª pessoa ("O atendente abriu o chat. O cliente…"), "[Nome]" literal e "como assistente" → inútil', lf('O atendente abriu o chat. O cliente está com problemas no cadastro.', { abertura: true }) === '' && lf('Olá, sou o cliente [Nome]. Preciso de ajuda.', { abertura: true }) === '' && lf('Peço desculpas, mas como uma assistente eu não tenho acesso à tela.') === '' && lf('O atendente: Tenta fechar o sistema.') === '');
    t('fala: RECUSA do modelo ("Desculpe, mas não posso atender a esse pedido.") → inútil', lf('Desculpe, mas não posso atender a esse pedido.', { abertura: true }) === '' && lf('Sinto muito, não posso ajudar com isso.') === '');
    t('fala: texto em inglês ou em outra escrita → inútil', lf('Hello, how can I help you with the problem today?') === '' && lf('我无法发送这个文件') === '' && lf('Привет, у меня проблема') === '');
    t('fala: vazio ou 1 letra → inútil', lf('') === '' && lf(null) === '' && lf('  \n ') === '' && lf('a') === '');
    t('fala: no máximo 3 frases e 260 caracteres', lf('Um. Dois. Três. Quatro. Cinco.', { abertura: true }).split('.').filter(Boolean).length <= 3 && lf('palavra '.repeat(80), { abertura: true }).length <= 262);
    t('fala reserva: abertura usa o título; depois, um pedido para explicar de novo', /preciso de ajuda: como configurar protesto/.test(R.falaReserva(caso, [])) && /explicar/.test(R.falaReserva(caso, hist)));

    // ═════════ calibração do juiz em artigos reais (somente leitura) ═════════
    if (!offline) {
        let banco = null;
        try {
            const cfg = vm.runInNewContext(ler('config/app-config.js').replace('window.BSOFT_CONFIG', 'var C') + ';C', {});
            banco = [];
            for (let de = 0; ; de += 1000) {
                const r = await fetch(cfg.supabaseUrl + '/rest/v1/BancoDados?select=id,titulo,conteudo,como_emitir,categoria,caminho_menu', { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, Range: de + '-' + (de + 999), 'Range-Unit': 'items' } });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const l = await r.json(); banco = banco.concat(l); if (l.length < 1000) break;
            }
        } catch (e) { avisos.push('sem acesso ao banco (' + e.message + '): a calibração nos artigos reais foi pulada'); banco = null; }
        if (banco) {
            const bons = banco.filter(r => r.titulo && r.conteudo && String(r.conteudo).trim().length >= 200);
            let seed = 4242; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
            const amostra = bons.slice().sort(() => rnd() - 0.5).slice(0, 200);
            const frases = x => String(x).replace(/\s+/g, ' ').split(/(?<=[.;:])\s+/).filter(Boolean);
            const GEN = ['Reinicie o sistema e tente de novo. Se continuar, me avise que eu verifico melhor.', 'Veja no manual do sistema, deve ter essa informação lá. Qualquer dúvida me chame.', 'Vou verificar isso com a equipe técnica e retorno em breve, tudo bem?', 'Limpa o cache do navegador e faz o login de novo, por favor.'];
            const taxa = { A: 0, B: 0, C: 0, D: 0, E: 0 };
            amostra.forEach((c, i) => {
                const parafrase = String(c.conteudo).slice(0, 700).replace(/\s+/g, ' ').split(' ').filter(() => rnd() > 0.30).join(' ');      // resposta completa com ~30% das palavras trocadas/omitidas
                const fr = frases(c.conteudo), meio = Math.max(1, Math.ceil(fr.length / 2));
                const textos = { A: parafrase, B: fr.slice(0, meio).join(' ').slice(0, 260), C: fr.slice(meio).join(' ').slice(0, 260) || fr.slice(-1).join(' '), D: String(amostra[(i + 9) % amostra.length].conteudo).slice(0, 350), E: GEN[i % GEN.length] };
                Object.keys(textos).forEach(k => { if (R.veredito(c, [C('x'), S(textos[k])], 'auto').ok) taxa[k]++; });
            });
            const pct = k => Math.round(100 * taxa[k] / amostra.length);
            t('calibração (200 artigos reais): resposta COMPLETA com outras palavras → aprovada (≥ 95%)', pct('A') >= 95, pct('A') + '%');
            t('calibração: só o 1º pedaço (caminho) ou só o 2º (ação) → aprovada em menos da metade das vezes', pct('B') < 50 && pct('C') < 50, 'B ' + pct('B') + '% · C ' + pct('C') + '%');
            t('calibração: resposta de OUTRO assunto → praticamente nunca aprovada (≤ 3%)', pct('D') <= 3, pct('D') + '%');
            t('calibração: resposta GENÉRICA → nunca aprovada', pct('E') === 0, pct('E') + '%');
            const semTermos = bons.filter(r => R.essenciais(r).length === 0).length;
            t('todo artigo com solução tem termos essenciais para conferir (≥ 99%)', semTermos / bons.length <= 0.01, semTermos + ' de ' + bons.length + ' sem termos');
            const maior = Math.max.apply(null, bons.map(r => R.sistema(r, 'leigo').length));
            t('o prompt do sistema continua curto em TODOS os artigos reais (< 1.300 caracteres)', maior < 1300, 'maior ' + maior);
            avisos.push('calibração: completa ' + pct('A') + '% · só caminho ' + pct('B') + '% · só ação ' + pct('C') + '% · outro assunto ' + pct('D') + '% · genérica ' + pct('E') + '% (aprovações do modo automático, ' + amostra.length + ' artigos de ' + banco.length + ')');
        }
    } else avisos.push('--offline: a calibração nos artigos reais foi pulada');

    console.log('\n' + ok + ' verificações ok · ' + falhas.length + ' falha(s)');
    falhas.forEach(f => console.log('  ✘ ' + f));
    avisos.forEach(a => console.log('  ℹ ' + a));
    process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('erro no teste:', e); process.exit(2); });
