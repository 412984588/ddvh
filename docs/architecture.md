# Architecture Documentation

## System Overview

Voice Hub is a distributed system that bridges Discord voice channels to Volcengine's Doubao Omni Realtime API. It supports full-duplex voice conversations with the ability to recognize and dispatch development tasks to backend workers.

## Components

### 1. Bridge Daemon (`apps/bridge-daemon`)

The main application that:

- Initializes Discord bot
- Manages voice connections
- Coordinates all components

**Key Files:**

- `src/index.ts` - Main entry point
- `src/discord-bot.ts` - Discord bot wrapper
- `src/voice-connection.ts` - Voice connection handler

### 2. Audio Engine (`packages/audio-engine`)

Handles audio processing between Discord and the provider.

**Components:**

- `AudioIngressPump` - Processes inbound audio from Discord
- `AudioEgressPump` - Manages outbound audio to Discord
- `Packetizer` - Aggregates frames into packets
- `Resampler` - Converts between sample rates
- `DiscordReceiveWatchdog` - Monitors audio reception health

### 3. Provider - Volcengine Omni (`packages/provider-volcengine-omni`)

WebSocket client for Doubao Omni Realtime API.

**Components:**

- `OmniClient` - Main WebSocket client
- `OmniSessionManager` - Session lifecycle management
- `BargeInStateMachine` - Voice interruption handling
- `MessageBuilder` - Protocol message construction
- `parseOmniEvent` - Event parsing from server

### 4. Memory Bank (`packages/memory-bank`)

SQLite-based storage for historical context.

**Components:**

- `DatabaseManager` - Connection management
- `PitfallQueries` - Query historical pitfalls
- `PatternQueries` - Query successful patterns
- `TaskRunQueries` - Query task history

### 5. Backend Dispatcher (`packages/backend-dispatcher`)

Async task dispatching and webhook handling.

**Components:**

- `BackendClient` - HTTP client for task dispatch
- `WebhookServer` - Fastify webhook receiver
- `SignatureVerifier` - Webhook signature verification

### 6. Core Runtime (`packages/core-runtime`)

Orchestrates all components.

**Components:**

- `SessionRegistry` - Active session tracking
- `ActiveConversationStore` - Conversation history
- `IntentInterceptor` - Intent detection and routing
- `ToolDispatcher` - Tool call routing
- `ResultAnnouncer` - Result announcements
- `RuntimeBootstrap` - Main coordinator

## Data Flow

### Voice Input Flow

```
Discord Voice (48kHz stereo)
    ↓
AudioIngressPump (decrypt, decode)
    ↓
Resampler (to 16kHz mono)
    ↓
Packetizer (aggregate to 200ms)
    ↓
OmniClient (WebSocket)
    ↓
Doubao Omni (processing)
```

### Voice Output Flow

```
Doubao Omni (audio response)
    ↓
OmniClient (WebSocket receive)
    ↓
AudioEgressPump (queue frames)
    ↓
Discord Voice (playback)
```

### Intent Dispatch Flow

```
User speech (transcribed by Omni)
    ↓
IntentInterceptor (detect intent)
    ↓
Memory Bank (retrieve context)
    ↓
BackendClient (POST /api/dispatch)
    ↓
Backend Worker (processing)
    ↓
WebhookServer (callback)
    ↓
ResultAnnouncer (announce result)
```

## State Management

### Session State

```
SessionState {
  sessionId: string
  userId: string
  guildId: string
  channelId: string
  state: CONNECTING | CONNECTED | DISCONNECTED | ERROR
  startTime: number
  lastActivity: number
  metadata: Record<string, unknown>
}
```

### Provider State

```
ProviderState {
  DISCONNECTED | CONNECTING | CONNECTED | SESSION_ACTIVE | ERROR
}
```

### Barge-in State

```
BargeInState {
  IDLE | LISTENING | INTERRUPTING | RECOVERING
}
```

## Configuration

All configuration is environment-based (see `.env.example`):

### Discord

- `DISCORD_BOT_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - Application client ID
- `DISCORD_GUILD_ID` - Test guild ID

### Volcengine Omni

- `VOLCENGINE_OMNI_ENDPOINT` - WebSocket endpoint
- `VOLCENGINE_OMNI_API_KEY` - API key
- `VOLCENGINE_OMNI_MODEL` - Model name

### Backend

- `BACKEND_DISPATCH_ENDPOINT` - Backend URL
- `BACKEND_WEBHOOK_SECRET` - Webhook signature secret
- `BACKEND_WEBHOOK_PORT` - Webhook server port

### Audio

- `AUDIO_SAMPLE_RATE` - Target sample rate (default: 16000)
- `AUDIO_CHANNELS` - Target channels (default: 1)
- `AUDIO_FRAME_DURATION_MS` - Frame duration (default: 200)

## Error Handling

### Error Categories

1. **Discord Errors** (`DISC_*`)
   - Connection failures
   - Authentication failures
   - Audio decrypt failures

2. **Provider Errors** (`PROV_*`)
   - WebSocket connection failures
   - Handshake failures
   - Parse errors

3. **Backend Errors** (`BACK_*`)
   - Dispatch failures
   - Webhook verification failures
   - Timeouts

### Recovery Strategies

1. **Audio Decrypt Failures**: Watchdog triggers, session recovery
2. **Provider Disconnect**: Auto-reconnect with exponential backoff
3. **Backend Timeout**: Task marked failed, user notified

## Performance Considerations

### Audio Latency

- Target: < 500ms end-to-end
- Packet size: 200ms (balance between latency and overhead)
- Frame duration: 20ms (Discord native)

### Memory Management

- Max concurrent sessions: 100
- Max queue size: 100 frames per egress pump
- Session timeout: 1 hour max, 10 min inactivity

### Concurrency

- Audio processing: Async (non-blocking)
- Backend dispatch: Async (non-blocking)
- Database operations: SQLite with WAL mode

## Security

### Secrets Management

- Never commit `.env` file
- Use environment variables for all secrets
- Rotate tokens regularly

### Webhook Verification

- HMAC SHA256 signature verification
- Constant-time comparison
- Timestamp-based replay protection

## Monitoring

### Health Checks

- `/health` endpoint on webhook server
- Smoke tests in `scripts/smoke-test.mjs`
- Doctor command for diagnostics

### Logging

- Structured logging with pino
- Log levels: trace, debug, info, warn, error, fatal
- Pretty print in development
