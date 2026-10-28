/* js/app/rotinas.js — Rotinas do sistema (telas/funções cadastradas). */
// ═══════════════════════════════════════════════════════════
//  ROTINAS DO SISTEMA (telas/funções cadastradas no Supabase) -- usado em "Analisar tela" pra
//  confirmar o nome oficial da tela identificada pela IA de visão, e no chat normal pra responder
//  "onde fica X" com o nome/id reais da rotina, em vez de arriscar inventar.
// ═══════════════════════════════════════════════════════════
// Mesma técnica de sobreposição de palavras já usada pra Parâmetros/Funcionalidades -- não precisa
// gerar embedding pras ~3.800 rotinas, busca por palavra-chave já é suficiente aqui (nomes curtos).
function _buscarRotinasRelevantes(texto, limite=5){
    if(!dadosRotinas.length)return [];
    const _n = t => String(t||'').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,'');
    const palavras = _n(texto).split(/\s+/).filter(w=>w.length>2);
    if(!palavras.length)return [];
    const minSim = Math.min(2, palavras.length)/palavras.length; // pelo menos 2 palavras batem (ou 100% se só tiver 1)
    return dadosRotinas
        .map(r=>{
            const txt = _n((r['Descrição']||'')+' '+(r['Nome Interno']||''));
            const sim = palavras.filter(w=>txt.includes(w)).length/palavras.length;
            return {item:r, sim};
        })
        .filter(x=>x.sim>=minSim)
        .sort((a,b)=>b.sim-a.sim)
        .slice(0,limite);
}
// O "Diretório" da tabela Rotinas é só organização interna do banco de rotinas, NÃO é o caminho de
// menu nem a URL real (cada cliente Bsoft tem seu próprio domínio, ex. https://NOMEDOCLIENTE.bsoft.app).
// O que dá pra oferecer com segurança é o "Nome Interno" (id da rotina) e o caminho no menu real.
function _formatarRotinaParaPrompt(r){
    const nomeInterno=(r['Nome Interno']||'').trim();
    // (v28.26: a rotina não leva mais o link da tela — o campo "Acessar tela" foi retirado; fica o nome oficial, o nome interno e o caminho no menu.)
    // "Menu" da tabela Rotinas é só Sim/Não (a rotina aparece como item do menu do sistema ou não) — NÃO traz o caminho do menu. O caminho vem do MENU REAL do sistema
    // (config/menu-bsoft.js): o id da rotina (Nome Interno) é o mesmo id que o menu usa no link de cada tela, então dá para ligar uma coisa à outra (até 2 caminhos).
    const noMenu=String(r['Menu']||'').trim();
    let caminhosMenu=[]; try{ if(nomeInterno&&typeof MenuBsoft!=='undefined') caminhosMenu=MenuBsoft.caminhosDoId(nomeInterno).slice(0,2); }catch(e){ /* sem o menu: segue sem o caminho */ }
    return `Nome oficial: ${r['Descrição']||''}\nNome interno (id da rotina): ${nomeInterno||'(não informado)'}`+
        // o menu real manda: se a tela está nele, ela aparece no menu (mesmo que a coluna Menu do banco esteja defasada)
        ((caminhosMenu.length||noMenu)?`\nAparece como item no menu do sistema: ${caminhosMenu.length?'Sim':noMenu}`:'')+
        (caminhosMenu.length?`\nCaminho no menu: ${caminhosMenu.join('   OU   ')}`:'');
}
