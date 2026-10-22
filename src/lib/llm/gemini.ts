import { GoogleGenAI } from '@google/genai';
import { LLMProvider } from './provider';
import { LLMMessage } from '../rag/types';

export class GeminiProvider implements LLMProvider {
  public name = 'Google Gemini (Pro/Flash)';
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!apiKey) {
      console.warn('Advertencia: GEMINI_API_KEY no encontrada en las variables de entorno.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async streamCompletion(
    messages: LLMMessage[],
    systemPrompt: string,
    onToken: (token: string) => void
  ): Promise<void> {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // Formatear mensajes para el SDK de Google GenAI
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    try {
      const responseStream = await this.ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2, // Baja temperatura para estricta fidelidad al contexto RAG
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          onToken(text);
        }
      }
    } catch (err: unknown) {
      console.error('Error en GeminiProvider:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido al invocar Gemini API';
      throw new Error(`Gemini LLM Error: ${message}`);
    }
  }
}
