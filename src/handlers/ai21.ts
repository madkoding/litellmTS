import {
  FinishReason,
  HandlerParams,
  ResultNotStreaming,
  ResultStreaming,
} from '../types';
import { combinePrompts } from '../utils/combinePrompts';

import { iterateSSEStream } from '../utils/sse';
import { stripPrefix } from '../utils/stripPrefix';
import { nowSec } from '../utils/nowSec';

const FINISH_REASON_MAP: Record<string, FinishReason> = {
  length: 'length',
  endoftext: 'stop',
};

interface AI21GeneratedToken {
  generatedToken: {
    token: string;
    logprob: number;
    raw_logprob: number;
  };
}

interface AI21Response {
  id: string;
  prompt: {
    text: string;
    tokens: AI21GeneratedToken[];
  };
  completions: {
    finishReason: {
      reason: string;
    };
    data: {
      text: string;
      tokens: AI21GeneratedToken[];
    };
  }[];
}

function toUsage(response: AI21Response): {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
} {
  const promptTokens = response.prompt.tokens.length;
  const completionTokens = response.completions.reduce((acc, completion) => {
    return acc + completion.data.tokens.length;
  }, 0);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

function toResponse(response: AI21Response, model: string): ResultNotStreaming {
  const choices = response.completions.map((completion, i) => {
    return {
      finish_reason:
        FINISH_REASON_MAP[completion.finishReason.reason] ?? 'stop',
      index: i,
      message: {
        content: completion.data.text,
        role: 'assistant',
      },
    };
  });
  return {
    model: model,
        created: nowSec(),
    usage: toUsage(response),
    choices: choices,
  };
}

async function getAI21Response(
  model: string,
  prompt: string,
  baseUrl: string,
  apiKey: string,
  stream?: boolean,
): Promise<Response> {
  const body: Record<string, unknown> = { prompt };
  if (stream) body.stream = true;
  return fetch(`${baseUrl}/studio/v1/${model}/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      accept: stream ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify(body),
  });
}

interface AI21StreamChunk {
  text?: string;
  finishReason?: { reason: string };
  prompt?: { tokens: AI21GeneratedToken[] };
}

export async function AI21Handler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const baseUrl = params.baseUrl ?? 'https://api.ai21.com';
  const apiKey = params.apiKey ?? process.env.AI21_API_KEY;
  if (!apiKey) throw new Error('AI21 requires an API key. Set AI21_API_KEY environment variable or pass apiKey in params.');
  const modelName = stripPrefix(params.model, 'ai21/');
  const prompt = combinePrompts(params.messages);

  const res = await getAI21Response(modelName, prompt, baseUrl, apiKey, params.stream ?? false);

  if (!res.ok) {
    throw new Error(`Received an error with code ${res.status} from AI21 API.`);
  }

  if (params.stream) {
    return iterateSSEStream(res, (payload) => {
      const parsed = JSON.parse(payload) as AI21StreamChunk;
      return {
        model: modelName,
    created: nowSec(),
        choices: [
          {
            delta: { content: parsed.text ?? '', role: 'assistant' },
            finish_reason: parsed.finishReason
              ? (FINISH_REASON_MAP[parsed.finishReason.reason] ?? 'stop')
              : null,
            index: 0,
          },
        ],
      };
    });
  }

  const body = (await res.json()) as AI21Response;
  return toResponse(body, modelName);
}

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('ai21/', AI21Handler);
