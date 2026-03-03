/**
 * Packetizer - Aggregates audio frames into packets
 *
 * Responsibilities:
 * - Buffers incoming audio frames
 * - Creates packets of specified duration (100-200ms)
 * - Emits packets to callback
 */

import pino from 'pino';
import type { AudioFrame } from '@voice-hub/shared-config';

const logger = pino({ name: 'Packetizer' });

export interface PacketizerConfig {
  targetDurationMs: number;
  onPacket?: (packet: PacketizedAudio) => void;
}

export interface PacketizedAudio {
  frames: AudioFrame[];
  packetId: string;
  timestamp: number;
  duration: number;
}

/**
 * Audio packetizer for aggregating frames
 */
export class Packetizer {
  private readonly targetDurationMs: number;
  private readonly onPacket?: (packet: PacketizedAudio) => void;
  private frameBuffer: AudioFrame[] = [];
  private packetCounter = 0;

  constructor(config: PacketizerConfig) {
    this.targetDurationMs = config.targetDurationMs;
    this.onPacket = config.onPacket;

    logger.info(
      {
        targetDurationMs: this.targetDurationMs,
      },
      'Packetizer initialized'
    );
  }

  /**
   * Add frame to buffer
   */
  addFrames(frame: AudioFrame): void;
  addFrames(frames: AudioFrame[]): void;
  addFrames(frameOrFrames: AudioFrame | AudioFrame[]): void {
    const frames = Array.isArray(frameOrFrames) ? frameOrFrames : [frameOrFrames];
    this.frameBuffer.push(...frames);

    // Check if we should emit a packet
    this.checkAndEmit();
  }

  /**
   * Check buffer and emit packet if ready
   */
  private checkAndEmit(): void {
    if (this.frameBuffer.length === 0) {
      return;
    }

    const currentDuration = this.calculateDuration();
    if (currentDuration >= this.targetDurationMs) {
      this.emitPacket();
    }
  }

  /**
   * Calculate current buffer duration in milliseconds
   */
  private calculateDuration(): number {
    if (this.frameBuffer.length === 0) {
      return 0;
    }

    const lastFrame = this.frameBuffer.at(-1);
    if (!lastFrame) {
      return 0;
    }

    // Calculate based on frame size and sample rate
    const bytesPerSample = 2; // 16-bit PCM
    const samplesPerFrame = lastFrame.data.length / (bytesPerSample * lastFrame.channels);
    const durationPerFrame = (samplesPerFrame / lastFrame.sampleRate) * 1000;

    return this.frameBuffer.length * durationPerFrame;
  }

  /**
   * Emit packet with current buffer
   */
  private emitPacket(): void {
    if (this.frameBuffer.length === 0) {
      return;
    }

    const frames = [...this.frameBuffer];
    this.frameBuffer = [];

    const firstFrame = frames.at(0);
    const lastFrame = frames.at(-1);
    if (!firstFrame || !lastFrame) {
      return;
    }

    const packet: PacketizedAudio = {
      frames,
      packetId: this.generatePacketId(),
      timestamp: firstFrame.timestamp,
      duration: lastFrame.timestamp - firstFrame.timestamp,
    };

    logger.debug(
      {
        packetId: packet.packetId,
        frameCount: frames.length,
        duration: packet.duration,
      },
      'Emitting packet'
    );

    if (this.onPacket) {
      this.onPacket(packet);
    }
  }

  /**
   * Generate unique packet ID
   */
  private generatePacketId(): string {
    return `pkt_${Date.now()}_${this.packetCounter++}`;
  }

  /**
   * Flush any remaining frames as a packet
   */
  flush(): PacketizedAudio | null {
    if (this.frameBuffer.length === 0) {
      return null;
    }

    const frames = [...this.frameBuffer];
    this.frameBuffer = [];

    const firstFrame = frames.at(0);
    const lastFrame = frames.at(-1);
    if (!firstFrame || !lastFrame) {
      return null;
    }

    const packet: PacketizedAudio = {
      frames,
      packetId: this.generatePacketId(),
      timestamp: firstFrame.timestamp,
      duration: lastFrame.timestamp - firstFrame.timestamp,
    };

    return packet;
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.frameBuffer.length;
  }

  /**
   * Clear buffer without emitting
   */
  clear(): void {
    this.frameBuffer = [];
    logger.debug('Buffer cleared');
  }
}
