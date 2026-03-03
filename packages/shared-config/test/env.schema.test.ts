/**
 * Tests for environment schema validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvSchema,
  DiscordConfigSchema,
  VolcengineConfigSchema,
  BackendConfigSchema,
  AudioConfigSchema,
  MemoryConfigSchema,
  LoggingConfigSchema,
  PluginConfigSchema,
  validateEnv,
  safeValidateEnv,
} from '../src/config/index.js';

describe('Environment Schema Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('DiscordConfigSchema', () => {
    it('should validate valid Discord config', () => {
      const result = DiscordConfigSchema.safeParse({
        DISCORD_BOT_TOKEN: 'test_token_123',
        DISCORD_CLIENT_ID: 'test_client_id',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing bot token', () => {
      const result = DiscordConfigSchema.safeParse({
        DISCORD_CLIENT_ID: 'test_client_id',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing client ID', () => {
      const result = DiscordConfigSchema.safeParse({
        DISCORD_BOT_TOKEN: 'test_token_123',
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional guild ID', () => {
      const result = DiscordConfigSchema.safeParse({
        DISCORD_BOT_TOKEN: 'test_token_123',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: 'test_guild_id',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('VolcengineConfigSchema', () => {
    it('should validate valid Volcengine config', () => {
      const result = VolcengineConfigSchema.safeParse({
        VOLCENGINE_OMNI_ENDPOINT: 'wss://omni.example.com',
        VOLCENGINE_OMNI_API_KEY: 'test_api_key',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = VolcengineConfigSchema.safeParse({
        VOLCENGINE_OMNI_ENDPOINT: 'not-a-url',
        VOLCENGINE_OMNI_API_KEY: 'test_api_key',
      });
      expect(result.success).toBe(false);
    });

    it('should use default model value', () => {
      const result = VolcengineConfigSchema.safeParse({
        VOLCENGINE_OMNI_ENDPOINT: 'wss://omni.example.com',
        VOLCENGINE_OMNI_API_KEY: 'test_api_key',
      });
      if (result.success) {
        expect(result.data.VOLCENGINE_OMNI_MODEL).toBe('omni-realtime-v1');
      }
    });
  });

  describe('BackendConfigSchema', () => {
    it('should validate valid backend config', () => {
      const result = BackendConfigSchema.safeParse({
        BACKEND_DISPATCH_ENDPOINT: 'https://backend.example.com/dispatch',
        BACKEND_WEBHOOK_SECRET: 'secret123',
      });
      expect(result.success).toBe(true);
    });

    it('should use default webhook port', () => {
      const result = BackendConfigSchema.safeParse({
        BACKEND_DISPATCH_ENDPOINT: 'https://backend.example.com/dispatch',
        BACKEND_WEBHOOK_SECRET: 'secret123',
      });
      if (result.success) {
        expect(result.data.BACKEND_WEBHOOK_PORT).toBe(8866);
      }
    });

    it('should reject port out of range', () => {
      const result = BackendConfigSchema.safeParse({
        BACKEND_DISPATCH_ENDPOINT: 'https://backend.example.com/dispatch',
        BACKEND_WEBHOOK_SECRET: 'secret123',
        BACKEND_WEBHOOK_PORT: 99999,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AudioConfigSchema', () => {
    it('should validate valid audio config', () => {
      const result = AudioConfigSchema.safeParse({
        AUDIO_SAMPLE_RATE: 16000,
        AUDIO_CHANNELS: 1,
        AUDIO_FRAME_DURATION_MS: 200,
      });
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const result = AudioConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AUDIO_SAMPLE_RATE).toBe(16000);
        expect(result.data.AUDIO_CHANNELS).toBe(1);
        expect(result.data.AUDIO_FRAME_DURATION_MS).toBe(200);
      }
    });

    it('should reject invalid sample rate', () => {
      const result = AudioConfigSchema.safeParse({
        AUDIO_SAMPLE_RATE: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject channels > 2', () => {
      const result = AudioConfigSchema.safeParse({
        AUDIO_CHANNELS: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoggingConfigSchema', () => {
    it('should validate valid log levels', () => {
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
      for (const level of levels) {
        const result = LoggingConfigSchema.safeParse({
          LOG_LEVEL: level,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid log level', () => {
      const result = LoggingConfigSchema.safeParse({
        LOG_LEVEL: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should transform "true" to boolean true', () => {
      const result = LoggingConfigSchema.safeParse({
        LOG_PRETTY_PRINT: 'true',
      });
      if (result.success) {
        expect(result.data.LOG_PRETTY_PRINT).toBe(true);
      }
    });

    it('should transform "false" to boolean false', () => {
      const result = LoggingConfigSchema.safeParse({
        LOG_PRETTY_PRINT: 'false',
      });
      if (result.success) {
        expect(result.data.LOG_PRETTY_PRINT).toBe(false);
      }
    });
  });

  describe('MemoryConfigSchema', () => {
    it('should use default database path', () => {
      const result = MemoryConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MEMORY_DB_PATH).toBe('./data/memory.db');
      }
    });

    it('should accept custom database path', () => {
      const result = MemoryConfigSchema.safeParse({
        MEMORY_DB_PATH: '/custom/path.db',
      });
      if (result.success) {
        expect(result.data.MEMORY_DB_PATH).toBe('/custom/path.db');
      }
    });
  });

  describe('PluginConfigSchema', () => {
    it('should use default plugin paths', () => {
      const result = PluginConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.OPENCLAW_PLUGIN_HOME).toBe('~/.openclaw/plugins/voice-hub');
        expect(result.data.CLAUDE_MARKETPLACE_HOME).toBe('~/.claude/marketplace/voice-hub');
      }
    });
  });

  describe('EnvSchema - Complete validation', () => {
    const validEnv = {
      DISCORD_BOT_TOKEN: 'test_token',
      DISCORD_CLIENT_ID: 'test_client',
      VOLCENGINE_OMNI_ENDPOINT: 'wss://omni.example.com',
      VOLCENGINE_OMNI_API_KEY: 'test_api_key',
      BACKEND_DISPATCH_ENDPOINT: 'https://backend.example.com/dispatch',
      BACKEND_WEBHOOK_SECRET: 'secret123',
    };

    it('should validate complete environment', () => {
      const result = EnvSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
    });

    it('should use all default values for optional fields', () => {
      const result = EnvSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AUDIO_SAMPLE_RATE).toBe(16000);
        expect(result.data.AUDIO_CHANNELS).toBe(1);
        expect(result.data.AUDIO_FRAME_DURATION_MS).toBe(200);
        expect(result.data.LOG_LEVEL).toBe('info');
        expect(result.data.BACKEND_WEBHOOK_PORT).toBe(8866);
      }
    });
  });

  describe('validateEnv function', () => {
    it('should throw on invalid environment', () => {
      expect(() => {
        validateEnv({ INVALID: 'value' });
      }).toThrow();
    });

    it('should return parsed config on valid environment', () => {
      const config = validateEnv({
        DISCORD_BOT_TOKEN: 'test_token',
        DISCORD_CLIENT_ID: 'test_client',
        VOLCENGINE_OMNI_ENDPOINT: 'wss://omni.example.com',
        VOLCENGINE_OMNI_API_KEY: 'test_api_key',
        BACKEND_DISPATCH_ENDPOINT: 'https://backend.example.com/dispatch',
        BACKEND_WEBHOOK_SECRET: 'secret123',
      });
      expect(config).toHaveProperty('DISCORD_BOT_TOKEN', 'test_token');
    });
  });

  describe('safeValidateEnv function', () => {
    it('should return success: true for valid env', () => {
      const result = safeValidateEnv({
        DISCORD_BOT_TOKEN: 'test_token',
        DISCORD_CLIENT_ID: 'test_client',
        VOLCENGINE_OMNI_ENDPOINT: 'wss://omni.example.com',
        VOLCENGINE_OMNI_API_KEY: 'test_api_key',
        BACKEND_DISPATCH_ENDPOINT: 'https://backend.example.com/dispatch',
        BACKEND_WEBHOOK_SECRET: 'secret123',
      });
      expect(result.success).toBe(true);
    });

    it('should return success: false for invalid env', () => {
      const result = safeValidateEnv({ INVALID: 'value' });
      expect(result.success).toBe(false);
    });

    it('should return error details on failure', () => {
      const result = safeValidateEnv({ INVALID: 'value' });
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.issues).toBeInstanceOf(Array);
      }
    });
  });
});
