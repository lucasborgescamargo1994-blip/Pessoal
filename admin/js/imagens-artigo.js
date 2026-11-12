/* admin/js/imagens-artigo.js — "Imagens do procedimento" dos artigos da base de conhecimento (v28.39).
   Um artigo (tabela BancoDados) pode ter prints do passo a passo: coluna `imagens` (sql/09_bancodados_imagens.sql), arquivos no bucket público "bancodados-imagens" do Supabase. Quando a IA responde usando
   o artigo, o chat mostra as imagens abaixo do texto (js/app/imagens-banco-ui.js). As regras comuns (URL válida, lista, escolha) estão em js/core/imagens-banco.js.

   Como se usa (aba Banco de dados › editar, Revisão › "Corrigir artigo" e "Salvar no banco de dados"): COLE o print (Win+Shift+S e Ctrl+V), ARRASTE o arquivo ou clique em "Adicionar imagem". Antes de enviar,
   o painel reduz a imagem (largura máxima 1600 px) e a comprime em WebP (costuma ficar em 80–300 KB; o bucket aceita até 5 MB). Cada imagem pode ter uma legenda; dá para mudar a ordem e tirar.

   Estado (`novoEstado`): quem abre o formulário guarda um objeto { itens, novos, removidos, salvo } e o entrega ao editor — assim a lista sobrevive quando a tela é redesenhada.
     • itens     = [{ url, legenda }] o que vai ser gravado;  • novos = URLs enviadas nesta edição e ainda não salvas (se a janela for cancelada, são apagadas do armazenamento);
     • removidos = URLs que JÁ estavam gravadas e foram tiradas (só são apagadas do armazenamento DEPOIS que o artigo for salvo).
   Chamadas de quem usa: valorParaGravar(estado) · mudou(estado, original) · aposSalvar(estado) · descartar(estado). */
'use strict';
ADM.imagensArtigo = (() => {
    const B = BancoImg;
    const BUCKET = B.BUCKET, SQL = '09_bancodados_imagens.sql';
    const TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const MAX_ORIGINAL = 25 * 1048576, MAX_ENVIO = 5 * 1048576, MAX_LARGURA = 1600;
    const erroLocal = m => Object.assign(new Error(m), { local: true });   // erro daqui (formato, tamanho…): a mensagem já é para a tela
    const kb = n => n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB';

    /* ───────────── estado e valor gravado ───────────── */
    const novoEstado = valor => ({ itens: B.lista(valor).map(i => ({ url: i.url, legenda: i.legenda })), novos: [], removidos: [], salvo: false, original: B.lista(valor) });
    // o que vai para a coluna: lista (só com legenda quando houver) ou null (sem imagens: a coluna fica vazia)
    function valorParaGravar(estado) {
        const l = (estado.itens || []).map(i => { const o = { url: i.url }; const lg = String(i.legenda || '').replace(/\s+/g, ' ').trim().slice(0, 200); if (lg) o.legenda = lg; return o; });
        return l.length ? l : null;
    }
    const comoTexto = v => JSON.stringify((B.lista(v) || []).map(i => i.legenda ? { url: i.url, legenda: i.legenda } : { url: i.url }));
    const mudou = (estado, original) => comoTexto(valorParaGravar(estado)) !== comoTexto(original !== undefined ? original : estado.original);

    /* ───────────── armazenamento ───────────── */
    async function apagar(urls) {
        const caminhos = (urls || []).map(B.caminhoNoBucket).filter(Boolean);
        if (!caminhos.length) return 0;
        try { const r = await ADM.sb.storage.from(BUCKET).remove(caminhos); if (r.error) throw r.error; return caminhos.length; }
        catch (e) { console.warn('[admin] não consegui apagar arquivos de imagem do armazenamento (ficam lá, sem uso):', e); return 0; }
    }
    // depois que o artigo foi salvo: apaga do armazenamento o que o artigo deixou de usar; as novas passam a ser "do artigo"
    async function aposSalvar(estado) {
        estado.salvo = true;
        const sobrou = new Set((estado.itens || []).map(i => i.url));
        const apagar_ = (estado.removidos || []).filter(u => !sobrou.has(u));
        estado.removidos = []; estado.novos = []; estado.original = B.lista(valorParaGravar(estado));
        if (apagar_.length) await apagar(apagar_);
    }
    // janela cancelada/fechada sem salvar: o que foi enviado nesta edição não tem dono — sai do armazenamento
    async function descartar(estado) {
        if (!estado || estado.salvo) return;
        const novos = (estado.novos || []).slice(); estado.novos = [];
        if (novos.length) await apagar(novos);
    }
    // artigo excluído: leva as imagens dele
    const apagarDoArtigo = valor => apagar(B.lista(valor).map(i => i.url));

    function mensagemDeErro(e) {
        const m = String((e && (e.message || e.error)) || e), cod = String((e && (e.statusCode || e.status)) || '');
        if (/bucket not found|not found/i.test(m) || cod === '404') return 'O envio de imagens ainda não foi ativado no banco. Rode o arquivo sql/' + SQL + ' no SQL Editor do Supabase (a aba Sistema tem o botão de copiar) e tente de novo.';
        if (/row-level security|unauthorized|403|violates|permission/i.test(m) || cod === '403' || cod === '401') return 'O banco recusou o envio (sem permissão). No modo seguro, entre como administrador; e confira se o sql/' + SQL + ' foi rodado depois do 03.';
        if (/mime|not supported|invalid.*type/i.test(m)) return 'O banco não aceita este tipo de arquivo. Use PNG, JPG, WebP ou GIF.';
        if (/too large|exceed|413|size/i.test(m) || cod === '413') return 'O arquivo passa do limite do bucket (5 MB). Tire um print menor (só a parte da tela que importa).';
        return 'Não consegui enviar a imagem: ' + ADM.db.erroTexto(e);
    }

    /* ───────────── preparar a imagem: abrir, reduzir e comprimir ───────────── */
    async function abrirImagem(arq) {
        if (window.createImageBitmap) { try { return await createImageBitmap(arq); } catch (e) { /* tenta pelo <img> */ } }
        return await new Promise((res, rej) => { const url = URL.createObjectURL(arq), im = new Image(); im.onload = () => { URL.revokeObjectURL(url); res(im); }; im.onerror = () => { URL.revokeObjectURL(url); rej(erroLocal('Não consegui abrir esta imagem (arquivo danificado?).')); }; im.src = url; });
    }
    const paraBlob = (canvas, tipo, q) => new Promise(res => { try { canvas.toBlob(b => res(b), tipo, q); } catch (e) { res(null); } });
    // Devolve { blob, tipo, ext, largura, altura, original } — ou lança um Error com a mensagem para a tela
    async function preparar(arq) {
        const tipo = String(arq.type || '').toLowerCase();
        if (!TIPOS.includes(tipo)) throw erroLocal('Formato não aceito (' + (tipo || 'desconhecido') + '). Use PNG, JPG, WebP ou GIF.');
        if (arq.size > MAX_ORIGINAL) throw erroLocal('A imagem é grande demais (' + kb(arq.size) + '). Tire um print menor.');
        if (tipo === 'image/gif') {   // GIF (animado) não é recomprimido
            if (arq.size > MAX_ENVIO) throw erroLocal('O GIF passa de 5 MB (' + kb(arq.size) + '). Use um print parado ou um GIF menor.');
            return { blob: arq, tipo, ext: 'gif', largura: 0, altura: 0, original: arq.size };
        }
        const bmp = await abrirImagem(arq), w0 = bmp.width, h0 = bmp.height;
        if (!w0 || !h0) throw erroLocal('Esta imagem não tem tamanho (arquivo danificado?).');
        let escala = Math.min(1, MAX_LARGURA / w0), q = 0.86, melhor = null;
        for (let tentativa = 0; tentativa < 4; tentativa++) {
            const cw = Math.max(1, Math.round(w0 * escala)), ch = Math.max(1, Math.round(h0 * escala));
            const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
            const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
            cx.drawImage(bmp, 0, 0, cw, ch);
            let blob = await paraBlob(cv, 'image/webp', q), t = 'image/webp', ext = 'webp';
            if (!blob || blob.type !== 'image/webp') {   // navegador sem WebP: JPEG sobre fundo branco (JPEG não tem transparência)
                const cv2 = document.createElement('canvas'); cv2.width = cw; cv2.height = ch; const c2 = cv2.getContext('2d'); c2.fillStyle = '#fff'; c2.fillRect(0, 0, cw, ch); c2.drawImage(bmp, 0, 0, cw, ch);
                blob = await paraBlob(cv2, 'image/jpeg', Math.min(q + 0.03, 0.92)); t = 'image/jpeg'; ext = 'jpg';
            }
            if (!blob) throw erroLocal('O navegador não conseguiu comprimir esta imagem.');
            melhor = { blob, tipo: t, ext, largura: cw, altura: ch, original: arq.size };
            // o arquivo original, se já é pequeno e não precisou reduzir, vale mais que recomprimir (print em PNG simples costuma ser menor que o WebP)
            if (escala === 1 && arq.size <= blob.size && arq.size <= MAX_ENVIO) { melhor = { blob: arq, tipo, ext: tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg', largura: cw, altura: ch, original: arq.size }; }
            if (melhor.blob.size <= MAX_ENVIO) break;
            q = Math.max(0.6, q - 0.12); escala *= 0.82;
        }
        if (bmp.close) { try { bmp.close(); } catch (e) { /* ok */ } }
        if (melhor.blob.size > MAX_ENVIO) throw erroLocal('Mesmo comprimida a imagem passa de 5 MB (' + kb(melhor.blob.size) + '). Tire um print de uma área menor.');
        return melhor;
    }
    // envia para o armazenamento e devolve o endereço público
    async function enviar(prep, pasta) {
        const nome = (pasta || 'novos') + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + prep.ext;
        const r = await ADM.sb.storage.from(BUCKET).upload(nome, prep.blob, { contentType: prep.tipo, cacheControl: '31536000', upsert: false });
        if (r.error) throw r.error;
        const pub = ADM.sb.storage.from(BUCKET).getPublicUrl(nome), url = pub && pub.data && pub.data.publicUrl;
        if (!url || !B.urlValida(url)) throw new Error('O Supabase não devolveu um endereço público válido para o arquivo.');
        return url;
    }
    return { BUCKET, SQL, TIPOS, novoEstado, valorParaGravar, mudou, aposSalvar, descartar, apagar, apagarDoArtigo, preparar, enviar, mensagemDeErro, kb };
})();

/* ───────────── o editor (campo do formulário) ─────────────
   op: { estado, pasta ('artigo-12' ou 'novos'), desabilitado (a coluna não existe: mostra o aviso), aoMudar() }
   Devolve { el, atualizar() }. A lista sobrevive a redesenhos porque mora em op.estado. */
ADM.editorImagensArtigo = function (op) {
    const A = ADM.imagensArtigo, B = BancoImg, est = op.estado;
    const raiz = h('div', { class: 'imgs-art', tabindex: -1 });
    const lista = h('div', { class: 'imgs-lista' }), estadoEnvio = h('div', { class: 'imgs-status', 'aria-live': 'polite' });
    const entrada = h('input', { type: 'file', accept: A.TIPOS.join(','), multiple: true, hidden: true });
    let ocupado = false;
    const avisa = () => { if (op.aoMudar) { try { op.aoMudar(est); } catch (e) { /* ok */ } } };

    if (op.desabilitado) {
        raiz.append(h('div', { class: 'rot-mini' }, 'Imagens do procedimento'),
            ADM.ui.aviso('wa', h('b', null, 'Falta uma coluna no banco de dados. '), 'Para guardar imagens nos artigos, rode o arquivo ', h('code', null, 'sql/' + A.SQL), ' uma vez no SQL Editor do Supabase (a aba Sistema tem o botão de copiar). Enquanto isso o artigo salva normalmente, só sem imagens. ', ADM.ui.sqlAjuda(A.SQL)));
        return { el: raiz, atualizar() { /* sem imagens */ } };
    }

    function desenhar() {
        limpar(lista);
        est.itens.forEach((it, i) => {
            const leg = h('input', { type: 'text', maxlength: 200, placeholder: 'Legenda (opcional) — ex.: Tela de Parâmetros', 'aria-label': 'Legenda da imagem ' + (i + 1) }); leg.value = it.legenda || '';
            leg.addEventListener('input', () => { it.legenda = leg.value; avisa(); });
            const foto = h('img', { src: it.url, alt: 'Imagem ' + (i + 1) + ' do procedimento', loading: 'lazy' });
            foto.addEventListener('error', () => { foto.replaceWith(h('div', { class: 'imgs-quebrada' }, 'Imagem indisponível')); });
            lista.appendChild(h('div', { class: 'imgs-item' },
                h('a', { class: 'imgs-foto', href: it.url, target: '_blank', rel: 'noopener noreferrer', title: 'Abrir a imagem em outra guia' }, foto),
                h('div', { class: 'imgs-lado' }, leg,
                    h('div', { class: 'linha', style: { gap: '4px' } },
                        h('span', { class: 'mono mu' }, String(i + 1) + '/' + est.itens.length),
                        h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Mover para antes', 'aria-label': 'Mover para antes', disabled: i === 0, onclick: () => { est.itens.splice(i - 1, 0, est.itens.splice(i, 1)[0]); desenhar(); avisa(); } }, I('up', 13)),
                        h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Mover para depois', 'aria-label': 'Mover para depois', disabled: i === est.itens.length - 1, onclick: () => { est.itens.splice(i + 1, 0, est.itens.splice(i, 1)[0]); desenhar(); avisa(); } }, I('down', 13)),
                        h('span', { class: 'grow' }),
                        h('button', { class: 'btn peq fantasma perigo', type: 'button', title: 'Tirar esta imagem do artigo', onclick: () => tirar(i) }, I('trash', 13), 'Tirar')))));
        });
        if (!est.itens.length) lista.appendChild(h('div', { class: 'dica' }, 'Nenhuma imagem neste artigo.'));
        btnAdd.disabled = ocupado || est.itens.length >= B.MAX_POR_ARTIGO;
        btnAdd.title = est.itens.length >= B.MAX_POR_ARTIGO ? 'No máximo ' + B.MAX_POR_ARTIGO + ' imagens por artigo.' : '';
    }
    function tirar(i) {
        const [it] = est.itens.splice(i, 1);
        const k = est.novos.indexOf(it.url);
        if (k >= 0) { est.novos.splice(k, 1); A.apagar([it.url]); }   // enviada nesta edição e nunca salva: sai do armazenamento já
        else est.removidos.push(it.url);                                // já estava gravada no artigo: só sai do armazenamento depois que o artigo for salvo
        desenhar(); avisa();
    }

    async function adicionar(arquivos) {
        const lote = Array.from(arquivos || []).filter(a => a && /^image\//i.test(a.type || ''));
        if (!lote.length) { ADM.ui.toast('Isto não é uma imagem. Cole um print (Ctrl+V), arraste o arquivo ou escolha uma imagem do computador.', 'wa'); return; }
        if (ocupado) { ADM.ui.toast('Aguarde: ainda estou enviando a imagem anterior.', 'wa'); return; }
        ocupado = true; btnAdd.disabled = true;
        let feitas = 0;
        try {
            for (const arq of lote) {
                if (est.itens.length >= B.MAX_POR_ARTIGO) { ADM.ui.toast('No máximo ' + B.MAX_POR_ARTIGO + ' imagens por artigo — as demais foram ignoradas.', 'wa', 7000); break; }
                try {
                    estadoEnvio.textContent = 'Preparando a imagem…';
                    const prep = await A.preparar(arq);
                    estadoEnvio.textContent = 'Enviando ' + A.kb(prep.blob.size) + (prep.original > prep.blob.size ? ' (era ' + A.kb(prep.original) + ')' : '') + '…';
                    const url = await A.enviar(prep, op.pasta);
                    est.itens.push({ url, legenda: '' }); est.novos.push(url); feitas++;
                    desenhar(); avisa();
                } catch (e) { ADM.ui.toast(e && e.local ? e.message : A.mensagemDeErro(e), 'er', 12000); break; }
            }
        } finally {
            ocupado = false; estadoEnvio.textContent = feitas ? '✔ ' + feitas + (feitas > 1 ? ' imagens enviadas' : ' imagem enviada') + '. Salve o artigo para guardar.' : '';
            desenhar();
        }
    }

    const btnAdd = h('button', { class: 'btn', type: 'button', onclick: () => entrada.click() }, I('image', 15), 'Adicionar imagem');
    const btnColar = h('button', { class: 'btn', type: 'button', title: 'Cole o print que está na área de transferência (também funciona Ctrl+V)', onclick: async () => {
        try {
            const itens = await navigator.clipboard.read(), arqs = [];
            for (const it of itens) { const t = it.types.find(x => /^image\//.test(x)); if (t) { const bl = await it.getType(t); arqs.push(new File([bl], 'print.' + (t.split('/')[1] || 'png'), { type: t })); } }
            if (arqs.length) adicionar(arqs); else ADM.ui.toast('Não há imagem na área de transferência. Tire o print com Win+Shift+S e tente de novo (ou use Ctrl+V).', 'wa', 7000);
        } catch (e) { ADM.ui.toast('O navegador não deixou ler a área de transferência daqui. Clique neste quadro e aperte Ctrl+V.', 'wa', 8000); }
    } }, I('clipboard', 15), 'Colar print');
    entrada.addEventListener('change', () => { const a = Array.from(entrada.files || []); entrada.value = ''; adicionar(a); });

    // área de soltar + Ctrl+V (o evento de colar só traz imagem quando o conteúdo copiado É uma imagem: não atrapalha colar texto nos outros campos)
    const zona = h('div', { class: 'imgs-zona', role: 'group', 'aria-label': 'Área para soltar ou colar imagens' },
        h('div', { class: 'imgs-zona-txt' }, I('image', 22), h('div', null, h('b', null, 'Cole o print aqui (Ctrl+V)'), ' ou arraste o arquivo para este quadro.', h('div', { class: 'dica' }, 'Dica: Win+Shift+S recorta uma parte da tela e já copia — depois é só colar. PNG, JPG, WebP ou GIF; o painel reduz e comprime sozinho.'))),
        h('div', { class: 'linha', style: { gap: '8px' } }, btnAdd, btnColar, entrada));
    ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); zona.classList.add('soltar'); } }));
    ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { zona.classList.remove('soltar'); }));
    zona.addEventListener('drop', e => { e.preventDefault(); adicionar(e.dataTransfer && e.dataTransfer.files); });
    const aoColar = e => {
        if (!document.body.contains(raiz)) { document.removeEventListener('paste', aoColar, true); return; }   // o editor saiu da tela: este ouvinte se desliga sozinho
        const janela = raiz.closest('.modal') || raiz.closest('#painel');
        if (janela && !(janela.contains(e.target) || janela.contains(document.activeElement))) return;       // só cola onde o editor está (não em outra janela aberta por cima)
        const cb = e.clipboardData; if (!cb) return;
        const arqs = Array.from(cb.files || []).filter(a => /^image\//i.test(a.type || ''));
        if (!arqs.length) return;                                                                              // texto: segue o colar normal do campo
        e.preventDefault(); e.stopPropagation(); adicionar(arqs);
    };
    document.addEventListener('paste', aoColar, true);

    raiz.append(
        h('div', { class: 'rot-mini' }, 'Imagens do procedimento (opcional)'),
        h('div', { class: 'dica', style: { marginBottom: '6px' } }, 'Prints do passo a passo: aparecem junto da resposta sempre que a IA usar este artigo. ', h('b', null, 'Não suba prints com dados reais de clientes'), ' (CNPJ, nomes, valores) — a imagem fica pública para quem tiver o endereço dela.'),
        zona, estadoEnvio, lista);
    desenhar();
    return { el: raiz, atualizar: desenhar };
};
