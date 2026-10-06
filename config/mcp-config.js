/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DA IA (MCP = Multi-Cloud Provider)

   Este é o arquivo que a Área Administrativa edita (aba "IA / MCP" → Salvar).
   Depois de salvar, é só subir este arquivo no GitHub: o sistema confere uma nova versão a cada
   2 horas (enquanto estiver aberto) e passa a usar a configuração atualizada sozinho.

   Se for editar à mão: mantenha o formato JSON válido (aspas duplas, sem vírgula sobrando no fim).
   As chaves ficam divididas em pedaços ("chave": [ ... ]) — o sistema junta os pedaços.
   Atenção: qualquer chave num sistema que roda no navegador pode ser vista por quem abrir o
   DevTools; use só chaves gratuitas/limitadas (ver README).
   ═══════════════════════════════════════════════════════════════════════════ */
window.BSOFT_MCP_CONFIG = {
  "versao": 3,
  "atualizadoEm": "2026-10-06T15:29:12.265Z",
  "atualizadoPor": "admin",
  "provedor": {
    "tipo": "openrouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "chave": [
      "sk-or-v1-4f5f373376",
      "08150b806689797fef2f32",
      "f4e7b62ba4eb967fc47f13850bb4decc"
    ]
  },
  "cadeia": [
    {
      "modelo": "inclusionai/ling-3.0-flash-sante:free",
      "ativo": true
    },
    {
      "modelo": "cohere/north-mini-code:free",
      "ativo": true
    }
  ],
  "rascunho": {
    "ativo": true,
    "modelo": "cohere/north-mini-code:free"
  },
  "prioritario": {
    "ativo": false,
    "tipo": "openrouter",
    "baseUrl": "",
    "chave": [],
    "modelo": ""
  },
  "visao": [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free"
  ],
  "embeddings": {
    "modelo": "jina-embeddings-v3",
    "chave": [
      "jina_59e554b4ce3e4bfba5f7550ddb515ec7",
      "O3wfZe11iXINaz3azhRgd0-xpE5L"
    ]
  },
  "respostasRapidas": {
    "ativo": true,
    "limiarLexical": 0.65,
    "limiarSemantico": 0.92,
    "minTermos": 2
  }
};
