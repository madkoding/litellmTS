import { readFile, writeFile, mkdir, chmod, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, hostname } from 'node:os';
import { scryptSync, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const PEPPER = 'litellmts-core@v1';

let cachedKey: Buffer | undefined;
function deriveKey(): Buffer {
  // ponytail: scrypt is ~100ms; cache the key for the process lifetime.
  if (cachedKey) return cachedKey;
  const seed = `${hostname()}-${homedir()}-${PEPPER}`;
  cachedKey = scryptSync(seed, 'credentials-key-salt', KEY_LENGTH);
  return cachedKey;
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

const STORE_DIR = join(homedir(), '.litellm');
const STORE_PATH = join(STORE_DIR, 'auth.json');
const STORE_TMP = join(STORE_DIR, 'auth.json.tmp');

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true, mode: 0o700 });
}

async function readStore(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(STORE_PATH, 'utf-8');
    if (!raw.startsWith('{')) {
      return JSON.parse(decrypt(raw)) as Record<string, unknown>;
    }
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return {};
    throw err;
  }
}

const STORE_VERSION = 1;

let writeLock: Promise<void> = Promise.resolve();
async function writeStore(data: Record<string, unknown>): Promise<void> {
  const run = writeLock.then(async () => {
    const payload = { ...data, __version: STORE_VERSION };
    const plaintext = JSON.stringify(payload);
    const encrypted = encrypt(plaintext);
    await writeFile(STORE_TMP, encrypted, 'utf-8');
    await chmod(STORE_TMP, 0o600);
    await rename(STORE_TMP, STORE_PATH);
  });
  writeLock = run.catch(() => undefined);
  await run;
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
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
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

export async function getCopilotCredentials() {
  const legacy = await getProviderCredentials<{ githubToken: string; copilotToken: string; expiresAt: number; enterpriseUrl?: string }>('github-copilot');
  if (legacy) return legacy;

  try {
    const store = await readStore();
    if (store.copilotToken && store.githubToken) {
      const migrated = {
        githubToken: store.githubToken as string,
        copilotToken: store.copilotToken as string,
        expiresAt: store.expiresAt as number,
        enterpriseUrl: store.enterpriseUrl as string | undefined,
      };
      await setProviderCredentials('github-copilot', migrated);
      return migrated;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[litellm] Copilot credential migration skipped: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

export async function setCopilotCredentials(
  creds: { githubToken: string; copilotToken: string; expiresAt: number; enterpriseUrl?: string },
): Promise<void> {
  await setProviderCredentials('github-copilot', creds);
}

export async function clearCredentials(): Promise<void> {
  await writeStore({});
}
