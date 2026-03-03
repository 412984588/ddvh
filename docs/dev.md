# Ddvh Development Guide

This guide covers development workflows and patterns for Ddvh.

## Getting Started

### Initial Setup

```bash
# Clone and install
git clone <repo-url>
cd ddvh
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Build all packages
pnpm build

# Run smoke tests
pnpm smoke-test
```

### Running the Daemon

```bash
# Development mode (with hot reload)
pnpm --filter @voice-hub/bridge-daemon start:dev

# Production mode
pnpm --filter @voice-hub/bridge-daemon start
```

## Package Development

### Creating a New Package

```bash
# Use the scaffold skill
cd packages/
mkdir your-package
cd your-package
pnpm init
```

Or use the Claude skill:

```
"scaffold a new package called 'xyz' in packages/"
```

### Package Structure

Each package should follow this structure:

```
packages/your-package/
├── src/
│   ├── index.ts          # Public API exports
│   ├── types.ts          # Type definitions
│   └── impl.ts           # Implementation
├── test/
│   └── *.test.ts         # Tests
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── README.md             # Documentation
```

### Workspace Dependencies

To use another package in the monorepo:

```json
{
  "dependencies": {
    "@voice-hub/shared-config": "workspace:*"
  },
  "devDependencies": {
    "@voice-hub/shared-config": "workspace:*"
  }
}
```

Add to `tsconfig.json` references:

```json
{
  "references": [{ "path": "../shared-config" }]
}
```

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific package
pnpm --filter @voice-hub/<package> test

# Run with coverage
pnpm test --coverage
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { MyComponent } from '../src/index';

describe('MyComponent', () => {
  it('should do something', () => {
    const result = MyComponent.do();
    expect(result).toBe('expected');
  });
});
```

## Audio Processing

### Audio Pipeline

1. **Ingress**: Discord → Opus → PCM16 → Resample to 16k
2. **Provider**: Send to Omni WebSocket
3. **Egress**: Receive from Omni → Resample to 48k → Discord

### Debugging Audio

Enable debug logging:

```bash
LOG_LEVEL=debug pnpm --filter @voice-hub/bridge-daemon start
```

## Provider Integration

### Adding a New Provider

1. Create package: `packages/provider-xyz/`
2. Implement client following `provider-volcengine-omni` pattern
3. Define protocol in `protocol.ts`
4. Implement `OmniClient` interface
5. Add to core runtime dependencies

### Protocol TODOs

When adding a new provider, mark unconfirmed protocol fields with TODO:

```typescript
export interface SomeMessage {
  confirmedField: string;
  // TODO: Confirm with provider documentation
  unknownField?: unknown;
}
```

## Memory Bank

### Adding Pitfalls

```typescript
import { PitfallQueries } from '@voice-hub/memory-bank';

const queries = new PitfallQueries(db);

queries.insert({
  id: 'pitfall_xxx',
  category: 'async-concurrency',
  description: '...',
  symptoms: ['...'],
  solution: '...',
  keywords: ['async', 'await', 'promise'],
  severity: 'high',
  createdAt: Date.now(),
});
```

### Querying Context

```typescript
const pitfalls = queries.findRelevantPitfalls(keywords, 5);
const patterns = queries.findSuccessfulPatterns(keywords, 5);
```

## Release Process

1. Update version in `package.json` files
2. Build all packages: `pnpm build`
3. Run tests: `pnpm test`
4. Pack plugins: `bash scripts/pack-openclaw-plugin.sh`
5. Create git tag: `git tag v0.1.0`
6. Push: `git push --tags`

## Debugging

### Common Issues

**Port already in use**

```bash
lsof -i :8866
kill -9 <PID>
```

**TypeScript errors**

```bash
pnpm typecheck
```

**Clean rebuild**

```bash
pnpm clean
pnpm build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Resources

- [Discord.js Documentation](https://discord.js.org/)
- [@discordjs/voice Documentation](https://discordjs.guide/voice/)
- [Volcengine Doubao API](https://www.volcengine.com/docs)
