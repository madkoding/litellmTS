# Agent Context

## Build Commands
- `npm run build` — full test + TypeScript compile
- `npm t` — unit tests (skips e2e)
- `npm run test:e2e` — full suite including e2e (requires `.env`)
- `npm run lint` — ESLint check
- `npm run lint -- --fix` — auto-fix lint issues

## Project Conventions
- Node >=22 required
- `typescript` ~5.9.3 (ts-jest incompatible with TS 6)
- `@types/jest` pinned to v29
- Imports: no comments in code; keep concise
- Error messages: English across all handlers
- Commit style: conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `security:`)

## Security Baseline (achieved 2026-06-26)
- 0 npm audit vulnerabilities across 674 packages
- All dependencies updated to latest compatible major versions
- Credential store: AES-256-GCM encrypted (`src/auth/store.ts`) — key derived from hostname + homedir
- OAuth shell injection eliminated (`execSync` → `execFileSync` in `src/auth/copilot.ts`)
- Auth file permissions: `chmod 600` on `~/.litellm/auth.json`
- Windows key stability: `homedir()` used instead of `process.pid` for key derivation
- Error messages: all English (migrated from Spanish in auth layer)
- ESLint `no-useless-assignment` fixed in 4 files

## Cross-cutting Utils
- `src/utils/stripPrefix.ts` — model prefix stripping (replaces 12 inline sites)
- `src/utils/wrapApiError.ts` — consistent error wrapping with `{ cause }` (replaces 7 sites)
- `src/utils/nowSec.ts` — `Math.floor(Date.now() / 1000)` (replaces 11+ sites)
- `src/utils/safeParseArgs.ts` — `try { JSON.parse(args) } catch {}` (replaces 4 sites)

## Architecture
- **Registry pattern**: handlers self-register via `registerCompletionHandler()` / `registerEmbeddingHandler()`
- **No barrel files**: handler side-effect imports are inlined in `completion.ts` and `embedding.ts`
- **Ollama split**: `src/handlers/ollama/` — 9 focused modules (types, mappers, url, request, qwen, stream, models, register, index)
- **Unified stream iterator**: `iterateStream<C>` with strategy pattern (3 strategies: Qwen, native Ollama, OpenAI-compatible)
- **No God Objects**: ollama.ts reduced from 527 lines to ~60 lines (thin barrel)

## Providers
- Dedicated: OpenAI, Anthropic, Gemini, Copilot, Cohere, Replicate, AI21, Ollama
- OpenAI-compatible: 37 providers (groq, deepseek, perplexity, xai, mistral, deepinfra, etc.) routed through `OpenAILikeHandler`

## Publishing
```bash
npm run build
npm version <major|minor|patch>
npm publish
```
