import { MODEL_HANDLER_MAPPINGS } from '../../src/completion';
import { AI21Handler } from '../../src/handlers/ai21';
import { AnthropicHandler } from '../../src/handlers/anthropic';
import { CohereHandler } from '../../src/handlers/cohere';
import { CopilotHandler } from '../../src/handlers/copilot';
import { GeminiHandler } from '../../src/handlers/gemini';
import { getHandler } from '../../src/handlers/getHandler';
import { OllamaHandler } from '../../src/handlers/ollama';
import { OpenAIHandler } from '../../src/handlers/openai';
import { ReplicateHandler } from '../../src/handlers/replicate';
import { OPENAI_LIKE_MAPPINGS } from '../../src/mappings/openaiLike';

describe('getHandler', () => {
  describe('dedicated handlers', () => {
    it.each([
      { model: 'anthropic/claude-2', expectedHandler: AnthropicHandler },
      { model: 'anthropic/claude-instant-1', expectedHandler: AnthropicHandler },
      { model: 'openai/gpt-3.5-turbo', expectedHandler: OpenAIHandler },
      { model: 'openai/gpt-4o', expectedHandler: OpenAIHandler },
      { model: 'openai/test', expectedHandler: OpenAIHandler },
      { model: 'ollama/llama2', expectedHandler: OllamaHandler },
      { model: 'cohere/command-nightly', expectedHandler: CohereHandler },
      { model: 'ai21/j2-light', expectedHandler: AI21Handler },
      { model: 'ai21/j2-mid', expectedHandler: AI21Handler },
      { model: 'ai21/j2-ultra', expectedHandler: AI21Handler },
      { model: 'ai21/j2-grande-instruct', expectedHandler: AI21Handler },
      { model: 'ai21/j2-mid-instruct', expectedHandler: AI21Handler },
      { model: 'ai21/j2-ultra-instruct', expectedHandler: AI21Handler },
      { model: 'replicate/test/test', expectedHandler: ReplicateHandler },
      { model: 'gemini/gemini-2.0-flash', expectedHandler: GeminiHandler },
      { model: 'gemini/gemini-2.0-pro', expectedHandler: GeminiHandler },
      { model: 'copilot/gpt-4o', expectedHandler: CopilotHandler },
    ])(
      'should return the correct handler for $model',
      ({ model, expectedHandler }) => {
        const handler = getHandler(model, MODEL_HANDLER_MAPPINGS);
        expect(handler).toBe(expectedHandler);
      },
    );
  });

  describe('OpenAI-compatible providers', () => {
    it.each(Object.keys(OPENAI_LIKE_MAPPINGS))(
      'should resolve a model with prefix %s',
      (prefix) => {
        const handler = getHandler(
          `${prefix}test-model`,
          MODEL_HANDLER_MAPPINGS,
        );
        expect(handler).toBeTruthy();
        expect(typeof handler).toBe('function');
      },
    );
  });

  it('should return null for unsupported models', () => {
    const handler = getHandler('unknown', MODEL_HANDLER_MAPPINGS);
    expect(handler).toBeNull();
  });

  it('routes to the more specific prefix when prefixes overlap (A3)', () => {
    const a: unknown = 'A';
    const ab: unknown = 'AB';
    const mapping = { 'foo/': a, 'foo-bar/': ab };
    expect(getHandler('foo-bar/x', mapping)).toBe(ab);
    expect(getHandler('foo/x', mapping)).toBe(a);
  });
});
