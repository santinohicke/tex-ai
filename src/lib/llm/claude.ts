import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from './provider';
import { LLMMessage } from '../rag/types';

export class ClaudeProvider implements LLMProvider {
  public name = 'Anthropic Claude (3.5 Sonnet / Haiku)';
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      console.warn('Advertencia: ANTHROPIC_API_KEY no encontrada.');
    }
    this.client = new Anthropic({ apiKey });
  }

  async streamCompletion(
    messages: LLMMessage[],
    systemPrompt: string,
    onToken: (token: string) => void
  ): Promise<void> {
    const model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

    // Filtrar mensajes de sistema si existiesen y mapear al formato Anthropic
    const anthropicMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      const stream = await this.client.messages.create({
        model,
        max_tokens: 1500,
        temperature: 0.2,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          onToken(chunk.delta.text);
        }
      }
    } catch (err: unknown) {
      console.error('Error en ClaudeProvider:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido al invocar Claude API';
      throw new Error(`Claude LLM Error: ${message}`);
    }
  }
}
