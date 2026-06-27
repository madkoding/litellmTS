import { Cohere, CohereClient } from 'cohere-ai';

import {
  HandlerParams,
  ResultStreaming,
  ResultNotStreaming,
  Message,
} from '../types';

import { registerModelProvider } from '../models';
import { stripPrefix } from '../utils/stripPrefix';
import { wrapApiError } from '../utils/wrapApiError';
import { nowSec } from '../utils/nowSec';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { mergeSystem } from '../utils/mergeSystem';

function toChatHistory(messages: Message[]): {
  message: string;
  chatHistory?: Cohere.Message[];
  preamble?: string;
} {
  const { system, messages: chatMessages } = mergeSystem(messages);

  let lastUserMessage = '';
  const chatHistory: Cohere.Message[] = [];

  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    const isLastUser = i === chatMessages.length - 1 && msg.role === 'user';

    if (isLastUser) {
      lastUserMessage = msg.content ?? '';
    } else if (msg.role === 'user') {
      chatHistory.push({ role: 'USER', message: msg.content ?? '' });
    } else if (msg.role === 'assistant') {
      chatHistory.push({ role: 'CHATBOT', message: msg.content ?? '' });
    }
  }

  if (!lastUserMessage && chatMessages.length > 0) {
    const last = chatMessages[chatMessages.length - 1];
    lastUserMessage = last.content ?? '';
  }

  return {
    message: lastUserMessage,
    ...(chatHistory.length > 0 ? { chatHistory } : {}),
    ...(system ? { preamble: system } : {}),
  };
}

export async function CohereHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error('Cohere requires an API key. Set COHERE_API_KEY environment variable or pass apiKey in params.');

  const modelName = stripPrefix(params.model, 'cohere/');

  const cohere = new CohereClient({ token: apiKey });
  const { message, chatHistory, preamble } = toChatHistory(params.messages);

  const chatParams: Cohere.ChatRequest = {
    model: modelName,
    message,
    ...(chatHistory ? { chatHistory } : {}),
    ...(preamble ? { preamble } : {}),
    maxTokens: params.max_tokens ?? 50,
    temperature: params.temperature ?? 1,
  };

  try {
    if (params.stream) {
      const stream = await cohere.chatStream({
        ...chatParams,
      });
      return toStreamingResponse(stream, modelName);
    }

    const { text, finishReason, meta } = await cohere.chat(chatParams);

    return {
      model: modelName,
      created: nowSec(),
      usage: meta?.tokens
        ? {
            prompt_tokens: meta.tokens.inputTokens ?? 0,
            completion_tokens: meta.tokens.outputTokens ?? 0,
            total_tokens: (meta.tokens.inputTokens ?? 0) + (meta.tokens.outputTokens ?? 0),
          }
        : undefined,
      choices: [
        {
          message: {
            content: text,
            role: 'assistant',
          },
          finish_reason: toFinishReason(finishReason),
          index: 0,
        },
      ],
    };
  } catch (err) {
    throw wrapApiError('Cohere', err);
  }
}

function toFinishReason(
  reason: string | null | undefined,
): 'stop' | 'length' | 'content_filter' {
  if (reason === 'MAX_TOKENS' || reason === 'ERROR_LIMIT') {
    return 'length';
  }
  if (reason === 'ERROR_TOXIC') {
    return 'content_filter';
  }
  return 'stop';
}

async function* toStreamingResponse(
  stream: AsyncIterable<Cohere.StreamedChatResponse>,
  model: string,
): ResultStreaming {
  for await (const event of stream) {
    if (event.eventType === 'text-generation') {
      yield {
        model,
        created: nowSec(),
        choices: [
          {
            delta: { content: event.text, role: 'assistant' },
            finish_reason: null,
            index: 0,
          },
        ],
      };
    } else if (event.eventType === 'stream-end') {
      yield {
        model,
        created: nowSec(),
        choices: [
          {
            delta: { content: '', role: 'assistant' },
            finish_reason: toFinishReason(event.finishReason),
            index: 0,
          },
        ],
      };
    }
  }
}

registerModelProvider('cohere', async ({ apiKey } = {}) => {
  const key = apiKey ?? process.env.COHERE_API_KEY;
  if (!key) return [];
  const res = await fetchWithTimeout('https://api.cohere.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  const json = await res.json() as { models?: { id: string }[] };
  return (json.models ?? []).map((m) => ({ id: m.id, provider: 'cohere' }));
});

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('cohere/', CohereHandler);
