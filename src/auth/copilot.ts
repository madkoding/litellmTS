import { setCopilotCredentials } from './store';

const CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const SCOPES = 'read:user';
const COPILOT_API = 'https://api.githubcopilot.com';
const USER_AGENT = 'GitHubCopilotChat/0.35.0';
const EDITOR_VERSION = 'vscode/1.107.0';
const EDITOR_PLUGIN_VERSION = 'copilot-chat/0.35.0';
const COPILOT_INTEGRATION_ID = 'vscode-chat';

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

interface CopilotTokenResponse {
  token: string;
  expires_at: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openBrowser(url: string): void {
  const { execSync } = require('node:child_process');
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || x-www-browser "${url}"`, { stdio: 'ignore' });
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
    throw new Error(`Error al solicitar device code: ${res.status}`);
  }

  return res.json() as Promise<DeviceCodeResponse>;
}

async function pollAccessToken(
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
    await sleep(interval * 1000);

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
      throw new Error(`Error en polling: ${res.status}`);
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
        data.error_description ?? `Autenticación cancelada: ${data.error}`,
      );
    }
  }

  throw new Error('Tiempo de espera agotado para la autenticación');
}

async function exchangeCopilotToken(
  githubToken: string,
): Promise<CopilotTokenResponse> {
  const res = await fetch(`${COPILOT_API}/copilot_internal/v2/token`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'User-Agent': USER_AGENT,
      'Editor-Version': EDITOR_VERSION,
      'Editor-Plugin-Version': EDITOR_PLUGIN_VERSION,
      'Copilot-Integration-Id': COPILOT_INTEGRATION_ID,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Error al obtener token de Copilot: ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as CopilotTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(
      data.error_description ?? `Error de Copilot: ${data.error}`,
    );
  }

  return { token: data.token, expires_at: data.expires_at };
}

export async function login(
  deployment: 'github.com' | string = 'github.com',
): Promise<void> {
  console.log('\n🔐 Iniciando sesión en GitHub Copilot...\n');

  const deviceCode = await requestDeviceCode();

  console.log(`✏️  Código de verificación: ${deviceCode.user_code}`);
  console.log(`🌐 Abriendo ${deviceCode.verification_uri} en tu navegador...\n`);

  openBrowser(deviceCode.verification_uri);

  console.log('⏳ Esperando autorización...');

  const githubToken = await pollAccessToken(
    deviceCode.device_code,
    deviceCode.interval,
  );

  console.log('✅ Autorización de GitHub exitosa');
  console.log('🔄 Obteniendo token de Copilot...');

  const copilotToken = await exchangeCopilotToken(githubToken);

  await setCopilotCredentials({
    githubToken,
    copilotToken: copilotToken.token,
    expiresAt: copilotToken.expires_at * 1000,
    enterpriseUrl: deployment !== 'github.com' ? deployment : undefined,
  });

  console.log('✅ Autenticación con GitHub Copilot completada exitosamente');
}
