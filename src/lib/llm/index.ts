import { LLMProvider } from './provider';
import { ClaudeProvider } from './claude';

export function getLLMProvider(_requestedProvider?: string): LLMProvider {
  return new ClaudeProvider();
}

export { ClaudeProvider };
export type { LLMProvider };
