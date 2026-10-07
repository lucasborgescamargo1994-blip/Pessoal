/* admin/js/aba-banco.js — Aba "Banco de dados": editor das tabelas de conteúdo do Supabase (base de conhecimento, parâmetros, etc.).
   Não puxa as colunas de vetor (embedding) — são enormes e gastariam a transferência do plano gratuito à toa. */
(function () {
    'use strict';
    const TABELAS = [
        { t: 'BancoDados', rot: 'Base de conhecimento (BancoDados)', padrao: ['titulo', 'conteudo', 'como_emitir', 'categoria'], vetor: true, dica: 'Os artigos que a IA usa para responder. Ao editar um registro, o vetor de busca dele é recalculado sozinho na próxima abertura do sistema.' },
        { t: 'Parametros', rot: 'Parâmetros' },
        { t: 'Funcionalidades', rot: 'Funcionalidades' },
        { t: 'Rotinas', rot: 'Rotinas (telas do sistema)' },
        { t: 'RejeicoesSEFAZ', rot: 'Rejeições SEFAZ' },
        { t: 'machine_learning', rot: 'Conhecimento aprendido (machine_learning)', padrao: ['erro', 'solucao', 'fonte'] },
        { t: 'StatusServicos', rot: 'Status dos serviços (SEFAZ/ANTT)', dica: 'Atualizado sozinho por uma rotina agendada (Edge Function). Edite só se precisar corrigir algo na mão.' },
        { t: 'respostas_fixas', rot: 'Respostas fixas (legado — não é mais usado)' },
    ];
    const SKIP = new Set(['embedding', 'vetor']);
    const LONGOS = new Set(['solucao', 'conteudo', 'resposta', 'significado', 'causa', 'hint', 'descricao', 'Descrição', 'message', 'Solução', 'Significado', 'Causa', 'Dicas', 'detalhes', 'como_emitir', 'erro']);
    const AUTO = new Set(['id', 'created_at', 'atualizado_em']);   // o banco preenche sozinho
    const LOTE = 300;
    const E = { tab: TABELAS[0], linhas: [], colunas: [], tipos: {}, pk: 'id', total: null, fim: false, carregando: false, erro: null, filtro: '', ordemCol: null, ordemDir: 1, ocultas: new Set(), mostrando: LOTE };
    const R = {};

    const canon = v => (v === null || v === undefined || v === '') ? null : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    const colSql = c => /^[A-Za-z_][A-Za-z0-9_]*$/.test(c) ? c : '"' + c.replace(/"/g, '') + '"';
    const chaveOcultas = () => 'bsoft_admin_banco_cols_' + E.tab.t;

    function inferirTipos(linhas) {
        E.colunas.forEach(c => {
            if (E.tipos[c] && E.tipos[c] !== 'texto') return;
            const amostra = linhas.map(l => l[c]).find(v => v !== null && v !== undefined);
            E.tipos[c] = typeof amostra === 'boolean' ? 'boolean' : typeof amostra === 'number' ? 'numero' : (amostra && typeof amostra === 'object') ? 'json' : 'texto';
        });
    }
    const limpaLinha = l => { const o = {}; Object.keys(l).forEach(k => { if (!SKIP.has(k)) o[k] = l[k]; }); return o; };

    async function descobrirColunas() {
        const { data, error } = await ADM.sb.from(E.tab.t).select('*').limit(1);
        if (error) throw error;
        E.tipos = {};
        E.colunas = data && data.length ? Object.keys(data[0]).filter(c => !SKIP.has(c)) : (E.tab.padrao || []).slice();
        E.pk = ['id', 'chave', 'codigo'].find(c => E.colunas.includes(c)) || E.colunas[0] || 'id';
        if (data && data.length) inferirTipos(data);
        try { E.ocultas = new Set(JSON.parse(lsGet(chaveOcultas(), '[]'))); } catch (e) { E.ocultas = new Set(); }
        // tabelas largas: esconde as colunas de texto longo por padrão (ainda aparecem na janela de edição)
        if (!lsGet(chaveOcultas(), null) && E.colunas.length > 6) E.ocultas = new Set(E.colunas.filter(c => LONGOS.has(c)).slice(1));
    }

    async function carregar(reiniciar, tudo) {
        if (E.carregando) return;
        E.carregando = true;
        if (reiniciar) { E.linhas = []; E.fim = false; E.erro = null; E.total = null; E.mostrando = LOTE; }
        renderTudo();
        try {
            if (reiniciar) {
                await descobrirColunas();
                try { E.total = await ADM.db.contar(E.tab.t, null, colSql(E.pk)); } catch (e) { E.total = null; }
            }
            const cols = E.colunas.map(colSql).join(',');
            do {
                const de = E.linhas.length;
                if (!E.colunas.length) { E.fim = true; break; }
                const { data, error } = await ADM.sb.from(E.tab.t).select(cols).order(E.pk, { ascending: true }).range(de, de + (tudo ? 999 : LOTE - 1));
                if (error) throw error;
                E.linhas = E.linhas.concat(data || []);
                inferirTipos(data || []);
                if (!data || data.length < (tudo ? 1000 : LOTE)) E.fim = true;
                if (tudo) { R.status.textContent = `⏳ carregando… ${ADM.fmt.num(E.linhas.length)}${E.total ? ' de ' + ADM.fmt.num(E.total) : ''}`; }
            } while (tudo && !E.fim);
        } catch (e) { E.erro = e; }
        E.carregando = false;
        renderTudo();
    }

    /* ───────────── tabela ───────────── */
    function linhasVisiveis() {
        const q = RRMatch.semAcento(E.filtro).trim(), porId = /^#(\d+)$/.exec(q);   // "#123" vai direto ao registro de id 123
        let l = E.linhas;
        if (porId) l = l.filter(r => String(r[E.pk]) === porId[1]);
        else if (q) l = l.filter(r => { if (!r._busca) r._busca = RRMatch.semAcento(E.colunas.map(c => r[c] == null ? '' : (typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])).join(' \u0001 ')); return r._busca.includes(q); });
        if (E.ordemCol) {
            const c = E.ordemCol, num = E.tipos[c] === 'numero';
            l = l.slice().sort((a, b) => { const x = a[c], y = b[c]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (num ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true, sensitivity: 'base' })) * E.ordemDir; });
        }
        return l;
    }
    const colunasVisiveis = () => E.colunas.filter(c => !E.ocultas.has(c));

    function renderTudo() { renderStatus(); renderMenuColunas(); renderTabela(); }
    function renderStatus() {
        if (!R.status) return;
        if (E.carregando && !E.linhas.length) { R.status.textContent = '⏳ carregando…'; return; }
        if (E.erro) { R.status.textContent = '✖ erro'; return; }
        const vis = linhasVisiveis().length;
        R.status.textContent = `${E.filtro ? ADM.fmt.num(vis) + ' encontrados · ' : ''}${ADM.fmt.num(E.linhas.length)} carregados${E.total != null ? ' de ' + ADM.fmt.num(E.total) + ' no banco' : ''}`;
    }
    function renderMenuColunas() {
        if (!R.menuCols) return;
        limpar(R.menuCols).append(h('summary', { class: 'btn', title: 'Escolher as colunas que aparecem na tabela' }, I('sliders', 15), 'Colunas'),
            h('div', { class: 'cartao', style: { position: 'absolute', zIndex: 20, padding: '10px 12px', marginTop: '6px', maxHeight: '320px', overflow: 'auto', minWidth: '210px' } },
                E.colunas.map(c => h('label', { class: 'marcar', style: { fontWeight: 500, padding: '3px 0' } },
                    h('input', { type: 'checkbox', checked: !E.ocultas.has(c), onchange: ev => { if (ev.currentTarget.checked) E.ocultas.delete(c); else E.ocultas.add(c); lsSet(chaveOcultas(), JSON.stringify(Array.from(E.ocultas))); renderTabela(); } }), c))));
    }

    function renderTabela() {
        const box = limpar(R.tabela);
        if (E.erro) {
            const ausente = ADM.db.ehTabelaAusente(E.erro);
            box.appendChild(ADM.ui.aviso(ausente ? 'wa' : 'er', h('b', null, ausente ? `A tabela “${E.tab.t}” não existe neste banco.` : 'Não consegui carregar.'), h('br'), ADM.db.erroTexto(E.erro)));
            return;
        }
        if (E.carregando && !E.linhas.length) { box.appendChild(h('div', { class: 'vazio' }, h('span', { class: 'girar', style: { display: 'inline-block' } }, I('refresh', 22)), ' Carregando…')); return; }
        if (!E.linhas.length) { box.appendChild(ADM.ui.vazio('🗄️', 'Tabela vazia', 'Use “Novo registro” para criar o primeiro.')); return; }
        const cols = colunasVisiveis(), todas = linhasVisiveis(), lista = todas.slice(0, E.mostrando);
        if (!todas.length) {
            box.appendChild(ADM.ui.vazio('🔎', 'Nada encontrado nas linhas carregadas', E.fim ? 'Tente outra busca.' : ''));
            if (!E.fim) box.appendChild(h('div', { class: 'tc' }, h('button', { class: 'btn', type: 'button', onclick: () => carregar(false, true) }, 'Buscar em todas as ' + ADM.fmt.num(E.total || '') + ' linhas')));
            return;
        }
        const th = c => h('th', { class: 'ord', 'aria-sort': E.ordemCol === c ? (E.ordemDir === 1 ? 'ascending' : 'descending') : 'none', onclick: () => { if (E.ordemCol === c) E.ordemDir *= -1; else { E.ordemCol = c; E.ordemDir = 1; } renderTabela(); } }, c + (E.ordemCol === c ? (E.ordemDir === 1 ? ' ▲' : ' ▼') : ''));
        const corpo = lista.map(r => h('tr', null,
            h('td', { class: 'acoes sticky-esq' },
                h('button', { class: 'btn peq', type: 'button', onclick: () => abrirEdicao(r) }, I('edit', 13), 'Editar'),
                h('button', { class: 'btn peq fantasma', type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar', onclick: () => abrirEdicao(r, true) }, I('copy', 13)),
                h('button', { class: 'btn peq fantasma perigo', type: 'button', title: 'Excluir', 'aria-label': 'Excluir', onclick: () => excluir(r) }, I('trash', 13))),
            cols.map(c => { const v = r[c], s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return h('td', { class: 'cel' + (E.tipos[c] === 'numero' ? ' tr' : ''), title: ADM.fmt.trunc(s, 600) }, s.length > 90 ? s.slice(0, 88) + '…' : s); })));
        box.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' }, h('thead', null, h('tr', null, h('th', { class: 'sticky-esq' }, ''), cols.map(th))), h('tbody', null, corpo))));
        const rodape = h('div', { class: 'rodape-tabela' }, `Mostrando ${ADM.fmt.num(lista.length)} de ${ADM.fmt.num(todas.length)}${E.filtro ? ' (filtradas)' : ''}`);
        if (lista.length < todas.length) rodape.appendChild(h('button', { class: 'btn peq', type: 'button', onclick: () => { E.mostrando += LOTE; renderTabela(); } }, 'Mostrar mais ' + LOTE));
        if (!E.fim) rodape.appendChild(h('button', { class: 'btn peq', type: 'button', onclick: () => carregar(false, false) }, 'Carregar mais do banco'), h('button', { class: 'btn peq', type: 'button', onclick: () => carregar(false, true) }, 'Carregar tudo'));
        box.appendChild(rodape);
    }

    /* ───────────── editar / criar ───────────── */
    function abrirEdicao(row, duplicar) {
        const novo = !row || duplicar, original = row || {}, ctl = {};
        const campos = E.colunas.map(c => {
            const tipo = E.tipos[c] || 'texto', v = original[c], auto = AUTO.has(c) && !novo;
            if (novo && AUTO.has(c)) return null;
            let el, get;
            if (tipo === 'boolean') { el = h('select', null, h('option', { value: '' }, '(vazio)'), h('option', { value: 'true' }, 'sim'), h('option', { value: 'false' }, 'não')); el.value = v === true ? 'true' : v === false ? 'false' : ''; get = () => el.value === '' ? null : el.value === 'true'; }
            else if (tipo === 'numero') { el = h('input', { type: 'number', step: 'any' }); el.value = v == null ? '' : v; get = () => el.value === '' ? null : Number(el.value); }
            else if (tipo === 'json') { el = h('textarea', { class: 'mono', rows: 4 }); el.value = v == null ? '' : JSON.stringify(v, null, 2); get = () => { const t = el.value.trim(); if (!t) return null; try { return JSON.parse(t); } catch (e) { throw new Error(`A coluna “${c}” não é um JSON válido: ${e.message}`); } }; }
            else { const s = v == null ? '' : String(v); const longo = LONGOS.has(c) || s.length > 90 || s.includes('\n'); el = longo ? h('textarea', { rows: Math.min(14, Math.max(4, Math.ceil(s.length / 90) + 1)) }) : h('input', { type: 'text' }); el.value = s; get = () => el.value === '' ? null : el.value; }
            if (auto) el.readOnly = true, el.disabled = el.tagName === 'SELECT';
            ctl[c] = { get, auto };
            return h('label', { class: 'campo' + (el.tagName === 'TEXTAREA' ? ' longo' : '') }, h('span', { class: 'rot' }, c + (c === E.pk ? '  (chave)' : '') + (auto ? '  (automático)' : '')), el);
        }).filter(Boolean);

        const corpo = [E.tab.vetor ? ADM.ui.aviso('in', 'Ao salvar, o vetor de busca deste registro é descartado e recalculado automaticamente na próxima vez que o sistema abrir.') : null,
            h('div', { class: 'campos-form' }, campos)];
        ADM.ui.modal({
            titulo: novo ? (duplicar ? 'Duplicar registro' : 'Novo registro') + ' — ' + E.tab.t : 'Editar registro — ' + E.tab.t + ' (' + E.pk + ' ' + original[E.pk] + ')',
            largura: 760, fecharFora: false, corpo,
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, {
                rotulo: novo ? 'Criar registro' : 'Salvar alterações', tipo: 'primario', fechar: false,
                acao: async (btn, api) => {
                    const payload = {};
                    Object.keys(ctl).forEach(c => {
                        if (ctl[c].auto) return;
                        const nv = ctl[c].get();
                        if (novo) { if (canon(nv) !== null) payload[c] = nv; }
                        else if (canon(nv) !== canon(original[c])) payload[c] = nv;
                    });
                    if (!Object.keys(payload).length) { ADM.ui.toast(novo ? 'Preencha pelo menos um campo.' : 'Nada foi alterado.', 'wa'); return false; }
                    if (E.tab.vetor && Object.keys(payload).some(c => ['titulo', 'conteudo', 'como_emitir', 'categoria'].includes(c)) || (E.tab.vetor && novo)) payload.embedding = null;
                    let r;
                    if (novo) r = await ADM.sb.from(E.tab.t).insert(payload).select();
                    else r = await ADM.sb.from(E.tab.t).update(payload).eq(E.pk, original[E.pk]).select();
                    ADM.db.exigirAfetadas(r);
                    const gravada = limpaLinha(r.data[0]);
                    if (novo) { E.linhas.unshift(gravada); if (E.total != null) E.total++; }
                    else { const i = E.linhas.findIndex(x => x[E.pk] === original[E.pk]); if (i >= 0) E.linhas[i] = gravada; }
                    inferirTipos([gravada]); renderTudo();
                    ADM.ui.toast(novo ? 'Registro criado.' : 'Registro atualizado.', 'ok'); api.fechar();
                },
            }],
        });
    }

    async function excluir(row) {
        const previa = E.colunas.map(c => row[c]).filter(v => v != null && v !== '').map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' | ');
        if (!(await ADM.ui.confirmar(`Excluir este registro de “${E.tab.t}”?\n\n${ADM.fmt.trunc(previa, 220)}`, { titulo: 'Excluir registro', rotuloOk: 'Excluir', perigo: true, detalhe: 'Não dá para desfazer. Se tiver dúvida, faça uma cópia antes (Exportar CSV).' }))) return;
        try {
            const r = await ADM.sb.from(E.tab.t).delete().eq(E.pk, row[E.pk]).select(E.pk); ADM.db.exigirAfetadas(r);
            E.linhas = E.linhas.filter(x => x !== row); if (E.total != null) E.total--;
            renderTudo(); ADM.ui.toast('Registro excluído.', 'ok');
        } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }

    function exportarCSV() {
        const cols = E.colunas, lista = linhasVisiveis();
        if (!lista.length) return ADM.ui.toast('Nada para exportar.', 'wa');
        const cel = v => { const s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const csv = '﻿' + [cols.join(';')].concat(lista.map(r => cols.map(c => cel(r[c])).join(';'))).join('\r\n');
        ADM.ui.baixar(`${E.tab.t}_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
        ADM.ui.toast(`${ADM.fmt.num(lista.length)} linha(s) exportada(s)${E.fim ? '' : ' (só as carregadas)'}.`, 'ok');
    }

    // Chamado por outras abas (ex.: Revisão → "Abrir no banco de dados"): mostra a tabela pedida (padrão BancoDados) já filtrada no registro.
    async function irPara(op) {
        const tab = TABELAS.find(t => t.t === op.tabela) || TABELAS[0];
        const filtro = op.id != null ? '#' + op.id : String(op.buscar || '');
        if (tab !== E.tab) { E.tab = tab; E.ordemCol = null; E.linhas = []; E.fim = false; E.erro = null; R.sel.value = tab.t; R.dica.textContent = tab.dica || ''; }
        E.filtro = filtro; R.busca.value = filtro; E.mostrando = LOTE;
        while (E.carregando) await new Promise(r => setTimeout(r, 150));
        // o registro recém-criado tem o maior id: se não está nas linhas já carregadas, baixa a tabela inteira
        if (!E.linhas.length || !linhasVisiveis().length) await carregar(true, true);
        else renderTudo();
    }

    ADM.registrarAba({
        id: 'banco', titulo: 'Banco de dados', icone: 'database', ordem: 50,
        descricao: 'Edite o conteúdo que a IA consulta (base de conhecimento, parâmetros, rotinas…). Alterações valem na hora para todos.',
        montar(ctx) {
            const sel = R.sel = h('select', { 'aria-label': 'Tabela' }, TABELAS.map(t => h('option', { value: t.t }, t.rot)));
            sel.addEventListener('change', () => { E.tab = TABELAS.find(t => t.t === sel.value); E.filtro = ''; E.ordemCol = null; R.busca.value = ''; R.dica.textContent = E.tab.dica || ''; carregar(true); });
            R.busca = h('input', { type: 'search', placeholder: 'Filtrar registros… (ou #123 para ir a um ID)', 'aria-label': 'Filtrar registros' });
            R.busca.addEventListener('input', debounce(() => { E.filtro = R.busca.value; E.mostrando = LOTE; renderStatus(); renderTabela(); }, 220));
            R.menuCols = h('details', { style: { position: 'relative' } });
            R.status = h('span', { class: 'mu nw' }, '');
            R.dica = h('div', { class: 'dica', style: { marginBottom: '10px' } }, E.tab.dica || '');
            R.tabela = h('div');
            ctx.barra.append(sel, R.busca, R.menuCols, R.status,
                h('button', { class: 'btn icone', type: 'button', title: 'Recarregar', 'aria-label': 'Recarregar', onclick: () => carregar(true) }, I('refresh', 17)),
                h('button', { class: 'btn', type: 'button', title: 'Baixa as linhas filtradas em CSV (abre no Excel)', onclick: exportarCSV }, I('download', 15), 'CSV'),
                h('button', { class: 'btn primario', type: 'button', onclick: () => abrirEdicao(null) }, I('plus', 16), 'Novo registro'));
            ctx.corpo.append(R.dica, R.tabela);
        },
        abrir(op) {
            if (op && (op.id != null || op.buscar)) { irPara(op); return; }
            if (!E.linhas.length && !E.carregando && !E.erro) carregar(true);
        },
    });
})();
