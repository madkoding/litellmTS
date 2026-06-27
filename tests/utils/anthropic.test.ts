import {
  toAnthropicMessages,
  toAnthropicTools,
  toAnthropicToolChoice,
  toAnthropicFinishReason,
  toAnthropicResponse,
  toAnthropicStreamingResponse,
  getTextContent,
  getToolCalls,
} from '../../src/utils/anthropic';
import type { Message } from '../../src/types';

describe('toAnthropicMessages (A4)', () => {
  it('extracts system messages and concatenates multiples', () => {
    const input: Message[] = [
      { role: 'system', content: 'Be nice.' },
      { role: 'system', content: 'Also concise.' },
      { role: 'user', content: 'Hi' },
    ];
    const { system, messages } = toAnthropicMessages(input);
    expect(system).toBe('Be nice.\nAlso concise.');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Hi' });
  });

  it('maps assistant with tool_calls to content blocks', () => {
    const input: Message[] = [
      {
        role: 'assistant',
        content: 'Thinking...',
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'getWeather', arguments: '{"city":"SF"}' } },
        ],
      },
    ];
    const { messages } = toAnthropicMessages(input);
    expect(messages[0].role).toBe('assistant');
    const content = messages[0].content as unknown as { type: string; text?: string; name?: string }[];
    expect(content.some((b) => b.type === 'text' && b.text === 'Thinking...')).toBe(true);
    expect(content.some((b) => b.type === 'tool_use' && b.name === 'getWeather')).toBe(true);
  });

  it('maps tool role to user with tool_result', () => {
    const input: Message[] = [
      { role: 'tool', content: '72F', tool_call_id: 'call_1' },
    ];
    const { messages } = toAnthropicMessages(input);
    expect(messages[0].role).toBe('user');
    const content = messages[0].content as unknown as { type: string; tool_use_id?: string; content?: string }[];
    expect(content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'call_1', content: '72F' });
  });

  it('uses empty string for missing content', () => {
    const { messages } = toAnthropicMessages([{ role: 'user', content: null }]);
    expect(messages[0].content).toBe('');
  });
});

describe('toAnthropicTools', () => {
  it('returns undefined for empty/missing tools', () => {
    expect(toAnthropicTools(undefined)).toBeUndefined();
    expect(toAnthropicTools([])).toBeUndefined();
  });

  it('maps to Anthropic tool schema with input_schema object', () => {
    const tools = [{
      type: 'function' as const,
      function: { name: 'getWeather', description: 'Get weather', parameters: { properties: { city: { type: 'string' } } } },
    }];
    const result = toAnthropicTools(tools);
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      name: 'getWeather',
      description: 'Get weather',
      input_schema: { type: 'object', properties: { city: { type: 'string' } } },
    });
  });
});

describe('toAnthropicToolChoice', () => {
  it('maps none/auto/named', () => {
    expect(toAnthropicToolChoice('none')).toEqual({ type: 'none' });
    expect(toAnthropicToolChoice('auto')).toEqual({ type: 'auto' });
    expect(toAnthropicToolChoice({ type: 'function', function: { name: 'getX' } })).toEqual({ type: 'tool', name: 'getX' });
  });

  it('returns undefined for missing', () => {
    expect(toAnthropicToolChoice(undefined)).toBeUndefined();
  });
});

describe('toAnthropicFinishReason', () => {
  it.each([
    ['end_turn', 'stop'],
    ['tool_use', 'tool_calls'],
    ['max_tokens', 'length'],
    ['stop_sequence', 'stop'],
    [null, 'stop'],
    [undefined, 'stop'],
  ])('maps %s -> %s', (input, expected) => {
    expect(toAnthropicFinishReason(input as never)).toBe(expected);
  });
});

describe('getTextContent / getToolCalls', () => {
  const blocks = [
    { type: 'text', text: 'A' },
    { type: 'text', text: 'B' },
    { type: 'tool_use', id: 't1', name: 'fn', input: { x: 1 } },
  ] as unknown as Parameters<typeof getTextContent>[0];

  it('getTextContent joins text blocks', () => {
    expect(getTextContent(blocks)).toBe('AB');
  });

  it('getToolCalls extracts tool_use with stringified args', () => {
    const calls = getToolCalls(blocks);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 't1', type: 'function', function: { name: 'fn' } });
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ x: 1 });
  });
});

describe('toAnthropicResponse', () => {
  it('maps a full message with text + tool_use', () => {
    const message = {
      model: 'claude-3',
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'c1', name: 'fn', input: { a: 1 } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 5 },
    } as never;
    const result = toAnthropicResponse(message);
    expect(result.model).toBe('claude-3');
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
    expect(result.choices[0].message.content).toBe('Hello');
    expect(result.choices[0].finish_reason).toBe('tool_calls');
    expect(result.choices[0].message.tool_calls).toHaveLength(1);
  });
});

describe('toAnthropicStreamingResponse (A4)', () => {
  async function collect(stream: AsyncIterable<unknown>) {
    const out: unknown[] = [];
    for await (const c of stream) out.push(c);
    return out;
  }

  it('emits text deltas, tool_use, and final stop chunk', async () => {
    const events = [
      { type: 'message_start', message: { model: 'claude', stop_reason: null } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '!' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 't1', name: 'fn', input: {} } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"x":' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '1}' } },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
      { type: 'message_stop' },
    ] as unknown as AsyncIterable<never>;

    const chunks = await collect(toAnthropicStreamingResponse(events));
    const textDeltas = chunks
      .map((c) => (c as { choices: { delta: { content?: string } }[] }).choices[0].delta.content)
      .filter((c): c is string => !!c && c.length > 0);
    expect(textDeltas).toEqual(['Hi', '!']);

    const last = chunks[chunks.length - 1] as { choices: { finish_reason: string }[] };
    expect(last.choices[0].finish_reason).toBe('tool_calls');
  });

  it('emits reasoning delta for thinking_delta', async () => {
    const events = [
      { type: 'message_start', message: { model: 'claude', stop_reason: null } },
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_stop' },
    ] as unknown as AsyncIterable<never>;

    const chunks = await collect(toAnthropicStreamingResponse(events));
    const reasoning = chunks
      .map((c) => (c as { choices: { delta: { reasoning?: string } }[] }).choices[0].delta.reasoning)
      .filter((r): r is string => !!r);
    expect(reasoning).toEqual(['hmm']);
  });
});