/* js/app/estado.js — Estado das conversas e base local de aprendizado (ML). */
// ═══════════════════════════════════════════════════════════
//  SISTEMA DE CONVERSAS LOCAL
// ═══════════════════════════════════════════════════════════
// No simulador (?sim=1) o histórico usa chaves próprias e começa vazio: os testes do administrador não se misturam com as conversas reais dele.
const _SUFIXO_SIM = window.BSOFT_SIM ? '_sim' : '';
const CONVERSAS_KEY = 'bsoft_conversas_v2' + _SUFIXO_SIM;
const CONVERSA_ATIVA_KEY = 'bsoft_conversa_ativa_v2' + _SUFIXO_SIM;
const ML_KNOWLEDGE_KEY = 'bsoft_ml_knowledge_v1' + _SUFIXO_SIM;
if (window.BSOFT_SIM) { try { [CONVERSAS_KEY, CONVERSA_ATIVA_KEY, ML_KNOWLEDGE_KEY].forEach(k => localStorage.removeItem(k)); } catch (e) { /* sem localStorage */ } }
const CENTRAL_ARTIGOS_KEY = 'bsoft_central_artigos';
const BLOG_ARTIGOS_KEY = 'bsoft_blog_artigos';
const MANUAL_ARTIGOS_KEY = 'bsoft_repositorio_cache';
const REPO_ARTIGOS_KEY = 'bsoft_repositorio_cache';
const REPO_VECTORS_KEY  = 'bsoft_repositorio_vetores';
const REPO_FILELIST_KEY = 'bsoft_repositorio_filelist';

let conversas = [];
let conversaAtivaId = null;
let mlKnowledge = [];

// ═══════════════════════════════════════════════════════════
//  ML KNOWLEDGE
// ═══════════════════════════════════════════════════════════
function carregarMLKnowledge() {
    try { const saved = localStorage.getItem(ML_KNOWLEDGE_KEY); mlKnowledge = saved ? JSON.parse(saved) : []; } catch(e) { mlKnowledge = []; }
}
function salvarMLKnowledge() { try { localStorage.setItem(ML_KNOWLEDGE_KEY, JSON.stringify(mlKnowledge)); } catch(e) {} }
function adicionarMLKnowledge(erro, solucao, fonte, similaridade) {
    const novo = { id: 'ml_' + Date.now(), erro, solucao, fonte, similaridade, dataCriacao: new Date().toISOString(), confirmado: false, feedbackNegativo: false };
    mlKnowledge.unshift(novo); salvarMLKnowledge(); return novo;
}
function removerMLKnowledge(id) { mlKnowledge = mlKnowledge.filter(k => k.id !== id); salvarMLKnowledge(); }
function confirmarMLKnowledge(id) { const k = mlKnowledge.find(k => k.id === id); if (k) { k.confirmado = true; k.feedbackNegativo = false; salvarMLKnowledge(); } }
function marcarMLKnowledgeNegativo(id) {
    const k = mlKnowledge.find(k => k.id === id);
    if (k) { k.feedbackNegativo = true; k.confirmado = false; salvarMLKnowledge(); removerDoBancoPlanilha(k.erro); }
}
async function removerDoBancoPlanilha(erro) {
    try { await sb.from('machine_learning').delete().eq('erro', erro); } catch(e) {}
}
