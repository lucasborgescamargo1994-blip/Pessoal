/* js/core/imagens-banco.js — Imagens do procedimento (v28.39; a regra "a resposta veio deste artigo" foi refeita na v28.39.2): as regras, sem tela. Usado pelo chat (js/app/imagens-banco-ui.js) e pelo painel administrativo (admin/js/imagens-artigo.js).

   A ideia: o artigo da base de conhecimento (tabela BancoDados) pode ter prints do passo a passo (coluna `imagens`, sql/09_bancodados_imagens.sql). Quando a IA responde USANDO esse artigo, as imagens
   aparecem junto da resposta. A coluna guarda uma lista: [{ "url": "https://…/storage/v1/object/public/bancodados-imagens/artigo-12/….webp", "legenda": "Tela de Parâmetros" }].

   Segurança: só vale URL https do armazenamento PÚBLICO do próprio Supabase (…/storage/v1/object/public/…): nada de data:, javascript: nem endereço de terceiros (rastreamento) — mesmo que alguém
   grave outra coisa na coluna, a imagem simplesmente não aparece.

   Quais imagens entram numa resposta (`analisar` / `escolher`): só as de artigos que a IA recebeu como conhecimento E que a resposta realmente usou:
     • o artigo está entre os 5 primeiros da busca (ou é o reforço por palavra-chave, ou o que a pessoa escolheu nos botões) e tem pelo menos 55 % de semelhança com a pergunta;
     • a resposta veio dele — vale UMA destas provas (`prova` no resultado):
         (1) ESCOLHA: a pessoa clicou nele nos botões "qual é o seu caso?";
         (2) TÍTULO: a pergunta é (quase) o título do artigo — quem pergunta com as palavras do título quer aquele artigo (foi o que o dono testou duas vezes);
         (3) CÓPIA (a prova principal): comparando com TODOS os artigos que a IA recebeu, o artigo é um dos que MAIS aparecem na resposta — pelo menos 10 sequências de 3 palavras seguidas iguais às dele
             e pelo menos 70 % do que o artigo mais copiado deu (assim o artigo vizinho, que só divide frases como "Transporte > Conhecimentos", não passa quando a resposta veio de outro). Também vale
             reproduzir boa parte dele (20 trechos ou mais que são 30 % do artigo, mesmo que outro artigo domine a resposta) ou — resposta/artigo bem curto — 5 trechos que são metade da resposta ou do artigo;
         (4) VOCABULÁRIO: pelo menos 45 % das palavras (distintas) da resposta existem no texto do artigo, e não menos de 85 % do que o artigo de maior vocabulário em comum teve.
       Por que "o que mais aparece" e não "quanto da resposta é dele": a resposta "completa" da IA junta texto de vários artigos do mesmo assunto, reescreve o passo a passo em lista numerada, abre com o bloco
       "⚙️ Antes de tudo, verifique:" e fecha com observações — o artigo certo vira só 7–17 % do que foi escrito e até metade das palavras muda; medido nas respostas REAIS da IA, a regra por fração da resposta
       (28.39.0 e 28.39.1) deixou a imagem de fora em 6 de 8 respostas da pergunta "Como cancelar um Ct-e na SEFAZ" e em 1 de 4 da "carta de correção". A relativa acertou 31/31 respostas reais (as 12 mais
       novas, capturadas depois de calibrar, também) e não deixou entrar o artigo de OUTRA pergunta (com imagem) em nenhuma.
     • no máximo 2 artigos e 4 imagens por resposta, sem repetir a mesma.
   Calibragem (artigos reais da base, contexto de 5 artigos = o artigo + 4 vizinhos de título parecido; respostas fiel, diluída, parafraseada, reescrita, curta e "mistura" com 2–3 artigos): artigo longo 100 % de
   acerto e 3 % de falso positivo num vizinho que não é a fonte; artigo curto (como o #89, 428 caracteres) 97–100 % (menos a reescrita pesada: 34 %) e 5 %; artigo sem relação: 0 %. */
'use strict';
const BancoImg = (() => {
    const BUCKET = 'bancodados-imagens';
    const MAX_POR_ARTIGO = 6, MAX_NA_RESPOSTA = 4, MAX_ARTIGOS = 2;
    const TOP = 5, SIM_MIN = 0.55, USO_MIN = 0.45, USO_RELATIVO = 0.85, TITULO_MIN = 0.85;
    // (calibrados com respostas REAIS da IA — ver o comentário do topo) TRECHOS/RELATIVO: o mínimo de trechos de 3 palavras iguais e a parte do que o artigo mais copiado deu; FRACAO_MIN/COBERTURA_MIN: piso
    // contra frase de menu que todo artigo tem em comum; MUITOS: copiar tanto vale sozinho; FORTE_*: o artigo foi reproduzido em boa parte (≥ 30 % dos trechos dele, no mínimo 20) mesmo que OUTRO artigo
    // domine a resposta; CURTA_*: resposta ou artigo bem curto, quase inteiro copiado. (RELATIVO 0,7: com 0,6 o artigo de OUTRA pergunta entrava em 3 de 31 respostas reais; com 0,7, em nenhuma.)
    const COPIA = { TRECHOS: 10, RELATIVO: 0.7, FRACAO_MIN: 0.05, COBERTURA_MIN: 0.08, MUITOS: 30, FORTE_TRECHOS: 20, FORTE_COBERTURA: 0.30, CURTA_TRECHOS: 5, CURTA_FRACAO: 0.5, CURTA_COBERTURA: 0.5 };
    // palavras comuns do português e do vocabulário de "passo a passo" (não dizem de que artigo a resposta veio)
    const COMUNS = new Set(('para como esta este esse essa isso aqui mais menos muito pelo pela pelos pelas entre sobre quando onde qual quais quem desde ate apos antes depois porque pois entao assim tambem ainda mesmo cada todo toda todos todas outro outra outros outras seja sera serao foram esta estao tem tinha pode podem deve devem devera precisa vai vao ser ter fazer feito faca clique acesse selecione informe marque desmarque tela campo opcao botao sistema passo passos seguir siga abra abrir salve salvar clicar acessar utilizar usar caso exemplo apenas somente depois uma uns umas com sem nao sim').split(' '));

    const meuHost = () => { try { return new URL((window.BSOFT_CONFIG || {}).supabaseUrl).host; } catch (e) { return ''; } };

    // https + armazenamento público do Supabase (o do projeto, ou qualquer *.supabase.co: o projeto pode mudar de endereço)
    function urlValida(u) {
        try {
            const x = new URL(String(u == null ? '' : u).trim());
            if (x.protocol !== 'https:' || !/^\/storage\/v1\/object\/public\//.test(x.pathname)) return false;
            return x.host === meuHost() || /\.supabase\.co$/i.test(x.host);
        } catch (e) { return false; }
    }
    // 'artigo-12/1699999999-ab12.webp' (o caminho DENTRO do bucket) ou null se a URL não é de um arquivo deste bucket
    function caminhoNoBucket(url) {
        try {
            const x = new URL(String(url)), pref = '/storage/v1/object/public/' + BUCKET + '/';
            return x.pathname.startsWith(pref) ? decodeURIComponent(x.pathname.slice(pref.length)) : null;
        } catch (e) { return null; }
    }
    // Aceita o que o banco devolve (lista), um JSON em texto, um objeto só ou uma URL solta → sempre [{ url, legenda }] só com URLs válidas (no máximo MAX_POR_ARTIGO)
    function lista(v) {
        let a = v;
        if (typeof a === 'string') {
            const t = a.trim(); if (!t) return [];
            if (t[0] === '[' || t[0] === '{') { try { a = JSON.parse(t); } catch (e) { return []; } } else a = [{ url: t }];
        }
        if (a && !Array.isArray(a) && typeof a === 'object') a = [a];
        if (!Array.isArray(a)) return [];
        const out = [], vistas = new Set();
        a.forEach(x => {
            const o = typeof x === 'string' ? { url: x } : x;
            if (!o || typeof o !== 'object' || !urlValida(o.url)) return;
            const url = String(o.url).trim(); if (vistas.has(url)) return; vistas.add(url);
            out.push({ url, legenda: String(o.legenda == null ? '' : o.legenda).replace(/\s+/g, ' ').trim().slice(0, 200) });
        });
        return out.slice(0, MAX_POR_ARTIGO);
    }

    // palavras que distinguem o assunto: sem acento, minúsculas, 4+ letras, fora as comuns
    function tokens(t) {
        const s = new Set();
        String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').split(' ').forEach(w => { if (w.length >= 4 && !COMUNS.has(w)) s.add(w); });
        return s;
    }
    // o texto do artigo contra o qual a resposta é comparada (o mesmo que a IA recebe como conhecimento)
    const textoDoArtigo = a => [a.erro || a.titulo, a.solucao || a.conteudo, a.emitir || a.como_emitir, a.caminhoMenu || a.caminho_menu].filter(Boolean).join(' ');

    // (b) VOCABULÁRIO — quanto da RESPOSTA veio do artigo: fração das palavras (distintas) da resposta que existem no texto do artigo (0 a 1)
    function uso(artigo, tokensResposta) {
        if (!tokensResposta || !tokensResposta.size) return 0;
        const ta = tokens(textoDoArtigo(artigo));
        let hit = 0; tokensResposta.forEach(w => { if (ta.has(w)) hit++; });
        return hit / tokensResposta.size;
    }

    // todas as palavras do texto, NA ORDEM (sem acento, minúsculas) — e as sequências de 3 palavras seguidas, que dizem se um texto foi copiado de outro
    const palavras = t => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    function trechos(t) {
        const p = palavras(t), s = new Set();
        for (let i = 0; i + 2 < p.length; i++) s.add(p[i] + ' ' + p[i + 1] + ' ' + p[i + 2]);
        return s;
    }
    // (a) CÓPIA — n = quantas sequências de 3 palavras da resposta existem no artigo; fr = n ÷ sequências da resposta (quanto da RESPOSTA veio do artigo);
    // cob = n ÷ sequências do artigo (quanto do ARTIGO foi reproduzido na resposta). As duas, de 0 a 1.
    function copia(artigo, trechosResposta) {
        if (!trechosResposta || !trechosResposta.size) return { n: 0, fr: 0, cob: 0 };
        const ta = trechos(textoDoArtigo(artigo));
        let n = 0; trechosResposta.forEach(g => { if (ta.has(g)) n++; });
        return { n, fr: n / trechosResposta.size, cob: ta.size ? n / ta.size : 0 };
    }
    // Resposta "completa": a IA junta o texto de VÁRIOS artigos do mesmo assunto, reescreve em lista numerada e a resposta fica longa — o artigo certo vira só 7–17 % do que foi escrito (e a fração não
    // distingue um artigo que ficou de fora de outro que só divide frases de menu). O que distingue é COMPARAR com os outros artigos que a IA recebeu: o certo é um dos que mais aparecem na resposta.
    // maxN = o maior n entre TODOS os artigos que a IA recebeu (com ou sem imagem).
    const copiou = (c, maxN) => (c.n >= COPIA.TRECHOS && c.n >= COPIA.RELATIVO * (maxN || 0) && (c.n >= COPIA.MUITOS || c.fr >= COPIA.FRACAO_MIN || c.cob >= COPIA.COBERTURA_MIN))
        || (c.n >= COPIA.FORTE_TRECHOS && c.cob >= COPIA.FORTE_COBERTURA)
        || (c.n >= COPIA.CURTA_TRECHOS && (c.fr >= COPIA.CURTA_FRACAO || c.cob >= COPIA.CURTA_COBERTURA));
    // vocabulário em comum alto E não muito abaixo do artigo que mais tem (maxU = o maior uso entre os artigos que a IA recebeu)
    const vocabulario = (u, maxU) => u >= USO_MIN && u >= USO_RELATIVO * (maxU || 0);

    // (c) TÍTULO — a pergunta é (quase) o próprio título do artigo. Quem pergunta com as palavras do título quer exatamente aquele artigo: se ele tem imagem, ela vem, qualquer que seja o jeito
    // de a IA escrever a resposta (foi o que o dono testou duas vezes: "está esse mesmo nome no banco de dados"). Compara as palavras que identificam o assunto (sem acento, 3+ letras, sem as comuns),
    // com o tipo de documento inteiro ("ct-e" → cte, "nf-e" → nfe: CT-e e NF-e são assuntos diferentes); as duas listas precisam coincidir em pelo menos 85 %.
    const palavrasChave = t => {
        const s = new Set();
        String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(ct|nf|mdf|nfs|cf)\s*-?\s*e\b/g, '$1e').replace(/[^a-z0-9]+/g, ' ').split(' ').forEach(w => { if (w.length >= 3 && !COMUNS.has(w)) s.add(w); });
        return s;
    };
    function mesmoTitulo(titulo, pergunta) {
        const a = palavrasChave(titulo), b = palavrasChave(pergunta);
        if (a.size < 2 || b.size < 2) return false;         // título ou pergunta de uma palavra só não prova nada
        let i = 0; a.forEach(w => { if (b.has(w)) i++; });
        return i / a.size >= TITULO_MIN && i / b.size >= TITULO_MIN;
    }

    // artigos: a lista `rr` do chat (em ordem de relevância; cada item com similaridade, erro/titulo, solucao/conteudo e imagens); texto: a resposta final; pergunta: o que a pessoa perguntou (opcional).
    // `analisar` devolve { imagens: [{ url, legenda, titulo, id }], candidatos: [...] } — `candidatos` é cada artigo COM imagem entre os primeiros da busca, com os números da decisão (para o console
    // dizer, quando a imagem não vem, o porquê: semelhança, cópia ou vocabulário abaixo do mínimo). Sem artigo com imagem (o caso comum) não gasta nem o cálculo das palavras.
    // Um artigo com imagem entra quando tem semelhança suficiente E UMA destas provas: foi escolhido pela pessoa nos botões, a pergunta é o título dele, a resposta copiou trechos dele ou usa o vocabulário dele.
    function analisar(artigos, texto, pergunta) {
        const lst = Array.isArray(artigos) ? artigos : [];
        const ehCand = (r, i) => r && (i < TOP || r._reforcoPalavraChave || r._escolhidoPeloUsuario) && !r.isRepositorio && !r.isML && lista(r.imagens).length;
        if (!lst.some(ehCand)) return { imagens: [], candidatos: [] };      // (o caso comum: nenhum artigo da busca tem imagem — nem o cálculo das palavras é feito)
        const tr = tokens(texto), tg = trechos(texto), respondeu = String(texto == null ? '' : texto).trim().length >= 60;   // (resposta de verdade: título igual + "não sei" não vale)
        // as medidas são de TODOS os artigos que a IA recebeu (não só dos com imagem): a prova "é um dos que mais aparecem na resposta" compara o candidato com o resto
        const med = lst.map(r => (r && !r.isML) ? { u: uso(r, tr), c: copia(r, tg) } : null);
        const maxN = Math.max(0, ...med.filter(Boolean).map(m => m.c.n)), maxU = Math.max(0, ...med.filter(Boolean).map(m => m.u));
        const imagens = [], vistas = new Set(), candidatos = [];
        let artigosUsados = 0;
        lst.forEach((r, i) => {
            if (!ehCand(r, i)) return;
            const sim = Number(r.similaridade) || 0;   // (o artigo escolhido nos botões "qual é o seu caso?" já vem com 90 %: quem clicou nele quis esse)
            const u = med[i].u, c = med[i].c;
            const titulo = String(r.erro || r.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 140);
            const id = r.idSupabase != null ? r.idSupabase : (r.id != null ? r.id : null);
            const prova = !respondeu ? '' : r._escolhidoPeloUsuario ? 'escolha' : (pergunta && mesmoTitulo(r.erro || r.titulo, pergunta)) ? 'título' : copiou(c, maxN) ? 'cópia' : vocabulario(u, maxU) ? 'vocabulário' : '';
            const info = { id, titulo, sim: +sim.toFixed(3), uso: +u.toFixed(3), trechos: c.n, fracao: +c.fr.toFixed(3), cobertura: +c.cob.toFixed(3), maiorTrechos: maxN, prova, motivo: '' };
            candidatos.push(info);
            if (sim < SIM_MIN) { info.motivo = 'semelhança com a pergunta abaixo de ' + Math.round(SIM_MIN * 100) + '%'; return; }
            if (!prova) { info.motivo = 'a resposta não parece vir deste artigo (' + c.n + ' trechos copiados = ' + Math.round(c.fr * 100) + '% da resposta e ' + Math.round(c.cob * 100) + '% do artigo; o artigo que mais aparece na resposta tem ' + maxN + '; vocabulário em comum ' + Math.round(u * 100) + '%)'; return; }
            if (artigosUsados >= MAX_ARTIGOS) { info.motivo = 'já há ' + MAX_ARTIGOS + ' artigos com imagem nesta resposta'; return; }
            artigosUsados++; info.motivo = 'ok';
            lista(r.imagens).forEach(im => {
                if (vistas.has(im.url) || imagens.length >= MAX_NA_RESPOSTA) return;
                vistas.add(im.url);
                imagens.push({ url: im.url, legenda: im.legenda, titulo, id });
            });
        });
        return { imagens, candidatos };
    }
    // Devolve [{ url, legenda, titulo, id }] — vazia quando não há imagem a mostrar.
    function escolher(artigos, texto, pergunta) { return analisar(artigos, texto, pergunta).imagens; }

    return { BUCKET, MAX_POR_ARTIGO, MAX_NA_RESPOSTA, LIMITES: { TOP, SIM_MIN, USO_MIN, USO_RELATIVO, MAX_ARTIGOS, COPIA, TITULO_MIN }, urlValida, caminhoNoBucket, lista, tokens, uso, palavras, trechos, copia, copiou, vocabulario, mesmoTitulo, analisar, escolher };
})();
