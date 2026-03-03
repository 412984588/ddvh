# GitHub Publish Checklist

Use this checklist before the first public push.

## 1) Repo Metadata

- Set repository name, description, topics
- Add website/homepage if available
- Confirm `LICENSE` is correct for your publishing policy

## 2) Replace Repo Slug References

If publishing under a different namespace, replace `zhimingdeng/clawsc` in:

- `README.md`
- `docs/install.md`
- `.github/ISSUE_TEMPLATE/config.yml`

Quick scan:

```bash
rg -n "zhimingdeng/clawsc" README.md docs/install.md .github/ISSUE_TEMPLATE/config.yml
```

## 3) Run Preflight

```bash
pnpm preflight:github -- --repo <owner/repo> --strict
```

Expected: no `ERROR`, no `WARN` in strict mode.

## 4) Local Quality Gates

```bash
pnpm lint && pnpm test && pnpm typecheck && pnpm build && pnpm smoke-test
```

## 5) GitHub Repository Settings

- Enable Actions
- Enable Dependabot alerts + security updates
- Enable CodeQL (or keep workflow-enabled mode)
- Configure branch protection for `main`:
  - Require PR reviews
  - Require status checks (`CI`, `Security`)
  - Disallow force pushes

## 6) Optional Release Token

`release-please` can run with `GITHUB_TOKEN`, but if you want release PRs to fully trigger downstream workflows, set a PAT secret:

- Secret name: `RELEASE_PLEASE_TOKEN`
- Scope: repo contents + pull requests (minimum needed)

## 7) First Release Flow

1. Merge a PR with conventional commit message (e.g. `feat: ...`)
2. Wait for `Release` workflow to open/update release PR
3. Merge release PR
4. Confirm tag + GitHub Release + updated `CHANGELOG.md`
