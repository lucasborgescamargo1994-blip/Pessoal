// ═══════════════════════════════════════════════════════════════════════════
// Edge Function: status-sefaz
// ═══════════════════════════════════════════════════════════════════════════
// Apesar do nome (mantido pra não precisar recriar a função + o cron job já
// publicados), essa função atualiza os DOIS serviços agora: SEFAZ e ANTT.
// Lê cada fonte, grava um resumo (ok/alerta + detalhes) na tabela
// "StatusServicos" do Supabase (uma linha por serviço). O app
// (index.html do sistema) só lê essa tabela.
//
// 30/09/2026 -- SEFAZ: a 1ª versão lia direto
// https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx, mas o site do
// governo recusa conexão de IP de datacenter/nuvem (onde toda Edge Function
// roda) -- testei com cabeçalho de navegador simulado e nada mudou, é
// bloqueio de rede mesmo, não de User-Agent. Trocado pra ler o Monitor Sefaz
// da Webmania (monitorsefaz.webmaniabr.com), monitoramento de terceiros
// (não é a Receita Federal) que expõe um JSON público e limpo, sem esse
// bloqueio (testado ao vivo). Construído em cima do produto Instatus
// (instatus.com) -- ver a lista de status possíveis em
// https://instatus.com/help/api.
//
// 30/09/2026 -- ANTT: não existe painel oficial de disponibilidade em tempo
// real (nem da ANTT nem de terceiros conhecido) pra ler igual o SEFAZ. Em
// vez disso, lê o selo de status público do CIOT Online
// (ciotonline.com.br/status) -- uma emissora de CIOT credenciada pela ANTT
// que roda um health-check automático DIRETO contra a base da ANTT a cada
// hora e publica o resultado. Não é dado oficial da ANTT, é a melhor
// aproximação real disponível (o registro do CIOT depende da mesma base).
// Antes disso o ANTT era atualizado manualmente pelo admin -- trocado pra
// 100% automático a pedido (30/09/2026), então esse botão foi removido do
// app.
//
// COMO PUBLICAR (painel do Supabase, não precisa de CLI):
//   1. Rode o arquivo status_servicos_setup.sql (SQL Editor) -- só precisa
//      1x, e só se a tabela/permissões ainda não existirem.
//   2. Edge Functions > abra "status-sefaz" > apague o conteúdo do editor >
//      cole este arquivo inteiro > Deploy function.
//   3. Teste manual: botão "Test"/"Invoke", método POST. Deve voltar
//      {"ok":true,"resultados":{"sefaz":{...},"antt":{...}},"erros":[]}.
//   4. Cron job já configurado antes continua funcionando sem precisar
//      mexer em nada (mesma função, mesmo agendamento a cada 5 minutos).
//
// Nenhuma chave nova precisa ser configurada -- SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY já existem automaticamente em toda Edge Function.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const URL_MONITOR_SEFAZ = 'https://monitorsefaz.webmaniabr.com/components.json';
const URL_MONITOR_ANTT = 'https://ciotonline.com.br/status';

// Valores possíveis do campo "status" de cada componente do Monitor Sefaz,
// documentados pelo Instatus (https://instatus.com/help/api) -- qualquer um
// diferente de OPERATIONAL vira alerta.
const TRADUCAO_STATUS: Record<string, string> = {
    UNDERMAINTENANCE: 'em manutenção',
    DEGRADEDPERFORMANCE: 'desempenho degradado',
    PARTIALOUTAGE: 'indisponibilidade parcial',
    MAJOROUTAGE: 'indisponibilidade total',
};

async function buscarStatusSefaz() {
    const resp = await fetch(URL_MONITOR_SEFAZ, { headers: { 'User-Agent': USER_AGENT } });
    if (!resp.ok) throw new Error(`Monitor Sefaz respondeu ${resp.status}`);
    const dados = await resp.json();
    if (!Array.isArray(dados?.components)) throw new Error('Formato inesperado -- "components" não é uma lista (o monitor pode ter mudado de layout).');

    const problemas: string[] = [];
    for (const c of dados.components) {
        if (!c || !c.status || c.status === 'OPERATIONAL') continue;
        const local = c.group?.name ? `${c.group.name} — ${c.name}` : c.name;
        problemas.push(`${local}: ${TRADUCAO_STATUS[c.status] || c.status}`);
    }

    return {
        geral: problemas.length > 0 ? 'alerta' : 'ok',
        detalhes: problemas.length > 0 ? problemas.join('\n') : null,
    };
}

async function buscarStatusAntt() {
    const resp = await fetch(URL_MONITOR_ANTT, { headers: { 'User-Agent': USER_AGENT } });
    if (!resp.ok) throw new Error(`CIOT Online respondeu ${resp.status}`);
    const html = await resp.text();

    // Selo de status embutido no rodapé de toda página do site (conferido ao
    // vivo em 30/09/2026): <span class="status-pill-label">Operando</span>.
    const match = html.match(/class="status-pill-label">([^<]+)<\/span>/i);
    if (!match) throw new Error('Selo de status não encontrado -- layout do CIOT Online pode ter mudado.');
    const label = match[1].trim();

    const geral = /operando/i.test(label) ? 'ok' : 'alerta';
    return {
        geral,
        detalhes: geral === 'alerta' ? `ANTT (via health-check da CIOT Online contra a base da ANTT): ${label}` : null,
    };
}

Deno.serve(async (_req) => {
    const sb = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const buscas: Array<['sefaz' | 'antt', () => Promise<{ geral: string; detalhes: string | null }>]> = [
        ['sefaz', buscarStatusSefaz],
        ['antt', buscarStatusAntt],
    ];

    const resultados: Record<string, unknown> = {};
    const erros: string[] = [];

    for (const [servico, buscar] of buscas) {
        try {
            const r = await buscar();
            const { error } = await sb.from('StatusServicos').upsert({
                servico,
                geral: r.geral,
                detalhes: r.detalhes,
                atualizado_em: new Date().toISOString(),
                atualizado_por: null, // sempre automático agora, nos dois serviços
            });
            if (error) throw error;
            resultados[servico] = r;
        } catch (e) {
            // Erro de leitura/gravação de UM serviço não afeta o outro, e NÃO
            // sobrescreve o último status válido salvo desse serviço -- só
            // reporta a falha, pra não mostrar "alerta" falso por causa de
            // uma instabilidade momentânea de rede ou mudança de layout.
            console.error(`[status-sefaz] ${servico}:`, e);
            erros.push(`${servico}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    const status = erros.length === buscas.length ? 500 : 200; // 500 só se os DOIS falharem
    return new Response(JSON.stringify({ ok: erros.length === 0, resultados, erros }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
});
