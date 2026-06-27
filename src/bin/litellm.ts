#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-unsafe-return */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { login } from '../auth/copilot';
import { loginAnthropic } from '../auth/anthropic';

export function findPackageJson(startDir: string): { version: string } {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    try {
      return JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
    } catch {
      dir = resolve(dir, '..');
    }
  }
  throw new Error('Could not find package.json');
}

export async function runCli(argv: string[]): Promise<void> {
  const pkg = findPackageJson(__dirname);
  const [cmd, subcmd] = argv;

  if (cmd === 'login' && subcmd === 'copilot') {
    await login();
  } else if (cmd === 'login' && subcmd === 'anthropic') {
    await loginAnthropic();
  } else if (cmd === '--version' || cmd === '-v') {
    console.log(pkg.version);
  } else {
    console.log(`litellmTS v${pkg.version}`);
    console.log('');
    console.log('Uso:');
    console.log('  litellm login copilot      Iniciar sesión en GitHub Copilot');
    console.log('  litellm login anthropic    Configurar API key de Anthropic');
    console.log('  litellm --version          Mostrar versión');
  }
}

if (require.main === module) {
  runCli(process.argv.slice(2)).catch((err: Error) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
}
