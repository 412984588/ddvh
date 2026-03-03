/**
 * ActiveConversationStore - Manages conversation state
 *
 * Responsibilities:
 * - Store conversation history
 * - Track conversation context
 * - Provide conversation lookup
 */

import pino from 'pino';
import type { BackendResult } from '@voice-hub/shared-config';

const logger = pino({ name: 'ActiveConversationStore' });

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  sessionId: string;
  messages: ConversationMessage[];
  pendingTasks: Map<string, PendingTaskInfo>;
  lastActivity: number;
  startTime: number;
}

export interface PendingTaskInfo {
  taskId: string;
  intent: string;
  prompt: string;
  dispatchedAt: number;
}

/**
 * Store for active conversations
 */
export class ActiveConversationStore {
  private readonly conversations: Map<string, Conversation> = new Map();
  private readonly maxMessagesPerConversation = 100;
  private readonly maxConversationAge = 3600000; // 1 hour

  /**
   * Get or create conversation
   */
  getConversation(sessionId: string): Conversation {
    let conversation = this.conversations.get(sessionId);

    if (!conversation) {
      conversation = this.createConversation(sessionId);
    }

    return conversation;
  }

  /**
   * Add message to conversation
   */
  addMessage(
    sessionId: string,
    role: ConversationMessage['role'],
    content: string,
    metadata?: Record<string, unknown>
  ): void {
    const conversation = this.getConversation(sessionId);

    const message: ConversationMessage = {
      id: this.generateMessageId(),
      sessionId,
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };

    conversation.messages.push(message);
    conversation.lastActivity = Date.now();

    // Trim if too many messages
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(-this.maxMessagesPerConversation);
    }

    logger.debug(
      {
        sessionId,
        messageId: message.id,
        role,
        messageCount: conversation.messages.length,
      },
      'Message added to conversation'
    );
  }

  /**
   * Get conversation messages
   */
  getMessages(sessionId: string, limit?: number): ConversationMessage[] {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) {
      return [];
    }

    if (typeof limit === 'number') {
      const boundedLimit = Math.floor(limit);
      if (!Number.isFinite(boundedLimit) || boundedLimit <= 0) {
        return [];
      }
      return conversation.messages.slice(-boundedLimit);
    }

    return [...conversation.messages];
  }

  /**
   * Add pending task to conversation
   */
  addPendingTask(sessionId: string, taskId: string, intent: string, prompt: string): void {
    const conversation = this.getConversation(sessionId);
    const now = Date.now();

    conversation.pendingTasks.set(taskId, {
      taskId,
      intent,
      prompt,
      dispatchedAt: now,
    });
    conversation.lastActivity = now;

    logger.debug(
      {
        sessionId,
        taskId,
        intent,
      },
      'Pending task added to conversation'
    );
  }

  /**
   * Handle task completion
   */
  handleTaskComplete(sessionId: string, result: BackendResult): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) {
      return;
    }

    // Remove from pending
    conversation.pendingTasks.delete(result.taskId);

    // Add result as assistant message
    const content = result.success
      ? (result.result ?? 'Task completed successfully')
      : `Task failed: ${result.error}`;

    this.addMessage(sessionId, 'assistant', content, {
      taskId: result.taskId,
      success: result.success,
    });

    logger.info(
      {
        sessionId,
        taskId: result.taskId,
        success: result.success,
      },
      'Task completed and added to conversation'
    );
  }

  /**
   * Get pending tasks for session
   */
  getPendingTasks(sessionId: string): PendingTaskInfo[] {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) {
      return [];
    }

    return Array.from(conversation.pendingTasks.values());
  }

  /**
   * End conversation
   */
  endConversation(sessionId: string): void {
    const conversation = this.conversations.get(sessionId);
    if (conversation) {
      logger.info(
        {
          sessionId,
          messageCount: conversation.messages.length,
          duration: Date.now() - conversation.startTime,
        },
        'Conversation ended'
      );

      this.conversations.delete(sessionId);
    }
  }

  /**
   * Clean up old conversations
   */
  cleanup(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, conversation] of this.conversations.entries()) {
      const age = now - conversation.lastActivity;

      if (age > this.maxConversationAge) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      this.endConversation(sessionId);
    }

    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Cleaned up expired conversations');
    }

    return expired;
  }

  /**
   * Get conversation context as string
   */
  getContextSummary(sessionId: string): string {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) {
      return '';
    }

    const recentMessages = conversation.messages.slice(-5);
    const summary = recentMessages
      .map((m) => `${m.role}: ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`)
      .join('\n');

    return summary;
  }

  /**
   * Create new conversation
   */
  private createConversation(sessionId: string): Conversation {
    const conversation: Conversation = {
      sessionId,
      messages: [],
      pendingTasks: new Map(),
      lastActivity: Date.now(),
      startTime: Date.now(),
    };

    this.conversations.set(sessionId, conversation);

    logger.info({ sessionId }, 'Conversation created');

    return conversation;
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalConversations: number;
    totalMessages: number;
    totalPendingTasks: number;
  } {
    let totalMessages = 0;
    let totalPendingTasks = 0;

    for (const conversation of this.conversations.values()) {
      totalMessages += conversation.messages.length;
      totalPendingTasks += conversation.pendingTasks.size;
    }

    return {
      totalConversations: this.conversations.size,
      totalMessages,
      totalPendingTasks,
    };
  }
}
