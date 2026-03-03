/**
 * VoiceConnectionHandler - Manages Discord voice connections
 *
 * Responsibilities:
 * - Join/leave voice channels
 * - Manage audio streams
 * - Coordinate with audio engine and provider
 */

import { joinVoiceChannel } from '@discordjs/voice';
import { EndBehaviorType } from '@discordjs/voice';
import type { DiscordGatewayAdapterCreator, VoiceConnection } from '@discordjs/voice';
import type { Snowflake, Client } from 'discord.js';
import prism from 'prism-media';
import pino from 'pino';
import {
  AudioIngressPump,
  AudioEgressPump,
  Packetizer,
  type PacketizedAudio,
} from '@voice-hub/audio-engine';
import { BackendClient } from '@voice-hub/backend-dispatcher';
import { ToolDispatcher } from '@voice-hub/core-runtime';
import {
  OmniClient,
  ProviderEvent,
  type ProviderEventPayload,
} from '@voice-hub/provider-volcengine-omni';

const logger = pino({ name: 'VoiceConnectionHandler' });

export interface VoiceConnectionHandlerConfig {
  omniEndpoint: string;
  omniApiKey: string;
  omniModel: string;
  backendDispatchEndpoint: string;
  backendDispatchApiKey?: string;
  backendTimeoutMs?: number;
}

interface ActiveConnection {
  sessionId: string;
  userId: Snowflake;
  guildId: Snowflake;
  channelId: Snowflake;
  voiceConnection: VoiceConnection;
  ingressPump: AudioIngressPump;
  egressPump: AudioEgressPump;
  omniClient: OmniClient;
  packetizer: Packetizer;
}

/**
 * Handles Discord voice connections
 */
export class VoiceConnectionHandler {
  private readonly config: VoiceConnectionHandlerConfig;
  private readonly discordClient: Client<true>;
  private readonly backendClient: BackendClient;
  private connections: Map<Snowflake, ActiveConnection> = new Map();
  private connectionByUser: Map<Snowflake, ActiveConnection> = new Map();
  private pendingConnections: Map<string, Promise<ActiveConnection>> = new Map();

  constructor(config: VoiceConnectionHandlerConfig, discordClient: Client<true>) {
    this.config = config;
    this.discordClient = discordClient;
    this.backendClient = new BackendClient({
      endpoint: config.backendDispatchEndpoint,
      apiKey: config.backendDispatchApiKey,
      timeout: config.backendTimeoutMs,
    });
    logger.info('VoiceConnectionHandler initialized');
  }

  /**
   * Handle user joining voice channel
   */
  async handleUserJoin(userId: Snowflake, guildId: Snowflake, channelId: Snowflake): Promise<void> {
    // Check if user already has active connection
    if (this.connectionByUser.has(userId)) {
      logger.debug({ userId }, 'User already has active connection');
      return;
    }

    const sharedConnection = this.findConnectionByGuildChannel(guildId, channelId);
    if (sharedConnection) {
      this.connectionByUser.set(userId, sharedConnection);
      logger.info(
        { userId, sessionId: sharedConnection.sessionId, guildId, channelId },
        'Reusing existing voice connection for user'
      );
      return;
    }

    const guildChannelKey = this.getGuildChannelKey(guildId, channelId);
    const pendingConnection = this.pendingConnections.get(guildChannelKey);
    if (pendingConnection) {
      try {
        const connection = await pendingConnection;
        this.connectionByUser.set(userId, connection);
        logger.info(
          { userId, sessionId: connection.sessionId, guildId, channelId },
          'Attached user to pending voice connection'
        );
      } catch (error) {
        logger.error({ error, userId, guildId, channelId }, 'Pending voice connection failed');
      }
      return;
    }

    logger.info({ userId, guildId, channelId }, 'User joined voice channel');
    const createPromise = this.createConnection(userId, guildId, channelId)
      .then((connection) => {
        this.connectionByUser.set(userId, connection);
        return connection;
      })
      .finally(() => {
        this.pendingConnections.delete(guildChannelKey);
      });

    this.pendingConnections.set(guildChannelKey, createPromise);

    try {
      await createPromise;
    } catch (error) {
      logger.error({ error, userId, guildId, channelId }, 'Failed to create voice connection');
    }
  }

  /**
   * Handle user leaving voice channel
   */
  handleUserLeave(userId: Snowflake): void {
    const connection = this.connectionByUser.get(userId);

    if (connection) {
      logger.info({ userId, sessionId: connection.sessionId }, 'User left voice channel');
      this.connectionByUser.delete(userId);

      const hasOtherUsers = Array.from(this.connectionByUser.values()).some(
        (active) => active.sessionId === connection.sessionId
      );
      if (hasOtherUsers) {
        logger.info(
          { userId, sessionId: connection.sessionId },
          'Keeping shared voice connection for remaining users'
        );
        return;
      }

      this.destroyConnection(connection.sessionId);
    }
  }

  /**
   * Find active connection by guild + channel (shared bot voice session)
   */
  private findConnectionByGuildChannel(
    guildId: Snowflake,
    channelId: Snowflake
  ): ActiveConnection | undefined {
    return Array.from(this.connections.values()).find(
      (connection) => connection.guildId === guildId && connection.channelId === channelId
    );
  }

  private getGuildChannelKey(guildId: Snowflake, channelId: Snowflake): string {
    return `${guildId}:${channelId}`;
  }

  /**
   * Create voice connection
   */
  private async createConnection(
    userId: Snowflake,
    guildId: Snowflake,
    channelId: Snowflake
  ): Promise<ActiveConnection> {
    const sessionId = this.generateSessionId();

    logger.info({ sessionId, userId, channelId }, 'Creating voice connection');

    // Create Omni client
    const omniClient = new OmniClient({
      endpoint: this.config.omniEndpoint,
      apiKey: this.config.omniApiKey,
      model: this.config.omniModel,
      audio: {
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm16',
      },
      autoReconnect: true,
    });

    // Create packetizer
    const packetizer = new Packetizer({
      targetDurationMs: 200,
      onPacket: (packet) => {
        // Send packet to Omni
        this.sendPacketToOmni(omniClient, packet);
      },
    });

    // Create audio pumps
    const ingressPump = new AudioIngressPump({
      packetizer,
      targetSampleRate: 16000,
      targetChannels: 1,
      frameDurationMs: 200,
    });

    let voiceConnection: VoiceConnection | null = null;
    let egressPump: AudioEgressPump | null = null;

    try {
      // Join voice channel
      const guild = await this.discordClient.guilds.fetch(guildId);
      voiceConnection = joinVoiceChannel({
        channelId,
        guildId,
        selfDeaf: false,
        selfMute: false,
        adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      });

      egressPump = new AudioEgressPump({
        voiceConnection,
        bufferSize: 100,
      });
      const toolDispatcher = new ToolDispatcher(
        this.backendClient,
        {
          defaultTimeout: this.config.backendTimeoutMs ?? 30000,
          enableLocalHandlers: false,
        },
        omniClient
      );

      // Setup Omni client events
      this.setupOmniEvents(omniClient, sessionId, egressPump, toolDispatcher);

      // Connect to Omni
      await omniClient.connect();
      const omniSessionId = await omniClient.startSession();
      logger.info({ omniSessionId }, 'Omni session started');

      // Create active connection record
      const connection: ActiveConnection = {
        sessionId,
        userId,
        guildId,
        channelId,
        voiceConnection,
        ingressPump,
        egressPump,
        omniClient,
        packetizer,
      };

      this.connections.set(sessionId, connection);
      this.startInboundAudioCapture(voiceConnection, userId, ingressPump, sessionId);

      logger.info({ sessionId }, 'Voice connection created');
      return connection;
    } catch (error) {
      ingressPump.stop();
      egressPump?.destroy();
      omniClient.disconnect();
      voiceConnection?.destroy();
      packetizer.clear();
      throw error;
    }
  }

  /**
   * Subscribe to Discord opus stream and decode to PCM16 for ingress processing
   */
  private startInboundAudioCapture(
    voiceConnection: VoiceConnection,
    userId: Snowflake,
    ingressPump: AudioIngressPump,
    sessionId: string
  ): void {
    try {
      const opusStream = voiceConnection.receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.Manual,
        },
      });

      const decoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000,
      });

      opusStream.on('error', (error: Error) => {
        logger.error({ sessionId, userId, error }, 'Discord opus stream error');
      });
      decoder.on('error', (error: Error) => {
        logger.error({ sessionId, userId, error }, 'Opus decode error');
      });

      ingressPump.start(opusStream.pipe(decoder));
      logger.info({ sessionId, userId }, 'Inbound audio capture started');
    } catch (error) {
      logger.error(
        { sessionId, userId, error },
        'Failed to start inbound audio capture. Install opusscript or @discordjs/opus.'
      );
    }
  }

  /**
   * Setup Omni client events
   */
  private setupOmniEvents(
    omniClient: OmniClient,
    sessionId: string,
    egressPump: AudioEgressPump,
    toolDispatcher: Pick<ToolDispatcher, 'handleToolCall'>
  ): void {
    omniClient.on(
      ProviderEvent.AUDIO_RECEIVED,
      (payload: ProviderEventPayload[ProviderEvent.AUDIO_RECEIVED]) => {
        // Send audio to Discord
        this.sendAudioToDiscord(egressPump, payload.data);
      }
    );

    omniClient.on(
      ProviderEvent.TOOL_CALL,
      (payload: ProviderEventPayload[ProviderEvent.TOOL_CALL]) => {
        logger.info(
          {
            sessionId,
            toolName: payload.toolName,
            parameters: payload.parameters,
          },
          'Tool call received from Omni'
        );
        void this.routeToolCall(sessionId, payload, omniClient, toolDispatcher);
      }
    );

    omniClient.on(ProviderEvent.ERROR, (payload: ProviderEventPayload[ProviderEvent.ERROR]) => {
      logger.error(
        {
          sessionId,
          code: payload.code,
          message: payload.message,
        },
        'Omni error'
      );
    });

    omniClient.on(
      ProviderEvent.DISCONNECTED,
      (payload: ProviderEventPayload[ProviderEvent.DISCONNECTED]) => {
        logger.warn(
          {
            sessionId,
            code: payload.code,
            reason: payload.reason,
          },
          'Omni disconnected'
        );
      }
    );
  }

  /**
   * Route provider tool call through dispatcher and report result back to Omni
   */
  private async routeToolCall(
    sessionId: string,
    payload: ProviderEventPayload[ProviderEvent.TOOL_CALL],
    omniClient: Pick<OmniClient, 'sendToolResult'>,
    toolDispatcher: Pick<ToolDispatcher, 'handleToolCall'>
  ): Promise<void> {
    try {
      const result = await toolDispatcher.handleToolCall({
        sessionId,
        toolId: payload.toolId,
        toolName: payload.toolName,
        parameters: payload.parameters,
      });

      if (result.success) {
        omniClient.sendToolResult(payload.toolId, result.data ?? { status: 'accepted' });
        logger.info({ sessionId, toolId: payload.toolId }, 'Tool call routed successfully');
        return;
      }

      const errorMessage = result.error ?? 'Tool execution failed';
      omniClient.sendToolResult(payload.toolId, undefined, errorMessage);
      logger.warn(
        { sessionId, toolId: payload.toolId, error: errorMessage },
        'Tool call routing failed'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown tool routing error';
      omniClient.sendToolResult(payload.toolId, undefined, message);
      logger.error(
        { sessionId, toolId: payload.toolId, error: message },
        'Tool call routing crashed'
      );
    }
  }

  /**
   * Send packet to Omni
   */
  private sendPacketToOmni(omniClient: OmniClient, packet: PacketizedAudio): void {
    for (const frame of packet.frames) {
      omniClient.sendAudioFrame(frame.data);
    }
  }

  /**
   * Send audio to Discord
   */
  private sendAudioToDiscord(egressPump: AudioEgressPump, data: Buffer): void {
    egressPump.addFrame({
      data,
      sampleRate: 48000,
      channels: 2,
      timestamp: Date.now(),
    });
  }

  /**
   * Destroy connection
   */
  private destroyConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);

    if (!connection) {
      return;
    }

    logger.info({ sessionId }, 'Destroying connection');

    // Stop ingress pump
    connection.ingressPump.stop();

    // Stop egress pump
    connection.egressPump.destroy();

    // End Omni session
    connection.omniClient.disconnect();

    // Destroy Discord voice connection
    connection.voiceConnection.destroy();

    // Remove from tracking
    this.connections.delete(sessionId);
    for (const [userId, activeConnection] of this.connectionByUser.entries()) {
      if (activeConnection.sessionId === sessionId) {
        this.connectionByUser.delete(userId);
      }
    }

    // Leave Discord voice channel
    // This is handled by the bot's voice connection cleanup
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    logger.info('Disconnecting all voice connections');

    const sessionIds = Array.from(this.connections.keys());

    for (const sessionId of sessionIds) {
      this.destroyConnection(sessionId);
    }

    logger.info('All voice connections disconnected');
  }

  /**
   * Get connection by user
   */
  getConnectionByUser(userId: Snowflake): ActiveConnection | undefined {
    return this.connectionByUser.get(userId);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): ActiveConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
