/* tools/capturar-menu.js — captura o MENU INTEIRO do Bsoft TMS para config/menu-bsoft.js

   COMO USAR (leva 1 minuto):
   1. Abra o Bsoft no Chrome e entre normalmente (de preferência com um usuário que enxergue todos os módulos).
   2. Aperte F12 › aba "Console". Se o Chrome avisar sobre colar código, digite  allow pasting  e Enter.
   3. Cole TODO o código abaixo (da linha "(() => {" até a última linha) e aperte Enter.
   4. O menu inteiro é copiado para a área de transferência (e aparece no console). Abra config/menu-bsoft.js e substitua o texto que fica
      ENTRE AS DUAS CRASES (`...`) pelo que foi copiado. Salve e suba o arquivo no GitHub (junto com o resto, se for o caso).
   5. Pronto: na próxima abertura o sistema já usa o menu novo. (Dica: em Ambiente › Controle de Acesso o menu varia por permissão; capture com
      um usuário completo.)
   Nada sai do seu computador: o código só lê o menu que já está na página. */
(() => {
    const raiz = document.querySelector('.drawer-menu__root');
    if (!raiz) { console.error('Menu não encontrado: abra uma tela do Bsoft com o menu lateral (a barra à esquerda) e tente de novo.'); return; }
    const txt = n => n.textContent.replace(/\s+/g, ' ').trim();
    const linhas = [];
    const visita = (li, nivel) => {
        if (li.classList.contains('drawer-menu__folder-item')) {
            const t = li.querySelector(':scope > .drawer-menu__title-wrapper span');
            linhas.push('  '.repeat(nivel) + '+ ' + (t ? txt(t) : '?'));
            const lista = li.querySelector(':scope > ul');
            if (lista) [...lista.children].filter(c => c.tagName === 'LI').forEach(c => visita(c, nivel + 1));
        } else if (li.classList.contains('drawer-menu__item')) {
            const a = li.querySelector('a.drawer-menu__item__left-inner');
            if (!a) return;
            let id = '';
            try { const u = new URL(a.getAttribute('href') || '', location.href); if (/\/rotinas\/c\.php$/.test(u.pathname)) id = u.searchParams.get('id') || ''; } catch (e) { /* link sem id */ }
            linhas.push('  '.repeat(nivel) + '- ' + txt(a) + (id ? '  {' + id + '}' : ''));
        }
    };
    [...raiz.children].filter(c => c.tagName === 'LI').forEach(c => visita(c, 0));
    const saida = linhas.join('\n');
    try { copy(saida); console.log('✅ Menu copiado: ' + linhas.length + ' linhas. Cole em config/menu-bsoft.js, entre as duas crases.'); }
    catch (e) { console.log(saida); console.log('⚠️ Não consegui copiar sozinho: selecione o texto acima e copie.'); }
    return linhas.length;
})();
