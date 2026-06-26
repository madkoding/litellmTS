import { StreamingChunk, ResultNotStreaming, ResultStreaming } from '../../types';
import { renderQwenTemplate } from '../../utils/renderQwenTemplate';
import { toResponse, toStreamingChunkFromDelta } from './mappers';
import { getQwenGenerateResponse } from './request';
import { QwenGenerateChunk } from './types';

function splitThinkBlock(raw: string): [content: string, reasoning: string] {
  const idx = raw.indexOf('\n response\n\n');
  if (idx !== -1) {
    return [
      raw.slice(idx + '\n response\n\n'.length),
      raw.slice(0, idx),
    ];
  }
  return [raw, ''];
}

async function* iterateQwenGenerate(
  response: Response,
  model: string,
  prompt: string,
  thinkingEnabled: boolean,
): AsyncIterable<StreamingChunk> {
  const reader = response.body?.getReader();
  let done = false;
  let buffer = '';
  let state: 'thinking' | 'content' = thinkingEnabled ? 'thinking' : 'content';
  let lastError = '';

  while (!done) {
    const next = await reader?.read();
    if (next?.value) {
      const decoded = new TextDecoder().decode(next.value);
      done = next.done;
      const lines = decoded.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as QwenGenerateChunk;
          buffer += parsed.response;

          if (state === 'thinking') {
            const idx = buffer.indexOf('\n response\n\n');
            if (idx !== -1) {
              state = 'content';
              const reasoning = buffer.slice(0, idx);
              buffer = buffer.slice(idx + '\n response\n\n'.length);
              if (reasoning.trim()) {
                yield toStreamingChunkFromDelta('', model, prompt, undefined, reasoning);
              }
            } else {
              continue;
            }
          }

          if (state === 'content' && buffer) {
            yield toStreamingChunkFromDelta(buffer, model, prompt);
            buffer = '';
          }
        } catch (e: any) {
          lastError = `Failed to parse generate chunk: ${(e.message || e).slice(0, 100)} | raw: ${trimmed.slice(0, 200)}`;
        }
      }
    } else {
      done = true;
    }
  }

  if (buffer) {
    yield toStreamingChunkFromDelta(buffer, model, prompt);
  }

  if (lastError) {
    console.error(`[iterateQwenGenerate] ${lastError}`);
  }
}

export async function qwenCompletionPath(
  params: { model: string; messages: Array<{ role: string; content: string | null; name?: string; tool_call_id?: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }>; stream?: boolean | null; baseUrl?: string; apiKey?: string; max_tokens?: number | null; temperature?: number | null; top_p?: number | null; repetition_penalty?: number | null; frequency_penalty?: number | null; top_k?: number | null; tools?: Array<{ type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } }>; think?: boolean },
  model: string,
): Promise<ResultNotStreaming | ResultStreaming> {
  const thinkingEnabled = (params as any).think !== false;
  const rendered = renderQwenTemplate({
    messages: params.messages as any,
    tools: params.tools,
    addGenerationPrompt: true,
    enableThinking: thinkingEnabled,
  });

  const { response: res, endpoint } = await getQwenGenerateResponse(
    model,
    rendered,
    params.baseUrl ?? '',
    !!params.stream,
    params.apiKey,
    params.max_tokens,
    params.temperature,
    params.top_p,
    params.repetition_penalty,
    params.frequency_penalty,
    params.top_k,
  );

  if (!res.ok) {
    let errorBody = '';
    try { errorBody = await res.text(); } catch { errorBody = ''; }
    const prefix = `[Ollama/Qwen] Endpoint: ${endpoint} | Model: ${model}`;
    let detail = `HTTP ${res.status}`;
    if (errorBody) {
      try {
        const parsed = JSON.parse(errorBody);
        detail = parsed.error?.message || parsed.error || errorBody;
      } catch {
        detail = errorBody.slice(0, 500);
      }
    }
    throw new Error(`${prefix} | Error: ${detail}`);
  }

  if (params.stream) {
    return iterateQwenGenerate(res, model, rendered, thinkingEnabled);
  }

  const data = (await res.json()) as QwenGenerateChunk;
  const [content, reasoning] = splitThinkBlock(data.response);
  return toResponse(content, model, rendered, undefined, reasoning);
}
