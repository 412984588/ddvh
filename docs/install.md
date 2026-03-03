# Installation Guide

Detailed installation instructions for Voice Hub.

## One-Click Installer

### GitHub raw install

```bash
curl -fsSL https://raw.githubusercontent.com/voice-hub/clawsc/main/scripts/install.sh | \
  bash -s -- --repo voice-hub/clawsc --target both --yes
```

### Local source install

```bash
bash scripts/install.sh --target both --source-dir "$(pwd)"
```

## Prerequisites

### Required

- **Node.js 22+**

  ```bash
  node --version  # Should show v22.x.x
  ```

- **pnpm 9+**

  ```bash
  npm install -g pnpm@9
  pnpm --version
  ```

- **Discord Bot**
  - Create a bot at https://discord.com/developers/applications
  - Enable **SERVER MEMBERS INTENT**
  - Enable **MESSAGE CONTENT INTENT**
  - Save the bot token

- **Volcengine Account**
  - Sign up at https://www.volcengine.com/
  - Get API credentials for Doubao Omni

## Project Setup

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd <repo-dir>
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Discord
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_test_guild_id_here

# Volcengine Omni
VOLCENGINE_OMNI_ENDPOINT=wss://doubao.com/v1/realtime
VOLCENGINE_OMNI_API_KEY=your_api_key_here
VOLCENGINE_OMNI_MODEL=omni-realtime-v1

# Backend (optional)
BACKEND_DISPATCH_ENDPOINT=http://localhost:3000/api/dispatch
BACKEND_WEBHOOK_SECRET=your_webhook_secret_here
BACKEND_WEBHOOK_PORT=8866

# Audio (optional, defaults shown)
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
AUDIO_FRAME_DURATION_MS=200

# Memory (optional)
MEMORY_DB_PATH=./data/memory.db

# Logging (optional)
LOG_LEVEL=info
LOG_PRETTY_PRINT=true
```

### 4. Build Packages

```bash
pnpm build
```

### 5. Verify Installation

```bash
pnpm smoke-test
```

All tests should pass.

For GitHub publish readiness, run:

```bash
pnpm preflight:github -- --repo <owner/repo> --strict
```

## Running the Daemon

### Development Mode

```bash
pnpm --filter @voice-hub/bridge-daemon start:dev
```

### Production Mode

```bash
pnpm --filter @voice-hub/bridge-daemon start
```

### Docker (Optional)

```bash
docker build -t voice-hub .
docker run -d --env-file .env voice-hub
```

## Plugin Installation

### OpenClaw Plugin

```bash
bash scripts/install.sh --target openclaw --source-dir "$(pwd)"
```

Legacy wrapper:

```bash
bash scripts/install-openclaw-local.sh
```

This installs the plugin to `~/.openclaw/plugins/voice-hub/`

### Claude Code Plugin

```bash
bash scripts/install.sh --target claude --source-dir "$(pwd)"
```

Legacy wrapper:

```bash
bash scripts/install-claude-plugin-local.sh
```

This installs the plugin to `~/.claude/marketplace/voice-hub/`

## Discord Bot Setup

### 1. Create Application

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Give it a name (e.g., "Voice Hub")
4. Agree to terms

### 2. Create Bot User

1. Go to "Bot" section
2. Click "Add Bot"
3. Copy the bot token to `.env`

### 3. Configure Intents

Under "Bot", enable:

- ✅ Presence Intent
- ✅ Server Members Intent
- ✅ Message Content Intent

### 4. OAuth2 Setup

Under "OAuth2", set:

- **Scopes**: bot, applications.commands
- **Bot Permissions**: CONNECT, SPEAK, PRIORITY_SPEAKER

### 5. Invite Bot

Use the OAuth2 URL generator to invite your bot to your test server.

## Troubleshooting

### "Cannot find module" Error

```bash
pnpm install
pnpm build
```

### "Module not found" Error in Runtime

Ensure all packages are built:

```bash
pnpm build
```

Check workspace references in `tsconfig.json` files.

### Discord Bot Not Responding

1. Check bot token is correct
2. Check bot has proper intents enabled
3. Check bot is in the server
4. Check logs for errors

### Omni Connection Failing

1. Check API key is valid
2. Check endpoint URL is correct
3. Check network connectivity
4. Enable debug logging: `LOG_LEVEL=debug`

### Port Already in Use

```bash
# Find process using port
lsof -i :8866

# Kill process
kill -9 <PID>
```

## Next Steps

- Read [Development Guide](dev.md)
- Review [Architecture](architecture.md)
- Join the community discussions
