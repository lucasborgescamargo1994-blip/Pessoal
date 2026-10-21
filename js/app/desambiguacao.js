/* js/app/desambiguacao.js — "Você quer saber sobre A ou sobre B?": pergunta vaga → botões para a pessoa escolher antes da resposta.

   Por que existe: uma pergunta curta como "preciso habilitar emissor de nf-e" pode ser sobre o MÓDULO de emissão ou sobre o ERRO "emissor não
   habilitado". Em vez de a IA chutar (e acertar só às vezes), o chat mostra os assuntos candidatos como botões e responde só sobre o escolhido.

   Como decide (SEM IA — não gasta cota do provedor): usa a busca por significado (Jina) que o chat JÁ faz para montar a resposta, então não
   acrescenta nenhuma chamada de rede. Pergunta quando, ao mesmo tempo:
     • a busca foi por significado, a pergunta é curta (poucos termos), sem número/código e não parece continuação da conversa;
     • nenhum resultado (artigo, repositório, aprendizado ou resposta aprovada pela equipe) é uma certeza (semelhança >= "certeza");
     • há 2+ artigos DIFERENTES empatados com o primeiro (diferença <= "margem"); títulos quase iguais contam como o mesmo assunto,
       exceto quando um é "erro/problema" e o outro é "como fazer";
     • a pergunta não é praticamente o título de um deles (aí a pessoa já foi clara).
   Quem escolhe: a pergunta é refeita (sem repetir a bolha, o log nem o cálculo do embedding) com o artigo escolhido em 1º lugar e os outros
   candidatos tirados do prompt — resposta mais precisa e com menos ruído. "Nenhum desses" tira os candidatos e a IA pede mais detalhes.
   Os limites ficam em config/mcp-config.js → "desambiguacao" (aba "IA / MCP" do painel; o Simulador mostra os assuntos e as porcentagens).
   A pessoa liga/desliga em Personalizar. */
const Desamb = (() => {
    const PADRAO = { ativo: true, margem: 0.04, certeza: 0.82, minSimilaridade: 0.5, maxOpcoes: 3, maxTermos: 7 };
    const CTX = new Map();          // cartões na tela: id → { query, opcoes, vp, logTs }
    const RETRY = new Map();        // opções da 2ª passada guardadas para o botão "Tentar novamente"
    const perguntadas = new Set();  // perguntas (normalizadas) que já viraram cartão nesta sessão: não pergunta de novo a mesma coisa
    // começo de frase que mostra que a pessoa está CONTINUANDO o assunto anterior ("e para MDF-e?", "mas isso não funciona")
    const CONECTIVO = /^(e|mas|entao|tambem|isso|esse|essa|esses|essas|ele|ela|eles|elas|ainda|nesse|nessa|neste|nesta|aquele|aquela|outro|outra|alem)\b/;

    function cfg() {
        const c = (typeof MCP_CFG !== 'undefined' && MCP_CFG && MCP_CFG.desambiguacao) || {};
        return Object.assign({}, PADRAO, c);
    }
    function ligadoParaPessoa() { try { return Prefs.get('desambiguar') !== false; } catch (e) { return true; } }

    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const tituloDe = r => String((r && (r.erro || r.titulo)) || '').replace(/\s+/g, ' ').trim();
    const idDe = r => (r && r.idSupabase != null) ? r.idSupabase : (r && r.id != null ? r.id : null);
    const termosDe = t => { try { return RRMatch.preparar(t).termos; } catch (e) { return semAcento(t).split(/[^a-z0-9]+/).filter(x => x.length > 2); } };
    const jaccard = (a, b) => { try { return RRMatch.jaccard(a, b); } catch (e) { const B = new Set(b); let i = 0; new Set(a).forEach(x => { if (B.has(x)) i++; }); const u = new Set(a).size + B.size - i; return u ? i / u : 0; } };

    // Que tipo de assunto é pelo título: erro/problema, passo a passo ("como…"), ou outro (ícone do botão e regra de "mesmo assunto")
    function tipoDoTitulo(titulo) {
        const n = semAcento(titulo).trim();
        if (/^(erro|rejeicao|problema|falha|aviso|mensagem|nao (consigo|esta|foi|aparece|funciona|deu|permite)|por que|porque)\b/.test(n)) return 'erro';
        if (/^(como|passo a passo|onde|qual|quais|para que serve|o que (e|significa))\b/.test(n)) return 'como';
        return 'outro';
    }
    const ICONE = { erro: '⚠️', como: '🛠️', outro: '📄' };

    // Decide se vale perguntar. Devolve { perguntar:false, motivo } ou { perguntar:true, opcoes:[{id,titulo,sim,tipo,similares}], motivo }.
    //   rr       tudo que o chat achou (cada item com similaridade 0–1; pode ter repositório/aprendizado)     rrUsadas  respostas aprovadas usadas como contexto ([{item,score}])
    //   o        { vetorial, temHistorico }   (temHistorico = a conversa já tem alguma resposta da IA)
    function avaliar(query, rr, rrUsadas, o) {
        o = o || {};
        const c = cfg();
        const nao = motivo => ({ perguntar: false, motivo });
        if (c.ativo === false) return nao('desligada na configuração');
        if (!ligadoParaPessoa()) return nao('desligada pela pessoa (Personalizar)');
        if (!o.vetorial) return nao('busca por palavra-chave (sem significado)');
        const alvo = RRMatch.preparar(query);
        const nTermos = alvo.termos.length;
        if (nTermos < 1) return nao('sem termos');
        if (nTermos > c.maxTermos) return nao('pergunta detalhada (' + nTermos + ' termos)');
        if (/\d{3,}/.test(alvo.norm)) return nao('tem número/código específico');
        if (perguntadas.has(alvo.norm)) return nao('essa mesma pergunta já gerou botões nesta sessão');
        if (o.temHistorico && (CONECTIVO.test(alvo.norm) || nTermos <= 2)) return nao('parece continuação da conversa');
        if ((rrUsadas || []).some(x => x && x.score >= c.certeza)) return nao('há resposta aprovada com cara de certeza');

        // 1) existe alguma certeza em QUALQUER fonte (artigo, repositório, aprendizado)? então não há o que perguntar
        const todos = (rr || []).filter(r => r && !r._reforcoPalavraChave);
        const topoGlobal = todos.reduce((m, r) => Math.max(m, r.similaridade || 0), 0);
        if (topoGlobal >= c.certeza) return nao('há um resultado com cara de certeza (' + Math.round(topoGlobal * 100) + '%)');

        // 2) candidatos = artigos do banco de dados (só eles viram botão)
        const cands = todos
            .filter(r => !r.isRepositorio && !r.isML && idDe(r) != null && tituloDe(r) && (r.similaridade || 0) >= c.minSimilaridade)
            .sort((a, b) => b.similaridade - a.similaridade);
        if (cands.length < 2) return nao('menos de 2 assuntos candidatos');
        const topo = cands[0];
        if (topoGlobal - topo.similaridade > c.margem + 1e-9) return nao('um conteúdo de outra fonte (repositório/aprendizado) é claramente melhor');

        const escolhidos = [], termosEscolhidos = [];
        for (const r of cands) {
            if (topo.similaridade - r.similaridade > c.margem + 1e-9) break;   // ordenado: dali em diante ficam longe demais do 1º
            const t = tituloDe(r), tm = termosDe(t), nt = semAcento(t), tipo = tipoDoTitulo(t);
            // mesmo assunto = mesmo artigo, mesmo título ou títulos quase iguais DO MESMO TIPO ("Erro ao…" x "Como…" são assuntos diferentes, mesmo parecidos)
            const k = escolhidos.findIndex((e, i) => String(e.id) === String(idDe(r)) || semAcento(e.titulo) === nt || (() => { const j = jaccard(tm, termosEscolhidos[i]); return j >= 0.9 || (j >= 0.7 && e.tipo === tipo); })());
            if (k >= 0) { if (String(escolhidos[k].id) !== String(idDe(r))) escolhidos[k].similares.push(idDe(r)); continue; }
            if (escolhidos.length >= c.maxOpcoes) continue;   // (segue lendo só para juntar os quase-iguais dos botões já escolhidos)
            escolhidos.push({ id: idDe(r), titulo: t, sim: r.similaridade, tipo, similares: [] });
            termosEscolhidos.push(tm);
        }
        if (escolhidos.length < 2) return nao('os candidatos são o mesmo assunto');
        // pergunta de uma palavra só: só vale perguntar se os assuntos são de natureza diferente (erro x como fazer)
        if (nTermos === 1 && new Set(escolhidos.map(e => e.tipo)).size < 2) return nao('pergunta de uma palavra e assuntos do mesmo tipo');
        // a pergunta já é (quase) o título de UM deles e bem menos parecida com os outros → a pessoa foi clara
        const lex = escolhidos.map((e, i) => jaccard(alvo.termos, termosEscolhidos[i])).sort((a, b) => b - a);
        if (lex[0] >= 0.8 && lex[0] - lex[1] >= 0.25) return nao('a pergunta é praticamente o título de um dos assuntos');
        return { perguntar: true, opcoes: escolhidos, motivo: 'empate entre ' + escolhidos.length + ' assuntos (' + escolhidos.map(e => Math.round(e.sim * 100) + '%').join(' / ') + ')' };
    }

    function corta(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }

    // Mostra o cartão com os botões. o: { vp, logTs }
    function mostrar(query, av, o) {
        o = o || {};
        const id = 'dsb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        CTX.set(id, { query, opcoes: av.opcoes, vp: o.vp || null, logTs: o.logTs === undefined ? null : o.logTs });
        try { perguntadas.add(RRMatch.preparar(query).norm); } catch (e) { /* só deixa de lembrar */ }
        const card = document.createElement('div');
        card.className = 'answer-card desamb-card';
        card.dataset.desambCtx = id;
        card.setAttribute('role', 'group');
        card.setAttribute('aria-live', 'polite');
        card.setAttribute('aria-labelledby', id + 'h');
        const ops = av.opcoes.map((op, i) =>
            `<button type="button" class="desamb-op" data-i="${i}" onclick="desambEscolher(this)"><span class="desamb-ic" aria-hidden="true">${ICONE[op.tipo] || ICONE.outro}</span><span class="desamb-tx">${escapeHtml(corta(op.titulo, 160))}</span></button>`).join('');
        card.innerHTML = `<div class="desamb-head" id="${id}h"><span aria-hidden="true">🤔</span> Para eu acertar a resposta: qual é o seu caso?</div>
            <div class="desamb-sub">Sua pergunta pode ser sobre mais de um assunto. Escolha o que mais se parece com o que você precisa:</div>
            <div class="desamb-lista">${ops}<button type="button" class="desamb-op desamb-nenhuma" data-i="-1" onclick="desambEscolher(this)"><span class="desamb-ic" aria-hidden="true">🤷</span><span class="desamb-tx">Nenhum desses — é outra coisa</span></button></div>`;
        // o título completo vai no tooltip (pelo DOM: o escapeHtml do chat não escapa aspas, então nada de montar atributo em texto)
        card.querySelectorAll('.desamb-op[data-i]').forEach(b => { const i = parseInt(b.dataset.i, 10); if (i >= 0 && av.opcoes[i]) b.title = av.opcoes[i].titulo; });
        document.getElementById('chatStream').appendChild(card);
        if (typeof scrollToBottom === 'function') scrollToBottom(true);
        // (sem foco automático nos botões: a pessoa pode já estar digitando a próxima pergunta, e Espaço/Enter escolheria o 1º assunto sem querer)
        return card;
    }

    // Clique num botão do cartão
    async function escolher(btn) {
        const card = btn && btn.closest ? btn.closest('.desamb-card') : null;
        const ctx = card && CTX.get(card.dataset.desambCtx);
        if (!ctx) return;                       // já respondido, apagado ou de outra conversa
        CTX.delete(card.dataset.desambCtx);     // (também impede o clique duplo)
        const i = parseInt(btn.dataset.i, 10);
        const op = i >= 0 ? ctx.opcoes[i] : null;
        card.classList.add('is-resolvido');
        card.removeAttribute('aria-live');
        card.innerHTML = `<div class="desamb-ok" role="status">${op ? '✅ Você escolheu: <b>' + escapeHtml(corta(op.titulo, 160)) + '</b>' : '↩️ Entendi — vou procurar de outra forma.'}</div>`;
        const fora = ctx.opcoes.filter((_, k) => k !== i);
        // quem recusou sai do prompt junto com os "quase iguais" que ficaram escondidos atrás dele
        const descartados = [].concat(...fora.map(x => [x.id].concat(x.similares || [])));
        console.log(`%c🤔 [desambiguação] ${op ? 'escolheu #' + op.id + ' — ' + op.titulo : 'nenhum dos assuntos'}`, 'color:#7c3aed;font-weight:600;');
        // a linha de log passa a dizer qual assunto foi escolhido: a Revisão não pode transformar a pergunta vaga numa resposta rápida de UM só assunto
        if (!BSOFT_SIM && ctx.logTs) {
            const marca = op ? ' [assunto: ' + corta(op.titulo, 120) + ']' : ' [nenhum dos assuntos sugeridos]';
            try { sb.from('logs').update({ pergunta: ctx.query + marca }).eq('timestamp', ctx.logTs).then(() => {}, () => {}); } catch (e) { /* o log é só informação */ }
        }
        // devolve o foco ao campo de digitação (o botão clicado saiu da tela)
        try { const inp = document.getElementById('searchInput'); if (inp && window.innerWidth > 768) inp.focus({ preventScroll: true }); } catch (e) { /* conforto */ }
        const opts = {
            pergunta: ctx.query, reutilizarMensagem: true, desambiguado: true, vetor: ctx.vp, logTs: ctx.logTs,
            foco: op ? { id: op.id, titulo: op.titulo } : null,
            descartados, nenhuma: !op, titulosDescartados: fora.map(x => x.titulo)
        };
        try { await handleChat(opts); }
        catch (e) {
            console.error('[desambiguação] a resposta falhou:', e);
            appendMessage('ai', `😕 Não consegui responder agora. <button type="button" onclick="this.closest('.message').remove();Desamb.refazer('${guardarOpts(opts)}')" style="margin-left:6px;padding:4px 12px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:12.5px;">🔄 Tentar novamente</button>`);
        }
    }

    function guardarOpts(opts) { const k = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); RETRY.set(k, opts); return k; }
    function refazer(k) { const o = RETRY.get(k); return o ? handleChat(Object.assign({}, o)) : undefined; }

    // Se a pessoa digitou outra coisa sem escolher, os botões antigos ficam apagados (não fazem mais sentido)
    function encerrarPendentes() {
        document.querySelectorAll('.desamb-card:not(.is-resolvido)').forEach(card => {
            CTX.delete(card.dataset.desambCtx);
            card.classList.add('is-resolvido');
            card.removeAttribute('aria-live');
            card.innerHTML = '<div class="desamb-ok">⏭️ Pergunta anterior: você seguiu para outro assunto.</div>';
        });
    }
    // Nova conversa / troca de conversa: os cartões saíram da tela, então os dados deles (inclui o vetor da pergunta) também saem da memória
    function limpar() { CTX.clear(); RETRY.clear(); perguntadas.clear(); }

    // 2ª passada: põe o escolhido em 1º e tira os outros candidatos da lista de artigos
    function aplicarEscolha(rr, opts, bancoVetorizado) {
        let lista = Array.isArray(rr) ? rr.slice() : [];
        const tirar = new Set((opts.descartados || []).map(String));
        lista = lista.filter(r => !tirar.has(String(idDe(r))));
        if (opts.foco && opts.foco.id != null) {
            const alvoId = String(opts.foco.id);
            let escolhido = lista.find(r => String(idDe(r)) === alvoId);
            if (!escolhido) {
                const base = (bancoVetorizado || []).find(r => String(idDe(r)) === alvoId);
                if (base) escolhido = Object.assign({}, base, { similaridade: base.similaridade || 0.9 });
            }
            if (escolhido) {
                lista = lista.filter(r => r !== escolhido);
                // 0.9 é só o rótulo "confirmado pela pessoa" no prompt; a semelhança de verdade fica em _simReal (é ela que vai para o log)
                lista.unshift(Object.assign({}, escolhido, { _simReal: escolhido.similaridade || 0, similaridade: Math.max(escolhido.similaridade || 0, 0.9), _escolhidoPeloUsuario: true }));
            }
        }
        return lista;
    }

    // 2ª passada: respostas APROVADAS sobre o assunto recusado também saem do prompt (senão elas, que vêm antes dos artigos, puxariam a resposta para o assunto errado)
    function filtrarAprovadas(usadas, opts) {
        if (!Array.isArray(usadas) || !usadas.length || !opts || !opts.desambiguado) return usadas;
        const fora = (opts.titulosDescartados || []).filter(Boolean).map(termosDe);
        if (!fora.length) return usadas;
        const tf = opts.foco && opts.foco.titulo ? termosDe(opts.foco.titulo) : null;
        return usadas.filter(x => {
            const it = x && x.item; if (!it) return true;
            const perguntas = [it.pergunta].concat(Array.isArray(it.variantes) ? it.variantes : []).filter(Boolean).map(termosDe);
            const simFora = Math.max(0, ...perguntas.map(p => Math.max(...fora.map(f => jaccard(p, f)))));
            if (!tf) return simFora < 0.4;                                   // "nenhum desses": some o que se parece com qualquer assunto recusado
            const simFoco = Math.max(0, ...perguntas.map(p => jaccard(p, tf)));
            return !(simFora >= 0.25 && simFora > simFoco);                  // escolheu um: some o que é mais parecido com o recusado do que com o escolhido
        });
    }

    // Trecho que entra no prompt da IA depois da escolha
    function textoEsclarecimento(opts) {
        if (!opts || !opts.desambiguado) return '';
        if (opts.foco && opts.foco.titulo) {
            return `\n✅ ESCLARECIMENTO DO CLIENTE: a pergunta podia ter mais de um sentido e o cliente CONFIRMOU que quer saber sobre: "${opts.foco.titulo}". Responda SOMENTE sobre esse assunto, usando principalmente o artigo [RELEVANTE 1]. Não comente os outros assuntos possíveis e não peça para esclarecer de novo.\n`;
        }
        const lista = (opts.titulosDescartados || []).filter(Boolean).map(t => `"${t}"`).join('; ');
        return `\nℹ️ ESCLARECIMENTO DO CLIENTE: a pergunta podia ter mais de um sentido e o cliente disse que NÃO é nenhum destes assuntos: ${lista || '(os sugeridos)'}. Não responda sobre eles. Se o restante do conhecimento não resolver, peça com gentileza mais detalhes (o que ele quer fazer ou qual mensagem aparece na tela).\n`;
    }

    return { avaliar, mostrar, escolher, encerrarPendentes, limpar, aplicarEscolha, filtrarAprovadas, textoEsclarecimento, guardarOpts, refazer, tipoDoTitulo, PADRAO };
})();
function desambEscolher(btn) { return Desamb.escolher(btn); }
