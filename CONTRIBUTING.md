# Contributing

Thanks for your interest in litellmTS!

## Quick start

```bash
git clone git@github.com:madkoding/litellmTS.git
cd litellmTS
npm install
npm run build
```

## Requirements

- Node >= 22
- npm

## Workflow

- `main` is the stable release branch — protected, no direct pushes.
- All work goes through the `develop` branch.
- Feature branches branch off `develop` and merge back via PR.
- Keep commits small and focused.

## Branch naming

```
feature/<short-description>
fix/<short-description>
chore/<short-description>
```

## Commit style

Conventional commits only:

```
feat: add support for xyz
fix: handle edge case in streaming parser
refactor: collapse models/ into single file
chore: bump dependencies
security: fix shell injection in copilot login
```

## Code conventions

- **Node >= 22** — use native APIs before adding dependencies.
- **Imports**: no comments in code; keep concise.
- **Error messages**: English across all handlers.
- **TypeScript**: strict mode, avoid `any` where possible.
- **Dependencies**: think before adding one. stdlib first, existing dep second, new dep last.

## Testing

```bash
npm t              # unit tests (fast)
npm run test:e2e   # integration tests (requires .env with API keys)
npm run lint       # ESLint check
```

Every non-trivial change must pass the full test suite and lint before opening a PR.

## PR checklist

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] New code includes tests
- [ ] Commits follow conventional commit format
- [ ] Branch targets `develop`, not `main`

## Questions

Open an issue or start a discussion on GitHub.
