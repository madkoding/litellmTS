import {
  HandlerParams,
  ResultNotStreaming,
  ResultStreaming,
  type ConsistentResponseUsage,
  type FinishReason,
} from '../types';
import { getValidToken } from '../auth/refresh';
import { iterateSSEStream } from '../utils/sse';
import { COPILOT_API, USER_AGENT, EDITOR_VERSION, EDITOR_PLUGIN_VERSION, COPILOT_INTEGRATION_ID } from '../auth/constants';

interface StreamChoice {
  delta?: { content?: string | null; role?: string | null };
  index?: number;
  finish_reason?: string | null;
}

interface StreamResponse {
  model?: string;
  created?: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  choices?: StreamChoice[];
}

function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': USER_AGENT,
    'Editor-Version': EDITOR_VERSION,
    'Editor-Plugin-Version': EDITOR_PLUGIN_VERSION,
    'Copilot-Integration-Id': COPILOT_INTEGRATION_ID,
    'Openai-Intent': 'conversation-edits',
  };
}

function toUsage(data: {
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}): ConsistentResponseUsage | undefined {
  if (!data.usage) return undefined;
  return {
    prompt_tokens: data.usage.prompt_tokens ?? 0,
    completion_tokens: data.usage.completion_tokens ?? 0,
    total_tokens: data.usage.total_tokens ?? 0,
  };
}

async function* toStreamingResponse(
  response: Response,
): ResultStreaming {
  yield* iterateSSEStream(response, (payload) => {
    const parsed = JSON.parse(payload) as StreamResponse;
    return {
      model: parsed.model,
      created: parsed.created,
      usage: toUsage(parsed),
      choices: (parsed.choices ?? []).map((c) => ({
        delta: {
          content: c.delta?.content ?? null,
          role: c.delta?.role ?? null,
        },
        index: c.index ?? 0,
        finish_reason: (c.finish_reason as FinishReason | null) ?? null,
      })),
    };
  });
}

export async function CopilotHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey =
    params.apiKey ??
    process.env.COPILOT_API_KEY ??
    (await getValidToken());

  if (!apiKey) {
    throw new Error(
      'No se encontró token de Copilot. Ejecuta: npx litellm login copilot',
    );
  }

  const baseUrl = params.baseUrl ?? COPILOT_API;
  const model = params.model.startsWith('copilot/')
    ? params.model.slice(8)
    : params.model;

  const body: Record<string, unknown> = {
    model,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: params.stream ?? false,
  };

  if (params.temperature != null) body.temperature = params.temperature;
  if (params.top_p != null) body.top_p = params.top_p;
  if (params.max_tokens != null) body.max_tokens = params.max_tokens;
  if (params.stop != null) body.stop = params.stop;
  if (params.presence_penalty != null) body.presence_penalty = params.presence_penalty;
  if (params.n != null) body.n = params.n;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(apiKey),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Error de Copilot API: ${response.status} ${response.statusText}\n${text}`,
    );
  }

  if (params.stream) {
    return toStreamingResponse(response);
  }

  const data = (await response.json()) as Record<string, unknown>;

  const choices = ((data.choices ?? []) as Record<string, unknown>[]).map(
    (c) => ({
      index: c.index as number,
      finish_reason: (c.finish_reason as FinishReason | null) ?? null,
      message: {
        role: ((c.message as Record<string, unknown>)?.role as string) ?? 'assistant',
        content: ((c.message as Record<string, unknown>)?.content as string | null) ?? null,
      },
    }),
  );

  const result: ResultNotStreaming = {
    created: (data.created as number) ?? Math.floor(Date.now() / 1000),
    model: data.model as string | undefined,
    usage: toUsage(data),
    choices,
  };

  return result;
}

import { registerModelProvider } from '../models';

registerModelProvider('copilot', async () => []);

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('copilot/', CopilotHandler);
