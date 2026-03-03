/**
 * OpenClaw Plugin - Voice Hub Integration
 *
 * Provides commands to manage the voice hub bridge daemon
 */

import pino from 'pino';

const logger = pino({ name: 'OpenClawPlugin' });

export interface PluginContext {
  cwd: string;
  env: Record<string, string>;
  exec: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

export interface CommandHandler {
  (context: PluginContext): Promise<string>;
}

/**
 * Plugin command handlers
 */
export const pluginCommands: Record<string, CommandHandler> = {
  /**
   * Start the bridge daemon
   */
  async start(context: PluginContext): Promise<string> {
    logger.info('Starting bridge daemon...');

    const { stderr } = await context.exec('pnpm --filter @voice-hub/bridge-daemon start');

    if (stderr) {
      throw new Error(`Failed to start: ${stderr}`);
    }

    return 'Voice Hub bridge daemon started successfully';
  },

  /**
   * Stop the bridge daemon
   */
  async stop(_context: PluginContext): Promise<string> {
    logger.info('Stopping bridge daemon...');

    // Daemon stop would use pid file or process signal
    // For now, provide user guidance
    return 'To stop the daemon, use Ctrl+C in the terminal or kill the process';
  },

  /**
   * Check daemon status
   */
  async status(_context: PluginContext): Promise<string> {
    logger.info('Checking daemon status...');

    // Status check would use pid file or health endpoint
    return 'Status: Daemon status unknown (use doctor for diagnostics)';
  },

  /**
   * Run diagnostics
   */
  async doctor(context: PluginContext): Promise<string> {
    logger.info('Running diagnostics...');

    const { doctor } = await import('./doctor.js');
    return doctor(context);
  },

  /**
   * Health check
   */
  async health(context: PluginContext): Promise<string> {
    logger.info('Running health check...');

    const checks = [checkEnvironment, checkDependencies, checkDiscord, checkOmni];

    const results: string[] = [];

    for (const check of checks) {
      try {
        results.push(await check(context));
      } catch (error) {
        results.push(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results.join('\n');
  },
};

/**
 * Check environment variables
 */
async function checkEnvironment(context: PluginContext): Promise<string> {
  const required = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'VOLCENGINE_OMNI_ENDPOINT',
    'VOLCENGINE_OMNI_API_KEY',
    'VOLCENGINE_OMNI_MODEL',
  ];

  const missing = required.filter((key) => !context.env[key]);

  if (missing.length === 0) {
    return '✅ Environment variables: All required variables set';
  }

  return `❌ Environment variables: Missing ${missing.join(', ')}`;
}

/**
 * Check dependencies
 */
async function checkDependencies(context: PluginContext): Promise<string> {
  const { stdout } = await context.exec('pnpm list --depth=0');

  const hasDiscord = stdout.includes('discord.js');
  const hasVoice = stdout.includes('@discordjs/voice');

  if (hasDiscord && hasVoice) {
    return '✅ Dependencies: All required packages installed';
  }

  return '❌ Dependencies: Missing required packages. Run: pnpm install';
}

/**
 * Check Discord connection
 */
async function checkDiscord(context: PluginContext): Promise<string> {
  if (!context.env.DISCORD_BOT_TOKEN) {
    return '⚠️ Discord: No token configured';
  }

  return '✅ Discord: Token configured (connection test requires start command)';
}

/**
 * Check Omni configuration
 */
async function checkOmni(context: PluginContext): Promise<string> {
  const endpoint = context.env.VOLCENGINE_OMNI_ENDPOINT;
  const apiKey = context.env.VOLCENGINE_OMNI_API_KEY;

  if (endpoint && apiKey) {
    return `✅ Omni: Configured (${endpoint})`;
  }

  return '❌ Omni: Missing endpoint or API key';
}
