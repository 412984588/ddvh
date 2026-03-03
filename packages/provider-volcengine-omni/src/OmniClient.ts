/**
 * Omni WebSocket Client
 *
 * Main client for connecting to Volcengine Doubao Omni Realtime API
 */

import { WebSocket } from 'ws';
import pino from 'pino';
import {
  ProviderEvent,
  type OmniProviderConfig,
  type ProviderEventListeners,
  type ProviderEventPayload,
  type ProviderEventListener,
} from './types.js';
import { ProviderState } from './types.js';
import { PROTOCOL_CONSTANTS } from './protocol.js';
import { parseOmniEvent, validateAudioFrame, encodeAudioFrame } from './event-parser.js';
import { OmniSessionManager, MessageBuilder } from './session.js';
import { BargeInStateMachine } from './barge-in.js';

const logger = pino({ name: 'OmniClient' });

export interface OmniClientConfig extends OmniProviderConfig {
  autoReconnect?: boolean;
}

/**
 * WebSocket client for Volcengine Omni Realtime API
 */
export class OmniClient {
  private readonly config: OmniClientConfig;
  private ws: WebSocket | null = null;
  private sessionManager: OmniSessionManager;
  private bargeIn: BargeInStateMachine;
  private currentSessionId: string | null = null;
  private state: ProviderState = ProviderState.DISCONNECTED;
  private listeners: ProviderEventListeners = {};
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private reconnectEnabled = true;

  constructor(config: OmniClientConfig) {
    this.config = config;
    this.sessionManager = new OmniSessionManager();
    this.bargeIn = new BargeInStateMachine({
      onInterrupt: () => this.handleInterrupt(),
      onRecover: () => this.handleRecover(),
    });

    logger.info(
      {
        endpoint: config.endpoint,
        model: config.model,
      },
      'OmniClient initialized'
    );
  }

  /**
   * Connect to Omni WebSocket endpoint
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== ProviderState.DISCONNECTED) {
        reject(new Error(`Cannot connect while state is ${this.state}`));
        return;
      }

      this.reconnectEnabled = true;
      this.setState(ProviderState.CONNECTING);
      logger.info({ endpoint: this.config.endpoint }, 'Connecting to Omni');

      try {
        this.ws = new WebSocket(this.config.endpoint, {
          handshakeTimeout:
            this.config.connection?.connectTimeoutMs ??
            PROTOCOL_CONSTANTS.DEFAULT_CONNECT_TIMEOUT_MS,
        });

        this.ws.on('open', () => this.handleOpen(resolve));
        this.ws.on('message', (data: Buffer) => this.handleMessage(data));
        this.ws.on('error', (error: Error) => this.handleError(error, reject));
        this.ws.on('close', (code: number, reason: Buffer) => this.handleClose(code, reason));
        this.ws.on('ping', (data: Buffer) => this.handlePing(data));
      } catch (error) {
        this.setState(ProviderState.ERROR);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from Omni
   */
  disconnect(): void {
    logger.info('Disconnecting from Omni');
    this.reconnectEnabled = false;

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // End session if active
    if (this.currentSessionId) {
      this.endSession(this.currentSessionId);
    }

    // Close WebSocket
    if (this.ws) {
      if (typeof this.ws.removeAllListeners === 'function') {
        this.ws.removeAllListeners();
      }
      this.ws.close();
      this.ws = null;
    }

    this.setState(ProviderState.DISCONNECTED);
  }

  /**
   * Start a new session
   */
  async startSession(): Promise<string> {
    if (this.state !== ProviderState.CONNECTED) {
      throw new Error('Cannot start session: not connected');
    }

    const session = this.sessionManager.createSession(this.config);
    this.currentSessionId = session.sessionId;

    logger.info({ sessionId: session.sessionId }, 'Starting Omni session');

    const message = MessageBuilder.sessionStart(this.config);
    this.sendMessage(message);

    this.sessionManager.updateState(session.sessionId, ProviderState.SESSION_ACTIVE);
    this.setState(ProviderState.SESSION_ACTIVE);
    this.startHeartbeat();

    return session.sessionId;
  }

  /**
   * End active session
   */
  endSession(sessionId: string, reason: 'user_ended' | 'error' | 'timeout' = 'user_ended'): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info({ sessionId, reason }, 'Ending Omni session');
      const message = MessageBuilder.sessionEnd(sessionId, reason);
      this.sendMessage(message);
    } else {
      logger.debug({ sessionId, reason }, 'Ending Omni session without websocket notification');
    }

    this.sessionManager.endSession(sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }

    this.stopHeartbeat();
    if (this.state !== ProviderState.DISCONNECTED) {
      this.setState(ProviderState.CONNECTED);
    }
  }

  /**
   * Send audio frame
   */
  sendAudioFrame(data: Buffer): void {
    if (!this.currentSessionId || this.state !== ProviderState.SESSION_ACTIVE) {
      logger.warn('Cannot send audio: no active session');
      return;
    }

    // Validate frame
    const sampleRate = this.config.audio?.sampleRate ?? 16000;
    const channels = this.config.audio?.channels ?? 1;

    if (!validateAudioFrame(data, sampleRate, channels)) {
      return;
    }

    // Encode and send
    const encoded = encodeAudioFrame(data, sampleRate, channels);
    const message = MessageBuilder.audioFrame(this.currentSessionId, encoded, sampleRate, channels);

    this.sendMessage(message);
    this.sessionManager.updateActivity(this.currentSessionId);
  }

  /**
   * Send tool result
   */
  sendToolResult(toolId: string, result: unknown, error?: string): void {
    if (!this.currentSessionId) {
      logger.warn('Cannot send tool result: no active session');
      return;
    }

    const message = MessageBuilder.toolResult(this.currentSessionId, toolId, result, error);

    this.sendMessage(message);
  }

  /**
   * Add event listener
   */
  on<K extends ProviderEvent>(event: K, listener: ProviderEventListener<K>): void {
    const key = event as string;
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    (this.listeners[key] as ProviderEventListener<K>[]).push(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends ProviderEvent>(event: K, listener: ProviderEventListener<K>): void {
    const key = event as string;
    const listeners = this.listeners[key];
    if (listeners) {
      const index = (listeners as ProviderEventListener<K>[]).indexOf(listener);
      if (index > -1) {
        (listeners as ProviderEventListener<K>[]).splice(index, 1);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): ProviderState {
    return this.state;
  }

  /**
   * Get barge-in status
   */
  getBargeInStatus() {
    return this.bargeIn.getStatus();
  }

  /**
   * Handle WebSocket open
   */
  private handleOpen(resolve: (value: void) => void): void {
    logger.info('WebSocket connection established');
    this.setState(ProviderState.CONNECTED);
    this.reconnectAttempts = 0;
    resolve();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: Buffer): void {
    try {
      const messageStr = data.toString();
      const event = parseOmniEvent(messageStr, this.currentSessionId ?? '');

      if (!event) {
        return;
      }

      logger.debug(
        {
          eventType: event.eventType,
          sessionId: this.currentSessionId,
        },
        'Received Omni event'
      );

      // Update session activity
      if (this.currentSessionId) {
        this.sessionManager.updateActivity(this.currentSessionId);
      }

      // Handle barge-in for audio events
      if (event.eventType === ProviderEvent.AUDIO_RECEIVED) {
        this.bargeIn.handlePlaybackStart();
      }

      // Emit to listeners
      this.emit(event.eventType, event.payload);
    } catch (error) {
      logger.error({ error }, 'Error handling message');
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Error, reject?: (reason: unknown) => void): void {
    logger.error({ error: error.message }, 'WebSocket error');
    this.setState(ProviderState.ERROR);

    if (reject) {
      reject(error);
    }

    this.emit(ProviderEvent.ERROR, {
      code: 'WEBSOCKET_ERROR',
      message: error.message,
    });
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(code: number, reason: Buffer): void {
    logger.info({ code, reason: reason.toString() }, 'WebSocket closed');

    const wasActive = this.state === ProviderState.SESSION_ACTIVE;
    if (this.currentSessionId) {
      this.sessionManager.endSession(this.currentSessionId);
      this.currentSessionId = null;
    }

    this.stopHeartbeat();
    this.setState(ProviderState.DISCONNECTED);

    this.emit(ProviderEvent.DISCONNECTED, {
      code,
      reason: reason.toString() ?? 'Unknown reason',
    });

    // Auto-reconnect if enabled and was active
    if (wasActive && this.config.autoReconnect && this.reconnectEnabled) {
      this.scheduleReconnect(true);
    }
  }

  /**
   * Handle ping frame
   */
  private handlePing(data: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.pong(data);
    }
  }

  /**
   * Send message through WebSocket
   */
  private sendMessage(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message: WebSocket not open');
      return;
    }

    const data = JSON.stringify(message);
    this.ws.send(data);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      const message = MessageBuilder.heartbeat();
      this.sendMessage(message);
    }, PROTOCOL_CONSTANTS.HEARTBEAT_INTERVAL_MS);

    logger.debug('Heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.debug('Heartbeat stopped');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(resumeSession: boolean): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const maxAttempts =
      this.config.connection?.reconnectAttempts ?? PROTOCOL_CONSTANTS.MAX_RECONNECT_ATTEMPTS;

    if (this.reconnectAttempts >= maxAttempts) {
      logger.error('Max reconnect attempts reached');
      return;
    }

    const delay =
      this.config.connection?.reconnectDelayMs ?? PROTOCOL_CONSTANTS.DEFAULT_RECONNECT_DELAY_MS;

    this.reconnectAttempts++;
    const backoffDelay = delay * Math.pow(2, this.reconnectAttempts - 1);

    logger.info(
      {
        attempt: this.reconnectAttempts,
        delayMs: backoffDelay,
      },
      'Scheduling reconnect'
    );

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;

      try {
        await this.connect();
        if (resumeSession) {
          await this.startSession();
        }
      } catch (error) {
        logger.error({ error }, 'Reconnect failed');
        this.scheduleReconnect(resumeSession);
      }
    }, backoffDelay);
  }

  /**
   * Handle barge-in interrupt
   */
  private handleInterrupt(): void {
    logger.info('Barge-in interrupt triggered');
    // Could stop playback here
  }

  /**
   * Handle barge-in recovery
   */
  private handleRecover(): void {
    logger.info('Barge-in recovery complete');
  }

  /**
   * Set connection state
   */
  private setState(state: ProviderState): void {
    if (this.state !== state) {
      const oldState = this.state;
      this.state = state;
      logger.debug({ from: oldState, to: state }, 'State changed');
    }
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends ProviderEvent>(event: K, payload: ProviderEventPayload[K]): void {
    const key = event as string;
    const listeners = this.listeners[key];
    if (listeners) {
      for (const listener of listeners) {
        try {
          (listener as (payload: ProviderEventPayload[K]) => void)(payload);
        } catch (error) {
          logger.error({ error, event }, 'Error in event listener');
        }
      }
    }
  }
}
