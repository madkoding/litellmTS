#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { login } from '../auth/copilot';
import { loginAnthropic } from '../auth/anthropic';

function findPackageJson(startDir: string): { version: string } {
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

const pkg = findPackageJson(__dirname);

const [cmd, subcmd] = process.argv.slice(2);

if (cmd === 'login' && subcmd === 'copilot') {
  login().catch((err: Error) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
} else if (cmd === 'login' && subcmd === 'anthropic') {
  loginAnthropic().catch((err: Error) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
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
