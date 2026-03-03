/**
 * Environment variable schema using Zod
 */

import { z } from 'zod';

/**
 * Discord configuration schema
 */
export const DiscordConfigSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'Discord bot token is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'Discord client ID is required'),
  DISCORD_GUILD_ID: z.string().optional(),
});

/**
 * Volcengine Omni configuration schema
 */
export const VolcengineConfigSchema = z.object({
  VOLCENGINE_OMNI_ENDPOINT: z.string().url('Invalid Omni endpoint'),
  VOLCENGINE_OMNI_API_KEY: z.string().min(1, 'Omni API key is required'),
  VOLCENGINE_OMNI_MODEL: z.string().default('omni-realtime-v1'),
});

/**
 * Backend dispatcher configuration schema
 */
export const BackendConfigSchema = z.object({
  BACKEND_DISPATCH_ENDPOINT: z.string().url('Invalid backend dispatch endpoint'),
  BACKEND_WEBHOOK_SECRET: z.string().min(1, 'Webhook secret is required'),
  BACKEND_WEBHOOK_PORT: z.coerce.number().int().min(1).max(65535).default(8866),
});

/**
 * Audio configuration schema
 */
export const AudioConfigSchema = z.object({
  AUDIO_SAMPLE_RATE: z.coerce.number().int().positive().default(16000),
  AUDIO_CHANNELS: z.coerce.number().int().min(1).max(2).default(1),
  AUDIO_FRAME_DURATION_MS: z.coerce.number().int().positive().default(200),
});

/**
 * Memory bank configuration schema
 */
export const MemoryConfigSchema = z.object({
  MEMORY_DB_PATH: z.string().default('./data/memory.db'),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY_PRINT: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),
});

/**
 * Plugin configuration schema
 */
export const PluginConfigSchema = z.object({
  OPENCLAW_PLUGIN_HOME: z.string().default('~/.openclaw/plugins/voice-hub'),
  CLAUDE_MARKETPLACE_HOME: z.string().default('~/.claude/marketplace/voice-hub'),
});

/**
 * Complete environment schema
 */
export const EnvSchema = z.object({
  // Discord
  DISCORD_BOT_TOKEN: z.string(),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_GUILD_ID: z.string().optional(),

  // Volcengine
  VOLCENGINE_OMNI_ENDPOINT: z.string(),
  VOLCENGINE_OMNI_API_KEY: z.string(),
  VOLCENGINE_OMNI_MODEL: z.string().default('omni-realtime-v1'),

  // Backend
  BACKEND_DISPATCH_ENDPOINT: z.string(),
  BACKEND_WEBHOOK_SECRET: z.string(),
  BACKEND_WEBHOOK_PORT: z.coerce.number().int().min(1).max(65535).default(8866),

  // Audio
  AUDIO_SAMPLE_RATE: z.coerce.number().int().positive().default(16000),
  AUDIO_CHANNELS: z.coerce.number().int().min(1).max(2).default(1),
  AUDIO_FRAME_DURATION_MS: z.coerce.number().int().positive().default(200),

  // Memory
  MEMORY_DB_PATH: z.string().default('./data/memory.db'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY_PRINT: z
    .enum(['true', 'false', 'TRUE', 'FALSE'])
    .transform((v) => v.toLowerCase() === 'true')
    .default('true'),

  // Plugin
  OPENCLAW_PLUGIN_HOME: z.string().default('~/.openclaw/plugins/voice-hub'),
  CLAUDE_MARKETPLACE_HOME: z.string().default('~/.claude/marketplace/voice-hub'),
});

/**
 * Parsed configuration type
 */
export type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Subset config types
 */
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;
export type VolcengineConfig = z.infer<typeof VolcengineConfigSchema>;
export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type AudioConfig = z.infer<typeof AudioConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * Validate and parse environment variables
 */
export function validateEnv(env: Record<string, unknown> = process.env): EnvConfig {
  return EnvSchema.parse(env);
}

/**
 * Safe validation that returns result instead of throwing
 */
export function safeValidateEnv(
  env: Record<string, unknown> = process.env
): z.SafeParseReturnType<unknown, EnvConfig> {
  return EnvSchema.safeParse(env);
}
