import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';

import {
  HandlerParams,
  ResultStreaming,
  ResultNotStreaming,
} from '../types';
import { registerModelProvider } from '../models';

async function* toStreamingResponse(
  response: AsyncIterable<ChatCompletionChunk>,
): ResultStreaming {
  for await (const chunk of response) {
    yield {
      model: chunk.model,
      created: chunk.created,
      choices: chunk.choices.map((openAIChoice) => {
        return {
          delta: {
            content: openAIChoice.delta.content,
            role: openAIChoice.delta.role,
            function_call: openAIChoice.delta.function_call,
            tool_calls: openAIChoice.delta.tool_calls,
            reasoning: (openAIChoice.delta as any).reasoning,
          },
          index: openAIChoice.index,
          finish_reason: openAIChoice.finish_reason,
        };
      }),
    };
  }
}

export async function OpenAIHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const {
    apiKey: providedApiKey,
    baseUrl: providedBaseUrl,
    ...completionsParams
  } = params;
  const apiKey = providedApiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = providedBaseUrl ?? 'https://api.openai.com/v1';
  const modelName = completionsParams.model.startsWith('openai/')
    ? completionsParams.model.slice(7)
    : completionsParams.model;

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });

  const messages = completionsParams.messages as ChatCompletionMessageParam[];

  if (params.stream) {
    let response: AsyncIterable<ChatCompletionChunk>;
    try {
      response = await openai.chat.completions.create({
        ...completionsParams,
        model: modelName,
        stream: true,
        messages,
      });
    } catch (err) {
      throw new Error(`OpenAI API error: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
    return toStreamingResponse(response);
  }

  let response: ChatCompletion;
  try {
    response = await openai.chat.completions.create({
      ...completionsParams,
      model: modelName,
      stream: false,
      messages,
    });
  } catch (err) {
    throw new Error(`OpenAI API error: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  const result: ResultNotStreaming = {
    created: response.created,
    model: response.model,
    choices: response.choices.map((c) => ({
      finish_reason: c.finish_reason,
      index: c.index,
      message: {
        role: c.message.role,
        content: c.message.content,
        function_call: c.message.function_call ?? undefined,
        tool_calls: c.message.tool_calls as any,
      },
    })),
    usage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : undefined,
  };

  return result;
}

registerModelProvider('openai', async ({ apiKey } = {}) => {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) return [];
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const { data } = await res.json();
  return data.map((m: any) => ({ id: m.id, provider: 'openai', created: m.created }));
});

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('openai/', OpenAIHandler);
