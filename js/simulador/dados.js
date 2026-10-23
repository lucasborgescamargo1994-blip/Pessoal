/* js/simulador/dados.js — Simulador de atendimento: a conversa com o banco de dados (Supabase).
   • Lê os casos (BancoDados), as provas ativas (sim_provas) e a configuração (sim_config).
   • Grava as tentativas de prova (funções sim_iniciar_tentativa / sim_concluir_tentativa) e os treinos livres (sim_sessoes) — tudo criado pelo sql/06_simulador_provas.sql.
   Se o SQL 06 ainda não foi rodado, o simulador continua funcionando (treino livre) e só deixa de oferecer provas e de registrar quem treinou.
   Nada aqui mexe na tabela BancoDados além de LER. */
const SimDados = (() => {
    let sb = null;
    const TENTATIVAS_ERRO = { tentativas_esgotadas: 'esgotadas', prova_indisponivel: 'indisponivel', nome_invalido: 'nome' };

    function iniciar() {
        if (sb) return sb;
        if (!window.supabase) throw new Error('a biblioteca do Supabase não carregou (sem internet?)');
        sb = criarClienteSupabase(BSOFT_CONFIG.supabaseUrl, BSOFT_CONFIG.supabaseAnonKey);
        return sb;
    }
    const msg = e => String((e && (e.message || e.details)) || e || '');
    // tabela/função do SQL 06 que não existe (ainda não rodou) → não é "erro", é "recurso desligado"
    const ausente = e => !!e && (e.code === 'PGRST205' || e.code === '42P01' || e.code === 'PGRST202' || e.code === '42883' || /could not find the (table|function)|does not exist/i.test(msg(e)));
    // 'esgotadas' | 'indisponivel' | 'nome' | 'ausente' | 'outro'
    function tipoErro(e) {
        const m = msg(e);
        for (const k of Object.keys(TENTATIVAS_ERRO)) if (m.indexOf(k) >= 0) return TENTATIVAS_ERRO[k];
        return ausente(e) ? 'ausente' : 'outro';
    }

    // ── BancoDados (somente leitura) ──
    async function indiceCasos() {
        const todos = [];
        for (let de = 0; ; de += 1000) {
            const { data, error } = await iniciar().from('BancoDados').select('id, titulo, categoria').order('id', { ascending: true }).range(de, de + 999);
            if (error) throw error;
            (data || []).forEach(r => todos.push(r));
            if (!data || data.length < 1000) break;
        }
        return todos;
    }
    async function buscarCaso(id) {
        const cli = iniciar();
        let r = await cli.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria, caminho_menu').eq('id', id).maybeSingle();
        if (r.error && /caminho_menu|42703|PGRST204/.test(String(r.error.code || '') + ' ' + String(r.error.message || ''))) {   // o SQL 05 ainda não foi rodado: segue sem o caminho
            r = await cli.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria').eq('id', id).maybeSingle();
        }
        if (r.error) throw r.error;
        if (!r.data) throw new Error('caso #' + id + ' não encontrado');
        return r.data;
    }
    // vários casos de uma vez (para montar a prova). Devolve um Map id → linha; o que não existir mais simplesmente não aparece.
    async function buscarCasos(ids) {
        const mapa = new Map();
        if (!ids.length) return mapa;
        const cli = iniciar();
        let r = await cli.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria, caminho_menu').in('id', ids);
        if (r.error && /caminho_menu|42703|PGRST204/.test(String(r.error.code || '') + ' ' + String(r.error.message || ''))) {
            r = await cli.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria').in('id', ids);
        }
        if (r.error) throw r.error;
        (r.data || []).forEach(l => mapa.set(Number(l.id), l));
        return mapa;
    }

    // ── configuração e provas ──
    const CONFIG_PADRAO = { treino_livre: true, boas_vindas: '', nota_minima_padrao: 70 };
    async function lerConfig() {
        try {
            const { data, error } = await iniciar().from('sim_config').select('config').eq('id', 1).maybeSingle();
            if (error) throw error;
            const c = (data && data.config && typeof data.config === 'object') ? data.config : {};
            return Object.assign({}, CONFIG_PADRAO, c, { treino_livre: c.treino_livre !== false, semTabelas: false });
        } catch (e) {
            if (!ausente(e)) console.warn('[simulador] configuração:', e);
            return Object.assign({}, CONFIG_PADRAO, { semTabelas: ausente(e) });
        }
    }
    const COLUNAS_PROVA = 'id, titulo, descricao, curso_nome, curso_link, proximo_link, msg_aprovado, msg_reprovado, itens, config, ativo';
    async function listarProvas() {
        try {
            const { data, error } = await iniciar().from('sim_provas').select(COLUNAS_PROVA).eq('ativo', true).order('id', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) { if (!ausente(e)) console.warn('[simulador] provas:', e); return []; }
    }
    async function buscarProva(id) {
        try {
            const { data, error } = await iniciar().from('sim_provas').select(COLUNAS_PROVA).eq('id', id).eq('ativo', true).maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) { if (!ausente(e)) console.warn('[simulador] prova:', e); return null; }
    }

    // ── tentativas de prova (sempre pelas funções do SQL 06) ──
    async function minhasTentativas(chave) {
        try {
            const { data, error } = await iniciar().rpc('sim_minhas_tentativas', { p_chave: chave });
            if (error) throw error;
            return { linhas: data || [], ok: true };
        } catch (e) { if (!ausente(e)) console.warn('[simulador] histórico:', e); return { linhas: [], ok: false }; }
    }
    // devolve o id (uuid) da tentativa; erros conhecidos viram Error com .tipo
    async function iniciarTentativa(provaId, nome, chave, notaMinima) {
        const { data, error } = await iniciar().rpc('sim_iniciar_tentativa', { p_prova_id: provaId, p_nome: nome, p_chave: chave, p_nota_minima: notaMinima });
        if (error) { const e = new Error(msg(error)); e.tipo = tipoErro(error); throw e; }
        return data;
    }
    async function concluirTentativa(id, d) {
        const { data, error } = await iniciar().rpc('sim_concluir_tentativa', { p_id: id, p_nota: d.nota, p_aprovado: d.aprovado, p_detalhes: d.detalhes, p_duracao: d.duracao_s, p_modelo: d.modelo || '' });
        if (error) { const e = new Error(msg(error)); e.tipo = tipoErro(error); throw e; }
        return data === true;
    }

    // ── treino livre ──
    async function registrarSessao(s) {
        try {
            const { error } = await iniciar().from('sim_sessoes').insert([s]);
            if (error) throw error;
            return true;
        } catch (e) { if (!ausente(e)) console.warn('[simulador] não gravei o treino:', e); return false; }
    }

    return { iniciar, ausente, tipoErro, indiceCasos, buscarCaso, buscarCasos, lerConfig, listarProvas, buscarProva, minhasTentativas, iniciarTentativa, concluirTentativa, registrarSessao, CONFIG_PADRAO };
})();
