# Ddvh

[![CI](https://github.com/voice-hub/clawsc/actions/workflows/ci.yml/badge.svg)](https://github.com/voice-hub/clawsc/actions/workflows/ci.yml)
[![Release](https://github.com/voice-hub/clawsc/actions/workflows/release.yml/badge.svg)](https://github.com/voice-hub/clawsc/actions/workflows/release.yml)
[![Security](https://github.com/voice-hub/clawsc/actions/workflows/security.yml/badge.svg)](https://github.com/voice-hub/clawsc/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A monorepo for bridging Discord voice channels with Volcengine Doubao Omni realtime voice interactions.

用于将 Discord 语音频道与火山引擎 Doubao Omni 实时语音能力进行桥接的 monorepo。

## 1. Quick Start (1 minute) / 一分钟启动

### One-click install / 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/voice-hub/clawsc/main/scripts/install.sh | bash -s -- --repo voice-hub/clawsc --target both --yes
```

If you publish this repo under another namespace, replace `--repo voice-hub/clawsc`.
如果你发布到其他 GitHub 命名空间，请替换 `--repo voice-hub/clawsc`。

### Local source install / 本地源码安装

```bash
pnpm install
bash scripts/install.sh --target both --source-dir "$(pwd)"
```

### GitHub publish preflight / 发布前预检

```bash
pnpm preflight:github -- --repo <owner/repo> --strict
```

## 2. Install Script Options / 安装参数

```bash
bash scripts/install.sh [options]
```

- `--target both|openclaw|claude` (default: `both`)
- `--version latest|<tag>|<branch>` (default: `latest`)
- `--repo <owner/repo>` (required for remote install)
- `--source-dir <path>` use local source directly
- `--force` overwrite existing installation
- `--dry-run` preview commands only
- `--yes` non-interactive mode

## 3. Architecture / 架构

```
Discord Voice Channel
  -> bridge-daemon
    -> audio-engine
    -> provider-volcengine-omni
    -> core-runtime
    -> backend-dispatcher
    -> memory-bank
```

Main packages:

- `apps/bridge-daemon`: runtime entrypoint
- `packages/audio-engine`: ingress/egress audio processing
- `packages/provider-volcengine-omni`: Omni websocket client
- `packages/core-runtime`: session + intent + tool dispatch
- `packages/backend-dispatcher`: async dispatch and webhook handling
- `packages/memory-bank`: sqlite-backed history
- `packages/openclaw-plugin`: OpenClaw plugin shell
- `packages/claude-mcp-server`: Claude MCP server

## 4. Development / 开发

### Prerequisites / 前置依赖

- Node.js 22+
- pnpm 9+

### Commands / 常用命令

```bash
pnpm install
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm smoke-test
```

Run daemon:

```bash
pnpm --filter @voice-hub/bridge-daemon start
```

## 5. Configuration / 配置

Copy and edit env file:

```bash
cp .env.example .env
```

Key variables:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `VOLCENGINE_OMNI_ENDPOINT`
- `VOLCENGINE_OMNI_API_KEY`
- `BACKEND_DISPATCH_ENDPOINT`
- `BACKEND_WEBHOOK_SECRET`

## 6. GitHub Release and CI / 发布与流水线

- CI pipeline: `.github/workflows/ci.yml`
- Auto release: `.github/workflows/release.yml` (release-please)
- Security checks: `.github/workflows/security.yml`
- Publish checklist: `docs/github-publish.md`

Release policy details:

- [RELEASE.md](./RELEASE.md)
- [CHANGELOG.md](./CHANGELOG.md)

## 7. Contributing / 参与贡献

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## 8. Notes / 说明

Protocol internals for Volcengine Omni are still implementation-dependent and should be validated against official upstream behavior before production scale rollout.

## 9. License

MIT. See [LICENSE](./LICENSE).
