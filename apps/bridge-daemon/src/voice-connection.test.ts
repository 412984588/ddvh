import { describe, expect, it, vi } from 'vitest';
import type { AudioEgressPump } from '@voice-hub/audio-engine';
import { ProviderEvent, type ProviderEventPayload } from '@voice-hub/provider-volcengine-omni';
import { ToolIntent } from '@voice-hub/shared-config';
import { VoiceConnectionHandler } from './voice-connection.js';

type ToolCallListener = (payload: ProviderEventPayload[ProviderEvent.TOOL_CALL]) => void;
type AudioListener = (payload: ProviderEventPayload[ProviderEvent.AUDIO_RECEIVED]) => void;

type OmniStub = {
  on: (event: ProviderEvent, listener: (...args: unknown[]) => void) => void;
  sendToolResult: (toolId: string, result: unknown, error?: string) => void;
};

type InternalVoiceConnectionHandler = {
  setupOmniEvents: (
    omniClient: OmniStub,
    sessionId: string,
    egressPump: AudioEgressPump,
    toolDispatcher: {
      handleToolCall: (call: {
        sessionId: string;
        toolId: string;
        toolName: string;
        parameters: Record<string, unknown>;
      }) => Promise<{
        intent: ToolIntent;
        success: boolean;
        data?: unknown;
        error?: string;
      }>;
    }
  ) => void;
};

function flushAsync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('VoiceConnectionHandler tool call routing', () => {
  it('reuses shared guild voice connection for additional users', async () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );

    const internal = handler as unknown as {
      connections: Map<string, unknown>;
      connectionByUser: Map<string, unknown>;
      createConnection: (userId: string, guildId: string, channelId: string) => Promise<unknown>;
    };

    const existingConnection = {
      sessionId: 'session-1',
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      voiceConnection: { destroy: vi.fn() },
      ingressPump: { stop: vi.fn() },
      egressPump: { destroy: vi.fn() },
      omniClient: { disconnect: vi.fn() },
      packetizer: {},
    };

    internal.connections.set('session-1', existingConnection);
    const createConnectionSpy = vi
      .spyOn(internal, 'createConnection')
      .mockResolvedValue(existingConnection);

    await handler.handleUserJoin('user-2', 'guild-1', 'channel-1');

    expect(createConnectionSpy).not.toHaveBeenCalled();
    expect(internal.connectionByUser.get('user-2')).toBe(existingConnection);
  });

  it('deduplicates in-flight connection creation per guild/channel', async () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );

    const internal = handler as unknown as {
      pendingConnections: Map<string, Promise<unknown>>;
      connectionByUser: Map<string, unknown>;
      createConnection: (userId: string, guildId: string, channelId: string) => Promise<unknown>;
    };

    const connection = {
      sessionId: 'session-shared',
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      voiceConnection: { destroy: vi.fn() },
      ingressPump: { stop: vi.fn() },
      egressPump: { destroy: vi.fn() },
      omniClient: { disconnect: vi.fn() },
      packetizer: {},
    };

    let resolveCreate: ((value: unknown) => void) | undefined;
    const createPromise = new Promise<unknown>((resolve) => {
      resolveCreate = resolve;
    });
    const createConnectionSpy = vi
      .spyOn(internal, 'createConnection')
      .mockReturnValue(createPromise);

    const firstJoin = handler.handleUserJoin('user-1', 'guild-1', 'channel-1');
    const secondJoin = handler.handleUserJoin('user-2', 'guild-1', 'channel-1');

    expect(createConnectionSpy).toHaveBeenCalledTimes(1);
    expect(internal.pendingConnections.size).toBe(1);

    resolveCreate?.(connection);
    await Promise.all([firstJoin, secondJoin]);

    expect(internal.connectionByUser.get('user-1')).toBe(connection);
    expect(internal.connectionByUser.get('user-2')).toBe(connection);
    expect(internal.pendingConnections.size).toBe(0);
  });

  it('clears pending marker when connection creation fails', async () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );

    const internal = handler as unknown as {
      pendingConnections: Map<string, Promise<unknown>>;
      connectionByUser: Map<string, unknown>;
      createConnection: (userId: string, guildId: string, channelId: string) => Promise<unknown>;
    };

    const createConnectionSpy = vi
      .spyOn(internal, 'createConnection')
      .mockRejectedValue(new Error('create failed'));

    await handler.handleUserJoin('user-1', 'guild-1', 'channel-1');

    expect(createConnectionSpy).toHaveBeenCalledTimes(1);
    expect(internal.pendingConnections.size).toBe(0);
    expect(internal.connectionByUser.has('user-1')).toBe(false);
  });

  it('keeps shared connection alive while other users remain', () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );

    const internal = handler as unknown as {
      connectionByUser: Map<string, unknown>;
      destroyConnection: (sessionId: string) => void;
    };

    const sharedConnection = {
      sessionId: 'session-1',
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      voiceConnection: { destroy: vi.fn() },
      ingressPump: { stop: vi.fn() },
      egressPump: { destroy: vi.fn() },
      omniClient: { disconnect: vi.fn() },
      packetizer: {},
    };

    internal.connectionByUser.set('user-1', sharedConnection);
    internal.connectionByUser.set('user-2', sharedConnection);

    const destroyConnectionSpy = vi
      .spyOn(internal, 'destroyConnection')
      .mockImplementation(() => {});

    handler.handleUserLeave('user-1');

    expect(destroyConnectionSpy).not.toHaveBeenCalled();
    expect(internal.connectionByUser.has('user-1')).toBe(false);
    expect(internal.connectionByUser.get('user-2')).toBe(sharedConnection);
  });

  it('routes Omni tool call to dispatcher and returns success result', async () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );
    const internal = handler as unknown as InternalVoiceConnectionHandler;

    const listeners = new Map<ProviderEvent, (...args: unknown[]) => void>();
    const omniSendToolResult = vi.fn();
    const omniStub: OmniStub = {
      on: (event, listener) => {
        listeners.set(event, listener);
      },
      sendToolResult: omniSendToolResult,
    };

    const handleToolCall = vi.fn().mockResolvedValue({
      intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
      success: true,
      data: { taskId: 'task-1', status: 'pending' },
    });

    internal.setupOmniEvents(
      omniStub,
      'session-1',
      { addFrame: vi.fn() } as unknown as AudioEgressPump,
      { handleToolCall }
    );

    const toolCall = listeners.get(ProviderEvent.TOOL_CALL) as ToolCallListener | undefined;
    expect(toolCall).toBeDefined();

    toolCall?.({
      sessionId: 'omni-session',
      toolId: 'tool-1',
      toolName: 'search_docs',
      parameters: { query: 'alpha' },
    });

    await flushAsync();

    expect(handleToolCall).toHaveBeenCalledTimes(1);
    expect(handleToolCall).toHaveBeenCalledWith({
      sessionId: 'session-1',
      toolId: 'tool-1',
      toolName: 'search_docs',
      parameters: { query: 'alpha' },
    });
    expect(omniSendToolResult).toHaveBeenCalledWith('tool-1', {
      taskId: 'task-1',
      status: 'pending',
    });
  });

  it('returns error to Omni when dispatcher fails tool call', async () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );
    const internal = handler as unknown as InternalVoiceConnectionHandler;

    const listeners = new Map<ProviderEvent, (...args: unknown[]) => void>();
    const omniSendToolResult = vi.fn();
    const omniStub: OmniStub = {
      on: (event, listener) => {
        listeners.set(event, listener);
      },
      sendToolResult: omniSendToolResult,
    };

    const handleToolCall = vi.fn().mockResolvedValue({
      intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
      success: false,
      error: 'dispatch failed',
    });

    internal.setupOmniEvents(
      omniStub,
      'session-1',
      { addFrame: vi.fn() } as unknown as AudioEgressPump,
      { handleToolCall }
    );

    const toolCall = listeners.get(ProviderEvent.TOOL_CALL) as ToolCallListener | undefined;
    expect(toolCall).toBeDefined();

    toolCall?.({
      sessionId: 'omni-session',
      toolId: 'tool-2',
      toolName: 'search_docs',
      parameters: { query: 'beta' },
    });

    await flushAsync();

    expect(handleToolCall).toHaveBeenCalledWith({
      sessionId: 'session-1',
      toolId: 'tool-2',
      toolName: 'search_docs',
      parameters: { query: 'beta' },
    });
    expect(omniSendToolResult).toHaveBeenCalledWith('tool-2', undefined, 'dispatch failed');
  });

  it('continues audio forwarding listener registration', () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );
    const internal = handler as unknown as InternalVoiceConnectionHandler;

    const listeners = new Map<ProviderEvent, (...args: unknown[]) => void>();
    const addFrame = vi.fn();

    internal.setupOmniEvents(
      {
        on: (event, listener) => {
          listeners.set(event, listener);
        },
        sendToolResult: vi.fn(),
      },
      'session-1',
      { addFrame } as unknown as AudioEgressPump,
      {
        handleToolCall: vi.fn().mockResolvedValue({
          intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
          success: true,
        }),
      }
    );

    const audioListener = listeners.get(ProviderEvent.AUDIO_RECEIVED) as AudioListener | undefined;
    expect(audioListener).toBeDefined();

    const audio = Buffer.from([1, 2, 3]);
    audioListener?.({
      sessionId: 'omni-session',
      data: audio,
      isFinal: true,
    });

    expect(addFrame).toHaveBeenCalledTimes(1);
    expect(addFrame).toHaveBeenCalledWith({
      data: audio,
      sampleRate: 48000,
      channels: 2,
      timestamp: expect.any(Number),
    });
  });

  it('destroys discord voice connection when tearing down session', () => {
    const handler = new VoiceConnectionHandler(
      {
        omniEndpoint: 'wss://example.invalid/realtime',
        omniApiKey: 'api-key',
        omniModel: 'model',
        backendDispatchEndpoint: 'https://backend.example.invalid/dispatch',
      },
      {} as never
    );

    const internal = handler as unknown as {
      connections: Map<string, unknown>;
      connectionByUser: Map<string, unknown>;
      destroyConnection: (sessionId: string) => void;
    };

    const connection = {
      sessionId: 'session-1',
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      voiceConnection: { destroy: vi.fn() },
      ingressPump: { stop: vi.fn() },
      egressPump: { destroy: vi.fn() },
      omniClient: { disconnect: vi.fn() },
      packetizer: {},
    };

    internal.connections.set('session-1', connection);
    internal.connectionByUser.set('user-1', connection);

    internal.destroyConnection('session-1');

    expect(connection.ingressPump.stop).toHaveBeenCalledTimes(1);
    expect(connection.egressPump.destroy).toHaveBeenCalledTimes(1);
    expect(connection.omniClient.disconnect).toHaveBeenCalledTimes(1);
    expect(connection.voiceConnection.destroy).toHaveBeenCalledTimes(1);
    expect(internal.connections.has('session-1')).toBe(false);
    expect(internal.connectionByUser.has('user-1')).toBe(false);
  });
});
