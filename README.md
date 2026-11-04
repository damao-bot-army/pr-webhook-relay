# pr-webhook-relay

[![CI](https://github.com/damao-bot-army/pr-webhook-relay/actions/workflows/ci.yml/badge.svg)](https://github.com/damao-bot-army/pr-webhook-relay/actions/workflows/ci.yml)
[![gitleaks](https://github.com/damao-bot-army/pr-webhook-relay/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/damao-bot-army/pr-webhook-relay/actions/workflows/gitleaks.yml)
![Cloudflare Workers](https://img.shields.io/badge/runs%20on-Cloudflare%20Workers-F38020)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![pr-webhook-relay](docs/images/banner.jpg)

A Cloudflare Worker that receives organization-level GitHub `pull_request` webhooks and checks their `X-Hub-Signature-256` HMAC. It forwards `opened`, `synchronize`, `reopened` and `ready_for_review` events as a short JSON summary to a routine webhook (for example a Grok Bot routine).

Status: early (0.1.0), no releases; deploy from source. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Quick start

Requirements: a Cloudflare account with Workers; admin access to a GitHub organization to add the webhook; a routine webhook URL and its bearer key; Node.js 22.12+ and npm.

1. Deploy:

   ```sh
   npm ci
   npx wrangler deploy
   ```

2. Set the three secrets (you will be prompted for each value):

   ```sh
   npx wrangler secret put GITHUB_WEBHOOK_SECRET
   npx wrangler secret put ROUTINE_WEBHOOK_URL
   npx wrangler secret put ROUTINE_KEY
   ```

3. In GitHub, open the organization **Settings → Webhooks → Add webhook**:
   - **Payload URL**: the Worker URL printed by `wrangler deploy`, for example `https://<worker>.<subdomain>.workers.dev`
   - **Content type**: `application/json`
   - **Secret**: the same value as `GITHUB_WEBHOOK_SECRET`
   - **Which events would you like to trigger this webhook?**: "Let me select individual events" → check only **Pull requests**

## What it does

For every `POST` request the Worker:

1. Returns `500` if any of the three secrets is missing.
2. Verifies `X-Hub-Signature-256` against `GITHUB_WEBHOOK_SECRET` and returns `401` if it does not match.
3. Answers `ping` events with `pong`. Other non-`pull_request` events and other actions get `204` and are dropped.
4. Sends `POST` to `ROUTINE_WEBHOOK_URL` with `Authorization: Bearer <ROUTINE_KEY>` and this body:

   ```json
   {
     "repo": "<owner>/<repo>",
     "pr": 42,
     "action": "opened",
     "head_sha": "<commit sha>",
     "author": "<login>",
     "draft": false,
     "html_url": "https://github.com/<owner>/<repo>/pull/42",
     "delivery": "<X-GitHub-Delivery>"
   }
   ```

5. Returns `200` if the routine accepted it, or `502` if it failed or could not be reached.

Other methods get `405`. The Worker stores nothing. Logs contain only the delivery ID and the downstream status code, not the routine URL or key.

## Uninstall

Delete the organization webhook in GitHub, then run `npx wrangler delete` to remove the Worker and its secrets.

## Development

```sh
npm ci
npm run typecheck
npm test
```

`npm ci` sets `core.hooksPath` to `.githooks`. The pre-commit hook runs [gitleaks](https://github.com/gitleaks/gitleaks) and blocks commits if `gitleaks` is not in `PATH`. CI runs the type check, the tests and a full-history gitleaks scan on every pull request and push to `main`.
