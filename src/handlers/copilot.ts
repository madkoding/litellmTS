import {
  HandlerParams,
  HandlerParamsNotStreaming,
  HandlerParamsStreaming,
  ResultNotStreaming,
  ResultStreaming,
  type ConsistentResponseUsage,
  type FinishReason,
} from '../types';
import { getUnixTimestamp } from '../utils/getUnixTimestamp';
import { getValidToken } from '../auth';

const COPILOT_API = 'https://api.githubcopilot.com';
const USER_AGENT = 'GitHubCopilotChat/0.35.0';
const EDITOR_VERSION = 'vscode/1.107.0';
const EDITOR_PLUGIN_VERSION = 'copilot-chat/0.35.0';
const COPILOT_INTEGRATION_ID = 'vscode-chat';

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
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload);
        yield {
          model: parsed.model,
          created: parsed.created,
          usage: toUsage(parsed),
          choices: (parsed.choices ?? []).map((c: Record<string, unknown>) => ({
            delta: {
              content: (c.delta as Record<string, unknown>)?.content as string | null | undefined,
              role: (c.delta as Record<string, unknown>)?.role as string | null | undefined,
            },
            index: c.index as number,
            finish_reason: (c.finish_reason as FinishReason | null) ?? null,
          })),
        };
      } catch {
        // skip parse errors
      }
    }
  }
}

export async function CopilotHandler(
  params: HandlerParamsNotStreaming,
): Promise<ResultNotStreaming>;

export async function CopilotHandler(
  params: HandlerParamsStreaming,
): Promise<ResultStreaming>;

export async function CopilotHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming>;

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

  const choices = ((data.choices ?? []) as Array<Record<string, unknown>>).map(
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
    created: (data.created as number) ?? getUnixTimestamp(),
    model: data.model as string | undefined,
    usage: toUsage(data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }),
    choices,
  };

  return result;
}
