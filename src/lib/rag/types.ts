export interface DocumentChunk {
  id: string;
  sourceDoc: string;
  title: string;
  section: string;
  content: string;
  tokensApprox: number;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamEvent {
  type: 'token' | 'source' | 'done' | 'error';
  content?: string;
  source?: {
    title: string;
    section: string;
    file: string;
    snippet: string;
  };
}
