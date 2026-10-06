/* admin/js/cripto.js — Senha da área administrativa: gera e confere o "hash" (PBKDF2-SHA256) com a WebCrypto do navegador.
   A senha em si nunca é gravada: config/admin-config.js guarda só o sal e o hash. Precisa de HTTPS, localhost ou arquivo local
   (é uma exigência do navegador para a WebCrypto). */
const Cripto = (function () {
    const enc = new TextEncoder();
    const ITERACOES = 210000;   // padrão OWASP para PBKDF2-SHA256

    function bytesParaB64(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
    function b64ParaBytes(b64) { const s = atob(b64); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }
    function disponivel() { return !!(window.crypto && window.crypto.subtle); }

    async function derivar(senha, salB64, iteracoes) {
        const chave = await crypto.subtle.importKey('raw', enc.encode(String(senha)), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ParaBytes(salB64), iterations: iteracoes }, chave, 256);
        return bytesParaB64(new Uint8Array(bits));
    }
    // comparação sem "parar no primeiro erro" (não vaza, pelo tempo, quantos caracteres batem)
    function iguais(a, b) {
        a = String(a || ''); b = String(b || '');
        let r = a.length ^ b.length;
        for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
        return r === 0;
    }
    async function conferir(senha, cfgSenha) {
        if (!cfgSenha || !cfgSenha.sal || !cfgSenha.hash) return false;
        return iguais(await derivar(senha, cfgSenha.sal, cfgSenha.iteracoes || ITERACOES), cfgSenha.hash);
    }
    async function novoHash(senha, iteracoes) {
        iteracoes = iteracoes || ITERACOES;
        const salB64 = bytesParaB64(crypto.getRandomValues(new Uint8Array(16)));
        return { algoritmo: 'PBKDF2-SHA256', iteracoes, sal: salB64, hash: await derivar(senha, salB64, iteracoes) };
    }

    // Força da senha (0–4) e dicas, só para orientar quem está criando uma nova.
    function forca(senha) {
        const s = String(senha || '');
        let pts = 0;
        if (s.length >= 8) pts++;
        if (s.length >= 12) pts++;
        if (/[a-z]/.test(s) && /[A-Z]/.test(s)) pts++;
        if (/\d/.test(s) && /[^A-Za-z0-9]/.test(s)) pts++;
        if (/^(.)\1+$/.test(s) || /^(123|abc|senha|admin|bsoft|qwerty|password)/i.test(s)) pts = Math.min(pts, 1);
        const rotulos = ['muito fraca', 'fraca', 'razoável', 'boa', 'forte'];
        return { pontos: pts, rotulo: rotulos[pts] };
    }

    // Texto do arquivo config/admin-config.js. `cfg` = { modo, supabaseEmail, senha:{...}, sessaoMinutosOciosa, repositorio }
    function textoConfig(cfg) {
        const c = Object.assign({ modo: 'local', supabaseEmail: '', sessaoMinutosOciosa: 120, repositorio: '', ramo: 'main' }, cfg || {});
        const cab = [
            '/* ═══════════════════════════════════════════════════════════════════════════',
            '   CONFIGURAÇÃO DA ÁREA ADMINISTRATIVA (só é carregada por admin/index.html)',
            '',
            '   Há dois modos de login:',
            '',
            '   • "local"    — a senha é conferida no próprio navegador, comparando com o "hash" abaixo (a senha em si NÃO fica',
            '                  escrita aqui). É uma proteção básica: impede acesso casual, mas NÃO protege o banco de dados,',
            '                  porque quem entender de programação consegue falar direto com o Supabase.',
            '                  Para trocar a senha: Admin → aba "Sistema" → "Alterar senha" (gera este arquivo de novo).',
            '                  Esqueceu a senha? Abra admin/senha.html, gere um hash novo e cole aqui.',
            '',
            '   • "supabase" — recomendado. O login é feito no Supabase Auth (um usuário que você cria no painel do Supabase) e',
            '                  as regras do banco (sql/03_seguranca_rls.sql) só deixam esse usuário editar o conteúdo.',
            '                  Para ativar: crie o usuário, rode o SQL 03 e troque "modo" para "supabase" + preencha "supabaseEmail".',
            '                  Passo a passo no README.md (seção Segurança).',
            '',
            '   "repositorio" (opcional): endereço do seu repositório no GitHub, ex.: "meu-usuario/bsoft-suporte-ia".',
            '   Com ele, o painel mostra o botão "Abrir no GitHub" para colar a configuração nova direto no site, sem precisar do Git.',
            '   ═══════════════════════════════════════════════════════════════════════════ */',
        ].join('\n');
        return cab + '\nwindow.BSOFT_ADMIN = ' + JSON.stringify(c, null, 2) + ';\n';
    }

    return { disponivel, derivar, iguais, conferir, novoHash, forca, textoConfig, ITERACOES };
})();
