/**
 * Find a handler function by matching the model name against registered prefix patterns.
 *
 * Each handler registers itself with a prefix (e.g. `'gpt-'`, `'claude-'`). This function
 * checks if the model name starts with any registered prefix and returns the matching handler.
 *
 * @param model - The model name to look up (e.g. `'gpt-4'`, `'claude-3-opus'`)
 * @param mapping - A record of prefix → handler function
 * @returns The matching handler, or `null` if no prefix matches
 */
export function getHandler<T>(
  model: string,
  mapping: Record<string, T>,
): T | null {
  const patterns = Object.keys(mapping);
  const handlerKey = patterns.find((pattern) => model.startsWith(pattern));
  if (!handlerKey) {
    return null;
  }
  return mapping[handlerKey];
}
