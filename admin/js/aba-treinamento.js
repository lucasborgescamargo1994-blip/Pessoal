/* admin/js/aba-treinamento.js — Aba "Treinamento": a área administrativa do Simulador de atendimento (simulador.html).
   • Resultados: quem fez cada prova (nome completo), nota, aprovado/reprovado, a conversa de cada caso; decisão manual (aprovar/reprovar) e exportação CSV.
   • Provas: montar as provas (casos do banco de dados e/ou casos próprios, nota mínima, limites, link do curso no YOUniversity, mensagens) e ligar/desligar.
   • Treinos livres: quem treinou, qual caso, se resolveu, a conversa.
   • Configurações: liberar/bloquear o treino livre, boas-vindas, nota mínima padrão e os links.
   Tabelas: sim_provas, sim_tentativas, sim_sessoes, sim_config (sql/06_simulador_provas.sql). Todo texto vindo do banco entra na tela como TEXTO (h() / textContent). */
(function () {
    'use strict';
    const SQL = '06_simulador_provas.sql';
    const PERFIS = [['normal', 'Cliente comum'], ['leigo', 'Cliente leigo'], ['apressado', 'Cliente apressado'], ['misto', 'Variado (um jeito sorteado por caso)']];
    const SUBS = [['resultados', 'Resultados'], ['provas', 'Provas'], ['treinos', 'Treinos livres'], ['config', 'Configurações']];
    const COLS_TENT = 'id, prova_id, prova_titulo, nome, nome_chave, numero, status, nota, nota_minima, aprovado, duracao_s, modelo, revisao_aprovado, revisao_obs, revisado_por, revisado_em, iniciado_em, concluido_em';
    const COLS_SES = 'id, nome, nome_chave, caso_id, caso_titulo, categoria, perfil, resultado, turnos, dicas, duracao_s, modelo, criado_em';
    const MAX_LINHAS = 300;
    const CFG_PADRAO = { treino_livre: true, boas_vindas: '', nota_minima_padrao: 70 };

    const E = { sub: 'resultados', carregou: false, carregando: false, semSQL: false, erro: null,
        provas: [], tent: [], sessoes: [], config: Object.assign({}, CFG_PADRAO), banco: null,
        visao: 'tentativa', fRes: { texto: '', prova: '', estado: 'todos' }, fTre: { texto: '', resultado: '' } };
    const R = {};

    /* ───────────── utilidades ───────────── */
    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const httpUrl = u => /^https?:\/\/[^\s<>"']+$/i.test(String(u || '').trim());
    const linkSimulador = (id, teste) => { try { return new URL('../simulador.html' + (id ? '?prova=' + id + (teste ? '&teste=1' : '') : ''), location.href).href; } catch (e) { return ''; } };
    const mmss = s => s == null ? '—' : String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    const finalDe = t => t.revisao_aprovado != null ? t.revisao_aprovado : t.aprovado;          // a decisão manual vale mais que a automática
    const abandonada = t => t.status === 'em_andamento' && (Date.now() - ADM.fmt.instante(t.iniciado_em).getTime()) > 3 * 3600 * 1000;
    function estadoTent(t) {
        if (t.status !== 'concluida') return abandonada(t) ? ['Abandonada', 'wa'] : ['Em andamento', 'in'];
        return finalDe(t) ? ['Aprovado', 'ok'] : ['Reprovado', 'er'];
    }
    const itensDe = p => (Array.isArray(p.itens) ? p.itens : []).filter(x => x && (x.tipo === 'banco' || x.tipo === 'custom'));
    const num = (v, d, min, max) => { if (v === undefined || v === null || v === '') return d; v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d; };
    // padraoNota: nota mínima quando a prova não tem uma gravada (o simulador usa 70 nesse caso; só uma prova NOVA começa com o "padrão" das Configurações)
    function cfgDe(c, padraoNota) {
        c = c && typeof c === 'object' ? c : {};
        return { nota_minima: num(c.nota_minima, padraoNota || 70, 0, 100), max_mensagens: num(c.max_mensagens, 12, 0, 60), tempo_min: num(c.tempo_min, 0, 0, 240), perfil: PERFIS.some(x => x[0] === c.perfil) ? c.perfil : 'normal',
            dicas: c.dicas === true, max_tentativas: num(c.max_tentativas, 0, 0, 50), embaralhar: c.embaralhar === true };
    }
    const kpi = (rot, v, sub, tipo) => h('div', { class: 'kpi ' + (tipo || '') }, h('span', { class: 'r' }, rot), h('span', { class: 'v' }, v), h('span', { class: 's' }, sub || ''));
    const carregandoEl = () => h('div', { class: 'vazio' }, h('span', { class: 'girar', style: { display: 'inline-block' } }, I('refresh', 22)), ' Carregando…');
    // célula do CSV: ponto e vírgula (Excel em português), aspas e proteção contra fórmula (=, +, -, @ no começo)
    const csv = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

    /* ───────────── carregar ───────────── */
    async function pagina(tabela, colunas, ordem) {
        try { return { data: await ADM.db.todas((a, b) => ADM.sb.from(tabela).select(colunas).order(ordem, { ascending: false }).range(a, b), { max: 10000 }), error: null }; }
        catch (e) { return { data: null, error: e }; }
    }
    async function carregarTudo() {
        if (E.carregando) return;
        E.carregando = true; E.erro = null; renderSub();
        try {
            const [pr, te, se, cf] = await Promise.all([
                pagina('sim_provas', '*', 'id'), pagina('sim_tentativas', COLS_TENT, 'iniciado_em'), pagina('sim_sessoes', COLS_SES, 'criado_em'),
                ADM.sb.from('sim_config').select('config').eq('id', 1).maybeSingle().then(r => r, e => ({ data: null, error: e })),
            ]);
            const rs = [pr, te, se, cf];
            if (rs.some(r => r.error && ADM.db.ehTabelaAusente(r.error))) { E.semSQL = true; }
            else {
                const ruim = rs.find(r => r.error); if (ruim) throw ruim.error;
                E.semSQL = false; E.provas = pr.data || []; E.tent = te.data || []; E.sessoes = se.data || [];
                E.config = Object.assign({}, CFG_PADRAO, (cf.data && cf.data.config) || {});
            }
        } catch (e) { E.erro = e; }
        E.carregando = false; E.carregou = true; renderSub();
    }

    /* ───────────── casca ───────────── */
    function mudarSub(id) { E.sub = id; R.subBotoes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sub === id))); renderSub(); }
    function renderSub() {
        if (!R.corpo) return;
        const c = limpar(R.corpo);
        if (!E.carregou) { c.appendChild(carregandoEl()); return; }
        if (E.semSQL) {
            c.appendChild(ADM.ui.aviso('wa', h('b', null, 'O módulo de provas ainda não foi instalado no banco.'), h('br'),
                'Rode o arquivo sql/' + SQL + ' uma vez no SQL Editor do Supabase (Dashboard → SQL Editor → New query → colar → Run) e clique em Atualizar. Ele só cria tabelas novas — nada existente é alterado.',
                h('div', { style: { marginTop: '8px' } }, ADM.ui.sqlAjuda(SQL))));
            return;
        }
        if (E.erro) { c.appendChild(ADM.ui.aviso('er', h('b', null, 'Não consegui carregar os dados do treinamento.'), h('br'), ADM.db.erroTexto(E.erro))); return; }
        ({ resultados: renderResultados, provas: renderProvas, treinos: renderTreinos, config: renderConfig })[E.sub](c);
    }

    /* ═════════════ RESULTADOS ═════════════ */
    function tentFiltradas() {
        const q = semAcento(E.fRes.texto).trim(), st = E.fRes.estado;
        return E.tent.filter(t => {
            if (q && !semAcento(t.nome).includes(q)) return false;
            if (E.fRes.prova && String(t.prova_id) !== E.fRes.prova) return false;
            if (st === 'aprovados' && !(t.status === 'concluida' && finalDe(t))) return false;
            if (st === 'reprovados' && !(t.status === 'concluida' && !finalDe(t))) return false;
            if (st === 'andamento' && t.status !== 'em_andamento') return false;
            if (st === 'manual' && t.revisao_aprovado == null) return false;
            return true;
        });
    }
    function renderResultados(c) {
        const todas = E.tent, conc = todas.filter(t => t.status === 'concluida'), apr = conc.filter(finalDe).length;
        const notas = conc.map(t => Number(t.nota)).filter(Number.isFinite);
        c.appendChild(h('div', { class: 'kpis' },
            kpi('Pessoas', ADM.fmt.num(new Set(todas.map(t => t.nome_chave)).size), 'que já fizeram ou começaram uma prova'),
            kpi('Provas concluídas', ADM.fmt.num(conc.length), ADM.fmt.num(todas.length - conc.length) + ' em andamento ou abandonada(s)'),
            kpi('Aprovação', conc.length ? Math.round(apr / conc.length * 100) + '%' : '—', apr + ' aprovada(s) · ' + (conc.length - apr) + ' reprovada(s)', 'ok'),
            kpi('Nota média', notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) + '%' : '—', 'das provas concluídas', 'in')));
        c.appendChild(h('div', { style: { height: '14px' } }));

        const busca = h('input', { type: 'search', placeholder: 'Buscar pelo nome…', 'aria-label': 'Buscar pelo nome', value: E.fRes.texto });
        busca.addEventListener('input', debounce(() => { E.fRes.texto = busca.value; renderTabelaRes(); }, 200));
        const provas = new Map(); E.provas.forEach(p => provas.set(String(p.id), p.titulo)); E.tent.forEach(t => { if (t.prova_id != null && !provas.has(String(t.prova_id))) provas.set(String(t.prova_id), (t.prova_titulo || 'Prova #' + t.prova_id) + ' (excluída)'); });
        const selProva = h('select', { 'aria-label': 'Prova' }, h('option', { value: '' }, 'Todas as provas'), Array.from(provas.entries()).map(([id, t]) => h('option', { value: id }, t)));
        selProva.value = provas.has(E.fRes.prova) ? E.fRes.prova : ''; E.fRes.prova = selProva.value;
        selProva.addEventListener('change', () => { E.fRes.prova = selProva.value; renderTabelaRes(); });
        const selEstado = h('select', { 'aria-label': 'Situação' }, [['todos', 'Todas as situações'], ['aprovados', 'Aprovados'], ['reprovados', 'Reprovados'], ['andamento', 'Em andamento / abandonadas'], ['manual', 'Com decisão manual']].map(([v, t]) => h('option', { value: v }, t)));
        selEstado.value = E.fRes.estado; selEstado.addEventListener('change', () => { E.fRes.estado = selEstado.value; renderTabelaRes(); });
        const visoes = h('div', { class: 'abas-mini', role: 'group', 'aria-label': 'Visão' }, [['tentativa', 'Por tentativa'], ['pessoa', 'Por pessoa']].map(([v, t]) =>
            h('button', { type: 'button', 'aria-pressed': String(E.visao === v), onclick: e => { E.visao = v; visoes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); renderTabelaRes(); } }, t)));
        R.resContagem = h('span', { class: 'mu nw' });
        R.resTabela = h('div');
        c.appendChild(h('div', { class: 'barra', style: { marginBottom: '10px' } }, busca, selProva, selEstado, visoes, R.resContagem, h('span', { class: 'grow' }),
            h('button', { class: 'btn', type: 'button', onclick: exportarCsv }, I('download', 15), 'Exportar CSV')));
        c.appendChild(R.resTabela);
        renderTabelaRes();
    }
    function renderTabelaRes() {
        const box = limpar(R.resTabela), lista = tentFiltradas();
        R.resContagem.textContent = E.tent.length ? lista.length + ' de ' + E.tent.length + ' tentativa(s)' : '';
        if (!E.tent.length) { box.appendChild(ADM.ui.vazio('📝', 'Nenhuma prova feita ainda', 'Monte uma prova na seção “Provas”, ative e envie o link para as pessoas. Os resultados aparecem aqui.')); return; }
        if (!lista.length) { box.appendChild(ADM.ui.vazio('🔎', 'Nada encontrado', 'Ajuste a busca ou os filtros.')); return; }
        if (E.visao === 'pessoa') { tabelaPessoas(box, lista); return; }
        const linhas = lista.slice(0, MAX_LINHAS).map(t => {
            const [rot, cls] = estadoTent(t);
            return h('tr', null,
                h('td', { class: 'nw mu' }, ADM.fmt.dataHora(t.iniciado_em)),
                h('td', { style: { fontWeight: 700, wordBreak: 'break-word', minWidth: '160px' } }, t.nome),
                h('td', { style: { minWidth: '160px', wordBreak: 'break-word' } }, t.prova_titulo || '—'),
                h('td', { class: 'tr mono' }, t.numero != null ? t.numero + 'ª' : '—'),
                h('td', { class: 'tr' }, t.status === 'concluida' && t.nota != null ? h('span', { class: 'pct ' + (Number(t.nota) >= Number(t.nota_minima || 0) ? 'alto' : '') }, Math.round(Number(t.nota)) + '%') : h('span', { class: 'mu' }, '—')),
                h('td', { class: 'nw' }, h('span', { class: 'sel ' + cls }, rot), t.revisao_aprovado != null ? h('span', { class: 'sel in', style: { marginLeft: '4px' }, title: 'Decisão manual de ' + (t.revisado_por || 'administrador') }, '✋ manual') : null),
                h('td', { class: 'tr mono mu' }, mmss(t.duracao_s)),
                h('td', { class: 'acoes' }, h('button', { class: 'btn peq', type: 'button', onclick: () => abrirTentativa(t) }, I('eye', 14), 'Ver')));
        });
        box.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, h('th', null, 'Quando'), h('th', null, 'Nome'), h('th', null, 'Prova'), h('th', { class: 'tr' }, 'Tentativa'), h('th', { class: 'tr' }, 'Nota'), h('th', null, 'Resultado'), h('th', { class: 'tr' }, 'Tempo'), h('th', null, ''))),
            h('tbody', null, linhas))));
        if (lista.length > MAX_LINHAS) box.appendChild(h('div', { class: 'dica', style: { margin: '6px 2px' } }, 'Mostrando as ' + MAX_LINHAS + ' mais recentes de ' + lista.length + '. Use a busca/filtros para ver as outras.'));
    }
    function tabelaPessoas(box, lista) {
        const m = new Map();
        lista.forEach(t => {            // lista vem da mais nova para a mais antiga: a primeira grafia do nome é a mais recente
            const p = m.get(t.nome_chave) || { nome: t.nome, provas: new Set(), aprovadas: new Set(), tentativas: 0, concluidas: 0, melhor: null, ultima: t.iniciado_em };
            p.tentativas++; p.provas.add(String(t.prova_id));
            if (t.status === 'concluida') { p.concluidas++; if (finalDe(t)) p.aprovadas.add(String(t.prova_id)); const n = Number(t.nota); if (Number.isFinite(n) && (p.melhor == null || n > p.melhor)) p.melhor = n; }
            m.set(t.nome_chave, p);
        });
        const pessoas = Array.from(m.values());
        const linhas = pessoas.slice(0, MAX_LINHAS).map(p => h('tr', null,
            h('td', { style: { fontWeight: 700, wordBreak: 'break-word', minWidth: '180px' } }, p.nome),
            h('td', { class: 'tr mono' }, p.provas.size), h('td', { class: 'tr mono' }, p.tentativas),
            h('td', { class: 'nw' }, p.aprovadas.size ? h('span', { class: 'sel ok' }, p.aprovadas.size + ' de ' + p.provas.size + ' aprovada(s)') : h('span', { class: 'sel' }, '0 de ' + p.provas.size + ' aprovada(s)')),
            h('td', { class: 'tr' }, p.melhor != null ? h('span', { class: 'pct' }, Math.round(p.melhor) + '%') : h('span', { class: 'mu' }, '—')),
            h('td', { class: 'nw mu' }, ADM.fmt.dataHora(p.ultima)),
            h('td', { class: 'acoes' }, h('button', { class: 'btn peq', type: 'button', onclick: () => { E.fRes.texto = p.nome; E.visao = 'tentativa'; renderSub(); } }, 'Ver tentativas'))));
        box.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, h('th', null, 'Pessoa'), h('th', { class: 'tr' }, 'Provas'), h('th', { class: 'tr' }, 'Tentativas'), h('th', null, 'Aprovação'), h('th', { class: 'tr' }, 'Melhor nota'), h('th', null, 'Última atividade'), h('th', null, ''))),
            h('tbody', null, linhas))));
        if (pessoas.length > MAX_LINHAS) box.appendChild(h('div', { class: 'dica', style: { margin: '6px 2px' } }, 'Mostrando ' + MAX_LINHAS + ' de ' + pessoas.length + ' pessoas. Use a busca para ver as outras.'));
    }
    function exportarCsv() {
        const lista = tentFiltradas();
        if (!lista.length) { ADM.ui.toast('Não há tentativas para exportar com esses filtros.', 'wa'); return; }
        const cab = ['Início', 'Fim', 'Nome', 'Prova', 'Tentativa', 'Nota (%)', 'Nota mínima (%)', 'Resultado automático', 'Decisão manual', 'Resultado final', 'Tempo (s)', 'Observação do administrador'];
        const dt = v => v ? ADM.fmt.dataHora(v) : '';
        const linhas = lista.map(t => [dt(t.iniciado_em), dt(t.concluido_em), t.nome, t.prova_titulo, t.numero, t.nota != null ? Math.round(Number(t.nota)) : '', t.nota_minima != null ? t.nota_minima : '',
            t.status !== 'concluida' ? 'Não concluída' : t.aprovado ? 'Aprovado' : 'Reprovado', t.revisao_aprovado == null ? '' : t.revisao_aprovado ? 'Aprovado' : 'Reprovado', estadoTent(t)[0], t.duracao_s != null ? t.duracao_s : '', t.revisao_obs || ''].map(csv).join(';'));
        ADM.ui.baixar('resultados-provas.csv', '﻿' + cab.map(csv).join(';') + '\r\n' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
        ADM.ui.toast(lista.length + ' tentativa(s) exportada(s).', 'ok', 2600);
    }

    // a conversa de um caso (texto puro)
    function conversaEl(conv) {
        const msgs = Array.isArray(conv) ? conv : [];
        if (!msgs.length) return h('div', { class: 'dica' }, 'Sem conversa registrada.');
        return h('div', { class: 'trein-conv' }, msgs.map(m => h('div', { class: 'trein-msg ' + (m && m.de === 'cliente' ? 'cliente' : 'suporte') }, h('b', null, m && m.de === 'cliente' ? 'Cliente' : 'Aluno'), h('span', null, String((m && m.texto) || '')))));
    }
    function textoConversa(conv) { return (Array.isArray(conv) ? conv : []).map(m => (m && m.de === 'cliente' ? 'CLIENTE' : 'ALUNO') + ': ' + ((m && m.texto) || '')).join('\n'); }

    async function abrirTentativa(t) {
        const detalhesBox = h('div', null, carregandoEl());
        let detalhes = [];
        const selDec = h('select', { 'aria-label': 'Decisão' }, [['', 'Seguir o resultado automático'], ['true', 'Aprovar manualmente'], ['false', 'Reprovar manualmente']].map(([v, tx]) => h('option', { value: v }, tx)));
        selDec.value = t.revisao_aprovado == null ? '' : String(t.revisao_aprovado);
        const obs = h('textarea', { rows: 2, placeholder: 'Observação (opcional): por que mudou o resultado?', maxlength: 500 }); obs.value = t.revisao_obs || '';
        const [rot, cls] = estadoTent(t);
        const cabeca = h('div', { class: 'linha', style: { gap: '8px' } }, h('span', { class: 'sel ' + cls }, rot),
            h('span', { class: 'mu' }, (t.numero != null ? t.numero + 'ª tentativa · ' : '') + 'início ' + ADM.fmt.dataHora(t.iniciado_em) + (t.concluido_em ? ' · fim ' + ADM.fmt.dataHora(t.concluido_em) : '') + ' · tempo ' + mmss(t.duracao_s)),
            t.modelo ? h('span', { class: 'mu mono', style: { fontSize: '11.5px' } }, t.modelo) : null);
        const nota = h('div', { class: 'estat' },
            h('span', { class: 'chip' }, 'Nota ', h('b', null, t.nota != null ? Math.round(Number(t.nota)) + '%' : '—')), h('span', { class: 'chip' }, 'Mínimo ', h('b', null, t.nota_minima != null ? t.nota_minima + '%' : '—')),
            h('span', { class: 'chip' }, 'Automático ', h('b', null, t.status !== 'concluida' ? '—' : t.aprovado ? 'aprovado' : 'reprovado')));
        const decisao = h('div', { class: 'cartao' }, h('div', { class: 'cartao-corpo' },
            h('div', { class: 'rot-mini' }, 'Decisão do administrador'),
            h('div', { class: 'dica' }, 'Use quando o resultado automático não refletir a realidade (ex.: a IA do cliente errou). A decisão manual vale mais que a automática e é o que a pessoa passa a ver como situação da prova.'),
            h('div', { class: 'g2' }, h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Resultado final'), selDec), h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Observação'), obs)),
            h('div', { class: 'linha' }, h('button', { class: 'btn primario', type: 'button', onclick: e => ADM.ui.ocupado(e.currentTarget, async () => {
                const val = selDec.value === '' ? null : selDec.value === 'true';
                const patch = { revisao_aprovado: val, revisao_obs: val == null ? null : (obs.value.trim() || null), revisado_por: val == null ? null : ADM.auth.usuario(), revisado_em: val == null ? null : new Date().toISOString() };
                try { const r = await ADM.sb.from('sim_tentativas').update(patch).eq('id', t.id).select('id'); ADM.db.exigirAfetadas(r); Object.assign(t, patch); renderSub(); ADM.ui.toast('Decisão salva.', 'ok', 2400); }
                catch (err) { ADM.ui.toast(ADM.db.erroTexto(err), 'er', 9000); }
            }) }, I('save', 15), 'Salvar decisão'))));
        const api = ADM.ui.modal({ titulo: t.nome + ' — ' + (t.prova_titulo || 'prova'), largura: 820, fecharFora: false,
            corpo: [cabeca, nota, decisao, h('div', { class: 'rot-mini' }, 'Casos e conversas'), detalhesBox],
            botoes: [
                { rotulo: 'Apagar tentativa', tipo: 'perigo', fechar: false, acao: async (btn, a) => {
                    if (!(await ADM.ui.confirmar('Apagar a tentativa de ' + t.nome + '?', { titulo: 'Apagar tentativa', rotuloOk: 'Apagar', perigo: true, detalhe: 'Some dos resultados e deixa de contar no limite de tentativas da pessoa. Não dá para desfazer.' }))) return false;
                    const r = await ADM.sb.from('sim_tentativas').delete().eq('id', t.id).select('id'); ADM.db.exigirAfetadas(r);
                    E.tent = E.tent.filter(x => x.id !== t.id); renderSub(); ADM.ui.toast('Tentativa apagada.', 'ok', 2400); a.fechar();
                } },
                { rotulo: 'Copiar tudo', tipo: 'fantasma', fechar: false, acao: async () => { await ADM.ui.copiar(copiaTentativa(t, detalhes), 'Resultado e conversas copiados.'); return false; } },
                { rotulo: 'Fechar', tipo: 'primario' }] });
        try {
            const r = await ADM.sb.from('sim_tentativas').select('detalhes').eq('id', t.id).maybeSingle(); if (r.error) throw r.error;
            detalhes = Array.isArray(r.data && r.data.detalhes) ? r.data.detalhes : [];
            limpar(detalhesBox);
            if (!detalhes.length) detalhesBox.appendChild(h('div', { class: 'dica' }, t.status === 'concluida' ? 'Esta tentativa não tem casos registrados.' : 'A prova não foi concluída — não há casos registrados.'));
            detalhes.forEach((d, i) => {
                const ok = d.resultado === 'Resolvido';
                detalhesBox.appendChild(h('details', { class: 'cartao sanfona trein-caso' },
                    h('summary', { style: { padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
                        h('span', { class: 'sel ' + (ok ? 'ok' : 'er') }, ok ? '✔ ' + d.resultado : '✖ ' + (d.resultado || 'Não resolvido')),
                        h('b', { style: { wordBreak: 'break-word' } }, (i + 1) + '. ' + (d.titulo || 'Caso')),
                        h('span', { class: 'mu', style: { fontSize: '12px' } }, (d.turnos || 0) + ' msg · ' + mmss(d.duracao_s || 0) + (d.dicas ? ' · ' + d.dicas + ' dica(s)' : '') + (d.origem === 'custom' ? ' · caso próprio' : d.caso_id ? ' · banco #' + d.caso_id : ''))),
                    h('div', { class: 'cartao-corpo', style: { paddingTop: 0 } }, conversaEl(d.conversa))));
            });
        } catch (e) { limpar(detalhesBox).appendChild(ADM.ui.aviso('er', ADM.db.erroTexto(e))); }
    }
    function copiaTentativa(t, detalhes) {
        return `${t.nome} — ${t.prova_titulo || 'prova'}${t.numero != null ? ' (' + t.numero + 'ª tentativa)' : ''}\nNota: ${t.nota != null ? Math.round(Number(t.nota)) + '%' : '—'} (mínimo ${t.nota_minima != null ? t.nota_minima + '%' : '—'}) · ${estadoTent(t)[0]}\n\n`
            + detalhes.map((d, i) => `── Caso ${i + 1}: ${d.titulo} → ${d.resultado}\n${textoConversa(d.conversa)}`).join('\n\n');
    }

    /* ═════════════ PROVAS ═════════════ */
    function renderProvas(c) {
        c.appendChild(h('div', { class: 'linha', style: { marginBottom: '12px' } },
            h('div', { class: 'dica grow', style: { minWidth: '260px' } }, 'Cada prova é um conjunto de casos de atendimento. Ao terminar um conteúdo no YOUniversity, a pessoa faz a prova pelo link dela; se não passar, o simulador a orienta a revisar o conteúdo.'),
            h('button', { class: 'btn primario', type: 'button', onclick: () => editarProva(null) }, I('plus', 16), 'Nova prova')));
        if (!E.provas.length) { c.appendChild(ADM.ui.vazio('📝', 'Nenhuma prova criada ainda', 'Clique em “Nova prova”, escolha os casos (do banco de dados ou escritos por você), defina a nota mínima e ative.')); return; }
        const linhas = E.provas.map(p => {
            const cfg = cfgDe(p.config), n = itensDe(p).length, feitas = E.tent.filter(t => t.prova_id === p.id);
            const ch = ADM.ui.chave(p.ativo, async (marcado, input) => {
                if (marcado && !n) { input.checked = false; ADM.ui.toast('Adicione pelo menos 1 caso antes de ativar.', 'wa'); return; }
                input.disabled = true;
                try { const r = await ADM.sb.from('sim_provas').update({ ativo: marcado }).eq('id', p.id).select('id'); ADM.db.exigirAfetadas(r); p.ativo = marcado; ADM.ui.toast(marcado ? 'Prova ativada — já aparece para as pessoas.' : 'Prova desativada — ninguém consegue começá-la.', 'ok', 2800); }
                catch (e) { input.checked = !marcado; ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
                input.disabled = false;
            }, 'Prova ' + p.id + ' ativa');
            return h('tr', { style: p.ativo ? null : { opacity: '.7' } },
                h('td', { class: 'mono mu nw' }, '#' + p.id),
                h('td', { style: { minWidth: '220px', maxWidth: '420px' } }, h('div', { style: { fontWeight: 700, wordBreak: 'break-word' } }, p.titulo), p.curso_nome ? h('div', { class: 'mu', style: { fontSize: '12.5px', wordBreak: 'break-word' } }, '📖 ' + p.curso_nome) : null),
                h('td', { class: 'tr mono' }, n),
                h('td', { class: 'tr mono' }, cfg.nota_minima + '%'),
                h('td', { class: 'tr mono' }, feitas.length ? feitas.length : h('span', { class: 'mu' }, '0')),
                h('td', null, ch.el),
                h('td', { class: 'acoes' },
                    h('button', { class: 'btn peq', type: 'button', onclick: () => editarProva(p) }, I('edit', 14), 'Editar'),
                    h('button', { class: 'btn peq fantasma', type: 'button', title: 'Copiar o link desta prova (para colocar no YOUniversity)', 'aria-label': 'Copiar o link da prova', onclick: () => ADM.ui.copiar(linkSimulador(p.id), 'Link da prova copiado.') }, I('copy', 14)),
                    h('button', { class: 'btn peq fantasma', type: 'button', title: p.ativo ? 'Abrir a prova em modo teste (nada é gravado)' : 'Ative a prova para testar', 'aria-label': 'Testar a prova', onclick: () => { if (!p.ativo) { ADM.ui.toast('Ative a prova para poder testar (use o modo teste: nada é gravado).', 'wa'); return; } window.open(linkSimulador(p.id, true), '_blank', 'noopener'); } }, I('play', 14)),
                    h('button', { class: 'btn peq fantasma', type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar', onclick: () => duplicarProva(p) }, I('layers', 14)),
                    h('button', { class: 'btn peq fantasma perigo', type: 'button', title: 'Excluir', 'aria-label': 'Excluir', onclick: () => excluirProva(p) }, I('trash', 14))));
        });
        c.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, h('th', null, 'ID'), h('th', null, 'Prova'), h('th', { class: 'tr' }, 'Casos'), h('th', { class: 'tr' }, 'Nota mín.'), h('th', { class: 'tr' }, 'Tentativas'), h('th', null, 'Ativa'), h('th', null, ''))),
            h('tbody', null, linhas))));
    }
    async function duplicarProva(p) {
        const copia = { titulo: 'Cópia de ' + p.titulo, descricao: p.descricao, curso_nome: p.curso_nome, curso_link: p.curso_link, proximo_link: p.proximo_link, msg_aprovado: p.msg_aprovado, msg_reprovado: p.msg_reprovado, itens: p.itens, config: p.config, ativo: false, criado_por: ADM.auth.usuario() };
        try { const r = await ADM.sb.from('sim_provas').insert(copia).select('*'); ADM.db.exigirAfetadas(r); E.provas.unshift(r.data[0]); renderSub(); ADM.ui.toast('Prova duplicada (desativada). Ajuste e ative quando estiver pronta.', 'ok'); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }
    async function excluirProva(p) {
        const feitas = E.tent.filter(t => t.prova_id === p.id).length;
        if (!(await ADM.ui.confirmar('Excluir a prova “' + ADM.fmt.trunc(p.titulo, 80) + '”?', { titulo: 'Excluir prova', rotuloOk: 'Excluir', perigo: true,
            detalhe: (feitas ? feitas + ' tentativa(s) já feita(s) continuam nos resultados, mas ' : '') + 'ninguém mais consegue fazer esta prova. Para só tirar do ar por um tempo, use a chave “Ativa”.' }))) return;
        try { const r = await ADM.sb.from('sim_provas').delete().eq('id', p.id).select('id'); ADM.db.exigirAfetadas(r); E.provas = E.provas.filter(x => x.id !== p.id); renderSub(); ADM.ui.toast('Prova excluída.', 'ok', 2500); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }

    /* ───────────── editor de prova ───────────── */
    const chk = (rot, marcado, dica) => { const i = h('input', { type: 'checkbox', checked: !!marcado }); return { i, el: h('label', { class: 'marcar', title: dica || null }, i, h('span', null, rot)) }; };
    const campoTexto = (rot, valor, op) => { op = op || {}; const i = op.multi ? h('textarea', { rows: op.linhas || 3, placeholder: op.dica || '', maxlength: op.max || null }) : h('input', { type: op.tipo || 'text', placeholder: op.dica || '', maxlength: op.max || null, min: op.min != null ? op.min : null, max: op.maxN != null ? op.maxN : null }); i.value = valor == null ? '' : valor; return { i, el: h('label', { class: 'campo' }, h('span', { class: 'rot' }, rot), i, op.ajuda ? h('span', { class: 'dica' }, op.ajuda) : null) }; };

    function editarProva(p) {
        const nova = !p;
        const base = p || { titulo: '', descricao: '', curso_nome: '', curso_link: '', proximo_link: '', msg_aprovado: '', msg_reprovado: '', itens: [], config: {}, ativo: false };
        const cfg = cfgDe(base.config, nova ? num(E.config.nota_minima_padrao, 70, 1, 100) : 70);
        let itens = itensDe(base).map(x => Object.assign({}, x));
        const f = {
            titulo: campoTexto('Título da prova *', base.titulo, { max: 140, dica: 'Ex.: Prova — Emissão de CT-e' }),
            descricao: campoTexto('O que a pessoa lê antes de começar', base.descricao, { multi: true, linhas: 3, max: 1500, dica: 'Opcional. Explique o objetivo da prova.' }),
            curso_nome: campoTexto('Conteúdo do YOUniversity', base.curso_nome, { max: 140, dica: 'Ex.: Emissão de CT-e — módulo 1', ajuda: 'Aparece na orientação “revise o conteúdo …”.' }),
            curso_link: campoTexto('Link para REVISAR o conteúdo', base.curso_link, { tipo: 'url', max: 500, dica: 'https://…', ajuda: 'Botão “Revisar o conteúdo” que a pessoa vê quando NÃO passa.' }),
            proximo_link: campoTexto('Link para continuar (ao aprovar)', base.proximo_link, { tipo: 'url', max: 500, dica: 'https://…', ajuda: 'Opcional: botão “Continuar o aprendizado” quando passa.' }),
            msg_aprovado: campoTexto('Mensagem ao ser aprovado', base.msg_aprovado, { multi: true, linhas: 2, max: 600, dica: 'Opcional. Se vazio, o simulador usa uma mensagem padrão.' }),
            msg_reprovado: campoTexto('Mensagem ao ser reprovado', base.msg_reprovado, { multi: true, linhas: 2, max: 600, dica: 'Opcional. Se vazio, o simulador orienta a revisar o conteúdo.' }),
            nota_minima: campoTexto('Nota mínima para passar (%)', cfg.nota_minima, { tipo: 'number', min: 1, maxN: 100, ajuda: 'Nota = % de casos resolvidos.' }),
            max_mensagens: campoTexto('Mensagens por caso', cfg.max_mensagens, { tipo: 'number', min: 0, maxN: 60, ajuda: '0 = sem limite. Passou do limite, o caso conta como não resolvido.' }),
            tempo_min: campoTexto('Tempo total (minutos)', cfg.tempo_min, { tipo: 'number', min: 0, maxN: 240, ajuda: '0 = sem limite de tempo.' }),
            max_tentativas: campoTexto('Máximo de tentativas', cfg.max_tentativas, { tipo: 'number', min: 0, maxN: 50, ajuda: '0 = pode refazer quantas vezes quiser.' }),
        };
        const selPerfil = h('select', { 'aria-label': 'Jeito do cliente' }, PERFIS.map(([v, t]) => h('option', { value: v }, t))); selPerfil.value = cfg.perfil;
        const cDicas = chk('Permitir pedir dicas durante a prova', cfg.dicas), cEmb = chk('Embaralhar a ordem dos casos para cada pessoa', cfg.embaralhar), cAtiva = chk('Prova ativa (visível para as pessoas)', base.ativo);

        const boxItens = h('div', { class: 'trein-itens' });
        const resumo = h('span', { class: 'mu' });
        function renderItens() {
            limpar(boxItens);
            resumo.textContent = itens.length ? itens.length + ' caso(s)' : '';
            if (!itens.length) { boxItens.appendChild(h('div', { class: 'dica', style: { padding: '8px 2px' } }, 'Nenhum caso ainda. Adicione casos do banco de dados ou escreva os seus.')); return; }
            itens.forEach((it, i) => boxItens.appendChild(h('div', { class: 'trein-item' },
                h('span', { class: 'trein-n mono' }, i + 1),
                h('span', { class: 'sel ' + (it.tipo === 'banco' ? 'in' : 'pr') }, it.tipo === 'banco' ? 'Banco #' + it.id : 'Próprio'),
                h('span', { class: 'grow trein-t' }, it.titulo || '(sem título)', it.tipo === 'custom' && it.categoria ? h('span', { class: 'mu' }, '  · ' + it.categoria) : null),
                it.tipo === 'custom' ? h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Editar o caso', 'aria-label': 'Editar o caso', onclick: () => casoProprio(it, () => renderItens()) }, I('edit', 13)) : null,
                h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Subir', 'aria-label': 'Subir', disabled: i === 0, onclick: () => { itens.splice(i - 1, 0, itens.splice(i, 1)[0]); renderItens(); } }, I('up', 13)),
                h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Descer', 'aria-label': 'Descer', disabled: i === itens.length - 1, onclick: () => { itens.splice(i + 1, 0, itens.splice(i, 1)[0]); renderItens(); } }, I('down', 13)),
                h('button', { class: 'btn peq fantasma perigo icone', type: 'button', title: 'Remover da prova', 'aria-label': 'Remover da prova', onclick: () => { itens.splice(i, 1); renderItens(); } }, I('x', 13)))));
        }
        renderItens();

        const corpo = [
            f.titulo.el, f.descricao.el,
            h('div', { class: 'g2' }, f.curso_nome.el, f.curso_link.el),
            h('div', { class: 'g2' }, f.proximo_link.el, h('span')),
            h('div', { class: 'g2' }, f.msg_aprovado.el, f.msg_reprovado.el),
            h('div', { class: 'rot-mini' }, 'Regras'),
            h('div', { class: 'g3' }, f.nota_minima.el, f.max_mensagens.el, f.tempo_min.el),
            h('div', { class: 'g3' }, f.max_tentativas.el, h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Jeito do cliente'), selPerfil), h('span')),
            h('div', { class: 'linha', style: { gap: '18px' } }, cDicas.el, cEmb.el),
            h('div', { class: 'rot-mini' }, 'Casos da prova'),
            h('div', { class: 'linha' },
                h('button', { class: 'btn', type: 'button', onclick: () => escolherDoBanco(itens, novos => { itens.push(...novos); renderItens(); }) }, I('database', 15), 'Adicionar do banco de dados'),
                h('button', { class: 'btn', type: 'button', onclick: () => casoProprio(null, novo => { itens.push(novo); renderItens(); }) }, I('plus', 15), 'Criar um caso próprio'), resumo),
            boxItens,
            h('div', { class: 'dica' }, 'Dica: de 5 a 8 casos, todos do conteúdo que a pessoa acabou de estudar. Em cada caso o cliente simulado conta o problema (o “título” do caso) e só dá por resolvido quando o aluno orienta a solução cadastrada.'),
            cAtiva.el,
        ];
        ADM.ui.modal({ titulo: nova ? 'Nova prova' : 'Editar prova #' + p.id, largura: 880, fecharFora: false, corpo,
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, { rotulo: nova ? 'Criar prova' : 'Salvar', tipo: 'primario', fechar: false, acao: async (btn, api) => {
                const titulo = f.titulo.i.value.trim();
                if (!titulo) { ADM.ui.toast('Dê um título para a prova.', 'wa'); f.titulo.i.focus(); return false; }
                for (const k of ['curso_link', 'proximo_link']) { const v = f[k].i.value.trim(); if (v && !httpUrl(v)) { ADM.ui.toast('Link inválido: precisa começar com http:// ou https://', 'wa'); f[k].i.focus(); return false; } }
                const notaMin = Number(f.nota_minima.i.value);
                if (!Number.isFinite(notaMin) || notaMin < 1 || notaMin > 100) { ADM.ui.toast('A nota mínima deve estar entre 1 e 100.', 'wa'); f.nota_minima.i.focus(); return false; }
                if (cAtiva.i.checked && !itens.length) { ADM.ui.toast('Uma prova ativa precisa de pelo menos 1 caso.', 'wa'); return false; }
                const v = { titulo, descricao: f.descricao.i.value.trim() || null, curso_nome: f.curso_nome.i.value.trim() || null, curso_link: f.curso_link.i.value.trim() || null, proximo_link: f.proximo_link.i.value.trim() || null,
                    msg_aprovado: f.msg_aprovado.i.value.trim() || null, msg_reprovado: f.msg_reprovado.i.value.trim() || null, itens,
                    config: { nota_minima: notaMin, max_mensagens: num(f.max_mensagens.i.value, 12, 0, 60), tempo_min: num(f.tempo_min.i.value, 0, 0, 240), max_tentativas: num(f.max_tentativas.i.value, 0, 0, 50), perfil: selPerfil.value, dicas: cDicas.i.checked, embaralhar: cEmb.i.checked },
                    ativo: cAtiva.i.checked };
                if (nova) {
                    v.criado_por = ADM.auth.usuario();
                    const r = await ADM.sb.from('sim_provas').insert(v).select('*'); ADM.db.exigirAfetadas(r); E.provas.unshift(r.data[0]);
                } else {
                    const r = await ADM.sb.from('sim_provas').update(v).eq('id', p.id).select('*'); ADM.db.exigirAfetadas(r);
                    const i = E.provas.findIndex(x => x.id === p.id); if (i >= 0) E.provas[i] = r.data[0];
                }
                renderSub(); ADM.ui.toast(nova ? 'Prova criada.' : 'Prova salva.' + (v.ativo ? '' : ' (está desativada: ninguém a vê ainda)'), 'ok', 3200); api.fechar();
            } }] });
    }

    // caso escrito à mão dentro da prova (não depende do banco de dados)
    function casoProprio(it, aoSalvar) {
        const f = {
            titulo: campoTexto('A dúvida do cliente *', it ? it.titulo : '', { max: 300, dica: 'Ex.: Não consigo emitir o CT-e, aparece erro de CFOP', ajuda: 'É o problema que o cliente simulado conta (de forma vaga, como um cliente real).' }),
            categoria: campoTexto('Assunto (opcional)', it ? it.categoria : '', { max: 80, dica: 'Ex.: Ct-e' }),
            solucao: campoTexto('Solução correta *', it ? it.solucao : '', { multi: true, linhas: 9, max: 6000, dica: 'Escreva o passo a passo que o suporte precisa orientar…', ajuda: 'A IA só considera o caso resolvido quando o aluno orientar o essencial desta solução (não precisa das mesmas palavras). Quanto mais claro, mais justa a correção.' }),
        };
        ADM.ui.modal({ titulo: it ? 'Editar caso próprio' : 'Novo caso próprio', largura: 700, fecharFora: false, corpo: [f.titulo.el, f.categoria.el, f.solucao.el],
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, { rotulo: 'Salvar caso', tipo: 'primario', fechar: false, acao: (b, api) => {
                const titulo = f.titulo.i.value.trim(), solucao = f.solucao.i.value.trim();
                if (!titulo || !solucao) { ADM.ui.toast('Preencha a dúvida do cliente e a solução.', 'wa'); return false; }
                if (solucao.length < 30) { ADM.ui.toast('A solução está curta demais para a IA conferir a resposta do aluno.', 'wa'); return false; }
                if (it) { it.titulo = titulo; it.categoria = f.categoria.i.value.trim(); it.solucao = solucao; aoSalvar(it); }
                else aoSalvar({ tipo: 'custom', titulo, categoria: f.categoria.i.value.trim(), solucao });
                api.fechar();
            } }] });
    }

    // escolher casos já cadastrados no banco de dados (BancoDados)
    async function escolherDoBanco(atuais, aoAdicionar) {
        if (!E.banco) {
            try { E.banco = await ADM.db.todas((a, b) => ADM.sb.from('BancoDados').select('id, titulo, categoria').order('id', { ascending: true }).range(a, b)); }
            catch (e) { ADM.ui.toast('Não consegui ler o banco de dados: ' + ADM.db.erroTexto(e), 'er', 9000); return; }
        }
        const ja = new Set(atuais.filter(x => x.tipo === 'banco').map(x => Number(x.id))), marcados = new Map();
        const cats = Array.from(new Set(E.banco.map(r => String(r.categoria || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const busca = h('input', { type: 'search', placeholder: 'Buscar pela dúvida (título do caso)…', 'aria-label': 'Buscar' });
        const selCat = h('select', { 'aria-label': 'Assunto' }, h('option', { value: '' }, 'Todos os assuntos'), cats.map(c => h('option', { value: c }, c)));
        const lista = h('div', { class: 'trein-itens', style: { maxHeight: '340px', overflow: 'auto' } }), cont = h('span', { class: 'mu' });
        function desenhar() {
            const q = semAcento(busca.value).trim(), cat = selCat.value;
            const achados = E.banco.filter(r => (!cat || String(r.categoria || '').trim() === cat) && (!q || semAcento(r.titulo).includes(q)));
            limpar(lista);
            if (!achados.length) lista.appendChild(h('div', { class: 'dica', style: { padding: '8px 2px' } }, 'Nenhum caso encontrado.'));
            achados.slice(0, 80).forEach(r => {
                const bloqueado = ja.has(Number(r.id)), i = h('input', { type: 'checkbox', checked: marcados.has(r.id) || bloqueado, disabled: bloqueado });
                i.addEventListener('change', () => { if (i.checked) marcados.set(r.id, r.titulo); else marcados.delete(r.id); cont.textContent = marcados.size + ' selecionado(s)'; });
                lista.appendChild(h('label', { class: 'trein-item marcar' }, i, h('span', { class: 'mono mu' }, '#' + r.id), h('span', { class: 'grow trein-t' }, r.titulo), r.categoria ? h('span', { class: 'sel' }, r.categoria) : null, bloqueado ? h('span', { class: 'mu' }, 'já na prova') : null));
            });
            if (achados.length > 80) lista.appendChild(h('div', { class: 'dica', style: { padding: '6px 2px' } }, 'Mostrando 80 de ' + achados.length + '. Refine a busca.'));
        }
        busca.addEventListener('input', debounce(desenhar, 150)); selCat.addEventListener('change', desenhar);
        ADM.ui.modal({ titulo: 'Adicionar casos do banco de dados', largura: 760, fecharFora: false,
            corpo: [h('div', { class: 'dica' }, 'O título do caso é a dúvida que o cliente simulado vai contar; o conteúdo é a solução que o aluno precisa orientar. Casos sem solução cadastrada são ignorados na prova.'), h('div', { class: 'linha' }, h('div', { class: 'grow', style: { minWidth: '220px' } }, busca), selCat), lista, cont],
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, { rotulo: 'Adicionar selecionados', tipo: 'primario', acao: () => {
                if (!marcados.size) { ADM.ui.toast('Marque pelo menos um caso.', 'wa'); return false; }
                aoAdicionar(Array.from(marcados.entries()).map(([id, titulo]) => ({ tipo: 'banco', id: Number(id), titulo: String(titulo || '') })));
            } }] });
        desenhar();
    }

    /* ═════════════ TREINOS LIVRES ═════════════ */
    function renderTreinos(c) {
        const todas = E.sessoes, resolvidos = todas.filter(s => s.resultado === 'Resolvido').length;
        const medMsg = todas.length ? Math.round(todas.reduce((a, s) => a + (Number(s.turnos) || 0), 0) / todas.length * 10) / 10 : null;
        c.appendChild(h('div', { class: 'kpis' },
            kpi('Treinos feitos', ADM.fmt.num(todas.length), 'no treino livre'),
            kpi('Pessoas', ADM.fmt.num(new Set(todas.map(s => s.nome_chave)).size), 'que treinaram'),
            kpi('Resolvidos', todas.length ? Math.round(resolvidos / todas.length * 100) + '%' : '—', resolvidos + ' de ' + todas.length, 'ok'),
            kpi('Mensagens por treino', medMsg != null ? String(medMsg).replace('.', ',') : '—', 'média de mensagens do aluno', 'in')));
        c.appendChild(h('div', { style: { height: '14px' } }));
        const busca = h('input', { type: 'search', placeholder: 'Buscar pelo nome ou pela dúvida…', 'aria-label': 'Buscar', value: E.fTre.texto });
        busca.addEventListener('input', debounce(() => { E.fTre.texto = busca.value; renderTabelaTre(); }, 200));
        const sel = h('select', { 'aria-label': 'Resultado' }, [['', 'Todos os resultados'], ['Resolvido', 'Resolvidos'], ['Encerrado sem resolver', 'Sem resolver']].map(([v, t]) => h('option', { value: v }, t)));
        sel.value = E.fTre.resultado; sel.addEventListener('change', () => { E.fTre.resultado = sel.value; renderTabelaTre(); });
        R.treContagem = h('span', { class: 'mu nw' }); R.treTabela = h('div');
        c.appendChild(h('div', { class: 'barra', style: { marginBottom: '10px' } }, busca, sel, R.treContagem));
        c.appendChild(R.treTabela);
        renderTabelaTre();
    }
    function renderTabelaTre() {
        const box = limpar(R.treTabela), q = semAcento(E.fTre.texto).trim();
        const lista = E.sessoes.filter(s => (!E.fTre.resultado || s.resultado === E.fTre.resultado) && (!q || semAcento(s.nome + ' ' + (s.caso_titulo || '')).includes(q)));
        R.treContagem.textContent = E.sessoes.length ? lista.length + ' de ' + E.sessoes.length : '';
        if (!E.sessoes.length) { box.appendChild(ADM.ui.vazio('🎧', 'Nenhum treino registrado ainda', 'Quando alguém concluir um caso no treino livre do simulador, ele aparece aqui.')); return; }
        if (!lista.length) { box.appendChild(ADM.ui.vazio('🔎', 'Nada encontrado', 'Ajuste a busca ou o filtro.')); return; }
        const linhas = lista.slice(0, MAX_LINHAS).map(s => h('tr', null,
            h('td', { class: 'nw mu' }, ADM.fmt.dataHora(s.criado_em)),
            h('td', { style: { fontWeight: 700, wordBreak: 'break-word', minWidth: '150px' } }, s.nome),
            h('td', { style: { minWidth: '220px', maxWidth: '420px', wordBreak: 'break-word' } }, s.caso_titulo || '—', s.categoria ? h('div', { class: 'mu', style: { fontSize: '12px' } }, s.categoria) : null),
            h('td', { class: 'nw' }, h('span', { class: 'sel ' + (s.resultado === 'Resolvido' ? 'ok' : 'wa') }, s.resultado === 'Resolvido' ? 'Resolvido' : 'Sem resolver')),
            h('td', { class: 'tr mono' }, s.turnos != null ? s.turnos : '—'), h('td', { class: 'tr mono' }, s.dicas != null ? s.dicas : '—'), h('td', { class: 'tr mono mu' }, mmss(s.duracao_s)),
            h('td', { class: 'acoes' },
                h('button', { class: 'btn peq', type: 'button', onclick: () => abrirSessao(s) }, I('eye', 14), 'Conversa'),
                h('button', { class: 'btn peq fantasma perigo', type: 'button', title: 'Apagar', 'aria-label': 'Apagar', onclick: () => apagarSessao(s) }, I('trash', 14)))));
        box.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, h('th', null, 'Quando'), h('th', null, 'Nome'), h('th', null, 'Caso'), h('th', null, 'Resultado'), h('th', { class: 'tr' }, 'Msgs'), h('th', { class: 'tr' }, 'Dicas'), h('th', { class: 'tr' }, 'Tempo'), h('th', null, ''))),
            h('tbody', null, linhas))));
        if (lista.length > MAX_LINHAS) box.appendChild(h('div', { class: 'dica', style: { margin: '6px 2px' } }, 'Mostrando os ' + MAX_LINHAS + ' mais recentes de ' + lista.length + '. Use a busca/filtro para ver os outros.'));
    }
    async function abrirSessao(s) {
        const box = h('div', null, carregandoEl()); let conv = [];
        ADM.ui.modal({ titulo: s.nome + ' — treino', largura: 760,
            corpo: [h('div', { class: 'linha', style: { gap: '8px' } }, h('span', { class: 'sel ' + (s.resultado === 'Resolvido' ? 'ok' : 'wa') }, s.resultado || '—'), h('span', { class: 'mu' }, ADM.fmt.dataHora(s.criado_em) + ' · ' + (s.turnos || 0) + ' msg · ' + mmss(s.duracao_s) + (s.perfil ? ' · cliente ' + s.perfil : '') + (s.modelo ? ' · ' + s.modelo : ''))),
                h('div', { style: { fontWeight: 700, wordBreak: 'break-word' } }, s.caso_titulo || ''), box],
            botoes: [{ rotulo: 'Copiar conversa', tipo: 'fantasma', fechar: false, acao: async () => { await ADM.ui.copiar((s.caso_titulo ? s.caso_titulo + '\n\n' : '') + textoConversa(conv), 'Conversa copiada.'); return false; } }, { rotulo: 'Fechar', tipo: 'primario' }] });
        try { const r = await ADM.sb.from('sim_sessoes').select('conversa').eq('id', s.id).maybeSingle(); if (r.error) throw r.error; conv = (r.data && r.data.conversa) || []; limpar(box).appendChild(conversaEl(conv)); }
        catch (e) { limpar(box).appendChild(ADM.ui.aviso('er', ADM.db.erroTexto(e))); }
    }
    async function apagarSessao(s) {
        if (!(await ADM.ui.confirmar('Apagar este treino de ' + s.nome + '?', { titulo: 'Apagar treino', rotuloOk: 'Apagar', perigo: true }))) return;
        try { const r = await ADM.sb.from('sim_sessoes').delete().eq('id', s.id).select('id'); ADM.db.exigirAfetadas(r); E.sessoes = E.sessoes.filter(x => x.id !== s.id); renderSub(); ADM.ui.toast('Treino apagado.', 'ok', 2200); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }

    /* ═════════════ CONFIGURAÇÕES ═════════════ */
    function renderConfig(c) {
        const cfg = E.config;
        const treino = ADM.ui.chave(cfg.treino_livre !== false, null, 'Treino livre liberado');
        const boas = h('textarea', { rows: 3, maxlength: 600, placeholder: 'Opcional. Aparece no topo da tela inicial do simulador, depois de “Olá, Nome!”.' }); boas.value = cfg.boas_vindas || '';
        const notaPadrao = h('input', { type: 'number', min: 1, max: 100, value: num(cfg.nota_minima_padrao, 70, 1, 100) });
        const salvar = h('button', { class: 'btn primario', type: 'button', onclick: e => ADM.ui.ocupado(e.currentTarget, async () => {
            const novo = { treino_livre: treino.input.checked, boas_vindas: boas.value.trim(), nota_minima_padrao: num(notaPadrao.value, 70, 1, 100) };
            try { const r = await ADM.sb.from('sim_config').upsert({ id: 1, config: novo }).select('id'); ADM.db.exigirAfetadas(r); E.config = Object.assign({}, CFG_PADRAO, novo); ADM.ui.toast('Configurações salvas. O simulador usa na próxima vez que for aberto.', 'ok', 3500); }
            catch (err) { ADM.ui.toast(ADM.db.erroTexto(err), 'er', 9000); }
        }) }, I('save', 15), 'Salvar configurações');
        c.appendChild(h('div', { class: 'g2' },
            h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('gear', 16), 'Simulador')), h('div', { class: 'cartao-corpo' },
                h('div', { class: 'linha' }, treino.el, h('div', null, h('b', null, 'Treino livre liberado'), h('div', { class: 'dica' }, 'Desligado: o simulador mostra só as provas (útil para a equipe fazer apenas o que foi pedido).'))),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Mensagem de boas-vindas'), boas),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Nota mínima padrão das provas novas (%)'), notaPadrao),
                h('div', { class: 'linha' }, salvar))),
            h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('ext', 16), 'Links')), h('div', { class: 'cartao-corpo' },
                h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Simulador (todas as provas)'), h('div', { class: 'linha' }, h('code', { class: 'mono grow', style: { wordBreak: 'break-all' } }, linkSimulador()),
                    h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.copiar(linkSimulador(), 'Link copiado.') }, I('copy', 14), 'Copiar'), h('a', { class: 'btn peq', href: linkSimulador(), target: '_blank', rel: 'noopener' }, 'Abrir'))),
                h('div', { class: 'dica' }, h('b', null, 'Como ligar ao YOUniversity: '), 'em cada conteúdo, coloque um botão ou link “Fazer a prova” que aponte para o link da prova (na seção Provas, ícone de copiar). Quando a pessoa termina o conteúdo e faz a prova, o resultado aparece aqui em “Resultados”.'),
                h('div', { class: 'dica' }, h('b', null, 'Testar sem gravar: '), 'o ícone ▶ da prova abre o simulador em modo teste (nada é registrado).'),
                h('div', { class: 'dica' }, h('b', null, 'Como a nota é calculada: '), 'cada caso resolvido vale igual; nota = % de casos resolvidos. A IA faz o cliente e a conferência, então use “Decisão do administrador” em um resultado se achar que ela errou.')))));
        c.appendChild(h('div', { style: { height: '14px' } }));
        c.appendChild(ADM.ui.aviso('in', h('b', null, 'Importante: '), 'a prova roda no navegador de quem a faz (a IA conversa por ele), então a nota é um registro de aprendizado, não um exame com fiscal. Por isso você pode abrir qualquer tentativa, ler as conversas e aprovar/reprovar manualmente. As soluções dos casos não aparecem para o aluno durante a prova, mas quem sabe inspecionar a página consegue lê-las.'));
    }

    /* ───────────── aba ───────────── */
    ADM.registrarAba({
        id: 'treinamento', titulo: 'Treinamento', icone: 'book', ordem: 35,
        descricao: 'Área administrativa do Simulador de atendimento: monte as provas do YOUniversity, acompanhe quem fez cada prova (nome, nota, conversa) e os treinos livres.',
        montar(ctx) {
            R.subBotoes = SUBS.map(([id, rot]) => h('button', { type: 'button', dataset: { sub: id }, 'aria-pressed': String(id === E.sub), onclick: () => mudarSub(id) }, rot));
            R.corpo = ctx.corpo;
            ctx.barra.append(h('div', { class: 'abas-mini', role: 'group', 'aria-label': 'Seções do treinamento' }, R.subBotoes), h('span', { class: 'grow' }),
                h('a', { class: 'btn', href: linkSimulador(), target: '_blank', rel: 'noopener', title: 'Abre o simulador em outra guia' }, I('ext', 15), 'Abrir o simulador'),
                h('button', { class: 'btn icone', type: 'button', title: 'Atualizar', 'aria-label': 'Atualizar', onclick: e => ADM.ui.ocupado(e.currentTarget, carregarTudo) }, I('refresh', 17)));
            renderSub();
        },
        abrir() { if (!E.carregou) carregarTudo(); },
    });
})();
