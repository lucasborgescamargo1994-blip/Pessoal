/* admin/js/aba-respostas.js — Aba "Respostas rápidas": as respostas aprovadas (tabela respostas_rapidas).
   Cadastrar/editar/pausar/excluir, ver quanto cada uma foi usada e testar "se eu perguntar X, qual resposta o sistema usaria?". */
(function () {
    'use strict';
    const E = { texto: '', categoria: '', estado: 'todas', col: 'id', dir: -1, carregou: false };
    const R = {};

    const usoDe = id => (ADM.rr.uso.get(Number(id)) || { usos: 0, positivos: 0, negativos: 0 });
    const valorOrd = (it, col) => col === 'usos' ? Number(usoDe(it.id).usos) : col === 'pergunta' ? RRMatch.semAcento(it.pergunta) : col === 'categoria' ? RRMatch.semAcento(it.categoria || '') : col === 'atualizado_em' ? new Date(it.atualizado_em || it.criado_em || 0).getTime() : Number(it.id);

    function filtrados() {
        const q = RRMatch.semAcento(E.texto).trim();
        return ADM.rr.itens.filter(it => {
            if (E.estado === 'ativas' && it.ativo === false) return false;
            if (E.estado === 'pausadas' && it.ativo !== false) return false;
            if (E.categoria && (it.categoria || '') !== E.categoria) return false;
            if (q && !RRMatch.semAcento([it.pergunta, it.resposta, it.categoria, (it.variantes || []).join(' ')].join(' ')).includes(q)) return false;
            return true;
        }).sort((a, b) => { const x = valorOrd(a, E.col), y = valorOrd(b, E.col); return (x < y ? -1 : x > y ? 1 : 0) * E.dir; });
    }

    function cabecalhoOrdenavel(rotulo, col, extra) {
        const seta = E.col === col ? (E.dir === 1 ? ' ▲' : ' ▼') : '';
        return h('th', { class: 'ord' + (extra ? ' ' + extra : ''), onclick: () => { if (E.col === col) E.dir *= -1; else { E.col = col; E.dir = col === 'pergunta' || col === 'categoria' ? 1 : -1; } renderTabela(); }, 'aria-sort': E.col === col ? (E.dir === 1 ? 'ascending' : 'descending') : 'none' }, rotulo + seta);
    }

    function renderTabela() {
        const box = limpar(R.tabela);
        if (!ADM.rr.carregado) { box.appendChild(h('div', { class: 'vazio' }, h('span', { class: 'girar', style: { display: 'inline-block' } }, I('refresh', 22)), ' Carregando…')); return; }
        if (ADM.rr.erro) {
            const falta = ADM.db.ehTabelaAusente(ADM.rr.erro);
            box.appendChild(ADM.ui.aviso(falta ? 'wa' : 'er', h('b', null, falta ? 'A tabela de respostas rápidas ainda não existe no banco.' : 'Não consegui carregar as respostas rápidas.'), h('br'),
                falta ? 'Rode o arquivo sql/02_respostas_rapidas_e_revisao.sql uma vez no SQL Editor do Supabase (Dashboard → SQL Editor → New query → colar → Run) e clique em Atualizar.' : ADM.db.erroTexto(ADM.rr.erro),
                falta ? h('div', { style: { marginTop: '8px' } }, ADM.ui.sqlAjuda('02_respostas_rapidas_e_revisao.sql')) : null));
            return;
        }
        const lista = filtrados(), total = ADM.rr.itens.length;
        R.contagem.textContent = total ? `${lista.length} de ${total}` : '';
        if (!total) {
            box.appendChild(ADM.ui.vazio('⚡', 'Nenhuma resposta rápida ainda', 'Aprove respostas na aba Revisão ou crie uma manualmente com o botão “Nova resposta”.'));
            return;
        }
        if (!lista.length) { box.appendChild(ADM.ui.vazio('🔎', 'Nada encontrado', 'Ajuste a busca ou os filtros.')); return; }
        const linhas = lista.map(it => {
            const u = usoDe(it.id), ativa = it.ativo !== false;
            const ch = ADM.ui.chave(ativa, async (marcado, input) => {
                input.disabled = true;
                try {
                    const r = await ADM.sb.from('respostas_rapidas').update({ ativo: marcado }).eq('id', it.id).select('id'); ADM.db.exigirAfetadas(r);
                    it.ativo = marcado; ADM.ui.toast(marcado ? `Resposta #${it.id} ativada.` : `Resposta #${it.id} pausada — o sistema deixa de usá-la.`, 'ok', 2600);
                } catch (e) { input.checked = !marcado; ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
                input.disabled = false;
            }, 'Resposta ' + it.id + ' ativa');
            return h('tr', { class: ativa ? '' : 'pausada', style: ativa ? null : { opacity: '.62' } },
                h('td', { class: 'mono mu nw' }, '#' + it.id),
                h('td', { style: { minWidth: '280px', maxWidth: '520px' } }, h('div', { style: { fontWeight: 700, wordBreak: 'break-word' } }, it.pergunta),
                    h('div', { class: 'mu', style: { fontSize: '12.5px', marginTop: '2px' } }, ADM.fmt.trunc(ADM.fmt.semMd(it.resposta), 150)),
                    (it.variantes || []).length ? h('span', { class: 'sel in', style: { marginTop: '5px' }, title: it.variantes.join('\n') }, '+' + it.variantes.length + ' variante(s)') : null),
                h('td', null, it.categoria ? h('span', { class: 'sel' }, it.categoria) : h('span', { class: 'mu' }, '—')),
                h('td', { class: 'tr mono' }, ADM.rr.uso.size || u.usos ? ADM.fmt.num(u.usos) : h('span', { class: 'mu', title: 'Sem dados de uso (rode o SQL 02 para criar a visão respostas_rapidas_uso)' }, '—')),
                h('td', { class: 'nw' }, u.usos ? [h('span', { class: 'sel ok' }, '👍 ' + (u.positivos || 0)), ' ', h('span', { class: 'sel er' }, '👎 ' + (u.negativos || 0))] : h('span', { class: 'mu' }, '—')),
                h('td', { class: 'nw mu' }, ADM.fmt.dataHora(it.atualizado_em || it.criado_em)),
                h('td', null, ch.el),
                h('td', { class: 'acoes' },
                    h('button', { class: 'btn peq', type: 'button', onclick: () => editar(it) }, I('edit', 14), 'Editar'),
                    h('button', { class: 'btn peq fantasma', type: 'button', title: 'Testar no simulador', 'aria-label': 'Testar no simulador', onclick: () => { ADM.irParaAba('simulador'); ADM.sim.perguntar(it.pergunta); } }, I('flask', 14))));
        });
        box.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, cabecalhoOrdenavel('ID', 'id'), cabecalhoOrdenavel('Pergunta e resposta', 'pergunta'), cabecalhoOrdenavel('Categoria', 'categoria'),
                cabecalhoOrdenavel('Usos', 'usos', 'tr'), h('th', null, 'Avaliações'), cabecalhoOrdenavel('Atualizada', 'atualizado_em'), h('th', null, 'Ativa'), h('th', null, ''))),
            h('tbody', null, linhas))));
    }

    function editar(it) { ADM.editarRespostaRapida(it, () => { renderTabela(); atualizarCategorias(); }); }

    function atualizarCategorias() {
        const cats = ADM.categoriasRR(), atual = E.categoria;
        limpar(R.selCat).append(h('option', { value: '' }, 'Todas as categorias'), cats.map(c => h('option', { value: c }, c)));
        R.selCat.value = cats.includes(atual) ? atual : ''; E.categoria = R.selCat.value;
    }

    /* ───────────── testador ───────────── */
    async function testar(comSemantica) {
        const texto = R.testeEntrada.value.trim();
        const saida = limpar(R.testeSaida);
        if (texto.length < 3) { ADM.ui.toast('Escreva uma pergunta para testar.', 'wa'); return; }
        if (!ADM.rr.itens.length) { saida.appendChild(ADM.ui.aviso('in', 'Ainda não há respostas rápidas cadastradas para comparar.')); return; }
        const cfg = ADM.configAtiva().respostasRapidas;
        const alvo = RRMatch.preparar(texto);
        const lista = ADM.rr.itens.filter(i => i.ativo !== false).map(item => Object.assign({ item }, RRMatch.comparar(alvo, item)))
            .sort((a, b) => (b.numerosOk - a.numerosOk) || (b.lex - a.lex)).slice(0, 6);
        lista.forEach(x => { x.passaLex = x.numerosOk && (x.exato ? alvo.termos.length >= 1 : (alvo.termos.length >= cfg.minTermos && x.lex >= cfg.limiarLexical)); });
        let erroSem = null;
        if (comSemantica) {
            const cands = lista.filter(x => x.numerosOk && x.lex >= RRMatch.MIN_CANDIDATA && !x.passaLex).slice(0, 3);
            if (!cands.length) erroSem = 'Nenhuma candidata com sobreposição suficiente (≥ ' + ADM.fmt.pct(RRMatch.MIN_CANDIDATA) + ') para checar por significado.';
            else {
                try {
                    const vp = await ADM.jinaVetor(texto);
                    for (const x of cands) { const v = await ADM.jinaVetor(x.variante); x.sem = calcularSimilaridade(vp, v); x.passaSem = x.sem >= cfg.limiarSemantico; }
                } catch (e) { erroSem = 'Não consegui calcular o significado: ' + e.message; }
            }
        }
        const vencedora = lista.find(x => x.passaLex) || lista.filter(x => x.passaSem).sort((a, b) => b.sem - a.sem)[0];
        saida.appendChild(vencedora
            ? ADM.ui.aviso('ok', h('b', null, `O sistema responderia com a resposta rápida #${vencedora.item.id}`), ` (${vencedora.passaLex ? (vencedora.exato ? 'pergunta idêntica' : 'parecida: ' + ADM.fmt.pct(vencedora.lex) + ' dos termos') : 'significado parecido: ' + ADM.fmt.pct(vencedora.sem)}). O usuário também vê o botão “Pesquisar com a IA”.`)
            : ADM.ui.aviso('wa', h('b', null, 'Nenhuma resposta rápida seria usada — a pergunta iria para a IA.'), comSemantica ? '' : ' Dica: use “Checar também pelo significado” para ver se alguma passaria pela comparação semântica.'));
        if (erroSem) saida.appendChild(h('div', { class: 'dica', style: { margin: '6px 2px' } }, erroSem));
        saida.appendChild(h('div', { class: 'tabela-wrap', style: { maxHeight: 'none', marginTop: '10px' } }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, h('th', null, 'Resposta'), h('th', null, 'Pergunta/variante comparada'), h('th', { class: 'tr' }, 'Termos em comum'), h('th', { class: 'tr' }, 'Significado'), h('th', null, 'Números'), h('th', null, 'Resultado'))),
            h('tbody', null, lista.map(x => h('tr', null,
                h('td', { class: 'nw' }, h('button', { class: 'btn peq fantasma', type: 'button', onclick: () => editar(x.item) }, '#' + x.item.id)),
                h('td', { style: { maxWidth: '420px', wordBreak: 'break-word' } }, x.variante),
                h('td', { class: 'tr' }, h('span', { class: 'pct ' + (x.lex >= cfg.limiarLexical ? 'alto' : x.lex >= RRMatch.MIN_CANDIDATA ? 'medio' : '') }, ADM.fmt.pct(x.lex))),
                h('td', { class: 'tr' }, x.sem != null ? h('span', { class: 'pct ' + (x.passaSem ? 'alto' : 'medio') }, ADM.fmt.pct(x.sem)) : h('span', { class: 'mu' }, '—')),
                h('td', null, x.numerosOk ? h('span', { class: 'sel ok' }, 'iguais') : h('span', { class: 'sel er', title: 'A pergunta tem números diferentes (ex.: outro código de erro) — nunca é usada' }, 'diferentes')),
                h('td', null, x === vencedora ? h('span', { class: 'sel ok' }, '✔ usaria') : x.passaLex || x.passaSem ? h('span', { class: 'sel wa' }, 'passa, mas há outra melhor') : h('span', { class: 'sel' }, 'não passa'))))))));
        saida.appendChild(h('div', { class: 'dica', style: { margin: '8px 2px 0' } }, `Regras atuais (aba IA / MCP): termos em comum ≥ ${ADM.fmt.pct(cfg.limiarLexical)}, mínimo ${cfg.minTermos} termos; significado ≥ ${ADM.fmt.pct(cfg.limiarSemantico)}. Só respostas ativas entram na comparação.`));
    }

    /* ───────────── aba ───────────── */
    ADM.registrarAba({
        id: 'respostas', titulo: 'Respostas rápidas', icone: 'zap', ordem: 20,
        descricao: 'Respostas aprovadas pela equipe. Pergunta parecida: o sistema responde na hora, sem gastar IA. Pergunta menos parecida: a IA recebe as aprovadas mais relacionadas como conhecimento validado (aba IA / MCP liga e desliga).',
        montar(ctx) {
            R.contagem = h('span', { class: 'mu nw' });
            R.selCat = h('select', { 'aria-label': 'Categoria' }, h('option', { value: '' }, 'Todas as categorias'));
            R.selCat.addEventListener('change', () => { E.categoria = R.selCat.value; renderTabela(); });
            const busca = h('input', { type: 'search', placeholder: 'Buscar pergunta, resposta, categoria…', 'aria-label': 'Buscar' });
            busca.addEventListener('input', debounce(() => { E.texto = busca.value; renderTabela(); }, 200));
            const selEstado = h('select', { 'aria-label': 'Situação' }, [['todas', 'Todas'], ['ativas', 'Só ativas'], ['pausadas', 'Só pausadas']].map(([v, t]) => h('option', { value: v }, t)));
            selEstado.addEventListener('change', () => { E.estado = selEstado.value; renderTabela(); });
            ctx.barra.append(busca, R.selCat, selEstado, R.contagem,
                h('button', { class: 'btn icone', type: 'button', title: 'Atualizar', 'aria-label': 'Atualizar', onclick: async e => { await ADM.ui.ocupado(e.currentTarget, async () => { ADM.rr.invalidar(); await Promise.all([ADM.rr.carregar(true), ADM.rr.carregarUso()]); atualizarCategorias(); renderTabela(); }); } }, I('refresh', 17)),
                h('button', { class: 'btn primario', type: 'button', onclick: () => ADM.editarRespostaRapida(null, () => { renderTabela(); atualizarCategorias(); }) }, I('plus', 16), 'Nova resposta'));

            R.testeEntrada = h('input', { type: 'text', placeholder: 'Digite uma pergunta como um usuário digitaria…', 'aria-label': 'Pergunta de teste' });
            R.testeEntrada.addEventListener('keydown', e => { if (e.key === 'Enter') testar(false); });
            R.testeSaida = h('div');
            const teste = h('details', { class: 'cartao sanfona' },
                h('summary', { style: { padding: '13px 16px', display: 'flex', gap: '8px', alignItems: 'center' } }, I('search', 16), 'Testar: “se alguém perguntar isto, qual resposta rápida o sistema usaria?”'),
                h('div', { class: 'cartao-corpo', style: { paddingTop: 0 } },
                    h('div', { class: 'linha' }, h('div', { class: 'grow', style: { minWidth: '240px' } }, R.testeEntrada),
                        h('button', { class: 'btn primario', type: 'button', onclick: e => ADM.ui.ocupado(e.currentTarget, () => testar(false)) }, 'Testar'),
                        h('button', { class: 'btn', type: 'button', title: 'Usa a Jina (embeddings) para comparar o significado — gasta uma pequena cota', onclick: e => ADM.ui.ocupado(e.currentTarget, () => testar(true)) }, I('sparkles', 15), 'Checar também pelo significado')),
                    R.testeSaida));
            R.tabela = h('div');
            ctx.corpo.append(teste, h('div', { style: { height: '14px' } }), R.tabela);
            renderTabela();
        },
        async abrir(op) {
            if (!E.carregou) {
                E.carregou = true;
                await ADM.rr.carregar(true); await ADM.rr.carregarUso();
                atualizarCategorias();
            }
            renderTabela();
            if (op && op.editar) { const it = ADM.rr.obter(op.editar); if (it) editar(it); else ADM.ui.toast('Resposta rápida #' + op.editar + ' não encontrada (foi excluída?).', 'wa'); }
            if (op && op.nova) ADM.editarRespostaRapida(null, () => renderTabela());
        },
    });
})();
