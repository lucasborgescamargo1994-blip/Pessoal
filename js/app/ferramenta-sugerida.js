/* js/app/ferramenta-sugerida.js — "Não encontrei no banco de dados, mas esta ferramenta resolve": recomenda a ferramenta certa quando a pessoa usa a opção errada.

   Por que existe: muita gente faz no chat uma pergunta que é de uma FERRAMENTA ("Rejeição NF-e 745", "como criar uma regra", "gerar relatório .dat", "qual parâmetro habilita…") e, mesmo quando
   o sistema oferece a ferramenta, insiste em "consultar no banco de dados". Quando o banco não tem a resposta, em vez de a IA tentar adivinhar (e gastar cota), o chat mostra:
     "Não encontrei no banco de dados essa informação, porém como se trata de rejeição você pode encontrar a solução clicando aqui: [Erros SEFAZ]"
   O botão abre a ferramenta — e, quando a pergunta já traz tudo (rejeição: tipo do documento + código), abre DIRETO na resposta; senão abre a ferramenta normal para a pessoa pesquisar.
   Nada aqui usa IA: a decisão é por regras (não gasta cota e responde na hora).

   Quando entra (chamado pelo handleChat, js/app/chat.js, depois da busca no banco):
     • o banco não achou nada que sirva ("vum") e o assunto da pergunta é de uma ferramenta; ou
     • rejeição com tipo + código identificados e NENHUM artigo/resposta aprovada cita aquele código (o banco achou algo parecido, mas não a rejeição pedida).
   Não entra: 2ª passada/nova tentativa, "pesquisar com a IA", chamada de voz (não dá para clicar) nem quando a pessoa desligou em Personalizar ("Recomendar a ferramenta certa").
   O cartão tem o botão "Quero que a IA tente responder mesmo assim" (volta ao caminho de sempre) e o 👍/👎. Cada ferramenta é uma linha da tabela FERRAMENTAS (como detecta, o que fala, como abre). */
const FerrSug = (() => {
    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const html = s => escapeHtml(String(s == null ? '' : s));   // (o escapeHtml do chat não escapa aspas: nunca vai para dentro de atributo)

    function ligadoParaPessoa() { try { return Prefs.get('ferramentaSugerida') !== false; } catch (e) { return true; } }
    const temAbas = () => { try { return typeof Ferr !== 'undefined' && Ferr.disponivel(); } catch (e) { return false; } };
    const oculta = id => { try { return (Prefs.get('hidden') || []).includes(id); } catch (e) { return false; } };   // escondida em Personalizar › Ferramentas visíveis
    const semSimulador = () => !window.BSOFT_SIM;

    // ── rejeição SEFAZ: tipo do documento e código, tirados da pergunta SÓ quando dá para ter certeza ──
    // (siglas e nomes por extenso inequívocos: "nota fiscal" solta pode ser NF-e ou NFS-e, então não conta)
    const TIPOS = [
        ['NFS-e', /\bnfs-?e\b|\bnotas? fisca(?:l|is) (?:eletronicas? )?de servicos?(?: eletronicas?)?\b|\bnota de servico\b/],
        ['MDF-e', /\bmdf-?e\b|\bmanifestos? eletronicos?\b/],
        ['CT-e', /\bct-?e\b|\bconhecimentos? de transporte\b/],
        ['NF-e', /\bnf-?e\b|\bnotas? fisca(?:l|is) eletronicas?\b/],
    ];
    function tiposCitados(n) {
        let t = n; const out = [];
        TIPOS.forEach(([nome, re]) => { if (re.test(t)) { out.push(nome); t = t.replace(new RegExp(re.source, 'g'), ' '); } });
        return out;   // mais de um tipo na mesma pergunta = não dá para saber qual é a rejeição: a ferramenta abre normal
    }
    // Código da rejeição: o número logo DEPOIS de "rejeição", "rejeitada", "erro", "código", "cStat" ou "SEFAZ" (até 14 caracteres no meio: "rejeição NF-e 745", "erro: 539"), ou a pergunta ser só o
    // tipo + o número ("cte 539", "745 nfe"). Número ANTES da palavra ("CT-e 1234 rejeitado") é número de documento e não vale; chave de acesso, CNPJ, data e valor ficam de fora.
    function codigoDaRejeicao(n) {
        const t = ' ' + n.replace(/\b\d{15,}\b/g, ' ').replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, ' ').replace(/\b\d{2}[./-]\d{2}[./-]\d{2,4}\b/g, ' ').replace(/\d+[.,]\d+/g, ' ') + ' ';
        const m = /\b(?:rejeicao|rejeicoes|rejeitad[oa]s?|erro|codigo|cstat|sefaz)\b[^\d]{0,14}?\b(e?\d{3,4})\b/.exec(t);
        if (m) return m[1];
        const resto = t.replace(/\bnfs-?e\b|\bmdf-?e\b|\bct-?e\b|\bnf-?e\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
        const s = /^(?:(?:erro|rejeicao|codigo|cod|de|do|da|no|na|o|a)\s+)*(e?\d{3,4})(?:\s+(?:erro|rejeicao|codigo|cod|de|do|da|no|na|o|a))*$/.exec(resto);
        return s ? s[1] : '';
    }
    // O banco de dados (artigos achados + respostas aprovadas) fala DESTE código? Número solto não conta se for parte de valor ("745,00") ou de outro número.
    function bancoTemOCodigo(rr, rrUsadas, codigo) {
        const cod = String(codigo || '').toLowerCase().replace(/^e/, '').replace(/^0+(?=\d)/, '');
        if (!/^\d+$/.test(cod)) return true;   // sem código não há o que conferir
        const re = new RegExp('(?:^|[^0-9.,])0*' + cod + '(?![0-9]|[.,][0-9])');
        const tem = t => re.test(semAcento(t));
        return (Array.isArray(rr) ? rr : []).some(r => r && tem([r.erro, r.titulo, r.solucao, r.conteudo, r.emitir].filter(Boolean).join(' ')))
            || (Array.isArray(rrUsadas) ? rrUsadas : []).some(x => x && x.item && tem(String(x.item.pergunta || '') + ' ' + String(x.item.resposta || '')));
    }

    // Como abrir a ferramenta: na aba (Ferr.abrir) ou, onde não há abas (Copilot), no próprio chat — igual ao card da tela inicial.
    const abrirAba = (id, o) => Ferr.abrir(id, Object.assign({ beside: true }, o));
    const abrirTab = id => { try { Workspace.open(id, { beside: true }); } catch (e) { console.warn('[ferramenta sugerida] não consegui abrir a aba', id, e); } };

    // Cada ferramenta: id, nome e cor (iguais aos da tela inicial), o que dizer ("como se trata de <assunto> você pode <acao> clicando aqui"), sub (linha pequena do botão),
    // disponivel() e detecta(n = pergunta sem acento e em minúsculas, q = pergunta original, ctx) → null | { peso: 1–3, direto? }, abrir(q, s).
    // Peso: 3 = o assunto está explícito na pergunta · 2 = provável. A de maior peso é a principal; uma 2ª com peso >= 2 aparece como "Também pode ajudar".
    const FERRAMENTAS = [
        {
            id: 'sefaz', emoji: '🔍', nome: 'Erros SEFAZ', cor: '#dc2626', assunto: 'rejeição', acao: 'encontrar a solução',
            sub: s => s.direto ? `Já abre direto a rejeição ${s.direto.codigo} ${s.direto.tipo === 'CT-e' || s.direto.tipo === 'MDF-e' ? 'do' : 'da'} ${s.direto.tipo}` : 'Escolha o tipo do documento e digite o código da rejeição',
            disponivel: () => true,
            detecta(n, q, ctx) {
                const tipos = tiposCitados(n), codigo = codigoDaRejeicao(n);
                const rej = /\b(?:rejeicao|rejeicoes|rejeitad[oa]s?|rejeitou|rejeitar|cstat|motivo de rejeicao|codigo de (?:erro|rejeicao))\b/.test(n);
                const sef = /\b(?:sefaz|fisco|receita federal|secretaria da fazenda)\b/.test(n);
                let peso = 0;
                if (rej || ctx.ofertadas.includes('sefaz')) peso = 3;       // a própria pergunta fala de rejeição — ou o chat já ofereceu o Erros SEFAZ e a pessoa preferiu o banco de dados
                else if (sef && (tipos.length || codigo)) peso = 3;
                else if (tipos.length && codigo) peso = 2;                  // "erro 539 cte", "cte 539"
                return peso ? { peso, direto: tipos.length === 1 && codigo ? { tipo: tipos[0], codigo } : null } : null;
            },
            abrir(q, s) {
                const d = s.direto;
                if (d) {
                    if (abrirAba('sefaz', { novo: true, consulta: q, tipo: d.tipo, codigo: d.codigo })) return;
                    logSearch(`Erros Sefaz - ${d.codigo} (${d.tipo})`, true);   // sem abas (Copilot): a resposta sai no próprio chat
                    gerarRespostaSefaz(d.codigo, d.tipo);
                    return;
                }
                if (!abrirAba('sefaz', { novo: true })) btnWelcomeSefaz();
            },
        },
        {
            id: 'regra', emoji: '📋', nome: 'Criar Regra', cor: '#7c3aed', assunto: 'regra', acao: 'montar a regra com o assistente',
            sub: () => 'Monte regras arrastando os campos',
            disponivel: () => true,
            detecta(n, q, ctx) {
                if (ctx.ofertadas.includes('regra')) return { peso: 3 };    // o chat perguntou "Precisa de auxílio para criar a regra?" e a pessoa preferiu "buscar no banco"
                return typeof ehCriacaoRegra === 'function' && ehCriacaoRegra(q) ? { peso: 2 } : null;
            },
            abrir(q) { if (!abrirAba('regra', { novo: true, consulta: q })) btnWelcomeRegra(); },
        },
        {
            id: 'relatorios', emoji: '📊', nome: 'Assistente de Relatórios', cor: '#2563eb', assunto: 'relatório personalizado', acao: 'gerar o arquivo .dat com o assistente',
            sub: () => 'Gera o arquivo .dat de relatório personalizado',
            disponivel: () => true,
            detecta(n, q) {
                if (typeof ehAssistenteRelatorios === 'function' && ehAssistenteRelatorios(q)) return { peso: 3 };
                return /\brelatorios?\b/.test(n) && /\.dat\b|\bdat\b|personaliz|\bcolunas?\b|\blayout\b|\bexportar\b/.test(n) ? { peso: 2 } : null;
            },
            abrir() { if (!abrirAba('relatorios', { novo: true })) btnWelcomeRelatorios(); },
        },
        {
            id: 'params', emoji: '⚙️', nome: 'Parâmetros / Funcionalidades', cor: '#0891b2', assunto: 'parâmetro ou funcionalidade', acao: 'descobrir qual habilitar ou configurar',
            sub: () => 'Já pesquisa o que você perguntou',
            disponivel: () => true,
            detecta(n) {
                if (/\b(?:parametros?|funcionalidades?)\b/.test(n)) return { peso: 3 };
                return /\b(?:habilitar|desabilitar|permissao de)\b/.test(n) ? { peso: 2 } : null;
            },
            abrir(q) {
                if (abrirAba('params', { novo: true, consulta: q })) return;
                btnWelcomeParametros();   // sem abas (Copilot): liga o modo "só Parâmetros" e já pesquisa o que foi perguntado
                const inp = document.getElementById('searchInput');
                if (inp) { inp.value = q; handleParametrosFuncionalidades(); }
            },
        },
        {
            id: 'geo', emoji: '📍', nome: 'Pesquisa Latitude/Longitude', cor: '#0d9488', assunto: 'latitude e longitude', acao: 'pesquisar as coordenadas de um endereço',
            sub: () => 'Latitude e longitude de um endereço — e a rota entre dois',
            disponivel: () => typeof Geo !== 'undefined' && typeof Geo.abrirPesquisa === 'function',
            detecta(n) { return /\b(?:latitude|longitude|coordenadas?|lat\s*\/\s*long|lat\/lng)\b/.test(n) ? { peso: 3 } : null; },
            abrir() { Geo.abrirPesquisa(); },
        },
        {
            id: 'tela', emoji: '🖥️', nome: 'Analisar tela', cor: '#059669', assunto: 'um erro que aparece na tela', acao: 'compartilhar a tela para a IA analisar',
            sub: () => 'Compartilhe a tela e a IA analisa pra você',
            disponivel: () => semSimulador() && typeof btnWelcomeAnalisarTela === 'function' && !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
            detecta(n, q) {
                if (/\b(?:analis\w*|veja|olha|olhe|confere|confira)\s+(?:a\s+|minha\s+)?(?:minha\s+)?tela\b/.test(n)) return { peso: 3 };
                if (/\b(?:aparece|apareceu|aparecendo|aparecem|mostra|mostrou|mostrando|exibe|exibiu|exibindo|surge|surgiu|retorna|retornou|gerou|deu|dando)\s+(?:um|uma|uns|umas|o|a|esse|essa|este|esta|seguinte)?\s*(?:erro|mensagem|aviso|alerta)\b/.test(n)
                    || /\bdá\s+(?:um\s+)?erro\b/i.test(q)) return { peso: 2 };   // ("dá erro": só com acento — "da erro" sem acento pode ser "da" de "do/da")
                return /\b(?:print|printscreen|screenshot|captura de tela|imagem|foto)\b/.test(n) ? { peso: 2 } : null;
            },
            abrir() { btnWelcomeAnalisarTela(); },
        },
        {
            id: 'ciot', emoji: '🗺️', nome: 'Geolocalizador CIOT', cor: '#10b981', assunto: 'rota e distância', acao: 'validar a rota',
            sub: () => 'Validador de rotas e distâncias',
            disponivel: () => temAbas() && !oculta('ciot'),
            detecta(n) { return /\b(?:roteiriz\w*|rotas?|distancias?|quilometragem|geolocaliz\w*)\b/.test(n) ? { peso: 2 } : null; },
            abrir() { abrirTab('ciot'); },
        },
        {
            id: 'feedback', emoji: '💬', nome: 'Gestão de Feedback', cor: '#be185d', assunto: 'feedback', acao: 'ver os seus feedbacks e os retornos do suporte',
            sub: () => 'Veja seus feedbacks e retornos do suporte',
            disponivel: () => semSimulador() && typeof btnWelcomeFeedback === 'function',
            detecta(n) { return /\b(?:meus?|minhas?)\s+feedbacks?\b|\bretornos? do suporte\b|\bgestao de feedback\b|\bver (?:os )?feedbacks?\b|\bminhas avaliacoes\b/.test(n) ? { peso: 3 } : null; },
            abrir() { btnWelcomeFeedback(); },
        },
        {
            id: 'agenda', emoji: '🗓️', nome: 'Minha Agenda', cor: '#ea580c', assunto: 'tarefas e lembretes', acao: 'organizar tudo na sua agenda',
            sub: () => 'Tarefas, cronograma e lembretes — ficam só no seu computador',
            disponivel: () => temAbas() && !oculta('agenda'),
            detecta(n) { return /\b(?:minha agenda|minhas tarefas|meus lembretes|meus compromissos|criar (?:um )?lembrete|criar (?:uma )?tarefa|agendar (?:um )?lembrete|cronograma)\b/.test(n) ? { peso: 2 } : null; },
            abrir() { abrirTab('agenda'); },
        },
        {
            id: 'space', emoji: '🗒️', nome: 'Meu Espaço', cor: '#d97706', assunto: 'anotações', acao: 'guardar nas suas anotações',
            sub: () => 'Suas anotações pessoais — ficam só no seu computador',
            disponivel: () => temAbas() && !oculta('space'),
            detecta(n) { return /\b(?:minhas anotacoes|meu espaco|bloco de notas|minhas notas|fazer (?:uma )?anotacao|guardar (?:uma )?(?:nota|anotacao)|anotar)\b/.test(n) ? { peso: 2 } : null; },
            abrir() { abrirTab('space'); },
        },
        {
            id: 'news', emoji: '🔔', nome: 'Novidades', cor: '#7c3aed', assunto: 'novidades do sistema', acao: 'ver os avisos e atualizações',
            sub: () => 'Avisos e atualizações do sistema',
            disponivel: () => temAbas() && !oculta('news'),
            detecta(n) { return /\b(?:novidades?|o que (?:tem de )?novo|o que mudou|notas da versao|atualizacoes? (?:do|da) (?:sistema|versao))\b/.test(n) ? { peso: 2 } : null; },
            abrir() { abrirTab('news'); },
        },
        {
            id: 'voz', emoji: '📞', nome: 'Chamada de Voz com IA', cor: '#ea580c', assunto: 'uma conversa por voz', acao: 'ligar e falar com a IA',
            sub: () => 'Converse por voz com a IA, como numa ligação',
            disponivel: () => semSimulador() && typeof toggleVoice === 'function',
            detecta(n) { return /\b(?:chamada de voz|ligacao de voz|por voz|falar com (?:a )?(?:ia|voce|assistente)|conversar (?:com|por) (?:a )?(?:ia|voz|voce)|ligar para (?:a )?ia|falar por (?:voz|microfone)|usar (?:o )?microfone)\b/.test(n) ? { peso: 3 } : null; },
            abrir() { toggleVoice(); },
        },
        {
            id: 'copilot', emoji: '🤖', nome: 'Modo Copilot', cor: '#6d28d9', assunto: 'uma janela flutuante', acao: 'abrir o assistente em janela flutuante',
            sub: () => 'Abre o assistente em janela flutuante',
            disponivel: () => semSimulador() && typeof IS_PIP !== 'undefined' && !IS_PIP && 'documentPictureInPicture' in window && typeof abrirCopilot === 'function',
            detecta(n) { return /\b(?:copilot|janela flutuante|assistente flutuante|picture[- ]in[- ]picture)\b/.test(n) ? { peso: 3 } : null; },
            abrir() { abrirCopilot(); },
        },
    ];

    // Ferramentas que combinam com a pergunta, da mais provável para a menos (sem olhar o resultado da busca). ofertadas: ids que o próprio chat já ofereceu e a pessoa recusou.
    function detectar(query, ofertadas) {
        const q = String(query || '').trim();
        if (!q) return [];
        const n = semAcento(q), ctx = { ofertadas: Array.isArray(ofertadas) ? ofertadas : [] }, achados = [];
        FERRAMENTAS.forEach((f, ordem) => {
            try {
                if (f.disponivel && !f.disponivel()) return;
                const m = f.detecta(n, q, ctx);
                if (m && m.peso > 0) achados.push(Object.assign({ f, ordem }, m));
            } catch (e) { console.warn('[ferramenta sugerida] ' + f.id + ':', e); }
        });
        return achados.sort((a, b) => b.peso - a.peso || a.ordem - b.ordem);
    }
    const descrever = a => ({ id: a.f.id, nome: a.f.nome, emoji: a.f.emoji, cor: a.f.cor, assunto: a.f.assunto, acao: a.f.acao, sub: a.f.sub(a), direto: a.direto || null, f: a.f, peso: a.peso });

    // Decide se vale recomendar. ctx: { vum (nada achado no banco), rr (artigos achados), rrUsadas (respostas aprovadas), ofertadas }.
    // Devolve null (segue o caminho normal, com a IA) ou { principal, outras[], motivo }.
    function avaliar(query, ctx) {
        ctx = ctx || {};
        if (!ligadoParaPessoa()) return null;
        const achados = detectar(query, ctx.ofertadas);
        if (!achados.length) return null;
        const p = achados[0];
        const semCodigo = !!p.direto && p.f.id === 'sefaz' && !bancoTemOCodigo(ctx.rr, ctx.rrUsadas, p.direto.codigo);   // achou "algo parecido", mas nada sobre ESTA rejeição
        if (!ctx.vum && !semCodigo) return null;
        return {
            principal: descrever(p),
            outras: achados.slice(1).filter(x => x.peso >= 2).slice(0, 1).map(descrever),
            motivo: ctx.vum ? 'nada achado no banco de dados' : 'o banco não cita a rejeição ' + p.direto.codigo,
        };
    }

    // Mostra o cartão no chat. av: o que avaliar() devolveu · o: { logTs } (linha de log desta pergunta)
    function mostrar(query, av, o) {
        o = o || {};
        const logTs = o.logTs === undefined ? null : o.logTs;
        const p = av.principal, todas = [p].concat(av.outras || []);
        const puro = `Não encontrei no banco de dados essa informação, porém como se trata de ${p.assunto} você pode ${p.acao} na ferramenta ${p.nome}${p.direto ? ' (' + p.direto.tipo + ' ' + p.direto.codigo + ')' : ''}.`;
        const botao = (s, i) => `<button type="button" class="fs-op" data-i="${i}"><span class="fs-ic" aria-hidden="true">${s.emoji}</span><span class="fs-tx"><b>${html(s.nome)}</b><small>${html(s.sub)}</small></span><span class="fs-go" aria-hidden="true">→</span></button>`;
        const fid = Date.now();
        const card = document.createElement('div');
        card.className = 'answer-card ferr-sug-card';
        card.setAttribute('role', 'group');
        card.setAttribute('aria-label', 'Ferramenta recomendada');
        card.innerHTML = `<div class="fs-head"><span class="fs-badge">🧭 Ferramenta recomendada</span></div>
            <div class="fs-txt">Não encontrei no banco de dados essa informação, porém como se trata de <b>${html(p.assunto)}</b> você pode ${html(p.acao)} clicando aqui:</div>
            <div class="fs-lista">${botao(p, 0)}${todas.length > 1 ? `<div class="fs-tambem">Também pode ajudar:</div>${botao(todas[1], 1)}` : ''}</div>
            <div class="fs-ia"><button type="button" class="fs-btn-ia">🤖 Quero que a IA tente responder mesmo assim</button></div>
            <div class="feedback-area" data-log-ts="${logTs || ''}"><span class="feedback-util">Esta recomendação ajudou?</span><button class="feedback-btn" onclick="saveFeedback(${fid},'positivo',this)">👍</button><button class="feedback-btn" onclick="saveFeedback(${fid},'negativo',this)">👎</button></div>`;
        card.querySelectorAll('.fs-op').forEach((b, i) => { b.style.setProperty('--tool-c', todas[i].cor); b.title = todas[i].nome + ' — ' + todas[i].sub; });
        card.addEventListener('click', ev => {
            const alvo = ev.target && ev.target.closest ? ev.target : null;
            const b = alvo && alvo.closest('.fs-op');
            if (b) { const s = todas[parseInt(b.dataset.i, 10)]; if (s) abrir(s, query); return; }
            const ia = alvo && alvo.closest('.fs-btn-ia');
            if (ia) { pedirIA(ia, query); }
        });
        document.getElementById('chatStream').appendChild(card);
        if (typeof scrollToBottom === 'function') scrollToBottom(true);
        adicionarMensagemNaConversa('ai', puro);   // a conversa lembra o que foi dito (e a próxima pergunta já sabe que o banco não tinha)
        registrarRespostaNoLog(logTs, { resposta: puro, fonte: 'ferramenta', revisao: 'nao_se_aplica' });   // não é uma resposta que possa virar "resposta rápida": fica fora da fila da Revisão
        if (document.hidden && typeof _enviarNotificacaoNavegador === 'function') _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS', puro, 'bsoft-ia-resposta');
        console.log(`%c🧭 [ferramenta sugerida] ${p.nome}${p.direto ? ' (direto: ' + p.direto.tipo + ' ' + p.direto.codigo + ')' : ''} — ${av.motivo}`, 'color:#0e7490;font-weight:600;');
        return card;
    }

    function abrir(s, query) {
        console.log(`%c🧭 [ferramenta sugerida] abrindo ${s.nome}`, 'color:#0e7490;font-weight:600;');
        try { s.f.abrir(query, s); }
        catch (e) {
            console.warn('[ferramenta sugerida] não consegui abrir', s.id, e);
            try { Toast.show('Não consegui abrir a ferramenta agora. Use o menu lateral ou o Ctrl K.', { kind: 'warn' }); } catch (x) { alert('Não consegui abrir a ferramenta agora. Use o menu lateral ou o Ctrl K.'); }
        }
    }

    // "Quero que a IA tente responder mesmo assim": o mesmo caminho do botão "pesquisar com a IA" da resposta rápida (sem repetir a bolha da pergunta)
    async function pedirIA(btn, query) {
        btn.disabled = true; btn.textContent = '🤖 Pesquisando com a IA…';
        try { await handleChat({ pergunta: query, forcarIA: true, reutilizarMensagem: true }); }
        catch (e) { console.warn('[ferramenta sugerida] a IA não respondeu:', e); }
        const linha = btn.closest ? btn.closest('.fs-ia') : null;
        if (linha) linha.remove();
    }

    return { avaliar, mostrar, detectar, codigoDaRejeicao, tiposCitados, bancoTemOCodigo, ids: () => FERRAMENTAS.map(f => f.id) };
})();
