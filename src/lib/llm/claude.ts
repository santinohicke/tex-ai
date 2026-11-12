import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from './provider';
import { LLMMessage } from '../rag/types';

// Modelos que admiten el reintento automático del lado del servidor si el modelo
// declina una consulta (server-side fallback).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export class ClaudeProvider implements LLMProvider {
  public name = 'Anthropic Claude';
  public lastEngine = '';
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) this.client = new Anthropic(); // lee ANTHROPIC_API_KEY
    return this.client;
  }

  async streamCompletion(
    messages: LLMMessage[],
    systemPrompt: string,
    onToken: (token: string) => void
  ): Promise<void> {
    const model = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
    // Respuestas de chat sobre fuentes ya recuperadas: esfuerzo bajo alcanza y responde más rápido
    const effort = (process.env.CLAUDE_EFFORT || 'low') as Effort;

    const anthropicMessages: Anthropic.Beta.BetaMessageParam[] = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const stream = this.getClient().beta.messages.stream({
        model,
        max_tokens: 8000,
        system: systemPrompt,
        messages: anthropicMessages,
        output_config: { effort },
        ...(FALLBACK_MODELS.has(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onToken(event.delta.text);
        }
      }

      const final = await stream.finalMessage();
      this.lastEngine = final.model;
      if (final.stop_reason === 'refusal') {
        throw new Error('Claude declinó responder esta consulta.');
      }
    } catch (err: unknown) {
      if (err instanceof Anthropic.APIError) {
        console.error(`Claude API ${err.status}:`, err.message);
        throw new Error(`Claude API ${err.status ?? ''}: ${err.message}`);
      }
      throw err instanceof Error ? err : new Error('Error desconocido al invocar Claude API');
    }
  }
}
