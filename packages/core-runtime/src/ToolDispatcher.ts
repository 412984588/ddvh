/**
 * ToolDispatcher - Dispatches tool calls to appropriate handlers
 *
 * Responsibilities:
 * - Receives tool call events from provider
 * - Routes to backend or local handlers
 * - Handles tool responses
 */

import pino from 'pino';
import type { BackendClient } from '@voice-hub/backend-dispatcher';
import type { BackendResult, ToolResult } from '@voice-hub/shared-config';
import { ToolIntent } from '@voice-hub/shared-config';
import type { OmniClient } from '@voice-hub/provider-volcengine-omni';

const logger = pino({ name: 'ToolDispatcher' });

export interface ToolCall {
  sessionId: string;
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface DispatcherConfig {
  defaultTimeout: number;
  enableLocalHandlers: boolean;
}

/**
 * Dispatches tool calls to handlers
 */
export class ToolDispatcher {
  private readonly backendClient: BackendClient;
  private readonly omniClient: OmniClient | null;
  private readonly config: DispatcherConfig;
  private localHandlers: Map<string, ToolHandler> = new Map();
  private pendingCalls: Map<string, PendingCall> = new Map();

  constructor(backendClient: BackendClient, config: DispatcherConfig, omniClient?: OmniClient) {
    this.backendClient = backendClient;
    this.omniClient = omniClient ?? null;
    this.config = config;
    logger.info({ config }, 'ToolDispatcher initialized');
  }

  /**
   * Register local tool handler
   */
  registerTool(toolName: string, handler: ToolHandler): void {
    this.localHandlers.set(toolName, handler);
    logger.debug({ toolName }, 'Local tool handler registered');
  }

  /**
   * Handle tool call from provider
   */
  async handleToolCall(call: ToolCall): Promise<ToolResult> {
    logger.info(
      {
        sessionId: call.sessionId,
        toolId: call.toolId,
        toolName: call.toolName,
      },
      'Handling tool call'
    );

    // Check for local handler first
    if (this.config.enableLocalHandlers && this.localHandlers.has(call.toolName)) {
      return this.handleLocalTool(call);
    }

    // Route to backend
    return this.handleBackendTool(call);
  }

  /**
   * Handle tool with local handler
   */
  private async handleLocalTool(call: ToolCall): Promise<ToolResult> {
    const handler = this.localHandlers.get(call.toolName);
    if (!handler) {
      return {
        intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
        success: false,
        error: `No local handler registered for tool: ${call.toolName}`,
      };
    }

    try {
      const result = await handler(call.parameters);
      logger.info(
        {
          toolId: call.toolId,
          toolName: call.toolName,
        },
        'Local tool executed successfully'
      );

      return {
        intent: ToolIntent.DISPATCH_TASK_TO_BACKEND, // Placeholder
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error(
        {
          toolId: call.toolId,
          toolName: call.toolName,
          error,
        },
        'Local tool execution failed'
      );

      return {
        intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle tool via backend dispatch
   */
  private async handleBackendTool(call: ToolCall): Promise<ToolResult> {
    const prompt = this.buildPromptFromToolCall(call);

    try {
      const dispatchResult = await this.backendClient.dispatchTask(
        call.sessionId,
        call.toolName,
        prompt,
        undefined
      );

      if (!dispatchResult.success) {
        return {
          intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
          success: false,
          error: dispatchResult.error ?? 'Failed to dispatch task',
        };
      }

      // Track pending call
      this.pendingCalls.set(dispatchResult.taskId, {
        toolId: call.toolId,
        sessionId: call.sessionId,
        dispatchedAt: Date.now(),
      });

      logger.info(
        {
          taskId: dispatchResult.taskId,
          toolId: call.toolId,
        },
        'Tool dispatched to backend'
      );

      // Return immediately (result will come via webhook)
      return {
        intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
        success: true,
        data: { taskId: dispatchResult.taskId, status: 'pending' },
      };
    } catch (error) {
      logger.error(
        {
          toolId: call.toolId,
          error,
        },
        'Backend dispatch failed'
      );

      return {
        intent: ToolIntent.DISPATCH_TASK_TO_BACKEND,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle webhook result for pending tool call
   */
  handleWebhookResult(result: BackendResult): void {
    const pending = this.pendingCalls.get(result.taskId);

    if (!pending) {
      logger.warn({ taskId: result.taskId }, 'No pending call for webhook result');
      return;
    }

    logger.info(
      {
        taskId: result.taskId,
        toolId: pending.toolId,
        success: result.success,
      },
      'Tool call completed via webhook'
    );

    // Send result back to provider
    this.sendToolResult(pending.toolId, result);

    // Remove from pending
    this.pendingCalls.delete(result.taskId);
  }

  /**
   * Send tool result back to provider
   */
  private sendToolResult(toolId: string, result: BackendResult): void {
    if (!this.omniClient) {
      logger.warn('Cannot send tool result: OmniClient not configured');
      return;
    }

    try {
      this.omniClient.sendToolResult(
        toolId,
        result.success ? result.result : undefined,
        result.success ? undefined : result.error
      );

      logger.info(
        {
          toolId,
          success: result.success,
          hasData: !!result.result,
          hasError: !!result.error,
        },
        'Tool result sent to provider'
      );
    } catch (error) {
      logger.error(
        {
          toolId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to send tool result to provider'
      );
    }
  }

  /**
   * Build prompt from tool call
   */
  private buildPromptFromToolCall(call: ToolCall): string {
    const params = Object.entries(call.parameters)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');

    return `Execute tool: ${call.toolName} with parameters: ${params}`;
  }

  /**
   * Clean up timed out calls
   */
  cleanup(): void {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [taskId, call] of this.pendingCalls.entries()) {
      if (now - call.dispatchedAt > this.config.defaultTimeout) {
        timedOut.push(taskId);
      }
    }

    for (const taskId of timedOut) {
      this.pendingCalls.delete(taskId);
      logger.warn({ taskId }, 'Tool call timed out');
    }

    if (timedOut.length > 0) {
      logger.info({ count: timedOut.length }, 'Cleaned up timed out tool calls');
    }
  }

  /**
   * Get status
   */
  getStatus(): {
    pendingCalls: number;
    localHandlers: number;
  } {
    return {
      pendingCalls: this.pendingCalls.size,
      localHandlers: this.localHandlers.size,
    };
  }
}

interface ToolHandler {
  (parameters: Record<string, unknown>): Promise<unknown>;
}

interface PendingCall {
  toolId: string;
  sessionId: string;
  dispatchedAt: number;
}
