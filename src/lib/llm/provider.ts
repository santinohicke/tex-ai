import { LLMMessage } from '../rag/types';

export interface LLMProvider {
  name: string;
  streamCompletion(
    messages: LLMMessage[],
    systemPrompt: string,
    onToken: (token: string) => void
  ): Promise<void>;
}
