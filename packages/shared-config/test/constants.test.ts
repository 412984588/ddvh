/**
 * Tests for shared constants
 */

import { describe, it, expect } from 'vitest';
import {
  AUDIO_CONSTANTS,
  PROTOCOL_IDENTIFIERS,
  ERROR_CODES,
  INTENT_MAP,
  DEFAULT_HEADERS,
  MEMORY_DEFAULTS,
  SESSION_LIMITS,
  RETRY_CONFIG,
} from '../src/config/index.js';
import { ToolIntent } from '../src/types/index.js';

describe('AUDIO_CONSTANTS', () => {
  it('should have Discord sample rate of 48kHz', () => {
    expect(AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE).toBe(48000);
  });

  it('should have Discord stereo channels', () => {
    expect(AUDIO_CONSTANTS.DISCORD_CHANNELS).toBe(2);
  });

  it('should have Discord frame size of 960', () => {
    expect(AUDIO_CONSTANTS.DISCORD_FRAME_SIZE).toBe(960);
  });

  it('should have Omni sample rate of 16kHz', () => {
    expect(AUDIO_CONSTANTS.OMNI_SAMPLE_RATE).toBe(16000);
  });

  it('should have Omni mono channel', () => {
    expect(AUDIO_CONSTANTS.OMNI_CHANNELS).toBe(1);
  });

  it('should have buffer sizes', () => {
    expect(AUDIO_CONSTANTS.INPUT_BUFFER_SIZE).toBe(4096);
    expect(AUDIO_CONSTANTS.OUTPUT_BUFFER_SIZE).toBe(8192);
  });

  it('should have timing constants', () => {
    expect(AUDIO_CONSTANTS.HEARTBEAT_INTERVAL_MS).toBe(30000);
    expect(AUDIO_CONSTANTS.SILENCE_THRESHOLD_MS).toBe(1000);
    expect(AUDIO_CONSTANTS.SESSION_TIMEOUT_MS).toBe(300000);
  });
});

describe('PROTOCOL_IDENTIFIERS', () => {
  it('should have Volcengine Omni identifier', () => {
    expect(PROTOCOL_IDENTIFIERS.VOLCENGINE_OMNI).toBe('volcengine-omni-v1');
  });

  it('should have backend dispatch identifier', () => {
    expect(PROTOCOL_IDENTIFIERS.BACKEND_DISPATCH).toBe('backend-dispatch-v1');
  });

  it('should have memory bank identifier', () => {
    expect(PROTOCOL_IDENTIFIERS.MEMORY_BANK).toBe('memory-bank-v1');
  });
});

describe('ERROR_CODES', () => {
  it('should have Discord error codes with DISC_ prefix', () => {
    expect(ERROR_CODES.DISC_CONNECTION_FAILED).toBe('DISC_001');
    expect(ERROR_CODES.DISC_AUTH_FAILED).toBe('DISC_002');
    expect(ERROR_CODES.DISC_AUDIO_DECRYPT_FAILED).toBe('DISC_003');
  });

  it('should have Provider error codes with PROV_ prefix', () => {
    expect(ERROR_CODES.PROV_CONNECTION_FAILED).toBe('PROV_001');
    expect(ERROR_CODES.PROV_HANDSHAKE_FAILED).toBe('PROV_002');
    expect(ERROR_CODES.PROV_HEARTBEAT_FAILED).toBe('PROV_003');
    expect(ERROR_CODES.PROV_PARSE_ERROR).toBe('PROV_004');
  });

  it('should have Backend error codes with BACK_ prefix', () => {
    expect(ERROR_CODES.BACK_DISPATCH_FAILED).toBe('BACK_001');
    expect(ERROR_CODES.BACK_WEBHOOK_VERIFY_FAILED).toBe('BACK_002');
    expect(ERROR_CODES.BACK_TIMEOUT).toBe('BACK_003');
  });

  it('should have Memory error codes with MEM_ prefix', () => {
    expect(ERROR_CODES.MEM_QUERY_FAILED).toBe('MEM_001');
    expect(ERROR_CODES.MEM_INSERT_FAILED).toBe('MEM_002');
  });

  it('should have Audio error codes with AUD_ prefix', () => {
    expect(ERROR_CODES.AUD_RESAMPLE_FAILED).toBe('AUD_001');
    expect(ERROR_CODES.AUD_PACKETIZE_FAILED).toBe('AUD_002');
    expect(ERROR_CODES.AUD_PLAYBACK_FAILED).toBe('AUD_003');
  });

  it('should have Generic error codes with GEN_ prefix', () => {
    expect(ERROR_CODES.UNKNOWN_ERROR).toBe('GEN_000');
    expect(ERROR_CODES.INVALID_CONFIG).toBe('GEN_001');
    expect(ERROR_CODES.NOT_IMPLEMENTED).toBe('GEN_002');
  });
});

describe('INTENT_MAP', () => {
  it('should map code_generation to backend dispatch', () => {
    expect(INTENT_MAP.code_generation).toBe(ToolIntent.DISPATCH_TASK_TO_BACKEND);
  });

  it('should map debug_problem to backend dispatch', () => {
    expect(INTENT_MAP.debug_problem).toBe(ToolIntent.DISPATCH_TASK_TO_BACKEND);
  });

  it('should map code_review to backend dispatch', () => {
    expect(INTENT_MAP.code_review).toBe(ToolIntent.DISPATCH_TASK_TO_BACKEND);
  });

  it('should map test_generation to backend dispatch', () => {
    expect(INTENT_MAP.test_generation).toBe(ToolIntent.DISPATCH_TASK_TO_BACKEND);
  });

  it('should map refactoring to backend dispatch', () => {
    expect(INTENT_MAP.refactoring).toBe(ToolIntent.DISPATCH_TASK_TO_BACKEND);
  });

  it('should map documentation to backend dispatch', () => {
    expect(INTENT_MAP.documentation).toBe(ToolIntent.DISPATCH_TASK_TO_BACKEND);
  });
});

describe('DEFAULT_HEADERS', () => {
  it('should have User-Agent header', () => {
    expect(DEFAULT_HEADERS['User-Agent']).toBe('@voice-hub/bridge-daemon v0.1.0');
  });

  it('should have Content-Type header', () => {
    expect(DEFAULT_HEADERS['Content-Type']).toBe('application/json');
  });

  it('should have Accept header', () => {
    expect(DEFAULT_HEADERS.Accept).toBe('application/json');
  });
});

describe('MEMORY_DEFAULTS', () => {
  it('should have max pitfalls returned', () => {
    expect(MEMORY_DEFAULTS.MAX_PITFALLS_RETURNED).toBe(5);
  });

  it('should have max patterns returned', () => {
    expect(MEMORY_DEFAULTS.MAX_PATTERNS_RETURNED).toBe(5);
  });

  it('should have max history days', () => {
    expect(MEMORY_DEFAULTS.MAX_HISTORY_DAYS).toBe(30);
  });

  it('should have similarity threshold', () => {
    expect(MEMORY_DEFAULTS.SIMILARITY_THRESHOLD).toBe(0.7);
  });
});

describe('SESSION_LIMITS', () => {
  it('should have max concurrent sessions', () => {
    expect(SESSION_LIMITS.MAX_CONCURRENT_SESSIONS).toBe(100);
  });

  it('should have max session duration of 1 hour', () => {
    expect(SESSION_LIMITS.MAX_SESSION_DURATION_MS).toBe(3600000);
  });

  it('should have max inactivity of 10 minutes', () => {
    expect(SESSION_LIMITS.MAX_INACTIVITY_MS).toBe(600000);
  });
});

describe('RETRY_CONFIG', () => {
  it('should have max attempts', () => {
    expect(RETRY_CONFIG.MAX_ATTEMPTS).toBe(3);
  });

  it('should have initial delay', () => {
    expect(RETRY_CONFIG.INITIAL_DELAY_MS).toBe(1000);
  });

  it('should have max delay', () => {
    expect(RETRY_CONFIG.MAX_DELAY_MS).toBe(10000);
  });

  it('should have backoff multiplier', () => {
    expect(RETRY_CONFIG.BACKOFF_MULTIPLIER).toBe(2);
  });

  it('should calculate retry delays correctly', () => {
    // With exponential backoff: 1000, 2000, 4000, 8000, 10000 (capped)
    const delays: number[] = [];
    let delay = RETRY_CONFIG.INITIAL_DELAY_MS;
    for (let i = 0; i < 5; i++) {
      delays.push(delay);
      delay = Math.min(delay * RETRY_CONFIG.BACKOFF_MULTIPLIER, RETRY_CONFIG.MAX_DELAY_MS);
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 10000]);
  });
});
