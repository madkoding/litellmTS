import { completion, embedding } from '../src';
import { ResultStreaming } from '../src/types';

const TIMEOUT = 60000;
const PROMPT = 'How are you today?';

/**
 * @group e2e
 */
describe('e2e', () => {
  describe('completion', () => {
    it.each`
      model
      ${'openai/gpt-4o-mini'}
      ${'anthropic/claude-3-5-haiku-20241022'}
      ${'cohere/command-r-plus'}
      ${'ai21/jamba-1.5-mini'}
      ${'ollama/llama3.1:8b'}
      ${'gemini/gemini-2.0-flash'}
      ${'mistral/mistral-small-latest'}
      ${'deepinfra/mistralai/Mistral-7B-Instruct-v0.1'}
      ${'replicate/meta/llama-3-70b-instruct:83e80b65e1c4ec3e36c89e0bbeb21e029c1573b9b554a3671fb4bf2cd5f7f5d3'}
      ${'copilot/gpt-4o'}
      ${'groq/llama3-70b-8192'}
      ${'together/meta-llama/Llama-3-70b-chat-hf'}
    `(
      'gets non-streaming response from $model',
      async ({ model }) => {
        const result = await completion({
          model: model as string,
          messages: [{ role: 'user', content: PROMPT }],
          stream: false,
        });
        expect(result.choices[0].message.content).toBeTruthy();
      },
      TIMEOUT,
    );

    it.each`
      model
      ${'openai/gpt-4o-mini'}
      ${'anthropic/claude-3-5-haiku-20241022'}
      ${'cohere/command-r-plus'}
      ${'gemini/gemini-2.0-flash'}
      ${'mistral/mistral-small-latest'}
      ${'deepinfra/mistralai/Mistral-7B-Instruct-v0.1'}
      ${'groq/llama3-70b-8192'}
      ${'together/meta-llama/Llama-3-70b-chat-hf'}
      ${'copilot/gpt-4o'}
    `(
      'gets streaming response from $model',
      async ({ model }) => {
        const result: ResultStreaming = await completion({
          model: model as string,
          messages: [{ role: 'user', content: PROMPT }],
          stream: true,
        });

        let chunks = 0;
        for await (const chunk of result) {
          expect(chunk.choices[0].delta.content).not.toBeNull();
          chunks++;
        }
        expect(chunks).toBeGreaterThan(0);
      },
      TIMEOUT,
    );

    it('throws on unsupported model', async () => {
      await expect(
        completion({ model: 'nonexistent-model', messages: [] }),
      ).rejects.toThrow('not supported');
    });
  });

  describe('embedding', () => {
    it.each`
      model
      ${'openai/text-embedding-ada-002'}
      ${'ollama/llama3.1:8b'}
      ${'mistral/mistral-embed'}
      ${'gemini/text-embedding-004'}
    `(
      'returns embeddings for $model',
      async ({ model }) => {
        const result = await embedding({
          model: model as string,
          input: PROMPT,
        });

        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data[0].embedding.length).toBeGreaterThan(0);
      },
      TIMEOUT,
    );

    it.each`
      model
      ${'groq/llama3-70b-8192'}
      ${'together/meta-llama/Llama-3-70b-chat-hf'}
    `(
      'returns embeddings via OpenAILike for $model',
      async ({ model }) => {
        const result = await embedding({
          model: model as string,
          input: PROMPT,
        });

        expect(result.data.length).toBeGreaterThan(0);
      },
      TIMEOUT,
    );
  });
});
