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
    let linha;
    try {
        const r = await ADM.sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria').eq('id', chaveId).maybeSingle();
        if (r.error) throw r.error;
        linha = r.data;
    } catch (e) { ADM.ui.toast('Não consegui abrir o artigo #' + chaveId + ': ' + ADM.db.erroTexto(e), 'er', 9000); return null; }
    if (!linha) { ADM.ui.toast('O artigo #' + chaveId + ' não existe mais no banco de dados (foi excluído?).', 'wa', 9000); return null; }

    const canon = v => v == null ? null : (String(v).replace(/\r\n?/g, '\n').trim() || null);   // vazio, nulo e espaço sobrando são "a mesma coisa"; a caixa de texto troca \r\n por \n
    const iTit = h('input', { type: 'text', maxlength: 400 }); iTit.value = linha.titulo || '';
    const dl = h('datalist', { id: 'dlCatArtigoBD' }, (opcoes.categorias || []).map(c => h('option', { value: c })));
    const iCat = h('input', { type: 'text', list: 'dlCatArtigoBD', maxlength: 60, placeholder: 'Ex.: CT-e' }); iCat.value = linha.categoria || '';
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
            h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Categoria (opcional)'), iCat, dl)),
        ed.el,
        emitir,
    ];
    return ADM.ui.modal({
        titulo: 'Corrigir artigo #' + linha.id + ' — base de conhecimento', largura: 1040, fecharFora: false, corpo,
        botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, {
            rotulo: 'Salvar no banco de dados', tipo: 'primario', fechar: false,
            acao: async (btn, api) => {
                const novo = { titulo: iTit.value, conteudo: ed.obter(), categoria: iCat.value, como_emitir: iEmit.value };
                if (canon(novo.titulo) === null || canon(novo.titulo).length < 3) { ADM.ui.toast('Escreva o título do artigo.', 'wa'); iTit.focus(); return false; }
                if (canon(novo.conteudo) === null || canon(novo.conteudo).length < 5) { ADM.ui.toast('O conteúdo do artigo está vazio.', 'wa'); ed.textarea.focus(); return false; }
                const payload = {};
                Object.keys(novo).forEach(c => { if (canon(novo[c]) !== canon(linha[c])) payload[c] = canon(novo[c]); });
                if (!Object.keys(payload).length) { ADM.ui.toast('Nada foi alterado.', 'wa'); return false; }
                payload.embedding = null;   // o texto mudou: o vetor de busca antigo não vale mais (igual à aba Banco de dados)
                const r = await ADM.sb.from('BancoDados').update(payload).eq('id', linha.id).select('id, titulo, categoria');
                ADM.db.exigirAfetadas(r);
                ADM.ui.toast(`Artigo #${linha.id} atualizado no banco de dados. A IA passa a usar o texto novo quando o sistema for aberto de novo (o vetor de busca é recalculado sozinho).`, 'ok', 8000);
                api.fechar();
                if (opcoes.aoSalvar) opcoes.aoSalvar(r.data[0]);
            },
        }],
    });
};
