/**
 * Barge-in state machine for voice interruption handling
 *
 * Barge-in allows user to interrupt the assistant's response
 * by speaking during playback.
 */

import pino from 'pino';
import { BargeInState } from './types.js';

const logger = pino({ name: 'BargeInStateMachine' });

export interface BargeInConfig {
  interruptionThresholdMs?: number;
  recoveryTimeoutMs?: number;
  onInterrupt?: () => void;
  onRecover?: () => void;
}

export interface BargeInStatus {
  state: BargeInState;
  canInterrupt: boolean;
  lastActivity: number;
}

/**
 * State machine for managing barge-in (voice interruption)
 */
export class BargeInStateMachine {
  private state: BargeInState = BargeInState.IDLE;
  private lastActivity = 0;
  private readonly interruptionThresholdMs: number;
  private readonly recoveryTimeoutMs: number;
  private readonly onInterrupt?: () => void;
  private readonly onRecover?: () => void;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor(config: BargeInConfig = {}) {
    this.interruptionThresholdMs = config.interruptionThresholdMs ?? 500;
    this.recoveryTimeoutMs = config.recoveryTimeoutMs ?? 2000;
    this.onInterrupt = config.onInterrupt;
    this.onRecover = config.onRecover;
  }

  /**
   * Handle incoming audio from user
   */
  handleIncomingAudio(): void {
    this.lastActivity = Date.now();

    switch (this.state) {
      case BargeInState.IDLE:
        // User started speaking while idle, move to listening
        this.transitionTo(BargeInState.LISTENING);
        break;

      case BargeInState.LISTENING:
        // Continue listening, no state change
        break;

      case BargeInState.INTERRUPTING:
        // User is speaking during playback, confirm interruption
        this.transitionTo(BargeInState.RECOVERING);
        break;

      case BargeInState.RECOVERING:
        // User continues speaking during recovery
        this.scheduleRecoveryCheck();
        break;
    }
  }

  /**
   * Handle audio playback start
   */
  handlePlaybackStart(): void {
    this.lastActivity = Date.now();

    switch (this.state) {
      case BargeInState.IDLE:
      case BargeInState.LISTENING:
        // TTS started speaking
        this.transitionTo(BargeInState.IDLE);
        break;

      case BargeInState.INTERRUPTING:
        // Playback restarting during interruption
        this.transitionTo(BargeInState.IDLE);
        break;

      case BargeInState.RECOVERING:
        // Playback restarting during recovery
        this.transitionTo(BargeInState.IDLE);
        break;
    }
  }

  /**
   * Handle detection of user speech during TTS
   */
  detectSpeechDuringPlayback(): void {
    if (this.state === BargeInState.IDLE || this.state === BargeInState.LISTENING) {
      logger.info('Speech detected during playback, triggering interruption');
      this.transitionTo(BargeInState.INTERRUPTING);
    }
  }

  /**
   * Check if interruption should occur
   */
  canInterrupt(): boolean {
    return this.state === BargeInState.IDLE || this.state === BargeInState.LISTENING;
  }

  /**
   * Get current status
   */
  getStatus(): BargeInStatus {
    return {
      state: this.state,
      canInterrupt: this.canInterrupt(),
      lastActivity: this.lastActivity,
    };
  }

  /**
   * Reset to idle state
   */
  reset(): void {
    this.transitionTo(BargeInState.IDLE);
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: BargeInState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;

    logger.debug({ from: oldState, to: newState }, 'Barge-in state transition');

    // Handle state-specific actions
    switch (newState) {
      case BargeInState.INTERRUPTING:
        if (this.onInterrupt) {
          this.onInterrupt();
        }
        break;

      case BargeInState.RECOVERING:
        this.scheduleRecoveryCheck();
        break;
    }

    // Clear any pending recovery
    if (this.timeoutId && newState !== BargeInState.RECOVERING) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  /**
   * Schedule recovery check
   */
  private scheduleRecoveryCheck(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      const timeSinceActivity = Date.now() - this.lastActivity;

      if (timeSinceActivity > this.recoveryTimeoutMs) {
        logger.info('Recovery timeout, returning to listening');
        this.transitionTo(BargeInState.LISTENING);

        if (this.onRecover) {
          this.onRecover();
        }
      }
    }, this.recoveryTimeoutMs);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}
