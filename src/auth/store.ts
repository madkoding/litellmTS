import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, hostname } from 'node:os';
import { scryptSync, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const PEPPER = 'litellmts-core@v1';

function deriveKey(): Buffer {
  const seed = `${hostname()}-${process.getuid?.() ?? process.pid}-${PEPPER}`;
  return scryptSync(seed, 'credentials-key-salt', KEY_LENGTH);
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length < 3) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const tag = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let plaintext = decipher.update(encrypted, 'hex', 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}

/** GitHub Copilot OAuth credentials. */
export interface CopilotCredentials {
  githubToken: string;
  copilotToken: string;
  expiresAt: number;
  enterpriseUrl?: string;
}

/** Stored Anthropic API key. */
export interface AnthropicCredentials {
  apiKey: string;
}

export type ProviderCredentials = Record<string, unknown>;

const STORE_DIR = join(homedir(), '.litellm');
const STORE_PATH = join(STORE_DIR, 'auth.json');

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT';
}

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readStore(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(STORE_PATH, 'utf-8');
    if (!raw.startsWith('{')) {
      return JSON.parse(decrypt(raw)) as Record<string, unknown>;
    }
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    if (isNotFound(err)) return {};
    throw err;
  }
}

async function writeStore(data: Record<string, unknown>): Promise<void> {
  const plaintext = JSON.stringify(data);
  const encrypted = encrypt(plaintext);
  await writeFile(STORE_PATH, encrypted, 'utf-8');
}

export async function getProviderCredentials<T>(
  provider: string,
): Promise<T | null> {
  try {
    const store = await readStore();
    const raw = store[provider];
    if (!raw) return null;
    return raw as T;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function setProviderCredentials(
  provider: string,
  creds: Record<string, unknown>,
): Promise<void> {
  await ensureDir();
  const store = await readStore();
  store[provider] = creds;
  await writeStore(store);
}

export async function getCopilotCredentials(): Promise<CopilotCredentials | null> {
  const legacy = await getProviderCredentials<CopilotCredentials>('github-copilot');
  if (legacy) return legacy;

  try {
    const store = await readStore();
    if (store.copilotToken && store.githubToken) {
      const migrated: CopilotCredentials = {
        githubToken: store.githubToken as string,
        copilotToken: store.copilotToken as string,
        expiresAt: store.expiresAt as number,
        enterpriseUrl: store.enterpriseUrl as string | undefined,
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
    await writeStore({});
  } catch {
    // ignore
  }
}
