import { describe, expect, it } from 'vitest';
import { SignatureVerifier } from '../src/verify-signature.js';
import { WebhookServer } from '../src/webhook-server.js';
import type { WebhookServerConfig } from '../src/webhook-server.js';

type ServerWithPrivateParse = WebhookServer & {
  parseResult(body: unknown): { completedAt: number };
};

function createServer() {
  const backendClient = {
    handleWebhookResult: () => true,
  };

  return new WebhookServer({
    port: 0,
    secret: 'test-secret',
    backendClient: backendClient as unknown as WebhookServerConfig['backendClient'],
  });
}

describe('WebhookServer payload parsing', () => {
  it('rejects non-string result payloads', () => {
    const server = createServer();
    const parseResult = (server as ServerWithPrivateParse).parseResult.bind(server);

    expect(() =>
      parseResult({
        taskId: 'task-1',
        sessionId: 'session-1',
        success: true,
        result: { nested: true },
      })
    ).toThrow('Missing or invalid result');
  });

  it('rejects non-string error payloads', () => {
    const server = createServer();
    const parseResult = (server as ServerWithPrivateParse).parseResult.bind(server);

    expect(() =>
      parseResult({
        taskId: 'task-1',
        sessionId: 'session-1',
        success: false,
        error: { message: 'boom' },
      })
    ).toThrow('Missing or invalid error');
  });

  it('rejects invalid completedAt values', () => {
    const server = createServer();
    const parseResult = (server as ServerWithPrivateParse).parseResult.bind(server);

    expect(() =>
      parseResult({
        taskId: 'task-1',
        sessionId: 'session-1',
        success: true,
        completedAt: 'not-a-timestamp',
      })
    ).toThrow('Missing or invalid completedAt');
  });

  it('fills completedAt when omitted', () => {
    const server = createServer();
    const parseResult = (server as ServerWithPrivateParse).parseResult.bind(server);

    const before = Date.now();
    const result = parseResult({
      taskId: 'task-1',
      sessionId: 'session-1',
      success: true,
    });
    const after = Date.now();

    expect(result.completedAt).toBeGreaterThanOrEqual(before);
    expect(result.completedAt).toBeLessThanOrEqual(after);
  });

  it('accepts valid signed webhook requests without hanging', async () => {
    let handledTaskId: string | null = null;
    const backendClient = {
      handleWebhookResult: (result: { taskId: string }) => {
        handledTaskId = result.taskId;
        return true;
      },
    };
    const port = 43000 + Math.floor(Math.random() * 1000);
    const secret = 'integration-secret';
    const server = new WebhookServer({
      port,
      host: '127.0.0.1',
      secret,
      backendClient: backendClient as unknown as WebhookServerConfig['backendClient'],
    });

    await server.start();

    try {
      const rawBody = `{\n  "taskId":"task-integration",\n  "sessionId":"session-integration",\n  "success":true\n}`;
      const verifier = new SignatureVerifier({ secret });
      const signature = await verifier.computeSignature(rawBody);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);

      let response: Response;
      try {
        response = await fetch(`http://127.0.0.1:${port}/webhook`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-webhook-signature': signature,
          },
          body: rawBody,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ acknowledged: true });
      expect(handledTaskId).toBe('task-integration');
    } finally {
      await server.stop();
    }
  });
});
