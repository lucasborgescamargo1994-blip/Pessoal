/* js/migracao-local/ligacao.js — Primeira emissão guiada com IA LOCAL (migracaolocal.html): liga o motor do modelo local (js/ia-local/modelo.js) e o núcleo sem IA (rag.js) ao chat da página original.
   O chat (js/migracao/tela-passos.js + ia.js) continua sendo o MESMO código: ia.js ganhou só um gancho — se existir window.MigMotorIA, é ele quem responde, no lugar dos modelos do MCP.
   Aqui:
     • MigLogica.montarMensagensMentor vira a versão CURTA (rag.js): trecho do artigo + passo + pergunta (o prompt do MCP tem milhares de tokens: inviável no processador de um PC comum);
     • window.MigMotorIA decide por pergunta: resposta direta (regra de prazo, glossário, "é com o Suporte", erro que não consta, "não encontrei", "pede detalhe") SEM modelo · banco direto
       (o artigo já é a resposta: título = pergunta; vale também sem o modelo pronto) · modelo local · trecho do banco (quando o modelo não está pronto, está desligado ou não entregou nada que sirva);
       a opção "A IA escreve TODA resposta" tira o atalho do banco (modo de teste do modelo);
     • enquanto o modelo escreve, a bolha "digitando" mostra o que ele está fazendo (lendo o material %, escrevendo), o texto que já saiu e as fontes que o banco achou;
     • o painel "IA local" (baixar/carregar/apagar o modelo, ligar/desligar a IA, placa de vídeo experimental). O chat funciona mesmo sem o modelo (responde direto do banco). */
(function () {
    'use strict';
    const L = MigLogica, Rag = MigLocalRag, M = ModeloLocal;
    const $ = id => document.getElementById(id);
    const CH_MODELO = 'bsoft_migloc_modelo', CH_USAR = 'bsoft_migloc_usar', CH_GPU = 'bsoft_migloc_gpu', CH_TUDO = 'bsoft_migloc_tudo';
    const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: escolhe de novo da próxima vez */ } };
    const lembrado = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
    const fmtMB = b => (b / 1048576).toFixed(b >= 1e8 ? 0 : 1).replace('.', ',') + ' MB';
    const usarIA = () => { const c = $('mlUsar'); return !c || c.checked; };
    const tudo = () => { const c = $('mlTudo'); return !!c && c.checked; };          // "A IA escreve TODA resposta" (modo de teste): sem atalho do banco
    const lerTps = () => { const u = M.estado().ultima; return u && u.lerTps; };
    const nomeModelo = () => { const m = M.MODELOS[M.estado().chave]; return m ? m.nome : 'IA local'; };
    const LIMITE_RESPOSTA_MS = 8 * 60 * 1000;

    // ═════════ 1) o prompt curto no lugar do prompt enorme ═════════
    L.montarMensagensMentor = o => Rag.montar(o, { ix: window.Mig && window.Mig.ix, lerTps: lerTps() });

    // ═════════ 2) o motor de IA do chat ═════════
    const G = { t0: 0, texto: '', parcial: '', tick: null };
    const bolha = () => document.querySelector('.mig-msg.digitando .mig-balao');
    function pintar() {
        const tx = document.querySelector('.mig-digitando-tx');
        if (tx) { tx.dataset.base = G.texto || 'IA local: preparando'; tx.textContent = tx.dataset.base + ' ' + Math.round((performance.now() - G.t0) / 1000) + ' s'; }
        const b = bolha(); if (!b) return;
        let p = b.querySelector('.ml-parcial');
        if (!G.parcial) { if (p) p.remove(); return; }
        if (!p) { p = document.createElement('div'); p.className = 'ml-parcial'; b.insertBefore(p, b.querySelector('.mig-mini') || null); }
        p.textContent = G.parcial;
    }
    // as fontes que o banco achou, clicáveis, já enquanto a IA escreve (o modelo local leva minutos num PC fraco: dá para ler o artigo nesse meio tempo)
    function mostrarFontes(meta) {
        const b = bolha(); if (!b || b.querySelector('.ml-fontes') || !window.Mig || typeof window.Mig.fonteChip !== 'function') return;
        const f = (meta.material || []).map(m => ({ chave: m.chave, titulo: m.titulo })); if (!f.length) return;
        const cx = document.createElement('div'); cx.className = 'ml-fontes';
        const s = document.createElement('small'); s.textContent = 'Enquanto a IA escreve, veja o que o banco de dados tem: '; cx.append(s);
        f.forEach(x => cx.append(window.Mig.fonteChip(x)));
        b.insertBefore(cx, b.querySelector('.ml-parcial') || b.querySelector('.mig-mini') || null);
    }
    const iniciarContagem = () => { G.t0 = performance.now(); G.texto = ''; G.parcial = ''; clearInterval(G.tick); G.tick = setInterval(pintar, 500); };
    const pararContagem = () => { clearInterval(G.tick); G.tick = null; G.parcial = ''; };
    function aoProgresso(p) {
        if (p.fase === 'lendo') G.texto = 'IA local: lendo o material' + (p.total ? ' ' + Math.min(100, Math.round(100 * p.feito / p.total)) + '%' : '');
        else if (p.fase === 'escrevendo') { G.texto = 'IA local: escrevendo'; G.parcial = String(p.texto || '').trim().slice(-420); }
        pintar();
    }
    const AVISO_SEM_MODELO = 'Resposta direta do banco de dados. Para respostas escritas pela IA, prepare a IA local no topo da página.';
    const AVISO_DESLIGADA = 'Resposta direta do banco de dados (a opção “Respostas escritas pela IA” está desligada).';
    const AVISO_NAO_SERVIU = 'A IA local não conseguiu escrever uma resposta boa para esta pergunta; este é o trecho do banco de dados.';
    const AVISO_DIRETO = 'Resposta direta do banco de dados: o artigo já responde à sua pergunta, sem gastar IA.';
    const AVISO_DIRETO_CONFIG = 'Resposta direta do banco de dados, sem gastar IA: o artigo mais parecido é um procedimento de configuração, que é do Suporte.';

    async function chamar(messages) {
        const meta = messages && messages.local;
        if (!meta || meta.tipo !== 'mentor') throw new Error('chamada de IA sem contexto da migração local');
        if (meta.direta) return { text: meta.direta, _iaModelo: 'regras', finishReason: 'stop' };
        if (meta.naoEncontrei) return { text: Rag.NAO_ENCONTREI, _iaModelo: 'regras', finishReason: 'stop' };
        // o banco JÁ tem o artigo que responde (título = pergunta; no erro, o artigo do código): o modelo só reescreveria, devagar e inventando. A não ser que a pessoa peça "IA em toda resposta".
        if (meta.confiante && !tudo()) return { text: Rag.extrativaDe(meta, meta.materialConfig ? AVISO_DIRETO_CONFIG : AVISO_DIRETO), _iaModelo: 'banco', finishReason: 'stop' };
        const e = M.estado();
        if (!usarIA()) return { text: Rag.extrativaDe(meta, AVISO_DESLIGADA), _iaModelo: 'banco', finishReason: 'stop' };
        if (e.fase !== 'pronto') return { text: Rag.extrativaDe(meta, AVISO_SEM_MODELO), _iaModelo: 'banco', finishReason: 'stop' };
        iniciarContagem(); pintar(); mostrarFontes(meta);
        try {
            // temperatura 0 e resposta curta (2 frases; erro: 3 partes): medido no Llama 1B, é o que o faz COPIAR o essencial do texto em vez de inventar passos — e escreve metade do tempo
            const r = await M.gerar(messages, { maxTokens: meta.erro ? 170 : 100, temperature: 0, limiteMs: LIMITE_RESPOSTA_MS, aoProgresso });
            const texto = Rag.finalizar(r.text, meta, r.finishReason);
            if (!texto) return { text: Rag.extrativaDe(meta, AVISO_NAO_SERVIU), _iaModelo: 'banco', finishReason: 'stop' };
            return { text: texto, _iaModelo: nomeModelo(), finishReason: r.finishReason };
        } finally { pararContagem(); }
    }
    // "cancelar" na bolha "digitando": o modelo para de escrever na hora (senão continuaria gastando o processador até o próximo pedido)
    document.addEventListener('click', ev => { if (ev.target && ev.target.closest && ev.target.closest('.mig-msg.digitando .mig-mini')) M.cancelar(); }, true);

    // ═════════ 3) o painel ═════════
    let cache = {};                      // modelo → já está guardado no navegador?
    let abertoSozinho = false, pessoaMexeu = false;       // os "Detalhes" abriram sozinhos (baixando/erro)? a pessoa mexeu no botão?
    const escolhido = () => $('mlModelo').value;
    function resumo(e, m) {
        if (e.fase === 'pronto') return 'pronta · ' + nomeModelo();
        if (e.fase === 'baixando') return 'baixando ' + (e.total ? Math.round(100 * e.carregado / e.total) + '%' : '…');
        if (e.fase === 'carregando') return 'carregando o modelo…';
        if (e.fase === 'erro') return 'com problema (veja os detalhes)';
        return cache[m.chave] ? 'guardada neste navegador (falta carregar)' : 'ainda não preparada';
    }
    function atualizarPainel() {
        const e = M.estado(), m = M.MODELOS[escolhido()];
        const ocupado = e.fase === 'baixando' || e.fase === 'carregando', pronto = e.fase === 'pronto', mesmo = pronto && e.chave === m.chave;
        const guardado = !!cache[m.chave];
        $('mlResumo').textContent = resumo(e, m);
        $('mlResumo').classList.toggle('erro', e.fase === 'erro'); $('mlResumo').classList.toggle('ok', pronto);
        const btn = $('mlPreparar');
        btn.hidden = mesmo;
        btn.disabled = ocupado;
        btn.textContent = ocupado ? (e.fase === 'baixando' ? 'Baixando…' : 'Carregando…') : guardado ? '▶ Carregar a IA' : '⬇ Baixar (' + m.mb + ' MB) e preparar';
        $('mlModelo').disabled = ocupado; $('mlGpu').disabled = ocupado;
        $('mlUsar').disabled = !pronto; $('mlTudo').disabled = !pronto;
        const barra = $('mlBarra');
        barra.hidden = !ocupado;
        $('mlBarraCheia').style.width = (e.fase === 'carregando' ? 100 : e.total ? Math.min(100, 100 * e.carregado / e.total) : 0) + '%';
        barra.classList.toggle('indef', e.fase === 'carregando');
        $('mlApagar').hidden = !guardado || ocupado;
        $('mlApagar').textContent = '🗑 Apagar este modelo do navegador (libera ' + m.mb + ' MB)';
        $('mlLicenca').textContent = m.nome + ' · ' + m.quem + ' · licença: ' + m.licenca;
        let msg = '', erro = false;
        if (e.fase === 'baixando') msg = 'Baixando o modelo… ' + fmtMB(e.carregado) + ' de ' + fmtMB(e.total) + '. Isso só acontece uma vez; você pode continuar usando a página (o chat responde direto do banco enquanto isso).';
        else if (e.fase === 'carregando') msg = 'Colocando o modelo na memória do computador… (alguns segundos)';
        else if (e.fase === 'erro') { msg = '⚠️ ' + e.erro; erro = true; }
        else if (pronto) {
            const u = e.ultima;
            msg = '✅ A IA local está pronta (' + nomeModelo() + ', ' + (e.gpu ? 'placa de vídeo' : e.nucleos > 1 ? e.nucleos + ' núcleos do processador' : '1 núcleo do processador') + ').' + (e.gpuFalhou ? ' A placa de vídeo falhou ao carregar: usei o processador.' : '')
                + (u && u.lerTps ? ' Última medida: lê ' + u.lerTps + ' e escreve ' + u.escreverTps + ' tokens/s (uma palavra ≈ 2 tokens).' : '');
        } else msg = guardado ? 'Este modelo já está guardado neste navegador. Clique em “Carregar a IA”.' : 'Sem o modelo o chat funciona: responde direto com o trecho do banco de dados. Para respostas escritas por uma IA neste computador, baixe o modelo (' + m.mb + ' MB), uma vez só.';
        const st = $('mlStatus'); st.textContent = msg; st.classList.toggle('erro', erro);
        // quando há o que ler (baixando, erro), os detalhes abrem sozinhos; quando fica tudo pronto, fecham sozinhos (a não ser que a pessoa os tenha aberto: aí ficam como ela deixou)
        const d = $('mlDetalhes');
        if ((e.fase === 'erro' || ocupado) && d.hidden) { d.hidden = false; abertoSozinho = true; }
        else if (pronto && abertoSozinho && !pessoaMexeu) { d.hidden = true; abertoSozinho = false; }
        $('mlMais').setAttribute('aria-expanded', String(!d.hidden));
    }
    async function preparar() {
        const chave = escolhido();
        guardar(CH_MODELO, chave); guardar(CH_GPU, $('mlGpu').checked ? '1' : '0');
        try { await M.preparar(chave, { gpu: $('mlGpu').checked }); cache[chave] = true; M.aquecer(Rag.mensagensAquecimento()); }
        catch (e) { /* o painel já mostra o erro (estado "erro") */ }
        atualizarPainel();
    }
    async function apagar() {
        const m = M.MODELOS[escolhido()];
        if (!window.confirm('Apagar “' + m.nome + '” deste navegador? Para usar de novo será preciso baixar ' + m.mb + ' MB outra vez.')) return;
        $('mlApagar').disabled = true;
        const ok = await M.apagar(m.chave);
        cache = await M.verificarCache();
        $('mlApagar').disabled = false;
        atualizarPainel();
        if (!ok) $('mlStatus').textContent = '⚠️ Não consegui apagar o modelo. Limpe os dados do site nas configurações do navegador.';
    }

    async function iniciar() {
        const sel = $('mlModelo');
        Object.values(M.MODELOS).forEach(m => { const o = document.createElement('option'); o.value = m.chave; o.textContent = m.nome + ' — ' + m.mb + ' MB'; sel.appendChild(o); });
        const s = M.suporte();
        sel.value = lembrado(CH_MODELO) && M.MODELOS[lembrado(CH_MODELO)] ? lembrado(CH_MODELO) : (s.memoriaGB && s.memoriaGB < 4 ? 'qwen' : M.PADRAO);      // pouca memória → o modelo menor
        $('mlUsar').checked = lembrado(CH_USAR) !== '0'; $('mlGpu').checked = lembrado(CH_GPU) === '1'; $('mlTudo').checked = lembrado(CH_TUDO) === '1';
        M.aoMudar(atualizarPainel);
        sel.addEventListener('change', () => { guardar(CH_MODELO, sel.value); atualizarPainel(); });
        $('mlUsar').addEventListener('change', () => guardar(CH_USAR, $('mlUsar').checked ? '1' : '0'));
        $('mlTudo').addEventListener('change', () => guardar(CH_TUDO, $('mlTudo').checked ? '1' : '0'));
        $('mlGpu').addEventListener('change', () => guardar(CH_GPU, $('mlGpu').checked ? '1' : '0'));
        $('mlPreparar').addEventListener('click', preparar);
        $('mlApagar').addEventListener('click', apagar);
        $('mlMais').addEventListener('click', () => { const d = $('mlDetalhes'); d.hidden = !d.hidden; pessoaMexeu = true; abertoSozinho = false; $('mlMais').setAttribute('aria-expanded', String(!d.hidden)); });
        const compat = $('mlCompat');
        if (!s.ok) {
            compat.textContent = '⚠️ Este navegador não consegue rodar a IA local: ' + s.motivos.join('; ') + '. O chat continua respondendo direto do banco de dados.';
            $('mlPreparar').disabled = true; sel.disabled = true; $('mlGpu').disabled = true; $('mlUsar').disabled = true; $('mlTudo').disabled = true; $('mlApagar').hidden = true;
            $('mlResumo').textContent = 'indisponível neste navegador'; $('mlResumo').classList.add('erro'); $('mlDetalhes').hidden = false; $('mlMais').setAttribute('aria-expanded', 'true');
            return;
        }
        compat.textContent = 'Seu computador: ' + (s.nucleos || '?') + ' processadores lógicos' + (s.memoriaGB ? ' · ≥ ' + s.memoriaGB + ' GB de memória' : '') + ' · ' + (s.multiThread ? 'vários núcleos liberados' : 'roda em 1 núcleo do processador (mais lento; ver “Como funciona”)') + (s.memoriaGB && s.memoriaGB < 4 ? ' · pouca memória: prefira o modelo menor.' : '.');
        atualizarPainel();
        cache = await M.verificarCache();
        atualizarPainel();
        if (cache[sel.value]) preparar();              // já está guardado: carrega sozinho
    }

    window.MigMotorIA = { chamar };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
