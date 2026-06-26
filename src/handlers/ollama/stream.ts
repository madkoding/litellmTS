import { StreamingChunk } from '../../types';
import { toStreamingChunk, toStreamingChunkFromDelta } from './mappers';
import { OllamaResponseChunk, OpenAIChatChunk } from './types';

interface StreamStrategy<C> {
  readonly tag: string;
  readonly sse: boolean;
  parseLine(trimmed: string): C;
  emit(parsed: C, ctx: { model: string; prompt: string }): Iterable<StreamingChunk>;
  flush?(ctx: { model: string; prompt: string }): Iterable<StreamingChunk>;
}

async function* iterateStream<C>(
  response: Response,
  strategy: StreamStrategy<C>,
  ctx: { model: string; prompt: string },
): AsyncIterable<StreamingChunk> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');
  let done = false;
  let lastError = '';

  while (!done) {
    const next = await reader.read();
    if (!next.value) { break; }
    done = next.done;
    const decoded = new TextDecoder().decode(next.value);
    for (const line of decoded.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (strategy.sse) {
        if (trimmed === 'data: [DONE]') return;
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        try {
          yield* strategy.emit(strategy.parseLine(payload), ctx);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          lastError = `Failed to parse SSE chunk: ${msg.slice(0, 100)} | raw: ${payload.slice(0, 200)}`;
        }
      } else {
        try {
          yield* strategy.emit(strategy.parseLine(trimmed), ctx);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          lastError = `Failed to parse chunk: ${msg.slice(0, 100)} | raw: ${trimmed.slice(0, 200)}`;
        }
      }
    }
  }

  if (strategy.flush) yield* strategy.flush(ctx);
  if (lastError) {
    // eslint-disable-next-line no-console
    console.error(`[${strategy.tag}] ${lastError}`);
  }
}

const nativeOllamaStrategy: StreamStrategy<OllamaResponseChunk> = {
  tag: 'iterateResponse',
  sse: false,
  parseLine: (t) => JSON.parse(t) as OllamaResponseChunk,
  emit(parsed, { model, prompt }) {
    return [toStreamingChunk(parsed, model, prompt)];
  },
};

const openAIChatStrategy: StreamStrategy<OpenAIChatChunk> = {
  tag: 'iterateResponse',
  sse: true,
  parseLine: (payload) => JSON.parse(payload) as OpenAIChatChunk,
  *emit(parsed, { model, prompt }) {
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) yield toStreamingChunkFromDelta(delta.content, model, prompt);
    if (delta?.reasoning) yield toStreamingChunkFromDelta('', model, prompt, undefined, delta.reasoning);
    if (delta?.tool_calls) yield toStreamingChunkFromDelta('', model, prompt, delta.tool_calls);
  },
};

export function iterateResponse(
  response: Response,
  model: string,
  prompt: string,
  useOpenAIEndpoint: boolean,
): AsyncIterable<StreamingChunk> {
  return iterateStream(
    response,
    (useOpenAIEndpoint ? openAIChatStrategy : nativeOllamaStrategy) as StreamStrategy<unknown>,
    { model, prompt },
  );
}
