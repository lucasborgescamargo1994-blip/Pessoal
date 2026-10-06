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
    const caminho=nomeInterno?`/versoes/versao5.0/rotinas/c.php?id=${nomeInterno}&menu=s`:'';
    return `Nome oficial: ${r['Descrição']||''}\nNome interno (id da rotina): ${nomeInterno||'(não informado)'}`+
        (caminho?`\nCaminho técnico (o usuário precisa completar ANTES com o endereço do sistema dele, ex.: https://NOMEDOCLIENTE.bsoft.app): ${caminho}`:'');
}
