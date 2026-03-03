/**
 * Tests for shared type definitions
 */

import { describe, it, expect } from 'vitest';
import {
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
  ChannelType,
  VoiceConnectionState,
  AudioFrame,
  SessionState,
  BackendTask,
  TaskContext,
  Pitfall,
  SuccessfulPattern,
  TaskRun,
  BackendResult,
  ToolIntent,
  ToolResult,
  BargeInState,
  AudioPacket,
  ProviderEventType,
} from '../src/types/index.js';

describe('Discord Types', () => {
  describe('DiscordUser', () => {
    it('should create a valid Discord user', () => {
      const user: DiscordUser = {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'avatar_hash',
      };
      expect(user.id).toBe('123456789');
      expect(user.username).toBe('testuser');
      expect(user.discriminator).toBe('0001');
      expect(user.avatar).toBe('avatar_hash');
    });

    it('should allow optional avatar', () => {
      const user: DiscordUser = {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
      };
      expect(user.avatar).toBeUndefined();
    });
  });

  describe('DiscordGuild', () => {
    it('should create a valid Discord guild', () => {
      const guild: DiscordGuild = {
        id: 'guild_id',
        name: 'Test Server',
        icon: 'icon_hash',
      };
      expect(guild.id).toBe('guild_id');
      expect(guild.name).toBe('Test Server');
      expect(guild.icon).toBe('icon_hash');
    });
  });

  describe('DiscordChannel', () => {
    it('should create a valid Discord channel', () => {
      const channel: DiscordChannel = {
        id: 'channel_id',
        name: 'general',
        type: ChannelType.GUILD_TEXT,
        guildId: 'guild_id',
      };
      expect(channel.id).toBe('channel_id');
      expect(channel.name).toBe('general');
      expect(channel.type).toBe(ChannelType.GUILD_TEXT);
    });

    it('should accept voice channel type', () => {
      const channel: DiscordChannel = {
        id: 'channel_id',
        name: 'voice-general',
        type: ChannelType.GUILD_VOICE,
        guildId: 'guild_id',
      };
      expect(channel.type).toBe(ChannelType.GUILD_VOICE);
    });
  });

  describe('ChannelType', () => {
    it('should have correct enum values', () => {
      expect(ChannelType.GUILD_TEXT).toBe(0);
      expect(ChannelType.GUILD_VOICE).toBe(2);
      expect(ChannelType.GUILD_STAGE_CHANNEL).toBe(13);
    });
  });
});

describe('Voice Connection Types', () => {
  describe('VoiceConnectionState', () => {
    it('should have correct state values', () => {
      expect(VoiceConnectionState.IDLE).toBe('idle');
      expect(VoiceConnectionState.CONNECTING).toBe('connecting');
      expect(VoiceConnectionState.CONNECTED).toBe('connected');
      expect(VoiceConnectionState.DISCONNECTING).toBe('disconnecting');
      expect(VoiceConnectionState.DISCONNECTED).toBe('disconnected');
      expect(VoiceConnectionState.ERROR).toBe('error');
    });
  });

  describe('BargeInState', () => {
    it('should have correct state values', () => {
      expect(BargeInState.IDLE).toBe('idle');
      expect(BargeInState.LISTENING).toBe('listening');
      expect(BargeInState.INTERRUPTING).toBe('interrupting');
      expect(BargeInState.RECOVERING).toBe('recovering');
    });
  });
});

describe('Audio Types', () => {
  describe('AudioFrame', () => {
    it('should create a valid audio frame', () => {
      const frame: AudioFrame = {
        data: Buffer.from([0x00, 0x01, 0x02]),
        sampleRate: 48000,
        channels: 2,
        timestamp: Date.now(),
      };
      expect(frame.data.length).toBe(3);
      expect(frame.sampleRate).toBe(48000);
      expect(frame.channels).toBe(2);
      expect(frame.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('AudioPacket', () => {
    it('should create a valid audio packet', () => {
      const frame: AudioFrame = {
        data: Buffer.from([0x00, 0x01]),
        sampleRate: 48000,
        channels: 2,
        timestamp: Date.now(),
      };
      const packet: AudioPacket = {
        frames: [frame],
        packetId: 'packet_1',
        timestamp: Date.now(),
        duration: 200,
      };
      expect(packet.frames.length).toBe(1);
      expect(packet.packetId).toBe('packet_1');
      expect(packet.duration).toBe(200);
    });
  });
});

describe('Session Types', () => {
  describe('SessionState', () => {
    it('should create a valid session state', () => {
      const now = Date.now();
      const session: SessionState = {
        sessionId: 'session_1',
        userId: 'user_1',
        guildId: 'guild_1',
        channelId: 'channel_1',
        state: VoiceConnectionState.CONNECTED,
        startTime: now,
        lastActivity: now,
        metadata: { key: 'value' },
      };
      expect(session.sessionId).toBe('session_1');
      expect(session.state).toBe(VoiceConnectionState.CONNECTED);
      expect(session.metadata?.key).toBe('value');
    });
  });
});

describe('Task Types', () => {
  describe('BackendTask', () => {
    it('should create a valid backend task', () => {
      const task: BackendTask = {
        taskId: 'task_1',
        sessionId: 'session_1',
        intent: 'code_generation',
        prompt: 'Write a function',
        createdAt: Date.now(),
      };
      expect(task.taskId).toBe('task_1');
      expect(task.intent).toBe('code_generation');
    });
  });

  describe('TaskContext', () => {
    it('should create a valid task context', () => {
      const pitfall: Pitfall = {
        id: 'pitfall_1',
        category: 'error',
        description: 'Common error',
        symptoms: ['symptom1'],
        solution: 'solution',
        keywords: ['keyword1'],
        severity: 'high',
        createdAt: Date.now(),
      };
      const pattern: SuccessfulPattern = {
        id: 'pattern_1',
        category: 'success',
        description: 'Successful pattern',
        approach: 'approach',
        keywords: ['keyword1'],
        effectiveness: 0.9,
        createdAt: Date.now(),
      };
      const run: TaskRun = {
        id: 'run_1',
        sessionId: 'session_1',
        intent: 'code_generation',
        prompt: 'Write a function',
        result: 'success',
        duration: 1000,
        success: true,
        createdAt: Date.now(),
      };
      const context: TaskContext = {
        pitfalls: [pitfall],
        successfulPatterns: [pattern],
        previousRuns: [run],
      };
      expect(context.pitfalls?.length).toBe(1);
      expect(context.successfulPatterns?.length).toBe(1);
      expect(context.previousRuns?.length).toBe(1);
    });
  });

  describe('Pitfall', () => {
    it('should accept all severity levels', () => {
      const severities: Array<Pitfall['severity']> = ['low', 'medium', 'high'];
      for (const severity of severities) {
        const pitfall: Pitfall = {
          id: 'pitfall_1',
          category: 'error',
          description: 'Error',
          symptoms: [],
          solution: 'Fix',
          keywords: [],
          severity,
          createdAt: Date.now(),
        };
        expect(pitfall.severity).toBe(severity);
      }
    });
  });

  describe('TaskRun', () => {
    it('should create successful run', () => {
      const run: TaskRun = {
        id: 'run_1',
        sessionId: 'session_1',
        intent: 'code_generation',
        prompt: 'Write a function',
        result: 'success',
        duration: 1000,
        success: true,
        createdAt: Date.now(),
      };
      expect(run.success).toBe(true);
      expect(run.result).toBe('success');
      expect(run.error).toBeUndefined();
    });

    it('should create failed run', () => {
      const run: TaskRun = {
        id: 'run_1',
        sessionId: 'session_1',
        intent: 'code_generation',
        prompt: 'Write a function',
        error: 'Failed',
        duration: 1000,
        success: false,
        createdAt: Date.now(),
      };
      expect(run.success).toBe(false);
      expect(run.error).toBe('Failed');
      expect(run.result).toBeUndefined();
    });
  });

  describe('BackendResult', () => {
    it('should create successful result', () => {
      const result: BackendResult = {
        taskId: 'task_1',
        sessionId: 'session_1',
        success: true,
        result: 'Generated code',
        completedAt: Date.now(),
      };
      expect(result.success).toBe(true);
      expect(result.result).toBe('Generated code');
    });

    it('should create failed result', () => {
      const result: BackendResult = {
        taskId: 'task_1',
        sessionId: 'session_1',
        success: false,
        error: 'Generation failed',
        completedAt: Date.now(),
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Generation failed');
    });
  });
});

describe('Tool Types', () => {
  describe('ToolIntent', () => {
    it('should have dispatch task intent', () => {
      expect(ToolIntent.DISPATCH_TASK_TO_BACKEND).toBe('dispatch_task_to_backend');
    });
  });

  describe('ToolResult', () => {
    it('should create successful tool result', () => {
      const result: ToolResult = {
        intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
        success: true,
        data: { key: 'value' },
      };
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.error).toBeUndefined();
    });

    it('should create failed tool result', () => {
      const result: ToolResult = {
        intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
        success: false,
        error: 'Tool failed',
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool failed');
      expect(result.data).toBeUndefined();
    });
  });
});

describe('Provider Types', () => {
  describe('ProviderEventType', () => {
    it('should have all event types', () => {
      expect(ProviderEventType.SESSION_START).toBe('session_start');
      expect(ProviderEventType.SESSION_END).toBe('session_end');
      expect(ProviderEventType.AUDIO_RECEIVED).toBe('audio_received');
      expect(ProviderEventType.TOOL_CALL).toBe('tool_call');
      expect(ProviderEventType.ERROR).toBe('error');
      expect(ProviderEventType.HEARTBEAT).toBe('heartbeat');
    });
  });
});
