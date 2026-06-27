import Replicate, { type Prediction } from 'replicate';

import {
  HandlerParams,
  ResultStreaming,
  ResultNotStreaming,
} from '../types';
import { combinePrompts } from '../utils/combinePrompts';
import { toUsage } from '../utils/toUsage';
import { stripPrefix } from '../utils/stripPrefix';
import { wrapApiError } from '../utils/wrapApiError';
import { nowSec } from '../utils/nowSec';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

async function handleNonStreamingPrediction(
  prompt: string,
  prediction: Prediction,
  replicate: Replicate,
  modelName: string,
): Promise<ResultNotStreaming> {
  const pred = await replicate.wait(prediction, {});
  const output: string = (pred.output as string[]).reduce(
    (acc, curr) => acc + curr,
    '',
  );
  return {
    model: modelName,
    usage: toUsage(prompt, output),
      created: nowSec(),
    choices: [
      {
        message: {
          role: 'assistant',
          content: output,
        },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

async function* handleStreamingPrediction(
  prompt: string,
  prediction: Prediction,
): ResultStreaming {
  if (!prediction?.urls?.stream) {
    throw new Error('Prediction does not support streaming');
  }

  const source = new EventSource(prediction.urls.stream);

  let accumulated = '';
  let pending = '';
  let done = false;

  let resolve: (a: unknown) => void;
  let promise = new Promise((r) => (resolve = r));

  const timeout = setTimeout(() => {
    source.close();
    done = true;
    resolve({});
  }, 30_000);

  source.addEventListener('output', (e: MessageEvent) => {
    pending += e.data as string;
    resolve({});
    promise = new Promise((r) => (resolve = r));
  });

  source.addEventListener('done', () => {
    done = true;
    clearTimeout(timeout);
    source.close();
    resolve({});
  });

  while (!done) {
    await promise;
    if (!pending) continue;
    accumulated += pending;
    const delta = pending;
    pending = '';
    yield {
      created: nowSec(),
      usage: toUsage(prompt, accumulated),
      choices: [
        {
          delta: {
            content: delta,
            role: 'assistant',
          },
          index: 0,
          finish_reason: 'stop',
        },
      ],
    };
  }

  if (pending) {
    accumulated += pending;
    yield {
      created: nowSec(),
      usage: toUsage(prompt, accumulated),
      choices: [
        {
          delta: {
            content: pending,
            role: 'assistant',
          },
          index: 0,
          finish_reason: 'stop',
        },
      ],
    };
  }
}

export async function ReplicateHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.REPLICATE_API_KEY;
  const replicate = new Replicate({
    auth: apiKey,
  });
  const modelName = stripPrefix(params.model, 'replicate/');
  const version = modelName.split(':')[1];
  if (!version) {
    throw new Error(`Invalid Replicate model format: ${params.model}. Expected format: replicate/<owner>/<name>:<version>`);
  }

  const prompt = combinePrompts(params.messages);
  let prediction: Prediction;
  try {
    prediction = await replicate.predictions.create({
      version: version,
      input: {
        prompt,
      },
    });
  } catch (err) {
    throw wrapApiError('Replicate', err);
  }

  if (params.stream) {
    return handleStreamingPrediction(prompt, prediction);
  }
  return handleNonStreamingPrediction(prompt, prediction, replicate, modelName);
}

import { registerModelProvider } from '../models';

registerModelProvider('replicate', async ({ apiKey } = {}) => {
  const key = apiKey ?? process.env.REPLICATE_API_KEY;
  if (!key) return [];
  const res = await fetchWithTimeout('https://api.replicate.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  const { results } = await res.json() as { results?: { owner: string; name: string }[] };
  return (results ?? []).map((m) => ({ id: `${m.owner}/${m.name}`, provider: 'replicate' }));
});

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('replicate/', ReplicateHandler);
