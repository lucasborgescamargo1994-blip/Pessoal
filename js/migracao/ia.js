/* js/migracao/ia.js — Primeira emissão guiada: a IA do chat.
   Usa os MESMOS modelos do painel administrativo (aba "IA / MCP" → config/mcp-config.js): mcpMontarCadeia() de js/core/mcp.js devolve a cadeia (principal → reservas) e a
   página confere a configuração nova sozinha (a cada 2 horas), como o sistema principal. Mudou o modelo no painel? Muda aqui também.
   Cada pergunta vira: busca no conhecimento (artigos do banco + respostas aprovadas + FAQ + regras e prazos + glossário + vídeos + parâmetros + menu real) → prompt (js/migracao/logica.js) → IA.
   Nada é gravado: nem a pergunta, nem a resposta saem do navegador (só o que a pessoa digita, ANONIMIZADO, e as respostas do começo — sem nome nem CNPJ — vão para o provedor de IA). */
const MigIA = (() => {
    'use strict';
    const L = MigLogica;

    /* ── cadeia de modelos com limite de tempo por modelo ──
       A função pronta de js/core/mcp.js também percorre a cadeia, mas sem limite de tempo: um modelo travado ou lento pararia a conversa.
       Aqui cada modelo tem 75 s (resposta longa); vazio ou lento passa direto para o próximo (e fica 10 min de molho depois de 2 falhas seguidas); erro de rede tenta mais uma vez. */
    const LIMITE_MODELO_MS = 75000, QUARENTENA_MS = 10 * 60 * 1000;
    const FALHAS = new Map();
    const emQuarentena = m => { const x = FALHAS.get(m); return !!x && x.n >= 2 && Date.now() < x.ate; };
    const comLimite = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT: o modelo demorou mais de ' + Math.round(ms / 1000) + ' s')), ms))]);
    async function chamar(messages, cfg, aoTentar, limiteMs) {
        // Motor alternativo: a página migracaolocal.html define window.MigMotorIA (um modelo pequeno que roda no computador do cliente, js/migracao-local/) e ele responde no lugar do MCP.
        // Na migracao.html isso não existe e nada muda.
        if (window.MigMotorIA && typeof window.MigMotorIA.chamar === 'function') return window.MigMotorIA.chamar(messages, cfg, aoTentar, limiteMs);
        const passos = mcpMontarCadeia();
        if (!passos.length) throw new Error('nenhum modelo ativo no MCP (config/mcp-config.js)');
        let ultimo = null;
        const ativos = passos.filter(p => !emQuarentena(p.model));
        for (const p of (ativos.length ? ativos : passos)) {
            for (let t = 1; t <= 2; t++) {
                try {
                    if (aoTentar) aoTentar(p, t);
                    const res = await comLimite(callMCPAPI(p.provider, p.model, p.apiKey, p.baseUrl, messages, cfg || {}), limiteMs || LIMITE_MODELO_MS);
                    const f = filtrarPensamentoAlto(res && res.text);
                    if (!f.texto || f.eraPensamento) throw new Error('resposta vazia');
                    FALHAS.delete(p.model);
                    let texto = f.texto;
                    if ((res.finishReason === 'length' || res.finishReason === 'MAX_TOKENS') && typeof _continuarResposta === 'function') {
                        try { texto = await _continuarResposta(messages, texto, cfg || {}, 2, res.text); } catch (e) { /* fica com o que veio */ }
                    }
                    return { text: texto, _iaModelo: p.model, finishReason: res.finishReason };
                } catch (e) {
                    ultimo = e; console.warn('[migração] ' + p.model + ' (tentativa ' + t + '): ' + (e && e.message));
                    if (/vazia|TIMEOUT/.test(String(e && e.message))) { const x = FALHAS.get(p.model) || { n: 0, ate: 0 }; x.n++; x.ate = Date.now() + QUARENTENA_MS; FALHAS.set(p.model, x); break; }
                    if (t === 1) await new Promise(r => setTimeout(r, 1200));
                }
            }
        }
        throw ultimo || new Error('Todos os provedores falharam.');
    }

    /* ── contexto ── */
    function contextoParametros(E, consulta) {
        if (typeof Prereq === 'undefined' || !E.dados.params.length) return '';
        try {
            const res = Prereq.buscar(consulta, E.dados.params, E.dados.funcs);
            if (!Prereq.ehPerguntaDeCondicao(consulta) && !res.parametros.some(x => x.daPergunta)) return '';
            return Prereq.montarContexto(res);
        } catch (e) { return ''; }
    }
    // O menu real: sem o "(id da rotina: …)" (nome interno da tela), que só atrapalharia quem está começando
    function contextoMenu(consulta) {
        try { if (typeof MenuBsoft === 'undefined' || !MenuBsoft.pronto()) return ''; return MenuBsoft.blocoPrompt(consulta, { max: 10 }).replace(/\s*\(id da rotina: [^)]*\)/g, ''); } catch (e) { return ''; }
    }
    // o que a pergunta traz do conhecimento (sem chamar a IA): útil também para mostrar "baseado em"
    function buscarContexto(E, pergunta, passo) {
        const consulta = L.anonimizar(pergunta), limpa = consulta.replace(/\[[^\]]*omitid[ao]\]/gi, ' ');   // (sem as marcas "[CNPJ omitido]": elas só atrapalhariam a busca)
        // pergunta de gente costuma ser longa e cheia de enchimento ("Como cancelo um CT-e? O cliente emitiu errado, ele disse que…"): o assunto está na PRIMEIRA frase, então ela é buscada primeiro
        const foco = (limpa.split(/[?!.\n]+/).map(s => s.trim()).find(s => L.tokens(s).length >= 2)) || limpa;
        const consultas = (foco !== limpa.trim() ? [foco] : []).concat([limpa], passo ? (passo.buscas || []).slice(0, 2) : []);
        // aqui bastam 20 % do "peso" das palavras para um artigo entrar (nas buscas curtas dos passos o mínimo é 40 %)
        const achados = L.conhecimento(E.ix, consultas, { banco: 4, rapida: 2, faq: 3 }, { minCobertura: 0.2 });
        // as regras (poucas e precisas) são buscadas com a pergunta INTEIRA e com a 1ª frase: em "Emiti um CT-e ontem com o valor errado. Ainda consigo cancelar? Qual é o prazo?" a regra do cancelamento só aparece com a pergunta inteira
        const buscaRegra = q => L.buscar(E.ix.regra, q + (passo ? ' ' + passo.titulo : ''), { max: 3, minCobertura: 0.15 });
        const porRegra = new Map();
        if (E.ix.regra) [limpa, foco].forEach(q => buscaRegra(q).forEach(a => { const atual = porRegra.get(a.doc.chave); if (!atual || a.score > atual.score) porRegra.set(a.doc.chave, a); }));
        const regras = Array.from(porRegra.values()).sort((a, b) => b.score - a.score).slice(0, 3);
        return { consulta, achados, regras: regras.map(a => a.doc.regra) };
    }

    /* ── Mentor ── */
    // o = { pergunta, historico, passo, modo ('erro' = "Deu erro?"), aoTentar }. Devolve { texto, fontes, regras, modelo, ms } ou { erro, fontes, regras, ms } se a IA não respondeu.
    async function perguntar(E, o) {
        const cliente = E.atual;
        const c = buscarContexto(E, o.pergunta, o.passo);
        // vídeos do passo em que a pessoa está (e o que mais combinar com a pergunta) e definições do glossário: a IA recomenda o vídeo pelo título
        const chavesVid = new Set((o.passo && o.passo.video) || []);
        if (E.ix.video) L.buscar(E.ix.video, c.consulta, { max: 1, minCobertura: 0.3 }).forEach(a => chavesVid.add(a.doc.id));
        const videos = Array.from(chavesVid).map(k => (E.R.videos || {})[k] && { chave: k, titulo: E.R.videos[k].titulo }).filter(Boolean);
        const glossario = E.ix.termo ? L.buscar(E.ix.termo, c.consulta, { max: 2, minCobertura: 0.5 }).map(a => '[' + a.doc.termo.termo + (a.doc.termo.sigla ? ' — ' + a.doc.termo.sigla : '') + '] ' + a.doc.termo.simples) : [];
        const fontes = [].concat(c.achados.banco, c.achados.rapida, c.achados.faq).map(x => ({ chave: x.doc.chave, titulo: x.doc.titulo, fonte: x.doc.fonte })).concat(videos.map(v => ({ chave: 'video:' + v.chave, titulo: '🎬 ' + v.titulo, fonte: 'video' })));
        const regras = c.regras.map(r => ({ id: r.id, titulo: r.titulo }));
        const t0 = performance.now();
        try {
            const msgs = L.montarMensagensMentor({
                pergunta: o.pergunta, historico: o.historico, perfil: cliente.perfil, roteiro: E.R, rot: E.rot, estado: cliente.passos, passoAtual: o.passo || null,
                achados: c.achados, regras: c.regras, parametros: contextoParametros(E, c.consulta), menu: contextoMenu(c.consulta + (o.passo ? ' ' + o.passo.titulo : '')), modo: o.modo, videos, glossario,
            });
            const res = await chamar(msgs, { temperature: 0.2, maxTokens: 3500 }, o.aoTentar);
            let texto = L.limparResposta(res.text);
            if (typeof mcpPareceIngles === 'function' && mcpPareceIngles(texto)) { try { texto = L.limparResposta(await mcpTraduzirParaPtBr(texto)); } catch (e) { /* mantém */ } }
            if (!texto) throw new Error('resposta vazia');
            return { texto, fontes, regras, modelo: res._iaModelo, ms: Math.round(performance.now() - t0) };
        } catch (e) {
            console.warn('[migração] IA indisponível:', e);
            return { erro: String((e && e.message) || e), fontes, regras, ms: Math.round(performance.now() - t0) };
        }
    }

    return { chamar, buscarContexto, perguntar, contextoParametros, contextoMenu };
})();
