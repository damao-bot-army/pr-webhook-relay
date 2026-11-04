# Contributing

This is a small personal project. Bug reports and fixes are welcome. Open an issue to discuss new ideas before implementing them; the Worker is meant to stay small.

## Report issues

Report bugs using the [bug report form](https://github.com/damao-bot-army/pr-webhook-relay/issues/new/choose). Include reproduction steps, expected and actual behavior, and the commit or deployed version.

Report security issues privately using [SECURITY.md](SECURITY.md), not a public issue.

## Development

Use Node.js 22.12+ and npm. Install [gitleaks](https://github.com/gitleaks/gitleaks) 8.20.0 or newer (CI uses 8.30.1) and make sure `gitleaks` is in your `PATH`. `npm ci` sets `core.hooksPath` to `.githooks`, and the pre-commit hook blocks commits when gitleaks is missing.

Before opening a pull request, run the same checks as CI:

```sh
npm ci
npm run typecheck
npm test
```

Never commit real secrets. Tests use placeholder values.

## Pull requests

Open pull requests against `main`. Describe the change, link the related issue and include your check results.
