import { renderQwenTemplate } from '../../src/utils/renderQwenTemplate';
import type { Message } from '../../src/types';

describe('renderQwenTemplate (M10)', () => {
  it('renders a simple system + user conversation', () => {
    const out = renderQwenTemplate({
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' },
      ],
      addGenerationPrompt: true,
    });
    expect(out).toContain('<|im_start|>system\nBe concise.<|im_end|>');
    expect(out).toContain('<|im_start|>user\nHi<|im_end|>');
    expect(out).toContain('<|im_start|>assistant\n');
  });

  it('enables thinking block by default when enableThinking is true', () => {
    const out = renderQwenTemplate({
      messages: [{ role: 'user', content: 'Hi' }],
      addGenerationPrompt: true,
      enableThinking: true,
    });
    expect(out).toMatch(/assistant\n.*\n$/);
  });

  it('disables thinking via <|think_off|> marker in system content', () => {
    const out = renderQwenTemplate({
      messages: [{ role: 'system', content: 'Rules<|think_off|>' }, { role: 'user', content: 'Hi' }],
      addGenerationPrompt: true,
    });
    expect(out).not.toContain('<|think_off|>');
    expect(out).toContain('<|im_start|>system\nRules<|im_end|>');
  });

  it('renders a tools block when tools are provided', () => {
    const out = renderQwenTemplate({
      messages: [{ role: 'user', content: 'Use the tool' }],
      tools: [{ type: 'function', function: { name: 'getWeather', description: 'Get weather', parameters: { type: 'object' } } }],
      addGenerationPrompt: true,
    });
    expect(out).toContain('# Tools');
    expect(out).toContain('<tools>');
    expect(out).toContain('getWeather');
  });

  it('renders assistant tool_calls in the Qwen function-call format', () => {
    const out = renderQwenTemplate({
      messages: [
        { role: 'user', content: 'Weather?' },
        {
          role: 'assistant',
          content: 'Let me check',
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'getWeather', arguments: '{"city":"SF"}' } }],
        },
      ],
      addGenerationPrompt: false,
    });
    expect(out).toContain('<function=getWeather>');
    expect(out).toContain('<parameter=city>\nSF\n</parameter>');
  });

  it('emits a system warning on consecutive tool errors', () => {
    const out = renderQwenTemplate({
      messages: [
        { role: 'user', content: 'do thing' },
        { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'fn', arguments: '{}' } }] },
        { role: 'tool', content: 'error: failed' },
        { role: 'assistant', content: '', tool_calls: [{ id: 'c2', type: 'function', function: { name: 'fn', arguments: '{}' } }] },
        { role: 'tool', content: 'error: failed again' },
      ],
      addGenerationPrompt: true,
    });
    expect(out).toContain('consecutive tool errors detected');
  });

  it('does not add generation prompt when addGenerationPrompt is false', () => {
    const out = renderQwenTemplate({
      messages: [{ role: 'user', content: 'Hi' }],
      addGenerationPrompt: false,
    });
    expect(out).not.toContain('<|im_start|>assistant\n');
  });

  it('handles messages with null content', () => {
    const out = renderQwenTemplate({
      messages: [{ role: 'user', content: null } as unknown as Message],
      addGenerationPrompt: true,
    });
    expect(out).toContain('<|im_start|>user\n<|im_end|>');
  });
});