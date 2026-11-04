# Security policy

This Worker holds the GitHub webhook signing secret, the routine webhook URL and the bearer key for that routine. It is reachable from the internet. A vulnerability can let someone trigger the routine with forged pull request events or expose those secrets.

## Report a vulnerability privately

Use **Security → Report a vulnerability** on GitHub:

https://github.com/damao-bot-army/pr-webhook-relay/security/advisories/new

Include:

- Steps to reproduce the issue and the observed result.
- The commit or deployed version you tested.
- Relevant configuration with all secrets removed.

You will get an answer within a week. Fixes land on `main`; there are no maintained release branches.

## In scope

- Getting a request forwarded without a valid `X-Hub-Signature-256` signature.
- Forwarding events or actions other than the four listed in the README.
- Exposure of `GITHUB_WEBHOOK_SECRET`, `ROUTINE_WEBHOOK_URL` or `ROUTINE_KEY` through responses, errors or logs.
- Secrets committed to this repository.

## Out of scope

- Issues in GitHub, Cloudflare or the downstream routine rather than this repository.
- Attacks that require access to the Cloudflare account, the Worker secrets or the GitHub organization settings.
- Deployment errors caused by ignoring the README's setup instructions.
