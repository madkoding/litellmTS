import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CopilotCredentials {
  githubToken: string;
  copilotToken: string;
  expiresAt: number;
  enterpriseUrl?: string;
}

export interface AnthropicCredentials {
  apiKey: string;
}

export type ProviderCredentials = Record<string, unknown>;

const STORE_DIR = join(homedir(), '.litellm');
const STORE_PATH = join(STORE_DIR, 'auth.json');

async function ensureDir(): Promise<void> {
  try {
    await mkdir(STORE_DIR, { recursive: true });
  } catch {
    // directory already exists
  }
}

export async function getProviderCredentials<T>(
  provider: string,
): Promise<T | null> {
  try {
    const data = await readFile(STORE_PATH, 'utf-8');
    const store = JSON.parse(data) as Record<string, unknown>;

    const raw = store[provider];
    if (!raw) return null;
    return raw as T;
  } catch {
    return null;
  }
}

export async function setProviderCredentials(
  provider: string,
  creds: Record<string, unknown>,
): Promise<void> {
  await ensureDir();
  let store: Record<string, unknown> = {};
  try {
    const data = await readFile(STORE_PATH, 'utf-8');
    store = JSON.parse(data);
  } catch {
    // new file
  }
  store[provider] = creds;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

// Backward-compat old single-provider format
export async function getCopilotCredentials(): Promise<CopilotCredentials | null> {
  const legacy = await getProviderCredentials<CopilotCredentials>('github-copilot');
  if (legacy) return legacy;

  try {
    const data = await readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed.copilotToken && parsed.githubToken) {
      const migrated: CopilotCredentials = {
        githubToken: parsed.githubToken,
        copilotToken: parsed.copilotToken,
        expiresAt: parsed.expiresAt,
        enterpriseUrl: parsed.enterpriseUrl,
      };
      await setProviderCredentials('github-copilot', migrated as unknown as Record<string, unknown>);
      return migrated;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function setCopilotCredentials(
  creds: CopilotCredentials,
): Promise<void> {
  await setProviderCredentials('github-copilot', creds as unknown as Record<string, unknown>);
}

export async function getAnthropicCredentials(): Promise<AnthropicCredentials | null> {
  return getProviderCredentials<AnthropicCredentials>('anthropic');
}

export async function setAnthropicCredentials(
  creds: AnthropicCredentials,
): Promise<void> {
  await setProviderCredentials('anthropic', creds as unknown as Record<string, unknown>);
}

export async function clearCredentials(): Promise<void> {
  try {
    await writeFile(STORE_PATH, JSON.stringify({}), 'utf-8');
  } catch {
    // ignore
  }
}
