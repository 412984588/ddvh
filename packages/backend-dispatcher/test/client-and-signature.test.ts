import { createHmac } from 'node:crypto';
import { PassThrough } from 'node:stream';
import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendClient } from '../src/client.js';
import { SignatureVerifier } from '../src/verify-signature.js';

describe('SignatureVerifier', () => {
  it('computes sha256 signatures compatible with node crypto', async () => {
    const verifier = new SignatureVerifier({
      secret: 'test-secret',
      algorithm: 'sha256',
    });
    const payload = JSON.stringify({ ok: true });

    const signature = await verifier.computeSignature(payload);
    const expected = `sha256=${createHmac('sha256', 'test-secret').update(payload).digest('hex')}`;

    expect(signature).toBe(expected);
  });

  it('computes sha512 signatures compatible with node crypto', async () => {
    const verifier = new SignatureVerifier({
      secret: 'test-secret',
      algorithm: 'sha512',
    });
    const payload = JSON.stringify({ ok: true, version: 2 });

    const signature = await verifier.computeSignature(payload);
    const expected = `sha512=${createHmac('sha512', 'test-secret').update(payload).digest('hex')}`;

    expect(signature).toBe(expected);
  });

  it('accepts configured signature header regardless of case', async () => {
    const verifier = new SignatureVerifier({
      secret: 'test-secret',
      headerName: 'X-Webhook-Signature',
      algorithm: 'sha256',
    });
    const payload = JSON.stringify({ ok: true });
    const signature = await verifier.computeSignature(payload);

    const request = {
      headers: {
        'x-webhook-signature': signature,
      },
      rawBody: payload,
    } as unknown as FastifyRequest;

    await expect(verifier.verify(request)).resolves.toBe(true);
  });

  it('accepts signature headers provided as arrays', async () => {
    const verifier = new SignatureVerifier({
      secret: 'test-secret',
      algorithm: 'sha256',
    });
    const payload = JSON.stringify({ ok: true });
    const signature = await verifier.computeSignature(payload);

    const request = {
      headers: {
        'x-webhook-signature': [signature, 'sha256=ignored'],
      },
      rawBody: payload,
    } as unknown as FastifyRequest;

    await expect(verifier.verify(request)).resolves.toBe(true);
  });

  it('can verify signature by reading raw request stream', async () => {
    const verifier = new SignatureVerifier({
      secret: 'test-secret',
      algorithm: 'sha256',
    });
    const payload = JSON.stringify({ ok: true });
    const signature = await verifier.computeSignature(payload);
    const raw = new PassThrough();
    raw.end(payload);

    const request = {
      headers: {
        'x-webhook-signature': signature,
      },
      raw,
    } as unknown as FastifyRequest;

    await expect(verifier.verify(request)).resolves.toBe(true);
  });

  it('falls back to string body when raw stream is already consumed', async () => {
    const verifier = new SignatureVerifier({
      secret: 'test-secret',
      algorithm: 'sha256',
    });
    const payload = JSON.stringify({ ok: true });
    const signature = await verifier.computeSignature(payload);

    const request = {
      headers: {
        'x-webhook-signature': signature,
      },
      body: payload,
      raw: {
        readableEnded: true,
        destroyed: false,
        on: vi.fn(),
      },
    } as unknown as FastifyRequest;

    const timeout = Symbol('timeout');
    const result = await Promise.race([
      verifier.verify(request),
      new Promise<symbol>((resolve) => {
        setTimeout(() => resolve(timeout), 100);
      }),
    ]);

    expect(result).toBe(true);
  });
});

describe('BackendClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('clears timeout timer when fetch fails fast', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network failure')) as unknown as typeof fetch
    );

    const client = new BackendClient({
      endpoint: 'https://example.invalid/backend',
      timeout: 30000,
    });

    const result = await client.dispatchTask('session-1', 'intent', 'prompt');

    expect(result.success).toBe(false);
    expect(result.error).toBe('network failure');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('treats successful empty-body responses as successful dispatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 202,
          statusText: 'Accepted',
        })
      ) as unknown as typeof fetch
    );

    const client = new BackendClient({
      endpoint: 'https://example.invalid/backend',
      timeout: 30000,
    });

    const result = await client.dispatchTask('session-2', 'intent', 'prompt');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('delivers webhook result even if handler registers after completion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 202,
          statusText: 'Accepted',
        })
      ) as unknown as typeof fetch
    );

    const client = new BackendClient({
      endpoint: 'https://example.invalid/backend',
      timeout: 30000,
    });

    const dispatched = await client.dispatchTask('session-3', 'intent', 'prompt');
    expect(dispatched.success).toBe(true);
    expect(dispatched.taskId).toBeTruthy();

    const completion = {
      taskId: dispatched.taskId,
      sessionId: 'session-3',
      success: true,
      result: 'done',
      completedAt: Date.now(),
    };

    const handled = client.handleWebhookResult(completion);
    expect(handled).toBe(true);

    const onComplete = vi.fn();
    client.onTaskComplete(dispatched.taskId, onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(completion);
  });

  it('retains unknown webhook result briefly for late task handler registration', () => {
    const client = new BackendClient({
      endpoint: 'https://example.invalid/backend',
      timeout: 30000,
    });

    const completion = {
      taskId: 'task-late',
      sessionId: 'session-4',
      success: false,
      error: 'backend failed',
      completedAt: Date.now(),
    };

    const handled = client.handleWebhookResult(completion);
    expect(handled).toBe(false);

    const onComplete = vi.fn();
    client.onTaskComplete('task-late', onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(completion);
  });
});
