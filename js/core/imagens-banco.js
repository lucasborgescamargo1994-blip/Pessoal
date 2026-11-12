/* js/core/imagens-banco.js — Imagens do procedimento (v28.39): as regras, sem tela. Usado pelo chat (js/app/imagens-banco-ui.js) e pelo painel administrativo (admin/js/imagens-artigo.js).

   A ideia: o artigo da base de conhecimento (tabela BancoDados) pode ter prints do passo a passo (coluna `imagens`, sql/09_bancodados_imagens.sql). Quando a IA responde USANDO esse artigo, as imagens
   aparecem junto da resposta. A coluna guarda uma lista: [{ "url": "https://…/storage/v1/object/public/bancodados-imagens/artigo-12/….webp", "legenda": "Tela de Parâmetros" }].

   Segurança: só vale URL https do armazenamento PÚBLICO do próprio Supabase (…/storage/v1/object/public/…): nada de data:, javascript: nem endereço de terceiros (rastreamento) — mesmo que alguém
   grave outra coisa na coluna, a imagem simplesmente não aparece.

   Quais imagens entram numa resposta (`escolher`): só as de artigos que a IA recebeu como conhecimento E que a resposta realmente usou:
     • o artigo está entre os 3 primeiros da busca (ou é o reforço por palavra-chave) e tem pelo menos 55 % de semelhança com a pergunta;
     • a resposta veio dele — vale UMA das duas provas:
         (a) COPIOU TRECHOS: a resposta repete do artigo pelo menos 10 sequências de 3 palavras seguidas e isso é pelo menos 15 % das sequências da resposta (ou, em resposta bem curta, 5 sequências e metade delas).
             É a prova principal: a IA reproduz os passos do artigo, e uma resposta que abre com o bloco "⚙️ Antes de tudo, verifique:" (parâmetros/funcionalidades, que não vêm do artigo) continua copiando o
             procedimento do mesmo jeito — só que o vocabulário do bloco ao lado dilui a prova (b), que foi o que fez a imagem não aparecer no teste real (28.39.1);
         (b) VOCABULÁRIO: pelo menos 45 % das palavras (distintas) da resposta existem no texto do artigo — pega a resposta reescrita com as mesmas palavras, mas em outra ordem.
       Um artigo vizinho que só entrou no contexto fica bem abaixo das duas. Medido nos artigos reais da base (ver README, seção "Imagens do procedimento").
     • no máximo 2 artigos e 4 imagens por resposta, sem repetir a mesma.
   Calibragem (70 artigos reais da base): (b) resposta fiel ao artigo (com 35 % de palavras extras) dá 66–95 %; artigo vizinho que a busca traz junto dá, em 90 % dos casos, menos de 36 %; sem relação, no máximo 40 %.
   (a) fiel, parafraseada (1 palavra em 6 tirada e 1 em 9 trocada), curta e diluída (bloco de outro assunto + metade do procedimento): 100 % de acerto; falso positivo só pela cópia: vizinho 5 %, sem relação 0 %.
   Caso real: "Como emitir uma carta de correção para um ct-e?" → artigo #460: 40 trechos copiados (32 % da resposta) contra 1 a 5 dos vizinhos; pelo vocabulário só 40,5 % (diluído pelo bloco "Antes de tudo"). */
'use strict';
const BancoImg = (() => {
    const BUCKET = 'bancodados-imagens';
    const MAX_POR_ARTIGO = 6, MAX_NA_RESPOSTA = 4, MAX_ARTIGOS = 2;
    const TOP = 3, SIM_MIN = 0.55, USO_MIN = 0.45;
    const COPIA = { TRECHOS: 10, FRACAO: 0.15, CURTA_TRECHOS: 5, CURTA_FRACAO: 0.5 };
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
    // (a) CÓPIA — n = quantas sequências de 3 palavras da resposta existem no artigo; fr = n ÷ sequências da resposta (0 a 1)
    function copia(artigo, trechosResposta) {
        if (!trechosResposta || !trechosResposta.size) return { n: 0, fr: 0 };
        const ta = trechos(textoDoArtigo(artigo));
        let n = 0; trechosResposta.forEach(g => { if (ta.has(g)) n++; });
        return { n, fr: n / trechosResposta.size };
    }
    const copiou = c => (c.n >= COPIA.TRECHOS && c.fr >= COPIA.FRACAO) || (c.n >= COPIA.CURTA_TRECHOS && c.fr >= COPIA.CURTA_FRACAO);

    // artigos: a lista `rr` do chat (em ordem de relevância; cada item com similaridade, erro/titulo, solucao/conteudo e imagens); texto: a resposta final.
    // `analisar` devolve { imagens: [{ url, legenda, titulo, id }], candidatos: [...] } — `candidatos` é cada artigo COM imagem entre os primeiros da busca, com os números da decisão (para o console
    // dizer, quando a imagem não vem, o porquê: semelhança, cópia ou vocabulário abaixo do mínimo). Sem artigo com imagem (o caso comum) não gasta nem o cálculo das palavras.
    function analisar(artigos, texto) {
        const lst = Array.isArray(artigos) ? artigos : [];
        const cand = lst.filter((r, i) => r && (i < TOP || r._reforcoPalavraChave) && !r.isRepositorio && !r.isML && lista(r.imagens).length);
        if (!cand.length) return { imagens: [], candidatos: [] };
        const tr = tokens(texto), tg = trechos(texto);
        const imagens = [], vistas = new Set(), candidatos = [];
        let artigosUsados = 0;
        cand.forEach(r => {
            const sim = Number(r.similaridade) || 0;   // (o artigo escolhido nos botões "qual é o seu caso?" já vem com 90 %: quem clicou nele quis esse)
            const u = uso(r, tr), c = copia(r, tg);
            const veioDele = u >= USO_MIN || copiou(c);
            const titulo = String(r.erro || r.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 140);
            const id = r.idSupabase != null ? r.idSupabase : (r.id != null ? r.id : null);
            const info = { id, titulo, sim: +sim.toFixed(3), uso: +u.toFixed(3), trechos: c.n, fracao: +c.fr.toFixed(3), motivo: '' };
            candidatos.push(info);
            if (sim < SIM_MIN) { info.motivo = 'semelhança com a pergunta abaixo de ' + Math.round(SIM_MIN * 100) + '%'; return; }
            if (!veioDele) { info.motivo = 'a resposta não parece vir deste artigo (copiou ' + c.n + ' trechos = ' + Math.round(c.fr * 100) + '% da resposta; vocabulário em comum ' + Math.round(u * 100) + '%)'; return; }
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
    function escolher(artigos, texto) { return analisar(artigos, texto).imagens; }

    return { BUCKET, MAX_POR_ARTIGO, MAX_NA_RESPOSTA, LIMITES: { TOP, SIM_MIN, USO_MIN, MAX_ARTIGOS, COPIA }, urlValida, caminhoNoBucket, lista, tokens, uso, palavras, trechos, copia, copiou, analisar, escolher };
})();
