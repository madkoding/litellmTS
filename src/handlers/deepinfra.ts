import type { ChatCompletion } from 'openai/resources/chat';
import {
  HandlerParams,
  HandlerParamsNotStreaming,
  HandlerParamsStreaming,
  Message,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
  type ConsistentResponse,
} from '../types';

async function* iterateResponse(
  response: Response,
): AsyncIterable<StreamingChunk> {
  const reader = response.body?.getReader();
  let done = false;

  while (!done) {
    const next = await reader?.read();
    if (next?.value) {
      done = next.done;
      const decoded = new TextDecoder().decode(next.value);
      if (decoded.startsWith('data: [DONE]')) {
        done = true;
      } else {
        const [, value] = decoded.split('data: ');
        yield JSON.parse(value);
      }
    } else {
      done = true;
    }
  }
}

async function getDeepInfraResponse(
  model: string,
  messages: Message[],
  baseUrl: string,
  apiKey: string,
  stream: boolean,
): Promise<Response> {
  return fetch(`${baseUrl}/v1/openai/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages,
      model,
      stream,
    }),
  });
}

export async function DeepInfraHandler(
  params: HandlerParamsNotStreaming,
): Promise<ResultNotStreaming>;

export async function DeepInfraHandler(
  params: HandlerParamsStreaming,
): Promise<ResultStreaming>;

export async function DeepInfraHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming>;

export async function DeepInfraHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const baseUrl = params.baseUrl ?? 'https://api.deepinfra.com';
  const apiKey = params.apiKey ?? process.env.DEEPINFRA_API_KEY!;
  const model = params.model.split('deepinfra/')[1];

  const res = await getDeepInfraResponse(
    model,
    params.messages,
    baseUrl,
    apiKey,
    params.stream ?? false,
  );

  if (params.stream) {
    return iterateResponse(res);
  }

  const body = await res.json() as ChatCompletion;

  const result: ConsistentResponse = {
    created: body.created,
    model: body.model,
    choices: body.choices.map((c) => ({
      finish_reason: c.finish_reason,
      index: c.index,
      message: {
        role: c.message.role,
        content: c.message.content,
        function_call: c.message.function_call ?? undefined,
      },
    })),
    usage: body.usage
      ? {
          prompt_tokens: body.usage.prompt_tokens,
          completion_tokens: body.usage.completion_tokens,
          total_tokens: body.usage.total_tokens,
        }
      : undefined,
  };

  return result;
}
