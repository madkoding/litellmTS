/**
 * Parse an SSE (Server-Sent Events) response stream into typed chunks.
 *
 * Reads `response.body` as a ReadableStream, splits on `\n`, filters for
 * `data:` lines, parses each payload, and yields typed results.
 * Stops iteration when a `doneToken` payload is encountered (default `[DONE]`).
 *
 * @param response - The HTTP response with an SSE body stream
 * @param parseChunk - A function to parse each `data:` payload string into type T
 * @param doneToken - The payload value that signals end-of-stream
 */
export async function* iterateSSEStream<T>(
  response: Response,
  parseChunk: (data: string) => T,
  doneToken = '[DONE]',
): AsyncIterable<T> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  let done = false;
  let buffer = '';

  while (!done) {
    const next = await reader.read();
    if (next.value) {
      buffer += new TextDecoder().decode(next.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed?.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === doneToken) {
          return;
        }
        yield parseChunk(payload);
      }
    }
    done ||= next.done;
  }
}
