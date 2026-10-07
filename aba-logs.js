/* admin/js/aba-logs.js — Aba "Logs": o que os usuários perguntaram, a avaliação (👍/👎) e o retorno do suporte.
   Não traz a coluna "resposta" (grande) junto: ela só é baixada quando você abre uma linha — economiza a transferência do Supabase. */
(function () {
    'use strict';
    const TAM = 100;
    const COLUNAS = [
        'id, pergunta, encontrou, feedback, motivo, retorno, usuario_windows, device_id, timestamp, created_at, fonte, modelo, revisao, revisao_nota, resposta_rapida_id',
        'id, pergunta, encontrou, feedback, motivo, retorno, usuario_windows, device_id, timestamp, created_at',   // sem as colunas do SQL 02
        'id, pergunta, encontrou, feedback, motivo, usuario_windows, device_id, timestamp, created_at',           // sem "retorno"
    ];
    const E = { f: { de: '', ate: '', feedback: '', fonte: '', revisao: '', texto: '', semRetorno: false }, linhas: [], nivel: 0, fim: false, carregando: false, erro: null, ordemCol: 'created_at', ordemDir: -1, marcadas: new Set(), abertas: new Map(), contagem: null, jaCarregou: false };
    const R = {};
    const modeloCurto = m => String(m || '').split('/').pop().replace(/:free$/, '');

    function aplicarFiltros(q) {
        const f = E.f;
        if (f.de) q = q.gte('created_at', new Date(f.de + 'T00:00:00').toISOString());
        if (f.ate) q = q.lt('created_at', new Date(new Date(f.ate + 'T00:00:00').getTime() + 864e5).toISOString());
        if (f.feedback) q = q.eq('feedback', f.feedback);
        if (f.fonte && E.nivel === 0) q = q.eq('fonte', f.fonte);
        if (f.revisao && E.nivel === 0) q = q.eq('revisao', f.revisao);
        if (f.semRetorno && E.nivel <= 1) q = q.eq('feedback', 'Negativo').is('retorno', null);
        const t = ADM.db.termoSeguro(f.texto);
        if (t) q = q.or(`pergunta.ilike.*${t}*,usuario_windows.ilike.*${t}*,motivo.ilike.*${t}*`);
        return q;
    }

    async function carregar(reiniciar) {
        if (E.carregando) return;
        E.carregando = true;
        if (reiniciar) { E.linhas = []; E.fim = false; E.erro = null; E.marcadas.clear(); E.abertas.clear(); E.nivel = 0; }
        renderTudo();
        try {
            let ultimo = null;
            for (; E.nivel < COLUNAS.length; E.nivel++) {   // tenta com todas as colunas; se o banco ainda não tem as novas, cai para as antigas
                const de = E.linhas.length;
                const { data, error } = await aplicarFiltros(ADM.sb.from('logs').select(COLUNAS[E.nivel])).order('created_at', { ascending: false }).range(de, de + TAM - 1);
                if (!error) { E.linhas = E.linhas.concat(data || []); if (!data || data.length < TAM) E.fim = true; ultimo = null; break; }
                ultimo = error;
                if (!ADM.db.ehColunaAusente(error)) break;
            }
            if (ultimo) throw ultimo;
            if (reiniciar) contar();
        } catch (e) { E.erro = e; }
        E.carregando = false; E.jaCarregou = true;
        renderTudo();
    }

    async function contar() {   // totais reais (não só das linhas carregadas) para os mesmos filtros
        E.contagem = null;
        try {
            const base = () => aplicarFiltros(ADM.sb.from('logs').select('id', { count: 'exact', head: true }));
            const [t, p, n, w] = await Promise.all([base(), base().eq('feedback', 'Positivo'), base().eq('feedback', 'Negativo'), base().eq('feedback', 'Pendente')]);
            E.contagem = { total: t.count, pos: p.count, neg: n.count, pen: w.count };
        } catch (e) { E.contagem = null; }
        renderResumo();
    }

    /* ───────────── tela ───────────── */
    function ordenadas() {
        const c = E.ordemCol, d = E.ordemDir;
        return E.linhas.slice().sort((a, b) => { let x = a[c], y = b[c]; if (c === 'created_at') { x = new Date(x).getTime(); y = new Date(y).getTime(); } if (x == null) x = ''; if (y == null) y = ''; return (x < y ? -1 : x > y ? 1 : 0) * d; });
    }
    function selFeedback(fb) { return fb === 'Positivo' ? h('span', { class: 'sel ok' }, '👍') : fb === 'Negativo' ? h('span', { class: 'sel er' }, '👎') : h('span', { class: 'sel' }, '⏳'); }

    function renderResumo() {
        if (!R.resumo) return;
        const c = E.contagem, box = limpar(R.resumo);
        if (!c) { box.appendChild(h('span', { class: 'chip' }, E.carregando ? 'contando…' : '')); return; }
        const av = c.pos + c.neg;
        box.append(h('span', { class: 'chip' }, h('b', null, ADM.fmt.num(c.total)), ' registros'), h('span', { class: 'chip' }, '👍 ', h('b', null, ADM.fmt.num(c.pos))), h('span', { class: 'chip' }, '👎 ', h('b', null, ADM.fmt.num(c.neg))),
            h('span', { class: 'chip' }, '⏳ ', h('b', null, ADM.fmt.num(c.pen)), ' sem avaliação'), av ? h('span', { class: 'chip', title: '👍 ÷ (👍 + 👎)' }, 'aprovação ', h('b', null, ADM.fmt.pct(c.pos / av))) : null);
    }
    function renderTudo() { renderResumo(); renderAcoesLote(); renderTabela(); }
    function renderAcoesLote() {
        if (!R.lote) return;
        limpar(R.lote);
        if (E.marcadas.size) R.lote.append(h('span', { class: 'sel pr' }, E.marcadas.size + ' selecionado(s)'), h('button', { class: 'btn peq perigo', type: 'button', onclick: excluirMarcadas }, I('trash', 13), 'Excluir selecionados'), h('button', { class: 'btn peq fantasma', type: 'button', onclick: () => { E.marcadas.clear(); renderTudo(); } }, 'Limpar seleção'));
    }

    function renderTabela() {
        const box = limpar(R.tabela);
        if (E.erro && !E.linhas.length) { box.appendChild(ADM.ui.aviso('er', h('b', null, 'Não consegui carregar os logs.'), h('br'), ADM.db.erroTexto(E.erro))); return; }
        if (E.carregando && !E.linhas.length) { box.appendChild(h('div', { class: 'vazio' }, h('span', { class: 'girar', style: { display: 'inline-block' } }, I('refresh', 22)), ' Carregando…')); return; }
        if (!E.linhas.length) { box.appendChild(ADM.ui.vazio('📜', 'Nenhum log com esses filtros', 'Ajuste o período, a avaliação ou a busca.')); return; }
        const th = (rot, col, extra) => h('th', { class: 'ord' + (extra ? ' ' + extra : ''), 'aria-sort': E.ordemCol === col ? (E.ordemDir === 1 ? 'ascending' : 'descending') : 'none', onclick: () => { if (E.ordemCol === col) E.ordemDir *= -1; else { E.ordemCol = col; E.ordemDir = col === 'created_at' ? -1 : 1; } renderTabela(); } }, rot + (E.ordemCol === col ? (E.ordemDir === 1 ? ' ▲' : ' ▼') : ''));
        const todas = E.linhas.every(l => E.marcadas.has(l.id));
        const corpo = [];
        ordenadas().forEach(l => {
            const cb = h('input', { type: 'checkbox', checked: E.marcadas.has(l.id), 'aria-label': 'Selecionar', onchange: ev => { if (ev.currentTarget.checked) E.marcadas.add(l.id); else E.marcadas.delete(l.id); renderAcoesLote(); tr.classList.toggle('marcada', ev.currentTarget.checked); } });
            const tr = h('tr', { class: E.marcadas.has(l.id) ? 'marcada' : '' },
                h('td', null, cb),
                h('td', { class: 'nw mu' }, ADM.fmt.dataHoraLog(l)),
                h('td', { class: 'nw', style: { fontWeight: 600, color: 'var(--ad-in)' } }, l.usuario_windows || '—'),
                h('td', { style: { minWidth: '260px', maxWidth: '460px', wordBreak: 'break-word' } }, h('div', null, ADM.fmt.trunc(l.pergunta, 160)), l.encontrou === false ? h('span', { class: 'sel wa', title: 'Não encontrou na base' }, 'sem resultado') : null),
                h('td', { class: 'nw' }, l.fonte === 'rapida' ? h('span', { class: 'sel pr', title: 'Resposta rápida #' + l.resposta_rapida_id }, '⚡ #' + l.resposta_rapida_id) : l.fonte === 'ia' ? h('span', { class: 'sel ml', title: l.modelo || '' }, '🤖 ' + (modeloCurto(l.modelo) || 'IA')) : l.fonte === 'ferramenta' ? h('span', { class: 'sel', title: 'Uso de uma ferramenta em aba (Erros SEFAZ, Criar Regra, Relatórios ou Parâmetros)' }, '🧰 Ferramenta') : h('span', { class: 'mu' }, '—')),
                h('td', { class: 'tc' }, selFeedback(l.feedback)),
                h('td', { style: { maxWidth: '300px', fontSize: '12.5px', wordBreak: 'break-word' } }, l.motivo ? h('div', { class: 'mu' }, '📝 ' + ADM.fmt.trunc(l.motivo, 120)) : null, l.retorno ? h('div', { style: { color: 'var(--ad-in)' } }, '📩 ' + ADM.fmt.trunc(l.retorno, 120)) : null),
                h('td', { class: 'nw' }, l.revisao ? h('span', { class: 'sel ' + ({ aprovada: 'ok', banco: 'ok', rejeitada: 'er', pendente: 'wa' }[l.revisao] || '') }, l.revisao === 'nao_se_aplica' ? 'n/a' : l.revisao === 'banco' ? 'banco de dados' : l.revisao) : h('span', { class: 'mu' }, '—')),
                h('td', { class: 'acoes' },
                    h('button', { class: 'btn peq fantasma', type: 'button', title: 'Ver detalhes e a resposta', 'aria-label': 'Ver detalhes', onclick: () => alternarDetalhe(l, tr) }, I('eye', 14)),
                    h('button', { class: 'btn peq', type: 'button', onclick: () => editar(l) }, I('edit', 13), 'Editar'),
                    h('button', { class: 'btn peq fantasma perigo', type: 'button', title: 'Excluir', 'aria-label': 'Excluir', onclick: () => excluir(l) }, I('trash', 13))));
            corpo.push(tr);
            if (E.abertas.has(l.id)) corpo.push(detalheLinha(l));
        });
        const cabCb = h('input', { type: 'checkbox', checked: todas, 'aria-label': 'Selecionar todas', onchange: ev => { E.linhas.forEach(l => ev.currentTarget.checked ? E.marcadas.add(l.id) : E.marcadas.delete(l.id)); renderTudo(); } });
        box.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, h('th', null, cabCb), th('Data/hora', 'created_at'), th('Usuário', 'usuario_windows'), th('Pergunta', 'pergunta'), h('th', null, 'Origem'), th('Avaliação', 'feedback', 'tc'), h('th', null, 'Motivo / retorno'), th('Revisão', 'revisao'), h('th', null, ''))),
            h('tbody', null, corpo))));
        const rod = h('div', { class: 'rodape-tabela' }, `${ADM.fmt.num(E.linhas.length)} carregado(s)`);
        if (!E.fim) rod.appendChild(h('button', { class: 'btn peq', type: 'button', disabled: E.carregando, onclick: () => carregar(false) }, E.carregando ? 'Carregando…' : 'Carregar mais ' + TAM));
        box.appendChild(rod);
    }

    /* detalhe: a resposta é buscada só agora (coluna grande) */
    function detalheLinha(l) {
        const est = E.abertas.get(l.id);
        const caixa = h('div', { class: 'resposta-caixa' }, est.texto === undefined ? 'Carregando a resposta…' : (est.texto || '(este log não tem resposta gravada — vem de antes da revisão ou foi um fluxo guiado)'));
        return h('tr', { class: 'detalhe-linha' }, h('td', { colspan: 9 },
            h('div', { class: 'pilha', style: { gap: '8px' } },
                h('div', { class: 'linha', style: { gap: '6px' } }, h('span', { class: 'sel' }, 'id ' + l.id), l.device_id ? h('span', { class: 'sel', title: 'Dispositivo' }, '💻 ' + ADM.fmt.trunc(l.device_id, 22)) : null, l.modelo ? h('span', { class: 'sel ml' }, '🤖 ' + l.modelo) : null, l.revisao_nota ? h('span', { class: 'sel in' }, 'nota: ' + ADM.fmt.trunc(l.revisao_nota, 80)) : null),
                h('div', null, h('b', null, 'Pergunta: '), l.pergunta),
                l.motivo ? h('div', null, h('b', null, 'Motivo do 👎: '), l.motivo) : null,
                h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Resposta apresentada'), caixa))));
    }
    async function alternarDetalhe(l) {
        if (E.abertas.has(l.id)) { E.abertas.delete(l.id); renderTabela(); return; }
        E.abertas.set(l.id, {}); renderTabela();
        try {
            const { data, error } = await ADM.sb.from('logs').select('resposta').eq('id', l.id).maybeSingle();
            E.abertas.get(l.id).texto = error ? '' : ((data && data.resposta) || '');
            if (error && !ADM.db.ehColunaAusente(error)) ADM.ui.toast(ADM.db.erroTexto(error), 'er');
        } catch (e) { const a = E.abertas.get(l.id); if (a) a.texto = ''; }
        renderTabela();
    }

    /* ───────────── editar / excluir ───────────── */
    function editar(l) {
        const temRetorno = 'retorno' in l, temRevisao = 'revisao' in l;
        const iPerg = h('textarea', { rows: 3 }); iPerg.value = l.pergunta || '';
        const iFb = h('select', null, ['Pendente', 'Positivo', 'Negativo'].map(v => h('option', { value: v }, { Pendente: '⏳ Pendente', Positivo: '👍 Positivo', Negativo: '👎 Negativo' }[v]))); iFb.value = l.feedback || 'Pendente';
        const iMot = h('textarea', { rows: 2 }); iMot.value = l.motivo || '';
        const iRet = h('textarea', { rows: 3, placeholder: 'Resposta do suporte ao usuário (aparece para ele em “Gestão de Feedback”).' }); iRet.value = l.retorno || '';
        const iRev = h('select', null, ['', 'pendente', 'aprovada', 'banco', 'rejeitada', 'ignorada', 'nao_se_aplica'].map(v => h('option', { value: v }, v || '(nenhuma)'))); iRev.value = l.revisao || '';
        const iNota = h('input', { type: 'text' }); iNota.value = l.revisao_nota || '';
        ADM.ui.modal({
            titulo: 'Editar log #' + l.id, largura: 640, fecharFora: false,
            corpo: [h('div', { class: 'dica' }, ADM.fmt.dataHoraLog(l) + ' · ' + (l.usuario_windows || 'usuário desconhecido')),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Pergunta'), iPerg),
                h('div', { class: 'g2' }, h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Avaliação'), iFb), temRevisao ? h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Revisão'), iRev) : null),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Motivo do usuário'), iMot),
                temRetorno ? h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Retorno do suporte'), iRet) : null,
                temRevisao ? h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Nota da revisão'), iNota) : null],
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, {
                rotulo: 'Salvar', tipo: 'primario', fechar: false,
                acao: async (btn, api) => {
                    const novo = { pergunta: iPerg.value.trim(), feedback: iFb.value, motivo: iMot.value.trim() || null };
                    if (temRetorno) novo.retorno = iRet.value.trim() || null;
                    if (temRevisao) { novo.revisao = iRev.value || null; novo.revisao_nota = iNota.value.trim() || null; }
                    if (!novo.pergunta) { ADM.ui.toast('A pergunta não pode ficar vazia.', 'wa'); return false; }
                    const patch = {}; Object.keys(novo).forEach(k => { if ((novo[k] || null) !== (l[k] || null)) patch[k] = novo[k]; });
                    if (!Object.keys(patch).length) { api.fechar(); return false; }
                    const r = await ADM.sb.from('logs').update(patch).eq('id', l.id).select('id'); ADM.db.exigirAfetadas(r);
                    Object.assign(l, patch); renderTudo(); ADM.ui.toast('Log atualizado.', 'ok'); api.fechar();
                },
            }],
        });
    }
    async function excluir(l) {
        if (!(await ADM.ui.confirmar(`Excluir este log para sempre?\n\n“${ADM.fmt.trunc(l.pergunta, 140)}”`, { titulo: 'Excluir log', rotuloOk: 'Excluir', perigo: true }))) return;
        try { const r = await ADM.sb.from('logs').delete().eq('id', l.id).select('id'); ADM.db.exigirAfetadas(r); E.linhas = E.linhas.filter(x => x.id !== l.id); E.marcadas.delete(l.id); renderTudo(); ADM.ui.toast('Log excluído.', 'ok', 2500); contar(); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }
    async function excluirMarcadas() {
        const ids = Array.from(E.marcadas); if (!ids.length) return;
        if (!(await ADM.ui.confirmar(`Excluir ${ids.length} log(s) selecionado(s) para sempre?`, { titulo: 'Excluir logs selecionados', rotuloOk: 'Excluir ' + ids.length, perigo: true, detalhe: 'Não dá para desfazer. Exporte em CSV antes, se quiser guardar.' }))) return;
        try {
            const r = await ADM.sb.from('logs').delete().in('id', ids).select('id'); ADM.db.exigirAfetadas(r);
            const apagados = new Set(r.data.map(x => x.id)); E.linhas = E.linhas.filter(x => !apagados.has(x.id)); E.marcadas.clear();
            renderTudo(); ADM.ui.toast(apagados.size + ' log(s) excluído(s).', 'ok'); contar();
        } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }

    function exportarCSV() {
        if (!E.linhas.length) return ADM.ui.toast('Nada para exportar.', 'wa');
        const cols = ['id', 'created_at', 'timestamp', 'usuario_windows', 'pergunta', 'encontrou', 'feedback', 'motivo', 'retorno', 'fonte', 'modelo', 'revisao', 'revisao_nota', 'resposta_rapida_id', 'device_id'].filter(c => c in E.linhas[0]);
        const cel = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        ADM.ui.baixar(`logs_${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [cols.join(';')].concat(ordenadas().map(r => cols.map(c => cel(r[c])).join(';'))).join('\r\n'), 'text/csv;charset=utf-8');
        ADM.ui.toast(`${ADM.fmt.num(E.linhas.length)} linha(s) exportada(s)${E.fim ? '' : ' (só as carregadas — use “Carregar mais” para trazer outras)'}.`, 'ok', 5000);
    }

    ADM.registrarAba({
        id: 'logs', titulo: 'Logs', icone: 'activity', ordem: 60,
        descricao: 'O que os usuários perguntaram, como avaliaram (👍/👎) e o retorno do suporte. As respostas só são baixadas quando você abre uma linha.',
        montar(ctx) {
            const sel = (opcoes, aoMudar, titulo) => { const s = h('select', { 'aria-label': titulo, title: titulo }, opcoes.map(([v, t]) => h('option', { value: v }, t))); s.addEventListener('change', () => aoMudar(s.value)); return s; };
            const de = h('input', { type: 'date', 'aria-label': 'De', title: 'A partir de', style: { width: '150px' } }), ate = h('input', { type: 'date', 'aria-label': 'Até', title: 'Até', style: { width: '150px' } });
            de.addEventListener('change', () => { E.f.de = de.value; carregar(true); }); ate.addEventListener('change', () => { E.f.ate = ate.value; carregar(true); });
            const busca = h('input', { type: 'search', placeholder: 'Buscar pergunta, usuário ou motivo…', 'aria-label': 'Buscar' });
            busca.addEventListener('input', debounce(() => { E.f.texto = busca.value; carregar(true); }, 420));
            const semRet = h('input', { type: 'checkbox' }); semRet.addEventListener('change', () => { E.f.semRetorno = semRet.checked; carregar(true); });
            R.resumo = h('div', { class: 'estat' }); R.lote = h('div', { class: 'linha' }); R.tabela = h('div');
            ctx.barra.append(busca, de, ate,
                sel([['', 'Qualquer avaliação'], ['Positivo', '👍 Positivas'], ['Negativo', '👎 Negativas'], ['Pendente', '⏳ Sem avaliação']], v => { E.f.feedback = v; carregar(true); }, 'Avaliação'),
                sel([['', 'Qualquer origem'], ['ia', '🤖 IA'], ['rapida', '⚡ Resposta rápida'], ['ferramenta', '🧰 Ferramenta (abas)']], v => { E.f.fonte = v; carregar(true); }, 'Origem'),
                sel([['', 'Qualquer revisão'], ['pendente', 'Pendente'], ['aprovada', 'Aprovada'], ['banco', 'Salva no banco de dados'], ['rejeitada', 'Rejeitada'], ['ignorada', 'Ignorada']], v => { E.f.revisao = v; carregar(true); }, 'Revisão'),
                h('label', { class: 'marcar', style: { fontWeight: 500, fontSize: '12.5px' }, title: 'Avaliações 👎 que ainda não receberam “retorno do suporte”' }, semRet, '👎 sem retorno'),
                h('button', { class: 'btn icone', type: 'button', title: 'Recarregar', 'aria-label': 'Recarregar', onclick: () => carregar(true) }, I('refresh', 17)),
                h('button', { class: 'btn', type: 'button', onclick: exportarCSV }, I('download', 15), 'CSV'));
            ctx.corpo.append(R.resumo, h('div', { style: { height: '10px' } }), R.lote, R.tabela);
        },
        abrir() { if (!E.jaCarregou) carregar(true); },
    });
})();
