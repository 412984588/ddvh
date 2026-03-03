/**
 * AudioIngressPump - Handles inbound audio from Discord
 *
 * Responsibilities:
 * - Receives audio packets from Discord voice connection
 * - Decrypts and decodes Opus frames
 * - Buffers frames for packetization
 * - Triggers packetizer when buffer threshold is reached
 */

import type { Readable } from 'node:stream';
import pino from 'pino';
import { Packetizer } from './Packetizer.js';
import { Resampler } from './Resampler.js';
import { DiscordReceiveWatchdog } from './DiscordReceiveWatchdog.js';
import { AUDIO_CONSTANTS } from '@voice-hub/shared-config';

const logger = pino({ name: 'AudioIngressPump' });

export interface AudioIngressConfig {
  packetizer: Packetizer;
  targetSampleRate: number;
  targetChannels: number;
  frameDurationMs: number;
}

/**
 * Audio ingress pump for processing Discord inbound audio
 */
export class AudioIngressPump {
  private readonly packetizer: Packetizer;
  private readonly resampler: Resampler;
  private readonly watchdog: DiscordReceiveWatchdog;
  private readonly targetFrameDurationMs: number;
  private activeStream: Readable | null = null;
  private isRunning = false;
  private frameBuffer: Buffer[] = [];
  private readonly maxBufferSize: number;

  constructor(config: AudioIngressConfig) {
    this.packetizer = config.packetizer;
    this.targetFrameDurationMs = config.frameDurationMs;
    this.resampler = new Resampler({
      fromSampleRate: AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE,
      fromChannels: AUDIO_CONSTANTS.DISCORD_CHANNELS,
      toSampleRate: config.targetSampleRate,
      toChannels: config.targetChannels,
    });

    this.watchdog = new DiscordReceiveWatchdog({
      onDecryptFailure: this.handleDecryptFailure.bind(this),
      onRecover: this.handleRecover.bind(this),
    });

    // Max buffer size = 5 seconds worth of audio
    this.maxBufferSize = Math.ceil(
      (AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE * 2 * 5) / AUDIO_CONSTANTS.DISCORD_FRAME_SIZE
    );

    logger.info(
      {
        targetSampleRate: config.targetSampleRate,
        targetChannels: config.targetChannels,
        frameDurationMs: config.frameDurationMs,
      },
      'AudioIngressPump initialized'
    );
  }

  /**
   * Start processing audio from Discord receive stream
   */
  start(stream: Readable): void {
    if (this.isRunning) {
      logger.warn('AudioIngressPump already running');
      return;
    }

    this.activeStream = stream;
    this.isRunning = true;
    this.frameBuffer = [];

    logger.info('Starting AudioIngressPump');

    stream.on('data', (chunk: Buffer) => this.handleAudioData(chunk));
    stream.on('error', (error: Error) => this.handleStreamError(error));
    stream.on('end', () => this.handleStreamEnd());

    // Start watchdog
    this.watchdog.start();
  }

  /**
   * Stop processing audio
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping AudioIngressPump');

    this.isRunning = false;
    this.watchdog.stop();

    if (this.activeStream) {
      this.activeStream.removeAllListeners();
      this.activeStream = null;
    }

    // Flush remaining buffer
    if (this.frameBuffer.length > 0) {
      this.flushBuffer();
    }
  }

  /**
   * Handle incoming audio data chunk from Discord
   */
  private handleAudioData(chunk: Buffer): void {
    if (!this.isRunning) {
      return;
    }

    try {
      // Check buffer size to prevent memory leak
      if (this.frameBuffer.length >= this.maxBufferSize) {
        logger.warn(
          { bufferSize: this.frameBuffer.length },
          'Buffer overflow, dropping oldest frame'
        );
        this.frameBuffer.shift();
      }

      this.frameBuffer.push(chunk);
      this.watchdog.recordSuccess();

      // Check if we have enough frames for a packet
      const framesNeeded = this.calculateFramesNeeded();
      if (this.frameBuffer.length >= framesNeeded) {
        this.processAndSendPacket(framesNeeded);
      }
    } catch (error) {
      this.watchdog.recordFailure();
      logger.error({ error }, 'Error handling audio data');
    }
  }

  /**
   * Process buffered frames and send to packetizer
   */
  private processAndSendPacket(frameCount: number): void {
    const frames = this.frameBuffer.splice(0, frameCount);
    const combined = Buffer.concat(frames);

    // Resample to target format
    const resampled = this.resampler.resample(combined);

    // Send to packetizer
    this.packetizer.addFrames({
      data: resampled,
      sampleRate: this.resampler.config.toSampleRate,
      channels: this.resampler.config.toChannels,
      timestamp: Date.now(),
    });

    logger.debug(
      {
        framesProcessed: frameCount,
        originalSize: combined.length,
        resampledSize: resampled.length,
      },
      'Processed audio packet'
    );
  }

  /**
   * Flush remaining buffer
   */
  private flushBuffer(): void {
    if (this.frameBuffer.length === 0) {
      return;
    }

    logger.debug({ frameCount: this.frameBuffer.length }, 'Flushing buffer');
    this.processAndSendPacket(this.frameBuffer.length);
  }

  /**
   * Calculate number of Discord frames needed for target packet
   */
  private calculateFramesNeeded(): number {
    const discordFrameMs = 20; // Discord sends 20ms Opus frames
    return Math.max(1, Math.ceil(this.targetFrameDurationMs / discordFrameMs));
  }

  /**
   * Handle decrypt failure from watchdog
   */
  private handleDecryptFailure(): void {
    logger.error('Audio decrypt failure detected');
    // Could trigger fallback behavior here
  }

  /**
   * Handle recovery from decrypt failures
   */
  private handleRecover(): void {
    logger.info('Audio decrypt recovered');
  }

  /**
   * Handle stream error
   */
  private handleStreamError(error: Error): void {
    logger.error({ error: error.message }, 'Stream error');
    this.isRunning = false;
  }

  /**
   * Handle stream end
   */
  private handleStreamEnd(): void {
    logger.info('Stream ended');
    this.isRunning = false;
  }

  /**
   * Get current buffer status
   */
  getBufferStatus(): { size: number; isRunning: boolean } {
    return {
      size: this.frameBuffer.length,
      isRunning: this.isRunning,
    };
  }
}
