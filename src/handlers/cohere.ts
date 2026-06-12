import { CohereClient } from 'cohere-ai';

import {
  HandlerParams,
  ResultStreaming,
  ResultNotStreaming,
  StreamingChunk,
} from '../types';
import { combinePrompts } from '../utils/combinePrompts';
import { getUnixTimestamp } from '../utils/getUnixTimestamp';
import { toUsage } from '../utils/toUsage';

interface CohereStreamEvent {
  eventType: string;
  text?: string;
  isFinished?: boolean;
}

export async function CohereHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error('Cohere requires an API key. Set COHERE_API_KEY environment variable or pass apiKey in params.');

  const cohere = new CohereClient({ token: apiKey });
  const textsCombined = combinePrompts(params.messages);

  const config = {
    model: params.model,
    prompt: textsCombined,
    max_tokens: params.max_tokens ?? 50,
    temperature: params.temperature ?? 1,
  };

  if (params.stream) {
    const stream = await cohere.generateStream({
      model: params.model,
      prompt: textsCombined,
      maxTokens: params.max_tokens ?? 50,
      temperature: params.temperature ?? 1,
    });
    return toRealStream(stream, params.model, textsCombined);
  }

  const response = await cohere.generate(config);
  return {
    model: params.model,
    created: getUnixTimestamp(),
    usage: toUsage(textsCombined, response.generations[0].text),
    choices: [
      {
        message: {
          content: response.generations[0].text,
          role: 'assistant',
        },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

async function* toRealStream(
  stream: AsyncIterable<CohereStreamEvent>,
  model: string,
  prompt: string,
): AsyncIterable<StreamingChunk> {
  let fullText = '';
  for await (const event of stream) {
    if (event.eventType === 'text-generation') {
      fullText += event.text ?? '';
      yield {
        model,
        created: getUnixTimestamp(),
        usage: toUsage(prompt, fullText),
        choices: [
          {
            delta: { content: event.text, role: 'assistant' },
            finish_reason: null,
            index: 0,
          },
        ],
      };
    } else if (event.eventType === 'stream-end') {
      yield {
        model,
        created: getUnixTimestamp(),
        usage: toUsage(prompt, fullText),
        choices: [
          {
            delta: { content: '', role: 'assistant' },
            finish_reason: 'stop',
            index: 0,
          },
        ],
      };
    } else if (event.eventType === 'stream-error') {
      const msg = (event as { message?: string }).message ?? 'unknown';
      throw new Error(`Cohere stream error: ${msg}`);
    }
  }
}

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('command', CohereHandler);
