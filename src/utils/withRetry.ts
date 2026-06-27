const DEFAULT_TRIES = 3;
const DEFAULT_BASE_MS = 500;

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; baseMs?: number; shouldRetry?: (err: unknown) => boolean } = {},
): Promise<T> {
  const { tries = DEFAULT_TRIES, baseMs = DEFAULT_BASE_MS, shouldRetry = defaultShouldRetry } = opts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= tries || !shouldRetry(err)) throw err;
      const delay = baseMs * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function defaultShouldRetry(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout')) return true;
    if (msg.includes('429')) return true;
    if (/\b5\d{2}\b/.test(msg)) return true;
  }
  return false;
}