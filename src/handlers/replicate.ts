import Replicate, { type Prediction } from 'replicate';
import { EventSource } from 'eventsource';

import {
  HandlerParams,
  ResultStreaming,
  ResultNotStreaming,
} from '../types';
import { combinePrompts } from '../utils/combinePrompts';
import { toUsage } from '../utils/toUsage';
import { getUnixTimestamp } from '../utils/getUnixTimestamp';

async function sleep(time: number): Promise<unknown> {
  return new Promise((res) => {
    setTimeout(() => {
      res({});
    }, time);
  });
}

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
    created: getUnixTimestamp(),
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

  const source = new EventSource(prediction.urls.stream, {
    withCredentials: true,
  });

  let results: string[] = [];
  let done = false;

  let resolve: (a: unknown) => void;
  let promise = new Promise((r) => (resolve = r));

  source.addEventListener('output', (e: MessageEvent) => {
    results.push(e.data as string);
    resolve({});
    promise = new Promise((r) => (resolve = r));
  });

  source.addEventListener('done', () => {
    done = true;
    source.close();
  });

  while (!done) {
    await promise;
    await sleep(500);
    const combined = results.reduce((acc, curr) => acc + curr, '');
    yield {
      created: getUnixTimestamp(),
      usage: toUsage(prompt, combined),
      choices: [
        {
          delta: {
            content: combined,
            role: 'assistant',
          },
          index: 0,
          finish_reason: 'stop',
        },
      ],
    };
    results = [];
  }
}

export async function ReplicateHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.REPLICATE_API_KEY;
  const replicate = new Replicate({
    auth: apiKey,
  });
  const modelName = params.model.startsWith('replicate/')
    ? params.model.slice(10)
    : params.model;
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
    throw new Error(`Replicate API error: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  if (params.stream) {
    return handleStreamingPrediction(prompt, prediction);
  }
  return handleNonStreamingPrediction(prompt, prediction, replicate, modelName);
}

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('replicate/', ReplicateHandler);
