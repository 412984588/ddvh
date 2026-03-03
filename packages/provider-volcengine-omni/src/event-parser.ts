/**
 * Event parser for Volcengine Omni WebSocket messages
 */

import pino from 'pino';
import { parseServerMessage, type ServerMessage, OmniMessageType } from './protocol.js';
import { ProviderEvent, type ProviderEventPayload } from './types.js';

const logger = pino({ name: 'OmniEventParser' });

/**
 * Parsed event with type and payload
 */
export interface ParsedEvent {
  eventType: ProviderEvent;
  payload: ProviderEventPayload[ProviderEvent];
}

/**
 * Parse raw WebSocket message into provider event
 */
export function parseOmniEvent(data: string, _sessionId: string): ParsedEvent | null {
  try {
    const message = parseServerMessage(data);

    switch (message.type) {
      case OmniMessageType.SESSION_STARTED:
        return {
          eventType: ProviderEvent.SESSION_START,
          payload: {
            sessionId: message.payload.sessionId,
            config: message.payload,
          },
        };

      case OmniMessageType.AUDIO_RESPONSE:
        return {
          eventType: ProviderEvent.AUDIO_RECEIVED,
          payload: {
            sessionId: message.payload.sessionId,
            data: Buffer.from(message.payload.data, 'base64'),
            transcript: message.payload.transcript,
            isFinal: message.payload.isFinal,
          },
        };

      case OmniMessageType.TOOL_CALL:
        return {
          eventType: ProviderEvent.TOOL_CALL,
          payload: {
            sessionId: message.payload.sessionId,
            toolId: message.payload.toolId,
            toolName: message.payload.toolName,
            parameters: message.payload.parameters,
          },
        };

      case OmniMessageType.ERROR:
        return {
          eventType: ProviderEvent.ERROR,
          payload: {
            code: message.payload.code,
            message: message.payload.message,
          },
        };

      case OmniMessageType.HEARTBEAT_ACK:
        return {
          eventType: ProviderEvent.HEARTBEAT,
          payload: {
            timestamp: message.payload.timestamp,
            latency: message.payload.serverTime - message.payload.timestamp,
          },
        };

      default:
        logger.warn({ type: (message as ServerMessage).type }, 'Unknown message type');
        return null;
    }
  } catch (error) {
    logger.error({ error, data }, 'Failed to parse Omni event');
    return {
      eventType: ProviderEvent.ERROR,
      payload: {
        code: 'PARSE_ERROR',
        message: `Failed to parse message: ${error}`,
      },
    };
  }
}

/**
 * Validate audio frame before sending
 */
export function validateAudioFrame(data: Buffer, sampleRate: number, channels: number): boolean {
  // Basic validation
  if (data.length === 0) {
    logger.warn('Empty audio frame');
    return false;
  }

  // Check if data size matches expected for PCM16
  const bytesPerSample = 2;
  const expectedSamples = data.length / (bytesPerSample * channels);
  const expectedDuration = (expectedSamples / sampleRate) * 1000; // ms

  // Warn if frame size is unusual (should be ~20ms)
  if (expectedDuration < 10 || expectedDuration > 100) {
    logger.warn(
      {
        duration: expectedDuration,
        sampleRate,
        channels,
        dataSize: data.length,
      },
      'Unusual audio frame duration'
    );
  }

  return true;
}

/**
 * Encode audio frame for transmission
 */
export function encodeAudioFrame(data: Buffer, _sampleRate: number, _channels: number): string {
  return data.toString('base64');
}

/**
 * Decode received audio data
 */
export function decodeAudioData(base64Data: string): Buffer {
  return Buffer.from(base64Data, 'base64');
}
