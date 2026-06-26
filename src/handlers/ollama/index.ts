import { HandlerParams, ResultNotStreaming, ResultStreaming } from '../../types';
import { qwenCompletionPath } from './qwen';
import { getOllamaResponse } from './request';
import { iterateResponse } from './stream';
import { toResponse } from './mappers';
import { OpenAIChatChunk, OllamaResponseChunk } from './types';

export async function OllamaHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const model = params.model.startsWith('ollama/')
    ? params.model.slice(7)
    : params.model.startsWith('ollama_local/')
      ? params.model.slice(13)
      : params.model;

  if (/qwen/i.test(model)) {
    return qwenCompletionPath(params, model);
  }

  const messages = params.messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role, content: m.content || '' };
    if (m.name) msg.name = m.name;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if ((m as any).tool_calls) {
      msg.tool_calls = (m as any).tool_calls;
    } else if ((m as any).function_call) {
      const fc = (m as any).function_call;
      msg.tool_calls = [{ id: fc.name || 'call_0', type: 'function', function: { name: fc.name, arguments: fc.arguments } }];
    }
    if (m.role === 'function') {
      msg.role = 'tool';
      if (!msg.tool_call_id && m.name) msg.tool_call_id = m.name;
    }
    return msg;
  });
  const prompt = params.messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'Human'}: ${m.content ?? ''}`)
    .join('\n\n');

  const { response: res, useOpenAIEndpoint, endpoint, hasApiKey, model: actualModel } = await getOllamaResponse(
    model, messages as any, params.baseUrl ?? '', !!params.stream, params.apiKey,
    params.max_tokens, params.temperature, params.top_p, params.tools,
    (params as any).think, params.repetition_penalty, params.frequency_penalty, params.top_k,
  );

  if (!res.ok) {
    let errorBody = '';
    try { errorBody = await res.text(); } catch { errorBody = ''; }
    const prefix = `[Ollama] Endpoint: ${endpoint} | Model: ${actualModel} | HasApiKey: ${hasApiKey}`;
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
    return iterateResponse(res, model, prompt, useOpenAIEndpoint);
  }

  if (useOpenAIEndpoint) {
    const body = (await res.json()) as OpenAIChatChunk;
    const choice = body.choices?.[0];
    const content = choice?.message?.content || choice?.message?.reasoning || '';
    const toolCalls = choice?.message?.tool_calls;
    return toResponse(content, model, prompt, toolCalls);
  }

  const data = (await res.json()) as OllamaResponseChunk;
  return toResponse(data.message.content, model, prompt, data.message.tool_calls as any, data.message.thinking);
}
