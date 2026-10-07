/* admin/js/aba-analise.js — Aba "Análise": o que os usuários perguntam, quando e quem — lendo TODOS os logs direto do Supabase (sem importar CSV).
   Quatro visões: Foco IA (o que alimentar primeiro), Temporal (com filtros de período, usuário, assunto e pergunta específica), Usuários e
   Perguntas recorrentes. A matemática vem de analise-core.js (a mesma do "Análise de Logs.html"), os gráficos de graficos.js.
   Só LÊ a tabela logs (nunca grava) e não baixa a coluna "resposta" (grande). Tudo que vem do banco entra na tela como texto. */
(function () {
    'use strict';
    const A = AnaliseLogs;
    const COLUNAS = [
        'id, pergunta, encontrou, feedback, usuario_windows, timestamp, created_at, fonte',
        'id, pergunta, encontrou, feedback, usuario_windows, timestamp, created_at',   // sem as colunas do SQL 02
        'id, pergunta, usuario_windows, created_at',                                    // banco bem antigo
    ];
    const MAX_LINHAS = 300000, VALIDADE_MS = 10 * 60 * 1000, PAGINA = 50, CHAVE_SUB = 'bsoft_admin_analise_sub';
    const SUBS = [['foco', 'Foco IA'], ['tempo', 'Temporal'], ['usuarios', 'Usuários'], ['recorrentes', 'Recorrentes']];
    const ORIGENS = { ia: '🤖 IA', rapida: '⚡ Resposta rápida', ferramenta: '🧰 Ferramentas', sem: 'Sem origem registrada' };
    const num = n => ADM.fmt.num(n);
    const pct = t => t === null ? '—' : (t * 100).toFixed(1).replace('.', ',') + '%';
    const filtroVazio = () => ({ de: '', ate: '', usuario: '', categoria: '', texto: '', exata: false });
    const E = { linhas: [], info: null, opcoes: { usuarios: [], categorias: [], perguntas: [] }, chaves: new Set(), limites: { min: null, max: null }, origens: new Map(),
        carregando: false, erro: null, progresso: 0, carregadoEm: 0, jaCarregou: false, truncado: false, nivel: 0,
        sub: 'foco', fonte: '', FT: filtroVazio(), limiteTabela: PAGINA, sujo: {}, _dados: null };
    const R = { paineis: {}, subBotoes: [] };

    /* ───────────── dados ───────────── */
    const daOrigem = l => E.fonte === 'sem' ? l.fonte === '' : l.fonte === E.fonte;
    function dados() {   // as consultas depois do filtro de origem (guardado para não refazer a cada tela)
        const c = E._dados;
        if (c && c.ref === E.linhas && c.fonte === E.fonte) return c.valor;
        const valor = E.fonte ? E.linhas.filter(daOrigem) : E.linhas;
        E._dados = { ref: E.linhas, fonte: E.fonte, valor };
        return valor;
    }
    function recalcularBase() {
        E._dados = null;
        const d = dados();
        E.opcoes = A.opcoesFiltro(d, 300);
        E.chaves = new Set(d.map(l => l.chave));
        E.limites = A.limitesDatas(d);
        montarOpcoesTemporal();
    }
    function contarOrigens() {
        const m = new Map();
        E.linhas.forEach(l => { const k = l.fonte && ORIGENS[l.fonte] ? l.fonte : (l.fonte ? 'outra' : 'sem'); m.set(k, (m.get(k) || 0) + 1); });
        E.origens = m;
    }
    function montarOrigem() {
        if (!R.origem) return;
        limpar(R.origem).appendChild(h('option', { value: '' }, 'Todas as origens'));
        Object.keys(ORIGENS).forEach(k => { if (E.origens.get(k)) R.origem.appendChild(h('option', { value: k }, `${ORIGENS[k]} (${num(E.origens.get(k))})`)); });
        if (!Array.from(R.origem.options).some(o => o.value === E.fonte)) E.fonte = '';
        R.origem.value = E.fonte;
        R.origem.hidden = !(E.origens.size > 1 || (E.origens.size === 1 && !E.origens.has('sem')));   // só aparece se os logs trazem a origem
    }

    async function carregar(silencioso) {
        if (E.carregando) return;
        E.carregando = true; E.progresso = 0;
        if (!silencioso || !E.jaCarregou) E.erro = null;
        renderEstado();
        try {
            let bruto = null, ultimo = null;
            for (let n = E.nivel; n < COLUNAS.length; n++) {   // tenta com todas as colunas; se o banco ainda não tem as novas, cai para as antigas
                try {
                    bruto = await ADM.db.todas((de, ate) => ADM.sb.from('logs').select(COLUNAS[n]).order('id', { ascending: true }).range(de, ate), { max: MAX_LINHAS, progresso: q => { E.progresso = q; renderProgresso(); } });
                    E.nivel = n; ultimo = null; break;
                } catch (e) { ultimo = e; if (!ADM.db.ehColunaAusente(e)) break; }
            }
            if (ultimo) throw ultimo;
            E.truncado = bruto.length >= MAX_LINHAS;
            const r = A.normalizarLinhas(bruto);
            E.linhas = r.linhas; E.info = r.info; E.erro = null;
            contarOrigens(); montarOrigem(); recalcularBase();
            E.jaCarregou = true; E.carregadoEm = Date.now();
        } catch (e) {
            E.erro = e;
            if (silencioso && E.jaCarregou) ADM.ui.toast('Não consegui atualizar a análise: ' + ADM.db.erroTexto(e), 'wa', 7000);
        }
        E.carregando = false;
        renderTudo();
    }

    /* ───────────── peças de tela ───────────── */
    const cartao = (titulo, icone, corpo, acoes) => h('div', { class: 'cartao' },
        h('div', { class: 'cartao-topo' }, h('h3', null, icone ? I(icone, 16) : null, titulo), acoes || null),
        h('div', { class: 'cartao-corpo' }, corpo));
    const kpi = (rotulo, valor, sub, tipo) => h('div', { class: 'kpi ' + (tipo || '') }, h('span', { class: 'r' }, rotulo), h('span', { class: 'v' }, valor), h('span', { class: 's' }, sub || ' '));
    const botaoVer = (filtro, titulo) => h('button', { class: 'btn peq', type: 'button', title: titulo || 'Abrir a análise temporal já filtrada', onclick: () => verNoTempo(filtro) }, I('chart', 13), 'Ver no tempo');
    function tabelaDe(colunas, linhas) {
        return h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, colunas.map(c => h('th', { class: c[1] || '' }, c[0])))), h('tbody', null, linhas)));
    }
    function bolinha(cor) { const i = h('i'); i.style.background = cor; return i; }
    const segmentos = c => [{ valor: c.ok, classe: 'ok' }, { valor: c.falha, classe: 'er' }, { valor: c.semInfo, classe: 'sem' }];
    const legendaRank = () => h('div', { class: 'rk-leg' }, [['var(--ad-ok)', 'encontrou'], ['var(--ad-er)', 'sem resposta'], ['var(--ad-ln-2)', 'sem a informação']].map(([c, t]) => h('span', null, bolinha(c), t)));
    const dicaRank = (nome, c) => `${nome} — ${num(c.total)} consulta(s): ${num(c.ok)} encontrada(s), ${num(c.falha)} sem resposta` + (c.semInfo ? `, ${num(c.semInfo)} sem a informação` : '');

    /* ───────────── estado geral ───────────── */
    function renderProgresso() { if (R.progresso) R.progresso.textContent = 'Carregando os logs… ' + num(E.progresso); }
    function renderChip() {
        if (!R.chip) return;
        if (!E.jaCarregou) { R.chip.textContent = E.carregando ? 'carregando…' : ''; R.chip.title = ''; return; }
        const d = dados(), rel = ADM.fmt.relativo(new Date(E.carregadoEm));
        R.chip.textContent = `${num(d.length)} consulta(s)` + (E.limites.min ? ` · ${A.formatarDia(E.limites.min)} a ${A.formatarDia(E.limites.max)}` : '') + ' · ' + (E.carregando ? 'atualizando…' : rel === 'agora' ? 'atualizado agora' : 'atualizado há ' + rel);
        const i = E.info, notas = [];
        if (i) { if (i.semData) notas.push(num(i.semData) + ' sem data válida (fora da análise temporal)'); if (i.semPergunta) notas.push(num(i.semPergunta) + ' sem pergunta (ignorados)'); if (i.ignoradas) notas.push(num(i.ignoradas) + ' registros antigos de feedback (ignorados)'); }
        R.chip.title = 'Horário de Brasília.' + (notas.length ? ' ' + notas.join(' · ') + '.' : '');
    }
    function renderEstado() {
        if (!R.aviso) return;
        const box = limpar(R.aviso), tem = E.linhas.length > 0;
        if (E.erro && !tem) box.appendChild(ADM.ui.aviso('er', h('b', null, 'Não consegui carregar os logs.'), h('br'), ADM.db.erroTexto(E.erro), h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn peq', type: 'button', onclick: () => carregar() }, 'Tentar de novo'))));
        else if (E.carregando && !E.jaCarregou) { R.progresso = h('span', null, 'Carregando os logs…'); box.appendChild(h('div', { class: 'vazio' }, h('span', { class: 'girar', style: { display: 'inline-block' } }, I('refresh', 22)), ' ', R.progresso)); }
        else if (E.jaCarregou && !tem) box.appendChild(ADM.ui.vazio('📊', 'Ainda não há consultas para analisar', 'Quando os usuários usarem o sistema, as perguntas aparecem aqui.'));
        else if (E.truncado) box.appendChild(ADM.ui.aviso('wa', 'A tabela de logs tem mais de ' + num(MAX_LINHAS) + ' linhas — a análise usa só as primeiras ' + num(MAX_LINHAS) + '.'));
        R.corpo.hidden = !tem;
        R.btnAtualizar.classList.toggle('carregando', E.carregando);
        renderChip();
    }
    function renderKPIs() {
        const s = A.resumir(dados());
        limpar(R.kpis).append(
            kpi('Total de consultas', num(s.total), s.diasAtivos ? 'em ' + num(s.diasAtivos) + ' dia(s) com consultas' : '', ''),
            kpi('Taxa de resposta da IA', pct(s.taxa), s.semInfo ? num(s.semInfo) + ' sem a informação' : 'respostas encontradas', 'ok'),
            kpi('Falhas / não encontrados', (s.ok + s.falha) ? num(s.falha) : '—', 'requer inclusão na IA', 'er'),
            kpi('Usuários ativos', num(s.usuarios), num(s.perguntas) + ' pergunta(s) diferente(s)', 'in'));
    }
    function renderTudo() {
        renderEstado();
        if (!E.linhas.length) return;
        renderKPIs();
        E.sujo = { foco: true, tempo: true, usuarios: true, recorrentes: true };
        renderPainel(E.sub);
    }
    function renderPainel(id) {
        if (!E.linhas.length || !E.sujo[id]) return;
        E.sujo[id] = false;
        ({ foco: renderFoco, tempo: renderTemporal, usuarios: renderUsuarios, recorrentes: renderRecorrentes })[id]();
    }
    function mudarSub(id) {
        E.sub = id; try { lsSet(CHAVE_SUB, id); } catch (e) { /* ok */ }
        R.subBotoes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sub === id)));
        Object.keys(R.paineis).forEach(k => { R.paineis[k].hidden = k !== id; });
        renderPainel(id);
    }
    // "Ver no tempo": abre a visão Temporal já filtrada pelo assunto / usuário / pergunta da linha clicada
    function verNoTempo(filtro) {
        E.FT = Object.assign(filtroVazio(), filtro); E.limiteTabela = PAGINA;
        sincronizarCampos(); mudarSub('tempo'); renderTemporal();
        if (R.t && R.t.topo) R.t.topo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ───────────── visão 1: foco da IA ───────────── */
    const BADGE = { alta: ['er', 'ALTA', 'inserir conteúdo urgente'], media: ['wa', 'MÉDIA', 'revisar conteúdo'], baixa: ['', 'BAIXA', 'acompanhar'] };
    function renderFoco() {
        const d = dados(), cats = A.porCategoria(d), s = A.resumir(d);
        const ranking = ADM.graf.ranking(cats.map(c => ({ rotulo: c.categoria, valor: c.total, dica: dicaRank(c.categoria, c), segmentos: segmentos(c) })));
        const rosca = h('div');
        ADM.graf.rosca(rosca, [{ rotulo: 'Encontrou (a IA respondeu)', valor: s.ok, cor: 'var(--ad-ok)' }, { rotulo: 'Sem resposta (lacuna)', valor: s.falha, cor: 'var(--ad-er)' }, { rotulo: 'Sem a informação', valor: s.semInfo, cor: 'var(--ad-ln-2)' }],
            { centro: 'consultas', descricao: `Assertividade da IA: ${num(s.ok)} encontradas, ${num(s.falha)} sem resposta, ${num(s.semInfo)} sem a informação` });
        const linhas = cats.map(c => {
            const [cls, nome, dica] = BADGE[A.prioridade(c)];
            return h('tr', null,
                h('td', { style: { fontWeight: 700 } }, c.categoria), h('td', { class: 'tc' }, num(c.total)),
                h('td', { class: 'tc', style: { color: 'var(--ad-er)', fontWeight: 700 } }, (c.ok + c.falha) ? num(c.falha) : '—'), h('td', { class: 'tc' }, pct(c.taxa)),
                h('td', { class: 'tc' }, h('span', { class: 'sel ' + cls, title: dica }, nome + ' · ' + dica)), h('td', { class: 'tc' }, botaoVer({ categoria: c.categoria })));
        });
        limpar(R.paineis.foco).append(
            h('div', { class: 'grade-21' }, cartao('Volume de dúvidas por categoria / assunto', 'chart', [ranking, legendaRank()]), cartao('Assertividade da IA (encontrou × não encontrou)', 'check', rosca)),
            cartao('Plano de ação: o que alimentar na IA primeiro', 'sparkles', [
                h('div', { class: 'dica' }, 'Categorias classificadas por volume e taxa de lacuna de conhecimento. ALTA = 20+ perguntas com menos de 90% de sucesso, ou 5+ sem resposta; MÉDIA = 10+ perguntas.'),
                tabelaDe([['Categoria / assunto'], ['Total', 'tc'], ['Não encontrados', 'tc'], ['Taxa de sucesso', 'tc'], ['Prioridade', 'tc'], ['Evolução', 'tc']], linhas)]));
    }

    /* ───────────── visão 2: análise temporal (com filtros) ───────────── */
    function montarTemporal() {
        const T = R.t = {};
        T.de = h('input', { type: 'date', 'aria-label': 'Data inicial' }); T.ate = h('input', { type: 'date', 'aria-label': 'Data final' });
        T.usuario = h('select', { 'aria-label': 'Usuário' }); T.assunto = h('select', { 'aria-label': 'Assunto' });
        T.pergunta = h('input', { type: 'text', list: 'dlAnalisePerguntas', autocomplete: 'off', placeholder: 'Escolha na lista ou digite parte da pergunta', 'aria-label': 'Pergunta específica' });
        T.lista = h('datalist', { id: 'dlAnalisePerguntas' });
        T.modo = h('div', { class: 'dica' });
        T.presets = h('div', { class: 'presets' }, [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [0, 'Tudo']].map(([n, t]) =>
            h('button', { class: 'btn peq', type: 'button', dataset: { dias: n }, title: n ? `Últimos ${n} dias, até a data do último log` : 'Todo o período dos dados', onclick: () => aplicarPreset(n) }, t)));
        T.resumo = h('div', { class: 'estat', 'aria-live': 'polite' });
        T.aviso = h('div', { hidden: true }, ADM.ui.aviso('wa', 'A data inicial é maior que a data final — ajuste o período.'));
        T.vazio = h('div', { class: 'cartao', hidden: true }, ADM.ui.vazio('🔎', 'Nenhuma consulta com esses filtros', 'Amplie o período ou remova algum filtro (use o “×” nos itens acima ou “Limpar filtros”).'));
        T.kpis = h('div', { class: 'kpis' }); T.graficoDia = h('div'); T.graficoHora = h('div'); T.frequentes = h('div', { class: 'freq' });
        T.tabelaInfo = h('span', null); T.tabelaCorpo = h('tbody');
        T.mais = h('button', { class: 'btn peq', type: 'button', hidden: true, onclick: () => { E.limiteTabela += PAGINA; renderTabelaTemporal(fatia(false)); } }, 'Mostrar mais');
        T.conteudo = h('div', { class: 'an-painel' }, T.kpis,
            cartao('Evolução diária de consultas', 'chart', T.graficoDia),
            h('div', { class: 'grade-21' },
                cartao('Horários de pico ao longo do dia', 'clock', T.graficoHora),
                cartao('Perguntas mais frequentes', 'repeat', [h('div', { class: 'dica' }, 'Dentro do período, usuário e assunto escolhidos. Clique para ver só aquela pergunta no tempo.'), T.frequentes])),
            cartao('Consultas do filtro', 'list', [
                h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' }, h('thead', null, h('tr', null, [['Data / hora'], ['Usuário'], ['Assunto'], ['Pergunta'], ['Resultado', 'tc']].map(c => h('th', { class: c[1] || '' }, c[0])))), T.tabelaCorpo)),
                h('div', { class: 'rodape-tabela' }, T.tabelaInfo, T.mais)]));
        T.topo = cartao('Filtros da análise temporal', 'filter', [
            h('div', { class: 'filtros-analise' },
                h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Período'), h('div', { class: 'periodo' }, T.de, h('span', { class: 'mu' }, 'até'), T.ate), T.presets),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Usuário'), T.usuario),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Assunto'), T.assunto),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Pergunta específica'), T.pergunta, T.lista, T.modo)),
            T.resumo],
            h('button', { class: 'btn peq fantasma', type: 'button', onclick: () => { E.FT = filtroVazio(); E.limiteTabela = PAGINA; sincronizarCampos(); renderTemporal(); } }, I('x', 13), 'Limpar filtros'));
        R.paineis.tempo.append(T.topo, T.aviso, T.vazio, T.conteudo);

        const mudou = () => { E.limiteTabela = PAGINA; renderTemporal(); };
        T.de.addEventListener('change', () => { E.FT.de = T.de.value; mudou(); });
        T.ate.addEventListener('change', () => { E.FT.ate = T.ate.value; mudou(); });
        T.usuario.addEventListener('change', () => { E.FT.usuario = T.usuario.value; mudou(); });
        T.assunto.addEventListener('change', () => { E.FT.categoria = T.assunto.value; mudou(); });
        let tipo = '';
        const aplicarPergunta = debounce(() => {
            E.FT.texto = T.pergunta.value;
            // escolher uma pergunta da lista (o navegador avisa como "insertReplacementText") = só aquela pergunta; digitar = perguntas que contêm o texto
            E.FT.exata = E.chaves.has(A.chaveTexto(E.FT.texto)) && /replacement/i.test(tipo);
            mudou();
        }, 220);
        T.pergunta.addEventListener('input', ev => { tipo = ev.inputType || ''; aplicarPergunta(); });
    }
    function montarOpcoesTemporal() {
        const T = R.t; if (!T) return;
        const preencher = (sel, vazio, itens, valor) => {
            limpar(sel).appendChild(h('option', { value: '' }, vazio));
            itens.forEach(i => sel.appendChild(h('option', { value: i.nome }, `${i.nome} (${num(i.total)})`)));
            sel.value = valor; return sel.value;   // '' se o valor escolhido antes não existe mais
        };
        E.FT.usuario = preencher(T.usuario, 'Todos os usuários', E.opcoes.usuarios, E.FT.usuario);
        E.FT.categoria = preencher(T.assunto, 'Todos os assuntos', E.opcoes.categorias, E.FT.categoria);
        limpar(T.lista);
        E.opcoes.perguntas.forEach(p => T.lista.appendChild(h('option', { value: p.texto, label: num(p.total) + (p.total === 1 ? ' consulta' : ' consultas') })));
        T.de.min = T.ate.min = E.limites.min || ''; T.de.max = T.ate.max = E.limites.max || '';
        sincronizarCampos();
    }
    function sincronizarCampos() {   // põe os valores de E.FT nos campos da tela
        const T = R.t; if (!T) return;
        T.de.value = E.FT.de; T.ate.value = E.FT.ate; T.usuario.value = E.FT.usuario; T.assunto.value = E.FT.categoria; T.pergunta.value = E.FT.texto;
    }
    function aplicarPreset(n) {
        if (!E.limites.max) return;
        if (!n) { E.FT.de = ''; E.FT.ate = ''; }
        else { E.FT.ate = E.limites.max; E.FT.de = A.somarDias(E.limites.max, -(n - 1)); if (E.FT.de < E.limites.min) E.FT.de = E.limites.min; }
        sincronizarCampos(); E.limiteTabela = PAGINA; renderTemporal();
    }
    // linhas do filtro; "semPergunta" ignora a pergunta (a lista das mais frequentes precisa continuar mostrando as outras, para você trocar de pergunta)
    function fatia(semPergunta) {
        const FT = E.FT, f = { de: FT.de, ate: FT.ate, usuario: FT.usuario, categoria: FT.categoria, soComData: true };
        if (!semPergunta && FT.texto.trim()) { if (FT.exata) f.chaveExata = A.chaveTexto(FT.texto); else f.texto = FT.texto; }
        return A.filtrar(dados(), f);
    }
    function chip(texto, aoRemover, titulo) {
        return h('span', { class: 'chip filtro', title: titulo || texto }, h('span', null, texto), h('button', { type: 'button', 'aria-label': 'Remover este filtro', onclick: aoRemover }, '×'));
    }
    function renderTemporal() {
        const T = R.t, FT = E.FT; if (!T || !E.linhas.length) return;
        const invertido = !!(FT.de && FT.ate && FT.de > FT.ate);
        const f = fatia(false), s = A.resumir(f), texto = FT.texto.trim(), chaveDigitada = A.chaveTexto(texto);
        const limpa = fn => () => { fn(); sincronizarCampos(); E.limiteTabela = PAGINA; renderTemporal(); };

        T.aviso.hidden = !invertido;
        Array.from(T.presets.children).forEach(b => {
            const n = Number(b.dataset.dias); let ativo = false;
            if (!n) ativo = !FT.de && !FT.ate;
            else if (E.limites.max) { let de = A.somarDias(E.limites.max, -(n - 1)); if (de < E.limites.min) de = E.limites.min; ativo = FT.ate === E.limites.max && FT.de === de; }
            b.classList.toggle('ativo', ativo);
        });
        limpar(T.modo);
        if (!texto) T.modo.textContent = 'Em branco = todas as perguntas.';
        else if (FT.exata) T.modo.append('Somente esta pergunta (igual). ', h('a', { href: '#', onclick: ev => { ev.preventDefault(); FT.exata = false; renderTemporal(); } }, 'Incluir as que contêm o texto'));
        else if (E.chaves.has(chaveDigitada)) T.modo.append('Perguntas que contêm o texto. ', h('a', { href: '#', onclick: ev => { ev.preventDefault(); FT.exata = true; renderTemporal(); } }, 'Só esta pergunta (igual)'));
        else T.modo.textContent = 'Perguntas que contêm o texto digitado.';

        limpar(T.resumo).append(h('span', { class: 'chip' }, h('b', null, num(s.total)), ' de ' + num(dados().filter(l => l.dia).length) + ' consulta(s) com data'));
        if (FT.de || FT.ate) T.resumo.appendChild(chip('Período: ' + (FT.de ? A.formatarDia(FT.de) : 'início') + ' a ' + (FT.ate ? A.formatarDia(FT.ate) : 'fim'), limpa(() => { FT.de = ''; FT.ate = ''; })));
        if (FT.usuario) T.resumo.appendChild(chip('Usuário: ' + FT.usuario, limpa(() => { FT.usuario = ''; })));
        if (FT.categoria) T.resumo.appendChild(chip('Assunto: ' + FT.categoria, limpa(() => { FT.categoria = ''; })));
        if (texto) T.resumo.appendChild(chip('Pergunta ' + (FT.exata ? '(igual): ' : '(contém): ') + ADM.fmt.trunc(texto, 70), limpa(() => { FT.texto = ''; FT.exata = false; }), texto));

        T.vazio.hidden = s.total > 0; T.conteudo.hidden = s.total === 0;
        if (!s.total) return;

        const serie = A.serieDiaria(f, FT.de, FT.ate), horas = A.porHora(f), maxH = Math.max(...horas), picoH = horas.indexOf(maxH);
        const picoDia = serie.reduce((m, x) => x.total > m.total ? x : m, serie[0]);
        limpar(T.kpis).append(
            kpi('Consultas', num(s.total), s.diasAtivos ? num(Math.round(s.total / s.diasAtivos * 10) / 10) + ' por dia com consultas' : '', ''),
            kpi('Respondidas', (s.ok + s.falha) ? num(s.ok) : '—', s.taxa === null ? 'sem a informação' : pct(s.taxa) + ' das consultas', 'ok'),
            kpi('Sem resposta', (s.ok + s.falha) ? num(s.falha) : '—', 'lacunas de conteúdo', 'er'),
            kpi('Usuários', num(s.usuarios), num(s.perguntas) + ' pergunta(s) diferente(s)', 'in'),
            kpi('Pico', maxH > 0 ? picoH + 'h' : '—', picoDia ? 'dia mais cheio: ' + A.formatarDiaCurto(picoDia.dia) + ' (' + num(picoDia.total) + ')' : '', 'wa'));

        const anos = serie.length > 1 && serie[0].dia.slice(0, 4) !== serie[serie.length - 1].dia.slice(0, 4);
        ADM.graf.linha(T.graficoDia, {
            altura: 280, unidade: 'consulta(s)',
            descricao: `Consultas por dia: ${num(s.total)} entre ${A.formatarDia(serie[0].dia)} e ${A.formatarDia(serie[serie.length - 1].dia)}`,
            pontos: serie.map(x => ({ rotulo: anos ? A.formatarDia(x.dia) : A.formatarDiaCurto(x.dia), dica: A.diaSemana(x.dia) + ', ' + A.formatarDia(x.dia), valor: x.total, extra: x.falha ? num(x.falha) + ' sem resposta' : '' })),
        });
        ADM.graf.colunas(T.graficoHora, {
            altura: 240, unidade: 'consulta(s)', descricao: 'Consultas por hora do dia (horário de Brasília)',
            pontos: horas.map((v, i) => ({ rotulo: i + 'h', dica: `Das ${i}h às ${i + 1}h`, valor: v, destaque: v === maxH && v > 0 })),
        });

        const freq = A.recorrentes(fatia(true), 8), ativa = FT.exata ? A.chaveTexto(FT.texto) : '';
        limpar(T.frequentes);
        if (!freq.length) T.frequentes.appendChild(h('div', { class: 'mu' }, 'Nenhuma pergunta neste período.'));
        freq.forEach(q => T.frequentes.appendChild(h('button', { class: 'freq-item' + (q.chave === ativa ? ' ativo' : ''), type: 'button', title: q.pergunta, 'aria-pressed': String(q.chave === ativa), onclick: () => {
            if (q.chave === ativa) { FT.texto = ''; FT.exata = false; } else { FT.texto = q.pergunta; FT.exata = true; }
            sincronizarCampos(); E.limiteTabela = PAGINA; renderTemporal();
        } }, h('span', { class: 'txt' }, q.pergunta), h('span', { class: 'qtd' }, num(q.total) + '×'))));

        renderTabelaTemporal(f);
    }
    function renderTabelaTemporal(f) {
        const T = R.t, ordenadas = f.slice().sort((a, b) => b.ms - a.ms), mostrar = ordenadas.slice(0, E.limiteTabela);
        limpar(T.tabelaCorpo);
        mostrar.forEach(l => T.tabelaCorpo.appendChild(h('tr', null,
            h('td', { class: 'nw mu' }, A.formatarDataHora(l)),
            h('td', { class: 'nw', style: { fontWeight: 600, color: 'var(--ad-in)' } }, l.usuario),
            h('td', { class: 'mu', style: { fontSize: '12px' } }, l.categoria),
            h('td', { class: 'pergunta' }, l.pergunta),
            h('td', { class: 'tc' }, l.encontrou === true ? h('span', { class: 'sel ok' }, 'Respondeu') : l.encontrou === false ? h('span', { class: 'sel er' }, 'Sem resposta') : h('span', { class: 'mu' }, '—')))));
        T.tabelaInfo.textContent = 'Mostrando ' + num(mostrar.length) + ' de ' + num(ordenadas.length) + ' (mais recentes primeiro)';
        T.mais.hidden = ordenadas.length <= mostrar.length;
    }

    /* ───────────── visão 3: usuários ───────────── */
    function renderUsuarios() {
        const d = dados(), us = A.porUsuario(d), top = us.slice(0, 10), top3 = us.slice(0, 3).reduce((a, u) => a + u.total, 0);
        const ranking = ADM.graf.ranking(top.map(u => ({ rotulo: u.usuario, valor: u.total, dica: dicaRank(u.usuario, u), segmentos: segmentos(u) })));
        const linhas = us.map(u => h('tr', null,
            h('td', { style: { fontWeight: 700 } }, u.usuario), h('td', { class: 'tc' }, num(u.total)),
            h('td', { class: 'tc', style: { color: 'var(--ad-ok)' } }, num(u.ok)), h('td', { class: 'tc', style: { color: 'var(--ad-er)' } }, num(u.falha)),
            h('td', null, u.topCategoria), h('td', { class: 'tc' }, botaoVer({ usuario: u.usuario }))));
        const primeiro = us[0];
        limpar(R.paineis.usuarios).append(
            h('div', { class: 'grade-21' },
                cartao('Top usuários mais ativos no suporte', 'user', [ranking, legendaRank()]),
                cartao('Engajamento de usuários', 'activity', [
                    h('div', { class: 'dica' }, 'Veja quais atendentes usam mais a IA e quem precisa de treinamento adicional em módulos específicos.'),
                    h('div', { class: 'kpi in' }, h('span', { class: 'r' }, 'Usuário mais engajado'), h('span', { class: 'v', style: { fontSize: '19px', wordBreak: 'break-word' } }, primeiro ? primeiro.usuario : 'N/A'), h('span', { class: 's' }, primeiro ? num(primeiro.total) + ' consultas' : '')),
                    h('div', { class: 'kpi' }, h('span', { class: 'r' }, 'Distribuição'), h('span', { class: 'v' }, d.length ? pct(top3 / d.length) : '0%'), h('span', { class: 's' }, 'das consultas vêm dos 3 usuários mais ativos'))])),
            cartao('Detalhamento por usuário', 'list', tabelaDe([['Usuário'], ['Consultas', 'tc'], ['Respostas obtidas', 'tc'], ['Sem resposta', 'tc'], ['Assunto mais frequente'], ['Evolução', 'tc']], linhas)));
    }

    /* ───────────── visão 4: perguntas recorrentes ───────────── */
    function renderRecorrentes() {
        const rec = A.recorrentes(dados(), 50);
        const linhas = rec.map(q => h('tr', null,
            h('td', { class: 'pergunta', style: { fontWeight: 600 } }, q.pergunta), h('td', { class: 'mu', style: { fontSize: '12px' } }, q.categoria),
            h('td', { class: 'tc', style: { fontWeight: 800, color: 'var(--ad-in)' } }, num(q.total)), h('td', { class: 'tc' }, num(q.usuarios)),
            h('td', { class: 'tc', style: { fontWeight: q.taxa !== null && q.taxa < 0.5 ? 800 : 600, color: q.taxa === null ? 'var(--ad-mu)' : q.taxa < 0.5 ? 'var(--ad-er)' : 'var(--ad-ok)' } }, pct(q.taxa)),
            h('td', { class: 'tc' }, botaoVer({ texto: q.pergunta, exata: true }, 'Ver só esta pergunta no tempo'))));
        limpar(R.paineis.recorrentes).append(cartao('Top perguntas mais repetidas (constância)', 'repeat', [
            h('div', { class: 'dica' }, 'Frases iguais (sem diferenciar maiúsculas, acentos e pontuação) que indicam gargalos operacionais frequentes. Mostra as 50 que mais se repetem.'),
            tabelaDe([['Pergunta / dúvida'], ['Assunto'], ['Vezes', 'tc'], ['Usuários diferentes', 'tc'], ['Taxa de sucesso da IA', 'tc'], ['Evolução', 'tc']], linhas)]));
    }

    /* ───────────── aba ───────────── */
    ADM.registrarAba({
        id: 'analise', titulo: 'Análise', icone: 'chart', ordem: 65,
        descricao: 'O que os usuários perguntam, quando e quem — lendo todos os logs direto do banco (sem importar planilha): o que alimentar na IA primeiro, a evolução no tempo (com filtros), o uso por pessoa e as perguntas que mais se repetem.',
        montar(ctx) {
            try { const g = lsGet(CHAVE_SUB, 'foco'); if (SUBS.some(s => s[0] === g)) E.sub = g; } catch (e) { /* ok */ }
            R.origem = h('select', { 'aria-label': 'Origem das consultas', title: 'Origem das consultas (vale para todas as visões)', hidden: true });
            R.origem.addEventListener('change', () => { E.fonte = R.origem.value; recalcularBase(); renderTudo(); });
            R.chip = h('span', { class: 'chip', style: { cursor: 'default' } }, '');
            R.btnAtualizar = h('button', { class: 'btn icone', type: 'button', title: 'Recarregar os logs do banco', 'aria-label': 'Atualizar', onclick: () => carregar(true) }, I('refresh', 17));
            ctx.barra.append(R.origem, R.chip, R.btnAtualizar);

            R.aviso = h('div'); R.kpis = h('div', { class: 'kpis' });
            R.subBotoes = SUBS.map(([id, nome]) => h('button', { type: 'button', dataset: { sub: id }, 'aria-pressed': String(id === E.sub), onclick: () => mudarSub(id) }, nome));
            SUBS.forEach(([id]) => { R.paineis[id] = h('div', { class: 'an-painel', hidden: id !== E.sub }); });
            montarTemporal();
            R.corpo = h('div', { class: 'an-corpo', hidden: true }, R.kpis, h('div', null, h('div', { class: 'abas-mini', role: 'group', 'aria-label': 'Visões da análise' }, R.subBotoes)), SUBS.map(([id]) => R.paineis[id]));
            ctx.corpo.append(R.aviso, R.corpo);
        },
        abrir() {
            if (E.carregando) return;
            if (!E.jaCarregou) carregar();
            else if (Date.now() - E.carregadoEm > VALIDADE_MS) carregar(true);   // dados velhos: atualiza em segundo plano, sem apagar a tela
            else renderChip();
        },
    });
})();
