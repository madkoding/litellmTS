const openAIMockCreate = jest.fn();
const anthropicMockCreate = jest.fn();

const mockOpenAIResponse = {
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1234567890,
  model: 'gpt-3.5-turbo',
  choices: [
    {
      index: 0,
      finish_reason: 'stop' as const,
      message: { role: 'assistant' as const, content: 'Hello!' },
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

async function* mockOpenAIStream() {
  yield {
    id: 'chatcmpl-123',
    object: 'chat.completion.chunk',
    created: 1234567890,
    model: 'gpt-3.5-turbo',
    choices: [
      {
        index: 0,
        delta: { content: 'Hello', role: 'assistant' as const },
        finish_reason: null,
      },
    ],
  };
}

openAIMockCreate.mockImplementation(
  (params: { stream?: boolean | null }) => {
    if (params.stream) {
      return mockOpenAIStream();
    }
    return mockOpenAIResponse;
  },
);

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: openAIMockCreate,
        },
      },
    };
  });
});

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => {
    return {
      completions: {
        create: anthropicMockCreate,
      },
    };
  });
});

import Anthropic from '@anthropic-ai/sdk';
import { completion } from '../src';
import { HandlerParams } from '../src/types';

describe('litellm', () => {
  describe('openai', () => {
    beforeEach(() => {
      openAIMockCreate.mockClear();
    });

    describe('non-streaming', () => {
      it('should call OpenAI SDK with correct params and return structured result', async () => {
        const model = 'gpt-4-32k-0613';
        const result = await completion({
          model,
          messages: [{ role: 'user', content: 'test' }],
          stream: false,
        });

        expect(openAIMockCreate).toHaveBeenCalledTimes(1);
        expect(openAIMockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ model, stream: false }),
        );
        expect(result).toMatchObject({
          model: 'gpt-3.5-turbo',
          created: 1234567890,
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: 'Hello!' },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        });
      });
    });

    describe('streaming', () => {
      it('should call OpenAI SDK with stream:true and yield chunks', async () => {
        const model = 'gpt-3.5-turbo';
        const result = await completion({
          model,
          messages: [{ role: 'user', content: 'test' }],
          stream: true,
        });

        expect(openAIMockCreate).toHaveBeenCalledTimes(1);
        expect(openAIMockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ model, stream: true }),
        );

        const chunks: unknown[] = [];
        for await (const chunk of result) {
          chunks.push(chunk);
        }
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toMatchObject({
          model: 'gpt-3.5-turbo',
          choices: [
            {
              delta: { content: 'Hello', role: 'assistant' },
              finish_reason: null,
            },
          ],
        });
      });
    });
  });

  describe('openai-like routing', () => {
    afterEach(() => {
      delete process.env.GROQ_API_KEY;
    });

    it('should route groq/ models through OpenAI SDK with correct baseUrl', async () => {
      process.env.GROQ_API_KEY = 'groq-test-key';
      openAIMockCreate.mockClear();

      await completion({
        model: 'groq/llama3-70b',
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
      });

      expect(openAIMockCreate).toHaveBeenCalledTimes(1);
      expect(openAIMockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'groq/llama3-70b' }),
      );
    });
  });

  describe('anthropic', () => {
    it('supports using anthropic models without streaming', async () => {
      anthropicMockCreate.mockResolvedValueOnce({
        completion: 'response text',
        model: 'claude-2',
        stop_reason: 'stop',
      });
      const params: HandlerParams = {
        model: 'claude-2',
        messages: [
          {
            content: 'How are you',
            role: 'user',
          },
        ],
        stream: false,
      };
      const expectedPrompt = `${Anthropic.HUMAN_PROMPT} ${params.messages[0].content}${Anthropic.AI_PROMPT}`;
      const result = await completion(params);
      const expectedParams = {
        model: 'claude-2',
        prompt: expectedPrompt,
      };
      expect(anthropicMockCreate).toHaveBeenCalledWith(
        expect.objectContaining(expectedParams),
      );
      expect(result).toMatchObject({
        choices: [
          {
            message: {
              content: 'response text',
            },
          },
        ],
      });
    });
  });
});
