<p align="center">
  <strong>Unified TypeScript interface for 45+ LLM providers</strong><br>
  One API. Every model. Zero boilerplate.
</p>

<p align="center">
  <a href="https://github.com/madkoding/litellmTS/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-GPLv3-blue.svg" alt="License"/>
  </a>
  <a href="https://www.npmjs.com/package/litellmts-core">
    <img src="https://img.shields.io/npm/v/litellmts-core" alt="npm"/>
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node"/>
  </a>
  <a href="https://github.com/madkoding/litellmTS/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/madkoding/litellmTS/ci.yml" alt="CI"/>
  </a>
</p>

---

## Installation

```bash
npm install litellmts-core
```

### From GitHub (alternative)

```json
{
  "dependencies": {
    "litellmts-core": "github:madkoding/litellmTS"
  }
}
```

## Quick Start

```ts
import { completion } from 'litellmts-core';

const response = await completion({
  model: 'openai/gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

Swap providers by changing just the model string:

```ts
// Same code, different provider:
await completion({ model: 'anthropic/claude-sonnet-4-20250514', ... });
await completion({ model: 'gemini/gemini-2.5-pro', ... });
await completion({ model: 'groq/llama-3.3-70b', ... });
await completion({ model: 'deepseek/deepseek-chat', ... });
```

## Features

- **Unified API** — same `completion()` / `embedding()` for every provider
- **Streaming** — all providers support `stream: true`
- **Tool calling** — native function/tool calling support across OpenAI, Anthropic, Gemini, Cohere, Ollama
- **Extended thinking** — Anthropic `thinking` and Ollama Qwen `thinking` support
- **Model listing** — `listModels('openai')` fetches available models from each provider's API
- **Provider discovery** — `listProviders()` returns all configured providers
- **TypeScript first** — full type safety with auto-completion, zero `any` in public API
- **45+ providers** — from OpenAI to niche OpenAI-compatible APIs
- **No SDK sprawl** — one dependency replaces 10+ vendor SDKs
- **CLI auth** — built-in OAuth device flow for GitHub Copilot & API key setup for Anthropic
- **Encrypted auth store** — `~/.litellm/auth.json` protected with AES-256-GCM (key derived from hostname + homedir), `chmod 600` file permissions
- **Zero lint errors** — 100% ESLint clean across the entire codebase

## Usage

### Non-streaming

```ts
import { completion } from 'litellmts-core';

const response = await completion({
  model: 'openai/gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
  temperature: 0.7,
  max_tokens: 500,
});

console.log(response.choices[0].message.content);
// { role: 'assistant', content: 'TypeScript is...' }
console.log(response.usage);
// { prompt_tokens: 25, completion_tokens: 120, total_tokens: 145 }
```

### Streaming

```ts
const stream = await completion({
  model: 'anthropic/claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Write a poem' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

### Embeddings

```ts
import { embedding } from 'litellmts-core';

const result = await embedding({
  model: 'openai/text-embedding-3-small',
  input: 'Hello world',
});

console.log(result.data[0].embedding); // number[]
```

### Model Discovery

```ts
import { listModels, listProviders, clearModelCache } from 'litellmts-core';

// List all available models for a provider (fetched live from their API)
const models = await listModels('openai');
// => [{ id: 'gpt-4o', provider: 'openai', created: 1700000000 }, ...]

// List all configured providers
const providers = listProviders();
// => [{ name: 'openai', hasModelList: true }, { name: 'groq', hasModelList: true }, ...]

// Get models for a specific provider with apiKey override
const groqModels = await listModels('groq', { apiKey: 'gsk_...' });

// Clear cached model lists (re-fetches on next call)
clearModelCache();
```

### Tool Calling

```ts
const response = await completion({
  model: 'openai/gpt-4o-mini',
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  }],
});

// The model may return tool_calls in the response
const toolCalls = response.choices[0].message.tool_calls;
```

### Extended Thinking (Anthropic)

```ts
const response = await completion({
  model: 'anthropic/claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Solve this step by step...' }],
  thinking: { type: 'enabled', budget_tokens: 5000 },
});

// Response includes reasoning in the message
console.log(response.choices[0].message.reasoning);
```

### API Keys

Keys are read from environment variables by default:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GROQ_API_KEY=gsk_...
```

Or pass them inline:

```ts
await completion({
  model: 'groq/llama-3.3-70b',
  messages: [],
  apiKey: 'gsk_...',
});
```

### CLI Auth

```bash
# GitHub Copilot (OAuth device flow)
npx litellm login copilot

# Anthropic (API key prompt)
npx litellm login anthropic
```

## Supported Providers

### Dedicated Handlers

| Provider | Model prefix | Completion | Streaming | Embedding | API Key Env |
|---|---|---|---|---|---|
| OpenAI | `openai/` | ✅ | ✅ | ✅ | `OPENAI_API_KEY` |
| Anthropic | `anthropic/` | ✅ | ✅ | ❌ | `ANTHROPIC_API_KEY` |
| Google Gemini | `gemini/` | ✅ | ✅ | ✅ | `GEMINI_API_KEY` |
| GitHub Copilot | `copilot/` | ✅ | ✅ | ❌ | (OAuth) |
| Cohere | `cohere/` | ✅ | ✅ | ❌ | `COHERE_API_KEY` |
| Replicate | `replicate/` | ✅ | ✅ | ❌ | `REPLICATE_API_KEY` |
| AI21 Labs | `ai21/` | ✅ | ✅ | ❌ | `AI21_API_KEY` |
| Ollama (local) | `ollama/` `ollama_local/` | ✅ | ✅ | ✅ | `OLLAMA_API_KEY` |

### OpenAI-Compatible (37 providers)

| Provider | Prefix | API Key Env |
|---|---|---|
| Groq | `groq/` | `GROQ_API_KEY` |
| DeepSeek | `deepseek/` | `DEEPSEEK_API_KEY` |
| Perplexity | `perplexity/` | `PERPLEXITY_API_KEY` |
| X AI (Grok) | `xai/` | `XAI_API_KEY` |
| OpenRouter | `openrouter/` | `OPENROUTER_API_KEY` |
| Together AI | `together/` | `TOGETHER_API_KEY` |
| Fireworks AI | `fireworks/` | `FIREWORKS_API_KEY` |
| Cerebras | `cerebras/` | `CEREBRAS_API_KEY` |
| SambaNova | `sambanova/` | `SAMBANOVA_API_KEY` |
| Nebius AI | `nebius/` | `NEBIUS_API_KEY` |
| Hyperbolic | `hyperbolic/` | `HYPERBOLIC_API_KEY` |
| Novita AI | `novita/` | `NOVITA_API_KEY` |
| GitHub Models | `github/` | `GITHUB_TOKEN` |
| Anyscale | `anyscale/` | `ANYSCALE_API_KEY` |
| NVIDIA NIM | `nvidia_nim/` | `NVIDIA_API_KEY` |
| Codestral | `codestral/` | `CODESTRAL_API_KEY` |
| Moonshot | `moonshot/` | `MOONSHOT_API_KEY` |
| DashScope (Alibaba) | `dashscope/` | `DASHSCOPE_API_KEY` |
| Meta Llama | `meta_llama/` | `LLAMA_API_KEY` |
| Featherless AI | `featherless/` | `FEATHERLESS_API_KEY` |
| Nscale | `nscale/` | `NSCALE_API_KEY` |
| Inception Labs | `inception/` | `INCEPTION_API_KEY` |
| Morph LLM | `morph/` | `MORPH_API_KEY` |
| Lambda AI | `lambda/` | `LAMBDA_API_KEY` |
| AIML API | `aiml/` | `AIML_API_KEY` |
| Weights & Biases | `wandb/` | `WANDB_API_KEY` |
| Volcengine | `volcengine/` | `VOLCENGINE_API_KEY` |
| Galadriel | `galadriel/` | `GALADRIEL_API_KEY` |
| Empower | `empower/` | `EMPOWER_API_KEY` |
| Friendli AI | `friendliai/` | `FRIENDLI_API_KEY` |
| Helicone | `helicone/` | `HELICONE_API_KEY` |
| Vercel AI Gateway | `vercel_ai/` | `VERCEL_AI_GATEWAY_API_KEY` |
| Clarifai | `clarifai/` | `CLARIFAI_API_KEY` |
| Baseten | `baseten/` | `BASETEN_API_KEY` |
| PublicAI | `publicai/` | `PUBLICAI_API_KEY` |
| Venice AI | `venice/` | `VENICE_API_KEY` |
| Mistral | `mistral/` | `MISTRAL_API_KEY` |
| DeepInfra | `deepinfra/` | `DEEPINFRA_API_KEY` |

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│  completion() │────▶│  getHandler() │────▶│  OpenAIHandler   │
│  embedding()  │     │  (prefix      │     │  AnthropicHandler│
│  listModels() │     │   matching)   │     │  GeminiHandler   │
│  listProviders│     │              │     │  OpenAILikeHandler│
└──────────────┘     └──────────────┘     │  OllamaHandler    │
                            │              │  CohereHandler    │
                     ┌──────┴──────┐      │  ...              │
                     │  Registry   │      └─────────────────┘
                     │  openai/ →  │
                     │  anthropic/ │       ┌──────────────────┐
                     │  groq/ → .. │       │  Model Registry  │
                     └─────────────┘       │  (in-memory      │
                                           │   cache + TTL)   │
                                           │                  │
                                           │  listModels()    │
                                           │  listProviders() │
                                           │  clearModelCache()│
                                           └──────────────────┘
```

Ollama is split into focused modules under `src/handlers/ollama/`:
`types`, `mappers`, `url`, `request`, `qwen`, `stream`, `models`, `register`, `index`.
Streaming uses a unified `iterateStream<C>` iterator with a strategy pattern (Qwen, native Ollama, OpenAI-compatible).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and PR guidelines.

## Development

```bash
# Clone
git clone https://github.com/madkoding/litellmTS.git
cd litellmTS

# Install
npm install

# Run unit tests
npm t

# Run E2E tests (requires API keys in .env)
cp .env.example .env
npm run test:e2e

# Build
npm run build
```

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

## Why not just use the Python version?

litellmTS is a native TypeScript implementation designed for Node.js/Deno/Bun environments. It has zero Python dependencies and integrates naturally with the TypeScript ecosystem (type safety, IDE autocompletion, etc.). Think of it as litellm, but for the JS/TS world.
