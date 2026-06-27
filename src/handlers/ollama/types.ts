export interface QwenGenerateChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaResponseChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: {
      type: 'function';
      function: { name: string; arguments: string };
    }[];
  };
  done: boolean;
}

export interface OpenAIChatChunk {
  choices: {
    index: number;
    delta?: {
      role?: string;
      content?: string;
      reasoning?: string;
      tool_calls?: {
        index?: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }[];
    };
    message?: {
      role: string;
      content?: string;
      reasoning?: string;
      tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason: string | null;
  }[];
}
