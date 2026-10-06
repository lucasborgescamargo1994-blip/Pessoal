/* admin/js/aba-simulador.js — Aba "Simulador": o chat de verdade (index.html?sim=1) dentro do painel, para testar sem deixar rastro.
   Modo simulação: o cliente do banco é SOMENTE LEITURA (qualquer gravação é barrada), nenhum log/feedback/aprendizado é gravado e o
   histórico de conversa do simulador é descartável. Dá para testar também a configuração de IA que está sendo editada na aba IA / MCP,
   antes de salvá-la. A conversa com o simulador é por mensagens (postMessage) — só aceitas da janela que o criou. */
(function () {
    'use strict';
    const S = { frame: null, pronto: false, fila: [], rascunho: null, usando: 'publicada', traces: [], bloqueios: new Set(), maxBloqueios: 0, artigos: null, sugeridas: false };
    const R = {};

    function setEstado(cls, txt) { if (!R.estado) return; R.estado.className = 'chip ' + cls; R.estadoTxt.textContent = txt; }

    function criarFrame() {
        if (S.frame) return;
        S.frame = h('iframe', { class: 'sim-frame', title: 'Simulador do chat — nada é gravado', src: '../index.html?sim=1', referrerpolicy: 'no-referrer' });
        S.frame.addEventListener('load', () => { if (!S.pronto) setEstado('wa', 'carregando a base…'); });   // (o "pronto" vem por mensagem, depois que a base carrega)
        R.moldura.appendChild(S.frame);
        setEstado('wa', 'carregando a base…');
    }
    function enviar(msg) {
        criarFrame();
        if (!S.pronto) { S.fila.push(msg); return; }
        try { S.frame.contentWindow.postMessage(msg, '*'); } catch (e) { console.warn('[simulador] não consegui enviar:', e); }
    }
    function descarregarFila() { const f = S.fila.splice(0); f.forEach(m => { try { S.frame.contentWindow.postMessage(m, '*'); } catch (e) { /* ok */ } }); }

    window.addEventListener('message', ev => {
        if (!S.frame || ev.source !== S.frame.contentWindow) return;
        const d = ev.data || {};
        if (d.tipo === 'bsoft:sim:pronto') {
            S.pronto = true; S.artigos = d.artigos;
            if (S.usando === 'rascunho' && S.rascunho) S.fila.unshift({ tipo: 'bsoft:sim:mcp', config: S.rascunho });
            setEstado('ok', 'pronto · ' + ADM.fmt.num(d.artigos) + ' artigos na base');
            descarregarFila();
        } else if (d.tipo === 'bsoft:sim:trace') {
            S.traces.unshift(Object.assign({ em: Date.now() }, d));
            if (S.traces.length > 40) S.traces.pop();
            S.maxBloqueios = Math.max(S.maxBloqueios, d.bloqueios || 0);
            (d.bloqueiosLista || []).forEach(b => S.bloqueios.add(b));
            renderRastro(); renderGarantias();
        }
    });

    function renderRastro() {
        if (!R.rastro) return;
        const box = limpar(R.rastro);
        if (!S.traces.length) { box.appendChild(h('div', { class: 'mu', style: { padding: '4px 2px' } }, 'Faça uma pergunta no simulador: aqui aparece de onde veio cada resposta (resposta rápida ou IA, qual modelo, tempo).')); return; }
        S.traces.forEach(t => {
            const ia = t.fonte === 'ia';
            box.appendChild(h('div', { class: 'rastro-item' },
                h('div', { class: 'q' }, t.pergunta ? ADM.fmt.trunc(t.pergunta, 140) : '(pergunta digitada direto no simulador)'),
                h('div', { class: 'linha', style: { gap: '5px' } },
                    ia ? h('span', { class: 'sel ml' }, '🤖 ' + (String(t.modelo || 'IA').split('/').pop().replace(/:free$/, ''))) : h('span', { class: 'sel pr' }, '⚡ resposta rápida #' + t.itemId),
                    !ia && t.motivo ? h('span', { class: 'sel' }, t.motivo) : null,
                    !ia && t.lex != null ? h('span', { class: 'pct' }, 'termos ' + ADM.fmt.pct(t.lex)) : null,
                    !ia && t.sem != null ? h('span', { class: 'pct' }, 'significado ' + ADM.fmt.pct(t.sem)) : null,
                    t.forcouIA ? h('span', { class: 'sel wa' }, 'após “pesquisar com a IA”') : null,
                    ia && Array.isArray(t.rrContexto) && t.rrContexto.length ? h('span', { class: 'sel pr', title: 'Respostas aprovadas pela equipe que entraram no contexto da IA (porcentagem = quão relacionadas à pergunta)' }, '📚 ' + t.rrContexto.length + ' aprovada(s) no contexto: ' + t.rrContexto.map(x => '#' + x.id + ' ' + x.pct + '%').join(', ')) : null,
                    h('span', { class: 'sel' }, '⏱ ' + (t.ms >= 1000 ? (t.ms / 1000).toFixed(1) + ' s' : t.ms + ' ms')))));
        });
    }
    function renderGarantias() {
        if (!R.garantias) return;
        const n = S.maxBloqueios;
        limpar(R.garantias).append(
            h('div', { class: 'linha', style: { gap: '8px' } }, h('span', { class: 'sel ok' }, '✔ somente leitura'), h('span', { class: 'sel ' + (n ? 'in' : '') }, n + ' gravação(ões) barrada(s)')),
            S.bloqueios.size ? h('div', { class: 'dica' }, 'Tentativas barradas: ' + Array.from(S.bloqueios).join(', ') + '. (Normal: é o app tentando gravar log/feedback — e o simulador não deixa.)') : h('div', { class: 'dica' }, 'Nada saiu do navegador para o banco. Log, feedback e aprendizado ficam desligados neste chat.'));
    }

    function sugestoes() {
        if (S.sugeridas) return; S.sugeridas = true;
        ADM.sb.from('logs').select('pergunta').order('created_at', { ascending: false }).limit(60).then(({ data }) => {
            const vistas = new Set(), lista = [];
            (data || []).forEach(l => { const p = String(l.pergunta || '').trim(); const k = RRMatch.semAcento(p); if (p.length > 6 && p.length < 140 && !vistas.has(k) && !/^(erros sefaz|criar regra|assistente de relat)/i.test(p)) { vistas.add(k); lista.push(p); } });
            const box = limpar(R.sugestoes);
            lista.slice(0, 8).forEach(p => box.appendChild(h('button', { class: 'chip', type: 'button', title: p, onclick: () => perguntar(p) }, ADM.fmt.trunc(p, 46))));
            if (!lista.length) box.appendChild(h('span', { class: 'dica' }, 'Sem perguntas recentes para sugerir.'));
        }, () => { /* sem sugestões */ });
    }

    function perguntar(texto) {
        texto = String(texto || '').trim(); if (!texto) return;
        if (R.novaCada && R.novaCada.checked) enviar({ tipo: 'bsoft:sim:novaConversa' });
        enviar({ tipo: 'bsoft:sim:perguntar', texto });
    }
    function atualizarUsando() {
        if (!R.usando) return;
        limpar(R.usando).append(S.usando === 'rascunho'
            ? [h('span', { class: 'sel pr' }, '✎ rascunho da aba IA / MCP (não salvo)'), h('div', { class: 'dica' }, 'O simulador usa a configuração que você está editando. Para voltar à publicada, clique em “Usar a publicada”.')]
            : [h('span', { class: 'sel ok' }, '✔ configuração publicada'), h('div', { class: 'dica' }, 'Versão ' + ((MCP_CFG && MCP_CFG.versao) || '?') + ' do arquivo config/mcp-config.js (como os usuários estão usando).')]);
    }

    ADM.sim = {
        perguntar(texto) { perguntar(texto); },
        usarRascunho(cfg) { S.rascunho = JSON.parse(JSON.stringify(cfg)); S.usando = 'rascunho'; enviar({ tipo: 'bsoft:sim:mcp', config: S.rascunho }); atualizarUsando(); },
        usarPublicada() { S.usando = 'publicada'; S.rascunho = null; S.pronto = false; if (S.frame) S.frame.src = S.frame.src; atualizarUsando(); },
        novaConversa() { enviar({ tipo: 'bsoft:sim:novaConversa' }); },
    };

    ADM.registrarAba({
        id: 'simulador', titulo: 'Simulador', icone: 'flask', ordem: 30,
        descricao: 'O chat de verdade, para testar sem deixar rastro: nada é gravado — nem log, nem feedback, nem aprendizado.',
        montar(ctx) {
            R.estadoTxt = h('span', null, 'não iniciado'); R.estado = h('span', { class: 'chip' }, h('span', { class: 'ponto' }), R.estadoTxt);
            const largura = h('div', { class: 'abas-mini', role: 'group', 'aria-label': 'Largura do simulador' }, [['compacto', '📱 Compacto'], ['tablet', 'Tablet'], ['total', 'Total']].map(([v, t]) =>
                h('button', { type: 'button', 'aria-pressed': v === 'compacto' ? 'true' : 'false', onclick: e => { R.moldura.dataset.largura = v; largura.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false')); } }, t)));
            ctx.barra.append(R.estado, largura,
                h('button', { class: 'btn', type: 'button', onclick: () => ADM.sim.novaConversa() }, I('newchat', 16), 'Nova conversa'),
                h('button', { class: 'btn', type: 'button', title: 'Recarrega o simulador (relê a base e a configuração publicada)', onclick: () => { S.pronto = false; if (S.frame) S.frame.src = S.frame.src; } }, I('refresh', 16), 'Recarregar'));
            R.moldura = h('div', { class: 'sim-moldura', 'data-largura': 'compacto' });

            R.entrada = h('textarea', { rows: 3, placeholder: 'Digite uma pergunta para o simulador responder…', 'aria-label': 'Pergunta para o simulador' });
            R.entrada.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); perguntar(R.entrada.value); R.entrada.value = ''; } });
            R.novaCada = h('input', { type: 'checkbox', checked: true });
            R.sugestoes = h('div', { class: 'linha', style: { gap: '6px' } }, h('span', { class: 'dica' }, 'carregando sugestões…'));
            R.usando = h('div', { class: 'pilha', style: { gap: '6px' } });
            R.rastro = h('div', { class: 'rastro' });
            R.garantias = h('div', { class: 'pilha', style: { gap: '8px' } });

            const lateral = h('div', { class: 'sim-lateral' },
                h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('send', 16), 'Perguntar ao simulador')),
                    h('div', { class: 'cartao-corpo' }, R.entrada,
                        h('div', { class: 'linha' }, h('button', { class: 'btn primario', type: 'button', onclick: () => { perguntar(R.entrada.value); R.entrada.value = ''; } }, I('send', 15), 'Enviar'),
                            h('label', { class: 'marcar', style: { fontWeight: 500, fontSize: '12.5px' } }, R.novaCada, 'Conversa nova a cada pergunta')),
                        h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Perguntas recentes dos usuários'), R.sugestoes))),
                h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('bot', 16), 'Configuração de IA em uso')),
                    h('div', { class: 'cartao-corpo' }, R.usando, h('div', { class: 'linha' },
                        h('button', { class: 'btn peq', type: 'button', onclick: () => { if (!ADM.mcp || !ADM.mcp.rascunho) { ADM.ui.toast('Abra a aba IA / MCP para editar um rascunho primeiro.', 'wa'); return; } ADM.sim.usarRascunho(ADM.mcp.rascunho); ADM.ui.toast('Simulador usando o rascunho da aba IA / MCP.', 'ok', 2500); } }, 'Usar o rascunho em edição'),
                        h('button', { class: 'btn peq fantasma', type: 'button', onclick: () => ADM.sim.usarPublicada() }, 'Usar a publicada')))),
                h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('activity', 16), 'De onde veio cada resposta')), h('div', { class: 'cartao-corpo' }, R.rastro)),
                h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('shield', 16), 'Garantias do modo teste')), h('div', { class: 'cartao-corpo' }, R.garantias)));
            ctx.corpo.appendChild(h('div', { class: 'sim-grade' }, h('div', { class: 'sim-palco' }, R.moldura), lateral));
            renderRastro(); renderGarantias(); atualizarUsando();
        },
        abrir() { criarFrame(); sugestoes(); },
    });
})();
