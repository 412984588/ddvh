import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { AudioIngressPump } from '../src/AudioIngressPump.js';
import type { Packetizer } from '../src/Packetizer.js';

describe('AudioIngressPump', () => {
  it('emits one packet after 10 Discord frames for 200ms target duration', async () => {
    const addFrames = vi.fn();
    const packetizer = {
      addFrames,
    } as unknown as Packetizer;

    const pump = new AudioIngressPump({
      packetizer,
      targetSampleRate: 16000,
      targetChannels: 1,
      frameDurationMs: 200,
    });

    const stream = new PassThrough();
    pump.start(stream);

    for (let i = 0; i < 10; i++) {
      stream.write(Buffer.alloc(3840));
    }

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    expect(addFrames).toHaveBeenCalledTimes(1);

    pump.stop();
    stream.end();
  });
});
