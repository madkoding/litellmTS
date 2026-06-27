import type { Message } from '../types';

export function mergeSystem(messages: Message[]): { system: string | undefined; messages: Message[] } {
  let system: string | undefined;
  const rest: Message[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      system = (system ? system + '\n' : '') + (msg.content ?? '');
    } else {
      rest.push(msg);
    }
  }
  return { system, messages: rest };
}