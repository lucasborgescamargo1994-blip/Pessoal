/* js/app/esclarecimento.js — A IA pergunta com BOTÕES antes de dizer "não encontrei": "Em qual tela você está?  [Transporte > Documentos > Ct-e] [Transporte > Conhecimentos]".

   Por que existe: uma pergunta vaga ("não aparece a opção de simplificado no tipo do CT-e, como habilito?") muitas vezes só se resolve depois de um dado a mais
   (qual tela, qual documento, qual mensagem). Antes, a IA respondia "não encontrei, informe X, Y e Z" em texto e a pessoa tinha de digitar tudo de novo.
   Agora a IA faz UMA pergunta curta e oferece opções clicáveis; o clique refaz a busca com a pergunta REFINADA (original + esclarecimento) e leva à resposta.

   Como funciona (diferente da desambiguação, js/app/desambiguacao.js, que decide SEM IA pelos resultados da busca):
     • o chat decide o MODO (modo()): 'preferido' quando o manual não achou nada (em vez de "não encontrei"), 'permitido' quando só achou algo fraco,
       'proibido' quando há resposta forte, na chamada de voz, em "pesquisar com a IA", depois de escolher um assunto nos botões "qual é o seu caso?"
       e quando já foram feitas as rodadas máximas (padrão 2);
     • textoRegra(modo) é o trecho que entra no prompt: ensina a IA a terminar a resposta com o marcador  [[BOTOES: opção 1 | opção 2 | opção 3]];
     • quando a resposta chega, extrair() tira o marcador do texto (ocultarParcial() faz o mesmo ENQUANTO ela é escrita, para o marcador nunca piscar na tela);
     • mostrar() desenha as opções (mais "Outra resposta" e "Não sei"); escolher() compõe a pergunta refinada e chama o handleChat de novo;
     • se a pessoa DIGITAR a resposta em vez de clicar (consumirDigitada), vale do mesmo jeito — desde que pareça uma resposta curta e não uma pergunta nova.
   A pessoa liga/desliga em Personalizar; a equipe, em config/mcp-config.js → "esclarecimento" (aba "IA / MCP" do painel). */
const Esc = (() => {
    const PADRAO = { ativo: true, maxRodadas: 2, maxOpcoes: 5 };
    const MAX_CHARS_OPCAO = 70;
    const MAX_CHARS_REFINADA = 600;
    const CTX = new Map();      // blocos de botões na tela: id → { base, pergunta, opcoes, rodadas, formato }

    function cfg() {
        const c = (typeof MCP_CFG !== 'undefined' && MCP_CFG && MCP_CFG.esclarecimento) || {};
        const o = Object.assign({}, PADRAO, c);
        o.maxRodadas = Math.min(4, Math.max(1, parseInt(o.maxRodadas, 10) || PADRAO.maxRodadas));
        o.maxOpcoes = Math.min(6, Math.max(2, parseInt(o.maxOpcoes, 10) || PADRAO.maxOpcoes));
        return o;
    }
    function ligadoParaPessoa() { try { return Prefs.get('esclarecer') !== false; } catch (e) { return true; } }
    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const corta = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

    // ── decisão ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    // o: { vum (nada achado no manual), trb (resposta forte), voz, forcarIA, expansao, desambiguado, rodadas }  →  'proibido' | 'permitido' | 'preferido'
    function modo(o) {
        o = o || {};
        const c = cfg();
        if (c.ativo === false || !ligadoParaPessoa()) return 'proibido';
        if (o.voz || o.forcarIA || o.expansao || o.desambiguado) return 'proibido';   // sem como clicar / pediu a busca funda / já escolheu o assunto / repassada interna
        if ((o.rodadas || 0) >= c.maxRodadas) return 'proibido';
        if (o.vum) return 'preferido';
        if (o.trb) return 'proibido';
        return 'permitido';
    }

    // Trecho que entra no prompt. 'proibido' = nada (ou, se já houve rodadas, a ordem de responder de uma vez).
    function textoRegra(m, rodadas) {
        rodadas = rodadas || 0;
        if (m === 'proibido') {
            if (rodadas > 0) return `\n💬 ESCLARECIMENTO JÁ FEITO: o cliente já respondeu ${rodadas} pergunta(s) de esclarecimento sobre este assunto (veja a pergunta, que já traz as respostas dele). NÃO faça mais perguntas nem use o marcador [[BOTOES: …]]: responda AGORA com o melhor que o conhecimento permite. Se mesmo assim o conhecimento não tiver a solução, diga com gentileza que não encontrou e peça para reformular a pergunta ou falar com o suporte.\n`;
            return '';
        }
        const c = cfg();
        const quando = m === 'preferido'
            ? `O conhecimento abaixo NÃO responde diretamente à pergunta. Em vez de dizer "não encontrei" ou de pedir uma lista de informações em texto, GUIE o cliente até a solução: faça UMA pergunta curta de esclarecimento com BOTÕES para ele clicar. Só diga que não encontrou se NENHUMA pergunta ajudaria (por exemplo, assunto que não tem relação com o Bsoft TMS).`
            : `Se o conhecimento responde claramente à pergunta, responda direto (sem perguntar nada). Só faça a pergunta de esclarecimento com BOTÕES quando a pergunta do cliente for vaga e houver mais de um caminho ou solução possível dependendo do que ele responder.`;
        return `\n💬 ESCLARECIMENTO COM BOTÕES — ${m === 'preferido' ? 'PREFERIDO' : 'PERMITIDO'} (ESTA INSTRUÇÃO TEM PRIORIDADE sobre a regra 2, sobre a regra 5 e sobre o modo curto/completo). ${quando}
COMO PERGUNTAR:
1. Escreva UMA pergunta curta (no máximo 2 frases), simples e específica, sobre o dado que falta para achar a solução: qual tela ou rotina ele usa, qual tipo de documento (CT-e, MDF-e, NF-e…), qual mensagem de erro aparece, em que momento acontece, qual opção ou campo ele vê.
2. Na ÚLTIMA linha da resposta, escreva o marcador exatamente assim: [[BOTOES: opção 1 | opção 2 | opção 3]]
   • de 2 a ${c.maxOpcoes} opções, separadas por " | ", cada uma curta (até 60 caracteres) e que o cliente possa escolher com um clique;
   • as opções precisam separar caminhos de verdade e vir do CONHECIMENTO fornecido (caminhos de menu reais, tipos de documento, situações ou mensagens que existem no sistema) — NUNCA invente tela, menu, campo ou mensagem;
   • não coloque "Outro", "Não sei" nem "Nenhuma": o sistema já acrescenta esses botões.
3. Nessa resposta NÃO dê parte da solução, NÃO escreva "não encontrei" e NÃO escreva #finalizado: só a pergunta e o marcador.
4. Se o HISTÓRICO já tiver uma pergunta de esclarecimento sobre o mesmo ponto, não repita: use o que o cliente respondeu.${rodadas > 0 ? `
5. O cliente JÁ respondeu ${rodadas} esclarecimento(s): a PERGUNTA abaixo traz as perguntas e as respostas dele. Só faça outra pergunta se for sobre um ponto NOVO e DIFERENTE; nunca repita nem reformule uma pergunta já respondida, nem as mesmas opções. Se não houver mais o que perguntar, responda com o que o conhecimento tem (ou diga com gentileza que não encontrou e peça para reformular).` : ''}
Exemplo do formato (as opções vêm do SEU conhecimento; não copie estas):
Qual documento está dando erro?
[[BOTOES: CT-e | MDF-e | NF-e]]
`;
    }

    // ── leitura da resposta da IA ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const RE_MARCADOR = /(?:\*\*|__)?\[\[\s*(?:BOT[OÕ]ES|OP[CÇ][OÕ]ES|BUTTONS?)\s*[:：]?\s*([\s\S]*?)(?:\]\]|$)(?:\*\*|__)?/i;
    const RE_MARCADOR_TODOS = new RegExp(RE_MARCADOR.source, 'gi');

    function limpaOpcao(t) {
        t = String(t || '').replace(/\s+/g, ' ').trim()
            .replace(/^(?:[-*•▪◦]+|\d+[.)])\s*/, '')                // marcador de lista
            .replace(/^(?:\*\*|__|`|"|'|“|‘)+|(?:\*\*|__|`|"|'|”|’)+$/g, '')   // aspas e negrito em volta
            .replace(/[.;,]+$/, '')
            .trim();
        return corta(t, MAX_CHARS_OPCAO);
    }
    // "Outro", "Não sei", "Nenhum desses": o sistema já tem esses botões (só descarta quando a opção é ISSO e nada mais — "Outros Valores" é uma opção legítima)
    const ehOutra = t => /^(outr[oa]s?|nao sei( informar)?|nenhum[a]?( dess[ea]s?)?|nada disso|nenhuma das (opcoes|anteriores))$/.test(semAcento(t).replace(/[.!…]+$/, '').trim());

    // texto da IA → { texto (sem o marcador), opcoes (lista de 2+ ou null) }. Pega o ÚLTIMO marcador; qualquer marcador solto é removido do texto.
    function extrair(texto) {
        let t = String(texto == null ? '' : texto);
        let achados = [], m; RE_MARCADOR_TODOS.lastIndex = 0;
        while ((m = RE_MARCADOR_TODOS.exec(t)) !== null) { achados.push(m[1]); if (m[0] === '') RE_MARCADOR_TODOS.lastIndex++; }
        if (!achados.length) return { texto: t, opcoes: null };
        const limpo = t.replace(RE_MARCADOR_TODOS, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        const bruto = achados[achados.length - 1];
        const c = cfg(), vistos = new Set(), opcoes = [];
        String(bruto).split(/\s*\|\s*|\s*\n\s*/).forEach(p => {
            const o = limpaOpcao(p), k = semAcento(o);
            if (!o || ehOutra(o) || vistos.has(k)) return;
            vistos.add(k); opcoes.push(o);
        });
        return { texto: limpo, opcoes: opcoes.length >= 2 ? opcoes.slice(0, c.maxOpcoes) : null };
    }

    // Enquanto a resposta ainda está sendo escrita: tira da tela o marcador, mesmo incompleto ("…\n[[BOT"), para ele nunca aparecer.
    function ocultarParcial(texto) {
        const t = String(texto == null ? '' : texto);
        const i = t.lastIndexOf('[[');
        if (i >= 0) {
            const resto = semAcento(t.slice(i + 2)).trimStart().toUpperCase();
            const inicio = resto.replace(/[^A-Z].*$/s, '');            // só as letras do começo (BOTOES / OPCOES / BUTTONS…)
            const plausivel = /^(BOTOES|OPCOES|BUTTON|BUTTONS)/.test(resto) || (resto === inicio && ['BOTOES', 'OPCOES', 'BUTTONS'].some(p => p.startsWith(inicio)));
            if (plausivel) return t.slice(0, i).replace(/(?:\*\*|__)\s*$/, '').replace(/\s+$/, '');
        }
        return /\[$/.test(t) ? t.slice(0, -1).replace(/\s+$/, '') : t;   // o 1º "[" do marcador chegou sozinho: segura
    }

    // A pergunta que a IA fez (última frase com "?"; se não houver, o texto inteiro curto)
    function perguntaDe(texto) {
        const t = String(texto || '').replace(/\s+/g, ' ').trim();
        const frases = t.match(/[^.?!]*\?/g);
        return corta(frases && frases.length ? frases[frases.length - 1] : t, 160);
    }

    // A IA repetiu uma pergunta de esclarecimento que a pessoa JÁ respondeu? (mesmas palavras: ≥ 60% das palavras da pergunta nova estão numa anterior)
    // Nesse caso os botões não aparecem (ficaria um laço de "qual etiqueta?" → clique → "qual etiqueta?").
    const PALAVRAS_VAZIAS = new Set(['para', 'qual', 'quais', 'voce', 'esta', 'estao', 'essa', 'esse', 'isso', 'aqui', 'mais', 'como', 'qual', 'nao', 'que', 'uma', 'com', 'dos', 'das', 'pode', 'poderia', 'seria', 'tentando', 'ajudar', 'ajuda', 'melhor', 'informe', 'diga', 'favor']);
    const conteudo = t => new Set(semAcento(t).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !PALAVRAS_VAZIAS.has(w)));
    function repetida(texto, anteriores) {
        const novas = conteudo(perguntaDe(texto));
        if (novas.size < 2 || !Array.isArray(anteriores) || !anteriores.length) return false;
        return anteriores.some(a => { const ant = conteudo(a); if (!ant.size) return false; let hit = 0; novas.forEach(w => { if (ant.has(w)) hit++; }); return hit / novas.size >= 0.6; });
    }

    // Pergunta refinada = o que a pessoa perguntou + a pergunta de esclarecimento + a resposta dela (tudo numa linha só: a busca e o prompt usam este texto)
    function compor(base, pergunta, escolha, naoSabe) {
        const b = String(base || '').replace(/\s+/g, ' ').trim();
        const p = String(pergunta || '').replace(/\s+/g, ' ').trim();
        const e = naoSabe ? '(o cliente não soube informar)' : String(escolha || '').replace(/\s+/g, ' ').trim();
        let r = `${b} — ${p} ${e}`.trim();
        if (r.length > MAX_CHARS_REFINADA) { const sobra = Math.max(80, MAX_CHARS_REFINADA - (p.length + e.length + 4)); r = `${corta(b, sobra)} — ${p} ${e}`.trim(); }
        return r;
    }

    // O que a pessoa digitou parece a RESPOSTA do esclarecimento (curta, sem pergunta) ou uma pergunta nova?
    function pareceResposta(txt) {
        const t = String(txt || '').replace(/\s+/g, ' ').trim();
        if (!t) return false;
        if (/\?/.test(t)) return false;
        const n = semAcento(t);
        if (/^(como|onde|qual|quais|quando|por ?que|porque|o que|que |quem|posso|pode|preciso|quero|gostaria|consigo|existe|tem como|me (ajuda|explica|diz|diga)|explique|ensine|ajuda)\b/.test(n)) return false;
        return t.split(' ').length <= 10;
    }

    // ── tela ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

    // Desenha os botões dentro do cartão da resposta. info: { base, pergunta, opcoes, rodadas, formato }
    function mostrar(card, info) {
        const id = 'esc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        CTX.set(id, { base: info.base, pergunta: info.pergunta, perguntas: (info.perguntas && info.perguntas.length) ? info.perguntas.slice() : [info.pergunta], opcoes: info.opcoes.slice(), rodadas: info.rodadas || 0, formato: info.formato || null });
        const bloco = el('div', 'esc-bloco');
        bloco.dataset.escCtx = id;
        bloco.setAttribute('role', 'group');
        bloco.setAttribute('aria-live', 'polite');
        bloco.setAttribute('aria-label', 'Escolha uma opção para continuar');
        bloco.appendChild(el('div', 'esc-sub', 'Toque na opção que mais se parece com o seu caso:'));
        const lista = el('div', 'esc-lista');
        info.opcoes.forEach((op, i) => {
            const b = el('button', 'esc-op', op); b.type = 'button'; b.dataset.i = String(i); b.dataset.tipo = 'op'; b.title = op; b.setAttribute('onclick', 'escEscolher(this)');
            lista.appendChild(b);
        });
        const outra = el('button', 'esc-op esc-extra', '✍️ Outra resposta'); outra.type = 'button'; outra.dataset.tipo = 'digitar'; outra.title = 'Digite a sua resposta na caixa de mensagem'; outra.setAttribute('onclick', 'escEscolher(this)');
        const naoSei = el('button', 'esc-op esc-extra', '🤷 Não sei'); naoSei.type = 'button'; naoSei.dataset.tipo = 'naosei'; naoSei.title = 'Responder com o que o sistema já tem'; naoSei.setAttribute('onclick', 'escEscolher(this)');
        lista.append(outra, naoSei);
        bloco.appendChild(lista);
        const area = card.querySelector('.feedback-area');
        if (area) card.insertBefore(bloco, area); else card.appendChild(bloco);
        if (typeof scrollToBottom === 'function') scrollToBottom(true);
        return bloco;
    }

    function resolver(bloco, html) {
        bloco.classList.add('is-resolvido');
        bloco.removeAttribute('aria-live');
        bloco.textContent = '';
        bloco.appendChild(html);
    }

    async function escolher(btn) {
        const bloco = btn && btn.closest ? btn.closest('.esc-bloco') : null;
        const ctx = bloco && CTX.get(bloco.dataset.escCtx);
        if (!ctx) return;                                 // já respondido, apagado ou de outra conversa
        const tipo = btn.dataset.tipo;
        if (tipo === 'digitar') {                         // a pessoa quer escrever: só leva o cursor para a caixa (os botões continuam valendo)
            try { const inp = document.getElementById('searchInput'); if (inp) { inp.placeholder = 'Digite a sua resposta…'; inp.focus({ preventScroll: true }); } } catch (e) { /* conforto */ }
            return;
        }
        CTX.delete(bloco.dataset.escCtx);                 // (também impede o clique duplo)
        const naoSabe = tipo === 'naosei';
        const escolha = naoSabe ? '' : (ctx.opcoes[parseInt(btn.dataset.i, 10)] || btn.textContent);
        const ok = el('div', 'esc-ok');
        ok.setAttribute('role', 'status');
        if (naoSabe) ok.textContent = '🤷 Você não soube informar — vou responder com o que já tenho.';
        else { ok.append('✅ Você escolheu: ', Object.assign(document.createElement('b'), { textContent: corta(escolha, 120) })); }
        resolver(bloco, ok);
        console.log(`%c💬 [esclarecimento] ${naoSabe ? 'não sei' : 'escolheu: ' + escolha}`, 'color:#7c3aed;font-weight:600;');
        try { const inp = document.getElementById('searchInput'); if (inp && window.innerWidth > 768) inp.focus({ preventScroll: true }); } catch (e) { /* conforto */ }
        const opts = continuacao(ctx, escolha, naoSabe);
        try { await handleChat(opts); }
        catch (e) {
            console.error('[esclarecimento] a resposta falhou:', e);
            const k = (typeof Desamb !== 'undefined') ? Desamb.guardarOpts(Object.assign({}, opts, { reutilizarMensagem: true, formatoDecidido: !!opts.formato })) : null;
            if (typeof appendMessage === 'function') appendMessage('ai', '😕 Não consegui responder agora.' + (k ? ` <button type="button" onclick="this.closest('.message').remove();Desamb.refazer('${k}')" style="margin-left:6px;padding:4px 12px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:12.5px;">🔄 Tentar novamente</button>` : ''));
        }
    }

    // opções do handleChat para a passada seguinte (a pergunta refinada vira a pergunta da busca, do log e do prompt; a bolha mostra só o que a pessoa escolheu)
    function continuacao(ctx, escolha, naoSabe) {
        const c = cfg();
        const o = {
            pergunta: compor(ctx.base, ctx.pergunta, escolha, naoSabe),
            bolha: naoSabe ? 'Não sei informar' : escolha,
            esclarecimentos: naoSabe ? Math.max((ctx.rodadas || 0) + 1, c.maxRodadas) : (ctx.rodadas || 0) + 1,
        };
        if (ctx.formato === 'curta' || ctx.formato === 'completa') o.formato = ctx.formato;   // quem já escolheu (ou fixou) o formato não escolhe de novo
        o.perguntasEsc = (ctx.perguntas && ctx.perguntas.length ? ctx.perguntas : [ctx.pergunta]).slice();   // perguntas de esclarecimento já respondidas (a IA não pode repeti-las)
        return o;
    }

    // O último bloco ainda sem resposta (o mais recente na tela)
    function pendente() {
        const todos = document.querySelectorAll('.esc-bloco:not(.is-resolvido)');
        const b = todos.length ? todos[todos.length - 1] : null;
        return b && CTX.has(b.dataset.escCtx) ? b : null;
    }

    // A pessoa DIGITOU em vez de clicar: se parece a resposta do esclarecimento, vale como se tivesse clicado. Devolve { refinada, opts } ou null.
    function consumirDigitada(query, opts) {
        if (!query || (opts && opts.pergunta)) return null;      // chamadas internas (botões, tentar de novo) nunca são "digitadas"
        const bloco = pendente();
        if (!bloco || !pareceResposta(query)) return null;
        const ctx = CTX.get(bloco.dataset.escCtx);
        CTX.delete(bloco.dataset.escCtx);
        const ok = el('div', 'esc-ok'); ok.setAttribute('role', 'status');
        ok.append('✍️ Você respondeu: ', Object.assign(document.createElement('b'), { textContent: corta(query, 120) }));
        resolver(bloco, ok);
        console.log(`%c💬 [esclarecimento] resposta digitada: ${query}`, 'color:#7c3aed;font-weight:600;');
        const o = continuacao(ctx, query, false);
        return { refinada: o.pergunta, opts: { esclarecimentos: o.esclarecimentos, formato: o.formato, perguntasEsc: o.perguntasEsc } };
    }

    // A pessoa seguiu para outro assunto sem responder: os botões antigos saem de cena
    function encerrarPendentes() {
        document.querySelectorAll('.esc-bloco:not(.is-resolvido)').forEach(b => {
            CTX.delete(b.dataset.escCtx);
            resolver(b, el('div', 'esc-ok', '⏭️ Pergunta anterior: você seguiu para outro assunto.'));
        });
    }
    // Nova conversa / troca de conversa: os blocos saíram da tela, então os dados deles também saem da memória
    function limpar() { CTX.clear(); }

    return { PADRAO, cfg, modo, textoRegra, extrair, ocultarParcial, perguntaDe, repetida, compor, pareceResposta, mostrar, escolher, continuacao, consumirDigitada, encerrarPendentes, pendente, limpar };
})();
function escEscolher(btn) { return Esc.escolher(btn); }
