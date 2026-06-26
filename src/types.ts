export type Role = 'system' | 'user' | 'assistant' | 'function' | 'tool';

/** A single message in a chat conversation. */
export interface Message {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
}

export type FinishReason =
  | 'stop'
  | 'length'
  | 'function_call'
  | 'content_filter'
  | 'tool_calls';

export interface ConsistentResponseChoice {
  finish_reason: FinishReason | null;
  index: number;
  message: {
    role: string | null | undefined;
    content: string | null | undefined;
    reasoning?: string;
    function_call?: {
      arguments: string;
      name: string;
    };
    tool_calls?: {
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }[];
  };
}

export interface ConsistentResponseStreamingChoice
  extends Omit<ConsistentResponseChoice, 'message'> {
  delta: Omit<ConsistentResponseChoice['message'], 'function_call' | 'tool_calls'> & {
    reasoning?: string;
    function_call?: {
      arguments?: string;
      name?: string;
    };
    tool_calls?: {
      id?: string;
      type?: 'function';
      function?: { name?: string; arguments?: string };
    }[];
  };
}

export interface ConsistentResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Normalized completion response shared across all providers. */
export interface ConsistentResponse {
  choices: ConsistentResponseChoice[];
  model?: string;
  created?: number;
  usage?: ConsistentResponseUsage;
}

export type ResultNotStreaming = ConsistentResponse;

export interface StreamingChunk extends Omit<ConsistentResponse, 'choices'> {
  choices: ConsistentResponseStreamingChoice[];
}

export type ResultStreaming = AsyncIterable<StreamingChunk>;

export type Result = ResultNotStreaming | ResultStreaming;

/** Parameters accepted by all completion handlers. */
export interface HandlerParamsBase {
  model: string;
  messages: Message[];
  stream?: boolean | null;
  baseUrl?: string;
  temperature?: number | null;
  top_p?: number | null;
  stop?: string | null | string[];
  presence_penalty?: number | null;
  frequency_penalty?: number | null;
  repetition_penalty?: number | null;
  top_k?: number | null;
  n?: number | null;
  max_tokens?: number | null;
  apiKey?: string;
  functions?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }[];
  function_call?:
    | 'none'
    | 'auto'
    | { name: string };
  tools?: {
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
  thinking?: { type: 'enabled' | 'disabled'; budget_tokens?: number };
}

export interface HandlerParamsStreaming extends HandlerParamsBase {
  stream?: true;
}

export interface HandlerParamsNotStreaming extends HandlerParamsBase {
  stream?: false;
}

export type HandlerParams = HandlerParamsStreaming | HandlerParamsNotStreaming;

/** Parameters for embedding requests. */
export interface EmbeddingParams {
  input: string | string[];
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/** A single embedding vector and its index. */
export interface EmbeddingObject {
  embedding: number[];
  index: number;
}

/** Normalized embedding response shared across all providers. */
export interface EmbeddingResponse {
  usage?: Pick<import('openai/resources').CompletionUsage, 'prompt_tokens' | 'total_tokens'>;
  model: string;
  data: EmbeddingObject[];
}

export type Handler = (params: HandlerParams) => Promise<Result>;
export type EmbeddingHandler = (
  params: EmbeddingParams,
) => Promise<EmbeddingResponse>;
