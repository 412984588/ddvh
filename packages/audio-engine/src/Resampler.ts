/**
 * Resampler - Audio resampling utility
 *
 * Responsibilities:
 * - Converts audio from Discord format (48kHz stereo) to target format (16kHz mono)
 * - Uses simple linear interpolation for downsampling
 */

import pino from 'pino';

const logger = pino({ name: 'Resampler' });

export interface ResamplerConfig {
  fromSampleRate: number;
  fromChannels: number;
  toSampleRate: number;
  toChannels: number;
}

/**
 * Audio resampler for format conversion
 */
export class Resampler {
  public readonly config: ResamplerConfig;
  private readonly sampleRatio: number;
  private readonly channelRatio: number;

  constructor(config: ResamplerConfig) {
    this.config = config;
    this.sampleRatio = config.fromSampleRate / config.toSampleRate;
    this.channelRatio = config.fromChannels / config.toChannels;

    logger.info(
      {
        from: `${config.fromSampleRate}Hz ${config.fromChannels}ch`,
        to: `${config.toSampleRate}Hz ${config.toChannels}ch`,
        sampleRatio: this.sampleRatio,
        channelRatio: this.channelRatio,
      },
      'Resampler initialized'
    );
  }

  /**
   * Resample audio buffer
   */
  resample(input: Buffer): Buffer {
    // Input is PCM16: 2 bytes per sample
    const inputSamples = new Int16Array(input.buffer, input.byteOffset, input.length / 2);

    // First: channel reduction (if needed)
    const monoSamples =
      this.config.fromChannels > 1 && this.config.toChannels === 1
        ? this.stereoToMono(inputSamples)
        : inputSamples;

    // Second: sample rate conversion
    const outputSamples = this.resampleRate(monoSamples);

    // Convert back to Buffer
    return Buffer.from(outputSamples.buffer);
  }

  /**
   * Convert stereo to mono by averaging channels
   */
  private stereoToMono(stereo: Int16Array): Int16Array {
    const mono = new Int16Array(stereo.length / 2);
    for (let i = 0; i < mono.length; i++) {
      const left = stereo[i * 2];
      const right = stereo[i * 2 + 1];
      if (left === undefined || right === undefined) {
        continue;
      }
      // Average with overflow protection
      const sum = left + right;
      mono[i] = (sum / 2) as unknown as Int16Array[0];
    }
    return mono;
  }

  /**
   * Resample using linear interpolation
   */
  private resampleRate(input: Int16Array): Int16Array {
    const inputLength = input.length;
    const outputLength = Math.floor(inputLength / this.sampleRatio);
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const inputIndex = i * this.sampleRatio;
      const indexLow = Math.floor(inputIndex);
      const indexHigh = Math.min(indexLow + 1, inputLength - 1);
      const fraction = inputIndex - indexLow;

      // Linear interpolation
      const low = input[indexLow];
      const high = input[indexHigh];
      if (low === undefined || high === undefined) {
        continue;
      }
      const interpolated = low + (high - low) * fraction;

      output[i] = Math.round(interpolated) as unknown as Int16Array[0];
    }

    return output;
  }

  /**
   * Calculate expected output size
   */
  calculateOutputSize(inputSize: number): number {
    const inputSamples = inputSize / 2; // 16-bit = 2 bytes per sample
    const monoSamples = Math.floor(inputSamples / this.channelRatio);
    const outputSamples = Math.floor(monoSamples / this.sampleRatio);
    return outputSamples * 2; // Convert back to bytes
  }
}
