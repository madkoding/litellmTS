export interface OpenAILikeConfig {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
}

export const OPENAI_LIKE_MAPPINGS: Record<string, OpenAILikeConfig> = {
  'groq/': {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  'deepseek/': {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/beta',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  'perplexity/': {
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
  },
  'xai/': {
    name: 'X AI',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
  },
  'openrouter/': {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
  'together/': {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHER_API_KEY',
  },
  'fireworks/': {
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiKeyEnv: 'FIREWORKS_API_KEY',
  },
  'cerebras/': {
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKeyEnv: 'CEREBRAS_API_KEY',
  },
  'sambanova/': {
    name: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai/v1',
    apiKeyEnv: 'SAMBANOVA_API_KEY',
  },
  'nebius/': {
    name: 'Nebius AI',
    baseUrl: 'https://api.studio.nebius.ai/v1',
    apiKeyEnv: 'NEBIUS_API_KEY',
  },
  'hyperbolic/': {
    name: 'Hyperbolic',
    baseUrl: 'https://api.hyperbolic.xyz/v1',
    apiKeyEnv: 'HYPERBOLIC_API_KEY',
  },
  'novita/': {
    name: 'Novita AI',
    baseUrl: 'https://api.novita.ai/v3/openai',
    apiKeyEnv: 'NOVITA_API_KEY',
  },
  'github/': {
    name: 'GitHub Models',
    baseUrl: 'https://models.inference.ai.azure.com',
    apiKeyEnv: 'GITHUB_TOKEN',
  },
  'anyscale/': {
    name: 'Anyscale',
    baseUrl: 'https://api.endpoints.anyscale.com/v1',
    apiKeyEnv: 'ANYSCALE_API_KEY',
  },
  'nvidia_nim/': {
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
  },
  'ai21/': {
    name: 'AI21 Labs',
    baseUrl: 'https://api.ai21.com/studio/v1',
    apiKeyEnv: 'AI21_API_KEY',
  },
  'codestral/': {
    name: 'Codestral',
    baseUrl: 'https://codestral.mistral.ai/v1',
    apiKeyEnv: 'CODESTRAL_API_KEY',
  },
  'moonshot/': {
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.ai/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
  },
  'dashscope/': {
    name: 'DashScope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
  },
  'meta_llama/': {
    name: 'Meta Llama',
    baseUrl: 'https://api.llama.com/compat/v1',
    apiKeyEnv: 'LLAMA_API_KEY',
  },
  'featherless/': {
    name: 'Featherless AI',
    baseUrl: 'https://api.featherless.ai/v1',
    apiKeyEnv: 'FEATHERLESS_API_KEY',
  },
  'nscale/': {
    name: 'Nscale',
    baseUrl: 'https://inference.api.nscale.com/v1',
    apiKeyEnv: 'NSCALE_API_KEY',
  },
  'inception/': {
    name: 'Inception Labs',
    baseUrl: 'https://api.inceptionlabs.ai/v1',
    apiKeyEnv: 'INCEPTION_API_KEY',
  },
  'morph/': {
    name: 'Morph LLM',
    baseUrl: 'https://api.morphllm.com/v1',
    apiKeyEnv: 'MORPH_API_KEY',
  },
  'lambda/': {
    name: 'Lambda AI',
    baseUrl: 'https://api.lambda.ai/v1',
    apiKeyEnv: 'LAMBDA_API_KEY',
  },
  'aiml/': {
    name: 'AIML API',
    baseUrl: 'https://api.aimlapi.com/v1',
    apiKeyEnv: 'AIML_API_KEY',
  },
  'wandb/': {
    name: 'Weights & Biases',
    baseUrl: 'https://api.inference.wandb.ai/v1',
    apiKeyEnv: 'WANDB_API_KEY',
  },
  'volcengine/': {
    name: 'Volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyEnv: 'VOLCENGINE_API_KEY',
  },
  'galadriel/': {
    name: 'Galadriel',
    baseUrl: 'https://api.galadriel.com/v1',
    apiKeyEnv: 'GALADRIEL_API_KEY',
  },
  'empower/': {
    name: 'Empower',
    baseUrl: 'https://app.empower.dev/api/v1',
    apiKeyEnv: 'EMPOWER_API_KEY',
  },
  'friendliai/': {
    name: 'Friendli AI',
    baseUrl: 'https://api.friendli.ai/serverless/v1',
    apiKeyEnv: 'FRIENDLI_API_KEY',
  },
  'helicone/': {
    name: 'Helicone',
    baseUrl: 'https://ai-gateway.helicone.ai',
    apiKeyEnv: 'HELICONE_API_KEY',
  },
  'vercel_ai/': {
    name: 'Vercel AI Gateway',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
  },
  'clarifai/': {
    name: 'Clarifai',
    baseUrl: 'https://api.clarifai.com/v2/ext/openai/v1',
    apiKeyEnv: 'CLARIFAI_API_KEY',
  },
  'baseten/': {
    name: 'Baseten',
    baseUrl: 'https://inference.baseten.co/v1',
    apiKeyEnv: 'BASETEN_API_KEY',
  },
  'publicai/': {
    name: 'PublicAI',
    baseUrl: 'https://api.publicai.co/v1',
    apiKeyEnv: 'PUBLICAI_API_KEY',
  },
  'venice/': {
    name: 'Venice AI',
    baseUrl: 'https://api.venice.ai/api/v1',
    apiKeyEnv: 'VENICE_API_KEY',
  },
};
