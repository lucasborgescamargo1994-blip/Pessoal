/* js/app/machine-learning.js — Aprendizado automático (conhecimento da internet). */
// ═══════════════════════════════════════════════════════════
//  MACHINE LEARNING
// ═══════════════════════════════════════════════════════════
async function buscarConhecimentoInternet(query) {
    appendMessage('ml', '🧠 <strong>Machine Learning Ativado</strong> — Buscando conhecimento em fontes confiáveis...');
    const p = `Você é um especialista em sistemas ERP para transportadoras (Bsoft TMS). Não invente caminhos no sistema ou informações que não encontrar. Pergunta NÃO encontrada no manual: "${query}". Responda JSON: {"erro":"título","solucao":"solução detalhada com menus","fonte":"site confiável","confianca":0.8}. Se não souber, confianca:0.`;
    try { const r = await callMCPSemPensamento([{ role: 'user', content: p }], { temperature: 0.3, maxTokens: 2048, responseFormat: { type: 'json_object' } }); let parsed = null; try { parsed = JSON.parse(r.text); } catch (e) { const c = r.text.replace(/```json\n?|\n?```/g, '').trim(); try { parsed = JSON.parse(c); } catch (e2) {} } return parsed; } catch (e) { return null; }
}
async function salvarMLNaPlanilha(erro, solucao, fonte) { try { await sb.from('machine_learning').insert({erro, solucao, fonte, data: new Date().toISOString()}); } catch (e) {} }

async function ativarMachineLearning(query) {
    const conversa = getConversaAtiva();
    appendMessage('ml', '🧠 <strong>Iniciando Machine Learning...</strong>');
    const lm = appendLoadingCard("🌐 Buscando em fontes confiáveis...");
    const rml = await buscarConhecimentoInternet(query);
    lm.remove();
    if (!rml || !rml.erro || !rml.solucao || rml.confianca < 0.4) { appendMessage('ml', '😕 <strong>ML:</strong> Não foi possível encontrar resposta confiável.'); adicionarMensagemNaConversa('ml', 'ML: Não encontrou.'); return; }
    const novo = adicionarMLKnowledge(rml.erro, rml.solucao, rml.fonte || 'Internet', rml.confianca || 0.6);
    await salvarMLNaPlanilha(rml.erro, rml.solucao, rml.fonte || 'Internet');
    if (conversa) { conversa.mlKnowledgeId = novo.id; salvarConversas(); }
    const txc = `DÚVIDA: ${rml.erro} | PROCEDIMENTO: ${rml.solucao}`;
    const nv = await gerarEmbedding(txc);
    if (nv) { manualVetorizado.push({ texto: txc, erro: rml.erro, solucao: rml.solucao, emitir: '', categoria: 'Machine Learning', vetor: nv, isML: true, mlId: novo.id }); }
    const card = document.createElement('div'); card.className = 'answer-card ml-card'; card._mlKnowledgeId = novo.id;
    card.innerHTML = `<div style="background:var(--ml-light);padding:8px 15px;border-bottom:1px solid var(--ml-border);font-size:11px;color:var(--ml-color);display:flex;align-items:center;gap:8px;">🧠 <strong>Machine Learning</strong><span class="ml-badge">NOVO CONHECIMENTO</span></div><div class="answer-section"><div class="section-label ml"><div class="section-icon ml">🔍</div>Pergunta</div><div class="section-content"><b>${escapeHtml(rml.erro)}</b></div></div><div class="answer-section"><div class="section-label how"><div class="section-icon how">✅</div>Resposta</div><div class="section-content">${formatarTexto(rml.solucao)}</div></div><div class="answer-section"><div class="section-label tip"><div class="section-icon tip">🌐</div>Fonte</div><div class="section-content">${escapeHtml(rml.fonte || 'Internet')}<span class="ml-source-tag">🤖 Adquirido automaticamente</span></div></div><div class="feedback-area"><span>Útil? <small style="color:var(--ml-color);">(Negativo = remove)</small></span><button class="feedback-btn" onclick="saveMLFeedback('${novo.id}','positivo',this)">👍 Confirmar</button><button class="feedback-btn" onclick="saveMLFeedback('${novo.id}','negativo',this)">👎 Descartar</button><button onclick="novaConversa()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);transition:all .2s;" onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">➕ Nova conversa</button></div>`;
    document.getElementById('chatStream').appendChild(card); scrollToBottom(true);
    const rt = rml.solucao.replace(/\*\*(.*?)\*\*/g, '$1'); adicionarMensagemNaConversa('ml', `[ML] ${rml.erro}: ${rt}`);
    appendMessage('ml', '✅ <strong>Conhecimento salvo!</strong> Disponível para futuras consultas.');
}

async function saveMLFeedback(id, tipo, btn) {
    const fa = btn.parentElement;
    if (tipo === 'positivo') { confirmarMLKnowledge(id); fa.innerHTML = "<span style='color:#166534;font-weight:700;'>✅ Conhecimento confirmado!</span>"; setTimeout(() => { manualVetorizado = []; loadData(); }, 2000); }
    else { marcarMLKnowledgeNegativo(id); manualVetorizado = manualVetorizado.filter(item => !(item.isML && item.mlId === id)); fa.innerHTML = "<span style='color:#dc2626;font-weight:700;'>🗑️ Conhecimento removido.</span>"; }
}

async function processarProximaSolucao(po) {
    if (filaSolucoes.length === 0) { appendMessage('ai', '😕 <b>Não encontrei mais soluções</b> no manual para essa pergunta. Tente <b>reformular</b> ou pergunte sobre outro assunto do Bsoft TMS.'); adicionarMensagemNaConversa('ai', 'Não encontrei mais soluções no manual. Reformule a pergunta ou pergunte sobre outro assunto.'); return; }
    const sa = filaSolucoes.shift(); appendMessage('system', '🔍 Outra solução do manual...');
    document.getElementById('searchInput').value = `Solução alternativa: ${sa.erro}`; await handleChat();
}
