import { parseQwenToolCalls } from '../../src/utils/parseQwenToolCalls';

describe('parseQwenToolCalls (M10)', () => {
  it('parses a single function call with parameters', () => {
    const content = 'Some reasoning\n\n\n<function=getWeather>\n<parameter=city>\nSF\n</parameter>\n<parameter=units>\nmetric\n</parameter>\n</function>\n';
    const calls = parseQwenToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 'qwen_0', type: 'function', function: { name: 'getWeather' } });
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ city: 'SF', units: 'metric' });
  });

  it('parses multiple function calls in one content', () => {
    const content = [
      '\n<function=fnA>\n<parameter=x>\n1\n</parameter>\n</function>\n',
      '\n<function=fnB>\n<parameter=y>\n"hi"\n</parameter>\n</function>\n',
    ].join('');
    const calls = parseQwenToolCalls(content);
    expect(calls).toHaveLength(2);
    expect(calls[0].function.name).toBe('fnA');
    expect(calls[1].function.name).toBe('fnB');
    expect(JSON.parse(calls[1].function.arguments)).toEqual({ y: 'hi' });
  });

  it('JSON-parses parameter values when possible', () => {
    const content = '\n<function=fn>\n<parameter=n>\n42\n</parameter>\n<parameter=obj>\n{"a":1}\n</parameter>\n</function>\n';
    const calls = parseQwenToolCalls(content);
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ n: 42, obj: { a: 1 } });
  });

  it('keeps raw string when parameter value is not valid JSON', () => {
    const content = '\n<function=fn>\n<parameter=text>\nhello world\n</parameter>\n</function>\n';
    const calls = parseQwenToolCalls(content);
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ text: 'hello world' });
  });

  it('returns empty array when no function calls present', () => {
    expect(parseQwenToolCalls('just text, no calls')).toEqual([]);
  });

  it('handles multi-line parameter values', () => {
    const content = '\n<function=fn>\n<parameter=code>\nline1\nline2\nline3\n</parameter>\n</function>\n';
    const calls = parseQwenToolCalls(content);
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ code: 'line1\nline2\nline3' });
  });
});