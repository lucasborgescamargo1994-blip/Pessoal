/* js/simulador-local/ligacao.js — Simulador LOCAL (simuladorlocal.html): liga o motor do modelo local (modelo.js) e as regras (regras.js) ao simulador original.
   O simulador (js/simulador/tela.js) continua sendo o MESMO arquivo: ele só ganhou um gancho — se existir window.SimMotorIA, é ele quem atende às chamadas de IA no lugar dos
   modelos do MCP. Aqui:
     • os 3 montadores de texto do SimLogica (cliente, juiz, dica) viram versões que só ANOTAM o que a chamada precisa (o texto de verdade é montado aqui, curto);
     • window.SimMotorIA decide: juiz e dica = regras (instantâneo); "o suporte já orientou o essencial?" = regra; a FALA do cliente = modelo local;
     • o painel "IA local" (baixar/carregar/apagar o modelo) e o selo do topo; a tela inicial só libera os treinos quando a IA está pronta;
     • nada é gravado no banco (a página já nasce em modo somente leitura; ver o script do <head> de simuladorlocal.html). */
(function () {
    'use strict';
    const L = SimLogica, R = SimLocalRegras, M = ModeloLocal;
    const $ = id => document.getElementById(id);
    const CHAVE_MODELO = 'bsoft_simlocal_modelo';
    const fmtMB = b => (b / 1048576).toFixed(b >= 1e8 ? 0 : 1).replace('.', ',') + ' MB';
    const lembrado = () => { try { const k = localStorage.getItem(CHAVE_MODELO); return M.MODELOS[k] ? k : ''; } catch (e) { return ''; } };
    const lembrar = k => { try { localStorage.setItem(CHAVE_MODELO, k); } catch (e) { /* sem armazenamento: escolhe de novo da próxima vez */ } };

    // PÁGINA DE TESTE: nada vai para o banco. O cliente do Supabase desta página nasce SOMENTE LEITURA (js/core/supabase-client.js bloqueia insert/update/delete e as funções rpc).
    // (O "?sim=1" não bastaria: o SimDados cria o cliente sem essa opção.)
    const criarCliente = window.criarClienteSupabase;
    if (typeof criarCliente === 'function') window.criarClienteSupabase = (url, chave, opcoes) => criarCliente(url, chave, Object.assign({}, opcoes, { somenteLeitura: true }));

    // ═════════ 1) o que as chamadas do simulador passam a significar ═════════
    const copiar = h => (h || []).filter(x => x && x.texto).map(x => ({ de: x.de, texto: x.texto }));
    function marcar(msgs, meta) { Object.defineProperty(msgs, 'local', { value: meta, enumerable: false }); return msgs; }
    L.montarMensagens = (caso, perfil, hist, nota) => marcar(R.mensagens(caso, perfil, hist, R.notaCurta(nota)), { tipo: 'cliente', caso, perfil, hist: copiar(hist) });
    L.montarJuiz = (caso, hist) => marcar([{ role: 'user', content: 'Conferência por regras (sem IA).' }], { tipo: 'juiz', caso, hist: copiar(hist) });
    L.montarDica = (caso, hist) => marcar([{ role: 'user', content: 'Dica por regras (sem IA).' }], { tipo: 'dica', caso, hist: copiar(hist) });

    // ═════════ 2) o motor de IA do simulador ═════════
    const dicasDoCaso = new Map();      // conversa → quantas dicas já foram pedidas (a dica fica mais clara a cada pedido; ao tentar o mesmo caso de novo, recomeça)
    const chaveCaso = c => (c && c.id != null ? '#' + c.id : String(c && c.titulo)) + '@' + ((window.Simulador && window.Simulador.S && window.Simulador.S.inicio) || 0);
    const nomeModelo = () => { const m = M.MODELOS[M.estado().chave]; return m ? m.nome : 'IA local'; };

    // mostra no balão "digitando…" o que a IA local está fazendo (ler a conversa, escrever) e há quanto tempo
    const G = { t0: 0, texto: '', tick: null };
    function mostrarProgresso() {
        const info = document.querySelector('#digitando .info'); if (!info) return;
        const s = Math.round((performance.now() - G.t0) / 1000);
        info.textContent = G.texto ? G.texto + ' · ' + s + ' s' : (s >= 3 ? 'a IA local está pensando · ' + s + ' s' : '');
    }
    const iniciarContagem = () => { G.t0 = performance.now(); G.texto = ''; clearInterval(G.tick); G.tick = setInterval(mostrarProgresso, 500); };
    const pararContagem = () => { clearInterval(G.tick); G.tick = null; };
    function aoProgresso(p) {
        if (p.fase === 'lendo') G.texto = 'lendo a conversa' + (p.total ? ' ' + Math.min(100, Math.round(100 * p.feito / p.total)) + '%' : '');
        else if (p.fase === 'escrevendo') G.texto = 'escrevendo… ' + p.tokens + ' tokens';
        mostrarProgresso();
    }

    async function chamar(messages) {
        const meta = messages && messages.local;
        if (!meta) throw new Error('chamada de IA sem contexto do simulador local');
        if (meta.tipo === 'juiz') return { text: R.vereditoJson(R.veredito(meta.caso, meta.hist, 'botao')), finishReason: 'stop' };
        if (meta.tipo === 'dica') { const k = chaveCaso(meta.caso), n = (dicasDoCaso.get(k) || 0) + 1; dicasDoCaso.set(k, n); return { text: R.dica(meta.caso, meta.hist, n), finishReason: 'stop' }; }
        // fala do cliente
        const falas = meta.hist.filter(x => x.de === 'suporte');
        if (falas.length && L.temOrientacao(meta.hist) && R.veredito(meta.caso, meta.hist, 'auto').ok) return { text: '[ESTADO: RESOLVIDO]\n' + R.FRASE_FINAL, finishReason: 'stop' };
        const abertura = !falas.length;
        iniciarContagem();
        try {
            let fala = '';
            for (let t = 0; t < 2 && !fala; t++) {
                const r = await M.gerar(messages, { maxTokens: 80, temperature: t ? 0.85 : 0.6, aoProgresso });
                fala = R.limparFala(r.text, { abertura });
            }
            return { text: '[ESTADO: CONTINUA]\n' + (fala || R.falaReserva(meta.caso, meta.hist)), _iaModelo: nomeModelo(), finishReason: 'stop' };
        } finally { pararContagem(); }
    }

    // ═════════ 3) o selo do topo e o painel ═════════
    function textoSelo() {
        const e = M.estado(), m = M.MODELOS[e.chave];
        if (e.fase === 'pronto') return '🧠 ' + (m ? m.nome : 'IA local') + ' · neste computador';
        if (e.fase === 'baixando') return '🧠 baixando ' + (e.total ? Math.round(100 * e.carregado / e.total) + '%' : '…');
        if (e.fase === 'carregando') return '🧠 carregando o modelo…';
        if (e.fase === 'erro') return '⚠️ IA local com problema';
        return '🧠 IA local: ainda não preparada';
    }
    function selo(el) {
        el = el || $('simIA'); if (!el) return;
        const e = M.estado();
        el.textContent = textoSelo();
        el.classList.toggle('erro', e.fase === 'erro');
        el.title = 'O cliente simulado é uma IA pequena que roda no seu computador (nada sai daqui por causa dela). Os modelos do MCP não são usados nesta página.';
    }

    let cache = {};                      // modelo → já está guardado no navegador?
    const escolhido = () => $('slModelo').value;
    function atualizarPainel() {
        const e = M.estado(), m = M.MODELOS[escolhido()];
        const ocupado = e.fase === 'baixando' || e.fase === 'carregando';
        const pronto = e.fase === 'pronto';
        const barra = $('slBarra'), cheia = $('slBarraCheia'), st = $('slStatus');
        $('slModelo').disabled = ocupado;
        barra.hidden = !(e.fase === 'baixando' || e.fase === 'carregando');
        cheia.style.width = (e.fase === 'carregando' ? 100 : e.total ? Math.min(100, 100 * e.carregado / e.total) : 0) + '%';
        barra.classList.toggle('indef', e.fase === 'carregando');
        const guardado = !!cache[m.chave];
        const btn = $('slPreparar');
        btn.disabled = ocupado || (pronto && e.chave === m.chave);
        btn.textContent = ocupado ? (e.fase === 'baixando' ? 'Baixando…' : 'Carregando…') : (pronto && e.chave === m.chave) ? '✅ Pronta' : guardado ? '▶ Carregar a IA' : '⬇ Baixar (' + m.mb + ' MB) e preparar';
        btn.classList.toggle('primario', !(pronto && e.chave === m.chave));
        $('slApagar').hidden = !guardado || ocupado;
        $('slApagar').textContent = '🗑 Apagar este modelo do navegador (libera ' + m.mb + ' MB)';
        $('slLicenca').textContent = m.nome + ' · ' + m.quem + ' · licença: ' + m.licenca;
        let msg = '', erro = false;
        if (e.fase === 'baixando') msg = 'Baixando o modelo… ' + fmtMB(e.carregado) + ' de ' + fmtMB(e.total) + ' (' + (e.total ? Math.round(100 * e.carregado / e.total) : 0) + '%). Isso só acontece uma vez.';
        else if (e.fase === 'carregando') msg = 'Colocando o modelo na memória do computador… (alguns segundos)';
        else if (e.fase === 'erro') { msg = '⚠️ ' + e.erro; erro = true; }
        else if (pronto) {
            const u = e.ultima;
            msg = '✅ A IA local está pronta (' + nomeModelo() + ', ' + (e.nucleos > 1 ? e.nucleos + ' núcleos' : '1 núcleo') + ' do processador).' + (u && u.lerTps ? ' Última medida: lê ' + u.lerTps + ' e escreve ' + u.escreverTps + ' tokens/s (uma palavra ≈ 2 tokens).' : '');
        } else msg = guardado ? 'Este modelo já está guardado neste navegador. Clique em "Carregar a IA" (leva alguns segundos).' : 'Para usar o simulador é preciso baixar o modelo (' + m.mb + ' MB), uma vez só. Depois ele fica guardado neste navegador e abre direto.';
        st.textContent = msg; st.classList.toggle('erro', erro);
        // o treino só abre com a IA pronta (e o painel avisa por quê)
        ['blocoTreino', 'blocoProvas'].forEach(id => { const b = $(id); if (b) b.inert = !pronto; });
        $('telaInicio').classList.toggle('sl-aguarda', !pronto);
        $('slAviso').hidden = pronto;
        selo();
    }

    async function preparar() {
        const chave = escolhido();
        lembrar(chave);
        try { await M.preparar(chave); cache[chave] = true; M.aquecer(R.mensagensAquecimento()); }
        catch (e) { /* o painel já mostra o erro (estado "erro") */ }
        atualizarPainel();
    }
    async function apagar() {
        const m = M.MODELOS[escolhido()];
        if (!window.confirm('Apagar "' + m.nome + '" deste navegador? Para usar de novo será preciso baixar ' + m.mb + ' MB outra vez.')) return;
        $('slApagar').disabled = true;
        const ok = await M.apagar(m.chave);
        cache = await M.verificarCache();
        $('slApagar').disabled = false;
        atualizarPainel();
        if (!ok) $('slStatus').textContent = '⚠️ Não consegui apagar o modelo. Limpe os dados do site nas configurações do navegador.';
    }

    async function iniciar() {
        const sel = $('slModelo');
        Object.values(M.MODELOS).forEach(m => { const o = document.createElement('option'); o.value = m.chave; o.textContent = m.nome + ' — ' + m.mb + ' MB'; sel.appendChild(o); });
        sel.value = lembrado() || M.PADRAO;
        M.aoMudar(atualizarPainel);
        sel.addEventListener('change', () => { lembrar(sel.value); atualizarPainel(); });
        $('slPreparar').addEventListener('click', preparar);
        $('slApagar').addEventListener('click', apagar);
        const s = M.suporte();
        const compat = $('slCompat');
        if (!s.ok) {
            compat.hidden = false; compat.textContent = '⚠️ Este navegador não consegue rodar a IA local: ' + s.motivos.join('; ') + '.';
            $('slPreparar').disabled = true; $('slModelo').disabled = true; $('slApagar').hidden = true;
            ['blocoTreino', 'blocoProvas'].forEach(id => { const b = $(id); if (b) b.inert = true; });
            $('slAviso').hidden = false; selo();
            return;
        }
        compat.hidden = false;
        compat.textContent = 'Seu computador: ' + (s.nucleos || '?') + ' processadores lógicos' + (s.memoriaGB ? ' · ≥ ' + s.memoriaGB + ' GB de memória' : '') + ' · ' + (s.multiThread ? 'vários núcleos liberados' : 'roda em 1 núcleo do processador (mais lento; ver "Como funciona")') + '.';
        atualizarPainel();
        cache = await M.verificarCache();
        atualizarPainel();
        if (cache[sel.value]) preparar();              // já está guardado: carrega sozinho
    }

    window.SimMotorIA = { chamar, selo, dicaErro: 'Confira o painel "IA local" no início da página (o modelo precisa estar pronto).' };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
