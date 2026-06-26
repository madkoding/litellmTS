export interface ParsedQwenToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export function parseQwenToolCalls(content: string): ParsedQwenToolCall[] {
  const results: ParsedQwenToolCall[] = [];
  const funcRe = /<function=(\w+)>([\s\S]*?)<\/function>/g;
  let match: RegExpExecArray | null;
  while ((match = funcRe.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const args: Record<string, unknown> = {};
    const paramRe = /<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g;
    let pmatch: RegExpExecArray | null;
    while ((pmatch = paramRe.exec(body)) !== null) {
      const key = pmatch[1];
      let val: unknown = pmatch[2].trim();
      try { val = JSON.parse(val as string); } catch {}
      args[key] = val;
    }
    results.push({
      id: `qwen_${results.length}`,
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    });
  }
  return results;
}
