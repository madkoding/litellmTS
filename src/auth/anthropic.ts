/* eslint-disable no-console */
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { setProviderCredentials } from './store';

/**
 * Interactive CLI prompt to configure and validate an Anthropic API key.
 *
 * Prompts the user to paste a key, validates it with a lightweight API call,
 * and persists to `~/.litellm/auth.json`.
 */
export async function loginAnthropic(): Promise<void> {
  console.log('\n🔑 Configurando clave API de Anthropic...\n');
  console.log('  1. Abre https://console.anthropic.com/ en tu navegador');
  console.log('  2. Ve a API Keys → Create Key');
  console.log('  3. Copia la key (comienza con "sk-ant-")\n');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const apiKey = await rl.question('✏️  Pega tu API key: ');
  rl.close();

  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('No se ingresó ninguna key');
  }

  if (!trimmed.startsWith('sk-ant-')) {
    console.warn('⚠️  La key no comienza con "sk-ant-". Asegúrate de haber copiado la key correcta.');
  }

  // Validate with a lightweight API call
  console.log('🔄 Validando key...');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': trimmed,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Key inválida. Respuesta de Anthropic: ${res.status} ${res.statusText}\n${text}`,
    );
  }

  await setProviderCredentials('anthropic', { apiKey: trimmed });
  console.log('✅ Key de Anthropic guardada exitosamente en ~/.litellm/auth.json');
}
