/**
 * RuntimeBootstrap - Bootstraps and coordinates all runtime components
 *
 * Responsibilities:
 * - Initialize all runtime components
 * - Wire up component dependencies
 * - Coordinate lifecycle
 * - Provide unified API
 */

import pino from 'pino';
import { SessionRegistry } from './SessionRegistry.js';
import { ActiveConversationStore } from './ActiveConversationStore.js';
import { IntentInterceptor, type InterceptedIntent } from './IntentInterceptor.js';
import { ResultAnnouncer } from './ResultAnnouncer.js';
import { ToolDispatcher } from './ToolDispatcher.js';
import type { AudioEgressPump } from '@voice-hub/audio-engine';
import type { OmniClient } from '@voice-hub/provider-volcengine-omni';
import type { BackendClient, WebhookServer } from '@voice-hub/backend-dispatcher';
import { ToolIntent, type BackendResult, type ToolResult } from '@voice-hub/shared-config';

const logger = pino({ name: 'RuntimeBootstrap' });

/**
 * Main runtime bootstrap and coordinator
 */
export class RuntimeBootstrap {
  private readonly config: VoiceRuntimeConfig;
  private sessionRegistry: SessionRegistry;
  private conversationStore: ActiveConversationStore;
  private intentInterceptor: IntentInterceptor;
  private resultAnnouncer: ResultAnnouncer | null = null;
  private toolDispatcher!: ToolDispatcher; // Initialized in initialize()
  private isInitialized = false;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: VoiceRuntimeConfig) {
    this.config = config;

    // Initialize core components
    this.sessionRegistry = new SessionRegistry();
    this.conversationStore = new ActiveConversationStore();
    this.intentInterceptor = new IntentInterceptor({
      enableMemoryBank: config.memoryBank?.enabled ?? true,
      maxPitfalls: config.memoryBank?.maxPitfalls ?? 5,
      maxPatterns: config.memoryBank?.maxPatterns ?? 5,
      maxHistory: config.memoryBank?.maxHistory ?? 10,
    });

    logger.info('RuntimeBootstrap created');
  }

  /**
   * Initialize runtime with external dependencies
   */
  async initialize(dependencies: RuntimeDependencies): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Runtime already initialized');
      return;
    }

    logger.info('Initializing runtime...');

    try {
      // Initialize tool dispatcher with omniClient
      this.toolDispatcher = new ToolDispatcher(
        dependencies.backendClient,
        {
          defaultTimeout: this.config.backend?.timeoutMs ?? 30000,
          enableLocalHandlers: this.config.localHandlers?.enabled ?? false,
        },
        dependencies.omniClient
      );

      // Register webhook handler
      if (dependencies.webhookServer) {
        this.setupWebhookHandling(dependencies.webhookServer);
      }

      // Initialize result announcer if audio pump and omni client provided
      if (dependencies.audioPump && dependencies.omniClient) {
        this.resultAnnouncer = new ResultAnnouncer(
          {
            ttsEnabled: this.config.announcer?.ttsEnabled ?? true,
            maxQueueSize: this.config.announcer?.maxQueueSize ?? 50,
            defaultPriority: this.config.announcer?.defaultPriority ?? 5,
          },
          dependencies.audioPump,
          dependencies.omniClient
        );
      }

      // Register intent handlers
      this.registerIntentHandlers();

      // Start cleanup interval
      this.startCleanup();

      this.isInitialized = true;
      logger.info('Runtime initialized successfully');
    } catch (error) {
      this.rollbackInitialize();
      logger.error({ error }, 'Runtime initialization failed');
      throw error;
    }
  }

  /**
   * Setup webhook handling
   */
  private setupWebhookHandling(_webhookServer: WebhookServer): void {
    // The webhook server is already configured with the backend client
    // We just need to ensure results are forwarded to the runtime
    logger.info('Webhook handling configured');
  }

  /**
   * Register intent handlers
   */
  private registerIntentHandlers(): void {
    // Register dispatch task handler
    this.intentInterceptor.on(ToolIntent.DISPATCH_TASK_TO_BACKEND, async (intent, sessionId) => {
      return this.handleDispatchIntent(intent, sessionId);
    });

    logger.info('Intent handlers registered');
  }

  /**
   * Handle dispatch intent
   */
  private async handleDispatchIntent(
    intent: InterceptedIntent,
    sessionId: string
  ): Promise<ToolResult> {
    const prompt = intent.augmentedPrompt ?? intent.originalInput;

    return this.toolDispatcher.handleToolCall({
      sessionId,
      toolId: `intent_${Date.now()}`,
      toolName: intent.intent,
      parameters: { prompt },
    });
  }

  /**
   * Start session for user
   */
  startSession(userId: string, guildId: string, channelId: string): string {
    const sessionId = this.generateSessionId();
    this.sessionRegistry.createSession(sessionId, userId, guildId, channelId);

    // Initialize conversation
    this.conversationStore.getConversation(sessionId);

    logger.info(
      {
        sessionId,
        userId,
        guildId,
        channelId,
      },
      'Session started'
    );

    return sessionId;
  }

  /**
   * End session
   */
  endSession(sessionId: string): void {
    this.sessionRegistry.endSession(sessionId);
    this.conversationStore.endConversation(sessionId);

    logger.info({ sessionId }, 'Session ended');
  }

  /**
   * Process incoming audio/text
   */
  async processInput(sessionId: string, input: string): Promise<void> {
    if (!this.sessionRegistry.getSession(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add to conversation
    this.conversationStore.addMessage(sessionId, 'user', input);

    // Intercept for intents
    const result = await this.intentInterceptor.intercept(sessionId, input);

    if (result) {
      // Handle intent result
      await this.handleIntentResult(sessionId, result);
    }
  }

  /**
   * Handle intent result
   */
  private async handleIntentResult(sessionId: string, result: ToolResult): Promise<void> {
    const taskId = this.extractTaskId(result.data);
    if (result.success && taskId) {
      this.sessionRegistry.addPendingTask(sessionId, taskId);
      this.conversationStore.addPendingTask(
        sessionId,
        taskId,
        'dispatch_task',
        'Task dispatched to backend'
      );
    }
  }

  private extractTaskId(data: ToolResult['data']): string | null {
    if (typeof data !== 'object' || data === null || !('taskId' in data)) {
      return null;
    }

    const taskId = (data as { taskId?: unknown }).taskId;
    return typeof taskId === 'string' ? taskId : null;
  }

  /**
   * Handle backend result
   */
  handleBackendResult(result: BackendResult): void {
    // Forward to tool dispatcher
    this.toolDispatcher?.handleWebhookResult(result);

    // Add to conversation
    this.conversationStore.handleTaskComplete(result.sessionId, result);

    // Announce if enabled
    if (this.resultAnnouncer) {
      this.resultAnnouncer.announce(result);
    }

    // Remove from pending
    this.sessionRegistry.removePendingTask(result.sessionId, result.taskId);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string) {
    return this.sessionRegistry.getSession(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return this.sessionRegistry.getAllSessions();
  }

  /**
   * Get runtime status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      sessions: this.sessionRegistry.getStats(),
      conversations: this.conversationStore.getStats(),
      toolDispatcher: this.toolDispatcher?.getStatus(),
      announcer: this.resultAnnouncer?.getStatus(),
    };
  }

  /**
   * Shutdown runtime
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down runtime...');

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // End all sessions
    for (const session of this.sessionRegistry.getAllSessions()) {
      this.endSession(session.sessionId);
    }

    this.isInitialized = false;
    logger.info('Runtime shutdown complete');
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.cleanupInterval = setInterval(() => {
      this.sessionRegistry.cleanup();
      this.conversationStore.cleanup();
      this.toolDispatcher?.cleanup();
    }, 60000); // Every minute
  }

  private rollbackInitialize(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.toolDispatcher?.cleanup();
    this.resultAnnouncer?.clear();
    this.resultAnnouncer = null;
    this.isInitialized = false;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Runtime dependencies
 */
export interface RuntimeDependencies {
  backendClient: BackendClient;
  webhookServer?: WebhookServer;
  audioPump?: AudioEgressPump;
  omniClient?: OmniClient;
}

/**
 * Runtime configuration
 */
export interface VoiceRuntimeConfig {
  memoryBank?: {
    enabled: boolean;
    maxPitfalls: number;
    maxPatterns: number;
    maxHistory: number;
  };
  backend?: {
    timeoutMs: number;
  };
  localHandlers?: {
    enabled: boolean;
  };
  announcer?: {
    ttsEnabled: boolean;
    maxQueueSize: number;
    defaultPriority: number;
  };
}
