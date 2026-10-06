/* js/ui/base.js — Catálogo de ferramentas (abas) e ajudantes da interface (utilitários em js/core/util.js, ícones em js/core/icons.js). */
'use strict';
const IS_PIP = window.self !== window.top;
const V = {};   // módulos publicados (V.Workspace, V.Space, ...) — evita depender da ordem de definição

/* ── ferramentas (cada uma vira uma aba) ─────────────────────────────────── */
const TOOLS = {
    chat:    { label: 'Chat', short: 'Chat', icon: 'chat', color: '#f97316', pane: 'paneChat', desc: 'Converse com a IA do suporte' },
    space:   { label: 'Meu Espaço', short: 'Meu Espaço', icon: 'note', color: '#d97706', pane: 'paneSpace', desc: 'Suas anotações pessoais — ficam só no seu computador', kw: 'notas anotacoes bloco' },
    // Agenda: tarefas, cronograma e lembretes. Aba própria; os dados ficam na mesma pasta local do Meu Espaço (js/ui/agenda-*.js).
    agenda:  { label: 'Minha Agenda', short: 'Agenda', icon: 'calendar', color: '#ea580c', pane: 'paneAgenda', desc: 'Tarefas, cronograma e lembretes — ficam só no seu computador', kw: 'agenda tarefas calendario cronograma lembretes compromissos responsavel prazo' },
    // Assistentes que antes escreviam dentro do chat: agora cada um abre na sua própria aba (js/app/ferramentas.js) e o chat segue intacto.
    sefaz:   { label: 'Erros SEFAZ', short: 'SEFAZ', icon: 'alert', color: '#dc2626', pane: 'paneSefaz', ferr: true, desc: 'Significado e solução de uma rejeição da SEFAZ', kw: 'rejeicao rejeição erro codigo sefaz cte mdfe nfe nfse fisco' },
    regra:   { label: 'Criar Regra', short: 'Regras', icon: 'checksq', color: '#7c3aed', pane: 'paneRegra', ferr: true, desc: 'Monte regras de frete arrastando os campos', kw: 'regra regras frete contrato faturamento cte montar criar' },
    relatorios: { label: 'Assistente de Relatórios', short: 'Relatórios', icon: 'chart', color: '#2563eb', pane: 'paneRelatorios', ferr: true, desc: 'Gera o arquivo .dat de um relatório personalizado', kw: 'relatorio relatorios dat arquivo colunas campos' },
    params:  { label: 'Parâmetros / Funcionalidades', short: 'Parâmetros', icon: 'gear', color: '#0891b2', pane: 'paneParams', ferr: true, desc: 'Descubra qual parâmetro ou funcionalidade habilitar', kw: 'parametro parametros funcionalidade funcionalidades habilitar permissao configurar' },
    news:    { label: 'Novidades', short: 'Novidades', icon: 'bell', color: '#7c3aed', pane: 'newsPanel', desc: 'Avisos e atualizações do sistema', kw: 'avisos atualizacoes novidades' },
    central: { label: 'Central de Ajuda', short: 'Central', icon: 'life', color: '#0891b2', pane: 'centralPanel', desc: 'Artigos oficiais da Bsoft', kw: 'ajuda artigos suporte' },
    manual:  { label: 'Manual Técnico', short: 'Manual', icon: 'book', color: '#2563eb', pane: 'manualPanel', desc: 'Documentação técnica no Confluence', kw: 'confluence documentacao' },
    blog:    { label: 'Blog Bsoft', short: 'Blog', icon: 'file', color: '#dc2626', pane: 'blogPanel', desc: 'Artigos e novidades legais', kw: 'artigos noticias' },
    repo:    { label: 'Repositório', short: 'Repositório', icon: 'folder', color: '#059669', pane: 'repositorioPanel', desc: 'Documentos que a IA já aprendeu', kw: 'documentos arquivos pdf' },
    ciot:    { label: 'Geolocalizador CIOT', short: 'CIOT', icon: 'pin', color: '#10b981', pane: 'ciotPanel', desc: 'Validador de rotas e distâncias', kw: 'rota mapa distancia ciot' },
    yt:      { label: 'YouTube Bsoft', short: 'YouTube', icon: 'play', color: '#ef4444', pane: 'ytPanel', desc: 'Vídeos e tutoriais do canal', kw: 'videos tutoriais youtube' },
};
const TOOL_ORDER = ['chat', 'space', 'agenda', 'sefaz', 'regra', 'relatorios', 'params', 'news', 'central', 'manual', 'blog', 'repo', 'ciot', 'yt'];
const TOOL_FIXED = ['chat', 'space', 'agenda', 'news'];   // na ordem "mais usados primeiro" estes continuam no topo da lateral
const LEGACY_FN = { central: 'toggleCentralPanel', blog: 'toggleBlogPanel', manual: 'toggleManualPanel', repo: 'toggleRepositorioPanel', ciot: 'toggleCiotPanel', yt: 'toggleYTPanel' };
// Flags antigos (lidos pelo handler global de colar texto): agora significam "painel visível na tela".
const LEGACY_FLAG = {
    central: v => { centralPanelOpen = v; }, blog: v => { blogPanelOpen = v; }, manual: v => { manualPanelOpen = v; },
    repo: v => { repositorioPanelOpen = v; }, ciot: v => { ciotPanelOpen = v; }, yt: v => { ytPanelOpen = v; },
};
const wrap = (name, fn) => { const orig = window[name]; if (typeof orig !== 'function') return false; window[name] = function () { return fn.call(this, orig, arguments); }; return true; };
