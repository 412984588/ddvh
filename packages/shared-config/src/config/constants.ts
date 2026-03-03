/**
 * Application-wide constants
 */

import { ToolIntent } from '../types/index.js';

/**
 * Audio processing constants
 */
export const AUDIO_CONSTANTS = {
  // Discord native audio settings
  DISCORD_SAMPLE_RATE: 48000,
  DISCORD_CHANNELS: 2, // Stereo
  DISCORD_FRAME_SIZE: 960, // 20ms at 48kHz stereo

  // Target format for Omni
  OMNI_SAMPLE_RATE: 16000,
  OMNI_CHANNELS: 1, // Mono

  // Buffer sizes
  INPUT_BUFFER_SIZE: 4096,
  OUTPUT_BUFFER_SIZE: 8192,

  // Timing
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  SILENCE_THRESHOLD_MS: 1000, // 1 second of silence
  SESSION_TIMEOUT_MS: 300000, // 5 minutes
} as const;

/**
 * Protocol identifiers
 */
export const PROTOCOL_IDENTIFIERS = {
  VOLCENGINE_OMNI: 'volcengine-omni-v1',
  BACKEND_DISPATCH: 'backend-dispatch-v1',
  MEMORY_BANK: 'memory-bank-v1',
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  // Discord errors (DISC_xxx)
  DISC_CONNECTION_FAILED: 'DISC_001',
  DISC_AUTH_FAILED: 'DISC_002',
  DISC_AUDIO_DECRYPT_FAILED: 'DISC_003',

  // Provider errors (PROV_xxx)
  PROV_CONNECTION_FAILED: 'PROV_001',
  PROV_HANDSHAKE_FAILED: 'PROV_002',
  PROV_HEARTBEAT_FAILED: 'PROV_003',
  PROV_PARSE_ERROR: 'PROV_004',

  // Backend errors (BACK_xxx)
  BACK_DISPATCH_FAILED: 'BACK_001',
  BACK_WEBHOOK_VERIFY_FAILED: 'BACK_002',
  BACK_TIMEOUT: 'BACK_003',

  // Memory errors (MEM_xxx)
  MEM_QUERY_FAILED: 'MEM_001',
  MEM_INSERT_FAILED: 'MEM_002',

  // Audio errors (AUD_xxx)
  AUD_RESAMPLE_FAILED: 'AUD_001',
  AUD_PACKETIZE_FAILED: 'AUD_002',
  AUD_PLAYBACK_FAILED: 'AUD_003',

  // Generic errors
  UNKNOWN_ERROR: 'GEN_000',
  INVALID_CONFIG: 'GEN_001',
  NOT_IMPLEMENTED: 'GEN_002',
} as const;

/**
 * Intents mapping
 */
export const INTENT_MAP: Record<string, ToolIntent> = {
  // Development task intents that should be dispatched to backend
  code_generation: ToolIntent.DISPATCH_TASK_TO_BACKEND,
  debug_problem: ToolIntent.DISPATCH_TASK_TO_BACKEND,
  code_review: ToolIntent.DISPATCH_TASK_TO_BACKEND,
  test_generation: ToolIntent.DISPATCH_TASK_TO_BACKEND,
  refactoring: ToolIntent.DISPATCH_TASK_TO_BACKEND,
  documentation: ToolIntent.DISPATCH_TASK_TO_BACKEND,

  // Future intents can be added here
} as const;

/**
 * Default headers for HTTP requests
 */
export const DEFAULT_HEADERS = {
  'User-Agent': '@voice-hub/bridge-daemon v0.1.0',
  'Content-Type': 'application/json',
  Accept: 'application/json',
} as const;

/**
 * Memory bank defaults
 */
export const MEMORY_DEFAULTS = {
  MAX_PITFALLS_RETURNED: 5,
  MAX_PATTERNS_RETURNED: 5,
  MAX_HISTORY_DAYS: 30,
  SIMILARITY_THRESHOLD: 0.7,
} as const;

/**
 * Session limits
 */
export const SESSION_LIMITS = {
  MAX_CONCURRENT_SESSIONS: 100,
  MAX_SESSION_DURATION_MS: 3600000, // 1 hour
  MAX_INACTIVITY_MS: 600000, // 10 minutes
} as const;

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;
