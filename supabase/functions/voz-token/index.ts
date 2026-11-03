// ═══════════════════════════════════════════════════════════════════════════
// Edge Function: voz-token
// ═══════════════════════════════════════════════════════════════════════════
// Entrega ao navegador um TOKEN TEMPORÁRIO da API do Google (Gemini Live) para a "Chamada de voz ao vivo"
// (js/app/voz-ao-vivo.js), SEM mostrar a chave do Google para quem usa o sistema.
//   • O token vale 10 minutos e só pode abrir até 3 conversas (a 1ª precisa começar em 1 minuto) — se alguém copiar um, o estrago é mínimo.
//   • A chave de verdade fica só aqui, nos "secrets" do Supabase (GEMINI_API_KEY).
//   • É GRÁTIS: use uma chave do AI Studio criada num projeto SEM cobrança ativada. Se a cota grátis do Google acabar, a chamada falha com
//     aviso e o sistema abre a conversa por voz rápida — nunca gera cobrança.
//   • Limite de uso: por pessoa (IP, guardado só como "hash") a cada 10 minutos e no total por dia. Precisa do sql/08_voz_tokens.sql;
//     sem ele a função funciona igual, só que sem esse limite (continua valendo o limite do próprio Google).
//
// COMO PUBLICAR (painel do Supabase, não precisa de CLI):
//   1. Crie a chave em https://aistudio.google.com/apikey ("Criar chave de API") num projeto SEM cobrança ativada.
//   2. Supabase › Edge Functions › Secrets: crie  GEMINI_API_KEY = a chave.
//      Opcionais:  VOZ_ORIGENS = https://seu-site.github.io,http://localhost:8080   (só esses sites podem pedir token; vazio = qualquer um)
//                  VOZ_LIMITE_IP = 8 (por pessoa a cada 10 min)   ·   VOZ_LIMITE_DIA = 300 (total por dia)
//   3. Edge Functions › "Deploy a new function" › nome  voz-token  › cole este arquivo inteiro › Deploy.
//      Deixe "Verify JWT" LIGADO: o sistema já manda a chave pública (anon) do Supabase.
//   4. (Recomendado) SQL Editor: rode o arquivo sql/08_voz_tokens.sql, uma vez.
//   5. Teste: botão "Invoke", método POST → deve voltar  {"token":"auth_tokens/…","expira":"…"}.
//   6. Pronto: no painel administrativo (aba IA / MCP › cartão "Voz ao vivo"), APAGUE a chave do campo, abra "Avançado" e escreva o nome da função (voz-token),
//      ligue "Ligada para todos", salve e suba o arquivo — a chave nunca vai para o arquivo público nem para os navegadores.
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente em toda Edge Function.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_TOKENS = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';
const ORIGENS = (Deno.env.get('VOZ_ORIGENS') || '').split(',').map((s) => s.trim()).filter(Boolean);
const LIMITE_IP = Number(Deno.env.get('VOZ_LIMITE_IP') || 8);
const LIMITE_DIA = Number(Deno.env.get('VOZ_LIMITE_DIA') || 300);

function cabecalhos(req: Request) {
  const origem = req.headers.get('origin') || '';
  const permitida = !ORIGENS.length || ORIGENS.includes(origem);
  return {
    permitida,
    h: {
      'Access-Control-Allow-Origin': permitida ? (origem || '*') : ORIGENS[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    } as Record<string, string>,
  };
}
const resp = (corpo: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...h, 'Content-Type': 'application/json' } });

// O IP nunca é guardado: só um "hash" dele (LGPD), suficiente para contar chamadas por pessoa.
async function hashDoIp(req: Request): Promise<string> {
  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'desconhecido').split(',')[0].trim();
  const bytes = new TextEncoder().encode('bsoft-voz:' + ip);
  const dig = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(dig.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Devolve a mensagem de recusa se passou do limite; null se pode seguir. Sem a tabela (SQL 08) não limita.
async function passouDoLimite(hash: string): Promise<string | null> {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const desde = (ms: number) => new Date(Date.now() - ms).toISOString();
    const [a, b] = await Promise.all([
      sb.from('voz_tokens').select('id', { count: 'exact', head: true }).eq('ip', hash).gte('criado_em', desde(10 * 60 * 1000)),
      sb.from('voz_tokens').select('id', { count: 'exact', head: true }).gte('criado_em', desde(24 * 60 * 60 * 1000)),
    ]);
    if (a.error || b.error) return null; // tabela ainda não criada: segue sem limite próprio
    if ((a.count ?? 0) >= LIMITE_IP) return 'Muitas chamadas seguidas. Tente de novo em alguns minutos.';
    if ((b.count ?? 0) >= LIMITE_DIA) return 'O limite diário de chamadas de voz foi atingido. Tente amanhã.';
    await sb.from('voz_tokens').insert({ ip: hash });
    await sb.from('voz_tokens').delete().lt('criado_em', desde(2 * 24 * 60 * 60 * 1000)); // limpeza de registros antigos
    return null;
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const { permitida, h } = cabecalhos(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return resp({ erro: 'Use POST.' }, 405, h);
  if (!permitida) return resp({ erro: 'Este site não está autorizado a pedir token de voz.' }, 403, h);

  const chave = Deno.env.get('GEMINI_API_KEY');
  if (!chave) return resp({ erro: 'Falta o secret GEMINI_API_KEY no Supabase (ver o cabeçalho desta função).' }, 500, h);

  const recusa = await passouDoLimite(await hashDoIp(req));
  if (recusa) return resp({ erro: recusa }, 429, h);

  const agora = Date.now();
  const corpo = {
    uses: 3, // 1 conversa + 1 retomada se a conexão cair + 1 tentativa com o modelo de reserva
    expireTime: new Date(agora + 10 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(agora + 60 * 1000).toISOString(),
  };
  let r: Response;
  try {
    r = await fetch(GOOGLE_TOKENS, {
      method: 'POST',
      headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    return resp({ erro: 'Não consegui falar com o Google: ' + (e as Error).message }, 502, h);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.name) {
    return resp({ erro: 'O Google recusou criar o token: ' + (j?.error?.message || 'HTTP ' + r.status) }, 502, h);
  }
  return resp({ token: j.name, expira: corpo.expireTime }, 200, h);
});
