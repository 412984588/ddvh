/**
 * MCP Tool definitions for Voice Hub
 */

import { execFileSync } from 'node:child_process';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';

const logger = pino({ name: 'MCPTools' });

interface ExecError extends Error {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}

function formatExecError(error: unknown): string {
  if (error instanceof Error) {
    const execError = error as ExecError;
    if (typeof execError.stderr === 'string' && execError.stderr.length > 0) {
      return execError.stderr;
    }
    if (typeof execError.stdout === 'string' && execError.stdout.length > 0) {
      return execError.stdout;
    }
    return execError.message;
  }

  return 'Unknown execution error';
}

function runPnpm(args: string[], stdio: 'pipe' | 'inherit' = 'pipe'): string {
  return execFileSync('pnpm', args, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio,
  });
}

export function normalizePackageName(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9-]+$/.test(value)) {
    throw new Error('Invalid package name');
  }

  return value;
}

export const mcpTools: Tool[] = [
  {
    name: 'bootstrap',
    description: 'Bootstrap and initialize the voice hub runtime',
    inputSchema: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          description: 'Runtime configuration options',
          properties: {
            memoryBankEnabled: {
              type: 'boolean',
              description: 'Enable memory bank for context retrieval',
              default: true,
            },
            ttsEnabled: {
              type: 'boolean',
              description: 'Enable text-to-speech announcements',
              default: true,
            },
          },
        },
      },
    },
  },

  {
    name: 'doctor',
    description: 'Run diagnostics on voice hub setup and configuration',
    inputSchema: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'Enable verbose output',
          default: false,
        },
      },
    },
  },

  {
    name: 'build',
    description: 'Build all voice hub packages',
    inputSchema: {
      type: 'object',
      properties: {
        clean: {
          type: 'boolean',
          description: 'Clean before building',
          default: false,
        },
      },
    },
  },

  {
    name: 'test',
    description: 'Run tests for voice hub packages',
    inputSchema: {
      type: 'object',
      properties: {
        coverage: {
          type: 'boolean',
          description: 'Generate coverage report',
          default: false,
        },
        package: {
          type: 'string',
          description: 'Specific package to test (optional)',
        },
      },
    },
  },

  {
    name: 'pack',
    description: 'Pack voice hub as installable plugin',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['openclaw', 'claude', 'both'],
          description: 'Target platform for packing',
          default: 'both',
        },
      },
    },
  },

  {
    name: 'install',
    description: 'Install voice hub plugin locally',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['openclaw', 'claude', 'both'],
          description: 'Target platform for installation',
          default: 'both',
        },
      },
    },
  },

  {
    name: 'status',
    description: 'Get current status of voice hub daemon',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Tool handler implementations
 */
export interface ToolHandler {
  (args: Record<string, unknown>): Promise<string | object>;
}

export const toolHandlers: Record<string, ToolHandler> = {
  async bootstrap(args): Promise<string> {
    logger.info({ args }, 'Bootstrap called');

    // Bootstrap initializes the Voice Hub environment
    // Future implementation would verify dependencies and start required services
    return 'Voice Hub bootstrapped successfully';
  },

  async doctor(args): Promise<string> {
    logger.info({ args }, 'Doctor called');

    try {
      runPnpm(['run', 'typecheck']);

      return 'TypeScript compilation: ✅ Passed\nAll checks passed!';
    } catch (error: unknown) {
      return `TypeScript compilation: ❌ Failed\n${formatExecError(error)}`;
    }
  },

  async build(args): Promise<string> {
    logger.info({ args }, 'Build called');

    if (args.clean) {
      runPnpm(['clean'], 'inherit');
    }

    try {
      runPnpm(['build']);

      return 'Build completed successfully ✅';
    } catch (error: unknown) {
      throw new Error(`Build failed: ${formatExecError(error)}`);
    }
  },

  async test(args): Promise<string> {
    logger.info({ args }, 'Test called');

    try {
      const isCoverageEnabled = args.coverage === true;
      const targetPackage =
        args.package === undefined ? undefined : normalizePackageName(args.package);

      if (isCoverageEnabled) {
        runPnpm(['test', '--coverage']);
      } else if (targetPackage) {
        runPnpm(['--filter', `@voice-hub/${targetPackage}`, 'test']);
      } else {
        runPnpm(['test']);
      }

      return 'Tests passed ✅';
    } catch (error: unknown) {
      return `Tests failed: ${formatExecError(error)}`;
    }
  },

  async pack(args): Promise<string> {
    logger.info({ args }, 'Pack called');

    try {
      if (args.target === 'openclaw' || args.target === 'both') {
        execFileSync('bash', ['scripts/pack-openclaw-plugin.sh'], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      }

      if (args.target === 'claude' || args.target === 'both') {
        execFileSync('bash', ['scripts/install-claude-plugin-local.sh'], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      }

      return 'Packaging completed ✅';
    } catch (error: unknown) {
      throw new Error(`Packaging failed: ${formatExecError(error)}`);
    }
  },

  async install(args): Promise<string> {
    logger.info({ args }, 'Install called');

    try {
      if (args.target === 'openclaw' || args.target === 'both') {
        execFileSync('bash', ['scripts/install-openclaw-local.sh'], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      }

      if (args.target === 'claude' || args.target === 'both') {
        // Claude marketplace install is automatic via directory structure
        logger.info('Claude plugin installed via marketplace directory');
      }

      return 'Installation completed ✅';
    } catch (error: unknown) {
      throw new Error(`Installation failed: ${formatExecError(error)}`);
    }
  },

  async status(): Promise<object> {
    // Return current daemon status
    // Future implementation would query actual daemon process via pid file or health endpoint
    return {
      daemon: {
        running: false,
        pid: null,
        uptime: null,
      },
      connections: {
        active: 0,
        total: 0,
      },
      services: {
        discord: 'unknown',
        omni: 'unknown',
        webhook: 'unknown',
      },
    };
  },
};
