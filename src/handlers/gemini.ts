import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  Content,
  Part,
  GenerateContentResponse,
} from '@google/generative-ai';

import {
  HandlerParams,
  Message,
  ResultNotStreaming,
  ResultStreaming,
  FinishReason,
  type ConsistentResponseUsage,
} from '../types';
import { getUnixTimestamp } from '../utils/getUnixTimestamp';

function toGeminiContent(messages: Message[]): Content[] {
  return messages.map((msg) => {
    const parts: Part[] = [];
    if (msg.content) {
      parts.push({ text: msg.content });
    }
    return {
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts,
    };
  });
}

function toFinishReason(reason: string | undefined | null): FinishReason {
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    default:
      return 'stop';
  }
}

function toUsage(
  meta: GenerateContentResponse['usageMetadata'],
): ConsistentResponseUsage | undefined {
  if (!meta) return undefined;
  return {
    prompt_tokens: meta.promptTokenCount,
    completion_tokens: meta.candidatesTokenCount,
    total_tokens: meta.totalTokenCount,
  };
}

function toResponse(
  response: GenerateContentResponse,
  model: string,
): ResultNotStreaming {
  const candidate = response.candidates?.[0];
  return {
    model: model,
    created: getUnixTimestamp(),
    usage: toUsage(response.usageMetadata),
    choices: [
      {
        index: candidate?.index ?? 0,
        finish_reason: toFinishReason(candidate?.finishReason),
        message: {
          role: 'assistant',
          content: candidate ? candidate.content.parts.map((p) => 'text' in p ? p.text : '').join('') : null,
        },
      },
    ],
  };
}

async function* toStreamingResponse(
  stream: AsyncGenerator<GenerateContentResponse>,
): ResultStreaming {
  for await (const chunk of stream) {
    const candidate = chunk.candidates?.[0];
    const deltaContent = candidate?.content.parts.map((p) => 'text' in p ? p.text : '').join('') ?? '';
    yield {
      model: undefined,
      created: getUnixTimestamp(),
      usage: toUsage(chunk.usageMetadata),
      choices: [
        {
          index: candidate?.index ?? 0,
          finish_reason: toFinishReason(candidate?.finishReason),
          delta: {
            content: deltaContent,
            role: 'assistant',
          },
        },
      ],
    };
  }
}

export async function GeminiHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini requires an API key. Set GEMINI_API_KEY environment variable or pass apiKey in params.');
  const modelName = params.model.startsWith('gemini/')
    ? params.model.slice(7)
    : params.model;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: params.temperature ?? undefined,
      topP: params.top_p ?? undefined,
      maxOutputTokens: params.max_tokens ?? undefined,
      stopSequences: params.stop ? (Array.isArray(params.stop) ? params.stop : [params.stop]) : undefined,
    },
  });

  const contents = toGeminiContent(params.messages);

  if (params.stream) {
    const result = await model.generateContentStream({ contents });
    return toStreamingResponse(result.stream);
  }

  const result = await model.generateContent({ contents });
  return toResponse(result.response, modelName);
}

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('gemini/', GeminiHandler);
