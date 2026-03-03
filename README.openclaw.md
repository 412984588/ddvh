# Voice Hub for OpenClaw

OpenClaw plugin integration for Voice Hub.

## Installation

### One Command (Recommended)

```bash
bash scripts/install.sh --target openclaw --source-dir "$(pwd)"
```

### Manual Installation

```bash
# From the voice-hub root directory
bash scripts/install-openclaw-local.sh
```

### Manual Steps

1. Build the plugin:

```bash
pnpm --filter @voice-hub/openclaw-plugin build
```

2. Copy to OpenClaw plugins directory:

```bash
mkdir -p ~/.openclaw/plugins/voice-hub
cp packages/openclaw-plugin/openclaw.plugin.json ~/.openclaw/plugins/voice-hub/
cp -r packages/openclaw-plugin/dist ~/.openclaw/plugins/voice-hub/
```

3. Reload OpenClaw or restart your shell.

## Available Commands

### `voice-hub start`

Start the Voice Hub bridge daemon.

### `voice-hub stop`

Stop the Voice Hub bridge daemon.

### `voice-hub status`

Check the status of the Voice Hub daemon.

### `voice-hub doctor`

Run diagnostics on the Voice Hub setup.

### `voice-hub health`

Health check for all Voice Hub services.

## Environment Setup

Ensure these environment variables are set before using the plugin:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `VOLCENGINE_OMNI_ENDPOINT`
- `VOLCENGINE_OMNI_API_KEY`
- `VOLCENGINE_OMNI_MODEL`

## Troubleshooting

If the daemon fails to start:

1. Run `voice-hub doctor` to check configuration
2. Ensure all dependencies are installed: `pnpm install`
3. Check Discord bot token is valid
4. Verify Volcengine API credentials

## Development

To develop the OpenClaw plugin:

1. Make changes to `packages/openclaw-plugin/src/`
2. Build: `pnpm --filter @voice-hub/openclaw-plugin build`
3. Reinstall: `bash scripts/install-openclaw-local.sh`
4. Test in OpenClaw
