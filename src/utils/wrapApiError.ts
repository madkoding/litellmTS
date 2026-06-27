export function wrapApiError(provider: string, err: unknown): Error {
  return new Error(`${provider} API error: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
}
