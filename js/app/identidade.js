/* js/app/identidade.js — Nome do usuário e identificação do dispositivo (para os logs). */
// ═══════════════════════════════════════════════════════════
//  IDENTIDADE DO USUÁRIO
// ═══════════════════════════════════════════════════════════
function getWindowsUser() {
    return localStorage.getItem('bsoft_usuario_nome') || 'Desconhecido';
}
function getOrCreateDeviceId() {
    let id = localStorage.getItem('bsoft_device_id');
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        localStorage.setItem('bsoft_device_id', id);
    }
    return id;
}
async function backfillDeviceId() {
    const userName = getWindowsUser();
    const deviceId = getOrCreateDeviceId();
    if (!userName || userName === 'Desconhecido') return;
    try {
        await sb.from('logs')
            .update({ device_id: deviceId })
            .eq('usuario_windows', userName)
            .is('device_id', null);
        console.log('✅ device_id preenchido nos logs existentes');
    } catch(e) {
        console.warn('backfillDeviceId:', e.message);
    }
}
function nomeValido(nome) {
    const n = (nome || '').trim();
    // Aceita apenas letras (incluindo acentuadas do português) e espaços — sem números, pontos, símbolos
    return n.length >= 2 && /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(n);
}
function registrarNomeUsuario() {
    const atual = localStorage.getItem('bsoft_usuario_nome') || '';
    let nome;
    do {
        nome = prompt('Seu nome (aparecerá nos logs do sistema):', atual);
        if (nome === null) return; // usuário cancelou — mantém o nome atual
        if (!nome.trim()) {
            alert('⚠️ Nome não pode estar em branco!\nPor favor, informe um nome válido.');
        } else if (!nomeValido(nome)) {
            alert('⚠️ Nome inválido!\nUse apenas letras e espaços.\nNúmeros, pontos e caracteres especiais não são permitidos.');
        }
    } while (!nome.trim() || !nomeValido(nome));
    localStorage.setItem('bsoft_usuario_nome', nome.trim());
    alert('✅ Nome registrado: ' + nome.trim());
}
function verificarNomeUsuario() {
    // Detecta nomes já salvos mas inválidos (números, pontos, símbolos)
    const nomeSalvo = localStorage.getItem('bsoft_usuario_nome');
    if (nomeSalvo && !nomeValido(nomeSalvo)) {
        localStorage.removeItem('bsoft_usuario_nome');
        alert('⚠️ O nome "' + nomeSalvo + '" é inválido (contém números ou caracteres especiais).\nPor favor, informe um nome válido para continuar.');
    }
    while (!localStorage.getItem('bsoft_usuario_nome')) {
        const nome = prompt('👋 Olá! Para continuar, informe seu nome — ele aparecerá nos logs do sistema.\n(Apenas letras e espaços. Campo obrigatório, não é possível pular)');
        if (nome === null || !nome.trim()) {
            alert('⚠️ Nome obrigatório! Informe seu nome para continuar.');
        } else if (!nomeValido(nome)) {
            alert('⚠️ Nome inválido!\nUse apenas letras e espaços.\nNúmeros, pontos e caracteres especiais não são permitidos.');
        } else {
            localStorage.setItem('bsoft_usuario_nome', nome.trim());
        }
    }
}
