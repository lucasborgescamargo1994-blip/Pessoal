/* admin/js/auth.js — Entrada na Área Administrativa.
   Modo "local":    confere a senha no navegador (hash PBKDF2 em config/admin-config.js). Proteção básica.
   Modo "supabase": login no Supabase Auth; as regras RLS do banco (sql/03) só deixam esse usuário gravar. Proteção de verdade.
   Em ambos há trava contra tentativas seguidas e encerramento da sessão por inatividade. */
'use strict';
ADM.auth = (function () {
    const CFG = window.BSOFT_ADMIN || {};
    const modo = CFG.modo === 'supabase' ? 'supabase' : 'local';
    const K_SESSAO = 'bsoft_admin_sessao_v1', K_TENT = 'bsoft_admin_tentativas_v1', K_NOME = 'bsoft_admin_nome', K_AVISO = 'bsoft_admin_aviso';
    const MIN_OCIOSO = Math.max(5, Number(CFG.sessaoMinutosOciosa) || 120);
    const ESPERAS = [0, 0, 0, 5, 15, 30, 60, 180, 300];   // segundos de espera depois da 1ª, 2ª, 3ª... falha seguida
    let nome = '', email = '', ultimaAtividade = Date.now(), ultimoRegistro = 0, avisouExpirar = false, timer = null;

    const sGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
    const sSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ok */ } };
    const sDel = k => { try { sessionStorage.removeItem(k); } catch (e) { /* ok */ } };
    const marca = () => String((CFG.senha && CFG.senha.hash) || '').slice(0, 10);

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

    function gravarSessaoLocal() { sSet(K_SESSAO, JSON.stringify({ ate: Date.now() + MIN_OCIOSO * 60000, h: marca() })); }
    function sessaoLocalValida() {
        try { const s = JSON.parse(sGet(K_SESSAO) || 'null'); return !!s && s.h === marca() && s.ate > Date.now(); } catch (e) { return false; }
    }

    async function conferirAdminSupabase() {
        // a função eh_admin() é criada pelo sql/03; sem ela o login funciona, mas o banco ainda não está protegido
        const r = await ADM.sb.rpc('eh_admin');
        if (r.error) { console.warn('[admin] eh_admin() indisponível:', r.error.message); return { ok: true, avisoRls: true }; }
        return { ok: r.data === true };
    }

    async function restaurar() {
        if (modo === 'local') {
            if (!sessaoLocalValida()) return false;
            nome = lsGet(K_NOME, '') || ''; iniciarOciosidade(); return true;
        }
        try {
            const { data } = await ADM.sb.auth.getSession();
            if (!data || !data.session) return false;
            const c = await conferirAdminSupabase();
            if (!c.ok) { await ADM.sb.auth.signOut(); return false; }
            email = data.session.user.email || ''; iniciarOciosidade(); return true;
        } catch (e) { console.warn('[admin] restaurar sessão:', e); return false; }
    }

    async function entrar(senha, nomeInformado) {
        const falta = bloqueioRestante();
        if (falta) return { ok: false, erro: `Muitas tentativas seguidas. Aguarde ${falta}s para tentar de novo.`, espera: falta };
        senha = String(senha || '');
        if (!senha) return { ok: false, erro: 'Digite a senha.' };

        if (modo === 'local') {
            if (!Cripto.disponivel()) return { ok: false, erro: 'Este endereço não permite conferir a senha com segurança (o navegador só libera isso em HTTPS, localhost ou arquivo aberto do disco).' };
            if (!CFG.senha || !CFG.senha.hash) return { ok: false, erro: 'Nenhuma senha configurada em config/admin-config.js. Gere uma em admin/senha.html.' };
            let certa = false;
            try { certa = await Cripto.conferir(senha, CFG.senha); } catch (e) { return { ok: false, erro: 'Erro ao conferir a senha: ' + e.message }; }
            if (!certa) { const esp = registrarFalha(); await esperar(350); return { ok: false, erro: esp ? `Senha incorreta. Nova tentativa em ${esp}s.` : 'Senha incorreta.', espera: esp }; }
            zerarTentativas();
            nome = String(nomeInformado || '').trim().slice(0, 40); lsSet(K_NOME, nome);
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
            zerarTentativas(); email = data.user.email || CFG.supabaseEmail; iniciarOciosidade();
            return { ok: true, avisoRls: c.avisoRls };
        } catch (e) { return { ok: false, erro: ADM.db.erroTexto(e) }; }
    }

    async function sair(motivo) {
        ADM._saindo = true;
        if (timer) clearInterval(timer);
        sDel(K_SESSAO);
        if (!motivo) sDel('bsoft_admin_mcp_rascunho');   // saída voluntária: não deixa rascunho (com chaves) esquecido na guia
        if (motivo) sSet(K_AVISO, motivo);
        if (modo === 'supabase') { try { await ADM.sb.auth.signOut(); } catch (e) { /* ok */ } }
        location.reload();
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
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checar(); });
    }

    return {
        modo, email: () => email,
        usuario: () => modo === 'supabase' ? (email || 'admin') : (nome || 'admin'),
        nomeSalvo: () => lsGet(K_NOME, '') || '',
        aviso() { const a = sGet(K_AVISO); sDel(K_AVISO); return a; },
        bloqueioRestante, restaurar, entrar, sair,
        minutosOciosos: MIN_OCIOSO,
    };
})();
