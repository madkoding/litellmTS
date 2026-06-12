import { combinePrompts } from '../../src/utils/combinePrompts';

describe('combinePrompts', () => {
  it('joins messages with role labels and double newlines', () => {
    const result = combinePrompts([
      { role: 'system', content: 'You are a helper.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);
    expect(result).toBe('System: You are a helper.\n\nHuman: Hello\n\nAssistant: Hi there!');
  });

  it('handles a single message', () => {
    const result = combinePrompts([{ role: 'user', content: 'Hello' }]);
    expect(result).toBe('Human: Hello');
  });

  it('handles null content', () => {
    const result = combinePrompts([{ role: 'user', content: null }]);
    expect(result).toBe('Human: ');
  });

  it('handles empty messages', () => {
    const result = combinePrompts([]);
    expect(result).toBe('');
  });
});
