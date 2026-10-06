/* js/core/supabase-client.js — Cria o cliente do Supabase (app e Área Administrativa).
   • App: sessão não persistida (usuário comum, papel "anon").
   • Admin: sessão persistida (login por senha → papel "authenticated", quando o modo seguro está ativo).
   • Simulador (?sim=1): cliente SOMENTE LEITURA — qualquer gravação é bloqueada aqui, por garantia,
     mesmo que algum trecho do app esqueça de checar o modo de teste. */

window.BSOFT_SIM_BLOQUEIOS = [];

function _nuloAguardavel() {
    // objeto que aceita qualquer encadeamento (.eq().select()...) e, ao ser aguardado, devolve "sem erro, sem dados"
    const f = function () {};
    const p = new Proxy(f, {
        get(_, k) { return k === 'then' ? (res) => res({ data: null, error: null }) : () => p; },
        apply() { return p; }
    });
    return p;
}

function tornarClienteSomenteLeitura(cli) {
    const escritas = new Set(['insert', 'update', 'upsert', 'delete']);
    const envolver = (tabela, builder) => new Proxy(builder, {
        get(t, k) {
            if (escritas.has(k)) return () => { window.BSOFT_SIM_BLOQUEIOS.push(tabela + '.' + k); console.info('[simulação] gravação bloqueada: ' + tabela + '.' + k); return _nuloAguardavel(); };
            const v = Reflect.get(t, k);
            return typeof v === 'function' ? v.bind(t) : v;
        }
    });
    return new Proxy(cli, {
        get(t, k) {
            if (k === 'from') return (tabela) => envolver(tabela, t.from(tabela));
            if (k === 'rpc') return (nome) => { window.BSOFT_SIM_BLOQUEIOS.push('rpc.' + nome); return _nuloAguardavel(); };
            if (k === 'functions') return { invoke: () => _nuloAguardavel() };
            if (k === 'storage') return { from: () => new Proxy({}, { get: () => () => _nuloAguardavel() }) };
            const v = Reflect.get(t, k);
            return typeof v === 'function' ? v.bind(t) : v;
        }
    });
}

function criarClienteSupabase(url, chave, opcoes) {
    opcoes = opcoes || {};
    const persistir = !!opcoes.persistirSessao;
    const auth = { persistSession: persistir, autoRefreshToken: persistir, detectSessionInUrl: false };
    if (opcoes.storageKey) auth.storageKey = opcoes.storageKey;
    const cli = window.supabase.createClient(url, chave, { auth });
    return opcoes.somenteLeitura ? tornarClienteSomenteLeitura(cli) : cli;
}
