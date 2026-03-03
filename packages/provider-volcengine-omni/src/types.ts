/**
 * Provider types and interfaces
 */

/**
 * Provider connection state
 */
export enum ProviderState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SESSION_ACTIVE = 'session_active',
  ERROR = 'error',
}

/**
 * Provider event types
 */
export enum ProviderEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  AUDIO_RECEIVED = 'audio_received',
  TOOL_CALL = 'tool_call',
  HEARTBEAT = 'heartbeat',
}

/**
 * Provider event payload
 */
export interface ProviderEventPayload {
  [ProviderEvent.CONNECTED]: {
    sessionId: string;
    timestamp: number;
  };
  [ProviderEvent.DISCONNECTED]: {
    code: number;
    reason: string;
  };
  [ProviderEvent.ERROR]: {
    code: string;
    message: string;
  };
  [ProviderEvent.SESSION_START]: {
    sessionId: string;
    config: unknown;
  };
  [ProviderEvent.SESSION_END]: {
    sessionId: string;
    reason: string;
  };
  [ProviderEvent.AUDIO_RECEIVED]: {
    sessionId: string;
    data: Buffer;
    transcript?: string;
    isFinal: boolean;
  };
  [ProviderEvent.TOOL_CALL]: {
    sessionId: string;
    toolId: string;
    toolName: string;
    parameters: Record<string, unknown>;
  };
  [ProviderEvent.HEARTBEAT]: {
    timestamp: number;
    latency: number;
  };
}

/**
 * Event listener type
 */
export type ProviderEventListener<K extends ProviderEvent> = (
  payload: ProviderEventPayload[K]
) => void;

/**
 * All event listeners map
 */
export type ProviderEventListeners = {
  [ProviderEvent.CONNECTED]?: ProviderEventListener<ProviderEvent.CONNECTED>[];
  [ProviderEvent.DISCONNECTED]?: ProviderEventListener<ProviderEvent.DISCONNECTED>[];
  [ProviderEvent.ERROR]?: ProviderEventListener<ProviderEvent.ERROR>[];
  [ProviderEvent.SESSION_START]?: ProviderEventListener<ProviderEvent.SESSION_START>[];
  [ProviderEvent.SESSION_END]?: ProviderEventListener<ProviderEvent.SESSION_END>[];
  [ProviderEvent.AUDIO_RECEIVED]?: ProviderEventListener<ProviderEvent.AUDIO_RECEIVED>[];
  [ProviderEvent.TOOL_CALL]?: ProviderEventListener<ProviderEvent.TOOL_CALL>[];
  [ProviderEvent.HEARTBEAT]?: ProviderEventListener<ProviderEvent.HEARTBEAT>[];
} & Record<string, ((payload: unknown) => void)[] | undefined>;

/**
 * Provider configuration
 */
export interface OmniProviderConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  audio?: {
    sampleRate: number;
    channels: number;
    encoding: 'pcm16' | 'opus';
  };
  connection?: {
    connectTimeoutMs: number;
    reconnectAttempts: number;
    reconnectDelayMs: number;
  };
  session?: {
    timeoutMs: number;
    enableToolCalls: boolean;
    language: string;
  };
}

/**
 * Barge-in state for interruption handling
 */
export enum BargeInState {
  IDLE = 'idle',
  LISTENING = 'listening',
  INTERRUPTING = 'interrupting',
  RECOVERING = 'recovering',
}

/**
 * Session info
 */
export interface OmniSession {
  sessionId: string;
  state: ProviderState;
  startTime: number;
  lastActivity: number;
  config: OmniProviderConfig;
}
