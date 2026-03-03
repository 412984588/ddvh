/**
 * Bridge Daemon - Main entry point
 *
 * This is the main application that:
 * - Initializes the Discord bot
 * - Sets up voice connection handling
 * - Coordinates between audio engine, provider, and runtime
 */

import 'dotenv/config';
import pino from 'pino';
import { PinoPretty } from 'pino-pretty';
import { validateEnv } from '@voice-hub/shared-config';
import { DiscordBot } from './discord-bot.js';
import { VoiceConnectionHandler } from './voice-connection.js';

// Setup logger
const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  PinoPretty({
    colorize: true,
    translateTime: 'HH:MM:ss',
    ignore: 'pid,hostname',
  })
);

/**
 * Main application class
 */
class BridgeDaemon {
  private bot: DiscordBot;
  private voiceHandler: VoiceConnectionHandler;
  private isRunning = false;
  private shutdownHandlersBound = false;

  constructor() {
    // Validate environment
    const env = validateEnv(process.env);

    // Initialize Discord bot
    this.bot = new DiscordBot({
      token: env.DISCORD_BOT_TOKEN,
      clientId: env.DISCORD_CLIENT_ID,
      guildId: env.DISCORD_GUILD_ID,
    });

    // Initialize voice handler with Discord client
    this.voiceHandler = new VoiceConnectionHandler(
      {
        omniEndpoint: env.VOLCENGINE_OMNI_ENDPOINT,
        omniApiKey: env.VOLCENGINE_OMNI_API_KEY,
        omniModel: env.VOLCENGINE_OMNI_MODEL,
        backendDispatchEndpoint: env.BACKEND_DISPATCH_ENDPOINT,
      },
      this.bot.getClient()
    );

    // Link bot and voice handler
    this.bot.setVoiceHandler(this.voiceHandler);

    logger.info('BridgeDaemon initialized');
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Daemon already running');
      return;
    }

    logger.info('Starting Bridge Daemon...');

    try {
      await this.bot.start();
      this.isRunning = true;

      logger.info(
        {
          activeConnections: this.voiceHandler.getConnectionCount(),
        },
        'Bridge Daemon started successfully'
      );

      this.setupGracefulShutdown();
    } catch (error) {
      logger.error({ error }, 'Failed to start daemon');
      throw error;
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    if (this.shutdownHandlersBound) {
      return;
    }

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');

      try {
        await this.stop();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    this.shutdownHandlersBound = true;
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Bridge Daemon...');

    await this.bot.stop();
    await this.voiceHandler.disconnectAll();

    this.isRunning = false;

    logger.info('Bridge Daemon stopped');
  }

  /**
   * Get daemon status
   */
  getStatus(): { isRunning: boolean; connections: number } {
    return {
      isRunning: this.isRunning,
      connections: this.voiceHandler.getConnectionCount(),
    };
  }
}

/**
 * Bootstrap and start daemon
 */
async function main(): Promise<void> {
  try {
    const daemon = new BridgeDaemon();
    await daemon.start();

    // Keep process alive
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled rejection');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start daemon');
    process.exit(1);
  }
}

// Start daemon if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { BridgeDaemon };
