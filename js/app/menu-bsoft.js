/* js/app/menu-bsoft.js — O MENU REAL do Bsoft TMS (módulos › pastas › telas) como fonte de verdade dos caminhos que a IA cita.

   Os dados ficam em config/menu-bsoft.js (texto copiado do próprio sistema, com o id de cada rotina). Este módulo:
     • lê o texto e monta a árvore (cada linha vira um caminho completo: "Transporte > Configurações > Tabelas de Preços > Tabela de Pagamento de Frete");
     • BUSCA, para cada pergunta, as telas/pastas do menu que mais combinam com ela (sem IA, instantâneo) → bloco "CAMINHOS DO MENU" do prompt;
     • liga uma rotina (o "Nome Interno" do link c.php?id=…) ao(s) caminho(s) dela no menu;
     • confere se um caminho digitado existe de verdade no menu (validarCaminho).
   Se o menu mudar, é só colar o texto novo em config/menu-bsoft.js (ver tools/capturar-menu.js e o README). */
const MenuBsoft = (() => {
    const IGNORAR_MODULOS = [/^minhas rotinas$/];   // atalhos pessoais de quem estava logado na captura: não fazem parte do menu do sistema
    let E = [], porId = new Map(), df = new Map(), modulos = [], pronto = false, erroCarga = null, vocab = new Map(), porCam = new Map(), memoCorr = new Map();

    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const STOP = new Set(('como que qual quais para com sem nao mas por mais uma uns umas isso este esta esse essa num numa meu minha meus minhas tem ter ser foi vai vou tenho posso pode quero preciso saber sobre onde ' +
        'quando porque pois tambem ainda mesmo ah the dos das nos nas aos fica ficam fico acho achar encontro encontrar localizo localizar procuro procurar abro abrir acesso acessar acessa entro entrar ' +
        'tela telas menu caminho opcao opcoes sistema fazer faco fazem consigo conseguir ver olhar mostrar ' +
        // verbos de ação: o menu tem só substantivos ("Emissão", "Cadastro"…), então o verbo não ajuda a achar a tela
        'habilitar habilito ativar ativo desativar emitir emito gerar gero criar crio alterar altero editar edito incluir inclusao ajustar ' +
        // enchimento de conversa (verbo solto, cortesia, "vencido", "eletrônico"…): nunca é nome de tela
        'lanco lanca lancar mudo mudar muda vejo vendo visualizar visualizo coloco colocar dar entre gostaria queria poderia favor urgente estou estao estamos estar tentando necessito alguem sabe sabem diga ' +
        'vencido vencida vencidos vencidas vencer venceu expirado expirou eletronico eletronica eletronicos eletronicas ' +
        'via aqui hoje ontem amanha agora conseguindo consegue conseguiu consegui ajudar ajude ajudem pra pro').split(' '));
    // Palavras que ajudam no ranking mas NÃO precisam estar na tela. GEN = verbo/ação ("cadastro", "configuração", "consulta", "importar"); SOFT = qualificador solto
    // ("tipo de…", "layout do…", "…da empresa", "…da SEFAZ", "mercadoria") — só passam a ser exigidas se a pergunta não tiver nenhuma outra palavra.
    const GEN = new Set(['cadast', 'config', 'consul', 'import', 'baixa', 'manual']);
    const SOFT = new Set(['tipo', 'layout', 'mercad', 'empres', 'sefaz', 'usuari', 'client', 'fornec', 'remete', 'destin', 'tomado', 'motori', 'condut', 'agrega', 'colabo']);
    // "palavras" que a pessoa diz e o menu escreve de outro jeito: no ranking valem menos que a palavra original (peso 0,6)
    const ALIAS = {
        cte: ['conhecimento'], conhecimento: ['cte'], ctrc: ['conhecimento', 'cte'], mdfe: ['manifesto'], mdf: ['mdfe'], manifesto: ['mdfe'], nfe: ['nota', 'fiscal'], nfse: ['nfe', 'servico'], dce: ['declaracao'],
        veiculo: ['caminhao', 'carreta', 'cavalo', 'bitrem', 'frota'], caminhao: ['veiculo'], carreta: ['veiculo'], cavalo: ['veiculo'], bitrem: ['veiculo'], rodotrem: ['veiculo'], reboque: ['veiculo'], truck: ['veiculo'], placa: ['veiculo'], frota: ['veiculo'],
        motorista: ['condutor', 'pessoas'], condutor: ['motorista', 'pessoas'], funcionario: ['pessoas'], colaborador: ['pessoas'], agregado: ['pessoas'],
        cliente: ['pessoas'], fornecedor: ['pessoas'], remetente: ['pessoas'], destinatario: ['pessoas'], tomador: ['pessoas'], transportadora: ['pessoas'], proprietario: ['pessoas'], seguradora: ['pessoas'], pessoa: ['pessoas'],
        cfop: ['operacoes', 'natureza'], natureza: ['operacoes'], imposto: ['aliquota', 'icms'], tributo: ['imposto', 'aliquota', 'icms'], icms: ['aliquota'], cobranca: ['boleto'], boleto: ['cobranca'],
        pagar: ['pagamento'], receber: ['recebimento'], pagamento: ['pagar'], recebimento: ['receber'], baixar: ['download'], baixo: ['download'], baixe: ['download'],
        parametro: ['configuracao'], configuracao: ['parametro'], relatorio: ['listagem'], usuario: ['usuarios'], permissao: ['permissoes'], email: ['mail'], estoque: ['almoxarifado'], tabela: ['preco'],
        enviar: ['envio'], enviado: ['envio'], enviada: ['envio'], serie: ['talao'], perfil: ['perfis'], perfis: ['perfil'], bancaria: ['financeira'], bancario: ['financeira'],
        gerenciador: ['gestao'], gerenciamento: ['gestao']
    };
    // singular da palavra: tira o plural (-s, -ões/-ães → -ão, -ns → -m, -ais/-eis → -al/-el): "cotações"="cotação", "ordens"="ordem", "fiscais"="fiscal"
    const singular = w => w.replace(/(?:oes|aes|aos)$/, 'ao').replace(/([aeiou])ns$/, '$1m').replace(/ais$/, 'al').replace(/eis$/, 'el').replace(/s$/, '');
    // radical = singular cortado em 6 letras (exceções: o corte juntaria palavras sem relação — "transporte" × "transparência", "manifesto" × "manifestações")
    const stemDe = w => { w = singular(w); if (/^transparen/.test(w)) return 'transpa'; if (/^manifestac/.test(w)) return 'manifestac'; return w.length >= 7 ? w.slice(0, 6) : w; };
    // o ALIAS é consultado pelo RADICAL da palavra ("cliente" → "client"), então as chaves também viram radical (antes só funcionavam as chaves com até 6 letras)
    const ALIAS_ST = {};
    Object.keys(ALIAS).forEach(k => { const s = stemDe(semAcento(k)); ALIAS_ST[s] = (ALIAS_ST[s] || []).concat(ALIAS[k]); });
    function palavras(texto) {
        return semAcento(texto).replace(/\bct-e\b/g, 'cte').replace(/\bnf-e\b/g, 'nfe').replace(/\bmdf-e\b/g, 'mdfe').replace(/\bnfs-e\b/g, 'nfse').replace(/\bdc-e\b/g, 'dce')
            // expressões inteiras que o menu escreve com outra sigla
            .replace(/\bconhecimentos? de transportes? (?:rodoviarios? )?eletronicos?\b/g, 'cte').replace(/\bmanifestos? (?:eletronicos? )?de documentos? fiscais?(?: eletronicos?)?\b/g, 'mdfe').replace(/\bmanifestos? eletronicos?\b/g, 'mdfe')
            .replace(/\bnotas? fiscais? eletronicas?\b/g, 'nfe').replace(/\bnotas? fiscais? de servicos?\b/g, 'nfse').replace(/\bcavalos? mecanicos?\b/g, 'cavalo').replace(/\bunidades? de medidas?\b/g, 'unidade')
            .replace(/\bmanifestacao d[oa]s? destinatarios?\b/g, 'manifestacao evento').replace(/\bnf\b/g, 'nota fiscal').replace(/\boc\b/g, 'ordem carregamento')
            .replace(/\be-?mails?\b/g, 'mail')
            .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    }
    const tokens = texto => palavras(texto).map(stemDe);


    // Lê o texto (uma linha por nó; 2 espaços de recuo por nível; "+ pasta", "- tela  {id}")
    function carregar(txt) {
        const novo = [], pilha = [];
        let ignorar = false;
        String(txt || '').split(/\r?\n/).forEach(l => {
            const m = /^(\s*)([+-]) (.+?)\s*$/.exec(l); if (!m) return;
            const nivel = Math.floor(m[1].length / 2), pasta = m[2] === '+';
            let nome = m[3], id = '';
            const mi = /\s{2}\{([A-Za-z0-9_.\-]+)\}$/.exec(nome);
            if (mi) { id = mi[1]; nome = nome.slice(0, mi.index).trim(); }
            if (nivel === 0) ignorar = IGNORAR_MODULOS.some(r => r.test(semAcento(nome).trim()));
            pilha.length = nivel; pilha[nivel] = nome;
            if (ignorar) return;
            const partes = pilha.slice(0, nivel + 1);
            novo.push({ caminho: partes.join(' > '), partes, nome, id, pasta, nivel, filhos: [], L: new Set(tokens(nome)), A: new Set(tokens(partes.slice(0, -1).join(' '))) });
        });
        // filhos diretos de cada pasta (para listar o conteúdo de uma pasta na resposta)
        const pai = new Map(novo.filter(e => e.pasta).map(e => [e.caminho, e]));   // (só pastas: "Ambiente > Relatórios" existe como pasta E como tela)
        novo.forEach(e => { if (e.partes.length > 1) { const p = pai.get(e.partes.slice(0, -1).join(' > ')); if (p) p.filhos.push(e.nome); } });
        // frequência de cada palavra (as comuns, como "tipos", valem menos que as raras, como "dacte")
        const freq = new Map();
        novo.forEach(e => new Set([...e.L, ...e.A]).forEach(t => freq.set(t, (freq.get(t) || 0) + 1)));
        E = novo; df = freq; porId = new Map();
        porCam = new Map(novo.map(e => [e.caminho, e]));   // caminho → item (para os atalhos de intenção e a busca de 'duas coisas')
        memoCorr = new Map(); vocab = new Map(); novo.forEach(e => palavras(e.partes.join(' ')).forEach(w => vocab.set(singular(w), stemDe(w))));   // palavras do menu no singular (para corrigir erro de digitação)
        novo.forEach(e => { if (e.id) { if (!porId.has(e.id)) porId.set(e.id, []); porId.get(e.id).push(e); } });
        modulos = novo.filter(e => e.nivel === 0).map(e => e.nome);
        pronto = novo.length > 0;
        return novo.length;
    }
    const idf = t => Math.log(1 + E.length / (1 + (df.get(t) || 0)));

    // Atalhos de INTENÇÃO: combinações que a busca por radical não resolve sozinha (a tela não tem, no nome, a palavra que a pessoa usa). Só valem se o caminho existir no menu.
    // "cadastro de cliente", "cadastrar novo motorista", "incluir fornecedor", "cliente novo" (o papel vem logo depois do verbo, com no máximo 2 palavrinhas no meio)
    const PAPEIS = '(?:clientes?|fornecedor(?:es)?|remetentes?|destinatarios?|tomador(?:es)?|motoristas?|condutor(?:es)?|proprietarios?|expedidor(?:es)?|recebedor(?:es)?|consignatarios?|funcionarios?|colaborador(?:es)?|agregados?|pessoas?)';
    const RE_PESSOA = new RegExp(String.raw`\b(?:cadastr\w*|inclu\w*|cri(?:ar|o)|registr\w*)\s+(?:(?:de|do|da|o|a|um|uma|novo|nova)\s+){0,2}${PAPEIS}\b|\b(?:novo|nova)\s+${PAPEIS}\b|\b${PAPEIS}\s+(?:novo|nova)\b`);
    const DIRETOS = [
        // "cadastro de cliente / fornecedor / motorista…": a pessoa é uma só, o papel (cliente, motorista…) é um tipo dentro dela
        { quando: q => RE_PESSOA.test(q) && !/\b(?:relatorios?|listagem|ficha|analise|grupos?|tipos?|contatos?|contas?|dependentes?|documentos?|enderecos?)\b/.test(q),
            ir: ['Pessoas > Pessoas'] },
        // "regra do CT-e / do conhecimento" (a tela chama-se só "Regras")
        { quando: q => /\bregras?\b/.test(q) && /\b(?:cte|conhecimentos?)\b/.test(q) && !/\b(?:isenc\w*|excec\w*|icms|import\w*|comiss\w*|tipos?|nfe|notas?|calcul\w*|desconto)\b/.test(q),
            ir: ['Transporte > Configurações > Regras'] },
        // série / talão (com ou sem "do CT-e")
        { quando: q => /\b(?:talao|taloes|series?)\b/.test(q) && !/\b(?:produtos?|seriais?|equipamentos?|pneus?|ferramentas?)\b/.test(q), ir: ['Transporte > Configurações > Tipos de Talões'] },
        // permissão / liberar rotina para usuário ou grupo
        { quando: q => /\b(?:permiss\w*|liber(?:ar|o|a|e))\b/.test(q) && /\b(?:usuarios?|grupos?|rotinas?|telas?|acessos?)\b/.test(q), ir: ['Ambiente > Controle de Acesso > Permissão as rotinas', 'Ambiente > Controle de Acesso > Permissões as rotinas'] },
        // "parâmetros do sistema": existem 4 telas "Parâmetros" (Ambiente, Hub, EDI, Controle de Viagens)
        { quando: q => /\bparametros?\b/.test(q) && /\bsistema\b/.test(q), ir: ['Ambiente > Administração > Parâmetros'] }
    ];
    function diretosDe(query) {
        const q = semAcento(query).replace(/\bct-e\b/g, 'cte'), out = [];
        DIRETOS.forEach(d => { if (d.quando(q)) d.ir.forEach(c => { const e = porCam.get(c); if (e && !out.some(x => x.caminho === c)) out.push({ caminho: e.caminho, id: e.id, pasta: e.pasta, filhos: e.filhos, score: 99 }); }); });
        return out;
    }
    // Erro de digitação: uma letra a mais/menos ou duas trocadas de lugar ("certifcado", "pnues"); trocar uma letra só vale em palavra longa ("custa" ≠ "custo").
    // A 1ª letra tem que ser a mesma (quase ninguém erra a 1ª; evita "estao" → "gestao").
    function quaseIgual(a, b) {
        const la = a.length, lb = b.length;
        if (Math.abs(la - lb) > 1 || a[0] !== b[0]) return false;
        if (la === lb) {
            let d = -1, n = 0;
            for (let i = 0; i < la; i++) if (a[i] !== b[i]) { if (n === 0) d = i; if (++n > 2) return false; }
            if (n === 1) return la >= 7;
            return n === 2 && a[d] === b[d + 1] && a[d + 1] === b[d];
        }
        const c = la < lb ? a : b, l = la < lb ? b : a;
        let i = 0; while (i < c.length && c[i] === l[i]) i++;
        return c.slice(i) === l.slice(i + 1);
    }
    // palavra que não existe em lugar nenhum do menu → a palavra do menu mais parecida (a mais comum, se houver empate); senão fica como está
    function corrigir(w) {
        if (w.length < 5 || w.length > 24 || /\d/.test(w)) return w;
        const s = stemDe(w);
        if (df.has(s) || ALIAS_ST[s] || GEN.has(s) || SOFT.has(s)) return w;
        if (memoCorr.has(w)) return memoCorr.get(w);
        const ws = singular(w);
        let melhor = null, mdf = -1;
        vocab.forEach((sv, v) => { if (quaseIgual(ws, v) && (df.get(sv) || 0) > mdf) { melhor = v; mdf = df.get(sv) || 0; } });
        memoCorr.set(w, melhor || w);
        return melhor || w;
    }
    // A frase pede LUGAR/AÇÃO no sistema ("onde fica…", "quero ver…", "cadastrar…")? (descrição de erro — "deu erro ao emitir…" — não conta)
    const RE_PEDIDO = /\b(?:onde|menu|caminho|opcao|encontr\w*|ach(?:ar|o)|localiz\w*|cadastr\w*|configur\w*|como (?:eu )?acess(?:o|ar)|ver|vejo|visualiz\w*|consult\w*|relatorio)\b/;

    // Telas/pastas do menu que mais combinam com a pergunta. Devolve [{ caminho, id, pasta, filhos, score }] (melhor primeiro).
    function buscar(query, o) {
        o = o || {};
        const max = o.max || 12;
        let res = buscarUma(query, max);
        // pergunta com DUAS coisas ("motorista e veículo", "usuários e permissões"): se nenhuma das 3 primeiras telas cobre as duas partes, busca cada parte e junta
        const partes = String(query || '').split(/\s+(?:e|ou)\s+|[,;]/).map(s => s.trim()).filter(s => tokens(s).length);
        if (partes.length >= 2 && partes.length <= 3) {
            const tp = partes.map(p => tokens(p));
            const toca = (e, t) => e.L.has(t) || e.A.has(t) || (ALIAS_ST[t] || []).some(a => e.L.has(stemDe(semAcento(a))));   // sinônimo só vale se estiver no NOME da tela (não numa pasta de cima)
            const cobreTodas = r => { const e = porCam.get(r.caminho); return !!e && tp.every(ts => ts.some(t => toca(e, t))); };
            if (!res.slice(0, 3).some(cobreTodas)) {
                const listas = partes.map(p => buscarUma(p, 5));
                if (listas.every(l => l.length)) {      // só junta se CADA parte achou tela (se uma parte é conversa/erro, não devolve só a outra)
                    const out = [], vistos = new Set();
                    for (let i = 0; out.length < max && listas.some(l => i < l.length); i++) {
                        listas.forEach(l => { if (i < l.length && out.length < max && !vistos.has(l[i].caminho)) { vistos.add(l[i].caminho); out.push(l[i]); } });
                    }
                    res = out;
                }
            }
        }
        // FRASE LONGA (conversa + pedido, do jeito que se escreve no chat): palavra que não existe em lugar nenhum do menu ("pediu", "amanhã", "segunda via") derrubava a busca inteira.
        // Só entra quando a busca normal não achou nada, a frase tem 4+ palavras e pede lugar/ação no sistema; aí a cobertura é medida só com as palavras que o menu conhece.
        if (!res.length && tokens(query).length >= 4 && RE_PEDIDO.test(semAcento(query))) res = buscarUma(query, Math.min(max, 6), true);
        const dir = diretosDe(query);
        if (dir.length) res = dir.concat(res.filter(r => !dir.some(d => d.caminho === r.caminho))).slice(0, max);
        return res;
    }
    function buscarUma(query, max, soConhecidas) {
        if (!pronto) return [];
        const base = palavras(query).map(w => stemDe(corrigir(w)));
        if (!base.length) return [];
        // cada palavra da pergunta vira [ela mesma (peso 1), suas "palavras parecidas" (peso 0,6)]. Palavras genéricas ("cadastro", "configuração") ajudam no ranking mas não contam para exigir cobertura.
        const alvo = base.map(t => ({ t, gen: GEN.has(t), mole: SOFT.has(t), alts: [[t, 1]].concat((ALIAS_ST[t] || []).map(a => [stemDe(semAcento(a)), 0.6])), teto: idf(t) }));
        const conhecida = a => df.has(a.t) || !!ALIAS_ST[a.t] || a.gen || a.mole;
        const exigidas = alvo.filter(a => !a.gen && (!soConhecidas || conhecida(a)));
        if (!exigidas.length) return [];                       // só palavra genérica ("cadastro", "configurações")? não há o que buscar
        const peso = a => a.mole ? 0.5 : 1;                    // qualificador solto ("tipo de…", "da empresa") vale meia palavra na conta da cobertura
        const exSet = new Set(exigidas), den = exigidas.reduce((x, a) => x + peso(a), 0);
        const minimo = soConhecidas ? Math.min(2, den) : 0;     // frase longa: a tela tem que cobrir pelo menos 2 palavras que o menu conhece (ou a única que ele conhece)
        const res = [];
        for (const e of E) {
            let s = 0, hitL = 0, cobertos = 0;
            for (const a of alvo) {
                let melhor = 0, naLabel = false, achou = false;
                for (const [t, w] of a.alts) {
                    const v = w < 1 ? w * Math.min(idf(t), a.teto) : w * idf(t);   // sinônimo nunca pontua mais que a própria palavra dita ("estoque" não pode preferir "Almoxarifados" a "Estoque")
                    if (e.L.has(t)) { melhor = Math.max(melhor, v); naLabel = true; achou = true; }
                    else if (e.A.has(t)) { melhor = Math.max(melhor, v * 0.35); achou = true; }
                }
                s += melhor; if (naLabel) hitL++;
                if (achou && exSet.has(a)) cobertos += peso(a);
            }
            if (!hitL) continue;
            if (cobertos / den < 0.6) continue;               // a tela só entra se cobrir a maior parte do que a pessoa disse (evita "achar" tela por uma palavra solta, como "NF-e")
            if (cobertos < minimo) continue;
            if (cobertos >= den - 1e-9) s *= 1.3;             // a pergunta inteira cabe neste caminho
            s *= 0.5 + 0.5 * Math.min(1, hitL / Math.max(1, e.L.size));   // nome que é só o que a pessoa disse ("Veículos") vale mais que nome com palavras a mais ("Conjuntos de Veículos")
            if (e.pasta) s *= 0.8;                         // tela vale mais que pasta
            res.push({ e, s });
        }
        res.sort((a, b) => b.s - a.s || a.e.partes.length - b.e.partes.length);
        if (!res.length) return [];
        const corte = res[0].s * 0.45;
        const vistos = new Set(), out = [];
        for (const r of res) {
            if (r.s < corte || out.length >= max) break;
            const k = r.e.caminho + '|' + r.e.id + '|' + (r.e.pasta ? 'p' : 't');   // (duas telas com o mesmo nome e ids diferentes são duas telas)
            if (vistos.has(k)) continue;
            vistos.add(k);
            out.push({ caminho: r.e.caminho, id: r.e.id, pasta: r.e.pasta, filhos: r.e.filhos, score: r.s });
        }
        return out;
    }


    // Bloco "=== CAMINHOS DO MENU ===" do prompt para esta pergunta ('' se o menu não estiver carregado)
    function blocoPrompt(query, o) {
        if (!pronto) return '';
        o = o || {};
        const achados = buscar(query, { max: o.max || 12 });
        let t = '=== CAMINHOS DO MENU (menu REAL do sistema; níveis separados por ">") ===\n';
        if (!achados.length) {
            t += '(a busca no menu não achou nenhuma tela relacionada a esta pergunta — NÃO invente caminho; use só os caminhos que aparecerem em ATALHOS E PROCEDIMENTOS, DOCUMENTOS, Primeiros passos ou TALÕES, se forem do assunto)\n';
        } else {
            achados.forEach((a, i) => {
                t += `${a.caminho}${a.pasta ? '  [pasta]' : ''}${a.id ? '  (id da rotina: ' + a.id + ')' : ''}`;
                if (a.pasta && a.filhos.length && i < 3) t += '  — contém: ' + a.filhos.slice(0, 30).join('; ') + (a.filhos.length > 30 ? '; …' : '');
                t += '\n';
            });
        }
        if (o.visaoGeral) t += `Módulos do menu: ${modulos.join(' | ')}\n`;
        return t + '\n';
    }

    // Visão geral para "como é o menu?": cada módulo com suas pastas (e quantas telas ficam direto nele)
    function estrutura() {
        if (!pronto) return '';
        return modulos.map(m => {
            const f = E.filter(e => e.nivel === 1 && e.partes[0] === m);
            const pastas = f.filter(e => e.pasta).map(e => e.nome), telas = f.length - pastas.length;
            return `${m}: ${pastas.length ? 'pastas ' + pastas.join(', ') : 'sem pastas'}${telas ? (pastas.length ? ' + ' : '; ') + telas + ' tela(s) direto no módulo' : ''}`;
        }).join('\n') + '\n';
    }

    // Caminhos da tela de uma rotina (o id do link c.php?id=…). [] se não achar.
    // (o de menos níveis primeiro — é o mais direto —, sem repetir)
    function caminhosDoId(id) {
        const l = (porId.get(String(id || '')) || []).filter(e => !e.pasta).slice().sort((a, b) => a.partes.length - b.partes.length).map(e => e.caminho);
        return l.filter((c, i) => l.indexOf(c) === i);
    }
    // Palavras-chave de um texto para comparar com o menu (mesmas regras da busca: sem acento, sem palavras vazias, ct-e/nf-e normalizados, singular/radical; sem as palavras genéricas "cadastro", "configuração"…)
    function chaves(texto) { return Array.from(new Set(tokens(texto).filter(t => !GEN.has(t)))); }

    // O caminho digitado ("A > B > C") existe no menu? Compara sem acento e sem diferença de maiúsculas. Devolve { ok, tela, correspondente }.
    function validarCaminho(texto) {
        const partes = String(texto || '').split(/\s*(?:›|»|→|->|>)\s*/).map(p => semAcento(p).replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (!partes.length) return { ok: false };
        const alvo = partes.join(' > ');
        const exato = String(texto || '').split(/\s*(?:›|»|→|->|>)\s*/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' > ');
        // o menu tem nomes que só diferem em maiúsculas ("Tabela de preços" × "Tabela de Preços"): se o texto bate letra por letra, é esse
        const e = E.find(x => x.caminho === exato) || E.find(x => x.partes.map(p => semAcento(p).replace(/\s+/g, ' ').trim()).join(' > ') === alvo);
        return e ? { ok: true, tela: !e.pasta, correspondente: e.caminho } : { ok: false };
    }

    function iniciar() {
        try {
            if (typeof BSOFT_MENU_TXT === 'string') carregar(BSOFT_MENU_TXT);
            else erroCarga = 'config/menu-bsoft.js não foi carregado';
        } catch (e) { erroCarga = e.message; console.warn('[menu] falhou ao ler o menu:', e); }
        if (!erroCarga && !pronto) erroCarga = 'o texto do menu está vazio ou fora do formato (cada linha deve começar por "+ " ou "- ")';
        if (erroCarga) console.warn('[menu] sem o menu real — a IA usa só os caminhos rápidos:', erroCarga);
        else console.log(`%c🧭 [menu] ${E.length} itens do menu real carregados (${modulos.length} módulos)`, 'color:#0369a1;font-weight:600;');
    }

    return { carregar, iniciar, buscar, blocoPrompt, estrutura, caminhosDoId, validarCaminho, tokens, chaves, pronto: () => pronto, todos: () => E.slice(), modulos: () => modulos.slice(), get erro() { return erroCarga; } };
})();
MenuBsoft.iniciar();
