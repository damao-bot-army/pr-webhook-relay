export interface Env {
  GITHUB_WEBHOOK_SECRET: string;
  ROUTINE_WEBHOOK_URL: string;
  ROUTINE_KEY: string;
}

const FORWARDED_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);
const encoder = new TextEncoder();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
    }
    if (!env.GITHUB_WEBHOOK_SECRET || !env.ROUTINE_WEBHOOK_URL || !env.ROUTINE_KEY) {
      console.error('relay: missing required secret(s)');
      return new Response('Server misconfigured', { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('X-Hub-Signature-256');
    if (!(await verifySignature(env.GITHUB_WEBHOOK_SECRET, body, signature))) {
      return new Response('Unauthorized', { status: 401 });
    }

    const event = request.headers.get('X-GitHub-Event');
    if (event === 'ping') return new Response('pong', { status: 200 });
    if (event !== 'pull_request') return new Response(null, { status: 204 });

    let payload: PullRequestEvent;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    if (!FORWARDED_ACTIONS.has(payload.action) || !payload.pull_request) {
      return new Response(null, { status: 204 });
    }

    const pr = payload.pull_request;
    const delivery = request.headers.get('X-GitHub-Delivery');
    const forward = {
      repo: payload.repository?.full_name,
      pr: pr.number,
      action: payload.action,
      head_sha: pr.head?.sha,
      author: pr.user?.login,
      draft: pr.draft,
      html_url: pr.html_url,
      delivery,
    };

    let res: Response;
    try {
      res = await fetch(env.ROUTINE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ROUTINE_KEY}` },
        body: JSON.stringify(forward),
      });
    } catch {
      // Error messages may contain the downstream URL, so they are not logged.
      console.error(`relay: downstream network error (delivery ${delivery})`);
      return new Response('Bad Gateway', { status: 502 });
    }
    if (!res.ok) {
      console.error(`relay: downstream returned ${res.status} (delivery ${delivery})`);
      return new Response('Bad Gateway', { status: 502 });
    }
    return new Response('Forwarded', { status: 200 });
  },
} satisfies ExportedHandler<Env>;

interface PullRequestEvent {
  action: string;
  repository?: { full_name?: string };
  pull_request?: {
    number?: number;
    draft?: boolean;
    html_url?: string;
    head?: { sha?: string };
    user?: { login?: string };
  };
}

async function verifySignature(secret: string, body: string, header: string | null): Promise<boolean> {
  if (!header || !/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  const provided = hexToBytes(header.slice(7));
  // Constant-time comparison; both arrays are always 32 bytes here.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
