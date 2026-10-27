/* admin/js/componentes.js — Peças usadas por mais de uma aba: lista de respostas rápidas (cache da sessão),
   editor de resposta com visualização e a janela de edição de uma resposta rápida. */
'use strict';

/* ───────────── respostas rápidas (dados compartilhados entre as abas) ───────────── */
function _variantesDe(v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
    return Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean) : [];
}
ADM.rr = {
    itens: [], uso: new Map(), carregado: false, erro: null, _p: null,
    carregar(forcar) {
        if (this._p && !forcar) return this._p;
        const self = this;
        this._p = (async () => {
            try {
                const linhas = await ADM.db.todas((de, ate) => ADM.sb.from('respostas_rapidas')
                    .select('id, pergunta, variantes, resposta, categoria, ativo, origem_log_id, aprovado_por, criado_em, atualizado_em')
                    .order('id', { ascending: true }).range(de, ate));
                self.itens = linhas.map(r => Object.assign({}, r, { variantes: _variantesDe(r.variantes) }));
                self.erro = null;
            } catch (e) { self.itens = []; self.erro = e; }
            self.carregado = true;
            ADM.emit('rr:mudou');
            return self.itens;
        })();
        return this._p;
    },
    invalidar() { this._p = null; },
    // quantas vezes cada resposta rápida foi usada (view respostas_rapidas_uso; se ainda não existir, fica vazio)
    async carregarUso() {
        try {
            const linhas = await ADM.db.todas((de, ate) => ADM.sb.from('respostas_rapidas_uso').select('*').range(de, ate));
            this.uso = new Map(linhas.map(u => [Number(u.id), u]));
        } catch (e) { this.uso = new Map(); }
        return this.uso;
    },
    obter(id) { return this.itens.find(i => Number(i.id) === Number(id)) || null; },
};

/* ───────────── arquivo local do projeto (File System Access: Edge/Chrome) ─────────────
   Guarda a "alça" do arquivo (config/mcp-config.js, config/admin-config.js) no IndexedDB: depois da 1ª escolha, salvar é um clique.
   Em navegadores sem essa função (Firefox/Safari), o painel cai para "Copiar" / "Baixar". */
ADM.arquivoLocal = function (chaveKV, nomeEsperado, descricao) {
    const suportado = typeof window.showOpenFilePicker === 'function';
    let alca = null;
    async function obter(pedir) {
        if (alca) return alca;
        try { const salva = await ADM.kv.get(chaveKV); if (salva && salva.kind === 'file') { alca = salva; return salva; } } catch (e) { /* ok */ }
        if (!pedir || !suportado) return null;
        const [hd] = await window.showOpenFilePicker({ id: ('bsoft-' + chaveKV).slice(0, 32), multiple: false, types: [{ description: descricao || nomeEsperado, accept: { 'text/javascript': ['.js'] } }] });
        if (hd.name !== nomeEsperado && !(await ADM.ui.confirmar(`O arquivo escolhido se chama “${hd.name}”, não “${nomeEsperado}”. Usar mesmo assim?`, { titulo: 'Conferir arquivo', rotuloOk: 'Usar mesmo assim' }))) return null;
        alca = hd; await ADM.kv.set(chaveKV, hd);
        return hd;
    }
    async function gravar(texto) {   // true = gravou; false = sem arquivo vinculado/cancelou
        const hd = await obter(true); if (!hd) return false;
        let perm = await hd.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') perm = await hd.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') throw new Error('Sem permissão para gravar no arquivo.');
        const w = await hd.createWritable(); await w.write(texto); await w.close();
        return true;
    }
    return { suportado, obter, gravar, nome: () => alca ? alca.name : '', trocar: async () => { alca = null; return obter(true); } };
};

/* ───────────── GitHub: link para editar um arquivo do projeto direto no site (sem precisar do Git) ───────────── */
ADM.githubRepo = function () {
    const c = window.BSOFT_ADMIN || {};
    if (c.repositorio) return { repo: c.repositorio, ramo: c.ramo || 'main', deduzido: false };
    if (BSOFT_ENV.githubPages) {   // endereço do tipo usuario.github.io/repositorio/admin/
        const dono = location.hostname.split('.')[0], seg = location.pathname.split('/').filter(Boolean)[0];
        return { repo: dono + '/' + (seg && seg !== 'admin' ? seg : dono + '.github.io'), ramo: c.ramo || 'main', deduzido: true };
    }
    return null;
};
ADM.urlEditarGithub = function (caminho) { const g = ADM.githubRepo(); return g ? `https://github.com/${g.repo}/edit/${g.ramo}/${caminho}` : null; };

/* ───────────── vetor (embedding) da Jina — usa a chave da configuração em edição ───────────── */
ADM.jinaVetor = async function (texto, chaveOpcional) {
    const chave = chaveOpcional || mcpJuntar(ADM.configAtiva().embeddings.chave);
    if (!chave) throw new Error('Sem chave da Jina na configuração (aba IA / MCP → Embeddings).');
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
    try {
        const r = await fetch('https://api.jina.ai/v1/embeddings', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + chave },
            body: JSON.stringify({ model: 'jina-embeddings-v3', input: [String(texto)] }), signal: ac.signal,
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.data || !d.data[0]) throw new Error((d && (d.detail || d.message)) || 'HTTP ' + r.status);
        return d.data[0].embedding;
    } catch (e) { throw new Error(e.name === 'AbortError' ? 'A Jina demorou demais para responder.' : e.message); }
    finally { clearTimeout(t); }
};

/* ───────────── editor de resposta (Markdown + visualização) ───────────── */
// opc: { valor, aoMudar, rotulo, rotuloPrevia, placeholder } — os três últimos só trocam os textos da tela (padrão: os de "resposta")
ADM.editorResposta = function (opc) {
    opc = opc || {};
    const ta = h('textarea', { class: 'mono', spellcheck: 'true', placeholder: opc.placeholder || 'Escreva a resposta em Markdown: **negrito**, listas com "-", links [texto](https://...)' });
    ta.value = opc.valor || '';
    const prev = h('div', { class: 'md-prev', 'aria-live': 'polite' });
    // renderMd escapa <, > e & antes de aplicar a formatação — é o único lugar em que texto vira HTML
    const atualizar = () => { prev.innerHTML = ta.value.trim() ? renderMd(ta.value) : '<span class="mu">A visualização da resposta aparece aqui.</span>'; };
    const atualizarLento = debounce(atualizar, 140);
    ta.addEventListener('input', () => { atualizarLento(); if (opc.aoMudar) opc.aoMudar(ta.value); });
    atualizar();
    return {
        el: h('div', { class: 'editor-resp' },
            h('div', { class: 'campo' }, h('span', { class: 'rot' }, opc.rotulo || 'Texto da resposta'), ta),
            h('div', { class: 'campo' }, h('span', { class: 'rot' }, opc.rotuloPrevia || 'Como o usuário vai ver'), prev)),
        obter: () => ta.value,
        definir: v => { ta.value = v || ''; atualizar(); },
        textarea: ta,
    };
};

/* ───────────── janela: criar / editar uma resposta rápida ───────────── */
ADM.editarRespostaRapida = function (item, aoSalvar) {
    const novo = !item || !item.id;
    item = item || {};
    const iPerg = h('input', { type: 'text', maxlength: 400, placeholder: 'Ex.: Como emitir um CT-e de complemento?' });
    iPerg.value = item.pergunta || '';
    const iVar = h('textarea', { rows: 4, placeholder: 'Uma por linha. Outras formas de perguntar a mesma coisa.' });
    iVar.value = (item.variantes || []).join('\n');
    const dl = h('datalist', { id: 'dlCategoriasRR' }, ADM.categoriasRR().map(c => h('option', { value: c })));
    const iCat = h('input', { type: 'text', list: 'dlCategoriasRR', maxlength: 60, placeholder: 'Ex.: CT-e' });
    iCat.value = item.categoria || '';
    const chave = ADM.ui.chave(item.ativo !== false, null, 'Resposta ativa');
    const ed = ADM.editorResposta({ valor: item.resposta || '' });
    const alerta = h('div');
    const checarDuplicada = debounce(() => {
        limpar(alerta);
        const t = iPerg.value.trim(); if (t.length < 4) return;
        const outras = ADM.rr.itens.filter(i => !item.id || Number(i.id) !== Number(item.id));
        const top = RRMatch.ranking(t, outras, 0.8)[0];
        if (top) alerta.appendChild(ADM.ui.aviso('wa', 'Já existe uma resposta rápida muito parecida: ', h('b', null, '#' + top.item.id + ' — ' + ADM.fmt.trunc(top.item.pergunta, 90)), ' (' + ADM.fmt.pct(top.lex) + ' de semelhança). Considere editar aquela em vez de criar outra.'));
    }, 300);
    iPerg.addEventListener('input', checarDuplicada);

    const corpo = [
        alerta,
        h('div', { class: 'g2' },
            h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Pergunta principal'), iPerg),
            h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Categoria (opcional)'), iCat, dl)),
        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Variantes da pergunta'), iVar,
            h('span', { class: 'dica' }, 'Quanto mais jeitos de perguntar você cadastrar, mais vezes a resposta rápida será usada.')),
        ed.el,
        h('label', { class: 'linha' }, chave.el, h('span', null, h('b', null, 'Resposta ativa'), h('span', { class: 'mu' }, ' — desligada, o sistema para de usá-la (sem apagar).'))),
    ];

    const botoes = [{ rotulo: 'Cancelar', tipo: 'fantasma' }];
    if (!novo) botoes.push({
        rotulo: 'Excluir', tipo: 'perigo', fechar: false,
        acao: async (btn, api) => {
            if (!(await ADM.ui.confirmar(`Excluir a resposta rápida #${item.id}?\n\n"${ADM.fmt.trunc(item.pergunta, 100)}"`, { titulo: 'Excluir resposta rápida', rotuloOk: 'Excluir', perigo: true, detalhe: 'Os logs antigos continuam existindo; só a resposta pronta deixa de existir. Para apenas pausar, use a chave "Resposta ativa".' }))) return false;
            const r = await ADM.sb.from('respostas_rapidas').delete().eq('id', item.id).select('id');
            ADM.db.exigirAfetadas(r);
            ADM.rr.invalidar(); await ADM.rr.carregar(true);
            ADM.ui.toast('Resposta rápida excluída.', 'ok');
            api.fechar(); if (aoSalvar) aoSalvar(null);
        },
    });
    botoes.push({
        rotulo: novo ? 'Criar resposta rápida' : 'Salvar alterações', tipo: 'primario', fechar: false,
        acao: async (btn, api) => {
            const pergunta = iPerg.value.trim(), resposta = ed.obter().trim();
            if (pergunta.length < 3) { ADM.ui.toast('Escreva a pergunta principal.', 'wa'); iPerg.focus(); return false; }
            if (resposta.length < 5) { ADM.ui.toast('A resposta está vazia.', 'wa'); ed.textarea.focus(); return false; }
            const normP = RRMatch.preparar(pergunta).norm;
            const variantes = Array.from(new Set(iVar.value.split('\n').map(s => s.trim()).filter(s => s && RRMatch.preparar(s).norm !== normP)));
            const payload = { pergunta, variantes, resposta, categoria: iCat.value.trim() || null, ativo: chave.input.checked };
            let r;
            if (novo) { payload.aprovado_por = ADM.auth.usuario(); r = await ADM.sb.from('respostas_rapidas').insert(payload).select('id'); }
            else r = await ADM.sb.from('respostas_rapidas').update(payload).eq('id', item.id).select('id');
            ADM.db.exigirAfetadas(r);
            ADM.rr.invalidar(); await ADM.rr.carregar(true);
            ADM.ui.toast(novo ? 'Resposta rápida criada.' : 'Resposta rápida atualizada.', 'ok');
            api.fechar(); if (aoSalvar) aoSalvar(r.data[0]);
        },
    });
    return ADM.ui.modal({ titulo: novo ? 'Nova resposta rápida' : `Resposta rápida #${item.id}`, corpo, botoes, largura: 1040, fecharFora: false });
};

/* ───────────── janela: corrigir um artigo da base de conhecimento (BancoDados) ─────────────
   Usada pela aba Revisão (clicar num dado do banco que a IA usou). Lê o artigo NA HORA, direto da base — não um retrato do momento da
   resposta — e grava as correções no mesmo registro. Como na aba Banco de dados, mexer no texto descarta o vetor de busca
   (embedding = null): cada aparelho o recalcula sozinho na próxima abertura do sistema.
   opcoes: { contexto: { pergunta, resposta } (só para conferir enquanto edita), categorias: [...] (sugestões), aoSalvar(registro) }
   Devolve a janela, ou null se o artigo não pôde ser aberto (já avisou na tela). */
ADM.editarArtigoBanco = async function (id, opcoes) {
    opcoes = opcoes || {};
    // chave do artigo como número: vem de um JSON gravado por qualquer navegador — nunca vai direto para a consulta sem checar
    const chaveId = Number(id);
    if (!Number.isFinite(chaveId)) { ADM.ui.toast('Este item não tem um número de artigo válido.', 'wa'); return null; }
    let linha, semColunaCaminho = false;
    try {
        let r = await ADM.sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria, caminho_menu').eq('id', chaveId).maybeSingle();
        if (r.error && ADM.db.ehColunaAusente(r.error)) {   // SQL 05 ainda não rodado: o artigo abre igual, só sem o campo do caminho no menu
            semColunaCaminho = true;
            r = await ADM.sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria').eq('id', chaveId).maybeSingle();
        }
        if (r.error) throw r.error;
        linha = r.data;
    } catch (e) { ADM.ui.toast('Não consegui abrir o artigo #' + chaveId + ': ' + ADM.db.erroTexto(e), 'er', 9000); return null; }
    if (!linha) { ADM.ui.toast('O artigo #' + chaveId + ' não existe mais no banco de dados (foi excluído?).', 'wa', 9000); return null; }

    const canon = v => v == null ? null : (String(v).replace(/\r\n?/g, '\n').trim() || null);   // vazio, nulo e espaço sobrando são "a mesma coisa"; a caixa de texto troca \r\n por \n
    const iTit = h('input', { type: 'text', maxlength: 400 }); iTit.value = linha.titulo || '';
    const dl = h('datalist', { id: 'dlCatArtigoBD' }, (opcoes.categorias || []).map(c => h('option', { value: c })));
    const iCat = h('input', { type: 'text', list: 'dlCatArtigoBD', maxlength: 60, placeholder: 'Ex.: CT-e' }); iCat.value = linha.categoria || '';
    // Caminho no menu (coluna caminho_menu — sql/05_bancodados_caminho_menu.sql): o que for escrito aqui é gravado direto no banco e a IA o escreve junto da resposta
    if (!semColunaCaminho) linha.caminho_menu = ADM.normalizarCaminhoMenu(linha.caminho_menu);
    const iCm = h('input', { type: 'text', maxlength: 300, placeholder: semColunaCaminho ? 'Rode o sql/05_bancodados_caminho_menu.sql no Supabase para habilitar' : 'Ex.: Transporte > Configurações > Informações de cobrança padrão' });
    iCm.value = linha.caminho_menu || ''; iCm.disabled = semColunaCaminho;
    if (!semColunaCaminho) ADM.autocompletarCaminho(iCm);   // sugere os caminhos que já estão gravados (a partir de 3 letras)
    const ed = ADM.editorResposta({ valor: linha.conteudo || '', rotulo: 'Conteúdo do artigo', rotuloPrevia: 'Visualização', placeholder: 'O texto que a IA recebe como conhecimento. Corrija o que estiver errado ou desatualizado.' });
    const iEmit = h('textarea', { rows: 4, placeholder: 'Opcional. Passo a passo de como emitir (a IA também recebe este texto).' }); iEmit.value = linha.como_emitir || '';
    const emitir = h('details', { open: !!canon(linha.como_emitir) }, h('summary', { style: { cursor: 'pointer', fontWeight: 700, fontSize: '12.5px' } }, 'Como emitir (opcional)'), h('div', { style: { marginTop: '8px' } }, iEmit));

    const ctx = opcoes.contexto;
    const blocoCtx = ctx && (ctx.pergunta || ctx.resposta) ? h('details', { class: 'ctx-artigo' },
        h('summary', null, 'Pergunta e resposta da IA (para conferir enquanto corrige)'),
        h('div', { class: 'pilha', style: { marginTop: '8px' } },
            ctx.pergunta ? h('div', null, h('span', { class: 'rot-mini' }, 'Pergunta do usuário'), h('div', { style: { fontWeight: 700, wordBreak: 'break-word' } }, String(ctx.pergunta))) : null,
            ctx.resposta ? h('div', null, h('span', { class: 'rot-mini' }, 'Resposta que a IA deu'), (() => { const p = h('div', { class: 'md-prev' }); p.innerHTML = renderMd(String(ctx.resposta)); return p; })()) : null)) : null;

    const corpo = [
        ADM.ui.aviso('in', 'Você está editando o artigo ', h('b', null, '#' + linha.id), ' da base de conhecimento — a mudança vale para todos que usarem o sistema. Ao salvar, o vetor de busca dele é descartado e recalculado sozinho na próxima abertura do sistema.'),
        blocoCtx,
        h('div', { class: 'g2' },
            h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Título (a dúvida que o artigo responde)'), iTit),
            h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Categoria (opcional)'), iCat, dl),
            h('label', { class: 'campo', style: { gridColumn: '1 / -1' } }, h('span', { class: 'rot' }, 'Caminho no menu (opcional — grava na coluna caminho_menu do banco de dados)'), iCm)),
        ed.el,
        emitir,
    ];
    return ADM.ui.modal({
        titulo: 'Corrigir artigo #' + linha.id + ' — base de conhecimento', largura: 1040, fecharFora: false, corpo,
        botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, {
            rotulo: 'Salvar no banco de dados', tipo: 'primario', fechar: false,
            acao: async (btn, api) => {
                const novo = { titulo: iTit.value, conteudo: ed.obter(), categoria: iCat.value, como_emitir: iEmit.value };
                if (!semColunaCaminho) novo.caminho_menu = ADM.normalizarCaminhoMenu(iCm.value);
                if (canon(novo.titulo) === null || canon(novo.titulo).length < 3) { ADM.ui.toast('Escreva o título do artigo.', 'wa'); iTit.focus(); return false; }
                if (canon(novo.conteudo) === null || canon(novo.conteudo).length < 5) { ADM.ui.toast('O conteúdo do artigo está vazio.', 'wa'); ed.textarea.focus(); return false; }
                const payload = {};
                Object.keys(novo).forEach(c => { if (canon(novo[c]) !== canon(linha[c])) payload[c] = canon(novo[c]); });
                if (!Object.keys(payload).length) { ADM.ui.toast('Nada foi alterado.', 'wa'); return false; }
                if (Object.keys(payload).some(c => c !== 'caminho_menu')) payload.embedding = null;   // o texto mudou: o vetor de busca antigo não vale mais (igual à aba Banco de dados). Só o caminho no menu mudou? O vetor não depende dele: fica
                const r = await ADM.sb.from('BancoDados').update(payload).eq('id', linha.id).select('id, titulo, categoria');
                ADM.db.exigirAfetadas(r);
                if ('caminho_menu' in payload) ADM.caminhos.invalidar();
                ADM.ui.toast(`Artigo #${linha.id} atualizado no banco de dados. A IA passa a usar o texto novo quando o sistema for aberto de novo (o vetor de busca é recalculado sozinho).`, 'ok', 8000);
                api.fechar();
                if (opcoes.aoSalvar) opcoes.aoSalvar(r.data[0]);
            },
        }],
    });
};

/* ───────────── caminho no menu (BancoDados.caminho_menu — sql/05_bancodados_caminho_menu.sql) ───────────── */
// O separador digitado vira sempre " > " (aceita › » → -> |); níveis vazios somem. Usado nos formulários da Revisão (Salvar no banco de dados e Corrigir artigo).
ADM.normalizarCaminhoMenu = function (txt) {
    // separa nos níveis (qualquer separador aceito), descarta pedaços vazios (">>", ">" nas pontas) e junta de novo com " > "
    return String(txt == null ? '' : txt).replace(/\s+/g, ' ').split(/\s*(?:›|»|→|->|\||>)\s*/).map(p => p.trim()).filter(Boolean).join(' > ');
};

/* ───────────── autocompletar o caminho no menu com o que JÁ está gravado ───────────── */
// Histórico = os caminhos que já existem em BancoDados.caminho_menu (com quantos artigos usam cada um). Ao digitar 3 letras ou mais, o campo sugere os que combinam
// (todas as palavras digitadas precisam aparecer, sem acento e em qualquer ordem; quem COMEÇA igual vem primeiro, depois os mais usados). Setas ↑ ↓ + Enter, clique
// ou Esc. Se a coluna ainda não existe (SQL 05) ou o banco falha, o campo segue normal, sem sugestões.
ADM.caminhos = (() => {
    const TTL = 5 * 60 * 1000;
    let cache = null, carregando = null;
    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const chave = s => semAcento(s).replace(/›|»|→|->|\||>/g, ' ').replace(/\s+/g, ' ').trim();
    async function carregar(forcar) {
        if (!forcar && cache && Date.now() - cache.em < TTL) return cache.lista;
        if (carregando) return carregando;
        carregando = (async () => {
            let lista = [];
            try {
                const linhas = await ADM.db.todas((a, b) => ADM.sb.from('BancoDados').select('caminho_menu').order('id', { ascending: true }).range(a, b));
                const cont = new Map();
                linhas.forEach(l => { const c = ADM.normalizarCaminhoMenu(l && l.caminho_menu); if (c) cont.set(c, (cont.get(c) || 0) + 1); });
                lista = Array.from(cont, ([caminho, n]) => ({ caminho, n, k: chave(caminho) }));
            } catch (e) { if (!ADM.db.ehColunaAusente(e)) console.warn('[admin] não consegui carregar os caminhos já gravados:', e); }
            cache = { em: Date.now(), lista };
            return lista;
        })();
        try { return await carregando; } finally { carregando = null; }
    }
    function sugerir(lista, texto, max) {
        const q = chave(texto);
        if (q.replace(/ /g, '').length < 3) return [];
        const termos = q.split(' ');
        const igual = chave(ADM.normalizarCaminhoMenu(texto));
        return lista.filter(x => x.k !== igual && termos.every(t => x.k.includes(t)))
            .sort((a, b) => ((b.k.startsWith(q) ? 1 : 0) - (a.k.startsWith(q) ? 1 : 0)) || (b.n - a.n) || (a.caminho.length - b.caminho.length) || a.caminho.localeCompare(b.caminho, 'pt-BR'))
            .slice(0, max || 8);
    }
    return { carregar, sugerir, invalidar() { cache = null; } };
})();

// Liga o autocompletar a um <input>. Não mexe na estrutura da tela: a lista é um painel solto (position: fixed), então não é cortada por janelas com rolagem.
ADM.autocompletarCaminho = function (input) {
    if (!input || input._acCaminho) return;
    input._acCaminho = true;
    const idLista = 'acc' + Math.random().toString(36).slice(2, 7);
    let lista = null, itens = [], ativo = -1, seq = 0;
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('autocomplete', 'off');

    function fechar() {
        if (lista) { lista.remove(); lista = null; window.removeEventListener('resize', posicionar); document.removeEventListener('scroll', posicionar, true); }   // (os ouvintes só existem enquanto a lista está aberta)
        itens = []; ativo = -1;
        input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-controls'); input.removeAttribute('aria-activedescendant');
    }
    function posicionar() {
        if (!lista) return;
        if (!document.contains(input)) { fechar(); return; }
        const r = input.getBoundingClientRect(), abaixo = window.innerHeight - r.bottom, alt = Math.min(lista.scrollHeight, 280);
        lista.style.left = Math.round(r.left) + 'px'; lista.style.width = Math.round(r.width) + 'px';
        if (abaixo >= Math.min(alt, 170) + 8 || abaixo >= r.top) { lista.style.top = Math.round(r.bottom + 4) + 'px'; lista.style.bottom = ''; lista.style.maxHeight = Math.max(110, Math.min(280, abaixo - 12)) + 'px'; }
        else { lista.style.top = ''; lista.style.bottom = Math.round(window.innerHeight - r.top + 4) + 'px'; lista.style.maxHeight = Math.max(110, Math.min(280, r.top - 12)) + 'px'; }
    }
    function destacar(i) {
        ativo = i;
        Array.from(lista ? lista.children : []).forEach((li, k) => { li.setAttribute('aria-selected', k === i ? 'true' : 'false'); li.classList.toggle('ativo', k === i); });
        if (lista && i >= 0 && lista.children[i]) { input.setAttribute('aria-activedescendant', lista.children[i].id); lista.children[i].scrollIntoView({ block: 'nearest' }); }
        else input.removeAttribute('aria-activedescendant');
    }
    function aceitar(i) {
        const it = itens[i]; if (!it) return;
        input.value = it.caminho;
        input.dispatchEvent(new Event('input', { bubbles: true }));   // (os formulários guardam o valor pelo evento "input")
        fechar(); input.focus();
    }
    function abrir(sugestoes) {
        if (!sugestoes.length) { fechar(); return; }
        itens = sugestoes; ativo = -1;
        if (!lista) {
            lista = h('ul', { class: 'ac-lista', id: idLista, role: 'listbox', 'aria-label': 'Caminhos já gravados' });
            lista.addEventListener('mousedown', e => { e.preventDefault(); });   // clicar na lista não tira o foco do campo (senão ela fecharia antes do clique)
            document.body.appendChild(lista);
            window.addEventListener('resize', posicionar); document.addEventListener('scroll', posicionar, true);
        }
        limpar(lista);
        sugestoes.forEach((s, i) => {
            const li = h('li', { class: 'ac-item', role: 'option', id: idLista + '-' + i, 'aria-selected': 'false', title: s.caminho },
                h('span', { class: 'ac-txt' }, s.caminho), h('span', { class: 'ac-n' }, s.n + (s.n === 1 ? ' artigo' : ' artigos')));
            li.addEventListener('click', () => aceitar(i));
            li.addEventListener('mousemove', () => { if (ativo !== i) destacar(i); });
            lista.appendChild(li);
        });
        input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', idLista);
        posicionar();
    }
    const atualizar = debounce(async () => {
        const meu = ++seq;
        const dados = await ADM.caminhos.carregar();
        if (meu !== seq || document.activeElement !== input) return;
        abrir(ADM.caminhos.sugerir(dados, input.value, 8));
    }, 90);
    input.addEventListener('focus', () => { ADM.caminhos.carregar(); });                // já deixa o histórico pronto
    input.addEventListener('input', atualizar);
    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!lista) { atualizar(); return; }
            e.preventDefault();
            destacar(e.key === 'ArrowDown' ? (ativo + 1) % itens.length : (ativo <= 0 ? itens.length - 1 : ativo - 1));
        } else if (e.key === 'Enter' && lista && ativo >= 0) { e.preventDefault(); aceitar(ativo); }
        else if (e.key === 'Escape' && lista) { e.preventDefault(); e.stopPropagation(); fechar(); }   // (fecha só a lista; a janela por trás continua aberta)
    });
    input.addEventListener('blur', () => { seq++; setTimeout(fechar, 120); });
};
