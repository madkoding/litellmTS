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

## Security Baseline (achieved 2026-06-12)
- 0 npm audit vulnerabilities across 674 packages
- All dependencies updated to latest compatible major versions
- Credential store: AES-256-GCM encrypted (`src/auth/store.ts`)
- OAuth shell injection eliminated (`execSync` → `execFileSync` in `src/auth/copilot.ts`)
- ESLint `no-useless-assignment` fixed in 4 files

## API Migrations Completed
- **Anthropic** (`src/handlers/anthropic.ts`): legacy `completions.create()` → Messages API `messages.create()`
- **Cohere** (`src/handlers/cohere.ts`): legacy `generate()`/`generateStream()` → Chat API `chat()`/`chatStream()`

## Code Quality Fixes (2026-06-12)
- Gemini streaming: `model` was `undefined` in chunks — fixed
- Model prefix stripping: `split('/')[1]` → `startsWith/slice` across 5 handlers
- Error handling: wrapped SDK calls in try/catch with `{ cause }` in 6 handlers
- Replicate non-streaming response missing `model` field — added
- Lint error `preserve-caught-error` fixed in 7 handlers

## Providers
- Dedicated: OpenAI, Anthropic, Gemini, Copilot, Mistral, Cohere, DeepInfra, Replicate, AI21, Ollama
- OpenAI-compatible: 38 providers (groq, deepseek, perplexity, xai, etc.) routed through `OpenAILikeHandler`

## Publishing
```bash
npm run build
npm version <major|minor|patch>
npm publish
```
