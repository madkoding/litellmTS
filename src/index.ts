/**
 * @litellmts/core — Unified API client for 45+ LLM providers.
 *
 * @example
 * import { completion } from '@litellmts/core';
 * const res = await completion({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] });
 */
export { completion } from './completion';
export { embedding } from './embedding';
export { login, loginAnthropic, getValidToken, getAnthropicKey } from './auth';
