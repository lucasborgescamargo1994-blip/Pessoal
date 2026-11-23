/* js/ia-local/modelo.js — IA LOCAL (simuladorlocal.html e migracaolocal.html): o MOTOR do modelo de IA que roda NO COMPUTADOR da pessoa.
   Usa o wllama (llama.cpp compilado para WebAssembly), em versão FIXA, carregado do jsDelivr; o modelo (arquivo GGUF) vem do Hugging Face, é baixado UMA vez e fica guardado no
   navegador (armazenamento do site). Nada do que se escreve no simulador sai do computador por causa da IA.
   • Só processador (CPU). O WebGPU foi testado e NÃO serve como padrão: no PC de referência o Edge só expõe uma placa antiga (GT 710) que trava com a WebLLM
     (DXGI_ERROR_DEVICE_HUNG) e a Intel HD 630 nem aparece; o processador roda em qualquer máquina (ver README, seção "Simulador com IA local").
   • Multi-thread só se a página estiver "isolada" (crossOriginIsolated: cabeçalhos COOP/COEP); sem isso roda em 1 núcleo.
   • Uma geração por vez (fila). Gerar de novo cancela a anterior que ficou para trás (a conversa já mudou).
   Este arquivo não conhece nenhuma página: recebe mensagens de chat e devolve texto. O que cada página pede (e como lê a resposta) fica em js/simulador-local/ e js/migracao-local/. */
const ModeloLocal = (() => {
    'use strict';
    const LIB_VERSAO = '3.8.1';                                           // versão fixa (não "latest"): trocar só depois de testar
    const CDN = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@' + LIB_VERSAO + '/esm/';
    const HF = 'https://huggingface.co/';
    // Modelos oferecidos (GGUF q4_k_m). "mb" = tamanho do download.
    const MODELOS = {
        llama: { chave: 'llama', nome: 'Llama 3.2 · 1B', url: HF + 'bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf', mb: 770, licenca: 'Meta Llama 3.2 Community License · Built with Llama', quem: 'Meta' },
        qwen: { chave: 'qwen', nome: 'Qwen 2.5 · 0,5B', url: HF + 'Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf', mb: 469, licenca: 'Apache-2.0', quem: 'Alibaba' }
    };
    const PADRAO = 'llama';
    const N_CTX = 2048;
    const LIMITE_PADRAO_MS = 5 * 60 * 1000;

    // ── estado ──
    const E = { fase: 'ocioso', chave: '', erro: '', carregado: 0, total: 0, nucleos: 1, gpu: false, gpuFalhou: false, ultima: null, geracoes: 0 };
    const ouvintes = [];
    let W = null, preparando = null, atual = null, aquecendo = null, fila = Promise.resolve();
    const estado = () => Object.assign({}, E);
    const mudar = (fase, extra) => { E.fase = fase; if (extra) Object.assign(E, extra); ouvintes.forEach(f => { try { f(estado()); } catch (e) { console.warn('[IA local] ouvinte:', e); } }); };
    const aoMudar = f => { ouvintes.push(f); };
    const msgErro = e => String((e && (e.message || e.details)) || e || 'erro desconhecido');

    // ── compatibilidade do navegador ──
    // módulo mínimo com uma instrução SIMD: se o navegador o valida, tem WebAssembly SIMD
    const SIMD_TESTE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
    function suporte() {
        const motivos = [];
        if (typeof WebAssembly !== 'object') motivos.push('este navegador não tem WebAssembly');
        else { try { if (!WebAssembly.validate(SIMD_TESTE)) motivos.push('este navegador é antigo demais (falta WebAssembly SIMD): atualize o Edge ou o Chrome'); } catch (e) { motivos.push('não consegui conferir o WebAssembly SIMD'); } }
        if (typeof Worker !== 'function') motivos.push('este navegador não permite rodar tarefas em segundo plano (Web Worker)');
        if (typeof AbortController !== 'function') motivos.push('este navegador é antigo demais');
        if (location.protocol === 'file:') motivos.push('abra o simulador pelo endereço do sistema (https://…) ou pelo servidor local (tools\\servidor-local.bat): um arquivo aberto direto do disco não pode guardar o modelo');
        return { ok: motivos.length === 0, motivos, multiThread: !!window.crossOriginIsolated, nucleos: navigator.hardwareConcurrency || 0, memoriaGB: navigator.deviceMemory || 0 };
    }

    // ── biblioteca ──
    const logger = { debug() {}, log() {}, warn: (...a) => console.warn('[IA local]', ...a), error: (...a) => console.error('[IA local]', ...a) };
    let _mod = null;
    async function biblioteca() {
        if (window.IALOCAL_BIBLIOTECA) return window.IALOCAL_BIBLIOTECA;      // gancho de TESTE: os testes trocam a biblioteca por uma de mentira (sem baixar nada)
        if (!_mod) _mod = import(CDN + 'index.js').catch(e => { _mod = null; throw new Error('não consegui carregar a biblioteca da IA local (sem internet ou bloqueada pela rede?): ' + msgErro(e)); });
        return _mod;
    }
    async function novaInstancia() {
        const mod = await biblioteca();
        return new mod.Wllama({ default: CDN + 'wasm/wllama.wasm' }, { logger, allowOffline: true });
    }

    // quais modelos já estão guardados neste navegador → { llama: true, qwen: false }
    async function verificarCache() {
        const saida = {};
        try {
            const w = W || await novaInstancia();
            const guardados = await w.modelManager.getModels();
            Object.values(MODELOS).forEach(m => { saida[m.chave] = guardados.some(g => g.url === m.url); });
        } catch (e) { console.warn('[IA local] não consegui ver o que já está guardado:', e); Object.values(MODELOS).forEach(m => { saida[m.chave] = false; }); }
        return saida;
    }

    async function descarregar() {
        cancelar(); abortarAquecimento();
        const w = W; W = null;
        if (w) { try { await w.exit(); } catch (e) { /* já encerrado */ } }
        // A fila é zerada: uma geração (ou o aquecimento) que estava no meio quando o trabalhador foi encerrado pode NUNCA terminar, e todo pedido novo ficaria esperando por ela
        // (achado nos testes com o modelo de verdade: abrir a página — que já carrega e aquece o modelo lembrado — e trocar de modelo logo em seguida deixava o chat em "IA local: preparando" para sempre).
        fila = Promise.resolve(); atual = null; aquecendo = null;
        mudar('ocioso', { chave: '', carregado: 0, total: 0, erro: '' });
    }

    // Baixa (se ainda não estiver guardado) e carrega o modelo. Pode ser chamado de novo sem efeito colateral.
    function preparar(chave, o) {
        o = o || {};
        const m = MODELOS[chave];
        if (!m) return Promise.reject(new Error('modelo desconhecido: ' + chave));
        if (E.fase === 'pronto' && E.chave === chave) return Promise.resolve();
        if (preparando) return preparando;
        const s = suporte();
        if (!s.ok) { mudar('erro', { erro: 'Este navegador não consegue rodar a IA local: ' + s.motivos.join('; ') + '.', chave }); return Promise.reject(new Error(E.erro)); }
        preparando = (async () => {
            let w = null;
            try {
                try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* pede ao navegador para NÃO apagar o modelo sozinho se faltar espaço (vale só se ele aceitar) */ }
                if (W) await descarregar();
                mudar('baixando', { chave, erro: '', carregado: 0, total: m.mb * 1048576, gpu: false, gpuFalhou: false });
                w = await novaInstancia();
                const multi = !!window.crossOriginIsolated;
                // Padrão: SÓ o processador (n_gpu_layers: 0). A placa de vídeo (WebGPU) é opção EXPERIMENTAL (o.gpu): a biblioteca usa se achar uma e, se o carregamento falhar, volta sozinha para o processador.
                const carregar = async usarGpu => {
                    const params = { n_ctx: N_CTX, n_parallel: 1, progressCallback: p => {
                        if (p && p.total) { E.carregado = p.loaded; E.total = p.total; if (p.loaded >= p.total && E.fase === 'baixando') { E.fase = 'carregando'; } ouvintes.forEach(f => { try { f(estado()); } catch (e) { /* ouvinte com problema não pode travar o download */ } }); }
                    } };
                    if (!usarGpu) params.n_gpu_layers = 0;
                    if (multi) params.n_threads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
                    await w.loadModelFromUrl(m.url, params);
                    return params;
                };
                let params, gpu = !!o.gpu;
                try { params = await carregar(gpu); }
                catch (e) {
                    if (!gpu) throw e;
                    console.warn('[IA local] não consegui carregar com a placa de vídeo; voltando para o processador:', e);
                    gpu = false; E.gpuFalhou = true;
                    try { await w.exit(); } catch (x) { /* ok */ }
                    w = await novaInstancia(); params = await carregar(false);
                }
                W = w;
                mudar('pronto', { nucleos: multi ? params.n_threads : 1, carregado: E.total, gpu });
                if (o.aquecer) aquecer(o.aquecer);
            } catch (e) {
                const t = msgErro(e);
                console.error('[IA local] preparar:', e);
                try { if (w) await w.exit(); } catch (x) { /* a instância que não chegou a ficar pronta é encerrada (senão o trabalhador dela ficaria vivo) */ }
                W = null;
                mudar('erro', { erro: /Failed to fetch|NetworkError|network/i.test(t) ? 'Não consegui baixar o modelo (sem internet, ou o Hugging Face está bloqueado pela rede): ' + t
                    : /quota|storage|no space|espa[cç]o/i.test(t) ? 'Faltou espaço para guardar o modelo neste navegador: libere espaço no disco (ou apague o outro modelo aqui no painel). (' + t + ')'
                    : /memory|alloc/i.test(t) ? 'Faltou memória para carregar o modelo: feche outras abas/programas ou use o modelo menor. (' + t + ')' : t });
                throw e;
            } finally { preparando = null; }
        })();
        return preparando;
    }

    // ── geração ──
    const FALTA_PRONTO = 'A IA local ainda não está pronta: use o botão "Baixar e preparar" no topo da página.';
    function gerar(messages, o) {
        abortarAquecimento();
        if (atual) { try { atual.abort('substituida'); } catch (e) { /* já terminou */ } }        // a conversa já seguiu: a anterior não serve mais
        const tarefa = fila.then(() => gerarAgora(messages, o || {}));
        fila = tarefa.catch(() => {});
        return tarefa;
    }
    async function gerarAgora(messages, o) {
        if (E.fase !== 'pronto' || !W) throw new Error(FALTA_PRONTO);
        const ctl = new AbortController(); atual = ctl;
        const limite = setTimeout(() => { try { ctl.abort('limite'); } catch (e) { /* ok */ } }, o.limiteMs || LIMITE_PADRAO_MS);
        const t0 = performance.now();
        let texto = '', fim = null, tm = null, n = 0;
        // (o cancelamento vale mesmo que o trabalhador da biblioteca não responda mais: a espera de cada pedaço disputa com o aborto)
        const abortado = new Promise((_, rej) => { ctl.signal.addEventListener('abort', () => rej(new Error('abortado')), { once: true }); }); abortado.catch(() => {});
        try {
            const it = await Promise.race([W.createChatCompletion({ messages, stream: true, return_progress: true, abortSignal: ctl.signal, cache_prompt: true,
                max_tokens: o.maxTokens || 80, temperature: o.temperature == null ? 0.6 : o.temperature, top_p: 0.9, top_k: 40, penalty_repeat: 1.1 }), abortado]);
            const iter = it[Symbol.asyncIterator]();
            for (;;) {
                const nx = await Promise.race([iter.next(), abortado]); if (nx.done) break; const ch = nx.value;
                if (ch.prompt_progress && o.aoProgresso) o.aoProgresso({ fase: 'lendo', feito: (ch.prompt_progress.processed || 0) + (ch.prompt_progress.cache || 0), total: ch.prompt_progress.total || 0 });
                const c = ch.choices && ch.choices[0];
                const d = c && c.delta && c.delta.content;
                if (d) { texto += d; n++; if (o.aoProgresso) o.aoProgresso({ fase: 'escrevendo', tokens: n, texto }); }
                if (c && c.finish_reason) fim = c.finish_reason;
                if (ch.timings) tm = ch.timings;
            }
        } catch (e) {
            if (ctl.signal.aborted) { const r = ctl.signal.reason; const err = new Error(r === 'limite' ? 'TIMEOUT: a IA local demorou mais de ' + Math.round((o.limiteMs || LIMITE_PADRAO_MS) / 1000) + ' s (computador lento ou ocupado?)' : 'geração cancelada'); err.cancelada = r !== 'limite'; throw err; }
            throw e;
        } finally { clearTimeout(limite); if (atual === ctl) atual = null; }
        const ms = Math.round(performance.now() - t0);
        E.geracoes++;
        if (tm) E.ultima = { lerTps: tm.prompt_per_second ? +tm.prompt_per_second.toFixed(1) : null, escreverTps: tm.predicted_per_second ? +tm.predicted_per_second.toFixed(1) : null, lidos: tm.prompt_n, reaproveitados: tm.cache_n, escritos: tm.predicted_n, ms };
        ouvintes.forEach(f => { try { f(estado()); } catch (e) { /* ok */ } });
        return { text: texto, finishReason: fim, timings: tm, ms };
    }
    function cancelar() { if (atual) { try { atual.abort('cancelada'); } catch (e) { /* ok */ } } }

    // Aquecimento: lê antes o trecho FIXO do prompt (as regras do cliente), que é igual em todos os casos, para o 1º cliente não esperar por ele.
    // Roda quando o computador está parado e é cancelado na hora se chegar um pedido de verdade.
    function aquecer(messages) {
        if (E.fase !== 'pronto' || !W || aquecendo) return;
        const ctl = new AbortController(); aquecendo = ctl;
        fila = fila.then(async () => {
            if (ctl.signal.aborted || E.fase !== 'pronto' || !W) return;
            try {
                const abortado = new Promise((_, rej) => { ctl.signal.addEventListener('abort', () => rej(new Error('abortado')), { once: true }); }); abortado.catch(() => {});
                const it = await Promise.race([W.createChatCompletion({ messages, stream: true, abortSignal: ctl.signal, cache_prompt: true, max_tokens: 1, temperature: 0 }), abortado]);
                const iter = it[Symbol.asyncIterator]();
                for (;;) { const nx = await Promise.race([iter.next(), abortado]); if (nx.done) break; }
            } catch (e) { if (!ctl.signal.aborted) console.warn('[IA local] aquecimento:', e); }
            finally { if (aquecendo === ctl) aquecendo = null; }
        });
    }
    function abortarAquecimento() { if (aquecendo) { try { aquecendo.abort('pedido-real'); } catch (e) { /* ok */ } aquecendo = null; } }

    // Apaga o modelo guardado (libera o espaço no navegador)
    async function apagar(chave) {
        const m = MODELOS[chave]; if (!m) return false;
        if (E.chave === chave && E.fase !== 'ocioso') await descarregar();
        try {
            const w = await novaInstancia();
            const guardados = await w.modelManager.getModels({ includeInvalid: true });
            for (const g of guardados.filter(x => x.url === m.url)) await g.remove();
            return true;
        } catch (e) { console.warn('[IA local] apagar:', e); return false; }
    }

    return { LIB_VERSAO, MODELOS, PADRAO, N_CTX, estado, aoMudar, suporte, verificarCache, preparar, descarregar, gerar, cancelar, aquecer, apagar, FALTA_PRONTO };
})();
