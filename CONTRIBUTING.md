# Contributing

## PR workflow

1. Branch from `master`.
2. Make your changes.
3. Open a pull request against `master`.
4. At least one approving review is required before merging.

## Development

```bash
pnpm install
pnpm test
pnpm dev
```

## Guidelines

- Keep changes focused. Prefer small, single-purpose PRs.
- Include tests for new features and bug fixes.
- Use existing code style — the project uses TypeScript with strict mode.
- Run `pnpm typecheck` before pushing.
- Update README.md if adding or changing configuration or tools.

## Security

- Do not expose port 3000 publicly.
- Keep API keys out of source code; use `.env` files.
- Report vulnerabilities by opening an issue.
