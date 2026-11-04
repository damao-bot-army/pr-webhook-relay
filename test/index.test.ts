import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/index.ts';

const env: Env = {
  GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
  ROUTINE_WEBHOOK_URL: 'https://routine.example.test/hook',
  ROUTINE_KEY: 'test-routine-key',
};

const prPayload = (action: string) => ({
  action,
  repository: { full_name: 'damao-bot-army/example' },
  pull_request: {
    number: 42,
    draft: false,
    html_url: 'https://github.com/damao-bot-army/example/pull/42',
    head: { sha: 'abc123' },
    user: { login: 'octocat' },
  },
});

async function sign(body: string, secret = env.GITHUB_WEBHOOK_SECRET): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return 'sha256=' + Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function deliver(event: string, payload: unknown, signature?: string | null): Promise<Response> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-GitHub-Event': event,
    'X-GitHub-Delivery': 'delivery-1',
  };
  const sig = signature === undefined ? await sign(body) : signature;
  if (sig !== null) headers['X-Hub-Signature-256'] = sig;
  return worker.fetch(new Request('https://relay.example.test/', { method: 'POST', headers, body }), env);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pr-webhook-relay', () => {
  it('rejects non-POST methods with 405', async () => {
    const res = await worker.fetch(new Request('https://relay.example.test/'), env);
    expect(res.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards a correctly signed pull_request event', async () => {
    const res = await deliver('pull_request', prPayload('opened'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(env.ROUTINE_WEBHOOK_URL);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${env.ROUTINE_KEY}`);
    expect(JSON.parse(init.body as string)).toEqual({
      repo: 'damao-bot-army/example',
      pr: 42,
      action: 'opened',
      head_sha: 'abc123',
      author: 'octocat',
      draft: false,
      html_url: 'https://github.com/damao-bot-army/example/pull/42',
      delivery: 'delivery-1',
    });
  });

  it('rejects a wrong signature with 401', async () => {
    const wrong = await sign(JSON.stringify(prPayload('opened')), 'another-secret');
    const res = await deliver('pull_request', prPayload('opened'), wrong);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed signature with 401', async () => {
    const res = await deliver('pull_request', prPayload('opened'), 'sha256=nothex');
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing signature with 401', async () => {
    const res = await deliver('pull_request', prPayload('opened'), null);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers ping with 200 without forwarding', async () => {
    const res = await deliver('ping', { zen: 'Keep it logically awesome.' });
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['opened', 'synchronize', 'reopened', 'ready_for_review'])('forwards action %s', async (action) => {
    const res = await deliver('pull_request', prPayload(action));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['closed', 'edited', 'labeled', 'converted_to_draft'])('ignores action %s with 204', async (action) => {
    const res = await deliver('pull_request', prPayload(action));
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores non-PR events with 204', async () => {
    const res = await deliver('issues', { action: 'opened' });
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when downstream responds non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    const res = await deliver('pull_request', prPayload('opened'));
    expect(res.status).toBe(502);
  });

  it('returns 502 on downstream network error without logging secrets', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed: ${env.ROUTINE_WEBHOOK_URL}`));
    const res = await deliver('pull_request', prPayload('opened'));
    expect(res.status).toBe(502);
    const logged = JSON.stringify((console.error as unknown as ReturnType<typeof vi.fn>).mock.calls);
    for (const value of Object.values(env)) expect(logged).not.toContain(value);
  });
});
