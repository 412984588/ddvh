# Contributing Guide / 贡献指南

Thank you for contributing to Voice Hub.
感谢你参与 Voice Hub 的建设。

## 1. Development Setup / 开发环境

- Node.js: `>=22`
- pnpm: `>=9`

```bash
pnpm install
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm smoke-test
```

## 2. Branch and PR Workflow / 分支与 PR 流程

1. Create a feature branch from `main`.
2. Keep commits focused and small.
3. Open a PR using the template in `.github/PULL_REQUEST_TEMPLATE.md`.
4. Ensure all CI checks pass before merge.

5. 从 `main` 拉出功能分支。
6. 保持提交聚焦且粒度小。
7. 使用 `.github/PULL_REQUEST_TEMPLATE.md` 提交 PR。
8. 合并前必须通过全部 CI。

## 3. Commit Convention / 提交规范

Use Conventional Commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` internal refactor
- `test:` tests only
- `chore:` tooling/infra updates

This drives automated changelog and GitHub release generation.
该规范用于自动生成变更日志和 GitHub Release。

## 4. Testing Requirements / 测试要求

Any functional change must include tests.
任何功能变更都必须配套测试。

Minimum local checks before PR:

```bash
pnpm lint && pnpm test && pnpm typecheck && pnpm build && pnpm smoke-test
```

For GitHub publishing changes, also run:

```bash
pnpm preflight:github -- --repo <owner/repo>
```

## 5. Security and Secrets / 安全与密钥

- Never commit secrets, tokens, private keys, or credentials.
- Use `.env` for local development; keep `.env.example` in sync with schema.
- For vulnerabilities, follow `SECURITY.md`.

- 严禁提交密钥、Token、私钥、凭据。
- 本地使用 `.env`，并保持 `.env.example` 与 schema 同步。
- 漏洞处理请遵循 `SECURITY.md`。

## 6. Scope and Design / 变更范围与设计

- Keep backward compatibility unless a breaking change is explicitly approved.
- Document user-facing changes in PR descriptions.
- Update docs when adding/changing commands, env vars, or flows.

- 除非明确批准，默认保持向后兼容。
- 用户可见变更必须在 PR 描述中说明。
- 涉及命令、环境变量、流程变化时必须更新文档。
