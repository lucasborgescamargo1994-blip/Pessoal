/* admin/js/aba-faq.js — Aba "FAQ": alimenta a página faq.html (perguntas, respostas e vídeos).
   • Lista: todas as perguntas (publicadas e rascunhos), busca/filtros, publicar/despublicar, excluir, copiar o link de cada uma.
   • Editor: pergunta, resposta (Markdown com prévia), categoria, caminho no menu, palavras-chave e os VÍDEOS (link do YouTube / Google Drive / Vimeo / Loom / .mp4, com prévia — ou
     "Enviar vídeo do computador", opcional, que guarda o arquivo no Supabase Storage: sql/07b_faq_videos_storage.sql).
   • Importar do banco de dados: leva artigos do BancoDados e respostas rápidas para o FAQ (como rascunho) — também pelo botão "Levar para o FAQ" nas abas Banco de dados e Respostas rápidas.
   Tabela: faq_itens (sql/07_faq.sql). Toda a lógica de links de vídeo e de conversão do banco está em js/faq/logica.js. Todo texto vindo do banco entra na tela como TEXTO (h()). */
(function () {
    'use strict';
    const L = FaqLogica;
    const SQL = '07_faq.sql', SQL_VIDEOS = '07b_faq_videos_storage.sql';
    const MAX_LINHAS = 200;
    const E = { itens: [], carregando: false, carregou: false, semSQL: false, erro: null, sel: new Set(), mostrando: MAX_LINHAS, f: { texto: '', categoria: '', estado: 'todas', video: 'todos' }, ord: { col: 'id', dir: -1 }, fonte: { banco: null, rapidas: null } };
    const R = {};

    /* ───────────── utilidades ───────────── */
    const linkFaq = id => { try { return new URL('../faq.html' + (id ? '?id=' + id : ''), location.href).href; } catch (e) { return ''; } };
    const txt = v => String(v == null ? '' : v).trim();
    // Node.append() não "achata" listas nem ignora null (viraria o texto "null"): este junta como o h() faz
    const juntar = (pai, ...filhos) => { filhos.flat(Infinity).forEach(f => { if (f != null && f !== false) pai.appendChild(f instanceof Node ? f : document.createTextNode(String(f))); }); return pai; };
    const videosDe = it => L.lerVideos(it.videos);
    const ICONE_TIPO = { youtube: '▶', drive: '📁', vimeo: '🎞', loom: '🎥', arquivo: '📼', link: '🔗' };
    const campo = (rot, valor, op) => { op = op || {}; const i = op.multi ? h('textarea', { rows: op.linhas || 3, placeholder: op.dica || '', maxlength: op.max || null }) : h('input', { type: op.tipo || 'text', placeholder: op.dica || '', maxlength: op.max || null, list: op.lista || null }); i.value = valor == null ? '' : valor; return { i, el: h('label', { class: 'campo' }, h('span', { class: 'rot' }, rot), i, op.ajuda ? h('span', { class: 'dica' }, op.ajuda) : null) }; };
    const carregandoEl = () => h('div', { class: 'vazio' }, h('span', { class: 'girar', style: { display: 'inline-block' } }, I('refresh', 22)), ' Carregando…');
    const ehDuplicado = e => !!e && (e.code === '23505' || /duplicate key|faq_itens_origem_uni/i.test(String(e.message || '')));
    const existentePorOrigem = (origem, id) => E.itens.find(x => x.origem === origem && Number(x.origem_id) === Number(id));

    /* ───────────── carregar ───────────── */
    async function carregar() {
        if (E.carregando) return;
        E.carregando = true; E.erro = null; renderCorpo();
        try {
            const d = await ADM.db.todas((a, b) => ADM.sb.from('faq_itens').select('*').order('id', { ascending: false }).range(a, b), { max: 10000 });
            E.itens = d; E.semSQL = false;
            const ids = new Set(d.map(x => x.id)); E.sel.forEach(id => { if (!ids.has(id)) E.sel.delete(id); });
        } catch (e) { if (ADM.db.ehTabelaAusente(e)) E.semSQL = true; else E.erro = e; }
        E.carregando = false; E.carregou = true; atualizarCategoriasDoFiltro(); renderCorpo();
    }
    const categoriasExistentes = () => L.categorias(E.itens).map(c => c.nome);

    /* ───────────── lista ───────────── */
    function filtradas() {
        const palavras = L.chaveBusca(E.f.texto).split(' ').filter(Boolean), cat = E.f.categoria;
        const lista = E.itens.filter(it => {
            if (E.f.estado === 'publicadas' && !it.publicado) return false;
            if (E.f.estado === 'rascunhos' && it.publicado) return false;
            const nv = videosDe(it).length;
            if (E.f.video === 'com' && !nv) return false;
            if (E.f.video === 'sem' && nv) return false;
            const c = txt(it.categoria);
            if (cat === '__sem' ? !!c : (cat && c !== cat)) return false;
            if (palavras.length) { const a = L.chaveBusca([it.pergunta, it.resposta, it.categoria, it.palavras_chave, it.caminho_menu].join(' ')); if (!palavras.every(p => a.includes(p))) return false; }
            return true;
        });
        const { col, dir } = E.ord;
        const chave = it => col === 'pergunta' ? L.norm(it.pergunta) : col === 'categoria' ? L.norm(it.categoria) : col === 'videos' ? videosDe(it).length : col === 'atualizado' ? new Date(it.atualizado_em || 0).getTime() : Number(it.id);
        return lista.sort((a, b) => { const x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    }
    function cabecalho(rotulo, col, extra) {
        const seta = E.ord.col === col ? (E.ord.dir === 1 ? ' ▲' : ' ▼') : '';
        return h('th', { class: 'ord' + (extra ? ' ' + extra : ''), 'aria-sort': E.ord.col === col ? (E.ord.dir === 1 ? 'ascending' : 'descending') : 'none', onclick: () => { if (E.ord.col === col) E.ord.dir *= -1; else { E.ord.col = col; E.ord.dir = col === 'pergunta' || col === 'categoria' ? 1 : -1; } renderTabela(); } }, rotulo + seta);
    }
    function chipsVideos(it) {
        const vs = videosDe(it); if (!vs.length) return h('span', { class: 'mu' }, '—');
        return h('span', { class: 'nw' }, vs.slice(0, 4).map(v => h('span', { class: 'sel in', style: { marginRight: '3px' }, title: (v.titulo ? v.titulo + ' · ' : '') + v.info.rotulo }, ICONE_TIPO[v.info.tipo] || '🎬')), vs.length > 4 ? h('span', { class: 'mu' }, '+' + (vs.length - 4)) : null, h('span', { class: 'mu', style: { marginLeft: '4px' } }, String(vs.length)));
    }
    function origemEl(it) {
        if (!it.origem) return h('span', { class: 'mu' }, '✍ digitada');
        const rot = L.ROTULO_ORIGEM[it.origem] || it.origem;
        return h('span', { class: 'nw', title: 'Veio de: ' + rot + ' #' + it.origem_id }, it.origem === 'banco' ? '🗄 ' : '⚡ ', rot + ' #' + it.origem_id);
    }
    function renderTabela() {
        const box = limpar(R.tabela), lista = filtradas();
        R.contagem.textContent = E.itens.length ? lista.length + ' de ' + E.itens.length + ' pergunta(s)' : '';
        renderLote();
        if (!E.itens.length) { box.appendChild(ADM.ui.vazio('❓', 'O FAQ ainda está vazio', 'Clique em “Importar do banco de dados” para levar artigos e respostas rápidas, ou em “Nova pergunta” para escrever uma. Depois anexe os vídeos e publique.')); return; }
        if (!lista.length) { box.appendChild(ADM.ui.vazio('🔎', 'Nada encontrado', 'Ajuste a busca ou os filtros.')); return; }
        const visiveis = lista.slice(0, E.mostrando);
        const todasMarcadas = visiveis.length && visiveis.every(it => E.sel.has(it.id));
        const chkTodas = h('input', { type: 'checkbox', checked: todasMarcadas, 'aria-label': 'Marcar todas as perguntas da lista' });
        chkTodas.addEventListener('change', () => { visiveis.forEach(it => { if (chkTodas.checked) E.sel.add(it.id); else E.sel.delete(it.id); }); renderTabela(); });
        const linhas = visiveis.map(it => {
            const ch = ADM.ui.chave(!!it.publicado, async (marcado, input) => {
                input.disabled = true;
                try { const r = await ADM.sb.from('faq_itens').update({ publicado: marcado }).eq('id', it.id).select('id'); ADM.db.exigirAfetadas(r); it.publicado = marcado; ADM.ui.toast(marcado ? 'Publicada — já aparece no FAQ.' : 'Voltou a rascunho — saiu do FAQ.', 'ok', 2400); renderLote(); }
                catch (e) { input.checked = !marcado; ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
                input.disabled = false;
            }, 'Pergunta ' + it.id + ' publicada');
            const marc = h('input', { type: 'checkbox', checked: E.sel.has(it.id), 'aria-label': 'Marcar a pergunta ' + it.id });
            marc.addEventListener('change', () => { if (marc.checked) E.sel.add(it.id); else E.sel.delete(it.id); renderLote(); });
            return h('tr', { style: it.publicado ? null : { opacity: '.78' } },
                h('td', null, marc),
                h('td', { class: 'mono mu nw' }, '#' + it.id),
                h('td', { style: { minWidth: '260px', maxWidth: '520px' } }, h('div', { style: { fontWeight: 700, wordBreak: 'break-word' } }, it.pergunta),
                    h('div', { class: 'mu', style: { fontSize: '12.5px', marginTop: '2px' } }, L.resumo(it.resposta, 140) || '(só vídeo)')),
                h('td', null, txt(it.categoria) ? h('span', { class: 'sel' }, txt(it.categoria)) : h('span', { class: 'mu' }, '—')),
                h('td', null, chipsVideos(it)),
                h('td', { class: 'mu', style: { fontSize: '12.5px' } }, origemEl(it)),
                h('td', null, ch.el),
                h('td', { class: 'nw mu' }, ADM.fmt.dataHora(it.atualizado_em || it.criado_em)),
                h('td', { class: 'acoes' },
                    h('button', { class: 'btn peq', type: 'button', onclick: () => editar(it) }, I('edit', 14), 'Editar'),
                    h('button', { class: 'btn peq fantasma', type: 'button', title: it.publicado ? 'Abrir esta pergunta na página do FAQ' : 'Só aparece no FAQ depois de publicada', 'aria-label': 'Ver no FAQ', disabled: !it.publicado, onclick: () => window.open(linkFaq(it.id), '_blank', 'noopener') }, I('eye', 14)),
                    h('button', { class: 'btn peq fantasma', type: 'button', title: 'Copiar o link desta pergunta', 'aria-label': 'Copiar o link', onclick: () => ADM.ui.copiar(linkFaq(it.id), 'Link da pergunta copiado.') }, I('copy', 14)),
                    h('button', { class: 'btn peq fantasma', type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar', onclick: () => editar(null, { pergunta: it.pergunta + ' (cópia)', resposta: it.resposta, categoria: it.categoria, caminho_menu: it.caminho_menu, palavras_chave: it.palavras_chave, videos: it.videos, ordem: it.ordem }) }, I('layers', 14)),
                    h('button', { class: 'btn peq fantasma perigo', type: 'button', title: 'Excluir', 'aria-label': 'Excluir', onclick: () => excluir([it]) }, I('trash', 14))));
        });
        box.appendChild(h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null, h('th', { style: { width: '28px' } }, chkTodas), cabecalho('ID', 'id'), cabecalho('Pergunta', 'pergunta'), cabecalho('Categoria', 'categoria'), cabecalho('Vídeos', 'videos'), h('th', null, 'Origem'), h('th', null, 'Publicada'), cabecalho('Atualizada', 'atualizado'), h('th', null, ''))),
            h('tbody', null, linhas))));
        if (lista.length > visiveis.length) box.appendChild(h('div', { class: 'tc', style: { marginTop: '10px' } }, h('button', { class: 'btn', type: 'button', onclick: () => { E.mostrando += MAX_LINHAS; renderTabela(); } }, 'Mostrar mais ' + MAX_LINHAS + ' (' + (lista.length - visiveis.length) + ' restantes)')));
    }
    // barra de ações em lote (aparece quando há perguntas marcadas)
    function renderLote() {
        if (!R.lote) return;
        const marcadas = E.itens.filter(it => E.sel.has(it.id)), box = limpar(R.lote);
        box.hidden = !marcadas.length; if (!marcadas.length) return;
        box.append(h('b', null, marcadas.length + ' marcada(s):'),
            h('button', { class: 'btn peq', type: 'button', onclick: e => emLote(e.currentTarget, marcadas, { publicado: true }, 'publicada(s)') }, I('check', 14), 'Publicar'),
            h('button', { class: 'btn peq', type: 'button', onclick: e => emLote(e.currentTarget, marcadas, { publicado: false }, 'voltou(aram) a rascunho') }, 'Voltar a rascunho'),
            h('button', { class: 'btn peq', type: 'button', onclick: () => mudarCategoriaEmLote(marcadas) }, I('edit', 14), 'Mudar categoria…'),
            h('button', { class: 'btn peq perigo', type: 'button', onclick: () => excluir(marcadas) }, I('trash', 14), 'Excluir'),
            h('button', { class: 'btn peq fantasma', type: 'button', onclick: () => { E.sel.clear(); renderTabela(); } }, 'Limpar seleção'));
    }
    async function emLote(btn, marcadas, patch, rotulo) {
        const semConteudo = patch.publicado === true ? marcadas.filter(it => !txt(it.resposta) && !videosDe(it).length) : [];
        if (semConteudo.length) { ADM.ui.toast(semConteudo.length + ' pergunta(s) marcada(s) não têm resposta nem vídeo (ex.: #' + semConteudo[0].id + '): complete antes de publicar.', 'wa', 8000); return; }
        await ADM.ui.ocupado(btn, async () => {
            try { const r = await ADM.sb.from('faq_itens').update(patch).in('id', marcadas.map(x => x.id)).select('id'); ADM.db.exigirAfetadas(r, marcadas.length); marcadas.forEach(it => Object.assign(it, patch)); renderTabela(); ADM.ui.toast(marcadas.length + ' pergunta(s) ' + rotulo + '.', 'ok', 3000); }
            catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
        });
    }
    async function mudarCategoriaEmLote(marcadas) {
        const nova = await ADM.ui.entrada({ titulo: 'Mudar a categoria', mensagem: 'Nova categoria para as ' + marcadas.length + ' pergunta(s) marcada(s) (deixe em branco para tirar a categoria).', rotulo: 'Categoria', dica: 'Ex.: Ct-e', valor: '' });
        if (nova === null) return;
        const cat = nova.trim() || null;
        try { const r = await ADM.sb.from('faq_itens').update({ categoria: cat }).in('id', marcadas.map(x => x.id)).select('id'); ADM.db.exigirAfetadas(r, marcadas.length); marcadas.forEach(it => { it.categoria = cat; }); atualizarCategoriasDoFiltro(); renderTabela(); ADM.ui.toast('Categoria alterada.', 'ok', 2500); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }
    async function excluir(lista) {
        const n = lista.length, publicadas = lista.filter(x => x.publicado).length;
        if (!(await ADM.ui.confirmar(n === 1 ? 'Excluir a pergunta “' + ADM.fmt.trunc(lista[0].pergunta, 90) + '”?' : 'Excluir as ' + n + ' perguntas marcadas?', { titulo: 'Excluir do FAQ', rotuloOk: 'Excluir', perigo: true,
            detalhe: (publicadas ? publicadas + ' delas estão publicadas e saem do FAQ na hora. ' : '') + 'Os vídeos no YouTube/Drive não são apagados (só o vínculo com a pergunta). Para tirar do ar sem perder o texto, use “Voltar a rascunho”. Não dá para desfazer.' }))) return;
        try { const r = await ADM.sb.from('faq_itens').delete().in('id', lista.map(x => x.id)).select('id'); ADM.db.exigirAfetadas(r, n); const ids = new Set(lista.map(x => x.id)); E.itens = E.itens.filter(x => !ids.has(x.id)); ids.forEach(id => E.sel.delete(id)); atualizarCategoriasDoFiltro(); renderTabela(); ADM.ui.toast(n + ' pergunta(s) excluída(s).', 'ok', 2600); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }

    /* ───────────── editor ───────────── */
    function playerEl(info, titulo) {
        const caixa = h('div', { class: 'faq-prev' });
        if (info.tipo === 'arquivo') { const v = document.createElement('video'); v.controls = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); v.src = info.embed; caixa.appendChild(v); }
        else { const f = document.createElement('iframe'); f.src = info.embed; f.title = titulo; f.loading = 'lazy'; f.referrerPolicy = 'strict-origin-when-cross-origin'; f.setAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media'); f.setAttribute('allowfullscreen', ''); f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'); caixa.appendChild(f); }
        return caixa;
    }
    async function buscarOrigem(origem, id) {
        if (origem === 'banco') {
            let r = await ADM.sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria, caminho_menu').eq('id', id).maybeSingle();
            if (r.error && ADM.db.ehColunaAusente(r.error)) r = await ADM.sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria').eq('id', id).maybeSingle();
            if (r.error) throw r.error; if (!r.data) throw new Error('O artigo #' + id + ' não existe mais no banco de dados.');
            return L.itemDeBanco(r.data);
        }
        const r = await ADM.sb.from('respostas_rapidas').select('id, pergunta, resposta, categoria, variantes').eq('id', id).maybeSingle();
        if (r.error) throw r.error; if (!r.data) throw new Error('A resposta rápida #' + id + ' não existe mais.');
        return L.itemDeRespostaRapida(r.data);
    }

    function editar(it, pre) {
        const novo = !it;
        const base = it || Object.assign({ pergunta: '', resposta: '', categoria: '', caminho_menu: '', palavras_chave: '', videos: [], origem: null, origem_id: null, publicado: false, ordem: 0 }, pre || {});
        let videos = (Array.isArray(base.videos) ? base.videos : []).filter(x => x && typeof x === 'object').map(x => ({ titulo: txt(x.titulo), url: txt(x.url) }));
        const f = {
            pergunta: campo('Pergunta *', base.pergunta, { max: 300, dica: 'Como a pessoa perguntaria. Ex.: Como emitir um CT-e de complemento?' }),
            categoria: campo('Categoria', base.categoria, { max: 80, dica: 'Ex.: Ct-e', lista: 'faqCategorias', ajuda: 'Agrupa e filtra na página do FAQ.' }),
            caminho: campo('Onde fica no menu', base.caminho_menu, { max: 200, dica: 'Ex.: Transporte > Conhecimentos', ajuda: 'Aparece como “Onde fica:” na resposta.' }),
            chaves: campo('Palavras-chave (para a busca)', base.palavras_chave, { max: 300, dica: 'Ex.: cancelar anular estornar', ajuda: 'Sinônimos que a pessoa pode digitar e que não estão no texto.' }),
            ordem: campo('Ordem', base.ordem || 0, { tipo: 'number', ajuda: 'Menor aparece primeiro (0 = padrão).' }),
        };
        ADM.autocompletarCaminho(f.caminho.i);   // sugere os caminhos que já estão gravados no banco de dados
        const ta = h('textarea', { rows: 9, placeholder: 'Escreva a resposta. Dá para usar **negrito**, listas com "- " e links. Se for só um vídeo, pode deixar em branco.', maxlength: 20000 }); ta.value = txt(base.resposta);
        const prev = h('div', { class: 'md-prev', 'aria-live': 'polite' });
        const atualizarPrev = () => { prev.innerHTML = ta.value.trim() ? L.arrumarListas(renderMd(ta.value)) : '<span class="mu">A prévia da resposta aparece aqui.</span>'; };      // renderMd escapa <, > e & antes de formatar
        ta.addEventListener('input', atualizarPrev); atualizarPrev();
        const chkPub = h('input', { type: 'checkbox', checked: !!base.publicado });
        const lista = h('datalist', { id: 'faqCategorias' }, categoriasExistentes().map(c => h('option', { value: c })));

        // origem (banco de dados / resposta rápida)
        const origemBox = h('div');
        if (base.origem) {
            const rot = L.ROTULO_ORIGEM[base.origem] || base.origem;
            origemBox.appendChild(ADM.ui.aviso('in', h('b', null, 'Veio do(a) ' + rot + ' #' + base.origem_id + '. '), 'Mudou lá? ',
                h('button', { class: 'btn peq', type: 'button', onclick: async e => ADM.ui.ocupado(e.currentTarget, async () => {
                    try {
                        const o = await buscarOrigem(base.origem, base.origem_id);
                        if (!(await ADM.ui.confirmar('Trocar a pergunta, a resposta, a categoria e o caminho pelo que está HOJE no(a) ' + rot + '?', { titulo: 'Atualizar a partir do banco', rotuloOk: 'Atualizar', detalhe: 'Os vídeos e as palavras-chave que você anexou aqui não mudam.' }))) return;
                        f.pergunta.i.value = o.pergunta; ta.value = o.resposta; f.categoria.i.value = o.categoria || ''; f.caminho.i.value = o.caminho_menu || ''; atualizarPrev(); ADM.ui.toast('Texto atualizado — confira e salve.', 'ok', 3000);
                    } catch (err) { ADM.ui.toast(ADM.db.erroTexto(err), 'er', 8000); }
                }) }, I('refresh', 13), 'Atualizar o texto a partir do banco')));
        }

        // vídeos
        const listaV = h('div', { class: 'pilha', style: { gap: '10px' } });
        const btnEnviar = h('button', { class: 'btn', type: 'button', title: 'Guarda o arquivo no Supabase Storage (até 50 MB) — precisa do sql/' + SQL_VIDEOS }, I('upload', 15), 'Enviar vídeo do computador');
        const entrada = h('input', { type: 'file', accept: 'video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.mov,.m4v,.ogv', hidden: true });
        const estadoEnvio = h('span', { class: 'dica' });
        function renderVideos() {
            limpar(listaV);
            if (!videos.length) listaV.appendChild(h('div', { class: 'dica' }, 'Nenhum vídeo anexado. Cole o link de um vídeo (YouTube, Google Drive, Vimeo, Loom ou arquivo .mp4) ou envie um arquivo do computador.'));
            videos.forEach((v, i) => {
                const tit = h('input', { type: 'text', placeholder: 'Título do vídeo (opcional) — ex.: Passo a passo', maxlength: 120, 'aria-label': 'Título do vídeo ' + (i + 1) }); tit.value = v.titulo; tit.addEventListener('input', () => { v.titulo = tit.value; });
                const url = h('input', { type: 'text', placeholder: 'Cole aqui o link do vídeo…', 'aria-label': 'Link do vídeo ' + (i + 1), class: 'mono' }); url.value = v.url;
                const estado = h('div', { class: 'linha', style: { gap: '6px', minHeight: '22px' } });
                const prevBox = h('div');
                const pintar = () => {
                    limpar(estado); const t = url.value.trim(); if (!t) return;
                    const inf = L.videoInfo(t);
                    if (inf.ok) juntar(estado, h('span', { class: 'sel ok' }, '✔ ' + inf.rotulo), inf.embed ? null : h('span', { class: 'dica' }, 'não vira player: o botão “Abrir vídeo” leva para o link'));
                    else estado.append(h('span', { class: 'sel er' }, inf.erro));
                };
                url.addEventListener('input', () => { v.url = url.value; pintar(); limpar(prevBox); });
                url.addEventListener('blur', () => { const inf = url.value.trim() ? L.videoInfo(url.value) : null; if (inf && inf.ok && inf.url !== url.value) { url.value = inf.url; v.url = inf.url; } });
                const bPrev = h('button', { class: 'btn peq', type: 'button', onclick: () => {
                    if (prevBox.firstChild) { limpar(prevBox); return; }
                    const inf = L.videoInfo(url.value); if (!inf.ok) { ADM.ui.toast(inf.erro, 'wa'); return; }
                    if (!inf.embed) { window.open(inf.abrir, '_blank', 'noopener'); return; }
                    prevBox.appendChild(playerEl(inf, v.titulo || 'Prévia do vídeo'));
                } }, I('play', 13), 'Prévia');
                pintar();
                listaV.appendChild(h('div', { class: 'cartao' }, h('div', { class: 'cartao-corpo', style: { gap: '8px' } },
                    h('div', { class: 'linha', style: { gap: '8px' } }, h('span', { class: 'mono mu' }, String(i + 1)), h('div', { class: 'grow', style: { minWidth: '160px' } }, tit),
                        h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Subir', 'aria-label': 'Subir', disabled: i === 0, onclick: () => { videos.splice(i - 1, 0, videos.splice(i, 1)[0]); renderVideos(); } }, I('up', 13)),
                        h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Descer', 'aria-label': 'Descer', disabled: i === videos.length - 1, onclick: () => { videos.splice(i + 1, 0, videos.splice(i, 1)[0]); renderVideos(); } }, I('down', 13)),
                        h('button', { class: 'btn peq fantasma perigo icone', type: 'button', title: 'Tirar este vídeo da pergunta', 'aria-label': 'Tirar este vídeo', onclick: () => { videos.splice(i, 1); renderVideos(); } }, I('x', 13))),
                    h('div', { class: 'linha', style: { gap: '8px' } }, h('div', { class: 'grow', style: { minWidth: '200px' } }, url), bPrev),
                    estado, prevBox)));
            });
            btnAdd.disabled = videos.length >= L.MAX_VIDEOS;
        }
        const btnAdd = h('button', { class: 'btn', type: 'button', onclick: () => { videos.push({ titulo: '', url: '' }); renderVideos(); const ins = listaV.querySelectorAll('input.mono'); if (ins.length) ins[ins.length - 1].focus(); } }, I('plus', 15), 'Adicionar vídeo');
        btnEnviar.addEventListener('click', () => entrada.click());
        entrada.addEventListener('change', async () => {
            const arq = entrada.files && entrada.files[0]; entrada.value = ''; if (!arq) return;
            const erro = L.validarArquivoVideo(arq); if (erro) { ADM.ui.toast(erro, 'wa', 9000); return; }
            if (videos.length >= L.MAX_VIDEOS) { ADM.ui.toast('No máximo ' + L.MAX_VIDEOS + ' vídeos por pergunta.', 'wa'); return; }
            btnEnviar.disabled = true; btnAdd.disabled = true; estadoEnvio.textContent = 'Enviando ' + (arq.size / 1048576).toFixed(1).replace('.', ',') + ' MB… pode levar alguns minutos; não feche esta janela.';
            try {
                const caminho = 'faq/' + Date.now() + '-' + L.slugArquivo(arq.name);
                const r = await ADM.sb.storage.from(L.BUCKET_VIDEOS).upload(caminho, arq, { contentType: arq.type || 'video/mp4', cacheControl: '31536000', upsert: false });
                if (r.error) throw r.error;
                const pub = ADM.sb.storage.from(L.BUCKET_VIDEOS).getPublicUrl(caminho); const url = pub && pub.data && pub.data.publicUrl;
                if (!url) throw new Error('O Supabase não devolveu o endereço do arquivo.');
                videos.push({ titulo: arq.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim().slice(0, 120), url }); renderVideos();
                estadoEnvio.textContent = '✔ Vídeo enviado e anexado.'; ADM.ui.toast('Vídeo enviado. Salve a pergunta para guardar o anexo.', 'ok', 5000);
            } catch (e) {
                estadoEnvio.textContent = '';
                const m = String((e && (e.message || e.error)) || e), cod = String((e && (e.statusCode || e.status)) || '');
                if (/bucket not found|not found/i.test(m) || cod === '404') ADM.ui.toast('O envio de arquivos ainda não foi ativado no banco. Rode o arquivo sql/' + SQL_VIDEOS + ' no SQL Editor do Supabase (ou use um link do YouTube/Drive).', 'wa', 12000);
                else if (/row-level security|unauthorized|403|violates|permission/i.test(m) || cod === '403' || cod === '401') ADM.ui.toast('O banco recusou o envio (sem permissão). No modo seguro, entre como administrador; e confira se o sql/' + SQL_VIDEOS + ' foi rodado depois do 03.', 'er', 12000);
                else if (/too large|exceed|413|size/i.test(m) || cod === '413') ADM.ui.toast('O arquivo passa do limite do plano (50 MB no gratuito). Use o YouTube ("não listado") ou o Google Drive e cole o link.', 'er', 12000);
                else ADM.ui.toast('Não consegui enviar: ' + ADM.db.erroTexto(e), 'er', 10000);
            }
            btnEnviar.disabled = false; btnAdd.disabled = videos.length >= L.MAX_VIDEOS;
        });
        renderVideos();

        const ajudaVideos = h('details', { class: 'cartao sanfona' }, h('summary', { style: { padding: '10px 14px', cursor: 'pointer', fontWeight: 700 } }, 'Onde guardar os vídeos? (clique para ver)'),
            h('div', { class: 'cartao-corpo', style: { paddingTop: 0 } },
                h('div', null, h('b', null, 'YouTube (recomendado). '), 'Envie como ', h('b', null, '“Não listado”'), ' no seu canal e cole o link. Sem limite de tamanho, toca em qualquer aparelho e só quem tem o link acha. (Pode marcar o tempo: …?t=1m30s.)'),
                h('div', null, h('b', null, 'Google Drive. '), 'Envie para o seu Drive, botão direito › Compartilhar › ', h('b', null, '“Qualquer pessoa com o link”'), ' › Copiar link. Se não estiver assim, a pessoa vê “sem permissão”. Cole o link do ', h('b', null, 'arquivo'), ' (não o da pasta).'),
                h('div', null, h('b', null, 'Vimeo ou Loom. '), 'Cole o link de compartilhamento (o Loom é bom para gravar a tela na hora).'),
                h('div', null, h('b', null, 'Arquivo próprio. '), 'O botão “Enviar vídeo do computador” guarda o arquivo no Supabase (até 50 MB no plano gratuito; precisa do sql/' + SQL_VIDEOS + '). Também vale qualquer link direto que termine em .mp4/.webm.'),
                h('div', { class: 'dica' }, 'Outros sites (OneDrive, Dropbox…) são aceitos como link: no FAQ aparece o botão “Abrir vídeo”, que abre em outra guia.')));

        const corpo = [
            origemBox,
            f.pergunta.el,
            h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Resposta (Markdown)'), ta),
            h('details', { class: 'cartao sanfona', open: !!txt(base.resposta) }, h('summary', { style: { padding: '9px 14px', cursor: 'pointer', fontWeight: 700 } }, 'Prévia da resposta'), h('div', { class: 'cartao-corpo', style: { paddingTop: 0 } }, prev)),
            h('div', { class: 'g2' }, f.categoria.el, f.caminho.el),
            h('div', { class: 'g2' }, f.chaves.el, f.ordem.el),
            h('div', { class: 'rot-mini' }, 'Vídeos'),
            ajudaVideos, listaV,
            h('div', { class: 'linha' }, btnAdd, btnEnviar, entrada, estadoEnvio),
            h('label', { class: 'marcar', style: { marginTop: '4px' } }, chkPub, h('span', null, 'Publicada (aparece na página do FAQ)')),
            lista,
        ];
        ADM.ui.modal({ titulo: novo ? 'Nova pergunta' : 'Editar pergunta #' + it.id, largura: 900, fecharFora: false, corpo,
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, { rotulo: novo ? 'Criar pergunta' : 'Salvar', tipo: 'primario', fechar: false, acao: async (btn, api) => {
                const pergunta = f.pergunta.i.value.trim();
                if (pergunta.length < 5) { ADM.ui.toast('Escreva a pergunta (pelo menos 5 letras).', 'wa'); f.pergunta.i.focus(); return false; }
                const prep = L.prepararVideos(videos);
                if (!prep.ok) { const e0 = prep.erros[0]; ADM.ui.toast((e0.indice >= 0 ? 'Vídeo ' + (e0.indice + 1) + ': ' : '') + e0.erro, 'wa', 9000); const ins = listaV.querySelectorAll('input.mono'); if (e0.indice >= 0 && ins[e0.indice]) ins[e0.indice].focus(); return false; }
                const resposta = ta.value.trim();
                if (!resposta && !prep.videos.length) { ADM.ui.toast('Escreva a resposta ou anexe um vídeo.', 'wa'); ta.focus(); return false; }
                const ordem = Number(f.ordem.i.value); if (!Number.isFinite(ordem) || Math.abs(ordem) > 100000) { ADM.ui.toast('A ordem precisa ser um número (0 é o padrão).', 'wa'); f.ordem.i.focus(); return false; }
                const v = { pergunta, resposta: resposta || null, categoria: f.categoria.i.value.trim() || null, caminho_menu: f.caminho.i.value.trim() || null, palavras_chave: f.chaves.i.value.trim() || null, videos: prep.videos, publicado: chkPub.checked, ordem: Math.round(ordem) };
                try {
                    if (novo) { v.origem = base.origem || null; v.origem_id = base.origem_id != null ? base.origem_id : null; v.criado_por = ADM.auth.usuario(); const r = await ADM.sb.from('faq_itens').insert(v).select('*'); ADM.db.exigirAfetadas(r); E.itens.unshift(r.data[0]); }
                    else { const r = await ADM.sb.from('faq_itens').update(v).eq('id', it.id).select('*'); ADM.db.exigirAfetadas(r); const i = E.itens.findIndex(x => x.id === it.id); if (i >= 0) E.itens[i] = r.data[0]; }
                } catch (e) {
                    if (ehDuplicado(e)) { const ja = existentePorOrigem(v.origem, v.origem_id); ADM.ui.toast('Esse conteúdo já está no FAQ' + (ja ? ' (pergunta #' + ja.id + ')' : '') + '.', 'wa', 8000); return false; }
                    throw e;
                }
                atualizarCategoriasDoFiltro(); renderTabela(); ADM.ui.toast(novo ? 'Pergunta criada' + (v.publicado ? ' e publicada.' : ' como rascunho.') : 'Pergunta salva.', 'ok', 3200); api.fechar();
            } }] });
    }

    /* ───────────── importar do banco de dados ───────────── */
    async function carregarFonte(qual) {
        if (E.fonte[qual]) return E.fonte[qual];
        if (qual === 'banco') E.fonte.banco = await ADM.db.todas((a, b) => ADM.sb.from('BancoDados').select('id, titulo, categoria').order('id', { ascending: true }).range(a, b));
        else E.fonte.rapidas = await ADM.db.todas((a, b) => ADM.sb.from('respostas_rapidas').select('id, pergunta, categoria, ativo').order('id', { ascending: true }).range(a, b));
        return E.fonte[qual];
    }
    function importar() {
        const estado = { qual: 'banco', texto: '', categoria: '', soNovos: true, marcados: new Map(), publicar: false };
        const corpo = h('div', { class: 'pilha', style: { gap: '10px' } });
        const lista = h('div', { class: 'trein-itens', style: { maxHeight: '360px', overflow: 'auto' } });
        const contador = h('span', { class: 'mu' });
        let linhasFonte = [];
        const origemDe = () => estado.qual === 'banco' ? 'banco' : 'resposta_rapida';
        const tituloDe = r => estado.qual === 'banco' ? r.titulo : r.pergunta;
        const abas = h('div', { class: 'abas-mini', role: 'group', 'aria-label': 'De onde importar' }, [['banco', '🗄 Artigos do banco de dados'], ['rapidas', '⚡ Respostas rápidas']].map(([q, t]) => h('button', { type: 'button', 'aria-pressed': String(q === estado.qual), dataset: { q }, onclick: async () => { estado.qual = q; estado.categoria = ''; estado.marcados.clear(); abas.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.q === q))); await trocar(); } }, t)));
        const busca = h('input', { type: 'search', placeholder: 'Buscar pelo título…', 'aria-label': 'Buscar' });
        const selCat = h('select', { 'aria-label': 'Categoria' });
        const chkNovos = h('input', { type: 'checkbox', checked: true });
        chkNovos.addEventListener('change', () => { estado.soNovos = chkNovos.checked; desenhar(); });
        const chkPub = h('input', { type: 'checkbox' }); chkPub.addEventListener('change', () => { estado.publicar = chkPub.checked; });
        busca.addEventListener('input', debounce(() => { estado.texto = busca.value; desenhar(); }, 160)); selCat.addEventListener('change', () => { estado.categoria = selCat.value; desenhar(); });
        async function trocar() {
            limpar(lista).appendChild(carregandoEl());
            try { linhasFonte = (await carregarFonte(estado.qual)).filter(r => estado.qual === 'banco' || r.ativo !== false); }
            catch (e) { limpar(lista).appendChild(ADM.ui.aviso('er', ADM.db.erroTexto(e))); return; }
            const cats = Array.from(new Set(linhasFonte.map(r => txt(r.categoria)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            juntar(limpar(selCat), h('option', { value: '' }, 'Todas as categorias'), cats.map(c => h('option', { value: c }, c))); selCat.value = '';
            desenhar();
        }
        function desenhar() {
            const palavras = L.chaveBusca(estado.texto).split(' ').filter(Boolean);
            const filtradas = linhasFonte.filter(r => (!estado.categoria || txt(r.categoria) === estado.categoria) && (!palavras.length || palavras.every(p => L.chaveBusca(tituloDe(r)).includes(p))) && (!estado.soNovos || !existentePorOrigem(origemDe(), r.id)));
            limpar(lista);
            if (!filtradas.length) lista.appendChild(h('div', { class: 'dica', style: { padding: '8px 2px' } }, linhasFonte.length ? 'Nada encontrado (ou tudo o que combina já está no FAQ).' : 'Nada para importar.'));
            filtradas.slice(0, 100).forEach(r => {
                const ja = existentePorOrigem(origemDe(), r.id);
                const i = h('input', { type: 'checkbox', checked: estado.marcados.has(r.id) || false, disabled: !!ja });
                i.addEventListener('change', () => { if (i.checked) estado.marcados.set(r.id, tituloDe(r)); else estado.marcados.delete(r.id); contar(); });
                lista.appendChild(h('label', { class: 'trein-item marcar' }, i, h('span', { class: 'mono mu' }, '#' + r.id), h('span', { class: 'grow trein-t' }, tituloDe(r)), txt(r.categoria) ? h('span', { class: 'sel' }, txt(r.categoria)) : null, ja ? h('span', { class: 'sel ok', title: 'Pergunta #' + ja.id + ' do FAQ' }, 'já no FAQ #' + ja.id) : null));
            });
            if (filtradas.length > 100) lista.appendChild(h('div', { class: 'dica', style: { padding: '6px 2px' } }, 'Mostrando 100 de ' + filtradas.length + '. Refine a busca.'));
            contar();
        }
        const contar = () => { contador.textContent = estado.marcados.size + ' selecionado(s)'; };
        corpo.append(h('div', { class: 'dica' }, 'Escolha o que levar para o FAQ. Cada item vira uma pergunta em ', h('b', null, 'rascunho'), ' (com o texto, a categoria e o caminho no menu já preenchidos) — depois você anexa o vídeo e publica. Quem já está no FAQ aparece marcado e não duplica.'),
            abas, h('div', { class: 'linha' }, h('div', { class: 'grow', style: { minWidth: '200px' } }, busca), selCat), h('label', { class: 'marcar' }, chkNovos, h('span', null, 'Esconder o que já está no FAQ')), lista,
            h('div', { class: 'linha' }, contador, h('span', { class: 'grow' }), h('label', { class: 'marcar' }, chkPub, h('span', null, 'Já publicar ao importar'))));
        ADM.ui.modal({ titulo: 'Importar do banco de dados para o FAQ', largura: 820, fecharFora: false, corpo,
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, { rotulo: 'Levar para o FAQ', tipo: 'primario', fechar: false, acao: async (btn, api) => {
                if (!estado.marcados.size) { ADM.ui.toast('Marque pelo menos um item.', 'wa'); return false; }
                const criadas = await levar(origemDe(), Array.from(estado.marcados.keys()), estado.publicar);
                if (criadas === null) return false;
                api.fechar();
                if (criadas.length === 1) { ADM.ui.toast('Pergunta criada como rascunho — anexe o vídeo e publique.', 'ok', 5000); editar(criadas[0]); }
                else ADM.ui.toast(criadas.length + ' pergunta(s) criada(s)' + (estado.publicar ? ' e publicada(s).' : ' como rascunho — abra cada uma para anexar o vídeo e publique.'), 'ok', 6000);
            } }] });
        trocar();
    }
    // busca os itens completos na origem, converte e cria no FAQ. Devolve a lista de linhas criadas (ou null se falhou)
    async function levar(origem, ids, publicar) {
        const novos = ids.filter(id => !existentePorOrigem(origem, id)); if (!novos.length) { ADM.ui.toast('Esses itens já estão no FAQ.', 'wa'); return null; }
        try {
            let linhas;
            if (origem === 'banco') {
                let r = await ADM.sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria, caminho_menu').in('id', novos);
                if (r.error && ADM.db.ehColunaAusente(r.error)) r = await ADM.sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria').in('id', novos);
                if (r.error) throw r.error; linhas = (r.data || []).map(L.itemDeBanco);
            } else {
                const r = await ADM.sb.from('respostas_rapidas').select('id, pergunta, resposta, categoria, variantes').in('id', novos);
                if (r.error) throw r.error; linhas = (r.data || []).map(L.itemDeRespostaRapida);
            }
            linhas = linhas.filter(x => x.pergunta);
            if (!linhas.length) { ADM.ui.toast('Não encontrei esses itens no banco de dados.', 'er'); return null; }
            const payload = linhas.map(x => Object.assign({ videos: [], publicado: !!publicar && !!txt(x.resposta), ordem: 0, criado_por: ADM.auth.usuario() }, x));
            let criadas = [];
            const r = await ADM.sb.from('faq_itens').insert(payload).select('*');
            if (r.error && ehDuplicado(r.error)) {          // alguém levou um deles no meio tempo: tenta um por um e pula os repetidos
                for (const p of payload) { const um = await ADM.sb.from('faq_itens').insert(p).select('*'); if (!um.error && um.data && um.data[0]) criadas.push(um.data[0]); else if (um.error && !ehDuplicado(um.error)) throw um.error; }
            } else { ADM.db.exigirAfetadas(r); criadas = r.data; }
            criadas.slice().reverse().forEach(x => E.itens.unshift(x));
            atualizarCategoriasDoFiltro(); renderTabela();
            return criadas;
        } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); return null; }
    }
    // entrada vinda de outras abas ("Levar para o FAQ" em Banco de dados / Respostas rápidas): abre o editor já preenchido
    async function levarUm(origem, id) {
        while (E.carregando) await new Promise(r => setTimeout(r, 120));
        if (!E.carregou) await carregar();
        if (E.semSQL) return;
        const ja = existentePorOrigem(origem, id);
        if (ja) { ADM.ui.toast('Esse conteúdo já está no FAQ (pergunta #' + ja.id + ') — abrindo para você anexar o vídeo.', 'in', 5000); editar(ja); return; }
        try { editar(null, await buscarOrigem(origem, id)); } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 8000); }
    }

    /* ───────────── casca ───────────── */
    function atualizarCategoriasDoFiltro() {
        if (!R.selCat) return;
        const atual = E.f.categoria;
        juntar(limpar(R.selCat), h('option', { value: '' }, 'Todas as categorias'), h('option', { value: '__sem' }, '(sem categoria)'), L.categorias(E.itens).map(c => h('option', { value: c.nome }, c.nome + ' (' + c.total + ')')));
        R.selCat.value = (atual === '__sem' || L.categorias(E.itens).some(c => c.nome === atual)) ? atual : ''; E.f.categoria = R.selCat.value;
    }
    function renderCorpo() {
        if (!R.corpo) return;
        const c = limpar(R.corpo);
        if (!E.carregou) { c.appendChild(carregandoEl()); return; }
        if (E.semSQL) {
            c.appendChild(ADM.ui.aviso('wa', h('b', null, 'O FAQ ainda não foi instalado no banco.'), h('br'), 'Rode o arquivo sql/' + SQL + ' uma vez no SQL Editor do Supabase (Dashboard → SQL Editor → New query → colar → Run) e clique em Atualizar. Ele só cria uma tabela nova — nada existente é alterado.', h('div', { style: { marginTop: '8px' } }, ADM.ui.sqlAjuda(SQL))));
            return;
        }
        if (E.erro) { c.appendChild(ADM.ui.aviso('er', h('b', null, 'Não consegui carregar o FAQ.'), h('br'), ADM.db.erroTexto(E.erro))); return; }
        const pub = E.itens.filter(i => i.publicado).length, comVideo = E.itens.filter(i => videosDe(i).length).length;
        c.appendChild(h('div', { class: 'kpis' },
            h('div', { class: 'kpi' }, h('span', { class: 'r' }, 'Perguntas'), h('span', { class: 'v' }, ADM.fmt.num(E.itens.length)), h('span', { class: 's' }, pub + ' publicada(s) · ' + (E.itens.length - pub) + ' rascunho(s)')),
            h('div', { class: 'kpi ok' }, h('span', { class: 'r' }, 'Com vídeo'), h('span', { class: 'v' }, ADM.fmt.num(comVideo)), h('span', { class: 's' }, E.itens.length - comVideo + ' sem vídeo')),
            h('div', { class: 'kpi in' }, h('span', { class: 'r' }, 'Categorias'), h('span', { class: 'v' }, ADM.fmt.num(L.categorias(E.itens).length)), h('span', { class: 's' }, 'na página do FAQ'))));
        c.appendChild(h('div', { style: { height: '12px' } }));
        c.appendChild(h('details', { class: 'cartao sanfona' }, h('summary', { style: { padding: '11px 15px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', fontWeight: 700 } }, I('info', 16), 'Como funciona (clique para ver)'),
            h('div', { class: 'cartao-corpo', style: { paddingTop: 0 } },
                h('div', null, h('b', null, '1. Leve do banco de dados: '), 'o botão “Importar do banco de dados” traz artigos e respostas rápidas já prontos (texto, categoria, caminho no menu) como rascunho. Também há o botão “Levar para o FAQ” nas abas Banco de dados e Respostas rápidas.'),
                h('div', null, h('b', null, '2. Anexe o vídeo: '), 'abra a pergunta e cole o link (YouTube “não listado”, Google Drive, Vimeo, Loom ou .mp4) — ou envie o arquivo do computador. A prévia mostra como vai ficar.'),
                h('div', null, h('b', null, '3. Publique: '), 'a chave “Publicada” coloca na página ', h('a', { href: linkFaq(), target: '_blank', rel: 'noopener' }, linkFaq() || 'faq.html'), '. Cada pergunta tem link próprio (ícone de copiar) para você mandar para o cliente.'))));
        c.appendChild(h('div', { style: { height: '12px' } }));
        R.lote = h('div', { class: 'linha cartao', style: { padding: '8px 12px', marginBottom: '10px', gap: '8px' }, hidden: true });
        R.tabela = h('div');
        c.append(R.lote, R.tabela);
        renderTabela();
    }

    ADM.registrarAba({
        id: 'faq', titulo: 'FAQ', icone: 'life', ordem: 36,
        descricao: 'Monte o FAQ (perguntas, respostas e vídeos) que fica na página faq.html: leve artigos e respostas rápidas do banco de dados, anexe o vídeo que mostra o passo a passo e publique.',
        montar(ctx) {
            const busca = h('input', { type: 'search', placeholder: 'Buscar pergunta, resposta, categoria…', 'aria-label': 'Buscar' });
            busca.addEventListener('input', debounce(() => { E.f.texto = busca.value; E.mostrando = MAX_LINHAS; if (R.tabela) renderTabela(); }, 200));
            R.selCat = h('select', { 'aria-label': 'Categoria' }, h('option', { value: '' }, 'Todas as categorias'));
            R.selCat.addEventListener('change', () => { E.f.categoria = R.selCat.value; E.mostrando = MAX_LINHAS; if (R.tabela) renderTabela(); });
            const sel = (rot, opcoes, chave) => { const s = h('select', { 'aria-label': rot }, opcoes.map(([v, t]) => h('option', { value: v }, t))); s.value = E.f[chave]; s.addEventListener('change', () => { E.f[chave] = s.value; E.mostrando = MAX_LINHAS; if (R.tabela) renderTabela(); }); return s; };
            R.contagem = h('span', { class: 'mu nw' });
            ctx.barra.append(busca, R.selCat, sel('Situação', [['todas', 'Todas'], ['publicadas', 'Só publicadas'], ['rascunhos', 'Só rascunhos']], 'estado'), sel('Vídeo', [['todos', 'Com e sem vídeo'], ['com', 'Só com vídeo'], ['sem', 'Só sem vídeo']], 'video'), R.contagem, h('span', { class: 'grow' }),
                h('a', { class: 'btn', href: linkFaq(), target: '_blank', rel: 'noopener', title: 'Abre a página pública do FAQ em outra guia' }, I('ext', 15), 'Abrir o FAQ'),
                h('button', { class: 'btn icone', type: 'button', title: 'Atualizar', 'aria-label': 'Atualizar', onclick: e => ADM.ui.ocupado(e.currentTarget, carregar) }, I('refresh', 17)),
                h('button', { class: 'btn', type: 'button', onclick: () => importar() }, I('database', 15), 'Importar do banco de dados'),
                h('button', { class: 'btn primario', type: 'button', onclick: () => editar(null) }, I('plus', 16), 'Nova pergunta'));
            R.corpo = ctx.corpo; atualizarCategoriasDoFiltro(); renderCorpo();
        },
        abrir(op) {
            const depois = () => {
                if (op && op.banco != null) levarUm('banco', Number(op.banco));
                else if (op && op.resposta != null) levarUm('resposta_rapida', Number(op.resposta));
                else if (op && op.importar) importar();
            };
            if (!E.carregou) carregar().then(depois); else depois();
        },
    });
})();
