/**
 * Shared type definitions for Voice Hub
 */

/**
 * Discord user information
 */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

/**
 * Discord guild (server) information
 */
export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
}

/**
 * Discord channel information
 */
export interface DiscordChannel {
  id: string;
  name: string;
  type: ChannelType;
  guildId: string;
}

/**
 * Discord channel types
 */
export enum ChannelType {
  GUILD_TEXT = 0,
  GUILD_VOICE = 2,
  GUILD_STAGE_CHANNEL = 13,
}

/**
 * Voice connection state
 */
export enum VoiceConnectionState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * Audio frame format
 */
export interface AudioFrame {
  data: Buffer;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

/**
 * Session state for active conversations
 */
export interface SessionState {
  sessionId: string;
  userId: string;
  guildId: string;
  channelId: string;
  state: VoiceConnectionState;
  startTime: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

/**
 * Backend dispatch task
 */
export interface BackendTask {
  taskId: string;
  sessionId: string;
  intent: string;
  prompt: string;
  context?: TaskContext;
  createdAt: number;
}

/**
 * Task context for augmentation
 */
export interface TaskContext {
  pitfalls?: Pitfall[];
  successfulPatterns?: SuccessfulPattern[];
  previousRuns?: TaskRun[];
}

/**
 * Historical pitfall record
 */
export interface Pitfall {
  id: string;
  category: string;
  description: string;
  symptoms: string[];
  solution: string;
  keywords: string[];
  severity: 'low' | 'medium' | 'high';
  createdAt: number;
}

/**
 * Successful pattern record
 */
export interface SuccessfulPattern {
  id: string;
  category: string;
  description: string;
  approach: string;
  keywords: string[];
  effectiveness: number;
  createdAt: number;
}

/**
 * Task execution history
 */
export interface TaskRun {
  id: string;
  sessionId: string;
  intent: string;
  prompt: string;
  result?: string;
  error?: string;
  duration: number;
  success: boolean;
  createdAt: number;
}

/**
 * Backend dispatch result
 */
export interface BackendResult {
  taskId: string;
  sessionId: string;
  success: boolean;
  result?: string;
  error?: string;
  completedAt: number;
}

/**
 * Tool/intent types
 */
export enum ToolIntent {
  DISPATCH_TASK_TO_BACKEND = 'dispatch_task_to_backend',
  // Future intents can be added here
}

/**
 * Tool execution result
 */
export interface ToolResult {
  intent: ToolIntent;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Barge-in state for voice interruption
 */
export enum BargeInState {
  IDLE = 'idle',
  LISTENING = 'listening',
  INTERRUPTING = 'interrupting',
  RECOVERING = 'recovering',
}

/**
 * Audio packet format
 */
export interface AudioPacket {
  frames: AudioFrame[];
  packetId: string;
  timestamp: number;
  duration: number;
}

/**
 * Provider event types
 */
export enum ProviderEventType {
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  AUDIO_RECEIVED = 'audio_received',
  TOOL_CALL = 'tool_call',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}
