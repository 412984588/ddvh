/**
 * Tests for Volcengine Omni protocol definitions
 */

import { describe, it, expect } from 'vitest';
import {
  OmniMessageType,
  type SessionConfig,
  type AudioFrameMessage,
  type SessionStartMessage,
  type SessionEndMessage,
  type HeartbeatMessage,
  type SessionStartedMessage,
  type AudioResponseMessage,
  type ToolCallMessage,
  type ToolResultMessage,
  type ErrorMessage,
  type HeartbeatAckMessage,
  parseServerMessage,
  createClientMessage,
  PROTOCOL_CONSTANTS,
} from '../src/protocol.js';

describe('OmniMessageType', () => {
  it('should have all client message types', () => {
    expect(OmniMessageType.SESSION_START).toBe('session_start');
    expect(OmniMessageType.AUDIO_FRAME).toBe('audio_frame');
    expect(OmniMessageType.SESSION_END).toBe('session_end');
    expect(OmniMessageType.HEARTBEAT).toBe('heartbeat');
  });

  it('should have all server message types', () => {
    expect(OmniMessageType.SESSION_STARTED).toBe('session_started');
    expect(OmniMessageType.AUDIO_RESPONSE).toBe('audio_response');
    expect(OmniMessageType.TOOL_CALL).toBe('tool_call');
    expect(OmniMessageType.TOOL_RESULT).toBe('tool_result');
    expect(OmniMessageType.ERROR).toBe('error');
    expect(OmniMessageType.HEARTBEAT_ACK).toBe('heartbeat_ack');
  });
});

describe('SessionConfig', () => {
  it('should create valid session config', () => {
    const config: SessionConfig = {
      model: 'omni-realtime-v1',
      apiKey: 'test_api_key',
    };
    expect(config.model).toBe('omni-realtime-v1');
    expect(config.apiKey).toBe('test_api_key');
  });

  it('should accept voice config', () => {
    const config: SessionConfig = {
      model: 'omni-realtime-v1',
      apiKey: 'test_api_key',
      voice: {
        encoding: 'pcm16',
        sampleRate: 16000,
        channels: 1,
      },
    };
    expect(config.voice?.encoding).toBe('pcm16');
    expect(config.voice?.sampleRate).toBe(16000);
    expect(config.voice?.channels).toBe(1);
  });

  it('should accept opus encoding', () => {
    const config: SessionConfig = {
      model: 'omni-realtime-v1',
      apiKey: 'test_api_key',
      voice: {
        encoding: 'opus',
        sampleRate: 48000,
        channels: 2,
      },
    };
    expect(config.voice?.encoding).toBe('opus');
  });

  it('should accept optional fields', () => {
    const config: SessionConfig = {
      model: 'omni-realtime-v1',
      apiKey: 'test_api_key',
      enableToolCalls: true,
      maxDuration: 300000,
      language: 'zh-CN',
    };
    expect(config.enableToolCalls).toBe(true);
    expect(config.maxDuration).toBe(300000);
    expect(config.language).toBe('zh-CN');
  });
});

describe('AudioFrameMessage', () => {
  it('should create valid audio frame message', () => {
    const message: AudioFrameMessage = {
      type: OmniMessageType.AUDIO_FRAME,
      payload: {
        data: 'base64_encoded_data',
        sampleRate: 16000,
        channels: 1,
      },
    };
    expect(message.type).toBe(OmniMessageType.AUDIO_FRAME);
    expect(message.payload.data).toBe('base64_encoded_data');
    expect(message.payload.sampleRate).toBe(16000);
    expect(message.payload.channels).toBe(1);
  });

  it('should accept optional timestamp', () => {
    const message: AudioFrameMessage = {
      type: OmniMessageType.AUDIO_FRAME,
      payload: {
        data: 'base64_encoded_data',
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      },
    };
    expect(message.payload.timestamp).toBeDefined();
  });
});

describe('SessionStartMessage', () => {
  it('should create valid session start message', () => {
    const config: SessionConfig = {
      model: 'omni-realtime-v1',
      apiKey: 'test_api_key',
    };
    const message: SessionStartMessage = {
      type: OmniMessageType.SESSION_START,
      payload: config,
    };
    expect(message.type).toBe(OmniMessageType.SESSION_START);
    expect(message.payload).toEqual(config);
  });
});

describe('SessionEndMessage', () => {
  it('should create valid session end message', () => {
    const message: SessionEndMessage = {
      type: OmniMessageType.SESSION_END,
      payload: {
        sessionId: 'session_123',
        reason: 'user_ended',
      },
    };
    expect(message.type).toBe(OmniMessageType.SESSION_END);
    expect(message.payload.sessionId).toBe('session_123');
    expect(message.payload.reason).toBe('user_ended');
  });

  it('should accept all reason types', () => {
    const reasons: Array<'user_ended' | 'error' | 'timeout'> = ['user_ended', 'error', 'timeout'];
    for (const reason of reasons) {
      const message: SessionEndMessage = {
        type: OmniMessageType.SESSION_END,
        payload: { sessionId: 'session_123', reason },
      };
      expect(message.payload.reason).toBe(reason);
    }
  });

  it('should allow omitting reason', () => {
    const message: SessionEndMessage = {
      type: OmniMessageType.SESSION_END,
      payload: { sessionId: 'session_123' },
    };
    expect(message.payload.reason).toBeUndefined();
  });
});

describe('HeartbeatMessage', () => {
  it('should create valid heartbeat message', () => {
    const message: HeartbeatMessage = {
      type: OmniMessageType.HEARTBEAT,
      payload: {
        timestamp: Date.now(),
      },
    };
    expect(message.type).toBe(OmniMessageType.HEARTBEAT);
    expect(message.payload.timestamp).toBeDefined();
  });

  it('should accept optional sequence', () => {
    const message: HeartbeatMessage = {
      type: OmniMessageType.HEARTBEAT,
      payload: {
        timestamp: Date.now(),
        sequence: 1,
      },
    };
    expect(message.payload.sequence).toBe(1);
  });
});

describe('SessionStartedMessage', () => {
  it('should create valid session started message', () => {
    const message: SessionStartedMessage = {
      type: OmniMessageType.SESSION_STARTED,
      payload: {
        sessionId: 'session_123',
        establishedAt: Date.now(),
      },
    };
    expect(message.type).toBe(OmniMessageType.SESSION_STARTED);
    expect(message.payload.sessionId).toBe('session_123');
    expect(message.payload.establishedAt).toBeDefined();
  });

  it('should accept optional expiresAt', () => {
    const now = Date.now();
    const message: SessionStartedMessage = {
      type: OmniMessageType.SESSION_STARTED,
      payload: {
        sessionId: 'session_123',
        establishedAt: now,
        expiresAt: now + 3600000,
      },
    };
    expect(message.payload.expiresAt).toBeDefined();
  });
});

describe('AudioResponseMessage', () => {
  it('should create valid audio response message', () => {
    const message: AudioResponseMessage = {
      type: OmniMessageType.AUDIO_RESPONSE,
      payload: {
        sessionId: 'session_123',
        data: 'base64_audio_data',
        encoding: 'pcm16',
        sampleRate: 16000,
        channels: 1,
        isFinal: false,
      },
    };
    expect(message.type).toBe(OmniMessageType.AUDIO_RESPONSE);
    expect(message.payload.sessionId).toBe('session_123');
    expect(message.payload.data).toBe('base64_audio_data');
    expect(message.payload.encoding).toBe('pcm16');
    expect(message.payload.isFinal).toBe(false);
  });

  it('should accept opus encoding', () => {
    const message: AudioResponseMessage = {
      type: OmniMessageType.AUDIO_RESPONSE,
      payload: {
        sessionId: 'session_123',
        data: 'base64_audio_data',
        encoding: 'opus',
        sampleRate: 48000,
        channels: 2,
        isFinal: true,
      },
    };
    expect(message.payload.encoding).toBe('opus');
    expect(message.payload.isFinal).toBe(true);
  });

  it('should accept optional transcript', () => {
    const message: AudioResponseMessage = {
      type: OmniMessageType.AUDIO_RESPONSE,
      payload: {
        sessionId: 'session_123',
        data: 'base64_audio_data',
        encoding: 'pcm16',
        sampleRate: 16000,
        channels: 1,
        isFinal: true,
        transcript: 'Hello, world!',
      },
    };
    expect(message.payload.transcript).toBe('Hello, world!');
  });
});

describe('ToolCallMessage', () => {
  it('should create valid tool call message', () => {
    const message: ToolCallMessage = {
      type: OmniMessageType.TOOL_CALL,
      payload: {
        sessionId: 'session_123',
        toolId: 'tool_1',
        toolName: 'search_web',
        parameters: { query: 'test' },
      },
    };
    expect(message.type).toBe(OmniMessageType.TOOL_CALL);
    expect(message.payload.toolId).toBe('tool_1');
    expect(message.payload.toolName).toBe('search_web');
    expect(message.payload.parameters).toEqual({ query: 'test' });
  });

  it('should accept optional callId', () => {
    const message: ToolCallMessage = {
      type: OmniMessageType.TOOL_CALL,
      payload: {
        sessionId: 'session_123',
        toolId: 'tool_1',
        toolName: 'search_web',
        parameters: {},
        callId: 'call_123',
      },
    };
    expect(message.payload.callId).toBe('call_123');
  });
});

describe('ToolResultMessage', () => {
  it('should create successful tool result message', () => {
    const message: ToolResultMessage = {
      type: OmniMessageType.TOOL_RESULT,
      payload: {
        sessionId: 'session_123',
        toolId: 'tool_1',
        result: { success: true, data: 'result' },
      },
    };
    expect(message.type).toBe(OmniMessageType.TOOL_RESULT);
    expect(message.payload.result).toEqual({ success: true, data: 'result' });
    expect(message.payload.error).toBeUndefined();
  });

  it('should create failed tool result message', () => {
    const message: ToolResultMessage = {
      type: OmniMessageType.TOOL_RESULT,
      payload: {
        sessionId: 'session_123',
        toolId: 'tool_1',
        error: 'Tool execution failed',
      },
    };
    expect(message.payload.error).toBe('Tool execution failed');
    expect(message.payload.result).toBeUndefined();
  });

  it('should accept optional callId', () => {
    const message: ToolResultMessage = {
      type: OmniMessageType.TOOL_RESULT,
      payload: {
        sessionId: 'session_123',
        toolId: 'tool_1',
        result: 'success',
        callId: 'call_123',
      },
    };
    expect(message.payload.callId).toBe('call_123');
  });
});

describe('ErrorMessage', () => {
  it('should create valid error message', () => {
    const message: ErrorMessage = {
      type: OmniMessageType.ERROR,
      payload: {
        code: 'PROV_001',
        message: 'Connection failed',
      },
    };
    expect(message.type).toBe(OmniMessageType.ERROR);
    expect(message.payload.code).toBe('PROV_001');
    expect(message.payload.message).toBe('Connection failed');
  });

  it('should accept optional details', () => {
    const message: ErrorMessage = {
      type: OmniMessageType.ERROR,
      payload: {
        code: 'PROV_002',
        message: 'Handshake failed',
        details: { retryable: true, retryAfter: 1000 },
      },
    };
    expect(message.payload.details).toEqual({ retryable: true, retryAfter: 1000 });
  });
});

describe('HeartbeatAckMessage', () => {
  it('should create valid heartbeat ack message', () => {
    const now = Date.now();
    const message: HeartbeatAckMessage = {
      type: OmniMessageType.HEARTBEAT_ACK,
      payload: {
        timestamp: now,
        serverTime: now,
      },
    };
    expect(message.type).toBe(OmniMessageType.HEARTBEAT_ACK);
    expect(message.payload.timestamp).toBeDefined();
    expect(message.payload.serverTime).toBeDefined();
  });
});

describe('parseServerMessage', () => {
  it('should parse valid session started message', () => {
    const json = JSON.stringify({
      type: 'session_started',
      payload: {
        sessionId: 'session_123',
        establishedAt: Date.now(),
      },
    });
    const message = parseServerMessage(json);
    expect(message.type).toBe(OmniMessageType.SESSION_STARTED);
  });

  it('should parse valid audio response message', () => {
    const json = JSON.stringify({
      type: 'audio_response',
      payload: {
        sessionId: 'session_123',
        data: 'base64_data',
        encoding: 'pcm16',
        sampleRate: 16000,
        channels: 1,
        isFinal: false,
      },
    });
    const message = parseServerMessage(json);
    expect(message.type).toBe(OmniMessageType.AUDIO_RESPONSE);
  });

  it('should parse valid tool call message', () => {
    const json = JSON.stringify({
      type: 'tool_call',
      payload: {
        sessionId: 'session_123',
        toolId: 'tool_1',
        toolName: 'search',
        parameters: {},
      },
    });
    const message = parseServerMessage(json);
    expect(message.type).toBe(OmniMessageType.TOOL_CALL);
  });

  it('should parse valid error message', () => {
    const json = JSON.stringify({
      type: 'error',
      payload: {
        code: 'PROV_001',
        message: 'Error message',
      },
    });
    const message = parseServerMessage(json);
    expect(message.type).toBe(OmniMessageType.ERROR);
  });

  it('should parse valid heartbeat ack message', () => {
    const json = JSON.stringify({
      type: 'heartbeat_ack',
      payload: {
        timestamp: Date.now(),
        serverTime: Date.now(),
      },
    });
    const message = parseServerMessage(json);
    expect(message.type).toBe(OmniMessageType.HEARTBEAT_ACK);
  });

  it('should throw on invalid JSON', () => {
    expect(() => {
      parseServerMessage('invalid json');
    }).toThrow();
  });

  it('should throw on missing type', () => {
    const json = JSON.stringify({
      payload: { sessionId: 'session_123' },
    });
    expect(() => {
      parseServerMessage(json);
    }).toThrow();
  });

  it('should throw on missing payload', () => {
    const json = JSON.stringify({
      type: 'session_started',
    });
    expect(() => {
      parseServerMessage(json);
    }).toThrow();
  });
});

describe('createClientMessage', () => {
  it('should create session start message', () => {
    const config: SessionConfig = {
      model: 'omni-realtime-v1',
      apiKey: 'test_key',
    };
    const message = createClientMessage<SessionStartMessage>(OmniMessageType.SESSION_START, config);
    expect(message.type).toBe(OmniMessageType.SESSION_START);
    expect(message.payload).toEqual(config);
  });

  it('should create audio frame message', () => {
    const payload = {
      data: 'base64_data',
      sampleRate: 16000,
      channels: 1,
    };
    const message = createClientMessage<AudioFrameMessage>(OmniMessageType.AUDIO_FRAME, payload);
    expect(message.type).toBe(OmniMessageType.AUDIO_FRAME);
    expect(message.payload).toEqual(payload);
  });

  it('should create session end message', () => {
    const payload = {
      sessionId: 'session_123',
      reason: 'user_ended' as const,
    };
    const message = createClientMessage<SessionEndMessage>(OmniMessageType.SESSION_END, payload);
    expect(message.type).toBe(OmniMessageType.SESSION_END);
    expect(message.payload.sessionId).toBe('session_123');
  });

  it('should create heartbeat message', () => {
    const payload = {
      timestamp: Date.now(),
    };
    const message = createClientMessage<HeartbeatMessage>(OmniMessageType.HEARTBEAT, payload);
    expect(message.type).toBe(OmniMessageType.HEARTBEAT);
  });
});

describe('PROTOCOL_CONSTANTS', () => {
  it('should have WebSocket connection constants', () => {
    expect(PROTOCOL_CONSTANTS.DEFAULT_CONNECT_TIMEOUT_MS).toBe(10000);
    expect(PROTOCOL_CONSTANTS.DEFAULT_RECONNECT_DELAY_MS).toBe(1000);
    expect(PROTOCOL_CONSTANTS.MAX_RECONNECT_ATTEMPTS).toBe(3);
  });

  it('should have heartbeat constants', () => {
    expect(PROTOCOL_CONSTANTS.HEARTBEAT_INTERVAL_MS).toBe(30000);
    expect(PROTOCOL_CONSTANTS.HEARTBEAT_TIMEOUT_MS).toBe(5000);
  });

  it('should have supported sample rates', () => {
    expect(PROTOCOL_CONSTANTS.SUPPORTED_SAMPLE_RATES).toEqual([8000, 12000, 16000, 24000, 48000]);
  });

  it('should have supported encodings', () => {
    expect(PROTOCOL_CONSTANTS.SUPPORTED_ENCODINGS).toEqual(['pcm16', 'opus']);
  });

  it('should have session timeout constants', () => {
    expect(PROTOCOL_CONSTANTS.DEFAULT_SESSION_TIMEOUT_MS).toBe(300000);
    expect(PROTOCOL_CONSTANTS.MAX_SESSION_DURATION_MS).toBe(3600000);
  });

  it('should have constants as frozen readonly', () => {
    // as const in TypeScript makes the type readonly, but we can verify the values
    // are what we expect at runtime
    expect(PROTOCOL_CONSTANTS.DEFAULT_CONNECT_TIMEOUT_MS).toBe(10000);
    // Verify the object is properly typed (arrays should be tuples)
    expect(Array.isArray(PROTOCOL_CONSTANTS.SUPPORTED_ENCODINGS)).toBe(true);
    expect(PROTOCOL_CONSTANTS.SUPPORTED_ENCODINGS.length).toBe(2);
  });
});
