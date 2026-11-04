# pr-webhook-relay

Cloudflare Worker that receives organization-level GitHub `pull_request` webhooks, verifies the signature, and forwards `opened`, `synchronize`, `reopened` and `ready_for_review` events to a routine webhook.

## Quick start

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
   - **Payload URL**: the Worker URL printed by `wrangler deploy`
   - **Content type**: `application/json`
   - **Secret**: the same value as `GITHUB_WEBHOOK_SECRET`
   - **Which events**: "Let me select individual events" → check only **Pull requests**

## Development

```sh
npm run typecheck
npm test
```
