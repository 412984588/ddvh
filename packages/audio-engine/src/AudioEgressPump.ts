/**
 * AudioEgressPump - Handles outbound audio to Discord
 *
 * Responsibilities:
 * - Receives processed audio frames from provider
 * - Buffers and queues for playback
 * - Manages audio playback timing
 * - Handles silence/EOF conditions
 */

import { Readable } from 'node:stream';
import type { AudioResource, VoiceConnection } from '@discordjs/voice';
import {
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} from '@discordjs/voice';
import pino from 'pino';
import type { AudioFrame } from '@voice-hub/shared-config';

const logger = pino({ name: 'AudioEgressPump' });

export interface AudioEgressConfig {
  voiceConnection: VoiceConnection;
  bufferSize?: number;
}

/**
 * Audio egress pump for playing audio to Discord
 */
export class AudioEgressPump {
  private readonly voiceConnection: VoiceConnection;
  private readonly player: ReturnType<typeof import('@discordjs/voice').createAudioPlayer>;
  private readonly queue: AudioFrame[] = [];
  private isPlaying = false;
  private readonly maxBufferSize: number;

  constructor(config: AudioEgressConfig) {
    this.voiceConnection = config.voiceConnection;
    this.player = createAudioPlayer();
    this.maxBufferSize = config.bufferSize ?? 100;

    // Subscribe player to voice connection
    this.voiceConnection.subscribe(this.player);

    // Setup player event handlers
    this.player.on(AudioPlayerStatus.Idle, () => this.handleIdle());
    this.player.on(AudioPlayerStatus.Playing, () => this.handlePlaying());
    this.player.on('error', (error: Error) => this.handleError(error));

    logger.info('AudioEgressPump initialized');
  }

  /**
   * Add audio frame to playback queue
   */
  addFrame(frame: AudioFrame): void {
    if (this.queue.length >= this.maxBufferSize) {
      logger.warn({ queueSize: this.queue.length }, 'Queue full, dropping oldest frame');
      this.queue.shift();
    }

    this.queue.push(frame);
    logger.debug({ queueSize: this.queue.length }, 'Frame added to queue');

    // Start playback if idle
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Add multiple frames at once
   */
  addFrames(frames: AudioFrame[]): void {
    for (const frame of frames) {
      this.addFrame(frame);
    }
  }

  /**
   * Play next frame from queue
   */
  private playNext(): void {
    if (this.queue.length === 0) {
      logger.debug('No frames to play');
      return;
    }

    const frame = this.queue.shift();
    if (!frame) {
      return;
    }

    try {
      // Create audio resource from frame data
      const resource = this.createResource(frame);
      this.player.play(resource);
      this.isPlaying = true;
    } catch (error) {
      logger.error({ error }, 'Error creating audio resource');
      this.isPlaying = false;
    }
  }

  /**
   * Create audio resource from frame
   */
  private createResource(frame: AudioFrame): AudioResource<unknown> {
    // Convert frame data to readable stream
    const stream = Readable.from([frame.data]);

    return createAudioResource(stream, {
      inputType: StreamType.Raw,
      inlineVolume: false,
    });
  }

  /**
   * Handle player idle state
   */
  private handleIdle(): void {
    logger.debug('Player idle');
    this.isPlaying = false;

    // Check if there are more frames to play
    if (this.queue.length > 0) {
      setImmediate(() => this.playNext());
    }
  }

  /**
   * Handle player playing state
   */
  private handlePlaying(): void {
    logger.debug('Player playing');
  }

  /**
   * Handle player error
   */
  private handleError(error: Error): void {
    logger.error({ error: error.message }, 'Player error');
    this.isPlaying = false;

    // Try to recover by playing next frame
    if (this.queue.length > 0) {
      setImmediate(() => this.playNext());
    }
  }

  /**
   * Stop playback and clear queue
   */
  stop(): void {
    logger.info('Stopping AudioEgressPump');
    this.player.stop();
    this.queue.length = 0;
    this.isPlaying = false;
  }

  /**
   * Pause playback (keeps queue)
   */
  pause(): void {
    logger.info('Pausing AudioEgressPump');
    this.player.pause();
  }

  /**
   * Resume playback
   */
  resume(): void {
    logger.info('Resuming AudioEgressPump');
    this.player.unpause();
  }

  /**
   * Get current status
   */
  getStatus(): {
    isPlaying: boolean;
    queueSize: number;
    playerState: AudioPlayerStatus;
  } {
    return {
      isPlaying: this.isPlaying,
      queueSize: this.queue.length,
      playerState: this.player.state.status,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    logger.info('Destroying AudioEgressPump');
    this.stop();
    this.player.removeAllListeners();
    // Note: In newer versions of @discordjs/voice, subscription is managed differently
    // The player is automatically detached when the voice connection is destroyed
  }
}
