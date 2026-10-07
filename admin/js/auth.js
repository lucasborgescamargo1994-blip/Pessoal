/* admin/js/auth.js — Entrada na Área Administrativa.
   Modo "local":    confere a senha no navegador (hash PBKDF2 em config/admin-config.js). Proteção básica.
                    Além do administrador principal (a "senha" do arquivo, todas as abas), o arquivo pode ter uma lista "usuarios":
                    cada pessoa com o seu hash de senha e as abas que pode usar (criada em Sistema → Usuários e acessos).
                    As abas liberadas organizam o que cada um vê e usa; NÃO impedem quem entende de programação de falar direto com o banco.
   Modo "supabase": login no Supabase Auth; as regras RLS do banco (sql/03) só deixam esse usuário gravar. Proteção de verdade.
                    (Uma conta só: a lista "usuarios" não vale neste modo.)
   Em ambos há trava contra tentativas seguidas e encerramento da sessão por inatividade. */
'use strict';
ADM.auth = (function () {
    const CFG = window.BSOFT_ADMIN || {};
    const modo = CFG.modo === 'supabase' ? 'supabase' : 'local';
    const K_SESSAO = 'bsoft_admin_sessao_v1', K_TENT = 'bsoft_admin_tentativas_v1', K_NOME = 'bsoft_admin_nome', K_ULTIMO = 'bsoft_admin_ultimo_usuario', K_AVISO = 'bsoft_admin_aviso';
    const MIN_OCIOSO = Math.max(5, Number(CFG.sessaoMinutosOciosa) || 120);
    const ESPERAS = [0, 0, 0, 5, 15, 30, 60, 180, 300];   // segundos de espera depois da 1ª, 2ª, 3ª... falha seguida
    const INTERVALO_REVALIDAR = 5 * 60000;                // de quanto em quanto tempo confere se o administrador mudou o acesso desta pessoa
    let atual = null;                                      // quem está dentro: { principal, chave, nome, abas } (abas = null → todas)
    let email = '', ultimaAtividade = Date.now(), ultimoRegistro = 0, avisouExpirar = false, timer = null, timerRevalidar = null;

    const sGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
    const sSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ok */ } };
    const sDel = k => { try { sessionStorage.removeItem(k); } catch (e) { /* ok */ } };
    const marca = () => String((CFG.senha && CFG.senha.hash) || '').slice(0, 10);

    /* ───────────── usuários cadastrados (só no modo local) ───────────── */
    // "Maria", "maria " e "María" são o mesmo usuário
    const chaveNome = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const usuariosDe = cfg => (cfg && Array.isArray(cfg.usuarios)) ? cfg.usuarios.filter(u => u && u.nome && u.senha && u.senha.hash) : [];
    const listaUsuarios = () => modo === 'local' ? usuariosDe(CFG) : [];
    const multiusuario = () => listaUsuarios().length > 0;
    const acharUsuario = (chave, lista) => (lista || listaUsuarios()).find(u => chaveNome(u.nome) === chave) || null;
    const marcaUsuario = u => String((u && u.senha && u.senha.hash) || '').slice(0, 10);
    const identidadeUsuario = u => ({ principal: false, chave: chaveNome(u.nome), nome: String(u.nome).trim(), abas: Array.isArray(u.abas) ? u.abas.map(String) : [] });
    const identidadePrincipal = n => ({ principal: true, chave: '', nome: n || '', abas: null });

    function lerTentativas() { try { return JSON.parse(lsGet(K_TENT, '{}')) || {}; } catch (e) { return {}; } }
    function bloqueioRestante() { const t = lerTentativas(); return Math.max(0, Math.ceil(((t.ate || 0) - Date.now()) / 1000)); }
    function registrarFalha() {
        const t = lerTentativas(); t.n = (t.n || 0) + 1;
        const espera = ESPERAS[Math.min(t.n, ESPERAS.length - 1)] || 0;
        t.ate = espera ? Date.now() + espera * 1000 : 0;
        lsSet(K_TENT, JSON.stringify(t));
        return espera;
    }
    const zerarTentativas = () => { try { localStorage.removeItem(K_TENT); } catch (e) { /* ok */ } };

    // a sessão guarda QUEM entrou (u/uh); as abas liberadas NÃO ficam nela: são lidas de novo do arquivo de configuração a cada abertura
    function gravarSessaoLocal() {
        const delegado = atual && !atual.principal;
        sSet(K_SESSAO, JSON.stringify({ ate: Date.now() + MIN_OCIOSO * 60000, h: marca(), u: delegado ? atual.chave : '', uh: delegado ? marcaUsuario(acharUsuario(atual.chave)) : '' }));
    }
    function lerSessaoLocal() {
        try { const s = JSON.parse(sGet(K_SESSAO) || 'null'); return (!!s && s.h === marca() && s.ate > Date.now()) ? s : null; } catch (e) { return null; }
    }

    async function conferirAdminSupabase() {
        // a função eh_admin() é criada pelo sql/03; sem ela o login funciona, mas o banco ainda não está protegido
        const r = await ADM.sb.rpc('eh_admin');
        if (r.error) { console.warn('[admin] eh_admin() indisponível:', r.error.message); return { ok: true, avisoRls: true }; }
        return { ok: r.data === true };
    }

    async function restaurar() {
        if (modo === 'local') {
            const s = lerSessaoLocal();
            if (!s) return false;
            if (s.u) {   // sessão de um usuário cadastrado: ele ainda existe, está ativo e a senha é a mesma?
                const u = acharUsuario(s.u);
                if (!u || u.ativo === false || marcaUsuario(u) !== s.uh) return false;
                atual = identidadeUsuario(u);
            } else atual = identidadePrincipal(lsGet(K_NOME, '') || '');
            iniciarOciosidade(); return true;
        }
        try {
            const { data } = await ADM.sb.auth.getSession();
            if (!data || !data.session) return false;
            const c = await conferirAdminSupabase();
            if (!c.ok) { await ADM.sb.auth.signOut(); return false; }
            email = data.session.user.email || ''; atual = identidadePrincipal(email); iniciarOciosidade(); return true;
        } catch (e) { console.warn('[admin] restaurar sessão:', e); return false; }
    }

    async function entrar(senha, nomeInformado) {
        const falta = bloqueioRestante();
        if (falta) return { ok: false, erro: `Muitas tentativas seguidas. Aguarde ${falta}s para tentar de novo.`, espera: falta };
        senha = String(senha || '');
        if (!senha) return { ok: false, erro: 'Digite a senha.' };

        if (modo === 'local') {
            if (!Cripto.disponivel()) return { ok: false, erro: 'Este endereço não permite conferir a senha com segurança (o navegador só libera isso em HTTPS, localhost ou arquivo aberto do disco).' };
            const multi = multiusuario();
            const digitado = String(nomeInformado || '').trim().slice(0, 40);
            // se o nome digitado é de um usuário cadastrado, vale a senha DELE; senão vale a do administrador principal (o nome é só um apelido para o histórico)
            const u = digitado ? acharUsuario(chaveNome(digitado)) : null;
            const alvo = u ? u.senha : CFG.senha;
            if (!u && !(CFG.senha && CFG.senha.hash)) return { ok: false, erro: multi ? 'Usuário ou senha incorretos.' : 'Nenhuma senha configurada em config/admin-config.js. Gere uma em admin/senha.html.' };
            let certa = false;
            try { certa = await Cripto.conferir(senha, alvo); } catch (e) { return { ok: false, erro: 'Erro ao conferir a senha: ' + e.message }; }
            if (!certa) { const esp = registrarFalha(); await esperar(350); const base = multi ? 'Usuário ou senha incorretos.' : 'Senha incorreta.'; return { ok: false, erro: esp ? `${base} Nova tentativa em ${esp}s.` : base, espera: esp }; }
            if (u && u.ativo === false) { zerarTentativas(); return { ok: false, erro: 'Este usuário está desativado. Fale com o administrador do painel.' }; }   // só revela depois de acertar a senha
            zerarTentativas();
            if (u) atual = identidadeUsuario(u);
            else { atual = identidadePrincipal(digitado); lsSet(K_NOME, digitado); }
            lsSet(K_ULTIMO, digitado);
            gravarSessaoLocal(); iniciarOciosidade();
            return { ok: true };
        }

        // modo "supabase"
        if (!CFG.supabaseEmail) return { ok: false, erro: 'Falta preencher "supabaseEmail" em config/admin-config.js.' };
        try {
            const { data, error } = await ADM.sb.auth.signInWithPassword({ email: CFG.supabaseEmail, password: senha });
            if (error) { const esp = registrarFalha(); await esperar(350); return { ok: false, erro: /invalid login/i.test(error.message) ? (esp ? `Senha incorreta. Nova tentativa em ${esp}s.` : 'Senha incorreta.') : 'Não foi possível entrar: ' + error.message, espera: esp }; }
            const c = await conferirAdminSupabase();
            if (!c.ok) { await ADM.sb.auth.signOut(); return { ok: false, erro: 'Esta conta não está na lista de administradores (tabela admin_emails). Veja README → Segurança.' }; }
            zerarTentativas(); email = data.user.email || CFG.supabaseEmail; atual = identidadePrincipal(email); iniciarOciosidade();
            return { ok: true, avisoRls: c.avisoRls };
        } catch (e) { return { ok: false, erro: ADM.db.erroTexto(e) }; }
    }

    async function sair(motivo) {
        ADM._saindo = true;
        if (timer) clearInterval(timer);
        if (timerRevalidar) clearInterval(timerRevalidar);
        sDel(K_SESSAO);
        if (!motivo) sDel('bsoft_admin_mcp_rascunho');   // saída voluntária: não deixa rascunho (com chaves) esquecido na guia
        if (motivo) sSet(K_AVISO, motivo);
        if (modo === 'supabase') { try { await ADM.sb.auth.signOut(); } catch (e) { /* ok */ } }
        location.reload();
    }

    /* ───────────── mudanças feitas pelo administrador enquanto a pessoa está logada ─────────────
       Lê de novo o config/admin-config.js PUBLICADO. Se a pessoa foi desativada/excluída ou trocaram a senha dela → sai; se mudaram as abas → recarrega
       para aplicar. Só vale para usuários cadastrados (o principal não é derrubado por isso). Sem rede ou abrindo pelo disco (file://) não faz nada. */
    async function lerConfigPublicada() {
        if (location.protocol === 'file:') return null;
        try {
            const r = await fetch('../config/admin-config.js?t=' + Date.now(), { cache: 'no-store' });
            if (!r.ok) return null;
            const t = await r.text(), i = t.indexOf('window.BSOFT_ADMIN'), a = t.indexOf('{', i), b = t.lastIndexOf('}');
            return (i < 0 || a < 0 || b < a) ? null : JSON.parse(t.slice(a, b + 1));
        } catch (e) { return null; }
    }
    async function revalidar() {
        if (modo !== 'local' || !atual || atual.principal || ADM._saindo) return 'ignorado';
        const cfg = await lerConfigPublicada();
        if (!cfg) return 'sem-leitura';
        const u = acharUsuario(atual.chave, usuariosDe(cfg));
        if (!u || u.ativo === false || marcaUsuario(u) !== marcaUsuario(acharUsuario(atual.chave))) { sair('Seu acesso foi alterado pelo administrador. Entre de novo.'); return 'saiu'; }
        const novas = (Array.isArray(u.abas) ? u.abas.map(String) : []).sort().join('|'), antigas = atual.abas.slice().sort().join('|');
        if (novas !== antigas) { ADM.ui.toast('O administrador mudou as abas liberadas para você. A página vai recarregar para aplicar.', 'wa', 6000); setTimeout(() => location.reload(), 2500); return 'recarrega'; }
        return 'ok';
    }

    function iniciarOciosidade() {
        ultimaAtividade = Date.now();
        const mexeu = () => {
            ultimaAtividade = Date.now(); avisouExpirar = false;
            if (modo === 'local' && Date.now() - ultimoRegistro > 30000) { ultimoRegistro = Date.now(); gravarSessaoLocal(); }
        };
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, mexeu, { passive: true, capture: true }));
        const checar = () => {
            const resta = MIN_OCIOSO * 60000 - (Date.now() - ultimaAtividade);
            if (resta <= 0) { sair('Sessão encerrada por inatividade.'); return; }
            if (resta < 60000 && !avisouExpirar) { avisouExpirar = true; ADM.ui.toast('A sessão expira em 1 minuto por inatividade. Mexa na tela para continuar.', 'wa', 12000); }
        };
        timer = setInterval(checar, 15000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checar(); revalidar(); } });
        if (modo === 'local' && atual && !atual.principal) timerRevalidar = setInterval(() => { if (document.visibilityState === 'visible') revalidar(); }, INTERVALO_REVALIDAR);
    }

    return {
        modo, email: () => email,
        usuario: () => modo === 'supabase' ? (email || 'admin') : ((atual && atual.nome) || 'admin'),
        nomeSalvo: () => lsGet(K_ULTIMO, '') || lsGet(K_NOME, '') || '',
        aviso() { const a = sGet(K_AVISO); sDel(K_AVISO); return a; },
        bloqueioRestante, restaurar, entrar, sair, revalidar,
        minutosOciosos: MIN_OCIOSO,
        // ── usuários e abas ──
        multiusuario, chaveNome,
        ehPrincipal: () => !atual || atual.principal,                                   // o administrador principal (e a conta única do modo seguro)
        podeAba: id => !atual || atual.principal || atual.abas.indexOf(id) >= 0,       // esta pessoa pode usar a aba?
        usuarioAtual: () => ({ nome: (atual && atual.nome) || '', principal: !atual || atual.principal, abas: atual && atual.abas ? atual.abas.slice() : null }),
    };
})();
