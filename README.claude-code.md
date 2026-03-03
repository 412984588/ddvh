# Voice Hub for Claude Code

Claude Code integration for Voice Hub development.

## Installation

### Automatic Installation

```bash
# Recommended unified installer
bash scripts/install.sh --target claude --source-dir "$(pwd)"
```

### Legacy Wrapper

```bash
# From the voice-hub root directory
bash scripts/install-claude-plugin-local.sh
```

### Manual Installation

1. Create the marketplace directory structure:

```bash
mkdir -p ~/.claude/marketplace/voice-hub/plugins/voice-hub-dev/skills
```

2. Copy plugin files:

```bash
cp -r packages/claude-marketplace/* ~/.claude/marketplace/voice-hub/
```

3. Restart Claude Code to detect the plugin.

## Available Skills

### Scaffold

Create new components or features in the Voice Hub monorepo.

**Usage:**

```
"scaffold a new audio processor"
"scaffold a new provider adapter"
```

### Doctor

Run diagnostics on Voice Hub setup and configuration.

**Usage:**

```
"run voice hub doctor"
"check if voice hub is properly configured"
```

### Pack

Package Voice Hub as installable plugins.

**Usage:**

```
"pack voice hub for installation"
"prepare voice hub plugins"
```

## MCP Server

The plugin also includes an MCP server that provides the following tools:

- `bootstrap` - Initialize the voice hub runtime
- `doctor` - Run diagnostics
- `build` - Build all packages
- `test` - Run tests
- `pack` - Package for distribution
- `install` - Install plugins locally
- `status` - Get daemon status

## Development Workflow

1. Make changes to Voice Hub code
2. Run `pnpm build` to build packages
3. Use Claude Code to test changes
4. Commit and push

## Project Context

When working with Voice Hub in Claude Code, the plugin provides:

- Workspace awareness of all packages
- Type information from shared-config
- Knowledge of project architecture
- Access to documentation

## Troubleshooting

If the plugin isn't detected:

1. Verify the marketplace directory exists:

```bash
ls -la ~/.claude/marketplace/voice-hub/
```

2. Check the MCP server is built:

```bash
ls -la packages/claude-mcp-server/dist/
```

3. Restart Claude Code completely
