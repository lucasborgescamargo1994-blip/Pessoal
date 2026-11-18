/* js/migracao/dados.js — Primeira emissão guiada: a conversa com o banco de dados (Supabase, SOMENTE LEITURA) e com o armazenamento do navegador.
   • LÊ: artigos (BancoDados), respostas rápidas aprovadas, FAQ publicado, parâmetros e funcionalidades. Este cliente não consegue gravar nada no banco.
   • GUARDA no navegador (localStorage) as respostas do cliente, o passo em que parou e a conversa com a IA: nada disso vai para o servidor (LGPD). Outro computador começa do zero.
   Tabela ou coluna que ainda não existe (SQL não rodado) NÃO é erro: a página só avisa que aquele conteúdo não está disponível. */
const MigDados = (() => {
    'use strict';
    let sb = null;
    const CHAVE = 'bsoft_migracao_v1';
    const msg = e => String((e && (e.message || e.details)) || e || '');
    const ausente = e => !!e && (e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|relation .* does not exist/i.test(msg(e)));
    const colunaAusente = e => !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(msg(e)));

    function iniciar() {
        if (sb) return sb;
        if (!window.supabase) throw new Error('a biblioteca do Supabase não carregou (sem internet?)');
        sb = criarClienteSupabase(BSOFT_CONFIG.supabaseUrl, BSOFT_CONFIG.supabaseAnonKey, { somenteLeitura: true });
        return sb;
    }
    // lê uma tabela inteira em páginas de 1000 (limite do Supabase por consulta)
    async function paginado(montar) {
        const todos = [];
        for (let de = 0; ; de += 1000) {
            const { data, error } = await montar(iniciar()).range(de, de + 999);
            if (error) throw error;
            (data || []).forEach(r => todos.push(r));
            if (!data || data.length < 1000) break;
        }
        return todos;
    }
    // BancoDados: as colunas opcionais (caminho_menu = SQL 05; imagens = SQL 09) são tiradas uma a uma se o banco recusar
    async function carregarBanco() {
        const base = 'id, titulo, conteudo, como_emitir, categoria', opcionais = ['caminho_menu', 'imagens'];
        let usar = opcionais.slice();
        for (let tentativa = 0; tentativa <= opcionais.length; tentativa++) {
            try { return await paginado(c => c.from('BancoDados').select([base].concat(usar).join(', ')).order('id', { ascending: true })); }
            catch (e) {
                if (!colunaAusente(e)) throw e;
                const faltam = usar.filter(c => msg(e).includes(c));
                usar = faltam.length ? usar.filter(c => !faltam.includes(c)) : usar.slice(0, -1);
            }
        }
        return [];
    }
    // Respostas rápidas (aprovadas pela equipe) e FAQ: se a tabela não existe, devolve lista vazia e diz que não existe
    async function opcional(fn) { try { return { itens: await fn(), existe: true }; } catch (e) { if (!ausente(e)) console.warn('[migração]', msg(e)); return { itens: [], existe: !ausente(e) ? true : false, erro: ausente(e) ? '' : msg(e) }; } }
    const carregarRapidas = () => opcional(async () => (await paginado(c => c.from('respostas_rapidas').select('id, pergunta, variantes, resposta, categoria, ativo').order('id', { ascending: true }))).filter(r => r.ativo !== false));
    const carregarFaq = () => opcional(() => paginado(c => c.from('faq_itens').select('id, pergunta, resposta, categoria, caminho_menu, palavras_chave, videos, ordem').eq('publicado', true).order('ordem', { ascending: true }).order('id', { ascending: true })));
    // Parâmetros e funcionalidades (só Descrição e Nome Interno: o código NUNCA é mostrado — instrução do dono do projeto)
    const carregarParametros = () => opcional(() => paginado(c => c.from('Parametros').select('id, "Código", "Descrição", "Nome Interno"').order('id', { ascending: true })));
    const carregarFuncionalidades = () => opcional(() => paginado(c => c.from('Funcionalidades').select('id, "Código", "Descrição"').order('id', { ascending: true })));

    /* ───────── clientes no navegador ───────── */
    const vazio = () => ({ versao: 1, clientes: [], atual: '' });
    function lerLocal() {
        try { const t = localStorage.getItem(CHAVE); if (!t) return vazio(); const o = JSON.parse(t); return (o && typeof o === 'object') ? Object.assign(vazio(), o) : vazio(); }
        catch (e) { return vazio(); }
    }
    let _timer = null, _ultimoErro = '';
    // grava (com um pequeno atraso para não gravar a cada tecla). Devolve uma promessa que resolve com '' ou com a mensagem de erro.
    function gravarLocal(estado, agora) {
        const gravar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); _ultimoErro = ''; } catch (e) { _ultimoErro = 'Não consegui guardar o seu progresso neste navegador (' + (e && e.name === 'QuotaExceededError' ? 'espaço cheio' : 'armazenamento bloqueado') + '). Se você fechar a página, vai começar do zero.'; } return _ultimoErro; };
        clearTimeout(_timer);
        if (agora) return Promise.resolve(gravar());
        return new Promise(res => { _timer = setTimeout(() => res(gravar()), 350); });
    }
    const ultimoErroLocal = () => _ultimoErro;
    const chaveLocal = () => CHAVE;

    return { iniciar, ausente, colunaAusente, carregarBanco, carregarRapidas, carregarFaq, carregarParametros, carregarFuncionalidades, lerLocal, gravarLocal, ultimoErroLocal, chaveLocal };
})();
