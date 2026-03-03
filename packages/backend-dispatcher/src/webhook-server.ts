/**
 * Webhook server for receiving backend callbacks
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import type { BackendResult } from '@voice-hub/shared-config';
import { SignatureVerifier, createSignatureMiddleware } from './verify-signature.js';
import { BackendClient } from './client.js';

const logger = pino({ name: 'WebhookServer' });

export interface WebhookServerConfig {
  port: number;
  host?: string;
  secret: string;
  backendClient: BackendClient;
  path?: string;
}

/**
 * Webhook server for receiving backend callbacks
 */
export class WebhookServer {
  private readonly config: WebhookServerConfig;
  private server: FastifyInstance | null = null;
  private signatureVerifier: SignatureVerifier;
  private isRunning = false;

  constructor(config: WebhookServerConfig) {
    this.config = config;
    this.signatureVerifier = new SignatureVerifier({
      secret: config.secret,
    });

    logger.info(
      {
        port: config.port,
        host: config.host ?? '0.0.0.0',
      },
      'WebhookServer initialized'
    );
  }

  /**
   * Start webhook server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('WebhookServer already running');
      return;
    }

    this.server = Fastify({
      logger: false, // Use our own logger
    });

    this.setupRawBodyParser();
    this.setupRoutes();

    const address = await this.server.listen({
      port: this.config.port,
      host: this.config.host ?? '0.0.0.0',
    });

    this.isRunning = true;
    logger.info({ address }, 'WebhookServer started');
  }

  /**
   * Stop webhook server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    await this.server.close();
    this.server = null;
    this.isRunning = false;

    logger.info('WebhookServer stopped');
  }

  /**
   * Ensure JSON payloads preserve raw body for signature verification
   */
  private setupRawBodyParser(): void {
    if (!this.server) {
      return;
    }

    this.server.removeContentTypeParser('application/json');
    this.server.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (request, body, done) => {
        const rawBody = typeof body === 'string' ? body : body.toString();
        request.rawBody = rawBody;

        try {
          done(null, JSON.parse(rawBody));
        } catch (error) {
          done(error as Error);
        }
      }
    );
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    if (!this.server) {
      return;
    }

    const path = this.config.path ?? '/webhook';

    // Health check
    this.server.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ status: 'ok' });
    });

    // Webhook endpoint
    this.server.post(
      path,
      {
        preHandler: createSignatureMiddleware(this.signatureVerifier),
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        await this.handleWebhook(request, reply);
      }
    );

    logger.info({ path }, 'Routes registered');
  }

  /**
   * Handle webhook callback
   */
  private async handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const result = this.parseResult(request.body);

      logger.info(
        {
          taskId: result.taskId,
          success: result.success,
        },
        'Received webhook callback'
      );

      // Forward to backend client
      const handled = this.config.backendClient.handleWebhookResult(result);

      if (!handled) {
        logger.warn({ taskId: result.taskId }, 'Unknown task in webhook');
      }

      // Acknowledge receipt
      return reply.code(202).send({ acknowledged: true });
    } catch (error) {
      logger.error({ error }, 'Error handling webhook');

      return reply.code(400).send({
        error: 'Invalid payload',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Parse result from request body
   */
  private parseResult(body: unknown): BackendResult {
    if (!body || typeof body !== 'object') {
      throw new Error('Invalid request body');
    }

    const data = body as Record<string, unknown>;

    // Validate required fields
    if (typeof data.taskId !== 'string') {
      throw new Error('Missing or invalid taskId');
    }

    if (typeof data.sessionId !== 'string') {
      throw new Error('Missing or invalid sessionId');
    }

    if (typeof data.success !== 'boolean') {
      throw new Error('Missing or invalid success flag');
    }

    if (data.result !== undefined && typeof data.result !== 'string') {
      throw new Error('Missing or invalid result');
    }

    if (data.error !== undefined && typeof data.error !== 'string') {
      throw new Error('Missing or invalid error');
    }

    let completedAt: number;
    if (data.completedAt === undefined) {
      completedAt = Date.now();
    } else if (typeof data.completedAt === 'number' && Number.isFinite(data.completedAt)) {
      completedAt = data.completedAt;
    } else {
      throw new Error('Missing or invalid completedAt');
    }

    return {
      taskId: data.taskId,
      sessionId: data.sessionId,
      success: data.success,
      result: data.result,
      error: data.error,
      completedAt,
    };
  }

  /**
   * Check if server is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
