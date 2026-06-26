import { GoogleGenAI } from '@google/genai';

import type { HandlerParams, ResultNotStreaming, ResultStreaming } from '../types';
import {
  toGeminiContent,
  toGeminiTools,
  toGeminiToolConfig,
  toResponse,
  toStreamingResponse,
} from '../utils/gemini';

export async function GeminiHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini requires an API key. Set GEMINI_API_KEY environment variable or pass apiKey in params.');
  const modelName = stripPrefix(params.model, 'gemini/');

  const client = new GoogleGenAI({ apiKey });

  const contents = toGeminiContent(params.messages);
  const tools = toGeminiTools(params.tools);
  const toolConfig = toGeminiToolConfig(params.tool_choice);

  const config: Record<string, unknown> = {
    temperature: params.temperature ?? undefined,
    topP: params.top_p ?? undefined,
    maxOutputTokens: params.max_tokens ?? undefined,
    stopSequences: params.stop ? (Array.isArray(params.stop) ? params.stop : [params.stop]) : undefined,
  };
  if (tools) config.tools = tools;
  if (toolConfig) config.toolConfig = toolConfig;

  try {
    if (params.stream) {
      const stream = await client.models.generateContentStream({
        model: modelName,
        contents,
        config: config,
      });
      return toStreamingResponse(stream, modelName);
    }

    const response = await client.models.generateContent({
      model: modelName,
      contents,
      config: config,
    });
    return toResponse(response, modelName);
  } catch (err) {
    throw wrapApiError('Gemini', err);
  }
}

import { registerModelProvider } from '../models';
import { stripPrefix } from '../utils/stripPrefix';
import { wrapApiError } from '../utils/wrapApiError';

registerModelProvider('gemini', async ({ apiKey } = {}) => {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) return [];
  const client = new GoogleGenAI({ apiKey: key });
  const pager = await client.models.list();
  const models: { id: string; provider: string }[] = [];
  for await (const m of pager) {
    models.push({ id: (m as any).name ?? (m as any).displayName, provider: 'gemini' });
  }
  return models;
});

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('gemini/', GeminiHandler);
