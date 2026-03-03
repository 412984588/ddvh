/**
 * Discord Bot - Main bot instance and event handlers
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import type { VoiceState } from 'discord.js';
import pino from 'pino';
import type { VoiceConnectionHandler } from './voice-connection.js';

const logger = pino({ name: 'DiscordBot' });

export interface DiscordBotConfig {
  token: string;
  clientId: string;
  guildId?: string;
}

/**
 * Main Discord bot instance
 */
export class DiscordBot {
  private readonly config: DiscordBotConfig;
  private client: Client<true>;
  private voiceHandler: VoiceConnectionHandler | null = null;

  constructor(config: DiscordBotConfig) {
    this.config = config;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
      ],
      partials: [Partials.Channel],
    });

    this.setupEventHandlers();
    logger.info('DiscordBot instance created');
  }

  /**
   * Set voice connection handler
   */
  setVoiceHandler(handler: VoiceConnectionHandler): void {
    this.voiceHandler = handler;
  }

  /**
   * Start bot
   */
  async start(): Promise<void> {
    logger.info('Starting Discord bot...');

    await this.client.login(this.config.token);

    logger.info(
      {
        username: this.client.user.username,
        guilds: this.client.guilds.cache.size,
      },
      'Discord bot started'
    );
  }

  /**
   * Stop bot
   */
  async stop(): Promise<void> {
    logger.info('Stopping Discord bot...');

    // Disconnect from all voice channels
    if (this.voiceHandler) {
      await this.voiceHandler.disconnectAll();
    }

    this.client.destroy();

    logger.info('Discord bot stopped');
  }

  /**
   * Get client instance
   */
  getClient(): Client<true> {
    return this.client;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.client.once('ready', () => this.handleReady());
    this.client.on('voiceStateUpdate', (oldState, newState) =>
      this.handleVoiceStateUpdate(oldState, newState)
    );
    this.client.on('error', (error) => this.handleError(error));
  }

  /**
   * Handle ready event
   */
  private handleReady(): void {
    logger.info(
      {
        tag: this.client.user.tag,
        id: this.client.user.id,
        guilds: this.client.guilds.cache.size,
      },
      'Bot ready'
    );
  }

  /**
   * Handle voice state update
   */
  private handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): void {
    if (this.shouldIgnoreVoiceStateUpdate(oldState, newState)) {
      return;
    }

    // User switched voice channels
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      logger.debug(
        {
          userId: newState.id,
          fromChannelId: oldState.channelId,
          toChannelId: newState.channelId,
          guildId: newState.guild.id,
        },
        'User switched voice channels'
      );

      if (this.voiceHandler) {
        this.voiceHandler.handleUserLeave(newState.id);
        this.voiceHandler.handleUserJoin(newState.id, newState.guild.id, newState.channelId);
      }

      return;
    }

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      logger.debug(
        {
          userId: newState.id,
          channelId: newState.channelId,
          guildId: newState.guild.id,
        },
        'User joined voice channel'
      );

      if (this.voiceHandler) {
        this.voiceHandler.handleUserJoin(newState.id, newState.guild.id, newState.channelId);
      }
    }

    // User left a voice channel
    if (oldState.channelId && !newState.channelId) {
      logger.debug(
        {
          userId: newState.id,
          channelId: oldState.channelId,
          guildId: oldState.guild.id,
        },
        'User left voice channel'
      );

      if (this.voiceHandler) {
        this.voiceHandler.handleUserLeave(newState.id);
      }
    }
  }

  /**
   * Ignore bot/self voice events to avoid recursive connection handling
   */
  private shouldIgnoreVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): boolean {
    const user = newState.member?.user ?? oldState.member?.user;
    if (user?.bot) {
      return true;
    }

    if (this.client.user && newState.id === this.client.user.id) {
      return true;
    }

    return false;
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    logger.error({ error }, 'Discord client error');
  }
}
