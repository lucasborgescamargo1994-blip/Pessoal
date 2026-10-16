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
// O que dá pra oferecer com segurança é o "Nome Interno" (id da rotina) e o sufixo de URL padrão do
// sistema, que o usuário completa com o endereço do sistema dele.
function _formatarRotinaParaPrompt(r){
    const nomeInterno=(r['Nome Interno']||'').trim();
    const caminho=nomeInterno?`https://NOMEDOCLIENTE.bsoft.app/versoes/versao5.0/rotinas/c.php?id=${nomeInterno}&menu=s`:'';
    // O link vai COM o endereço-modelo NOMEDOCLIENTE de propósito: o renderizador de respostas (renderMd, em js/core/markdown.js) troca esse link por um campo onde a pessoa cola o endereço do
    // sistema dela e por um botão "Acessar tela" que monta o link certo e abre numa nova guia. Por isso a IA deve copiá-lo EXATAMENTE como está.
    // "Menu" da tabela Rotinas é só Sim/Não (a rotina aparece como item do menu do sistema ou não) — NÃO traz o caminho do menu; esse só vale se estiver nos artigos
    const noMenu=String(r['Menu']||'').trim();
    return `Nome oficial: ${r['Descrição']||''}\nNome interno (id da rotina): ${nomeInterno||'(não informado)'}`+
        (noMenu?`\nAparece como item no menu do sistema: ${noMenu}`:'')+
        (caminho?`\nLink da tela (copie EXATAMENTE este link na resposta, sem trocar NOMEDOCLIENTE nem explicar como montar a URL: o sistema o transforma sozinho num campo onde a pessoa cola o endereço do sistema dela e num botão "Acessar tela"): ${caminho}`:'');
}
