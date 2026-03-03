/**
 * Async HTTP client for dispatching tasks to backend
 */

import pino from 'pino';
import type { BackendTask, BackendResult } from '@voice-hub/shared-config';

const logger = pino({ name: 'BackendClient' });

export interface BackendClientConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface DispatchResult {
  taskId: string;
  success: boolean;
  error?: string;
}

/**
 * HTTP client for backend task dispatch
 */
export class BackendClient {
  private readonly config: BackendClientConfig;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private recentResults: Map<string, CompletedTaskResult> = new Map();
  private recentResultTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly recentResultTtlMs = 15000;

  constructor(config: BackendClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '@voice-hub/backend-dispatcher v0.1.0',
        ...config.headers,
      },
    };

    logger.info({ endpoint: this.config.endpoint }, 'BackendClient initialized');
  }

  /**
   * Dispatch task to backend
   */
  async dispatchTask(
    sessionId: string,
    intent: string,
    prompt: string,
    context?: BackendTask['context']
  ): Promise<DispatchResult> {
    const taskId = this.generateTaskId();
    const task: BackendTask = {
      taskId,
      sessionId,
      intent,
      prompt,
      context,
      createdAt: Date.now(),
    };

    logger.info({ taskId, intent, sessionId }, 'Dispatching task to backend');

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(task),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
      }

      // Track pending task for webhook correlation
      this.trackPendingTask(taskId, task);

      logger.info({ taskId }, 'Task dispatched successfully');

      return {
        taskId,
        success: true,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ taskId }, 'Task dispatch timed out');
        return {
          taskId,
          success: false,
          error: 'Request timeout',
        };
      }

      logger.error({ taskId, error }, 'Task dispatch failed');

      return {
        taskId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Handle webhook result for pending task
   */
  handleWebhookResult(result: BackendResult): boolean {
    const pending = this.pendingTasks.get(result.taskId);

    this.storeRecentResult(result);

    if (!pending) {
      logger.warn({ taskId: result.taskId }, 'Received webhook for unknown task');
      return false;
    }

    logger.info({ taskId: result.taskId, success: result.success }, 'Task completed via webhook');

    // Notify pending handler
    if (pending.handler) {
      try {
        pending.handler(result);
      } catch (error) {
        logger.error({ error }, 'Error in webhook handler');
      }
    }

    // Remove from pending immediately; recent result cache handles late handler registration.
    this.pendingTasks.delete(result.taskId);

    return true;
  }

  /**
   * Register handler for task completion
   */
  onTaskComplete(taskId: string, handler: (result: BackendResult) => void): void {
    const completed = this.recentResults.get(taskId);
    if (completed) {
      try {
        handler(completed.result);
      } catch (error) {
        logger.error({ error, taskId }, 'Error in late task completion handler');
      } finally {
        this.clearRecentResult(taskId);
      }
      return;
    }

    const pending = this.pendingTasks.get(taskId);
    if (pending) {
      pending.handler = handler;
    }
  }

  /**
   * Get pending task info
   */
  getPendingTask(taskId: string): PendingTask | undefined {
    return this.pendingTasks.get(taskId);
  }

  /**
   * Clean up old pending tasks
   */
  cleanup(maxAge: number): void {
    const now = Date.now();
    const toDelete: string[] = [];
    const staleResults: string[] = [];

    for (const [taskId, task] of this.pendingTasks.entries()) {
      if (now - task.createdAt > maxAge) {
        toDelete.push(taskId);
      }
    }

    for (const [taskId, completed] of this.recentResults.entries()) {
      if (now - completed.completedAt > maxAge) {
        staleResults.push(taskId);
      }
    }

    for (const taskId of toDelete) {
      this.pendingTasks.delete(taskId);
    }

    for (const taskId of staleResults) {
      this.clearRecentResult(taskId);
    }

    if (toDelete.length > 0) {
      logger.info({ count: toDelete.length }, 'Cleaned up old pending tasks');
    }

    if (staleResults.length > 0) {
      logger.info({ count: staleResults.length }, 'Cleaned up cached webhook results');
    }
  }

  private storeRecentResult(result: BackendResult): void {
    this.recentResults.set(result.taskId, {
      result,
      completedAt: Date.now(),
    });

    const existingTimer = this.recentResultTimers.get(result.taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.clearRecentResult(result.taskId);
    }, this.recentResultTtlMs);

    this.recentResultTimers.set(result.taskId, timer);
  }

  private clearRecentResult(taskId: string): void {
    const timer = this.recentResultTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.recentResultTimers.delete(taskId);
    }

    this.recentResults.delete(taskId);
  }

  /**
   * Build request headers
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.headers };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Track pending task
   */
  private trackPendingTask(taskId: string, task: BackendTask): void {
    this.pendingTasks.set(taskId, {
      taskId,
      task,
      createdAt: Date.now(),
      handler: undefined,
    });
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

interface PendingTask {
  taskId: string;
  task: BackendTask;
  createdAt: number;
  handler?: ((result: BackendResult) => void) | undefined;
}

interface CompletedTaskResult {
  result: BackendResult;
  completedAt: number;
}
