/* admin/js/aba-mcp.js — Aba "IA / MCP": edita config/mcp-config.js (provedor, cadeia de modelos, visão, embeddings, respostas rápidas).
   Fluxo: você edita aqui → testa (modelos e simulador) → "Salvar" grava o arquivo config/mcp-config.js → você sobe o arquivo no GitHub →
   o sistema confere a cada 2 horas (e ao abrir) e passa a usar a configuração nova sozinho, sem ninguém mexer em nada. */
(function () {
    'use strict';
    const SS_KEY = 'bsoft_admin_mcp_rascunho';
    const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const clone = o => JSON.parse(JSON.stringify(o));
    const M = ADM.mcp = { rascunho: null, publicado: null };
    const R = {};
    let mostrarChaves = false, ultimaConferencia = null;

    const norm = () => mcpNormalizar(M.rascunho);
    const sujo = () => !!M.publicado && !!M.rascunho && mcpHash(norm()) !== mcpHash(M.publicado);
    const campo = (rot, ctl, dica) => h('label', { class: 'campo' }, h('span', { class: 'rot' }, rot), ctl, dica ? h('span', { class: 'dica' }, dica) : null);

    /* ───────────── rascunho guardado na guia (sobrevive a recarregar/encerrar por inatividade) ───────────── */
    function guardarRascunho() { try { if (sujo()) sessionStorage.setItem(SS_KEY, JSON.stringify({ r: M.rascunho, em: Date.now() })); else sessionStorage.removeItem(SS_KEY); } catch (e) { /* ok */ } }
    function lerRascunhoGuardado() { try { const o = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null'); return o && o.r ? mcpNormalizar(o.r) : null; } catch (e) { return null; } }
    const limparRascunhoGuardado = () => { try { sessionStorage.removeItem(SS_KEY); } catch (e) { /* ok */ } };

    const mudou = debounce(() => { ADM.marcarSujo('mcp', sujo()); guardarRascunho(); atualizarStatus(); }, 140);

    /* ───────────── utilidades ───────────── */
    function modelosConhecidos() {
        const s = new Set();
        Object.keys(PROVIDER_PRESETS).forEach(k => (PROVIDER_PRESETS[k].models || []).forEach(m => s.add(m)));
        Object.keys(MODEL_LABELS).forEach(m => s.add(m));
        M.rascunho.cadeia.forEach(x => x.modelo && s.add(x.modelo)); M.rascunho.visao.forEach(m => m && s.add(m));
        return Array.from(s).sort();
    }
    function atualizarDatalist() { if (R.dl) limpar(R.dl).append(modelosConhecidos().map(m => h('option', { value: m }, MODEL_LABELS[m] || ''))); }

    function campoChave(get, set, aria) {
        const inp = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', name: 'k' + Math.random().toString(36).slice(2), 'aria-label': aria || 'Chave', placeholder: 'cole a chave aqui', 'data-lpignore': 'true' });
        inp.value = get();
        inp.addEventListener('input', () => set(inp.value.trim()));
        const olho = h('button', { type: 'button', class: 'btn fantasma icone peq', 'aria-label': 'Mostrar ou ocultar a chave', title: 'Mostrar/ocultar', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; } }, I('eye', 15));
        return { inp, el: h('div', { class: 'senha-wrap' }, inp, olho) };
    }

    function explicarErro(r) {
        const s = r.status, m = r.erro || '';
        if (s === 401 || s === 403 || /api key|unauthor|invalid.*key/i.test(m)) return 'chave recusada (confira a chave do provedor)';
        if (s === 402) return 'sem crédito neste provedor';
        if (s === 404 || /no endpoints|not found|does not exist/i.test(m)) return 'modelo não encontrado ou descontinuado — troque por outro';
        if (s === 429) return 'limite de uso do plano gratuito atingido (tente mais tarde)';
        if (s >= 500) return 'o provedor está com problema no momento';
        return m;
    }
    async function testarModelo(modelo, prov, extra) {
        const t0 = performance.now();
        if (!modelo) return { ok: false, ms: 0, erro: 'Informe o nome do modelo.' };
        try {
            const msgs = extra && extra.visao
                ? [{ role: 'user', content: [{ type: 'text', text: 'Responda apenas com a palavra OK.' }, { type: 'image_url', image_url: { url: PNG_1PX } }] }]
                : [{ role: 'user', content: 'Responda apenas com a palavra OK.' }];
            const r = await callMCPAPI(prov.tipo, modelo, mcpJuntar(prov.chave), prov.baseUrl || (PROVIDER_PRESETS[prov.tipo] || {}).baseUrl, msgs, { maxTokens: 160, temperature: 0 });   // folga para modelos que "pensam" antes de responder
            return { ok: true, ms: Math.round(performance.now() - t0), txt: String(r.text || '').trim() };
        } catch (e) { return { ok: false, ms: Math.round(performance.now() - t0), erro: e.message, status: e.status }; }
    }
    function mostrarResultado(el, r) {
        el.className = 'resultado ' + (r.ok ? 'ok' : 'er');
        el.textContent = r.ok ? `✔ respondeu em ${r.ms} ms${r.txt ? ' — “' + ADM.fmt.trunc(r.txt, 40) + '”' : ' (resposta vazia, mas o modelo está no ar)'}` : `✖ ${explicarErro(r)}`;
    }

    /* ───────────── mudanças em relação ao arquivo publicado ───────────── */
    function diffConfig(a, b) {
        const d = [], nm = x => MODEL_LABELS[x] || x;
        if (a.provedor.tipo !== b.provedor.tipo) d.push(`Provedor: ${a.provedor.tipo} → ${b.provedor.tipo}`);
        if (a.provedor.baseUrl !== b.provedor.baseUrl) d.push('Endereço (URL) do provedor alterado');
        if (mcpJuntar(a.provedor.chave) !== mcpJuntar(b.provedor.chave)) d.push('Chave do provedor alterada');
        const ma = a.cadeia.map(x => x.modelo), mb = b.cadeia.map(x => x.modelo);
        mb.filter(m => !ma.includes(m)).forEach(m => d.push('+ modelo adicionado: ' + nm(m)));
        ma.filter(m => !mb.includes(m)).forEach(m => d.push('− modelo removido: ' + nm(m)));
        if (mb.filter(m => ma.includes(m)).join('|') !== ma.filter(m => mb.includes(m)).join('|')) d.push('Ordem dos modelos alterada');
        b.cadeia.forEach(x => { const o = a.cadeia.find(y => y.modelo === x.modelo); if (o && o.ativo !== x.ativo) d.push(`${nm(x.modelo)}: ${x.ativo ? 'ativado' : 'desativado'}`); });
        if (a.rascunho.ativo !== b.rascunho.ativo) d.push('Resposta provisória: ' + (b.rascunho.ativo ? 'ligada' : 'desligada'));
        if (a.rascunho.modelo !== b.rascunho.modelo) d.push('Modelo da resposta provisória: ' + nm(b.rascunho.modelo));
        if (a.prioritario.ativo !== b.prioritario.ativo) d.push('Modelo prioritário: ' + (b.prioritario.ativo ? 'ligado' : 'desligado'));
        else if (b.prioritario.ativo && JSON.stringify(a.prioritario) !== JSON.stringify(b.prioritario)) d.push('Modelo prioritário alterado');
        if (a.visao.join('|') !== b.visao.join('|')) d.push('Modelos de visão alterados');
        if (a.embeddings.modelo !== b.embeddings.modelo) d.push('Modelo de embeddings alterado');
        if (mcpJuntar(a.embeddings.chave) !== mcpJuntar(b.embeddings.chave)) d.push('Chave da Jina (embeddings) alterada');
        const ra = a.respostasRapidas, rb = b.respostasRapidas;
        if (ra.ativo !== rb.ativo) d.push('Respostas rápidas: ' + (rb.ativo ? 'ligadas' : 'desligadas'));
        if (ra.limiarLexical !== rb.limiarLexical) d.push(`Limiar de termos em comum: ${ADM.fmt.pct(ra.limiarLexical)} → ${ADM.fmt.pct(rb.limiarLexical)}`);
        if (ra.limiarSemantico !== rb.limiarSemantico) d.push(`Limiar de significado: ${ADM.fmt.pct(ra.limiarSemantico)} → ${ADM.fmt.pct(rb.limiarSemantico)}`);
        if (ra.minTermos !== rb.minTermos) d.push(`Mínimo de termos: ${ra.minTermos} → ${rb.minTermos}`);
        if ((ra.usarNoContexto !== false) !== (rb.usarNoContexto !== false)) d.push('Respostas aprovadas como conhecimento da IA: ' + (rb.usarNoContexto !== false ? 'ligado' : 'desligado'));
        if (ra.contextoMax !== rb.contextoMax) d.push(`Respostas aprovadas dadas à IA: ${ra.contextoMax} → ${rb.contextoMax}`);
        return d;
    }

    function validar(cfg) {
        const erros = [], avisos = [];
        if (!mcpJuntar(cfg.provedor.chave)) erros.push('Falta a chave do provedor.');
        if (!/^https?:\/\//i.test(cfg.provedor.baseUrl || '')) erros.push('O endereço (URL) do provedor precisa começar com https://');
        if (!cfg.cadeia.some(x => x.ativo)) erros.push('Deixe pelo menos um modelo ativo na cadeia.');
        if (cfg.rascunho.ativo && !cfg.rascunho.modelo) erros.push('Escolha o modelo da resposta provisória (ou desligue-a).');
        if (cfg.prioritario.ativo && (!cfg.prioritario.modelo)) erros.push('O modelo prioritário está ligado, mas sem nome de modelo.');
        if (!mcpJuntar(cfg.embeddings.chave)) avisos.push('Sem chave da Jina (embeddings): a busca por significado deixa de funcionar.');
        if (!cfg.visao.length) avisos.push('Nenhum modelo de visão: “Analisar tela” e leitura de imagens não vão funcionar.');
        const dup = cfg.cadeia.map(x => x.modelo).filter((m, i, a) => a.indexOf(m) !== i);
        if (dup.length) avisos.push('Modelos repetidos na cadeia (serão ignorados depois do primeiro): ' + Array.from(new Set(dup)).join(', '));
        return { erros, avisos };
    }

    /* ───────────── arquivo config/mcp-config.js (File System Access) ───────────── */
    const ARQ = ADM.arquivoLocal('admin_mcp_handle', 'mcp-config.js', 'Arquivo mcp-config.js do projeto');
    const urlEditarGithub = () => ADM.urlEditarGithub('config/mcp-config.js');

    /* ───────────── seções (esquerda) ───────────── */
    function cartao(titulo, icone, filhos, acoes, desc) {
        return h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I(icone, 16), titulo), acoes || null),
            h('div', { class: 'cartao-corpo' }, desc ? h('div', { class: 'dica' }, desc) : null, filhos));
    }

    function secProvedor() {
        const p = M.rascunho.provedor;
        const tipo = h('select', { 'aria-label': 'Provedor' }, [['openrouter', 'OpenRouter'], ['google', 'Google (Gemini / Gemma)'], ['custom', 'Personalizado (compatível com OpenAI)']].map(([v, t]) => h('option', { value: v }, t)));
        tipo.value = p.tipo;
        const base = h('input', { type: 'text', placeholder: 'https://openrouter.ai/api/v1', spellcheck: 'false' }); base.value = p.baseUrl;
        const chave = campoChave(() => mcpJuntar(p.chave), v => { p.chave = mcpDividirChave(v); mudou(); }, 'Chave do provedor');
        tipo.addEventListener('change', () => {
            const antigoPreset = (PROVIDER_PRESETS[p.tipo] || {}).baseUrl; p.tipo = tipo.value;
            const novoPreset = (PROVIDER_PRESETS[p.tipo] || {}).baseUrl;
            if (novoPreset && (!p.baseUrl || p.baseUrl === antigoPreset)) { p.baseUrl = novoPreset; base.value = novoPreset; }
            mudou();
        });
        base.addEventListener('input', () => { p.baseUrl = base.value.trim(); mudou(); });
        return cartao('Provedor de IA', 'server', [
            h('div', { class: 'g2' }, campo('Provedor', tipo), campo('Endereço da API (URL)', base)),
            campo('Chave da API', chave.el, 'Fica no arquivo de configuração dividida em pedaços. Atenção: qualquer chave num sistema que roda no navegador pode ser vista por quem abrir as ferramentas do desenvolvedor — use só chaves gratuitas/limitadas.')]);
    }

    function secCadeia() {
        R.cadeia = h('div', { class: 'pilha', style: { gap: '8px' } });
        R.sugestoesModelos = h('div', { class: 'linha', style: { gap: '6px' } });
        const acoes = h('div', { class: 'linha', style: { gap: '6px' } },
            h('button', { class: 'btn peq', type: 'button', title: 'Testa cada modelo ativo, na ordem', onclick: async e => { await ADM.ui.ocupado(e.currentTarget, async () => { const linhas = R.cadeia.querySelectorAll('.modelo-linha'); for (const l of linhas) { if (l.classList.contains('inativo')) continue; const b = l.querySelector('[data-testar]'); if (b) { await b.onclick({ currentTarget: b }); await esperar(500); } } }); } }, I('zap', 13), 'Testar todos'),
            h('button', { class: 'btn peq primario', type: 'button', onclick: () => { M.rascunho.cadeia.push({ modelo: '', ativo: true }); renderCadeia(); const ins = R.cadeia.querySelectorAll('input[type=text]'); if (ins.length) ins[ins.length - 1].focus(); mudou(); } }, I('plus', 13), 'Adicionar'));
        const c = cartao('Cadeia de modelos', 'layers', [R.cadeia, h('div', { class: 'campo' }, h('span', { class: 'dica' }, 'Sugestões (clique para adicionar):'), R.sugestoesModelos)], acoes,
            'A IA tenta o 1º modelo; se falhar, passa para o 2º, e assim por diante (2 tentativas em cada). Arraste ⠿ ou use as setas para mudar a ordem. Modelos desligados ficam guardados, mas não são usados.');
        renderCadeia();
        return c;
    }
    function renderCadeia() {
        const lista = M.rascunho.cadeia, box = limpar(R.cadeia);
        if (!lista.length) box.appendChild(h('div', { class: 'mu' }, 'Nenhum modelo na cadeia — adicione pelo menos um.'));
        lista.forEach((m, i) => box.appendChild(linhaCadeia(m, i)));
        const ja = new Set(lista.map(x => x.modelo)), sug = ((PROVIDER_PRESETS[M.rascunho.provedor.tipo] || {}).models || []).filter(x => !ja.has(x));
        limpar(R.sugestoesModelos).append(sug.length ? sug.map(x => h('button', { class: 'chip', type: 'button', title: x, onclick: () => { lista.push({ modelo: x, ativo: true }); renderCadeia(); mudou(); } }, '+ ' + (MODEL_LABELS[x] || x))) : h('span', { class: 'mu', style: { fontSize: '12px' } }, 'nenhuma sugestão adicional'));
        atualizarDatalist();
    }
    function mover(lista, de, para, aposMover) { if (para < 0 || para >= lista.length || de === para) return; lista.splice(para, 0, lista.splice(de, 1)[0]); aposMover(); mudou(); }
    function ligarArrastar(linha, grip, lista, i, aposMover) {
        grip.draggable = true;
        grip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setDragImage(linha, 12, 12); } catch (x) { /* ok */ } linha.classList.add('arrastando'); });
        grip.addEventListener('dragend', () => linha.classList.remove('arrastando'));
        linha.addEventListener('dragover', e => { e.preventDefault(); linha.classList.add('alvo'); });
        linha.addEventListener('dragleave', () => linha.classList.remove('alvo'));
        linha.addEventListener('drop', e => { e.preventDefault(); linha.classList.remove('alvo'); const de = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(de)) mover(lista, de, i, aposMover); });
    }
    function linhaCadeia(m, i) {
        const lista = M.rascunho.cadeia;
        const inp = h('input', { type: 'text', list: 'dlModelos', placeholder: 'ex.: cohere/north-mini-code:free', spellcheck: 'false', 'aria-label': 'Modelo ' + (i + 1) }); inp.value = m.modelo;
        const rot = h('div', { class: 'dica' }, MODEL_LABELS[m.modelo] || '');
        inp.addEventListener('input', () => { m.modelo = inp.value.trim(); rot.textContent = MODEL_LABELS[m.modelo] || ''; mudou(); });
        const res = h('div', { class: 'resultado' });
        const ativo = ADM.ui.chave(m.ativo !== false, v => { m.ativo = v; linha.classList.toggle('inativo', !v); mudou(); }, 'Modelo ' + (i + 1) + ' ativo');
        const testar = h('button', { class: 'btn peq', type: 'button', 'data-testar': '1', title: 'Faz uma chamada real a este modelo' }, I('zap', 13), 'Testar');
        testar.onclick = async e => { const b = (e && e.currentTarget) || testar; await ADM.ui.ocupado(b, async () => mostrarResultado(res, await testarModelo(m.modelo, M.rascunho.provedor))); };
        const grip = h('span', { class: 'grip', title: 'Arraste para reordenar' }, I('grip', 16));
        const linha = h('div', { class: 'modelo-linha' + (m.ativo === false ? ' inativo' : '') }, grip, h('span', { class: 'pos' }, (i + 1) + 'º'), h('div', { style: { minWidth: 0 } }, inp, rot), ativo.el,
            h('div', { class: 'linha', style: { gap: '3px', flexWrap: 'nowrap' } }, testar,
                h('button', { class: 'btn peq icone fantasma', type: 'button', 'aria-label': 'Subir', title: 'Subir', disabled: i === 0, onclick: () => mover(lista, i, i - 1, renderCadeia) }, I('up', 14)),
                h('button', { class: 'btn peq icone fantasma', type: 'button', 'aria-label': 'Descer', title: 'Descer', disabled: i === lista.length - 1, onclick: () => mover(lista, i, i + 1, renderCadeia) }, I('down', 14)),
                h('button', { class: 'btn peq icone fantasma perigo', type: 'button', 'aria-label': 'Remover', title: 'Remover da cadeia', onclick: () => { lista.splice(i, 1); renderCadeia(); mudou(); } }, I('trash', 14))), res);
        ligarArrastar(linha, grip, lista, i, renderCadeia);
        return linha;
    }

    function secRascunho() {
        const r = M.rascunho.rascunho;
        const ch = ADM.ui.chave(r.ativo, v => { r.ativo = v; corpo.hidden = !v; mudou(); }, 'Resposta provisória ligada');
        const inp = h('input', { type: 'text', list: 'dlModelos', spellcheck: 'false', placeholder: 'ex.: cohere/north-mini-code:free', 'aria-label': 'Modelo da resposta provisória' }); inp.value = r.modelo;
        inp.addEventListener('input', () => { r.modelo = inp.value.trim(); mudou(); });
        const res = h('div', { class: 'resultado dica' });
        const corpo = h('div', { class: 'pilha', style: { gap: '10px' } }, campo('Modelo da resposta provisória', inp), h('div', { class: 'linha' }, h('button', { class: 'btn peq', type: 'button', onclick: async e => { await ADM.ui.ocupado(e.currentTarget, async () => mostrarResultado(res, await testarModelo(r.modelo, M.rascunho.provedor))); } }, I('zap', 13), 'Testar'), res));
        corpo.hidden = !r.ativo;
        return cartao('Resposta provisória', 'sparkles', [h('label', { class: 'linha' }, ch.el, h('span', null, h('b', null, 'Ligada'), h('span', { class: 'mu' }, ' — um modelo leve responde primeiro, enquanto o principal elabora a resposta completa.'))), corpo]);
    }

    function secPrioritario() {
        const p = M.rascunho.prioritario;
        const ch = ADM.ui.chave(p.ativo, v => { p.ativo = v; corpo.hidden = !v; mudou(); }, 'Modelo prioritário ligado');
        const tipo = h('select', { 'aria-label': 'Provedor do prioritário' }, [['openrouter', 'OpenRouter'], ['google', 'Google'], ['custom', 'Personalizado']].map(([v, t]) => h('option', { value: v }, t))); tipo.value = p.tipo || 'openrouter';
        const base = h('input', { type: 'text', spellcheck: 'false', placeholder: 'vazio = endereço padrão do provedor' }); base.value = p.baseUrl || '';
        const mod = h('input', { type: 'text', list: 'dlModelos', spellcheck: 'false', placeholder: 'ex.: google/gemini-2.5-pro' }); mod.value = p.modelo || '';
        const chave = campoChave(() => mcpJuntar(p.chave), v => { p.chave = mcpDividirChave(v); mudou(); }, 'Chave do modelo prioritário');
        const res = h('div', { class: 'resultado dica' });
        tipo.addEventListener('change', () => { p.tipo = tipo.value; mudou(); });
        base.addEventListener('input', () => { p.baseUrl = base.value.trim(); mudou(); });
        mod.addEventListener('input', () => { p.modelo = mod.value.trim(); mudou(); });
        const corpo = h('div', { class: 'pilha' }, h('div', { class: 'g2' }, campo('Provedor', tipo), campo('Modelo', mod)), h('div', { class: 'g2' }, campo('Endereço da API (opcional)', base), campo('Chave (vazia = usa a do provedor padrão)', chave.el)),
            h('div', { class: 'linha' }, h('button', { class: 'btn peq', type: 'button', onclick: async e => { await ADM.ui.ocupado(e.currentTarget, async () => mostrarResultado(res, await testarModelo(p.modelo, { tipo: p.tipo, baseUrl: p.baseUrl, chave: p.chave.length ? p.chave : M.rascunho.provedor.chave }))); } }, I('zap', 13), 'Testar'), res));
        corpo.hidden = !p.ativo;
        return cartao('Modelo prioritário (opcional)', 'star', [h('label', { class: 'linha' }, ch.el, h('span', null, h('b', null, 'Ligado'), h('span', { class: 'mu' }, ' — um modelo (de qualquer provedor) tentado ANTES da cadeia. Útil para usar um modelo pago/melhor, com a cadeia grátis de reserva.'))), corpo]);
    }

    function secVisao() {
        R.visao = h('div', { class: 'pilha', style: { gap: '8px' } });
        const c = cartao('Modelos de visão (Analisar tela)', 'eye', [R.visao], h('button', { class: 'btn peq primario', type: 'button', onclick: () => { M.rascunho.visao.push(''); renderVisao(); const ins = R.visao.querySelectorAll('input'); if (ins.length) ins[ins.length - 1].focus(); mudou(); } }, I('plus', 13), 'Adicionar'),
            'Modelos que entendem imagens (usados em “Analisar tela” e ao colar prints). Tentados na ordem.');
        renderVisao(); return c;
    }
    function renderVisao() {
        const lista = M.rascunho.visao, box = limpar(R.visao);
        if (!lista.length) box.appendChild(h('div', { class: 'mu' }, 'Nenhum modelo de visão.'));
        lista.forEach((m, i) => {
            const inp = h('input', { type: 'text', list: 'dlModelos', spellcheck: 'false', 'aria-label': 'Modelo de visão ' + (i + 1) }); inp.value = m;
            inp.addEventListener('input', () => { lista[i] = inp.value.trim(); mudou(); });
            const res = h('div', { class: 'resultado' });
            const grip = h('span', { class: 'grip', title: 'Arraste para reordenar' }, I('grip', 16));
            const linha = h('div', { class: 'modelo-linha' }, grip, h('span', { class: 'pos' }, (i + 1) + 'º'), inp, h('span'),
                h('div', { class: 'linha', style: { gap: '3px', flexWrap: 'nowrap' } },
                    h('button', { class: 'btn peq', type: 'button', title: 'Envia uma imagem minúscula para ver se o modelo aceita imagens', onclick: async e => { await ADM.ui.ocupado(e.currentTarget, async () => mostrarResultado(res, await testarModelo(lista[i], M.rascunho.provedor, { visao: true }))); } }, I('zap', 13), 'Testar'),
                    h('button', { class: 'btn peq icone fantasma', type: 'button', 'aria-label': 'Subir', disabled: i === 0, onclick: () => mover(lista, i, i - 1, renderVisao) }, I('up', 14)),
                    h('button', { class: 'btn peq icone fantasma', type: 'button', 'aria-label': 'Descer', disabled: i === lista.length - 1, onclick: () => mover(lista, i, i + 1, renderVisao) }, I('down', 14)),
                    h('button', { class: 'btn peq icone fantasma perigo', type: 'button', 'aria-label': 'Remover', onclick: () => { lista.splice(i, 1); renderVisao(); mudou(); } }, I('trash', 14))), res);
            ligarArrastar(linha, grip, lista, i, renderVisao);
            box.appendChild(linha);
        });
        atualizarDatalist();
    }

    function secEmbeddings() {
        const e = M.rascunho.embeddings;
        const chave = campoChave(() => mcpJuntar(e.chave), v => { e.chave = mcpDividirChave(v); mudou(); }, 'Chave da Jina');
        const res = h('div', { class: 'resultado dica' });
        return cartao('Embeddings (busca por significado)', 'search', [
            h('div', { class: 'g2' }, campo('Modelo', h('input', { type: 'text', value: e.modelo || 'jina-embeddings-v3', readOnly: true }), 'Fixo: os vetores guardados no banco foram gerados com este modelo (1024 dimensões).'), campo('Chave da Jina', chave.el)),
            h('div', { class: 'linha' }, h('button', { class: 'btn peq', type: 'button', onclick: async ev => { await ADM.ui.ocupado(ev.currentTarget, async () => { const t0 = performance.now(); try { const v = await ADM.jinaVetor('teste de conexão', mcpJuntar(e.chave)); res.className = 'resultado ok'; res.textContent = `✔ respondeu em ${Math.round(performance.now() - t0)} ms (${v.length} dimensões)`; } catch (x) { res.className = 'resultado er'; res.textContent = '✖ ' + x.message; } }); } }, I('zap', 13), 'Testar chave'), res)]);
    }

    function secRespostasRapidas() {
        const r = M.rascunho.respostasRapidas;
        const ch = ADM.ui.chave(r.ativo, v => { r.ativo = v; mudou(); }, 'Respostas rápidas ligadas');
        const slider = (rot, chave, min, max, dica) => {
            const sel = h('input', { type: 'range', min, max, step: 0.01, value: r[chave], 'aria-label': rot }), num = h('span', { class: 'pct alto' }, ADM.fmt.pct(r[chave]));
            sel.addEventListener('input', () => { r[chave] = Number(sel.value); num.textContent = ADM.fmt.pct(r[chave]); mudou(); });
            return h('div', { class: 'campo' }, h('div', { class: 'linha', style: { justifyContent: 'space-between' } }, h('span', { class: 'rot' }, rot), num), sel, h('span', { class: 'dica' }, dica));
        };
        const minT = h('input', { type: 'number', min: 1, max: 10, step: 1, value: r.minTermos }); minT.addEventListener('input', () => { r.minTermos = Math.max(1, parseInt(minT.value, 10) || 1); mudou(); });
        // além de responder direto, as respostas aprovadas viram conhecimento da IA (entram no prompt quando a pergunta não é parecida o bastante)
        const ctx = ADM.ui.chave(r.usarNoContexto !== false, v => { r.usarNoContexto = v; mudou(); }, 'Usar as respostas aprovadas como conhecimento da IA');
        const ctxMax = h('input', { type: 'number', min: 1, max: 6, step: 1, value: r.contextoMax || 3 }); ctxMax.addEventListener('input', () => { r.contextoMax = Math.min(6, Math.max(1, parseInt(ctxMax.value, 10) || 3)); mudou(); });
        return cartao('Respostas rápidas — regras de semelhança', 'zap', [
            h('label', { class: 'linha' }, ch.el, h('span', null, h('b', null, 'Usar respostas rápidas'), h('span', { class: 'mu' }, ' — desligado, toda pergunta vai direto para a IA.'))),
            slider('Termos em comum para considerar “parecida”', 'limiarLexical', 0.5, 1, 'Quanto MENOR, mais perguntas diferentes recebem a mesma resposta pronta (risco de resposta errada). Recomendado: 80%.'),
            slider('Semelhança de significado (Jina)', 'limiarSemantico', 0.8, 1, 'Segunda checagem, para perguntas escritas com outras palavras. Recomendado: 92% ou mais.'),
            campo('Mínimo de termos na pergunta', minT, 'Perguntas muito curtas (ex.: “erro”) nunca usam resposta rápida por semelhança. Recomendado: 2.'),
            h('label', { class: 'linha' }, ctx.el, h('span', null, h('b', null, 'Usar também como conhecimento da IA'), h('span', { class: 'mu' }, ' — quando a pergunta não é parecida o bastante para responder direto, as respostas aprovadas mais relacionadas entram no prompt da IA, como artigos já validados pela equipe. Funciona mesmo com as respostas rápidas desligadas acima.'))),
            campo('Quantas respostas aprovadas dar à IA', ctxMax, 'De 1 a 6. Mais respostas = mais contexto (e mais tokens por pergunta). Recomendado: 3.')]);
    }

    /* ───────────── status / publicação (direita) ───────────── */
    function textoArquivo(cfg, mascarar) {
        const c = clone(cfg);
        if (mascarar) ['provedor', 'prioritario', 'embeddings'].forEach(k => { if (c[k] && c[k].chave && c[k].chave.length) c[k].chave = ['••••••••']; });
        return mcpSerializar(c);
    }
    function proximaVersao() { const c = norm(); c.versao = (M.publicado.versao || 0) + (sujo() ? 1 : 0); c.atualizadoEm = new Date().toISOString(); c.atualizadoPor = ADM.auth.usuario(); return c; }

    function atualizarStatus() {
        if (!R.dir || !M.rascunho) return;
        const pub = M.publicado, mudancas = diffConfig(pub, norm()), s = sujo();
        const gh = urlEditarGithub();
        limpar(R.dir).append(
            h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('activity', 16), 'Situação')),
                h('div', { class: 'cartao-corpo' },
                    h('div', { class: 'pilha', style: { gap: '4px' } }, h('div', { class: 'linha', style: { gap: '6px' } }, h('span', { class: 'sel ok' }, 'Publicada: versão ' + pub.versao), pub.atualizadoPor ? h('span', { class: 'sel' }, 'por ' + pub.atualizadoPor) : null),
                        h('div', { class: 'dica' }, pub.atualizadoEm ? 'Atualizada em ' + ADM.fmt.dataHora(pub.atualizadoEm) + '.' : 'Sem data registrada.')),
                    s ? ADM.ui.aviso('wa', h('b', null, mudancas.length + ' alteração(ões) não salva(s)'), h('ul', { class: 'diff-lista' }, mudancas.map(x => h('li', null, x))))
                      : ADM.ui.aviso('ok', 'Sem alterações — o que está na tela é igual ao arquivo.'),
                    h('div', { class: 'linha' }, h('button', { class: 'btn peq', type: 'button', onclick: e => conferirPublicado(e.currentTarget) }, I('refresh', 13), 'Conferir arquivo publicado agora'),
                        ultimaConferencia ? h('span', { class: 'dica' }, ultimaConferencia.texto) : null))),
            h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('upload', 16), 'Como publicar')),
                h('div', { class: 'cartao-corpo' },
                    h('ol', { class: 'passos' },
                        h('li', null, h('b', null, 'Salve'), ' aqui no painel (botão “Salvar no arquivo”).'),
                        h('li', null, h('b', null, 'Suba'), ' o arquivo ', h('code', null, 'config/mcp-config.js'), ' no GitHub (commit + push).'),
                        h('li', null, 'Pronto. Quem estiver com o sistema aberto passa a usar a configuração nova em até ', h('b', null, '2 horas'), '; quem abrir depois usa na hora. Ninguém precisa fazer nada.')),
                    ARQ.suportado ? h('div', { class: 'linha' }, h('span', { class: 'sel ' + (ARQ.nome() ? 'ok' : '') }, ARQ.nome() ? '📎 arquivo vinculado: ' + ARQ.nome() : 'nenhum arquivo vinculado'),
                        h('button', { class: 'btn peq', type: 'button', onclick: async () => { try { await ARQ.trocar(); atualizarStatus(); } catch (e) { if (e.name !== 'AbortError') ADM.ui.toast(e.message, 'er'); } } }, ARQ.nome() ? 'Trocar arquivo' : 'Escolher o arquivo'))
                        : ADM.ui.aviso('in', 'Este navegador não deixa o site gravar no seu computador. Use “Copiar” ou “Baixar” e coloque o arquivo na pasta config/. (O Edge e o Chrome permitem salvar direto.)'),
                    gh ? h('a', { class: 'btn peq', href: gh, target: '_blank', rel: 'noopener' }, I('ext', 13), 'Abrir o arquivo no GitHub (para colar)') : null)),
            (() => {
                const det = h('details', { class: 'cartao sanfona', open: R.previewAberto }, h('summary', { style: { padding: '13px 16px' } }, 'Ver o arquivo que será gerado'),
                    h('div', { class: 'cartao-corpo', style: { paddingTop: 0 } },
                        h('label', { class: 'marcar', style: { fontWeight: 500, fontSize: '12.5px' } }, h('input', { type: 'checkbox', checked: mostrarChaves, onchange: e => { mostrarChaves = e.currentTarget.checked; atualizarStatus(); } }), 'mostrar as chaves'),
                        h('pre', { class: 'codigo' }, textoArquivo(proximaVersao(), !mostrarChaves))));
                det.addEventListener('toggle', () => { R.previewAberto = det.open; });   // não fecha sozinho a cada alteração
                return det;
            })());
        R.btnSalvar.disabled = !s; R.btnDescartar.disabled = !s;
        R.sujoTxt.textContent = s ? '● ' + mudancas.length + ' alteração(ões) não salva(s)' : 'sem alterações'; R.sujoTxt.className = 'sel ' + (s ? 'wa' : '');
    }

    async function conferirPublicado(btn) {
        await ADM.ui.ocupado(btn, async () => {
            try {
                const nova = mcpNormalizar(await mcpBuscarArquivo());
                const igualCarregado = mcpHash(nova) === mcpHash(M.publicado);
                if (igualCarregado) ultimaConferencia = { texto: '✔ conferido: versão ' + nova.versao + ' (sem mudanças desde que você abriu).' };
                else if (!sujo()) { M.publicado = nova; M.rascunho = clone(nova); ultimaConferencia = { texto: 'O arquivo mudou — carreguei a versão ' + nova.versao + '.' }; construir(); }
                else ultimaConferencia = { texto: '⚠ o arquivo publicado é outro (versão ' + nova.versao + ') e você tem alterações não salvas.' };
                atualizarStatus();
            } catch (e) { ultimaConferencia = { texto: '✖ não consegui ler o arquivo: ' + e.message }; atualizarStatus(); }
        });
    }

    /* ───────────── ações ───────────── */
    function marcarSalvo(cfg) {
        M.publicado = mcpNormalizar(cfg); M.rascunho = clone(M.publicado);
        limparRascunhoGuardado(); ADM.marcarSujo('mcp', false); construir();
        if (ADM.sim && ADM.sim.usarPublicada) { /* o simulador volta a usar a publicada só quando o usuário pedir; mantém o rascunho antigo */ }
    }
    async function salvar(btn) {
        const { erros, avisos } = validar(norm());
        if (erros.length) { ADM.ui.modal({ titulo: 'Corrija antes de salvar', corpo: [ADM.ui.aviso('er', h('ul', { class: 'diff-lista' }, erros.map(x => h('li', null, x))))], botoes: [{ rotulo: 'Entendi', tipo: 'primario' }], largura: 480 }); return; }
        if (avisos.length && !(await ADM.ui.confirmar(avisos.join('\n\n') + '\n\nSalvar mesmo assim?', { titulo: 'Atenção', rotuloOk: 'Salvar mesmo assim' }))) return;
        const cfg = proximaVersao(), texto = mcpSerializar(cfg);
        await ADM.ui.ocupado(btn, async () => {
            let gravou = false;
            if (ARQ.suportado) {
                try { gravou = await ARQ.gravar(texto); }
                catch (e) { if (e.name !== 'AbortError') ADM.ui.toast('Não consegui gravar direto no arquivo: ' + e.message, 'wa', 9000); }
            }
            if (gravou) { marcarSalvo(cfg); mostrarPublicar(cfg, texto, true); }
            else mostrarPublicar(cfg, texto, false);
        });
    }
    function mostrarPublicar(cfg, texto, gravou) {
        const gh = urlEditarGithub();
        const cmd = 'git add config/mcp-config.js\ngit commit -m "Atualiza a configuração da IA (v' + cfg.versao + ')"\ngit push';
        const corpo = [
            gravou ? ADM.ui.aviso('ok', h('b', null, 'Salvo!'), ' O arquivo ', h('code', null, ARQ.nome() || 'mcp-config.js'), ' foi atualizado (versão ' + cfg.versao + ').')
                   : ADM.ui.aviso('wa', h('b', null, 'Falta colocar o arquivo no projeto.'), ' Copie ou baixe o conteúdo abaixo e salve como ', h('code', null, 'config/mcp-config.js'), ' (substituindo o antigo).'),
            h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Agora publique'), h('ol', { class: 'passos' },
                h('li', null, 'No GitHub Desktop (ou no terminal), faça ', h('b', null, 'commit + push'), ' do arquivo ', h('code', null, 'config/mcp-config.js'), '.'),
                h('li', null, 'Aguarde ~1 minuto (o GitHub Pages republica o site).'),
                h('li', null, 'Quem está com o sistema aberto pega a novidade em até 2 horas; quem abrir depois, na hora.'))),
            h('pre', { class: 'codigo', style: { maxHeight: '110px' } }, cmd),
            h('div', { class: 'linha' },
                h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.copiar(cmd, 'Comandos copiados.') }, I('copy', 13), 'Copiar comandos'),
                !gravou ? h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.copiar(texto, 'Conteúdo do arquivo copiado.') }, I('copy', 13), 'Copiar conteúdo do arquivo') : null,
                !gravou ? h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.baixar('mcp-config.js', texto, 'text/javascript;charset=utf-8') }, I('download', 13), 'Baixar mcp-config.js') : null,
                gh ? h('a', { class: 'btn peq', href: gh, target: '_blank', rel: 'noopener' }, I('ext', 13), 'Abrir no GitHub (editar e colar)') : null)];
        const botoes = gravou ? [{ rotulo: 'Fechar', tipo: 'primario' }]
            : [{ rotulo: 'Ainda não', tipo: 'fantasma' }, { rotulo: 'Já salvei o arquivo no projeto ✔', tipo: 'primario', acao: () => { marcarSalvo(cfg); } }];
        ADM.ui.modal({ titulo: gravou ? 'Configuração salva' : 'Salvar a configuração', corpo, botoes, largura: 620, fecharFora: false });
    }
    async function copiarConteudo() { const { erros } = validar(norm()); if (erros.length) ADM.ui.toast('Atenção: ' + erros[0], 'wa'); await ADM.ui.copiar(mcpSerializar(proximaVersao()), 'Conteúdo do arquivo copiado (cole em config/mcp-config.js).'); }
    function baixarArquivo() { ADM.ui.baixar('mcp-config.js', mcpSerializar(proximaVersao()), 'text/javascript;charset=utf-8'); }
    async function descartar() {
        if (!sujo()) return;
        if (!(await ADM.ui.confirmar('Descartar todas as alterações e voltar ao arquivo publicado?', { titulo: 'Descartar alterações', rotuloOk: 'Descartar', perigo: true }))) return;
        M.rascunho = clone(M.publicado); limparRascunhoGuardado(); ADM.marcarSujo('mcp', false); construir();
    }
    function testarNoSimulador() { ADM.sim.usarRascunho(norm()); ADM.irParaAba('simulador'); ADM.ui.toast('O simulador agora usa esta configuração (ainda não salva). Faça uma pergunta e veja o resultado.', 'in', 6000); }

    /* ───────────── montagem ───────────── */
    function construir() {
        R.dl = R.dl || h('datalist', { id: 'dlModelos' });
        limpar(R.esq).append(R.dl, secProvedor(), secCadeia(), secRascunho(), secPrioritario(), secVisao(), secEmbeddings(), secRespostasRapidas());
        atualizarDatalist(); atualizarStatus();
    }

    ADM.registrarAba({
        id: 'mcp', titulo: 'IA / MCP', icone: 'bot', ordem: 40,
        descricao: 'Modelos de IA, chaves e regras das respostas rápidas. Salva em config/mcp-config.js — você só sobe o arquivo no GitHub e todo mundo passa a usar.',
        sujo,
        montar(ctx) {
            M.publicado = mcpNormalizar(window.BSOFT_MCP_CONFIG);
            const guardado = lerRascunhoGuardado();
            M.rascunho = guardado && mcpHash(guardado) !== mcpHash(M.publicado) ? guardado : clone(M.publicado);
            R.esq = h('div', { class: 'pilha' }); R.dir = h('div', { class: 'pilha' });
            R.btnSalvar = h('button', { class: 'btn primario', type: 'button', onclick: e => salvar(e.currentTarget) }, I('save', 16), ARQ.suportado ? 'Salvar no arquivo' : 'Salvar…');
            R.btnDescartar = h('button', { class: 'btn', type: 'button', onclick: descartar }, I('undo', 15), 'Descartar');
            R.sujoTxt = h('span', { class: 'sel' }, '');
            ctx.corpo.append(h('div', { class: 'mcp-grade' }, R.esq, R.dir),
                h('div', { class: 'barra-fixa' }, R.btnSalvar,
                    h('button', { class: 'btn', type: 'button', onclick: copiarConteudo }, I('copy', 15), 'Copiar'),
                    h('button', { class: 'btn', type: 'button', onclick: baixarArquivo }, I('download', 15), 'Baixar'),
                    ADM.podeAba('simulador') ? h('button', { class: 'btn', type: 'button', onclick: testarNoSimulador }, I('flask', 15), 'Testar no simulador') : null,
                    R.btnDescartar, h('span', { class: 'grow' }), R.sujoTxt));
            construir();
            ARQ.obter(false).then(() => atualizarStatus());
            if (guardado && mcpHash(guardado) !== mcpHash(M.publicado)) { ADM.marcarSujo('mcp', true); ADM.ui.toast('Restaurei as alterações não salvas da IA / MCP que você tinha feito.', 'in', 6000); atualizarStatus(); }
        },
    });
})();
