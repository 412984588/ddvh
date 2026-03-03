/**
 * SessionRegistry - Manages active voice sessions
 *
 * Responsibilities:
 * - Track all active voice sessions
 * - Provide session lookup by various keys
 * - Handle session lifecycle
 * - Enforce session limits
 */

import pino from 'pino';
import type { SessionState } from '@voice-hub/shared-config';
import { SESSION_LIMITS, VoiceConnectionState } from '@voice-hub/shared-config';

const logger = pino({ name: 'SessionRegistry' });

export interface ActiveSession extends SessionState {
  // Discord-specific
  voiceConnectionId?: string;

  // Provider-specific
  providerSessionId?: string;

  // Backend task tracking
  pendingTaskIds: Set<string>;

  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Registry for active voice sessions
 */
export class SessionRegistry {
  private readonly sessions: Map<string, ActiveSession> = new Map();
  private readonly byUserId: Map<string, Set<string>> = new Map();
  private readonly byChannelId: Map<string, Set<string>> = new Map();
  private readonly byGuildId: Map<string, Set<string>> = new Map();

  /**
   * Create a new session
   */
  createSession(
    sessionId: string,
    userId: string,
    guildId: string,
    channelId: string
  ): ActiveSession {
    if (this.sessions.has(sessionId)) {
      throw new Error('Session already exists');
    }

    if (this.sessions.size >= SESSION_LIMITS.MAX_CONCURRENT_SESSIONS) {
      throw new Error('Maximum concurrent sessions reached');
    }

    const now = Date.now();
    const session: ActiveSession = {
      sessionId,
      userId,
      guildId,
      channelId,
      state: VoiceConnectionState.CONNECTING,
      startTime: now,
      lastActivity: now,
      pendingTaskIds: new Set(),
    };

    this.sessions.set(sessionId, session);
    this.addToIndexes(session);

    logger.info(
      {
        sessionId,
        userId,
        guildId,
        channelId,
        totalSessions: this.sessions.size,
      },
      'Session created'
    );

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session by user ID
   */
  getSessionsByUser(userId: string): ActiveSession[] {
    const sessionIds = this.byUserId.get(userId);
    if (!sessionIds) {
      return [];
    }

    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((s): s is ActiveSession => !!s);
  }

  /**
   * Get session by channel ID
   */
  getSessionByChannel(channelId: string): ActiveSession | undefined {
    const sessionIds = this.byChannelId.get(channelId);
    if (!sessionIds || sessionIds.size === 0) {
      return undefined;
    }

    // Return first active session
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session && session.state === VoiceConnectionState.CONNECTED) {
        return session;
      }
    }

    return undefined;
  }

  /**
   * Update session state
   */
  updateState(sessionId: string, state: VoiceConnectionState): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
      session.lastActivity = Date.now();
      logger.debug({ sessionId, state }, 'Session state updated');
    }
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * Add pending task ID to session
   */
  addPendingTask(sessionId: string, taskId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingTaskIds.add(taskId);
    }
  }

  /**
   * Remove pending task ID from session
   */
  removePendingTask(sessionId: string, taskId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingTaskIds.delete(taskId);
    }
  }

  /**
   * End and remove session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.removeFromIndexes(session);
    this.sessions.delete(sessionId);

    logger.info(
      {
        sessionId,
        userId: session.userId,
        duration: Date.now() - session.startTime,
      },
      'Session ended'
    );
  }

  /**
   * Clean up expired/inactive sessions
   */
  cleanup(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastActivity;
      const duration = now - session.startTime;

      // Check max duration
      if (duration > SESSION_LIMITS.MAX_SESSION_DURATION_MS) {
        expired.push(sessionId);
        continue;
      }

      // Check inactivity timeout
      if (idleTime > SESSION_LIMITS.MAX_INACTIVITY_MS) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      this.endSession(sessionId);
    }

    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Cleaned up expired sessions');
    }

    return expired;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): ActiveSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    total: number;
    byState: Record<string, number>;
    byGuild: Record<string, number>;
  } {
    const byState: Record<string, number> = {};
    const byGuild: Record<string, number> = {};

    for (const session of this.sessions.values()) {
      byState[session.state] = (byState[session.state] ?? 0) + 1;
      byGuild[session.guildId] = (byGuild[session.guildId] ?? 0) + 1;
    }

    return {
      total: this.sessions.size,
      byState,
      byGuild,
    };
  }

  /**
   * Add session to indexes
   */
  private addToIndexes(session: ActiveSession): void {
    this.addToMap(this.byUserId, session.userId, session.sessionId);
    this.addToMap(this.byChannelId, session.channelId, session.sessionId);
    this.addToMap(this.byGuildId, session.guildId, session.sessionId);
  }

  /**
   * Remove session from indexes
   */
  private removeFromIndexes(session: ActiveSession): void {
    this.removeFromMap(this.byUserId, session.userId, session.sessionId);
    this.removeFromMap(this.byChannelId, session.channelId, session.sessionId);
    this.removeFromMap(this.byGuildId, session.guildId, session.sessionId);
  }

  /**
   * Helper to add to map
   */
  private addToMap(map: Map<string, Set<string>>, key: string, value: string): void {
    let values = map.get(key);
    if (!values) {
      values = new Set();
      map.set(key, values);
    }
    values.add(value);
  }

  /**
   * Helper to remove from map
   */
  private removeFromMap(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        map.delete(key);
      }
    }
  }
}
