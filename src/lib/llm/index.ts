import { LLMProvider } from './provider';
import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';
import { HybridGeminiProvider } from './hybrid';

export function getLLMProvider(requestedProvider?: string): LLMProvider {
  const providerType = (requestedProvider || process.env.LLM_PROVIDER || 'hybrid').toLowerCase();

  if (providerType === 'claude' || providerType === 'anthropic') {
    return new ClaudeProvider();
  }

  if (providerType === 'gemini_direct' || providerType === 'gemini') {
    return new GeminiProvider();
  }

  // Por defecto usa el motor Híbrido de Homelab (PC Bridge -> Cloud Flash-Lite)
  return new HybridGeminiProvider();
}
