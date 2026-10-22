import { LLMProvider } from './provider';
import { LLMMessage } from '../rag/types';
import { GoogleGenAI } from '@google/genai';
import http from 'http';

/**
 * Hybrid LLM Provider:
 * 1. Intenta conectarse al puente de inferencia local/LAN configurado en PC_BRIDGE_URL.
 * 2. Si el puente no responde: Conmuta inmediatamente al fallback en la nube de Google
 *    invocando la API oficial de Gemini.
 */
export class HybridGeminiProvider implements LLMProvider {
  public name = 'Hybrid Provider (Local Bridge / Cloud Gemini Fallback)';
  private ai: GoogleGenAI | null = null;
  private bridgeCandidates = [
    process.env.PC_BRIDGE_URL || 'http://127.0.0.1:8099',
    process.env.PC_BRIDGE_FALLBACK_LAN || 'http://localhost:8099',
    'http://127.0.0.1:8099',
  ];

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  private async checkBridgeOnline(): Promise<string | null> {
    for (const baseUrl of this.bridgeCandidates) {
      try {
        const isOnline = await new Promise<boolean>((resolve) => {
          const req = http.get(`${baseUrl}/health`, { timeout: 800 }, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              try {
                const j = JSON.parse(data);
                resolve(j.status === 'online');
              } catch {
                resolve(false);
              }
            });
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });

        if (isOnline) {
          return baseUrl;
        }
      } catch {
        // Fallback al siguiente candidato
      }
    }
    return null;
  }

  async streamCompletion(
    messages: LLMMessage[],
    systemPrompt: string,
    onToken: (token: string) => void
  ): Promise<void> {
    // 1. Verificar si el puente de inferencia está online
    const onlineBridge = await this.checkBridgeOnline();

    if (onlineBridge) {
      try {
        // Preparar prompt consolidado para agy-cli a través del bridge
        const conversationText = messages
          .map((m) => `${m.role === 'assistant' ? 'Asistente' : 'Usuario'}: ${m.content}`)
          .join('\n\n');

        const fullPrompt = `${systemPrompt}\n\n--- HISTORIAL DE CONVERSACIÓN ---\n${conversationText}\n\nAsistente:`;

        const bridgePayload = JSON.stringify({
          prompt: fullPrompt,
          model: 'gemini-3.8-flash-high',
          timeout: 45,
        });

        const outputText = await new Promise<string>((resolve, reject) => {
          const req = http.request(
            `${onlineBridge}/infer`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bridgePayload),
              },
              timeout: 45000,
            },
            (res) => {
              let body = '';
              res.on('data', (c) => (body += c));
              res.on('end', () => {
                try {
                  const j = JSON.parse(body);
                  if (j.status === 'ok') {
                    resolve(j.output || '');
                  } else {
                    reject(new Error(j.message || 'Error en bridge output'));
                  }
                } catch (e) {
                  reject(e);
                }
              });
            }
          );

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout conectando al bridge'));
          });

          req.write(bridgePayload);
          req.end();
        });

        // Enviar respuesta en chunks para mantener compatibilidad con streaming SSE
        const chunkSize = 20;
        for (let i = 0; i < outputText.length; i += chunkSize) {
          onToken(outputText.slice(i, i + chunkSize));
        }
        return;
      } catch (bridgeErr) {
        console.warn('Bridge falló o dio timeout, conmutando a Google Cloud directa:', bridgeErr);
      }
    }

    // 2. Fallback de Nube Directa (PC apagada o fuera de red): Gemini Flash-Lite Latest
    if (!this.ai) {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      if (!key) {
        throw new Error(
          'PC Bridge offline y no hay GEMINI_API_KEY configurada para el fallback Flash-Lite.'
        );
      }
      this.ai = new GoogleGenAI({ apiKey: key });
    }

    const fallbackModel =
      process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    try {
      const responseStream = await this.ai.models.generateContentStream({
        model: fallbackModel,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          onToken(text);
        }
      }
    } catch (err: unknown) {
      console.error('Error en Cloud Fallback Flash-Lite:', err);
      // Cascada de último recurso: gemini-2.0-flash-lite
      try {
        const emergencyStream = await this.ai.models.generateContentStream({
          model: 'gemini-2.0-flash-lite',
          contents,
          config: { systemInstruction: systemPrompt, temperature: 0.2 },
        });
        for await (const chunk of emergencyStream) {
          if (chunk.text) onToken(chunk.text);
        }
      } catch (emergencyErr) {
        const msg = emergencyErr instanceof Error ? emergencyErr.message : 'Error invocando API';
        throw new Error(`Fallback Flash-Lite error: ${msg}`);
      }
    }
  }
}
