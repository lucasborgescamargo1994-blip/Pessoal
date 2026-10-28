/* js/app/prerequisitos.js — "Pré-requisito primeiro": quando o que a pessoa pergunta DEPENDE de um parâmetro ou de uma funcionalidade
   (ex.: "é possível vincular CT-es de filiais diferentes ao mesmo contrato de frete?" só funciona com o parâmetro "Pode criar CF com
   documentos de talões diferentes?" habilitado), a resposta começa por ele e só depois traz o passo a passo.
   Só lógica, sem tela (por isso dá para testar em Node): a busca dos parâmetros/funcionalidades da pergunta (BM25 com radicais, nome interno
   separado por maiúsculas e sinônimos de domínio), a ligação dos artigos achados aos parâmetros que eles citam, e os textos do prompt.
   Quem usa: handleChat (js/app/chat.js). A tabela de Parâmetros/Funcionalidades vem de dadosParametros/dadosFuncionalidades (js/app/dados.js). */
const Prereq = (function () {
    const CAMINHOS = {
        parametros: 'Ambiente > Administração > Parâmetros',
        funcionalidades: 'Ambiente > Controle de Acesso > Funcionalidades',
        permissoes: 'Opções do Sistema > Atualizar Permissões',
    };
    const MAX_PARAMETROS = 5, MAX_FUNCIONALIDADES = 5, MAX_DESCRICAO = 700;

    const nrm = t => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    // ── pergunta do tipo "é possível… / como habilito… / não aparece…" (a resposta costuma depender de um parâmetro ou funcionalidade) ──
    const VERBOS_CONFIG = '(?:habilit|ativ|desativ|desabilit|liber|permit|bloque|desbloque|configur|parametriz|obrig|torn|defin|alter|mud|troc|padroniz|marc|desmarc|ocult|mostr|exib|esconde|impe[dr]|restring|limit|trav)\\w*';
    const RE_CONDICAO = [
        /\b(?:e|eh) possivel\b/, /\bda (?:pra|para) (?:\w+ ){0,3}\w+/, /\btem (?:como|jeito|opcao|forma)\b/, /\b(?:posso|podem?|consigo|conseguir|permite|permitir|deixa|deixar|libera|liberar)\b/,
        new RegExp('\\bcomo (?:eu |que |a gente )?(?:faco (?:pra|para) |fazer (?:pra|para) |posso |consigo |da (?:pra|para) )?' + VERBOS_CONFIG),
        new RegExp('\\bonde (?:eu )?' + VERBOS_CONFIG),
        /\bnao (?:aparece|aparecem|consigo|deixa|permite|mostra|exibe|libera|habilita|vejo|encontro|esta aparecendo|esta liberando|funciona a opcao)\b/,
        /\bpor ?que (?:o sistema |a tela |o campo |a opcao |eu )?(?:nao|sempre|so|fica|vem|esta|nunca)\b/,
        /\b(?:sumiu|sumiram|desapareceu|bloquead\w*|desabilitad\w*|inativ\w*|travad\w*|acinzentad\w*|cinza|oculto|escondid\w*)\b/,
        /\bsem (?:a )?(?:opcao|permissao|acesso)\b/, /\b(?:falta|faltando) (?:a )?(?:opcao|permissao|funcionalidade|parametro)\b/,
        /\b(?:parametro|funcionalidade)s?\b/,
    ];
    function ehPerguntaDeCondicao(query) {
        const q = nrm(query);
        return q.length > 5 && RE_CONDICAO.some(r => r.test(q));
    }

    // ── busca ──
    const STOP = new Set('de do da dos das que para com sem uma uns umas por como mas mais ser sao esta esse essa isso este tem ter nos nas aos ele ela meu minha seu sua quando onde porque pois tambem ainda mesmo todo toda todos todas fazer fazem quero preciso sistema bsoft tms nao sim em no na um os as ou ao ha foi vai vou tenho dar pra pro ate sobre entre depois antes qual quais'.split(' '));
    // Grupos de palavras que significam o mesmo no dia a dia do suporte: quem pergunta por "filiais" está falando do que a tabela chama de "empresas/agências/talões".
    // Cada palavra da pergunta também procura as outras do grupo, com peso menor (PESO_SINONIMO).
    const PESO_SINONIMO = 0.4;
    const GRUPOS = [
        ['filial', 'empresa', 'agencia', 'unidade', 'matriz'],
        ['cf', 'contrato frete', 'contrato'],
        ['vincular', 'associar', 'ligar', 'juntar', 'relacionar', 'amarrar', 'anexar'],
        ['liberar', 'habilitar', 'permitir', 'ativar', 'permite', 'habilita', 'libera'],
        ['aparece', 'exibir', 'mostrar', 'exibe', 'mostra', 'visivel', 'sumiu', 'oculto', 'esconder'],
        ['obrigatorio', 'obrigar', 'obriga', 'exigir', 'exige'],
        ['bloquear', 'bloqueia', 'impedir', 'impede', 'travar', 'trava'],
        ['usuario', 'perfil', 'grupo', 'permissao', 'acesso'],
        ['cancelar', 'estornar', 'desfazer', 'excluir', 'apagar', 'deletar', 'remover'],
        ['talao', 'serie', 'numeracao'],
        ['nota', 'nf', 'nfe', 'documento', 'doc'],
        ['conhecimento', 'cte', 'ct e'],
        ['manifesto', 'mdfe', 'mdf e'],
        ['pagador', 'tomador'],
        ['motorista', 'condutor'],
        ['veiculo', 'caminhao', 'placa', 'cavalo', 'carreta'],
        ['email', 'e mail', 'correio'],
        ['imprimir', 'impressao', 'relatorio', 'pdf', 'dacte', 'espelho'],
        ['seguro', 'averbacao', 'averbar', 'apolice'],
        ['frete', 'transporte'],
        ['valor', 'preco', 'tarifa', 'custo'],
    ];
    function radical(w) {
        if (w.length <= 3) return w;
        w = w.replace(/oes$/, 'ao').replace(/aes$/, 'ao').replace(/ais$/, 'al').replace(/eis$/, 'el').replace(/s$/, '');
        return w.length > 5 ? w.slice(0, 5) : w;
    }
    function tokens(txt) {
        return nrm(txt).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !STOP.has(w) && (w.length > 2 || w === 'cf' || w === 'nf')).map(radical);
    }
    // (o código NÃO é indexado: um número qualquer da pergunta — "1000 notas" — casaria com o item de mesmo código; quem digita "parâmetro 1117" é tratado em citadosNaPergunta)
    const tokensDoc = item => tokens(String(item['Descrição'] || '') + ' ' + String(item['Nome Interno'] || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' '));
    const idxGrupo = new Map(), gruposRad = GRUPOS.map(g => Array.from(new Set(g.flatMap(f => tokens(f)))));
    GRUPOS.forEach((g, i) => g.forEach(f => tokens(f).forEach(r => { if (!idxGrupo.has(r)) idxGrupo.set(r, new Set()); idxGrupo.get(r).add(i); })));

    function indexar(lista) {
        const docs = lista.map(tokensDoc), df = new Map();
        docs.forEach(d => new Set(d).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
        const tf = docs.map(d => { const m = new Map(); d.forEach(t => m.set(t, (m.get(t) || 0) + 1)); return m; });
        return { lista, docs, df, tf, N: docs.length, avg: docs.reduce((s, d) => s + d.length, 0) / Math.max(1, docs.length) };
    }
    const idfDe = (ix, t) => { const d = ix.df.get(t) || 0; return Math.log(1 + (ix.N - d + 0.5) / (d + 0.5)); };

    // opções: topN, k1/b (BM25), minHit = mínimo de palavras DA PERGUNTA que precisam aparecer no item, relMin = fração do melhor escore,
    // simMin = cobertura mínima (0–1) do peso das palavras da pergunta que o item precisa ter, sinonimos = usa os GRUPOS acima
    const PADRAO = { topN: MAX_PARAMETROS, k1: 1.2, b: 0.6, minHit: 2, relMin: 0, simMin: 0, raroDf: 0, sinonimos: true };
    function buscarEm(ix, query, opt) {
        opt = Object.assign({}, PADRAO, opt || {});
        const q = Array.from(new Set(tokens(query)));
        if (!q.length || !ix || !ix.N) return [];
        const peso = new Map(); q.forEach(t => peso.set(t, 1));
        if (opt.sinonimos) q.forEach(t => (idxGrupo.get(t) || []).forEach(g => gruposRad[g].forEach(s => { if (!peso.has(s)) peso.set(s, PESO_SINONIMO); })));
        const idfQ = q.reduce((s, t) => s + idfDe(ix, t), 0) || 1;
        const exige = Math.min(opt.minHit, q.length);
        const achados = [];
        ix.lista.forEach((item, i) => {
            const len = ix.docs[i].length || 1; let score = 0, hit = 0, cobre = 0, raro = false;
            peso.forEach((w, t) => {
                const f = ix.tf[i].get(t); if (!f) return;
                const idf = idfDe(ix, t);
                score += w * idf * (f * (opt.k1 + 1)) / (f + opt.k1 * (1 - opt.b + opt.b * len / ix.avg));
                if (w === 1) { hit++; cobre += idf; if ((ix.df.get(t) || 0) <= opt.raroDf) raro = true; }
            });
            // pelo menos 2 palavras da pergunta no item — ou UMA só, se ela for rara na tabela (ex.: "sinalização" ↔ "Utiliza sinalizadores no conhecimento?")
            if (score > 0 && (hit >= exige || (hit >= 1 && raro))) achados.push({ item, score, hit, sim: Math.min(1, cobre / idfQ) });
        });
        achados.sort((a, b) => b.score - a.score);
        const topo = achados.length ? achados[0].score : 0;
        return achados.filter(x => x.score >= topo * opt.relMin && x.sim >= opt.simMin).slice(0, opt.topN);
    }
    // índice guardado enquanto a tabela for a mesma (recria quando a lista é recarregada)
    const _cache = new WeakMap();
    function indice(lista) {
        let ix = _cache.get(lista);
        if (!ix || ix.N !== lista.length) { ix = indexar(lista); _cache.set(lista, ix); }
        return ix;
    }
    // Em pergunta do tipo "é possível / como habilito / não aparece" uma única palavra RARA da tabela já basta para o item entrar (medido: +3,6 pontos de acerto
    // por +0,6 item de ruído); nas demais, o item precisa ter pelo menos 2 palavras da pergunta.
    const RARO_DF_CONDICAO = 15;
    function buscar(query, parametros, funcionalidades, opt) {
        const o = Object.assign({ raroDf: ehPerguntaDeCondicao(query) ? RARO_DF_CONDICAO : 0 }, opt || {});
        return combinar(citadosNaPergunta(query, parametros, funcionalidades), {
            parametros: parametros && parametros.length ? buscarEm(indice(parametros), query, Object.assign({ topN: MAX_PARAMETROS }, o)) : [],
            funcionalidades: funcionalidades && funcionalidades.length ? buscarEm(indice(funcionalidades), query, Object.assign({ topN: MAX_FUNCIONALIDADES }, o)) : [],
        });
    }

    // Quem digita o número ("para que serve o parâmetro 1117?") pede esse item: ele vai na frente. (O número só serve para ACHAR o item — a IA nunca o recebe nem o escreve.)
    function citadosNaPergunta(query, parametros, funcionalidades) {
        const out = { parametros: [], funcionalidades: [] }, q = String(query || '');
        let m;
        RE_COD_PARAM.lastIndex = 0;
        while ((m = RE_COD_PARAM.exec(q))) { const p = (parametros || []).find(x => String(x['Código']) === m[1]); if (p && !out.parametros.some(y => y.item === p)) out.parametros.push({ item: p, sim: 1, daPergunta: true }); }
        RE_COD_FUNC.lastIndex = 0;
        while ((m = RE_COD_FUNC.exec(q))) { const f = (funcionalidades || []).find(x => String(x['Código']) === m[1]); if (f && !out.funcionalidades.some(y => y.item === f)) out.funcionalidades.push({ item: f, sim: 1, daPergunta: true }); }
        return out;
    }

    // ── ligação dos artigos achados aos parâmetros/funcionalidades que eles citam (nome interno, "parâmetro 268", "parâmetro “Usa pagamento em comboio”") ──
    const RE_NOME = /\b[a-z][A-Za-z0-9]*_[A-Za-z0-9_]{3,}\b/g;
    // (sem \s* seguidos de grupos opcionais: evita backtracking quadrático em texto longo com muitos espaços)
    const RE_COD_PARAM = /par[aâ]m(?:etros?|\.)?[\s:\-–]*(?:n[ºo°.]*[\s:\-–]*)?(?:c[oó]d(?:igo|\.)?[\s:.\-–]*)?(\d{2,4})\b/gi;
    const RE_COD_FUNC = /funcionalidades?[\s:\-–]*(?:n[ºo°.]*[\s:\-–]*)?(?:c[oó]d(?:igo|\.)?[\s:.\-–]*)?(\d{1,4})\b/gi;
    const RE_TITULO = /par[aâ]metros?\s*[:\-–]?\s*[“"'‘]([^”"'’\n]{8,90})[”"'’]/gi;
    function citadosNosArtigos(artigos, parametros, funcionalidades) {
        const out = { parametros: [], funcionalidades: [] };
        if (!artigos || !artigos.length) return out;
        const porNome = new Map(), porCodigo = new Map(), porCodigoF = new Map();
        (parametros || []).forEach(p => { const n = String(p['Nome Interno'] || '').trim().toLowerCase(); if (n.length >= 6) porNome.set(n, p); porCodigo.set(String(p['Código']), p); });
        (funcionalidades || []).forEach(f => porCodigoF.set(String(f['Código']), f));
        const vistosP = new Set(), vistosF = new Set();
        const addP = (p, art) => { const k = String(p['Código']); if (!vistosP.has(k)) { vistosP.add(k); out.parametros.push({ item: p, sim: 1, citado: art }); } };
        const addF = (f, art) => { const k = String(f['Código']); if (!vistosF.has(k)) { vistosF.add(k); out.funcionalidades.push({ item: f, sim: 1, citado: art }); } };
        artigos.forEach(a => {
            const titulo = String(a.erro || a.titulo || '').trim();
            const t = String(a.solucao || a.conteudo || '') + '\n' + String(a.emitir || a.como_emitir || '');
            (t.match(RE_NOME) || []).forEach(n => { const p = porNome.get(n.toLowerCase()); if (p) addP(p, titulo); });
            let m;
            // Os códigos mudaram entre versões: se o artigo escreve o nome logo depois do número ("parâmetro 268 - Regra padrão…"), o nome tem de bater com o item daquele código;
            // se não bater, o item é descartado (e procurado pelo nome). Sem nome ao lado do número, vale o código.
            const confere = (item, resto) => {
                const nome = nrm(resto).replace(/^[\s\-–:."“”']+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
                if (nome.length < 6 || !/^[\s\-–:"“]/.test(resto)) return true;
                const desc = nrm(item['Descrição']).replace(/[^a-z0-9]+/g, ' ').trim();
                const pal = nome.split(' ').filter(w => w.length > 2).slice(0, 3);
                return !pal.length || pal.every(w => desc.includes(w));
            };
            RE_COD_PARAM.lastIndex = 0;
            while ((m = RE_COD_PARAM.exec(t))) {
                const p = porCodigo.get(m[1]), resto = t.substr(m.index + m[0].length, 70);
                if (p && confere(p, resto)) addP(p, titulo);
                else if (p) { const nome = nrm(resto).replace(/^[\s\-–:."“”']+/, '').replace(/[^a-z0-9]+/g, ' ').trim(); const q = nome.length >= 8 && (parametros || []).find(x => nrm(x['Descrição']).replace(/[^a-z0-9]+/g, ' ').trim().startsWith(nome.slice(0, 30))); if (q) addP(q, titulo); }
            }
            RE_COD_FUNC.lastIndex = 0;
            while ((m = RE_COD_FUNC.exec(t))) {
                const f = porCodigoF.get(m[1]), resto = t.substr(m.index + m[0].length, 70);
                if (f && confere(f, resto)) addF(f, titulo);
                else if (f) { const nome = nrm(resto).replace(/^[\s\-–:."“”']+/, '').replace(/[^a-z0-9]+/g, ' ').trim(); const q = nome.length >= 8 && (funcionalidades || []).find(x => nrm(x['Descrição']).replace(/[^a-z0-9]+/g, ' ').trim().startsWith(nome.slice(0, 30))); if (q) addF(q, titulo); }
            }
            RE_TITULO.lastIndex = 0;
            while ((m = RE_TITULO.exec(t))) {
                const frase = nrm(m[1]).replace(/[^a-z0-9]+/g, ' ').trim(); if (frase.length < 8) continue;
                const p = (parametros || []).find(x => nrm(x['Descrição']).replace(/[^a-z0-9]+/g, ' ').trim().startsWith(frase));
                if (p) addP(p, titulo);
            }
        });
        return out;
    }

    // ── junta o que veio dos artigos com o que veio da busca (os citados vão na frente), sem repetir ──
    function combinar(citados, achados) {
        const junta = (a, b, max) => { const vistos = new Set(), r = []; a.concat(b).forEach(x => { const k = String(x.item['Código']); if (!vistos.has(k)) { vistos.add(k); r.push(x); } }); return r.slice(0, max); };
        return {   // os citados não tomam o lugar dos achados pela busca: o limite sobe (até 7) para cada citado que entrar
            parametros: junta(citados.parametros, achados.parametros, Math.min(7, MAX_PARAMETROS + citados.parametros.length)),
            funcionalidades: junta(citados.funcionalidades, achados.funcionalidades, Math.min(7, MAX_FUNCIONALIDADES + citados.funcionalidades.length)),
        };
    }

    // ── textos do prompt ──
    function formatarItem(item) {
        // O CÓDIGO não vai para a IA de propósito: os códigos mudaram entre versões do sistema e a IA citava o número em vez do nome — o item é identificado pela Descrição e pelo Nome Interno.
        return Object.entries(item).filter(([k, v]) => k !== 'id' && k !== 'Código' && k !== 'created_at' && k !== 'vetor' && v != null && String(v).trim() !== '')
            .map(([k, v]) => `  ${k === 'Valor' ? 'Valor de referência (NÃO é o valor configurado no cliente)' : k}: ${String(v).trim()}`).join('\n').substring(0, MAX_DESCRICAO);
    }
    function montarContexto(res) {
        if (!res || (!res.parametros.length && !res.funcionalidades.length)) return '';
        let c = '\n=== PARÂMETROS E FUNCIONALIDADES RELACIONADOS ===\n';
        c += `Onde conferir/alterar (caminhos reais do menu): parâmetros → ${CAMINHOS.parametros}; funcionalidades → ${CAMINHOS.funcionalidades}; depois de alterar → ${CAMINHOS.permissoes}.\nIdentifique cada item pela Descrição e pelo Nome Interno (funcionalidade: só a Descrição) e NUNCA pelo código/número.\n`;
        // (sem "sim:NN%": era só a cobertura das palavras da pergunta e passava a impressão de relevância; a lista já vem do mais ao menos provável)
        const origem = (x, fem) => x.daPergunta ? ` - ${fem ? 'PEDIDA' : 'PEDIDO'} NA PERGUNTA` : x.citado ? ` - ${fem ? 'MENCIONADA' : 'MENCIONADO'} NO ARTIGO "${x.citado.substring(0, 70)}"` : '';
        res.parametros.forEach((x, i) => { c += `\n[PARÂMETRO ${i + 1}${origem(x, false)}]\n${formatarItem(x.item)}\n`; });
        res.funcionalidades.forEach((x, i) => { c += `\n[FUNCIONALIDADE ${i + 1}${origem(x, true)}]\n${formatarItem(x.item)}\n`; });
        return c;
    }
    // Regra 9 do prompt (o resto das regras fica em chat.js). Mexa aqui para mudar o jeito de a IA tratar pré-requisitos.
    const REGRA = `9. ⚠️ PRÉ-REQUISITO PRIMEIRO — PARÂMETROS E FUNCIONALIDADES: no Bsoft TMS, muita coisa só funciona (ou só aparece na tela) depois que um PARÂMETRO ou uma FUNCIONALIDADE é habilitado/configurado. Quem lê a resposta costuma parar no começo, então o que DEPENDE de um parâmetro/funcionalidade tem de vir ANTES do passo a passo — nunca escondido no fim. Veja a seção "PARÂMETROS E FUNCIONALIDADES RELACIONADOS" (e o que o próprio artigo disser sobre habilitar/liberar algo antes: "primeiro habilite…", "pré-requisito", "precisa estar ativo", "só aparece se…") e classifique cada item:
   • CONDICIONA a pergunta = a descrição diz que ele permite, libera, habilita, exibe, obriga ou bloqueia justamente a ação ou a opção que o cliente quer (ex.: "é possível vincular CT-es de filiais diferentes ao mesmo contrato de frete?" ↔ parâmetro "Pode criar CF com documentos de talões diferentes?"; "não aparece a opção X" ↔ o parâmetro/funcionalidade que exibe X). Se for o caso, a resposta COMEÇA por este bloco — antes de qualquer abertura, de "sim, é possível" e de qualquer passo:
       **⚙️ Antes de tudo, verifique:**
       - quem é o item: a DESCRIÇÃO em negrito (o título, a primeira frase, como aparece na tela — ex.: **Pode criar CF com documentos de talões diferentes?**) seguida do NOME INTERNO entre parênteses (ex.: transp_podeCriarCFComDocsDeTaloesDiferentes); funcionalidade não tem nome interno: só a Descrição. ⚠️ NUNCA escreva o CÓDIGO (o número) do parâmetro/funcionalidade, nem "parâmetro 1117": os códigos mudaram entre versões do sistema e deixaram de bater. Se o artigo citar só o número, troque-o pela Descrição e pelo Nome Interno do item correspondente da seção (ou pelo nome que o próprio artigo trouxer); se não houver nome nenhum, descreva o item pelo que ele faz, sem número. Depois: uma frase do que ele faz; e como precisa estar. PARÂMETRO: diga "precisa estar **Sim**" (ou **Não**) só se a Descrição deixar isso claro — cuidado com "Impedir/Obrigar/Restringir/Bloquear", em que liberar a ação exige o valor oposto; se o valor for número ou texto, escreva "confira o valor configurado" e o que ele controla. FUNCIONALIDADE ("Quem pode…"): é permissão — diga que o usuário (ou o grupo dele) precisa ter essa funcionalidade LIBERADA;
       - onde conferir: copie os caminhos do cabeçalho da seção (parâmetros e funcionalidades ficam em lugares diferentes; depois de alterar, vale atualizar as permissões);
       - se mais de um item condiciona, liste todos.
     Em seguida, uma linha de ligação ("Com isso configurado, siga o procedimento:") e então o passo a passo completo do conhecimento (as regras 4 e 5 continuam valendo, sem omitir nada). Se o conhecimento NÃO trouxer o passo a passo desta pergunta, entregue só o bloco e diga que o procedimento não está documentado (sem a linha de ligação e sem inventar passos). Em pergunta de sim/não ("é possível…?"), a resposta direta vem DEPOIS do bloco ("Sim, é possível — com o item acima configurado."). Se a pergunta é sobre o próprio item ("para que serve…?"), explique o item em vez de montar o bloco. Esta regra vale também ao reaproveitar um artigo ou uma resposta aprovada (regra 11): se o parâmetro/funcionalidade que condiciona aparecer lá no fim, leve-o para o início.
   • APENAS RELACIONADO = é do mesmo assunto, mas a ação funciona sem ele: NÃO abra a resposta com ele; deixe no FIM, como "💡 Verifique também o parâmetro/funcionalidade X…" (no máximo 2).
   Só conta como CONDICIONA se o OBJETO e a AÇÃO da Descrição forem os mesmos da pergunta (ex.: vincular + documentos de talões/empresas diferentes + contrato de frete); item que só divide uma palavra solta (emitir, opção, permitir, valor, nota…) NÃO condiciona. Um item "MENCIONADO NO ARTIGO" só é pré-requisito se o artigo disser que ele é necessário para o que foi perguntado (e não que é opcional). Se nenhum item condiciona a pergunta, NÃO crie o bloco. Nunca invente parâmetro, funcionalidade ou valor que não esteja no conhecimento, e nunca cite códigos (números) de parâmetros/funcionalidades, em nenhuma parte da resposta. O "Valor de referência" NÃO é como o sistema do cliente está configurado (você não sabe): nunca diga "o seu está Sim/Não".`;
    // Dica curta, só quando a pergunta tem cara de "depende de um parâmetro" e há o que conferir.
    function dica(ehCondicao, res) {
        if (!ehCondicao || !res || !(res.parametros.length || res.funcionalidades.length)) return '';   // só em pergunta de condição (item só mencionado num artigo não dispara a dica)
        return '\n🔎 PRÉ-REQUISITO (regra 9): esta pergunta pode depender de um parâmetro ou funcionalidade. Confira a seção PARÂMETROS E FUNCIONALIDADES RELACIONADOS antes de responder; se algum CONDICIONA o que foi perguntado, a resposta COMEÇA por "⚙️ Antes de tudo, verifique:".\n';
    }

    return { ehPerguntaDeCondicao, buscar, buscarEm, indexar, tokens, citadosNosArtigos, combinar, montarContexto, formatarItem, dica, REGRA, CAMINHOS, PADRAO, GRUPOS };
})();
