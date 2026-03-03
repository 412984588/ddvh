/**
 * MCP Server for Voice Hub
 *
 * Provides Model Context Protocol server interface for Claude
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { mcpTools, toolHandlers } from './tools.js';

const logger = pino({
  name: 'VoiceHubMCPServer',
  level: process.env.LOG_LEVEL ?? 'info',
});

/**
 * Create and start MCP server
 */
async function main(): Promise<void> {
  logger.info('Starting Voice Hub MCP Server...');

  const server = new Server(
    {
      name: 'voice-hub',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all tools at once (using listTools method)
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpTools,
  }));

  // Register tool call handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler((args ?? {}) as Record<string, unknown>);

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error({ error, tool: name }, 'Tool execution failed');

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Voice Hub MCP Server running on stdio');
}

// Start server
main().catch((error) => {
  logger.error({ error }, 'Failed to start MCP server');
  process.exit(1);
});

export { main };
