import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';

import {
  HandlerParams,
  HandlerParamsNotStreaming,
  ResultStreaming,
  ResultNotStreaming,
  HandlerParamsStreaming,
} from '../types';

function toOpenAIMessages(
  messages: HandlerParams['messages'],
): ChatCompletionMessageParam[] {
  return messages as ChatCompletionMessageParam[];
}

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
          },
          index: openAIChoice.index,
          finish_reason: openAIChoice.finish_reason,
        };
      }),
    };
  }
}

export async function OpenAIHandler(
  params: HandlerParamsNotStreaming,
): Promise<ResultNotStreaming>;

export async function OpenAIHandler(
  params: HandlerParamsStreaming,
): Promise<ResultStreaming>;

export async function OpenAIHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming>;

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

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });

  const messages = toOpenAIMessages(completionsParams.messages);

  if (params.stream) {
    const response = await openai.chat.completions.create({
      ...completionsParams,
      stream: true as const,
      messages,
    }) as unknown as AsyncIterable<ChatCompletionChunk>;
    return toStreamingResponse(response);
  }

  const response = await openai.chat.completions.create({
    ...completionsParams,
    stream: false as const,
    messages,
  }) as unknown as ChatCompletion;

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
