/* js/app/rejeicoes-sefaz.js — Banco local de rejeições SEFAZ. */
// ═══════════════════════════════════════════════════════════
//  BANCO LOCAL DE REJEIÇÕES SEFAZ
// ═══════════════════════════════════════════════════════════
let bancoRejeicoes = [], bancoRejeicoesCarregado = false;
async function carregarBancoRejeicoes() { if (bancoRejeicoesCarregado && bancoRejeicoes.length > 0) return bancoRejeicoes; try { const {data, error} = await sb.from('RejeicoesSEFAZ').select('*'); if (error) throw error; if (Array.isArray(data)) { bancoRejeicoes = data; bancoRejeicoesCarregado = true; } } catch (e) { bancoRejeicoes = []; } return bancoRejeicoes; }
// dest: id da ferramenta em aba ('sefaz') ou nada, para escrever no chat (consulta digitada na conversa).
function wizardRejeicaoSefaz(showBancoDados = false, dest) {
    return new Promise(resolve => {
        document.querySelectorAll('#sefazWizardCard').forEach(c => c.remove());   // um assistente só por vez (os botões dele usam funções globais)
        const s = Ferr.stream(dest);
        const card = document.createElement('div');
        card.id = 'sefazWizardCard';
        card.className = 'answer-card';
        card.innerHTML = `
<div style="background:linear-gradient(135deg,#fef3c7,#fff7ed);padding:10px 15px;border-bottom:1px solid #fde68a;font-size:12px;color:#92400e;font-weight:700;border-radius:12px 12px 0 0;">🌐 Consulta de Rejeição SEFAZ</div>
<div class="answer-section">
    <div class="section-label path" style="margin-bottom:10px;">📄 Tipo de documento</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="_sefazWizTipo('CT-e',this)" class="_sefaz-tipo-btn" style="padding:10px 22px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;">CT-e</button>
        <button onclick="_sefazWizTipo('MDF-e',this)" class="_sefaz-tipo-btn" style="padding:10px 22px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;">MDF-e</button>
        <button onclick="_sefazWizTipo('NF-e',this)" class="_sefaz-tipo-btn" style="padding:10px 22px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;">NF-e</button>
        <button onclick="_sefazWizTipo('NFS-e',this)" class="_sefaz-tipo-btn" style="padding:10px 22px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;">NFS-e</button>
        ${showBancoDados ? `<button onclick="_sefazWizBancoDados()" style="padding:10px 22px;background:#f0fdf4;color:#166534;border:2px solid #bbf7d0;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">💬 Consultar no banco de dados</button>` : ''}
    </div>
</div>
<div id="sefazWizStep2" style="display:none;" class="answer-section">
    <div class="section-label path" style="margin-bottom:10px;">🔢 Código da rejeição</div>
    <div style="display:flex;gap:8px;align-items:center;">
        <input id="sefazWizCodigo" type="text" inputmode="numeric" placeholder="Ex: 203"
            style="padding:10px 14px;border:2px solid var(--border);border-radius:8px;font-size:15px;font-family:inherit;outline:none;width:140px;transition:border-color .2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"
            onkeydown="if(event.key==='Enter')_sefazWizBuscar()">
        <button onclick="_sefazWizBuscar()"
            style="padding:10px 22px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:opacity .15s;"
            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">🔍 Buscar</button>
    </div>
</div>`;
        s.appendChild(card);
        ferrRolar(dest, true);

        window._sefazWizTipoSel = null;
        window._sefazWizTipo = (tipo, btn) => {
            window._sefazWizTipoSel = tipo;
            document.querySelectorAll('._sefaz-tipo-btn').forEach(b => {
                b.style.background = '#f3f4f6'; b.style.color = '#374151'; b.style.borderColor = '#e5e7eb';
            });
            btn.style.background = 'var(--primary)'; btn.style.color = 'white'; btn.style.borderColor = 'var(--primary)';
            document.getElementById('sefazWizStep2').style.display = 'block';
            const inpTipo = document.getElementById('sefazWizCodigo');
            if (inpTipo) {
                // NFS-e permite letras no código (ex: E305); demais tipos são só numéricos.
                if (tipo === 'NFS-e') { inpTipo.setAttribute('inputmode', 'text'); inpTipo.placeholder = 'Ex: 305 ou E305'; }
                else { inpTipo.setAttribute('inputmode', 'numeric'); inpTipo.placeholder = 'Ex: 203'; }
            }
            setTimeout(() => { const inp = document.getElementById('sefazWizCodigo'); if (inp) inp.focus(); }, 80);
            ferrRolar(dest, true);
        };
        window._sefazWizBuscar = () => {
            const tipo = window._sefazWizTipoSel;
            const inp = document.getElementById('sefazWizCodigo');
            const codigo = inp ? inp.value.trim() : '';
            if (!tipo) return;
            if (!codigo) { if (inp) { inp.style.borderColor = '#ef4444'; inp.focus(); } return; }
            card.remove();
            window._sefazWizTipo = null; window._sefazWizBuscar = null; window._sefazWizBancoDados = null;
            resolve({ tipo, codigo });
        };
        window._sefazWizBancoDados = () => {
            card.remove();
            window._sefazWizTipo = null; window._sefazWizBuscar = null; window._sefazWizBancoDados = null;
            resolve({ bancoDados: true });
        };
    });
}
function ehErroSefaz(query) {
    const q = normalizarSinonimos(query);
    const pr = [
        "rejeicao", "rejeição", "rejeitado", "rejeitada",
        "falha",
        "sefaz", "fisco", "fazenda", "receita",
        "codigo de rejeicao", "codigo de rejeição", 
        "código de rejeição", "motivo de rejeicao", "motivo de rejeição"
    ];
    return pr.some(p => q.includes(p)) || /rejei[cç][aã]o\s+\d{3,4}/.test(q);
}

// Normaliza código de rejeição para comparação. Zeros à esquerda são sempre ignorados
// (ex: "0310" === "310"). Para NFS-e, letra(s) no início também são descartadas — são só
// formatação (ex: "E0310" === "0310" === "310") — assim uma única entrada no banco cobre
// todas as variações; os demais tipos (CT-e, MDF-e, NF-e) aceitam somente dígitos.
function _normCodigoRejeicao(codigo, tipoDoc) {
    let c = String(codigo || '').trim();
    if (tipoDoc && tipoDoc.toUpperCase() === 'NFS-E') {
        c = c.toUpperCase().replace(/^[A-Z]+/, '').replace(/^0+(?=.)/, '');
        return c || '0';
    }
    c = c.replace(/\D/g, '').replace(/^0+/, '');
    return c || '0';
}
async function gerarRespostaSefaz(codigo, tipoDoc, dest) {
    const ld = ferrCarregando(dest, `🔍 Buscando rejeição ${codigo} (${tipoDoc})...`);
    const li = Date.now();
    await carregarBancoRejeicoes();
    const codigoNorm = _normCodigoRejeicao(codigo, tipoDoc);
    let re = null;
    if (bancoRejeicoes.length > 0) {
        // Busca restrita ao tipo selecionado — sem fallback cruzando tipos de documento,
        // pois o mesmo código pode significar coisas diferentes em CT-e, NF-e, MDF-e e NFS-e.
        re = bancoRejeicoes.find(r =>
            r['Tipo Doc'] && r['Tipo Doc'].toLowerCase() === tipoDoc.toLowerCase() &&
            _normCodigoRejeicao(r['Código'], r['Tipo Doc']) === codigoNorm
        );
    }
    ld.remove();
    if (re) {
        const da = re['Dicas'] ? re['Dicas'].split('|').map(d => d.trim()).filter(Boolean) : [];
        renderizarCardRejeicaoLocal(re, da, li, dest);
        ferrConversa(dest, 'ai', `Rejeição ${re['Código']} (${re['Tipo Doc']}): ${re['Significado']}`);
    } else {
        ferrMsg(dest, 'ai', `❌ Rejeição <b>${codigo}</b> (${tipoDoc}) não encontrada no manual interno. Verifique diretamente no portal SEFAZ ou entre em contato com seu líder de equipe.`);
        ferrConversa(dest, 'ai', `Rejeição ${codigo} (${tipoDoc}) não encontrada no manual.`);
    }
}

function renderizarCardRejeicaoLocal(re, dicas, li, dest) { const s = Ferr.stream(dest); const c = document.createElement('div'); c.className = 'answer-card'; let h = `<div style="background:#f0fdf4;padding:8px 15px;border-bottom:1px solid #bbf7d0;font-size:11px;color:#166534;">📚 Banco Local • ${re['Fonte'] || 'Tecnospeed'}</div>`; h += `<div class="answer-section"><div class="section-label path">🔢 Código</div><div style="font-size:28px;font-weight:800;color:#dc2626;">${re['Código']}</div></div>`; if (re['Tipo Doc']) h += `<div class="answer-section"><div class="section-label path">📄 Tipo</div><div class="section-content"><b>${re['Tipo Doc']}</b></div></div>`; if (re['Significado']) h += `<div class="answer-section"><div class="section-label how">📋 Significado</div><div class="section-content">${formatarTexto(re['Significado'])}</div></div>`; if (re['Causa']) h += `<div class="answer-section"><div class="section-label path">🔍 Causa</div><div class="section-content">${formatarTexto(re['Causa'])}</div></div>`; if (re['Solução']) h += `<div class="answer-section"><div class="section-label how">✅ Solução</div><div class="section-content">${formatarTexto(re['Solução'])}</div></div>`; if (dicas && dicas.length > 0) h += `<div class="answer-section"><div class="section-label how">💡 Dicas</div><div class="section-content">${dicas.map(d => `• ${d}`).join('<br>')}</div></div>`; h += `<div class="feedback-area"><span>Ajudou?</span><button class="feedback-btn" onclick="saveFeedback(${li},'positivo',this)">👍</button><button class="feedback-btn" onclick="saveFeedback(${li},'negativo',this)">👎</button>${ferrBotaoNovoHtml(dest)}</div>`; c.innerHTML = h; s.appendChild(c); ferrRolar(dest, true); }
function renderizarCardRejeicaoIA(parsed, tr, li, dest) { const s = Ferr.stream(dest); const c = document.createElement('div'); c.className = 'answer-card'; let h = `<div style="background:#fef3c7;padding:8px 15px;border-bottom:1px solid #fde68a;font-size:11px;color:#92400e;">🤖 Resposta IA</div>`; if (parsed) { if (parsed.codigo) h += `<div class="answer-section"><div class="section-label path">🔢 Código</div><div style="font-size:28px;font-weight:800;color:#dc2626;">${parsed.codigo}</div></div>`; if (parsed.significado) h += `<div class="answer-section"><div class="section-label how">📋 Significado</div><div class="section-content">${formatarTexto(parsed.significado)}</div></div>`; if (parsed.causa) h += `<div class="answer-section"><div class="section-label path">🔍 Causa</div><div class="section-content">${formatarTexto(parsed.causa)}</div></div>`; if (parsed.solucao) h += `<div class="answer-section"><div class="section-label how">✅ Solução</div><div class="section-content">${formatarTexto(parsed.solucao)}</div></div>`; } else { h += `<div class="answer-section"><div class="section-content">${formatarTexto(tr)}</div></div>`; } h += `<div class="feedback-area"><span>Ajudou?</span><button class="feedback-btn" onclick="saveFeedback(${li},'positivo',this)">👍</button><button class="feedback-btn" onclick="saveFeedback(${li},'negativo',this)">👎</button>${ferrBotaoNovoHtml(dest)}</div>`; c.innerHTML = h; s.appendChild(c); ferrRolar(dest, true); }

function formatarTexto(texto) { return _linkify(texto).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }

// ── ferramenta em aba (Workspace → "Erros SEFAZ"): tipo de documento → código → resposta ──
// O log da consulta é gravado quando o usuário busca um código (não ao abrir a aba), então abrir a aba só para olhar não gera registro.
Ferr.registrar('sefaz', {
    async iniciar() {
        const r = await wizardRejeicaoSefaz(false, 'sefaz');
        if (!r || !r.codigo) return;
        ferrLog('sefaz', `Erros Sefaz - ${r.codigo} (${r.tipo})`, true);
        await gerarRespostaSefaz(r.codigo, r.tipo, 'sefaz');
    },
});
