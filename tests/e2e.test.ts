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
      ${'gpt-4o-mini'}
      ${'claude-3-haiku-20240307'}
      ${'command-nightly'}
      ${'j2-light'}
      ${'ollama/llama2'}
      ${'gemini/gemini-2.0-flash'}
      ${'mistral/mistral-tiny'}
      ${'deepinfra/mistralai/Mistral-7B-Instruct-v0.1'}
      ${'replicate/meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3'}
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
      ${'gpt-4o-mini'}
      ${'claude-3-haiku-20240307'}
      ${'command-nightly'}
      ${'gemini/gemini-2.0-flash'}
      ${'mistral/mistral-tiny'}
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
      ${'text-embedding-ada-002'}
      ${'ollama/llama2'}
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
