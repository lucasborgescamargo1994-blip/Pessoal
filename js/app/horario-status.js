/* js/app/horario-status.js — Saudação por horário de Brasília e selos Status SEFAZ / ANTT. */
// ═══════════════════════════════════════════════════════════
//  SAUDAÇÃO POR HORÁRIO DE BRASÍLIA (GMT-3)
// ═══════════════════════════════════════════════════════════
function obterHoraBrasilia() {
    const agora = new Date();
    const offsetBrasilia = -3;
    const utc = agora.getTime() + (agora.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * offsetBrasilia));
}
function getBrasiliaTimestamp() {
    // Subtrai 3h do UTC para obter horário de Brasília, grava com Z (sem offset)
    // Supabase armazena e exibe 14:30 em vez de 17:30 UTC no painel
    const h = new Date(new Date().getTime() - 3 * 3600000);
    const p = n => String(n).padStart(2, '0');
    const ms = String(h.getUTCMilliseconds()).padStart(3, '0');
    return `${h.getUTCFullYear()}-${p(h.getUTCMonth()+1)}-${p(h.getUTCDate())}T${p(h.getUTCHours())}:${p(h.getUTCMinutes())}:${p(h.getUTCSeconds())}.${ms}Z`;
}
function obterSaudacao() {
    const hora = obterHoraBrasilia().getHours();
    const diaSemana = obterHoraBrasilia().getDay();
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    let saudacao = '', emoji = '';
    if (hora >= 5 && hora < 12) { saudacao = 'Bom dia'; emoji = '☀️'; }
    else if (hora >= 12 && hora < 18) { saudacao = 'Boa tarde'; emoji = '🌤️'; }
    else if (hora >= 18 && hora < 23) { saudacao = 'Boa noite'; emoji = '🌙'; }
    else { saudacao = 'Boa madrugada'; emoji = '🌜'; }
    if (diaSemana === 0 || diaSemana === 6) { emoji = '🌟'; }
    return { saudacao, emoji, hora, diaSemana: diasSemana[diaSemana], dataCompleta: obterHoraBrasilia().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'America/Sao_Paulo' }) };
}
function obterContextoHorario() { const info = obterSaudacao(); return `📅 Hoje é ${info.diaSemana}, ${info.dataCompleta} (Horário de Brasília). ${info.emoji} ${info.saudacao}!`; }
function atualizarBadgeHorario() { const badge = document.getElementById('horarioBadge'); if (badge) { const info = obterSaudacao(); badge.textContent = `${info.emoji} Brasília • ${info.dataCompleta}`; } }
atualizarBadgeHorario(); setInterval(atualizarBadgeHorario, 60000);

// ═══════════════════════════════════════════════════════════
//  STATUS SEFAZ / ANTT (badges no cabeçalho)
// ═══════════════════════════════════════════════════════════
// Os dois preenchidos automaticamente pela mesma Edge Function agendada no Supabase (a cada 5
// minutos), do lado do servidor -- direto do navegador esbarraria em CORS/bloqueio de rede em
// ambas as fontes. SEFAZ lê o Monitor Sefaz da Webmania; ANTT lê o selo de status da CIOT Online
// (health-check deles direto na base da ANTT) -- nenhum painel oficial de disponibilidade em
// tempo real existe pra ANTT, essa é a melhor aproximação real disponível. Os dois lêem/gravam na
// mesma tabela "StatusServicos" (1 linha por serviço).
let _statusServicos = { sefaz: null, antt: null };
async function _statusCarregar() {
    try {
        const { data, error } = await sb.from('StatusServicos').select('*');
        if (error) throw error;
        (data || []).forEach(row => { _statusServicos[row.servico] = row; });
    } catch (e) { console.warn('[status] Falha ao carregar status SEFAZ/ANTT:', e); }
    _statusRenderBadges();
}
function _statusRenderBadges() {
    [['sefaz', 'statusSefazBadge', 'SEFAZ'], ['antt', 'statusAnttBadge', 'ANTT']].forEach(([servico, elId, nome]) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const row = _statusServicos[servico];
        el.classList.remove('ok', 'alerta');
        el.textContent = `Status ${nome}`;
        if (!row) { el.title = `Status ${nome} ainda não carregado`; return; }
        if (row.geral === 'alerta') {
            el.classList.add('alerta');
            el.title = `Status ${nome}: instabilidade — clique para detalhes`;
        } else {
            el.classList.add('ok');
            el.title = `Status ${nome}: tudo normal — clique para detalhes`;
        }
    });
}
function _statusAbrirCard(servico) {
    const row = _statusServicos[servico];
    const nome = servico === 'sefaz' ? 'SEFAZ' : 'ANTT';
    document.getElementById('statusServicoCard')?.remove();
    const card = document.createElement('div');
    card.id = 'statusServicoCard';
    card.className = 'pop-card';
    const ancora = document.getElementById(servico === 'sefaz' ? 'statusSefazBadge' : 'statusAnttBadge');
    const r = ancora ? ancora.getBoundingClientRect() : { left: 16, bottom: 54, width: 0 };
    card.style.cssText = `position:fixed;top:${Math.round(r.bottom + 10)}px;left:${Math.max(12, Math.min(Math.round(r.left), window.innerWidth - 360))}px;z-index:3200;max-width:340px;font-size:12.5px;`;
    const atualizadoTxt = row?.atualizado_em ? new Date(row.atualizado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
    const corpo = !row
        ? 'Status ainda não carregado.'
        : row.geral === 'ok'
        ? '✅ Todos os serviços operando normalmente.'
        : `⚠️ Instabilidade detectada:<div style="margin-top:6px;padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;white-space:pre-wrap;font-family:monospace;font-size:11.5px;color:#92400e;">${escapeHtml(row.detalhes || 'Sem detalhes informados.')}</div>`;
    card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="font-size:13px;">Status ${nome}</strong>
            <button onclick="document.getElementById('statusServicoCard').remove()" style="border:none;background:none;cursor:pointer;font-size:14px;color:var(--text-muted);">✕</button>
        </div>
        <div>${corpo}</div>
        <div style="margin-top:8px;font-size:10.5px;color:var(--text-muted);">Atualizado em: ${atualizadoTxt}</div>
    `;
    document.body.appendChild(card);
    setTimeout(() => {
        document.addEventListener('click', function _statusFecharCard(e) {
            if (!card.contains(e.target) && e.target.id !== 'statusSefazBadge' && e.target.id !== 'statusAnttBadge') {
                card.remove();
                document.removeEventListener('click', _statusFecharCard);
            }
        });
    }, 50);
}
// Oculta botões desnecessários quando rodando dentro do Copilot (iframe PiP)
if (window.self !== window.top) {
    document.addEventListener('DOMContentLoaded', function() {
        ['btnCopilotHeader','btnMCPHeader','btnDBEditorHeader','btnLogHeader','statusBadge'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var menuBtn = document.querySelector('.btn-toggle-sidebar');
        if (menuBtn) menuBtn.style.display = 'none';
    });
}
