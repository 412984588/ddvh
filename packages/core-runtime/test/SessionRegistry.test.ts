/**
 * Tests for SessionRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRegistry } from '../src/SessionRegistry.js';
import { VoiceConnectionState, SESSION_LIMITS } from '@voice-hub/shared-config';

describe('SessionRegistry', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry();
  });

  function mustGetSession(sessionId: string) {
    const session = registry.getSession(sessionId);
    if (!session) {
      throw new Error(`Expected session ${sessionId} to exist`);
    }
    return session;
  }

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');

      expect(session.sessionId).toBe('session_1');
      expect(session.userId).toBe('user_1');
      expect(session.guildId).toBe('guild_1');
      expect(session.channelId).toBe('channel_1');
      expect(session.state).toBe(VoiceConnectionState.CONNECTING);
      expect(session.pendingTaskIds).toBeInstanceOf(Set);
      expect(session.pendingTaskIds.size).toBe(0);
    });

    it('should set start and activity time to current time', () => {
      const before = Date.now();
      const session = registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const after = Date.now();

      expect(session.startTime).toBeGreaterThanOrEqual(before);
      expect(session.startTime).toBeLessThanOrEqual(after);
      expect(session.lastActivity).toBe(session.startTime);
    });

    it('should add session to registry', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      expect(registry.getCount()).toBe(1);
    });

    it('should reject duplicate session IDs to avoid index corruption', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');

      expect(() => {
        registry.createSession('session_1', 'user_2', 'guild_2', 'channel_2');
      }).toThrow('Session already exists');

      expect(registry.getCount()).toBe(1);
      const sessionsForUser1 = registry.getSessionsByUser('user_1');
      expect(sessionsForUser1).toHaveLength(1);
      expect(sessionsForUser1[0]?.sessionId).toBe('session_1');
    });

    it('should enforce max concurrent sessions limit', () => {
      // Fill the registry to max capacity
      for (let i = 0; i < SESSION_LIMITS.MAX_CONCURRENT_SESSIONS; i++) {
        registry.createSession(`session_${i}`, `user_${i}`, 'guild_1', 'channel_1');
      }

      // Should throw when trying to exceed limit
      expect(() => {
        registry.createSession('session_overflow', 'user_overflow', 'guild_1', 'channel_1');
      }).toThrow('Maximum concurrent sessions reached');
    });

    it('should allow creating sessions up to the limit', () => {
      const maxSessions = SESSION_LIMITS.MAX_CONCURRENT_SESSIONS;
      for (let i = 0; i < maxSessions; i++) {
        const session = registry.createSession(`session_${i}`, `user_${i}`, 'guild_1', 'channel_1');
        expect(session).toBeDefined();
      }
      expect(registry.getCount()).toBe(maxSessions);
    });
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      const created = registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const retrieved = registry.getSession('session_1');

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = registry.getSession('non_existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getSessionsByUser', () => {
    it('should return empty array for user with no sessions', () => {
      const sessions = registry.getSessionsByUser('user_1');
      expect(sessions).toEqual([]);
    });

    it('should return all sessions for a user', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_1', 'guild_1', 'channel_2');
      registry.createSession('session_3', 'user_2', 'guild_1', 'channel_1');

      const user1Sessions = registry.getSessionsByUser('user_1');
      expect(user1Sessions).toHaveLength(2);
      expect(user1Sessions.map((s) => s.sessionId)).toContain('session_1');
      expect(user1Sessions.map((s) => s.sessionId)).toContain('session_2');
    });

    it('should not return sessions from other users', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_1');

      const user1Sessions = registry.getSessionsByUser('user_1');
      expect(user1Sessions).toHaveLength(1);
      expect(user1Sessions[0].sessionId).toBe('session_1');
    });
  });

  describe('getSessionByChannel', () => {
    it('should return undefined for channel with no sessions', () => {
      const session = registry.getSessionByChannel('channel_1');
      expect(session).toBeUndefined();
    });

    it('should return connected session for channel', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.updateState('session_1', VoiceConnectionState.CONNECTED);

      const session = registry.getSessionByChannel('channel_1');
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('session_1');
    });

    it('should prefer connected session over connecting', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_1');
      registry.updateState('session_1', VoiceConnectionState.CONNECTING);
      registry.updateState('session_2', VoiceConnectionState.CONNECTED);

      const session = registry.getSessionByChannel('channel_1');
      expect(session?.sessionId).toBe('session_2');
    });

    it('should return first connected session when multiple exist', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_1');
      registry.updateState('session_1', VoiceConnectionState.CONNECTED);
      registry.updateState('session_2', VoiceConnectionState.CONNECTED);

      const session = registry.getSessionByChannel('channel_1');
      expect(session).toBeDefined();
      expect(['session_1', 'session_2']).toContain(session?.sessionId ?? '');
    });
  });

  describe('updateState', () => {
    it('should update session state', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.updateState('session_1', VoiceConnectionState.CONNECTED);

      const session = registry.getSession('session_1');
      expect(session?.state).toBe(VoiceConnectionState.CONNECTED);
    });

    it('should update activity timestamp', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const originalActivity = registry.getSession('session_1')?.lastActivity ?? 0;

      // Wait a bit to ensure timestamp difference
      const startTime = Date.now();
      while (Date.now() - startTime < 5) {
        // Busy wait to ensure at least 5ms passed
      }

      registry.updateState('session_1', VoiceConnectionState.CONNECTED);
      const newActivity = registry.getSession('session_1')?.lastActivity ?? 0;

      expect(newActivity).toBeGreaterThan(originalActivity);
    });

    it('should do nothing for non-existent session', () => {
      expect(() => {
        registry.updateState('non_existent', VoiceConnectionState.CONNECTED);
      }).not.toThrow();
    });
  });

  describe('updateActivity', () => {
    it('should update activity timestamp', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const originalActivity = registry.getSession('session_1')?.lastActivity ?? 0;

      // Wait a bit
      const startTime = Date.now();
      while (Date.now() - startTime < 5) {
        // Busy wait
      }

      registry.updateActivity('session_1');
      const newActivity = registry.getSession('session_1')?.lastActivity ?? 0;

      expect(newActivity).toBeGreaterThan(originalActivity);
    });

    it('should do nothing for non-existent session', () => {
      expect(() => {
        registry.updateActivity('non_existent');
      }).not.toThrow();
    });
  });

  describe('addPendingTask', () => {
    it('should add task to session', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.addPendingTask('session_1', 'task_1');

      const session = registry.getSession('session_1');
      expect(session?.pendingTaskIds.has('task_1')).toBe(true);
    });

    it('should add multiple tasks', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.addPendingTask('session_1', 'task_1');
      registry.addPendingTask('session_1', 'task_2');
      registry.addPendingTask('session_1', 'task_3');

      const session = registry.getSession('session_1');
      expect(session?.pendingTaskIds.size).toBe(3);
    });
  });

  describe('removePendingTask', () => {
    it('should remove task from session', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.addPendingTask('session_1', 'task_1');
      registry.removePendingTask('session_1', 'task_1');

      const session = registry.getSession('session_1');
      expect(session?.pendingTaskIds.has('task_1')).toBe(false);
    });

    it('should do nothing for non-existent task', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      expect(() => {
        registry.removePendingTask('session_1', 'non_existent_task');
      }).not.toThrow();
    });
  });

  describe('endSession', () => {
    it('should remove session from registry', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.endSession('session_1');

      expect(registry.getSession('session_1')).toBeUndefined();
      expect(registry.getCount()).toBe(0);
    });

    it('should remove session from user index', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.endSession('session_1');

      const sessions = registry.getSessionsByUser('user_1');
      expect(sessions).toHaveLength(0);
    });

    it('should remove session from channel index', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.endSession('session_1');

      const session = registry.getSessionByChannel('channel_1');
      expect(session).toBeUndefined();
    });

    it('should do nothing for non-existent session', () => {
      expect(() => {
        registry.endSession('non_existent');
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove sessions exceeding max duration', () => {
      // Create a session with old start time
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const session = mustGetSession('session_1');
      session.startTime = Date.now() - SESSION_LIMITS.MAX_SESSION_DURATION_MS - 1000;

      const expired = registry.cleanup();
      expect(expired).toContain('session_1');
      expect(registry.getSession('session_1')).toBeUndefined();
    });

    it('should remove inactive sessions', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const session = mustGetSession('session_1');
      session.lastActivity = Date.now() - SESSION_LIMITS.MAX_INACTIVITY_MS - 1000;

      const expired = registry.cleanup();
      expect(expired).toContain('session_1');
    });

    it('should not remove active sessions', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const session = mustGetSession('session_1');
      session.lastActivity = Date.now(); // Recent activity

      const expired = registry.cleanup();
      expect(expired).toHaveLength(0);
      expect(registry.getSession('session_1')).toBeDefined();
    });

    it('should return list of expired session IDs', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_2');

      const session1 = mustGetSession('session_1');
      session1.lastActivity = Date.now() - SESSION_LIMITS.MAX_INACTIVITY_MS - 1000;

      const session2 = mustGetSession('session_2');
      session2.lastActivity = Date.now() - SESSION_LIMITS.MAX_INACTIVITY_MS - 1000;

      const expired = registry.cleanup();
      expect(expired).toHaveLength(2);
      expect(expired).toContain('session_1');
      expect(expired).toContain('session_2');
    });
  });

  describe('getAllSessions', () => {
    it('should return empty array when no sessions', () => {
      const sessions = registry.getAllSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all sessions', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_2');
      registry.createSession('session_3', 'user_3', 'guild_1', 'channel_3');

      const sessions = registry.getAllSessions();
      expect(sessions).toHaveLength(3);
    });
  });

  describe('getCount', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.getCount()).toBe(0);
    });

    it('should return number of sessions', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      expect(registry.getCount()).toBe(1);

      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_2');
      expect(registry.getCount()).toBe(2);

      registry.endSession('session_1');
      expect(registry.getCount()).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return empty stats for no sessions', () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byState).toEqual({});
      expect(stats.byGuild).toEqual({});
    });

    it('should count sessions by state', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_2');
      registry.updateState('session_1', VoiceConnectionState.CONNECTED);
      registry.updateState('session_2', VoiceConnectionState.CONNECTING);

      const stats = registry.getStats();
      expect(stats.byState[VoiceConnectionState.CONNECTED]).toBe(1);
      expect(stats.byState[VoiceConnectionState.CONNECTING]).toBe(1);
    });

    it('should count sessions by guild', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_2');
      registry.createSession('session_3', 'user_3', 'guild_2', 'channel_1');

      const stats = registry.getStats();
      expect(stats.byGuild['guild_1']).toBe(2);
      expect(stats.byGuild['guild_2']).toBe(1);
    });

    it('should include total count', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      registry.createSession('session_2', 'user_2', 'guild_1', 'channel_2');

      const stats = registry.getStats();
      expect(stats.total).toBe(2);
    });
  });

  describe('metadata', () => {
    it('should store custom metadata', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const session = mustGetSession('session_1');
      session.metadata = { customField: 'customValue', anotherField: 123 };

      const retrieved = registry.getSession('session_1');
      expect(retrieved?.metadata?.customField).toBe('customValue');
      expect(retrieved?.metadata?.anotherField).toBe(123);
    });
  });

  describe('provider-specific fields', () => {
    it('should store provider session ID', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const session = mustGetSession('session_1');
      session.providerSessionId = 'provider_session_123';

      const retrieved = registry.getSession('session_1');
      expect(retrieved?.providerSessionId).toBe('provider_session_123');
    });

    it('should store voice connection ID', () => {
      registry.createSession('session_1', 'user_1', 'guild_1', 'channel_1');
      const session = mustGetSession('session_1');
      session.voiceConnectionId = 'voice_conn_123';

      const retrieved = registry.getSession('session_1');
      expect(retrieved?.voiceConnectionId).toBe('voice_conn_123');
    });
  });
});
