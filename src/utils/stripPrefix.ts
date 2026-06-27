export function stripPrefix(model: string, prefix: string): string {
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}
