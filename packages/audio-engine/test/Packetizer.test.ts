/**
 * Tests for Packetizer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Packetizer, type PacketizedAudio } from '../src/Packetizer.js';
import type { AudioFrame } from '@voice-hub/shared-config';

describe('Packetizer', () => {
  let packetizer: Packetizer;
  const mockOnPacket = vi.fn();

  beforeEach(() => {
    mockOnPacket.mockClear();
  });

  function createFrame(
    data: Buffer,
    sampleRate: number = 48000,
    channels: number = 2,
    timestamp: number = Date.now()
  ): AudioFrame {
    return { data, sampleRate, channels, timestamp };
  }

  describe('constructor', () => {
    it('should create with default config', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      expect(packetizer).toBeDefined();
    });

    it('should create with onPacket callback', () => {
      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: mockOnPacket,
      });
      expect(packetizer).toBeDefined();
    });
  });

  describe('addFrames', () => {
    it('should add single frame to buffer', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      const frame = createFrame(Buffer.from([0x00, 0x01]));

      packetizer.addFrames(frame);
      expect(packetizer.getBufferSize()).toBe(1);
    });

    it('should add multiple frames to buffer', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      const frames = [
        createFrame(Buffer.from([0x00, 0x01])),
        createFrame(Buffer.from([0x02, 0x03])),
        createFrame(Buffer.from([0x04, 0x05])),
      ];

      packetizer.addFrames(frames);
      expect(packetizer.getBufferSize()).toBe(3);
    });

    it('should emit packet when target duration is reached', () => {
      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: mockOnPacket,
      });

      // Create frames that total 200ms
      // At 48kHz stereo 16-bit, each frame is 20ms (960 samples * 2 channels * 2 bytes)
      const frameSize = 960 * 2 * 2; // 3840 bytes
      const framesPerPacket = 10; // 10 frames = 200ms

      for (let i = 0; i < framesPerPacket; i++) {
        const frame = createFrame(Buffer.alloc(frameSize), 48000, 2, Date.now() + i * 20);
        packetizer.addFrames(frame);
      }

      expect(mockOnPacket).toHaveBeenCalledTimes(1);
    });

    it('should emit multiple packets for many frames', () => {
      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: mockOnPacket,
      });

      const frameSize = 960 * 2 * 2; // 3840 bytes (20ms at 48kHz stereo)
      const totalPackets = 3;

      for (let p = 0; p < totalPackets; p++) {
        for (let i = 0; i < 10; i++) {
          const frame = createFrame(
            Buffer.alloc(frameSize),
            48000,
            2,
            Date.now() + (p * 10 + i) * 20
          );
          packetizer.addFrames(frame);
        }
      }

      expect(mockOnPacket).toHaveBeenCalledTimes(totalPackets);
    });

    it('should not emit packet for partial duration', () => {
      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: mockOnPacket,
      });

      // Add only 100ms worth of frames
      const frameSize = 960 * 2 * 2; // 20ms at 48kHz stereo
      for (let i = 0; i < 5; i++) {
        const frame = createFrame(Buffer.alloc(frameSize));
        packetizer.addFrames(frame);
      }

      expect(mockOnPacket).not.toHaveBeenCalled();
      expect(packetizer.getBufferSize()).toBe(5);
    });
  });

  describe('flush', () => {
    it('should return null for empty buffer', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      const packet = packetizer.flush();

      expect(packet).toBeNull();
    });

    it('should flush partial buffer as packet', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      const frame = createFrame(Buffer.from([0x00, 0x01]));
      packetizer.addFrames(frame);

      const packet = packetizer.flush();

      expect(packet).toBeDefined();
      expect(packet?.frames).toHaveLength(1);
      expect(packetizer.getBufferSize()).toBe(0);
    });

    it('should not call onPacket callback when flushing', () => {
      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: mockOnPacket,
      });
      const frame = createFrame(Buffer.from([0x00, 0x01]));
      packetizer.addFrames(frame);

      packetizer.flush();

      expect(mockOnPacket).not.toHaveBeenCalled();
    });

    it('should create packet with proper metadata', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      const timestamp = Date.now();
      const frame1 = createFrame(Buffer.from([0x00]), 48000, 2, timestamp);
      const frame2 = createFrame(Buffer.from([0x01]), 48000, 2, timestamp + 100);

      packetizer.addFrames(frame1);
      packetizer.addFrames(frame2);
      const packet = packetizer.flush();

      expect(packet).toBeDefined();
      expect(packet?.frames).toHaveLength(2);
      expect(packet?.timestamp).toBe(timestamp);
      expect(packet?.duration).toBe(100);
      expect(packet?.packetId).toMatch(/^pkt_\d+_0$/);
    });

    it('should generate unique packet IDs', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });

      const frame = createFrame(Buffer.from([0x00]));
      packetizer.addFrames(frame);
      const packet1 = packetizer.flush();

      packetizer.addFrames(frame);
      const packet2 = packetizer.flush();

      expect(packet1?.packetId).not.toBe(packet2?.packetId);
    });
  });

  describe('getBufferSize', () => {
    it('should return 0 for new packetizer', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      expect(packetizer.getBufferSize()).toBe(0);
    });

    it('should return current buffer size', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      const frames = [
        createFrame(Buffer.from([0x00])),
        createFrame(Buffer.from([0x01])),
        createFrame(Buffer.from([0x02])),
      ];

      packetizer.addFrames(frames);
      expect(packetizer.getBufferSize()).toBe(3);
    });

    it('should return 0 after flushing', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      packetizer.addFrames(createFrame(Buffer.from([0x00])));
      packetizer.flush();

      expect(packetizer.getBufferSize()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear buffer', () => {
      packetizer = new Packetizer({ targetDurationMs: 200 });
      packetizer.addFrames(createFrame(Buffer.from([0x00])));
      packetizer.addFrames(createFrame(Buffer.from([0x01])));

      expect(packetizer.getBufferSize()).toBe(2);
      packetizer.clear();
      expect(packetizer.getBufferSize()).toBe(0);
    });

    it('should not emit packet when clearing', () => {
      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: mockOnPacket,
      });
      packetizer.addFrames(createFrame(Buffer.from([0x00])));
      packetizer.clear();

      expect(mockOnPacket).not.toHaveBeenCalled();
    });
  });

  describe('packet emission', () => {
    it('should include all frames in packet', () => {
      let emittedPacket: PacketizedAudio | undefined;

      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: (packet) => {
          emittedPacket = packet;
        },
      });

      const frameSize = 960 * 2 * 2;
      for (let i = 0; i < 10; i++) {
        const frame = createFrame(Buffer.alloc(frameSize, i), 48000, 2, Date.now() + i * 20);
        packetizer.addFrames(frame);
      }

      expect(emittedPacket).toBeDefined();
      expect(emittedPacket?.frames).toHaveLength(10);
    });

    it('should clear buffer after emission', () => {
      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: mockOnPacket,
      });

      const frameSize = 960 * 2 * 2;
      for (let i = 0; i < 10; i++) {
        const frame = createFrame(Buffer.alloc(frameSize));
        packetizer.addFrames(frame);
      }

      expect(mockOnPacket).toHaveBeenCalled();
      expect(packetizer.getBufferSize()).toBe(0);
    });
  });

  describe('duration calculation', () => {
    it('should calculate correct duration for 48kHz stereo', () => {
      let emittedPacket: PacketizedAudio | undefined;

      packetizer = new Packetizer({
        targetDurationMs: 200,
        onPacket: (packet) => {
          emittedPacket = packet;
        },
      });

      const frameSize = 960 * 2 * 2; // 20ms at 48kHz stereo
      const timestamp = Date.now();

      for (let i = 0; i < 10; i++) {
        const frame = createFrame(Buffer.alloc(frameSize), 48000, 2, timestamp + i * 20);
        packetizer.addFrames(frame);
      }

      expect(emittedPacket).toBeDefined();
      expect(emittedPacket?.duration).toBe(180); // 9 intervals of 20ms
    });
  });
});
