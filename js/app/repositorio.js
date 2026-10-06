/* js/app/repositorio.js — Repositório de documentos. */
// ═══════════════════════════════════════════════════════════
//  REPOSITÓRIO DE DOCUMENTOS
// ═══════════════════════════════════════════════════════════
let repositorioCache = [], repositorioCarregado = false;

function toggleRepositorioPanel() { repositorioPanelOpen = !repositorioPanelOpen; document.getElementById('repositorioPanel').classList.toggle('open', repositorioPanelOpen); document.getElementById('repositorioTab').classList.toggle('open', repositorioPanelOpen); if (repositorioPanelOpen) { carregarRepositorio().then(() => renderizarListaRepositorio()); } }

async function carregarRepositorio() { if (repositorioCarregado && repositorioCache.length > 0) return repositorioCache; try { const response = await fetch(SCRIPT_URL + "?aba=Repositorio"); if (!response.ok) throw new Error("Erro"); const data = await response.json(); if (Array.isArray(data)) { repositorioCache = data; } else if (data.erro) { console.warn("Repositório:", data.erro); repositorioCache = []; } repositorioCarregado = true; console.log(`📁 Repositório: ${repositorioCache.length} arquivos`); return repositorioCache; } catch (e) { repositorioCache = []; repositorioCarregado = true; return []; } }

async function extrairTextoRepositorio(fileId) {
    try {
        const response = await fetch(`${SCRIPT_URL}?aba=Repositorio&action=extrairTexto&fileId=${fileId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.erro) {
            console.warn("Erro da API:", data.erro);
            return null;
        }
        return data;
    } catch(e) {
        console.error("Erro ao extrair texto:", e);
        return null;
    }
}

async function buscarNoRepositorio(query) { await carregarRepositorio(); const termos = query.toLowerCase().split(' '); return repositorioCache.filter(a => { const n = a.nome.toLowerCase(); return termos.some(t => n.includes(t)); }).slice(0, 5); }

// ═══════════════════════════════════════════════════════════
//  PRÉ-CARREGAR REPOSITÓRIO (COM CACHE INTELIGENTE)
// ═══════════════════════════════════════════════════════════
function _repoIsMidia(tipo) {
    const t = (tipo || '').toLowerCase();
    return t.includes('video') || t.includes('audio') || t.includes('image/png') || t.includes('image/jpeg');
}

async function carregarDadosRepositorio() {
    try {
        // 1. Busca lista atual de arquivos na API
        await carregarRepositorio();
        if (repositorioCache.length === 0) { console.log("📁 Repositório vazio."); return; }

        const processaveis = repositorioCache.filter(a => !_repoIsMidia(a.tipo));
        const idsAtuais    = processaveis.map(a => a.id);

        // 2. Compara com a lista em cache
        const idsCachados  = JSON.parse(localStorage.getItem(REPO_FILELIST_KEY) || '[]');
        const novosIds     = idsAtuais.filter(id => !idsCachados.includes(id));
        const removidosIds = idsCachados.filter(id => !idsAtuais.includes(id));

        let artigosCache = JSON.parse(localStorage.getItem(REPO_ARTIGOS_KEY) || '{}');
        // Vetores do repositório ficam no cache compartilhado (base64) — REPO_VECTORS_KEY guarda só metadados
        let vetoresCache = JSON.parse(localStorage.getItem(REPO_VECTORS_KEY) || '[]')
            .map(item => ({ ...item, vetor: _getEmbFromCache('repo_' + item.repoId) }))
            .filter(item => item.vetor);

        // 3. Nenhuma mudança + vetores em cache → carrega da memória local, zero chamadas à API
        if (novosIds.length === 0 && removidosIds.length === 0 && vetoresCache.length > 0) {
            manualVetorizado = manualVetorizado.filter(item => !item.isRepositorio);
            manualVetorizado.push(...vetoresCache);
            console.log(`📁 Repositório: cache válido (${vetoresCache.length} itens) — nenhuma chamada à API necessária`);
            return;
        }

        // 4. Remove arquivos deletados do cache
        if (removidosIds.length > 0) {
            console.log(`📁 ${removidosIds.length} arquivo(s) removido(s) do repositório`);
            removidosIds.forEach(id => delete artigosCache[id]);
            vetoresCache = vetoresCache.filter(v => !removidosIds.includes(v.repoId));
        }

        // 5. Extrai e vetoriza apenas os arquivos novos
        if (novosIds.length > 0) {
            console.log(`📁 ${novosIds.length} novo(s) arquivo(s) detectado(s) — extraindo...`);
            for (const id of novosIds) {
                const arquivo = processaveis.find(a => a.id === id);
                const nome = arquivo?.nome || 'Sem nome';
                try {
                    console.log(`📁 Extraindo: ${nome}...`);
                    const resultado = await extrairTextoRepositorio(id);
                    if (resultado?.texto && resultado.texto.length > 50) {
                        artigosCache[id] = { titulo: nome, conteudo: resultado.texto.substring(0, 10000), data: new Date().toISOString() };
                        const textoCompleto = `REPOSITÓRIO: ${nome} | CONTEÚDO: ${resultado.texto.substring(0, 2000)}`;
                        const vetor = await gerarEmbeddingComRetry(textoCompleto);
                        if (vetor) {
                            _saveEmbToCache('repo_' + id, vetor);
                            vetoresCache.push({ texto: textoCompleto, erro: nome, solucao: resultado.texto.substring(0, 10000), emitir: '', categoria: 'Repositório', vetor, isRepositorio: true, repoId: id });
                            console.log(`✅ Extraído e vetorizado: ${nome} (${resultado.texto.length} chars)`);
                        }
                    } else {
                        console.warn(`⚠️ Texto vazio/curto: ${nome} (${resultado?.texto?.length || 0} chars)`);
                    }
                    await new Promise(r => setTimeout(r, 300));
                } catch(e) {
                    console.error(`❌ Erro ao processar ${nome}:`, e);
                }
            }
        }

        // 6. Salva cache atualizado
        // Arquivos novos que falharam na vetorização NÃO entram na lista de processados
        // — assim tentam de novo na próxima abertura (sem ficar presos forever)
        const _idsVetorizados = new Set(vetoresCache.map(v => v.repoId));
        const _idsSemVetor = novosIds.filter(id => !_idsVetorizados.has(id));
        const _idsParaSalvar = idsAtuais.filter(id => !_idsSemVetor.includes(id));
        localStorage.setItem(REPO_FILELIST_KEY, JSON.stringify(_idsParaSalvar));
        localStorage.setItem(REPO_ARTIGOS_KEY,  JSON.stringify(artigosCache));
        // Salva apenas metadados (sem vetor) — vetores ficam no cache compartilhado (bsoft_emb_v3)
        const _vcMeta = vetoresCache.map(({ vetor, ...rest }) => rest);
        localStorage.setItem(REPO_VECTORS_KEY,  JSON.stringify(_vcMeta));

        // 7. Carrega vetores na memória
        manualVetorizado = manualVetorizado.filter(item => !item.isRepositorio);
        manualVetorizado.push(...vetoresCache);
        const _pendentes = _idsSemVetor.length > 0 ? ` (${_idsSemVetor.length} aguardando retry)` : '';
        console.log(`📁 Repositório pronto: ${vetoresCache.length} item(ns) — ${novosIds.length} novo(s), ${removidosIds.length} removido(s)${_pendentes}`);

    } catch(e) {
        console.error("❌ Erro geral no repositório:", e);
    }
}

async function forcarRecargaRepositorio() {
    appendMessage('system', '⚡ <strong>Forçando extração de todos os arquivos...</strong>');
    localStorage.removeItem(REPO_ARTIGOS_KEY);
    localStorage.removeItem(REPO_VECTORS_KEY);
    localStorage.removeItem(REPO_FILELIST_KEY);
    repositorioCarregado = false;
    repositorioCache = [];
    manualVetorizado = manualVetorizado.filter(item => !item.isRepositorio);
    await carregarDadosRepositorio();
    if (repositorioPanelOpen) {
        renderizarListaRepositorio();
    }
    const totalRepo = manualVetorizado.filter(item => item.isRepositorio).length;
    appendMessage('system', `✅ <strong>Repositório recarregado!</strong> ${totalRepo} documentos vetorizados.`);
    const badge = document.getElementById('statusBadge');
    if (badge) {
        badge.innerText = `IA Pronta (${manualVetorizado.length} itens)`;
    }
}

async function buscarConhecimentoRelevanteNoRepositorio(query) { try { await carregarRepositorio(); if (repositorioCache.length === 0) return null; const termos = query.toLowerCase().split(' ').filter(t => t.length > 2); const relevantes = repositorioCache.filter(a => { const n = a.nome.toLowerCase(); return termos.some(t => n.includes(t)); }); if (relevantes.length === 0) return null; const artigosCache = JSON.parse(localStorage.getItem(REPO_ARTIGOS_KEY) || '{}'); const textos = []; for (let i = 0; i < Math.min(relevantes.length, 3); i++) { const a = relevantes[i]; if (artigosCache[a.id]) { textos.push({ nome: a.nome, texto: artigosCache[a.id].conteudo }); continue; } try { const r = await extrairTextoRepositorio(a.id); if (r && r.texto && r.texto.length > 100) { textos.push({ nome: a.nome, texto: r.texto }); artigosCache[a.id] = { titulo: a.nome, conteudo: r.texto.substring(0, 10000), data: new Date().toISOString() }; } } catch (e) { } } localStorage.setItem(REPO_ARTIGOS_KEY, JSON.stringify(artigosCache)); if (textos.length === 0) return null; let cr = "\n=== 📁 CONHECIMENTO DO REPOSITÓRIO ===\n"; textos.forEach((d, i) => { cr += `[DOC ${i + 1}: ${d.nome}]\n${d.texto.substring(0, 2000)}\n---\n`; }); return cr; } catch (e) { return null; } }

async function renderizarListaRepositorio(arquivos = null) { const lista = document.getElementById('repositorioLista'); if (!arquivos) arquivos = repositorioCache; if (!arquivos || !Array.isArray(arquivos) || arquivos.length === 0) { lista.innerHTML = `<div style="text-align:center;padding:40px;"><div style="font-size:48px;">📭</div><p>Nenhum arquivo</p><button onclick="forcarRecargaRepositorio()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;" title="Força extração de todos os arquivos">⚡ Forçar Extração</button><button onclick="sincronizarRepositorio()" style="padding:10px 20px;background:#059669;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">🔄 Sincronizar</button></div>`; document.getElementById('repositorioStatus').textContent = '📁 Vazio'; return; } lista.innerHTML = arquivos.map(a => { const icone = (a.tipo || '').includes('pdf') ? '📄' : (a.tipo || '').includes('image') ? '🖼️' : (a.tipo || '').includes('video') ? '🎬' : (a.tipo || '').includes('spreadsheet') ? '📊' : (a.tipo || '').includes('document') ? '📝' : '📁'; const nome = a.nome || 'Sem nome'; return `<div style="padding:12px;margin:8px 0;background:white;border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="aprenderDoRepositorio('${a.id}', '${escapeHtml(nome).replace(/'/g, "\\'")}')"><div style="display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">${icone}</span><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(nome)}</div><div style="font-size:11px;color:var(--text-muted);">${formatarTamanho(a.tamanho)} • ${a.data ? new Date(a.data).toLocaleDateString('pt-BR') : 'N/A'}</div></div><button onclick="event.stopPropagation();aprenderDoRepositorio('${a.id}', '${escapeHtml(nome).replace(/'/g, "\\'")}')" style="background:var(--primary);color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">🤖</button></div></div>`; }).join(''); document.getElementById('repositorioStatus').textContent = `📁 ${arquivos.length} arquivo(s)`; }

async function sincronizarRepositorio() { appendMessage('system', '🔄 Sincronizando repositório...'); try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "sincronizarRepositorio" }) }); repositorioCarregado = false; repositorioCache = []; appendMessage('system', '✅ Sincronização concluída!'); await carregarRepositorio(); renderizarListaRepositorio(); } catch (e) { appendMessage('system', '⚠️ Erro ao sincronizar.'); } }

async function buscarERenderizarRepositorio() { const q = document.getElementById('repositorioSearchInput').value.trim(); if (!q) { renderizarListaRepositorio(); return; } renderizarListaRepositorio(await buscarNoRepositorio(q)); }

function formatarTamanho(bytes) { if (!bytes) return 'N/A'; if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB'; }

async function aprenderDoRepositorio(fileId, nome) { appendMessage('system', `📁 Aprendendo: ${nome}...`); const loading = appendLoadingCard("Extraindo..."); try { const r = await fetch(`${SCRIPT_URL}?aba=Repositorio&action=extrairTexto&fileId=${fileId}`); const d = await r.json(); loading.remove(); if (!d || d.erro) { appendMessage('system', '⚠️ Erro ao extrair.'); return; } if (!d.texto || d.texto.length < 50) { appendMessage('system', '⚠️ Texto muito curto.'); return; } const conversa = getConversaAtiva(); if (conversa) { conversa.contexto.push({ role: 'user', content: `[REPOSITÓRIO: ${nome}]: ${d.texto.substring(0, 3000)}` }); salvarConversas(); } appendMessage('system', `✅ Extraído: ${d.tamanhoTexto || d.texto.length} caracteres`); document.getElementById('searchInput').value = `Analise o documento "${nome}" do repositório`; } catch (e) { loading.remove(); appendMessage('system', '⚠️ Erro ao acessar arquivo.'); } }

// Atalhos
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); toggleCentralPanel(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'B') { e.preventDefault(); toggleBlogPanel(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'M') { e.preventDefault(); toggleManualPanel(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'R') { e.preventDefault(); toggleRepositorioPanel(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'G') { e.preventDefault(); toggleCiotPanel(); }
});

// Monitora Ctrl+V para colar nos painéis
document.addEventListener('paste', function(e) {
    if (blogPanelOpen) { setTimeout(() => { const ta = document.getElementById('blogContentArea'); if (ta && document.activeElement !== ta) { const t = (e.clipboardData || window.clipboardData).getData('text'); if (t && t.length > 200) { ta.value = t; document.getElementById('blogStatus').textContent = '📋 Texto colado!'; document.getElementById('blogStatus').style.color = '#166534'; } } }, 100); }
    if (manualPanelOpen) { setTimeout(() => { const ta = document.getElementById('manualContentArea'); if (ta && document.activeElement !== ta) { const t = (e.clipboardData || window.clipboardData).getData('text'); if (t && t.length > 200) { ta.value = t; document.getElementById('manualStatus').textContent = '📋 Texto colado!'; document.getElementById('manualStatus').style.color = '#166534'; } } }, 100); }
});


// ═══════════════════════════════════════════════════════════
//  FORÇAR ATUALIZAÇÃO DO REPOSITÓRIO
// ═══════════════════════════════════════════════════════════
async function forcarAtualizacaoRepositorio() {
    appendMessage('system', '🔄 <strong>Atualizando repositório...</strong>');
    localStorage.removeItem(REPO_ARTIGOS_KEY);
    localStorage.removeItem(REPO_VECTORS_KEY);
    localStorage.removeItem(REPO_FILELIST_KEY);
    repositorioCarregado = false;
    repositorioCache = [];
    manualVetorizado = manualVetorizado.filter(item => !item.isRepositorio);
    await carregarDadosRepositorio();
    appendMessage('system', '✅ <strong>Repositório atualizado!</strong>');
}
