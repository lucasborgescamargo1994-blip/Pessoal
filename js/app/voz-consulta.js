/* js/app/voz-consulta.js — Consulta ao banco de dados para as chamadas de VOZ (voz ao vivo e conversa rápida).
   Espelha a busca de js/app/chat.js (artigos por significado + reforço por palavra-chave, respostas aprovadas, pré-requisitos, rotinas, menu real,
   repositório) mas devolve um texto compacto para a IA FALAR, sem passar pelo handleChat (nada de botões, formato, log ou cartão de resposta).
   Se mudar a busca em chat.js, confira aqui também.
   consultar(pergunta, { escala, artigos, cabecalho }):
     escala    1 = contexto cheio (Gemini Live: lê rápido, 128 mil tokens); ~0.45 = contexto enxuto (conversa rápida: modelo gratuito, quanto menos texto mais rápida a 1ª palavra)
     artigos   quantos artigos entram (padrão: 4–6; a conversa rápida usa 3)
   Devolve { texto, encontrou, fontes (formato de fontesDoBanco), titulos }. */
'use strict';
const VozConsulta = (() => {
    const LIMITE_TEXTO = 19500;
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();

    async function esperarBase(ms) { const fim = Date.now() + ms; while (isVectorizing && Date.now() < fim) await espera(250); return !isVectorizing; }

    async function consultar(pergunta, o = {}) {
        const vazio = texto => ({ texto, encontrou: false, fontes: [], titulos: [] });
        const k = o.escala > 0 ? o.escala : 1;
        const query = limpar(pergunta).slice(0, 600);
        if (!query) return vazio('A pergunta veio vazia. Peça para a pessoa repetir a dúvida.');
        if (!(await esperarBase(8000))) return vazio('A base de conhecimento ainda está carregando. Peça à pessoa para repetir a pergunta em alguns segundos.');
        const qn = normalizarSinonimos(query);
        let vp = null; try { vp = await gerarEmbedding(qn); } catch (e) { vp = null; }
        const nrm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const palavras = nrm(qn).split(/\s+/).filter(w => w.length > 2);
        const textoDe = x => nrm((x.erro || x.titulo || '') + ' ' + (x.solucao || x.conteudo || ''));
        const porPalavras = () => (bancoCompletoRaw.length ? bancoCompletoRaw : manualVetorizado).map(item => { const t = textoDe(item); return { item, sim: palavras.filter(w => t.includes(w)).length / palavras.length }; });

        // 1) artigos: busca por significado (vetores) + reforço por palavra-chave; sem vetores, só palavra-chave
        let rr = [];
        if (vp) {
            const todos = manualVetorizado.map(item => ({ ...item, similaridade: calcularSimilaridade(vp, item.vetor) })).sort((a, b) => b.similaridade - a.similaridade);
            if (todos.length && todos[0].similaridade >= 0.1) rr = todos.slice(0, o.artigos || (todos[0].similaridade > 0.85 ? 4 : 6));
        }
        if (rr.length && palavras.length >= 2) {
            const ja = new Set(rr.map(r => r.idSupabase || r.erro));
            const melhor = porPalavras().filter(x => x.sim >= 0.7 && !ja.has(x.item.idSupabase || x.item.erro)).sort((a, b) => b.sim - a.sim)[0];
            if (melhor) rr.push({ ...melhor.item, similaridade: melhor.sim, _reforcoPalavraChave: true });
        }
        if (!rr.length && palavras.length) rr = porPalavras().filter(x => x.sim > 0).sort((a, b) => b.sim - a.sim).slice(0, o.artigos || 8).map(x => ({ ...x.item, similaridade: x.sim }));

        // 2) respostas já aprovadas pela equipe
        let rrUsadas = []; try { rrUsadas = await rrRelacionadas(query, vp, {}); } catch (e) { rrUsadas = []; }

        // 3) pré-requisitos: parâmetros e funcionalidades de que a pergunta pode depender ("Antes de tudo, verifique…")
        let pf = { parametros: [], funcionalidades: [] }, pfCtx = '', pfPediu = false;
        if (typeof Prereq !== 'undefined') {
            try {
                const art = rr.filter(r => r.similaridade >= 0.5 && !r._reforcoPalavraChave).slice(0, 3);
                pf = Prereq.combinar(Prereq.citadosNosArtigos(art, dadosParametros, dadosFuncionalidades), Prereq.buscar(query, dadosParametros, dadosFuncionalidades));
                pfPediu = pf.parametros.some(x => x.daPergunta) || pf.funcionalidades.some(x => x.daPergunta);
                pfCtx = Prereq.montarContexto(pf);
            } catch (e) { console.warn('[voz] pré-requisitos:', e); }
        }

        // 4) rotinas (nome oficial da tela) e o menu real
        let rotinas = [], rotinasCtx = '';
        try { rotinas = _buscarRotinasRelevantes(query, 3); if (rotinas.length) { rotinasCtx = '\n=== ROTINAS RELACIONADAS ===\n'; rotinas.forEach((x, i) => { rotinasCtx += `\n[ROTINA ${i + 1}]\n${_formatarRotinaParaPrompt(x.item)}\n`; }); } } catch (e) { rotinas = []; }
        let menuCtx = ''; try { menuCtx = buildContextoSistema(query, detectarDocumento(query.toLowerCase())); } catch (e) { menuCtx = ''; }
        if (k < 1) { const i = menuCtx.indexOf('=== CAMINHOS DO MENU'); if (i > 0) menuCtx = menuCtx.slice(i); }   // contexto enxuto: sem a apresentação geral do sistema, só o que casa com a pergunta

        const forte = rr.length > 0 && rr[0].similaridade > 0.65;
        const vum = !forte && !pfPediu && rr.every(r => r.similaridade < 0.5) && !rrUsadas.some(x => x.score >= 0.5);   // nada relevante (mesma regra do chat)

        // 5) documentos do repositório, só se a busca veio fraca (e no contexto cheio)
        let repo = '';
        if (k >= 1 && (!forte || vum)) { try { repo = await Promise.race([buscarConhecimentoRelevanteNoRepositorio(query), espera(4000).then(() => '')]) || ''; } catch (e) { repo = ''; } }

        // Cada seção tem o seu limite: com um teto só para o texto todo, as respostas aprovadas (grandes) empurravam o menu e as rotinas para fora.
        const cap = (s, n) => s.length > n ? s.slice(0, n) + '\n[… cortado por tamanho]\n' : s;
        let t = `=== RESULTADO DA CONSULTA À BASE · pergunta: "${query}" ===\n${o.cabecalho === undefined ? 'Responda por VOZ, curto e só com o que está abaixo.\n' : o.cabecalho}`;
        if (vum) t += '⚠️ NADA RELEVANTE foi encontrado na base para esta pergunta. Diga isso com sinceridade e faça UMA pergunta curta para entender melhor (qual tela, qual documento, qual mensagem). NÃO responda de cabeça e NÃO invente.\n';
        t += cap(pfCtx, Math.round(2500 * k));
        if (rr.length) {
            let arts = '\n=== ARTIGOS MAIS RELEVANTES ===\n';
            rr.forEach((r, i) => {
                const lim = Math.round((i === 0 ? 4000 : i < 3 ? 1800 : 400) * k), cam = r.caminhoMenu || r.caminho_menu;
                const bloco = `[ARTIGO ${i + 1} - ${(r.similaridade * 100).toFixed(0)}%] ${r.erro || r.titulo || ''}\nSolução: ${String(r.solucao || r.conteudo || '').substring(0, lim)}\n${r.emitir ? 'Emissão: ' + String(r.emitir).substring(0, Math.round(500 * k)) + '\n' : ''}${cam ? 'Caminho no menu: ' + String(cam).trim() + '\n' : ''}---\n`;
                if (i === 0 || arts.length + bloco.length <= 6500 * k) arts += bloco;
            });
            t += arts;
        }
        t += cap(rrMontarContexto(rrUsadas.slice(0, k < 1 ? 1 : 2)), Math.round(3500 * k)) + cap(rotinasCtx, Math.round(1000 * k));
        if (repo) t += '\n=== DOCUMENTO DO REPOSITÓRIO ===\n' + cap(repo, 1200);
        t += '\n=== MENU E CONHECIMENTO GERAL ===\n' + cap(menuCtx, Math.round(5200 * k));
        if (t.length > LIMITE_TEXTO * k) t = t.slice(0, Math.round(LIMITE_TEXTO * k)) + '\n[… resultado cortado por tamanho]';

        let fontes = []; try { fontes = fontesDoBanco({ artigos: rr, aprovadas: rrUsadas, parametros: pf.parametros, funcionalidades: pf.funcionalidades, rotinas }); } catch (e) { /* só informação */ }
        const titulos = fontes.filter(f => f.tipo === 'banco' || f.tipo === 'rr' || f.tipo === 'param' || f.tipo === 'func').slice(0, 4).map(f => f.titulo);
        // Voz não tem como "apagar" o número depois de falado: por isso o código (número) de parâmetro/funcionalidade já sai do conhecimento entregue à IA (Prereq.semCodigo; os rótulos "[PARÂMETRO 1]" ficam como estão).
        try { if (typeof Prereq !== 'undefined' && Prereq.semCodigo) t = Prereq.semCodigo(t); } catch (e) { /* segue com o texto original */ }
        return { texto: t, encontrou: !vum, fontes, titulos };
    }

    return { consultar, esperarBase };
})();
window.VozConsulta = VozConsulta;
