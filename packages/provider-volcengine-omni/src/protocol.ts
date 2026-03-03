/**
 * Volcengine Doubao Omni Realtime Protocol Definitions
 *
 * Reference: https://www.volcengine.com/docs/
 *
 * NOTE: Protocol fields are based on common WebSocket real-time audio patterns.
 * Actual Volcengine Omni API documentation should be consulted for production use.
 */

/**
 * Message types for Omni WebSocket protocol
 */
export enum OmniMessageType {
  // Client -> Server
  SESSION_START = 'session_start',
  AUDIO_FRAME = 'audio_frame',
  SESSION_END = 'session_end',
  HEARTBEAT = 'heartbeat',

  // Server -> Client
  SESSION_STARTED = 'session_started',
  AUDIO_RESPONSE = 'audio_response',
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result',
  ERROR = 'error',
  HEARTBEAT_ACK = 'heartbeat_ack',
}

/**
 * Session configuration
 */
export interface SessionConfig {
  model: string;
  apiKey: string;
  voice?: {
    encoding: 'pcm16' | 'opus';
    sampleRate: number;
    channels: number;
  };
  // Optional session configuration
  enableToolCalls?: boolean;
  maxDuration?: number;
  language?: string;
}

/**
 * Audio frame format (client -> server)
 */
export interface AudioFrameMessage {
  type: OmniMessageType.AUDIO_FRAME;
  payload: {
    data: string; // Base64-encoded PCM16 audio data
    sampleRate: number;
    channels: number;
    timestamp?: number; // Optional frame timestamp
  };
}

/**
 * Session start message (client -> server)
 */
export interface SessionStartMessage {
  type: OmniMessageType.SESSION_START;
  payload: SessionConfig;
}

/**
 * Session end message (client -> server)
 */
export interface SessionEndMessage {
  type: OmniMessageType.SESSION_END;
  payload: {
    sessionId: string;
    reason?: 'user_ended' | 'error' | 'timeout';
  };
}

/**
 * Heartbeat message
 */
export interface HeartbeatMessage {
  type: OmniMessageType.HEARTBEAT;
  payload: {
    timestamp: number;
    sequence?: number; // Optional sequence number for ordering
  };
}

/**
 * Session started response (server -> client)
 */
export interface SessionStartedMessage {
  type: OmniMessageType.SESSION_STARTED;
  payload: {
    sessionId: string;
    establishedAt: number;
    expiresAt?: number; // Optional session expiration time
  };
}

/**
 * Audio response (server -> client)
 */
export interface AudioResponseMessage {
  type: OmniMessageType.AUDIO_RESPONSE;
  payload: {
    sessionId: string;
    data: string; // Base64-encoded audio data
    encoding: 'pcm16' | 'opus';
    sampleRate: number;
    channels: number;
    isFinal: boolean; // Last frame of response
    transcript?: string; // Optional text transcript of the audio
  };
}

/**
 * Tool call event (server -> client)
 */
export interface ToolCallMessage {
  type: OmniMessageType.TOOL_CALL;
  payload: {
    sessionId: string;
    toolId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    callId?: string; // Optional call ID for tracking
  };
}

/**
 * Tool result (client -> server after executing tool)
 */
export interface ToolResultMessage {
  type: OmniMessageType.TOOL_RESULT;
  payload: {
    sessionId: string;
    toolId: string;
    result: unknown;
    error?: string;
    callId?: string; // Optional call ID to match with ToolCallMessage
  };
}

/**
 * Error message (server -> client)
 */
export interface ErrorMessage {
  type: OmniMessageType.ERROR;
  payload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Heartbeat ACK
 */
export interface HeartbeatAckMessage {
  type: OmniMessageType.HEARTBEAT_ACK;
  payload: {
    timestamp: number;
    serverTime: number;
  };
}

/**
 * Union type of all server messages
 */
export type ServerMessage =
  | SessionStartedMessage
  | AudioResponseMessage
  | ToolCallMessage
  | ErrorMessage
  | HeartbeatAckMessage;

/**
 * Union type of all client messages
 */
export type ClientMessage =
  | SessionStartMessage
  | AudioFrameMessage
  | SessionEndMessage
  | HeartbeatMessage
  | ToolResultMessage;

/**
 * Protocol constants
 */
export const PROTOCOL_CONSTANTS = {
  // WebSocket connection
  DEFAULT_CONNECT_TIMEOUT_MS: 10000,
  DEFAULT_RECONNECT_DELAY_MS: 1000,
  MAX_RECONNECT_ATTEMPTS: 3,

  // Heartbeat
  HEARTBEAT_INTERVAL_MS: 30000,
  HEARTBEAT_TIMEOUT_MS: 5000,

  // Audio
  SUPPORTED_SAMPLE_RATES: [8000, 12000, 16000, 24000, 48000],
  SUPPORTED_ENCODINGS: ['pcm16', 'opus'] as const,

  // Session
  DEFAULT_SESSION_TIMEOUT_MS: 300000, // 5 minutes
  MAX_SESSION_DURATION_MS: 3600000, // 1 hour
} as const;

/**
 * Parse and validate incoming message
 */
export function parseServerMessage(data: string): ServerMessage {
  try {
    const message = JSON.parse(data) as ServerMessage;

    // Basic validation
    if (!message.type || !message.payload) {
      throw new Error('Invalid message format: missing type or payload');
    }

    return message;
  } catch (error) {
    throw new Error(`Failed to parse server message: ${error}`);
  }
}

/**
 * Create client message
 */
export function createClientMessage<T extends ClientMessage>(
  type: T['type'],
  payload: T['payload']
): T {
  return {
    type,
    payload,
  } as T;
}
