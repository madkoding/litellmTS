/* eslint-disable no-console */
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { setCopilotCredentials } from './store';
import { exchangeCopilotToken } from './refresh';
import { USER_AGENT } from './constants';

const CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const SCOPES = 'read:user';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
}

interface AccessTokenResponse {
  access_token: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function openBrowser(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execFileSync('open', [url], { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
    } else {
      execFileSync('xdg-open', [url], { stdio: 'ignore' });
    }
  } catch {
    // browser open failed, user can open manually
  }
}

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to request device code: ${res.status}`);
  }

  return res.json() as Promise<DeviceCodeResponse>;
}

export async function pollAccessToken(
  deviceCode: string,
  interval: number,
): Promise<string> {
  const body = {
    client_id: CLIENT_ID,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  };

  let attempts = 0;
  const maxAttempts = 120; // ~10 min max

  while (attempts < maxAttempts) {
    attempts++;
    await setTimeout(interval * 1000);

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Polling error: ${res.status}`);
    }

    const data = (await res.json()) as AccessTokenResponse;

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === 'authorization_pending') {
      continue;
    }

    if (data.error === 'slow_down') {
      interval += 5;
      continue;
    }

    if (
      data.error === 'expired_token' ||
      data.error === 'access_denied'
    ) {
      throw new Error(
        data.error_description ?? `Authentication cancelled: ${data.error}`,
      );
    }
  }

  throw new Error('Authentication timed out');
}

/**
 * Start the GitHub Copilot OAuth device-code login flow.
 *
 * Opens the browser for user authorization, polls for the GitHub access token,
 * exchanges it for a Copilot token, and persists credentials to `~/.litellm/auth.json`.
 *
 * @param deployment - GitHub deployment URL (default: `'github.com'`)
 */
export async function login(
  deployment = 'github.com',
): Promise<void> {
  console.log('\n🔐 Logging in to GitHub Copilot...\n');

  const deviceCode = await requestDeviceCode();

  console.log(`✏️  Verification code: ${deviceCode.user_code}`);
  console.log(`🌐 Opening ${deviceCode.verification_uri} in your browser...\n`);

  openBrowser(deviceCode.verification_uri);

  console.log('⏳ Waiting for authorization...');

  const githubToken = await pollAccessToken(
    deviceCode.device_code,
    deviceCode.interval,
  );

  console.log('✅ GitHub authorization successful');
  console.log('🔄 Fetching Copilot token...');

  const copilotToken = await exchangeCopilotToken(githubToken);

  await setCopilotCredentials({
    githubToken,
    copilotToken: copilotToken.token,
    expiresAt: copilotToken.expires_at * 1000,
    enterpriseUrl: deployment !== 'github.com' ? deployment : undefined,
  });

  console.log('✅ GitHub Copilot authentication completed successfully');
}
