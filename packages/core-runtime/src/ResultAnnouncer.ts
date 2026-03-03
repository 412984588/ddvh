/**
 * ResultAnnouncer - Announces backend results via audio
 *
 * Responsibilities:
 * - Convert text results to speech
 * - Queue announcements for playback
 * - Manage announcement priority and interruption
 */

import pino from 'pino';
import type { BackendResult } from '@voice-hub/shared-config';
import type { AudioEgressPump } from '@voice-hub/audio-engine';
import type { OmniClient } from '@voice-hub/provider-volcengine-omni';

const logger = pino({ name: 'ResultAnnouncer' });

export interface Announcement {
  id: string;
  sessionId: string;
  text: string;
  priority: number;
  createdAt: number;
}

export interface AnnouncerConfig {
  ttsEnabled: boolean;
  maxQueueSize: number;
  defaultPriority: number;
}

/**
 * Manages result announcements via audio
 */
export class ResultAnnouncer {
  private readonly config: AnnouncerConfig;
  private readonly audioPump: AudioEgressPump;
  private readonly omniClient: OmniClient;
  private readonly queue: Announcement[] = [];
  private isPlaying = false;
  private currentAnnouncement: Announcement | null = null;

  constructor(config: AnnouncerConfig, audioPump: AudioEgressPump, omniClient: OmniClient) {
    this.config = config;
    this.audioPump = audioPump;
    this.omniClient = omniClient;

    logger.info({ config }, 'ResultAnnouncer initialized');
  }

  /**
   * Announce backend result
   */
  async announce(result: BackendResult): Promise<void> {
    if (!this.config.ttsEnabled) {
      logger.debug({ taskId: result.taskId }, 'TTS disabled, skipping announcement');
      return;
    }

    const text = this.formatResult(result);
    if (!text) {
      return;
    }

    const announcement: Announcement = {
      id: this.generateAnnouncementId(),
      sessionId: result.sessionId,
      text,
      priority: this.calculatePriority(result),
      createdAt: Date.now(),
    };

    // Add to queue
    this.addToQueue(announcement);

    logger.info(
      {
        announcementId: announcement.id,
        taskId: result.taskId,
        textLength: text.length,
        queueSize: this.queue.length,
      },
      'Announcement queued'
    );

    // Start processing if not playing
    if (!this.isPlaying) {
      this.processNext();
    }
  }

  /**
   * Format result as announcement text
   */
  private formatResult(result: BackendResult): string | null {
    if (result.success) {
      if (result.result) {
        // Truncate long results
        const maxLength = 500;
        const text =
          result.result.length > maxLength
            ? result.result.slice(0, maxLength) + '...'
            : result.result;

        return `Task completed. ${text}`;
      }
      return 'Task completed successfully.';
    } else {
      return `Task failed: ${result.error ?? 'Unknown error'}`;
    }
  }

  /**
   * Add announcement to queue
   */
  private addToQueue(announcement: Announcement): void {
    // Remove oldest if queue is full
    if (this.queue.length >= this.config.maxQueueSize) {
      const removed = this.queue.shift();
      logger.debug({ announcementId: removed?.id }, 'Dropped oldest announcement');
    }

    // Insert based on priority
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      const queued = this.queue[i];
      if (queued && announcement.priority > queued.priority) {
        this.queue.splice(i, 0, announcement);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(announcement);
    }
  }

  /**
   * Process next announcement
   */
  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentAnnouncement = null;
      return;
    }

    this.isPlaying = true;
    const nextAnnouncement = this.queue.shift();
    if (!nextAnnouncement) {
      this.isPlaying = false;
      this.currentAnnouncement = null;
      return;
    }

    this.currentAnnouncement = nextAnnouncement;

    logger.debug(
      {
        announcementId: this.currentAnnouncement.id,
        text: this.currentAnnouncement.text.slice(0, 50),
      },
      'Processing announcement'
    );

    try {
      await this.speak(this.currentAnnouncement.text);
    } catch (error) {
      logger.error({ error }, 'Error speaking announcement');
    }

    // Process next
    this.processNext();
  }

  /**
   * Convert text to speech and play
   *
   * NOTE: Current implementation uses simulated delay. Real TTS integration requires:
   * 1. Extending Omni protocol with TTS request message type
   * 2. Handling TTS audio responses from provider
   * 3. Pumping received audio to Discord via audioPump
   *
   * This is intentionally separate from the main voice pipeline to avoid
   * interfering with active conversations.
   */
  private async speak(text: string): Promise<void> {
    logger.debug({ text: text.slice(0, 100) }, 'Requesting TTS');

    try {
      // Simulated TTS: Add delay based on text length
      // Real implementation would use Omni provider's TTS capability
      logger.info({ text: text.slice(0, 50) }, 'TTS announcement (simulated)');

      const delay = Math.min(1000 + text.length * 50, 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      logger.error({ error, text: text.slice(0, 50) }, 'TTS request failed');
      throw error;
    }
  }

  /**
   * Calculate announcement priority
   */
  private calculatePriority(result: BackendResult): number {
    // Errors get higher priority
    if (!result.success) {
      return 10;
    }

    // Short results get higher priority (quick status updates)
    if (result.result && result.result.length < 100) {
      return 5;
    }

    // Default priority
    return this.config.defaultPriority;
  }

  /**
   * Generate announcement ID
   */
  private generateAnnouncementId(): string {
    return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.length = 0;
    logger.info('Announcement queue cleared');
  }

  /**
   * Get queue status
   */
  getStatus(): {
    isPlaying: boolean;
    queueSize: number;
    current: Announcement | null;
  } {
    return {
      isPlaying: this.isPlaying,
      queueSize: this.queue.length,
      current: this.currentAnnouncement,
    };
  }

  /**
   * Skip current announcement
   */
  skip(): void {
    if (this.currentAnnouncement) {
      logger.debug({ announcementId: this.currentAnnouncement.id }, 'Skipping announcement');
      // Signal to stop current playback and process next
      // The audio pump would need to support stopping/clearing current audio
      this.isPlaying = false;
      this.currentAnnouncement = null;
      // Process next announcement in queue
      setImmediate(() => this.processNext());
    }
  }
}
