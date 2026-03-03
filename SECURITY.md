# Security Policy / 安全策略

## Supported Versions / 支持版本

We support security updates for the latest `main` branch and the latest GitHub release.
我们为最新 `main` 分支和最新 GitHub release 提供安全修复支持。

## Reporting a Vulnerability / 漏洞上报

Preferred channel (recommended):

1. Open a private GitHub Security Advisory.
2. Include impact, reproduction steps, and suggested fix scope.

推荐渠道：

1. 通过 GitHub Security Advisory 私下上报。
2. 提供影响范围、复现步骤与建议修复范围。

If private advisory is unavailable, open an issue titled:

`[SECURITY] <short summary>`

Do not publish exploit details before patch release.
在补丁发布前请勿公开可利用细节。

## Response Targets / 响应时效

- Initial triage: within 3 business days
- Severity assessment: within 5 business days
- Patch target: based on severity and blast radius

- 初次分诊：3 个工作日内
- 严重级别评估：5 个工作日内
- 补丁发布时间：按严重级别与影响范围确定

## Scope / 范围

In-scope areas:

- Authentication/authorization flows
- Secret handling
- Webhook verification
- Dependency vulnerabilities with practical exploit paths

范围包括：

- 认证/鉴权流程
- 密钥处理
- Webhook 验签
- 具有现实利用路径的依赖漏洞
