import {
  toGeminiContent,
  toGeminiTools,
  toGeminiToolConfig,
  toFinishReason,
  toGeminiUsage,
  toResponse,
} from '../../src/utils/gemini';

describe('toGeminiContent (A4)', () => {
  it('skips system messages (Gemini uses systemInstruction separately)', () => {
    const result = toGeminiContent([{ role: 'system', content: 'be nice' }]);
    expect(result).toEqual([]);
  });

  it('maps user -> user with text parts', () => {
    const result = toGeminiContent([{ role: 'user', content: 'Hi' }]);
    expect(result[0]).toEqual({ role: 'user', parts: [{ text: 'Hi' }] });
  });

  it('maps assistant -> model with text + functionCall parts', () => {
    const result = toGeminiContent([
      {
        role: 'assistant',
        content: 'Sure',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'fn', arguments: '{"x":1}' } }],
      },
    ]);
    expect(result[0].role).toBe('model');
    const parts = result[0].parts as unknown as { text?: string; functionCall?: { name: string; args: unknown } }[];
    expect(parts[0].text).toBe('Sure');
    expect(parts[1].functionCall).toEqual({ name: 'fn', args: { x: 1 } });
  });

  it('maps tool -> user with functionResponse', () => {
    const result = toGeminiContent([{ role: 'tool', content: '72F' }]);
    expect(result[0].role).toBe('user');
    const parts = result[0].parts as unknown as { functionResponse: { name: string; response: { result: string } } }[];
    expect(parts[0].functionResponse).toEqual({ name: 'tool_result', response: { result: '72F' } });
  });
});

describe('toGeminiTools', () => {
  it('returns undefined for empty/missing', () => {
    expect(toGeminiTools(undefined)).toBeUndefined();
    expect(toGeminiTools([])).toBeUndefined();
  });

  it('wraps tools in functionDeclarations with default parameters', () => {
    const result = toGeminiTools([{
      type: 'function' as const,
      function: { name: 'fn', description: 'd' },
    }]);
    expect(result).toHaveLength(1);
    expect(result![0].functionDeclarations[0]).toMatchObject({ name: 'fn', description: 'd', parameters: { type: 'object', properties: {} } });
  });
});

describe('toGeminiToolConfig', () => {
  it('maps none/auto/named', () => {
    expect(toGeminiToolConfig('none')).toEqual({ functionCallingConfig: { mode: 'NONE' } });
    expect(toGeminiToolConfig('auto')).toEqual({ functionCallingConfig: { mode: 'AUTO' } });
    expect(toGeminiToolConfig({ type: 'function', function: { name: 'fn' } })).toEqual({
      functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['fn'] },
    });
  });

  it('returns undefined for missing', () => {
    expect(toGeminiToolConfig(undefined)).toBeUndefined();
  });
});

describe('toFinishReason', () => {
  it.each([
    ['STOP', 'stop'],
    ['MAX_TOKENS', 'length'],
    ['RECITATION', 'content_filter'],
    ['SAFETY', 'content_filter'],
    ['FINISH_REASON_UNSPECIFIED', 'stop'],
    [null, 'stop'],
  ])('maps %s -> %s', (input, expected) => {
    expect(toFinishReason(input as never)).toBe(expected);
  });
});

describe('toGeminiUsage', () => {
  it('returns undefined when no meta', () => {
    expect(toGeminiUsage(undefined)).toBeUndefined();
  });

  it('maps token counts', () => {
    expect(toGeminiUsage({ promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 } as never))
      .toEqual({ prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 });
  });
});

describe('toResponse', () => {
  it('maps text candidate with usage', () => {
    const response = {
      candidates: [{ index: 0, finishReason: 'STOP', content: { parts: [{ text: 'Hi' }] } }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    } as never;
    const result = toResponse(response, 'gemini-2.0');
    expect(result.model).toBe('gemini-2.0');
    expect(result.choices[0].message.content).toBe('Hi');
    expect(result.choices[0].finish_reason).toBe('stop');
    expect(result.usage).toEqual({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });
  });

  it('sets finish_reason to tool_calls when functionCall present and no finishReason', () => {
    const response = {
      candidates: [{ index: 0, content: { parts: [{ functionCall: { name: 'fn', args: { x: 1 } } }] } }],
    } as never;
    const result = toResponse(response, 'gemini-2.0');
    expect(result.choices[0].finish_reason).toBe('tool_calls');
    expect(result.choices[0].message.tool_calls).toHaveLength(1);
  });
});