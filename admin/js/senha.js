/* admin/js/senha.js — Página admin/senha.html: gera o config/admin-config.js com o hash de uma senha nova. */
(function () {
    'use strict';
    const $id = i => document.getElementById(i);
    const msg = (t, ok) => { const m = $id('msg'); m.textContent = t || ''; m.className = 'login-msg' + (ok ? ' ok' : ''); m.style.textAlign = 'left'; };
    $id('nova').addEventListener('input', () => {
        const f = Cripto.forca($id('nova').value), b = $id('forcaBarra');
        b.style.width = ($id('nova').value ? Math.max(8, f.pontos / 4 * 100) : 0) + '%';
        b.style.background = ['var(--ad-er)', 'var(--ad-er)', '#f59e0b', '#84cc16', 'var(--ad-ok)'][f.pontos];
        $id('forcaTxt').textContent = $id('nova').value ? 'Senha ' + f.rotulo + (f.pontos < 3 ? ' — use 12+ caracteres, misture maiúsculas, números e símbolos.' : '.') : '';
    });
    $id('gerar').addEventListener('click', async () => {
        msg('');
        if (!Cripto.disponivel()) return msg('Este endereço não permite a criptografia necessária (use HTTPS, localhost ou o arquivo aberto do disco).');
        const nova = $id('nova').value;
        if (nova.length < 8) return msg('A senha precisa ter pelo menos 8 caracteres.');
        if (nova !== $id('repete').value) return msg('A repetição não é igual à senha.');
        const btn = $id('gerar'); btn.disabled = true; btn.classList.add('carregando');
        try {
            const senha = await Cripto.novoHash(nova);
            $id('texto').value = Cripto.textoConfig(Object.assign({}, window.BSOFT_ADMIN || {}, { senha }));
            $id('saida').hidden = false; msg('Pronto! Siga os passos abaixo.', true);
            $id('nova').value = ''; $id('repete').value = '';
        } catch (e) { msg('Erro: ' + e.message); }
        btn.disabled = false; btn.classList.remove('carregando');
    });
    $id('copiar').addEventListener('click', async () => { try { await navigator.clipboard.writeText($id('texto').value); msg('Copiado!', true); } catch (e) { $id('texto').select(); msg('Selecione e copie manualmente (Ctrl+C).'); } });
    $id('baixar').addEventListener('click', () => {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$id('texto').value], { type: 'text/javascript;charset=utf-8' })); a.download = 'admin-config.js';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
})();
