import {
  getCopilotCredentials,
  setCopilotCredentials,
  getProviderCredentials,
} from './store';


import { COPILOT_API, USER_AGENT, EDITOR_VERSION, EDITOR_PLUGIN_VERSION, COPILOT_INTEGRATION_ID } from './constants';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { withRetry } from '../utils/withRetry';

export async function exchangeCopilotToken(
  githubToken: string,
): Promise<{ token: string; expires_at: number }> {
  return withRetry(async () => {
    const res = await fetchWithTimeout(`${COPILOT_API}/copilot_internal/v2/token`, {
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
        `Failed to refresh Copilot token: ${res.status} ${res.statusText}`,
      );
    }

    const data = (await res.json()) as {
      token: string;
      expires_at: number;
      error?: string;
    };

    if (data.error) {
      throw new Error(`Failed to refresh token: ${data.error}`);
    }

    return { token: data.token, expires_at: data.expires_at };
  });
}

let refreshInFlight: Promise<string> | undefined;

export async function getValidToken(): Promise<string | null> {
  const creds = await getCopilotCredentials();

  if (!creds?.copilotToken || !creds?.githubToken) {
    return null;
  }

  if (creds.expiresAt - 5 * 60 * 1000 < Date.now()) {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const newToken = await exchangeCopilotToken(creds.githubToken);
        await setCopilotCredentials({
          ...creds,
          copilotToken: newToken.token,
          expiresAt: newToken.expires_at * 1000,
        });
        return newToken.token;
      } catch (err) {
        throw new Error(`Failed to refresh Copilot token: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      } finally {
        refreshInFlight = undefined;
      }
    })();
    return refreshInFlight;
  }

  return creds.copilotToken;
}

export async function getAnthropicKey(): Promise<string | null> {
  const creds = await getProviderCredentials<{ apiKey: string }>('anthropic');
  return creds?.apiKey ?? null;
}
