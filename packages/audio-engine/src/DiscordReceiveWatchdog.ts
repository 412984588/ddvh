/**
 * DiscordReceiveWatchdog - Monitors Discord audio reception
 *
 * Responsibilities:
 * - Detects consecutive decrypt failures
 * - Triggers recovery actions
 * - Provides health status
 */

import pino from 'pino';

const logger = pino({ name: 'DiscordReceiveWatchdog' });

export interface WatchdogConfig {
  failureThreshold?: number;
  recoveryWindowMs?: number;
  onDecryptFailure?: () => void;
  onRecover?: () => void;
}

export interface WatchdogStatus {
  isActive: boolean;
  consecutiveFailures: number;
  isHealthy: boolean;
  lastFailureTime?: number;
}

/**
 * Watchdog for monitoring Discord audio reception health
 */
export class DiscordReceiveWatchdog {
  private readonly failureThreshold: number;
  private readonly recoveryWindowMs: number;
  private readonly onDecryptFailure?: () => void;
  private readonly onRecover?: () => void;

  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private isActive = false;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor(config: WatchdogConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.recoveryWindowMs = config.recoveryWindowMs ?? 10000;
    this.onDecryptFailure = config.onDecryptFailure;
    this.onRecover = config.onRecover;

    logger.info(
      {
        failureThreshold: this.failureThreshold,
        recoveryWindowMs: this.recoveryWindowMs,
      },
      'DiscordReceiveWatchdog initialized'
    );
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;

    logger.info('Watchdog started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    logger.info('Watchdog stopped');
  }

  /**
   * Record successful audio frame reception
   */
  recordSuccess(): void {
    if (!this.isActive) {
      return;
    }

    if (this.consecutiveFailures > 0) {
      const wasUnhealthy = this.consecutiveFailures >= this.failureThreshold;

      this.consecutiveFailures = 0;
      this.lastFailureTime = 0;

      if (wasUnhealthy && this.onRecover) {
        logger.info('Recovered from decrypt failures');
        this.onRecover();
      }
    }
  }

  /**
   * Record a decrypt failure
   */
  recordFailure(): void {
    if (!this.isActive) {
      return;
    }

    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    logger.warn(
      {
        failures: this.consecutiveFailures,
        threshold: this.failureThreshold,
      },
      'Decrypt failure recorded'
    );

    // Check if threshold exceeded
    if (this.consecutiveFailures >= this.failureThreshold && this.onDecryptFailure) {
      logger.error({ failures: this.consecutiveFailures }, 'Decrypt failure threshold exceeded');
      this.onDecryptFailure();
    }

    // Schedule recovery check
    this.scheduleRecoveryCheck();
  }

  /**
   * Schedule recovery check
   */
  private scheduleRecoveryCheck(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.checkRecovery();
    }, this.recoveryWindowMs);
  }

  /**
   * Check if we should recover (no new failures in window)
   */
  private checkRecovery(): void {
    if (!this.isActive || this.consecutiveFailures === 0) {
      return;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;

    if (timeSinceLastFailure >= this.recoveryWindowMs) {
      logger.info('Recovery window passed, resetting failures');
      this.consecutiveFailures = 0;

      if (this.onRecover) {
        this.onRecover();
      }
    }
  }

  /**
   * Get current status
   */
  getStatus(): WatchdogStatus {
    return {
      isActive: this.isActive,
      consecutiveFailures: this.consecutiveFailures,
      isHealthy: this.consecutiveFailures < this.failureThreshold,
      lastFailureTime: this.lastFailureTime || undefined,
    };
  }

  /**
   * Reset state
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    logger.info('Watchdog reset');
  }
}
