# Release Process / 发布流程

## Overview / 概览

Releases are automated through GitHub Actions (`release.yml`) using `release-please`.
发布通过 GitHub Actions (`release.yml`) + `release-please` 自动完成。

## Preconditions / 前置条件

- PR merged into `main`
- Conventional Commit messages used
- CI checks all green

- PR 已合并到 `main`
- 提交信息遵循 Conventional Commits
- CI 全绿

## Flow / 流程

1. `release-please` opens/updates a release PR.
2. Merge the release PR.
3. Action creates tag + GitHub Release + release notes.

4. `release-please` 创建或更新 release PR。
5. 合并 release PR。
6. Action 自动创建 tag、GitHub Release 与 release notes。

## Rollback / 回滚

1. Revert problematic commits in `main`.
2. Create a patch fix commit (`fix:`).
3. Let release automation generate the next patch release.

4. 在 `main` 回滚有问题提交。
5. 通过 `fix:` 提交修复。
6. 由自动发布生成下一个补丁版本。

## Notes / 说明

- This repository currently publishes GitHub Releases only.
- npm package publishing is intentionally not enabled.
- Optional: configure `RELEASE_PLEASE_TOKEN` secret to let release PRs trigger downstream workflows reliably.
- Before first public push, run `pnpm preflight:github -- --repo <owner/repo> --strict` (see `docs/github-publish.md`).

- 当前仅自动发布 GitHub Release。
- 默认不发布 npm 包。
- 可选：配置 `RELEASE_PLEASE_TOKEN`，提升 release PR 触发下游工作流的稳定性。
- 首次公开发布前执行 `pnpm preflight:github -- --repo <owner/repo> --strict`（见 `docs/github-publish.md`）。
