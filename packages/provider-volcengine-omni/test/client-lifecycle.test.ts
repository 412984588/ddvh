import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { OmniClient } from '../src/OmniClient.js';
import { ProviderEvent, ProviderState } from '../src/types.js';

type InternalClient = {
  state: ProviderState;
  ws: {
    readyState: number;
    send: (data: string) => void;
    close?: () => void;
    removeAllListeners?: () => void;
  } | null;
  currentSessionId: string | null;
  sessionManager: {
    getSessionCount: () => { total: number; active: number };
  };
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  scheduleReconnect: (resumeSession: boolean) => void;
  handleClose: (code: number, reason: Buffer) => void;
  handleError: (error: Error, reject?: (reason: unknown) => void) => void;
};

describe('OmniClient lifecycle', () => {
  function createClient() {
    return new OmniClient({
      endpoint: 'ws://127.0.0.1:65535',
      apiKey: 'test-key',
      model: 'test-model',
      autoReconnect: false,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stops heartbeat when websocket closes unexpectedly', () => {
    const client = createClient();
    const internal = client as unknown as InternalClient;
    internal.state = ProviderState.SESSION_ACTIVE;
    internal.heartbeatInterval = setInterval(() => undefined, 1000);

    internal.handleClose(1006, Buffer.from('abnormal closure'));

    expect(internal.heartbeatInterval).toBeNull();
  });

  it('emits correctly spelled websocket error code', () => {
    const client = createClient();
    const internal = client as unknown as InternalClient;
    const errors: Array<{ code: string; message: string }> = [];

    client.on(ProviderEvent.ERROR, (payload) => {
      errors.push(payload);
    });

    internal.handleError(new Error('boom'));

    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('WEBSOCKET_ERROR');
    expect(errors[0]?.message).toBe('boom');
  });

  it('marks newly started session as active in session manager', async () => {
    const client = createClient();
    const internal = client as unknown as InternalClient;

    internal.state = ProviderState.CONNECTED;
    internal.ws = {
      readyState: WebSocket.OPEN,
      send: () => undefined,
      close: () => undefined,
      removeAllListeners: () => undefined,
    };

    await client.startSession();

    expect(internal.sessionManager.getSessionCount()).toEqual({
      total: 1,
      active: 1,
    });
  });

  it('clears tracked session metadata when websocket closes unexpectedly', async () => {
    const client = createClient();
    const internal = client as unknown as InternalClient;

    internal.state = ProviderState.CONNECTED;
    internal.ws = {
      readyState: WebSocket.OPEN,
      send: () => undefined,
      close: () => undefined,
      removeAllListeners: () => undefined,
    };

    await client.startSession();

    expect(internal.currentSessionId).toBeTruthy();
    expect(internal.sessionManager.getSessionCount().total).toBe(1);

    internal.handleClose(1006, Buffer.from('abnormal closure'));

    expect(internal.currentSessionId).toBeNull();
    expect(internal.sessionManager.getSessionCount().total).toBe(0);
  });

  it('does not auto-reconnect after explicit disconnect', () => {
    const client = new OmniClient({
      endpoint: 'ws://127.0.0.1:65535',
      apiKey: 'test-key',
      model: 'test-model',
      autoReconnect: true,
    });
    const internal = client as unknown as InternalClient;
    internal.state = ProviderState.SESSION_ACTIVE;
    internal.ws = {
      readyState: WebSocket.OPEN,
      send: () => undefined,
      close: () => undefined,
      removeAllListeners: () => undefined,
    };

    client.disconnect();
    internal.handleClose(1006, Buffer.from('abnormal closure'));

    expect(internal.reconnectTimeout).toBeNull();
  });

  it('keeps only one reconnect timer when scheduleReconnect is called repeatedly', () => {
    const client = new OmniClient({
      endpoint: 'ws://127.0.0.1:65535',
      apiKey: 'test-key',
      model: 'test-model',
      autoReconnect: true,
    });
    const internal = client as unknown as InternalClient;

    internal.scheduleReconnect(false);
    const firstTimer = internal.reconnectTimeout;
    expect(firstTimer).not.toBeNull();

    internal.scheduleReconnect(false);
    const secondTimer = internal.reconnectTimeout;
    expect(secondTimer).not.toBeNull();
    expect(secondTimer).not.toBe(firstTimer);
    expect(vi.getTimerCount()).toBe(1);
  });
});
