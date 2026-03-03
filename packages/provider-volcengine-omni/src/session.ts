/**
 * Session management for Omni provider
 */

import { randomUUID } from 'node:crypto';
import pino from 'pino';
import {
  type SessionStartMessage,
  type SessionEndMessage,
  type AudioFrameMessage,
  type ToolResultMessage,
  type HeartbeatMessage,
  OmniMessageType,
} from './protocol.js';
import { ProviderState, type OmniSession, type OmniProviderConfig } from './types.js';

const logger = pino({ name: 'OmniSession' });

/**
 * Session manager for Omni connections
 */
export class OmniSessionManager {
  private sessions: Map<string, OmniSession> = new Map();

  /**
   * Create a new session
   */
  createSession(config: OmniProviderConfig): OmniSession {
    const sessionId = this.generateSessionId();

    const session: OmniSession = {
      sessionId,
      state: ProviderState.DISCONNECTED,
      startTime: Date.now(),
      lastActivity: Date.now(),
      config,
    };

    this.sessions.set(sessionId, session);
    logger.info({ sessionId }, 'Session created');

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): OmniSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session state
   */
  updateState(sessionId: string, state: OmniSession['state']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
      session.lastActivity = Date.now();
      logger.debug({ sessionId, state }, 'Session state updated');
    }
  }

  /**
   * Update last activity time
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(sessionId: string, timeoutMs: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return true;
    }

    const idleTime = Date.now() - session.lastActivity;
    return idleTime > timeoutMs;
  }

  /**
   * End and remove session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info({ sessionId }, 'Session ended');
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(timeoutMs: number): string[] {
    const expired: string[] = [];

    for (const [sessionId] of this.sessions.entries()) {
      if (this.isSessionExpired(sessionId, timeoutMs)) {
        expired.push(sessionId);
        this.sessions.delete(sessionId);
      }
    }

    if (expired.length > 0) {
      logger.info({ expiredSessions: expired }, 'Cleaned up expired sessions');
    }

    return expired;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): OmniSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.state === ProviderState.SESSION_ACTIVE
    );
  }

  /**
   * Get session count by state
   */
  getSessionCount(): { total: number; active: number } {
    const total = this.sessions.size;
    const active = this.getActiveSessions().length;
    return { total, active };
  }

  /**
   * Generate unique session ID using crypto.randomUUID()
   */
  private generateSessionId(): string {
    return `omni_${randomUUID()}`;
  }
}

/**
 * Message builder for creating protocol messages
 */
export class MessageBuilder {
  /**
   * Create session start message
   */
  static sessionStart(config: OmniProviderConfig): SessionStartMessage {
    return {
      type: OmniMessageType.SESSION_START,
      payload: {
        model: config.model,
        apiKey: config.apiKey,
        voice: config.audio
          ? {
              encoding: config.audio.encoding,
              sampleRate: config.audio.sampleRate,
              channels: config.audio.channels,
            }
          : {
              encoding: 'pcm16',
              sampleRate: 16000,
              channels: 1,
            },
        enableToolCalls: config.session?.enableToolCalls ?? true,
        language: config.session?.language ?? 'zh',
      },
    };
  }

  /**
   * Create audio frame message
   */
  static audioFrame(
    sessionId: string,
    data: string,
    sampleRate: number,
    channels: number
  ): AudioFrameMessage {
    return {
      type: OmniMessageType.AUDIO_FRAME,
      payload: {
        data,
        sampleRate,
        channels,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Create session end message
   */
  static sessionEnd(
    sessionId: string,
    reason: SessionEndMessage['payload']['reason']
  ): SessionEndMessage {
    return {
      type: OmniMessageType.SESSION_END,
      payload: {
        sessionId,
        reason,
      },
    };
  }

  /**
   * Create heartbeat message
   */
  static heartbeat(): HeartbeatMessage {
    return {
      type: OmniMessageType.HEARTBEAT,
      payload: {
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Create tool result message
   */
  static toolResult(
    sessionId: string,
    toolId: string,
    result: unknown,
    error?: string
  ): ToolResultMessage {
    return {
      type: OmniMessageType.TOOL_RESULT,
      payload: {
        sessionId,
        toolId,
        result,
        error,
      },
    };
  }
}
