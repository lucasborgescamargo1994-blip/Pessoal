/* admin/js/nucleo.js — Base da Área Administrativa: montagem de telas sem innerHTML, janelas, avisos, acesso ao banco e sistema de abas.
   Tudo que vem do banco (perguntas, respostas, logs...) entra na tela como TEXTO (textContent), nunca como HTML — é o que impede
   que um texto malicioso vire código dentro de uma sessão administrativa. */
'use strict';

Object.assign(IC, {
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    chevronR: '<path d="m9 18 6-6-6-6"/>',
    chevronL: '<path d="m15 18-6-6 6-6"/>',
    xcircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
});

/* ───────────── montar elementos ───────────── */
const _PROPS_DOM = new Set(['value', 'checked', 'disabled', 'selected', 'readOnly', 'indeterminate', 'textContent', 'innerHTML', 'hidden', 'htmlFor']);
function _anexar(pai, filhos) {
    for (const f of filhos) {
        if (f === null || f === undefined || f === false) continue;
        if (Array.isArray(f)) _anexar(pai, f);
        else if (f instanceof Node) pai.appendChild(f);
        else pai.appendChild(document.createTextNode(String(f)));
    }
}
// h('div', {class:'x', onclick: fn, dataset:{a:1}}, 'texto', outroElemento, [lista...]) — textos viram texto puro.
function h(tag, attrs, ...filhos) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k === 'html') n.innerHTML = v;   // só para HTML fixo escrito aqui no código — nunca para dados do banco
        else if (k.length > 2 && k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (_PROPS_DOM.has(k)) n[k] = v;
        else n.setAttribute(k, v === true ? '' : String(v));
    }
    _anexar(n, filhos);
    return n;
}
function I(nome, tam = 16, sw = 2) { const t = document.createElement('template'); t.innerHTML = icon(nome, tam, sw); return t.content.firstChild; }
function limpar(no) { while (no.firstChild) no.removeChild(no.firstChild); return no; }
const esperar = ms => new Promise(r => setTimeout(r, ms));

/* ───────────── objeto principal ───────────── */
const ADM = {
    cfg: window.BSOFT_CONFIG || {},
    kv: criarKV('bsoft_admin'),   // IndexedDB só do painel (alças dos arquivos de configuração) — separado do cache do sistema
    sb: null,           // cliente do Supabase (criado em boot.js)
    abas: [],           // abas registradas
    abaAtual: null,
    ui: {}, fmt: {}, db: {},
    _ouvintes: {},
    on(nome, fn) { (this._ouvintes[nome] = this._ouvintes[nome] || []).push(fn); },
    emit(nome, dados) { (this._ouvintes[nome] || []).forEach(fn => { try { fn(dados); } catch (e) { console.error('[admin]', nome, e); } }); },
};

/* ───────────── formatação ───────────── */
ADM.fmt = {
    dataHora(v) {
        if (!v) return '—';
        const d = new Date(v); if (isNaN(d)) return String(v);
        return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    // "timestamp" dos logs é horário de Brasília gravado com sufixo Z: lê os campos UTC direto (sem converter fuso de novo)
    dataHoraLog(l) {
        const p = n => String(n).padStart(2, '0');
        if (l && l.timestamp) { const d = new Date(l.timestamp); if (!isNaN(d)) return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; }
        return ADM.fmt.dataHora(l && l.created_at);
    },
    relativo(v) {
        const d = new Date(v); if (isNaN(d)) return '';
        const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
        if (s < 60) return 'agora';
        if (s < 3600) return Math.floor(s / 60) + ' min';
        if (s < 86400) return Math.floor(s / 3600) + ' h';
        if (s < 86400 * 30) return Math.floor(s / 86400) + ' d';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    },
    trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; },
    num(n) { return Number(n || 0).toLocaleString('pt-BR'); },
    pct(x) { return Math.round((x || 0) * 100) + '%'; },
    semMd(s) { return String(s || '').replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim(); },
    bytes(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; },
};

/* ───────────── janelas, avisos e utilidades de tela ───────────── */
ADM.ui.toast = function (texto, tipo, ms) {
    tipo = tipo || 'in';
    const raiz = document.getElementById('toasts');
    const ic = { ok: 'check', er: 'alert', wa: 'alert', in: 'info' }[tipo] || 'info';
    const cor = { ok: 'var(--ad-ok)', er: 'var(--ad-er)', wa: 'var(--ad-wa)', in: 'var(--ad-in)' }[tipo];
    const t = h('div', { class: 'toast ' + tipo, role: tipo === 'er' ? 'alert' : 'status' },
        h('span', { style: { color: cor, marginTop: '1px' } }, I(ic, 17)),
        h('div', { class: 'corpo' }, texto),
        h('button', { class: 'btn fantasma peq icone', 'aria-label': 'Fechar', onclick: () => fechar() }, I('x', 14)));
    let fechado = false;
    function fechar() { if (fechado) return; fechado = true; t.classList.add('saindo'); setTimeout(() => t.remove(), 220); }
    raiz.appendChild(t);
    while (raiz.children.length > 5) raiz.firstChild.remove();
    setTimeout(fechar, ms || (tipo === 'er' ? 9000 : tipo === 'wa' ? 7000 : 4200));
    return { fechar };
};

const _pilhaModais = [];
// ADM.ui.modal({ titulo, corpo, botoes:[{rotulo, tipo, acao(e, api) → false = não fecha, fechar:false}], largura, fecharFora, aoFechar })
ADM.ui.modal = function (op) {
    const root = document.getElementById('modalRoot');
    const antes = document.activeElement;
    let fechado = false;
    const api = { fechar, el: null, corpo: null };
    function fechar(valor) {
        if (fechado) return; fechado = true;
        const i = _pilhaModais.indexOf(api); if (i >= 0) _pilhaModais.splice(i, 1);
        fundo.remove();
        if (antes && antes.focus && document.contains(antes)) { try { antes.focus(); } catch (e) { /* ok */ } }
        if (op.aoFechar) op.aoFechar(valor);
    }
    const corpo = h('div', { class: 'modal-corpo' }, op.corpo);
    const btns = (op.botoes || []).map(b => {
        const bt = h('button', { class: 'btn ' + (b.tipo || ''), type: 'button' }, b.rotulo);
        bt.addEventListener('click', async () => {
            if (!b.acao) { if (b.fechar !== false) fechar(b.valor); return; }
            bt.disabled = true;
            try { const r = await b.acao(bt, api); if (r !== false && b.fechar !== false) fechar(b.valor); }
            catch (e) { console.error(e); ADM.ui.toast(ADM.db.erroTexto(e), 'er'); }
            finally { bt.disabled = false; }
        });
        return bt;
    });
    const caixa = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': op.titulo || 'Janela', style: { maxWidth: (op.largura || 560) + 'px' } },
        h('div', { class: 'modal-topo' }, h('h3', null, op.titulo || ''), h('button', { class: 'btn fantasma icone peq', type: 'button', 'aria-label': 'Fechar', onclick: () => fechar() }, I('x', 16))),
        corpo,
        btns.length ? h('div', { class: 'modal-rodape' }, btns) : null);
    const fundo = h('div', { class: 'modal-fundo' }, caixa);
    fundo.addEventListener('mousedown', e => { if (e.target === fundo && op.fecharFora !== false) fechar(); });
    root.appendChild(fundo);
    api.el = caixa; api.corpo = corpo; api.botoes = btns;
    _pilhaModais.push(api);
    const foco = caixa.querySelector('[autofocus], input:not([type=hidden]), textarea, select') || caixa.querySelector('.modal-rodape .btn.primario') || caixa.querySelector('button');
    setTimeout(() => foco && foco.focus && foco.focus(), 30);
    return api;
};
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _pilhaModais.length) { _pilhaModais[_pilhaModais.length - 1].fechar(); e.stopPropagation(); }
});

ADM.ui.confirmar = function (msg, op) {
    op = op || {};
    return new Promise(res => {
        let resp = false;
        ADM.ui.modal({
            titulo: op.titulo || 'Confirmar', largura: op.largura || 460,
            corpo: [h('p', { style: { whiteSpace: 'pre-line' } }, msg), op.detalhe ? h('div', { class: 'aviso ' + (op.perigo ? 'wa' : '') }, I('info', 16), h('div', { class: 'corpo' }, op.detalhe)) : null],
            botoes: [
                { rotulo: op.rotuloCancelar || 'Cancelar', tipo: 'fantasma' },
                { rotulo: op.rotuloOk || 'Confirmar', tipo: op.perigo ? 'perigo cheio' : 'primario', acao: () => { resp = true; } },
            ],
            aoFechar: () => res(resp),
        });
    });
};

// pede um texto; devolve a string (ou null se cancelar)
ADM.ui.entrada = function (op) {
    return new Promise(res => {
        let valor = null;
        const campo = op.multilinha ? h('textarea', { rows: 4, placeholder: op.dica || '' }, '') : h('input', { type: 'text', placeholder: op.dica || '' });
        campo.value = op.valor || '';
        campo.addEventListener('keydown', e => { if (e.key === 'Enter' && !op.multilinha) { e.preventDefault(); btnOk.click(); } });
        const api = ADM.ui.modal({
            titulo: op.titulo || 'Informe', largura: 480,
            corpo: [op.mensagem ? h('p', null, op.mensagem) : null, h('label', { class: 'campo' }, op.rotulo ? h('span', { class: 'rot' }, op.rotulo) : null, campo)],
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, { rotulo: op.rotuloOk || 'OK', tipo: 'primario', acao: () => { valor = campo.value; if (op.obrigatorio && !valor.trim()) { ADM.ui.toast('Preencha o campo.', 'wa'); return false; } } }],
            aoFechar: () => res(valor),
        });
        const btnOk = api.botoes[1];
        setTimeout(() => campo.focus(), 40);
    });
};

// roda fn() enquanto o botão mostra o "carregando"; devolve o resultado de fn
ADM.ui.ocupado = async function (btn, fn) {
    if (btn) { btn.disabled = true; btn.classList.add('carregando'); }
    try { return await fn(); }
    finally { if (btn) { btn.disabled = false; btn.classList.remove('carregando'); } }
};

ADM.ui.copiar = async function (texto, aviso) {
    try { await navigator.clipboard.writeText(texto); }
    catch (e) {
        const t = h('textarea', { style: { position: 'fixed', left: '-9999px' } }); t.value = texto; document.body.appendChild(t); t.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ok */ }
        t.remove();
        if (!ok) { ADM.ui.toast('Não consegui copiar automaticamente — selecione e copie manualmente.', 'wa'); return false; }
    }
    ADM.ui.toast(aviso || 'Copiado para a área de transferência.', 'ok', 2200);
    return true;
};
ADM.ui.baixar = function (nome, texto, mime) {
    const blob = new Blob([texto], { type: mime || 'text/plain;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: nome });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
// Chave liga/desliga: devolve { el, input }
ADM.ui.chave = function (marcado, aoMudar, rotuloAria) {
    const input = h('input', { type: 'checkbox', checked: !!marcado, 'aria-label': rotuloAria || 'Ativar/desativar' });
    if (aoMudar) input.addEventListener('change', () => aoMudar(input.checked, input));
    return { el: h('label', { class: 'chave' }, input, h('span', { class: 'trilho' })), input };
};
ADM.ui.vazio = function (icone, titulo, texto) {
    return h('div', { class: 'vazio' }, h('span', { class: 'grande' }, icone || '📭'), h('b', null, titulo || 'Nada por aqui'), texto ? h('p', { style: { marginTop: '4px' } }, texto) : null);
};
ADM.ui.aviso = function (tipo, ...filhos) {
    const ic = { wa: 'alert', er: 'alert', ok: 'check' }[tipo] || 'info';
    return h('div', { class: 'aviso ' + (tipo === 'in' ? '' : tipo) }, I(ic, 17), h('div', { class: 'corpo' }, filhos));
};
// ajuda de SQL: copia o arquivo .sql do repositório (via fetch quando o navegador permite)
ADM.ui.sqlAjuda = function (arquivo) {
    const btn = h('button', { class: 'btn peq', type: 'button' }, I('copy', 14), 'Copiar o SQL');
    btn.addEventListener('click', async () => {
        try { const r = await fetch('../sql/' + arquivo, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); await ADM.ui.copiar(await r.text(), 'SQL copiado — cole no SQL Editor do Supabase e clique em Run.'); }
        catch (e) { ADM.ui.toast('O navegador não deixou ler o arquivo daqui (acontece ao abrir direto do disco). Abra sql/' + arquivo + ' no seu editor, copie tudo e cole no SQL Editor do Supabase.', 'wa', 11000); }
    });
    return btn;
};

/* ───────────── banco de dados ───────────── */
ADM.db = {
    erroTexto(e) {
        const m = (e && (e.message || e.error_description || e.details)) || String(e || 'erro desconhecido');
        if (ADM.db.ehRLS(e)) return 'O banco recusou a gravação (sem permissão). Se você ativou as regras de segurança (SQL 03), entre no modo "supabase" para ter permissão de administrador — veja README → Segurança. Detalhe: ' + m;
        if (ADM.db.ehTabelaAusente(e)) return 'Tabela/visão ainda não existe no Supabase — rode o SQL de instalação (sql/02_respostas_rapidas_e_revisao.sql). Detalhe: ' + m;
        if (ADM.db.ehColunaAusente(e)) return 'Falta uma coluna no banco — rode o SQL sql/02_respostas_rapidas_e_revisao.sql. Detalhe: ' + m;
        if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Sem conexão com o Supabase. Confira a internet e tente de novo.';
        return m;
    },
    ehRLS(e) { return !!e && (e.code === '42501' || /row-level security|permission denied|violates row/i.test(e.message || '')); },
    ehTabelaAusente(e) { return !!e && (e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|relation .* does not exist/i.test(e.message || '')); },
    ehColunaAusente(e) { return !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(e.message || '')); },
    // junta todas as páginas (o Supabase devolve no máx. 1000 linhas por consulta). montar(de, ate) devolve a consulta.
    async todas(montar, op) {
        const lote = (op && op.lote) || 1000, max = (op && op.max) || 20000; let acc = [];
        for (let de = 0; de < max; de += lote) {
            const { data, error } = await montar(de, de + lote - 1);
            if (error) throw error;
            acc = acc.concat(data || []);
            if (op && op.progresso) op.progresso(acc.length);
            if (!data || data.length < lote) break;
        }
        return acc;
    },
    // tira do texto de busca o que tem significado especial nos filtros do PostgREST/LIKE
    termoSeguro(t) { return String(t || '').replace(/[%_\\,()*"'`;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); },
    async contar(tabela, aplicar, coluna) {
        let q = ADM.sb.from(tabela).select(coluna || 'id', { count: 'exact', head: true });
        if (aplicar) q = aplicar(q);
        const { count, error } = await q;
        if (error) throw error;
        return count || 0;
    },
    // update/delete que a segurança (RLS) barra NÃO dão erro: devolvem 0 linhas. Esta checagem transforma isso em erro de verdade.
    exigirAfetadas(res, esperadas) {
        if (res.error) throw res.error;
        const n = Array.isArray(res.data) ? res.data.length : 0;
        if (n === 0) { const e = new Error('Nenhuma linha foi alterada — o banco não permitiu (regras de segurança/RLS) ou o registro já não existe.'); e.code = '42501'; throw e; }
        if (esperadas && n < esperadas) console.warn('[admin] esperava alterar', esperadas, 'linha(s), alterou', n);
        return res.data;
    },
};

/* ───────────── abas ───────────── */
ADM.registrarAba = function (def) { ADM.abas.push(Object.assign({ ordem: 50, montada: false }, def)); };
// a pessoa que entrou pode usar esta aba? (administrador principal: todas; usuário cadastrado: só as que o administrador liberou)
ADM.podeAba = id => !ADM.auth || ADM.auth.podeAba(id);

ADM.montarAbas = function () {
    // ADM.abasTodas = tudo o que foi registrado; ADM.abas = só o que ESTA pessoa pode usar (o resto nem aparece nem abre)
    ADM.abasTodas = (ADM.abasTodas || ADM.abas.slice()).sort((a, b) => a.ordem - b.ordem);
    ADM.abas = ADM.abasTodas.filter(a => ADM.podeAba(a.id));
    const nav = limpar(document.getElementById('abas')), painel = limpar(document.getElementById('painel'));
    ADM.abas.forEach((aba, i) => {
        const btn = h('button', { class: 'aba', role: 'tab', id: 'aba-' + aba.id, 'aria-selected': 'false', 'aria-controls': 'painel-' + aba.id, title: aba.titulo + '  (Alt+' + (i + 1) + ')', dataset: { aba: aba.id } },
            I(aba.icone || 'file', 17), h('span', { class: 'rotulo' }, aba.titulo), h('span', { class: 'nota', hidden: true }));
        btn.addEventListener('click', () => ADM.irParaAba(aba.id));
        nav.appendChild(btn);
        aba.btn = btn;
        const barra = h('div', { class: 'barra' });
        const corpo = h('div', { class: 'aba-corpo' });
        aba.raiz = h('section', { class: 'aba-painel', id: 'painel-' + aba.id, role: 'tabpanel', 'aria-labelledby': 'aba-' + aba.id, hidden: true },
            h('div', { class: 'cabeca' }, h('div', null, h('h2', null, I(aba.icone || 'file', 21), aba.titulo), aba.descricao ? h('p', { class: 'desc' }, aba.descricao) : null), barra), corpo);
        aba.ctx = { raiz: aba.raiz, barra, corpo };
        painel.appendChild(aba.raiz);
    });
    nav.addEventListener('keydown', e => {   // setas ← → entre as abas
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const lista = ADM.abas, i = lista.findIndex(a => a === ADM.abaAtual), n = (i + (e.key === 'ArrowRight' ? 1 : -1) + lista.length) % lista.length;
        ADM.irParaAba(lista[n].id); lista[n].btn.focus();
    });
};

ADM.irParaAba = function (id, op) {
    const proibida = (ADM.abasTodas || []).find(a => a.id === id && !ADM.abas.includes(a));
    if (proibida) { ADM.ui.toast(`Seu usuário não tem acesso à aba “${proibida.titulo}”. Fale com o administrador do painel.`, 'wa'); return; }
    const aba = ADM.abas.find(a => a.id === id) || ADM.abas[0];
    if (!aba) return;
    if (ADM.abaAtual === aba) { if (aba.reabrir) aba.reabrir(); return; }
    const anterior = ADM.abaAtual;
    if (anterior) { anterior.raiz.hidden = true; anterior.btn.setAttribute('aria-selected', 'false'); if (anterior.fechar) { try { anterior.fechar(); } catch (e) { console.error(e); } } }
    ADM.abaAtual = aba;
    aba.raiz.hidden = false; aba.btn.setAttribute('aria-selected', 'true');
    if (!aba.montada) {
        aba.montada = true;
        try { aba.montar(aba.ctx); } catch (e) { console.error('[admin] erro ao montar a aba ' + aba.id, e); aba.ctx.corpo.appendChild(ADM.ui.aviso('er', 'Erro ao montar esta aba: ' + e.message)); }
    }
    if (aba.abrir) { try { aba.abrir(op || {}); } catch (e) { console.error('[admin] erro ao abrir a aba ' + aba.id, e); } }
    try { sessionStorage.setItem('bsoft_admin_aba', aba.id); } catch (e) { /* ok */ }
    if (location.hash !== '#/' + aba.id) history.replaceState(null, '', '#/' + aba.id);
    document.title = aba.titulo + ' · Administração - Bsoft TMS IA';
};

ADM.badgeAba = function (id, n, tipo) {
    const aba = ADM.abas.find(a => a.id === id); if (!aba || !aba.btn) return;
    const el = aba.btn.querySelector('.nota');
    el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n || ''); el.className = 'nota' + (tipo === 'er' ? ' er' : '');
};
ADM.temAlteracoes = () => ADM.abas.some(a => a.montada && a.sujo && a.sujo());
// bolinha "alterações não salvas" no botão da aba
ADM.marcarSujo = function (id, sim) {
    const aba = ADM.abas.find(a => a.id === id); if (!aba || !aba.btn) return;
    const d = aba.btn.querySelector('.sujo');
    if (sim && !d) aba.btn.appendChild(h('span', { class: 'sujo', title: 'Alterações não salvas' }));
    if (!sim && d) d.remove();
};

ADM.chipBanco = function (estado, texto) {
    const c = document.getElementById('chipBanco'); if (!c) return;
    c.className = 'chip ' + (estado || '');
    document.getElementById('chipBancoTxt').textContent = texto;
};
ADM.testarBanco = async function () {
    const t0 = performance.now();
    try {
        const { error } = await ADM.sb.from('BancoDados').select('id').limit(1);
        if (error) throw error;
        ADM.chipBanco('ok', 'banco ✓ ' + Math.round(performance.now() - t0) + ' ms');
        return true;
    } catch (e) { ADM.chipBanco('er', 'banco ✗'); console.warn('[admin] banco:', e); return false; }
};

// configuração de IA "em uso" pela tela: o rascunho da aba IA / MCP (se já foi aberta) ou a publicada no arquivo
ADM.configAtiva = () => (ADM.mcp && ADM.mcp.rascunho) ? ADM.mcp.rascunho : MCP_CFG;

// categorias já usadas nas respostas rápidas (para sugestões em campos de texto)
ADM.categoriasRR = () => Array.from(new Set(((ADM.rr && ADM.rr.itens) || []).map(i => i.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
