import Anthropic from '@anthropic-ai/sdk';

// Llamadas cortas a Claude con salida JSON validada por esquema (structured outputs).
// Se usan para reescribir repreguntas y para el reranking: un modelo rápido alcanza.
export const FAST_MODEL = process.env.RAG_FAST_MODEL || 'claude-haiku-5-5';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // Se crea al primer uso para que el build no necesite la API key
  if (!client) client = new Anthropic();
  return client;
}

type JsonSchema = { type?: string; properties?: Record<string, JsonSchema>; items?: JsonSchema; [k: string]: unknown };

// Structured outputs exige additionalProperties: false en cada objeto del esquema.
function strict(schema: JsonSchema): JsonSchema {
  const s: JsonSchema = { ...schema };
  if (s.type === 'object') {
    s.additionalProperties = false;
    if (s.properties) {
      s.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, strict(v)]));
    }
  }
  if (s.items) s.items = strict(s.items);
  return s;
}

export async function generateJSON<T>(
  prompt: string,
  schema: object,
  opts: { timeoutMs?: number; model?: string; maxTokens?: number } = {}
): Promise<{ data: T; model: string }> {
  const model = opts.model || FAST_MODEL;
  const res = await getClient().messages.create(
    {
      model,
      max_tokens: opts.maxTokens || 2048,
      // Puntuar o reescribir no necesita razonamiento extendido: en Haiku se desactiva para
      // bajar la latencia (otros modelos, como Opus 5.5, no permiten desactivarlo)
      ...(model.includes('haiku') ? { thinking: { type: 'disabled' as const } } : {}),
      output_config: { format: { type: 'json_schema', schema: strict(schema as JsonSchema) } },
      messages: [{ role: 'user', content: prompt }],
    },
    { timeout: opts.timeoutMs || 12000, maxRetries: 1 }
  );
  if (res.stop_reason === 'refusal') throw new Error('Claude declinó la solicitud');
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { data: JSON.parse(text) as T, model };
}
