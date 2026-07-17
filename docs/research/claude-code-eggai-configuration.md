# Claude Code 接入 EggAi 的官方配置契约调研

调研日期：2026-07-17

范围：Anthropic 官方 Claude Code 文档、Anthropic Messages API 文档，以及 EggDoc 当前本地 EggAi 凭据契约。本文只确定可验证的配置方式和实现边界，不修改安装脚本。

## 结论

Claude Code 官方支持通过 `ANTHROPIC_BASE_URL` 接入第三方 LLM 网关，并用 `ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY` 提供凭据。这些值可以持久化在用户级 `~/.claude/settings.json`（Windows 为 `%USERPROFILE%\.claude\settings.json`）的 `env` 对象中。

官方文档本身不能证明任意 OpenAI 兼容网关都能用于 Claude Code，原因有三点：

1. Claude Code 的 `ANTHROPIC_BASE_URL` 网关必须对外实现 Anthropic Messages API；只有 OpenAI Chat Completions、Responses 或通用“OpenAI 兼容”接口不够。
2. `ANTHROPIC_BASE_URL` 是 `/v1/messages` 之前的 URL 前缀。EggDoc 当前默认值 `https://api.eggai.icu/v1` 是 OpenAI API 根路径，不能原样写入，否则按官方路径语义会形成 `/v1/v1/messages`。
3. EggAi 本地凭据契约只返回通用 `key`、`baseUrl` 和模型名称，不说明应使用 Bearer 还是 `x-api-key`，也不提供 Anthropic 协议兼容性或 Opus/Sonnet/Haiku/Fable 模型映射。

因此，EggDoc 将 EggAi 模式作为一项明确的 EggAi 服务契约实现，而不是从“OpenAI 兼容”自动推导：当前部署约定同一网关 origin 提供 `/v1/messages`、使用 Bearer token，并接受 Claude Code 发送的 Claude 模型标识。脚本把凭据 URL 末尾明确的 `/v1` 规范化为 Anthropic Base URL，再写入 `ANTHROPIC_AUTH_TOKEN`。这项部署契约仍需在 EggAi 网关升级时做真实端到端回归。

## 官方网关配置

Anthropic 的个人网关配置示例是：

```bash
export ANTHROPIC_BASE_URL=https://llm-gateway.example.com
export ANTHROPIC_AUTH_TOKEN=sk-gateway-key
```

```powershell
$env:ANTHROPIC_BASE_URL = "https://llm-gateway.example.com"
$env:ANTHROPIC_AUTH_TOKEN = "sk-gateway-key"
```

官方建议先在单个终端会话中设置并验证，确认连接后再持久化。来源：[Connect Claude Code to an LLM gateway - Set the base URL and credential](https://code.claude.com/docs/en/llm-gateway-connect#set-the-base-url-and-credential)。

### 凭据变量与请求头

| Claude Code 配置 | 发送的请求头 | 适用网关 |
| --- | --- | --- |
| `ANTHROPIC_AUTH_TOKEN` | `Authorization: Bearer <token>` | 网关明确要求 Bearer token 或 Authorization 头 |
| `ANTHROPIC_API_KEY` | `x-api-key: <key>` | 网关明确要求 API key 或 `x-api-key` 头 |
| `apiKeyHelper` | 推理请求同时发送 Bearer 和 `x-api-key` | 凭据轮换或来自 vault/SSO 命令 |

如果网关没有说明凭据类型，官方建议先尝试 `ANTHROPIC_AUTH_TOKEN`，再通过验证请求的 `401` 结果判断是否应改为 `ANTHROPIC_API_KEY`。来源：[Set the credential variable](https://code.claude.com/docs/en/llm-gateway-connect#set-the-credential-variable)、[How the credential variable maps to a header](https://code.claude.com/docs/en/llm-gateway-connect#how-the-credential-variable-maps-to-a-header)。

不要同时设置两种静态凭据。官方说明网关凭据优先于已保存的 claude.ai 登录；`ANTHROPIC_AUTH_TOKEN` 会立即生效，而 `ANTHROPIC_API_KEY` 在交互模式中需要用户一次性批准。`/status` 可以确认当前使用的 Base URL 和凭据来源。来源：[Conflicts with an existing login](https://code.claude.com/docs/en/llm-gateway-connect#conflicts-with-an-existing-login)。

完整认证优先级中，云提供商凭据在最前，其后依次是 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_API_KEY`、`apiKeyHelper`、`CLAUDE_CODE_OAUTH_TOKEN` 和已保存的订阅 OAuth 登录。因此同时存在两种 EggAi 凭据变量时，Bearer token 会优先，但这种冲突配置仍应避免。来源：[Authentication precedence](https://code.claude.com/docs/en/authentication#authentication-precedence)。

这意味着 EggAi 一键配置不能根据字段名 `key` 猜测变量：

- 如果 EggAi 的 Anthropic 入口接受标准 Bearer token，应写 `ANTHROPIC_AUTH_TOKEN`。
- 如果它只接受 `x-api-key`，应写 `ANTHROPIC_API_KEY`，并明确保留首次批准步骤，不能承诺绝对无交互。

## 持久化到 settings.json

官方明确允许把任意 Claude Code 环境变量写入 `settings.json` 的 `env` 对象。用户级文件适用于所有项目和后台代理：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://llm-gateway.example.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-gateway-key"
  }
}
```

路径：

- macOS、Linux、WSL：`~/.claude/settings.json`
- Windows：`%USERPROFILE%\.claude\settings.json`

当 shell 与 `settings.json` 同时设置同名变量时，settings 文件中的值生效。来源：[Set in a settings file](https://code.claude.com/docs/en/llm-gateway-connect#set-in-a-settings-file)、[Settings - Environment variables](https://code.claude.com/docs/en/settings#environment-variables)。

项目级 `.claude/settings.json` 会被提交和共享，官方明确警告不能把凭据放进去。项目私有的 `.claude/settings.local.json` 可以使用，但必须确保被 Git 忽略；对于 EggDoc 的全局一键配置，用户级文件更符合预期。

### 不使用 `claude config set`

当前官方 [CLI reference](https://code.claude.com/docs/en/cli-reference) 没有列出 `claude config` 或 `claude config set` 这一 shell 子命令。官方 [Settings](https://code.claude.com/docs/en/settings) 文档列出的是交互会话内的 `/config`，以及从 v2.1.181 起的 `/config key=value`。

因此，EggDoc 安装脚本不应依赖未记录的 `claude config set` 来写 `env`。建议实现是：

1. 使用结构化 JSON 解析器读取现有用户设置。
2. 只合并 `env` 中由 EggDoc 管理的 Claude 网关键。
3. 保留所有未知设置和其他环境变量。
4. 先写临时文件，验证 JSON 后原子替换。
5. 在替换前创建可恢复备份。

这是 EggDoc 的实现建议，不是 Anthropic 提供的配置写入命令。

## Base URL 路径语义

官方验证请求把 `/v1/messages` 追加到 `ANTHROPIC_BASE_URL`：

```bash
curl -X POST "$ANTHROPIC_BASE_URL/v1/messages" \
  -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":1,"messages":[{"role":"user","content":"."}]}'
```

官方协议表也规定 `ANTHROPIC_BASE_URL` 选择 Anthropic Messages 格式，其端点为：

- `POST /v1/messages`
- `POST /v1/messages/count_tokens`（可选）
- 模型发现启用时为 `GET /v1/models?limit=1000`

来源：[Verify the connection](https://code.claude.com/docs/en/llm-gateway-connect#verify-the-connection)、[Gateway protocol reference - API formats](https://code.claude.com/docs/en/llm-gateway-protocol#api-formats)、[Model discovery](https://code.claude.com/docs/en/llm-gateway-protocol#model-discovery)。

所以标准配置形状是：

```text
ANTHROPIC_BASE_URL=https://gateway.example.com
实际消息端点=https://gateway.example.com/v1/messages
```

若网关带租户路径，Base URL 可以是 `/tenant` 等前缀，但仍应位于最终 `/v1/messages` 之前。

EggDoc 不应对任意凭据 URL 盲目删除末尾 `/v1`。当前 `baseUrl` 可能来自每个 token 的上游 `base_url`，路径可能有业务含义。安全方案是由 EggAi 契约新增单独的 `anthropicBaseUrl`，或明确保证现有字段总是 OpenAI `/v1` 根路径且同一 origin 的 `/v1/messages` 已通过真实请求验证。

## API 协议要求

官方协议没有列出 OpenAI Chat Completions 或 Responses 作为 `ANTHROPIC_BASE_URL` 的格式。该变量选择的是 Anthropic Messages，网关至少要接受 Anthropic Messages 请求并返回同格式响应。它还需要正确处理 Claude Code 使用的流式响应、工具调用、系统提示，以及 `anthropic-version` 和所需 `anthropic-beta` 头；不支持的字段会导致功能降级或 `400`。

来源：[Gateway protocol reference](https://code.claude.com/docs/en/llm-gateway-protocol)、[Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)。

明确结论：

- 只有 OpenAI 兼容端点，不足以支持 Claude Code。
- 网关可以在内部翻译 API 格式，但面向 Claude Code 的入口仍必须符合 Anthropic Messages 契约。
- Anthropic 明确表示不支持通过任何网关把 Claude Code 路由到非 Claude 模型；协议翻译不能把 GPT 等非 Claude 模型变成官方支持的 Claude Code 后端。
- EggAi 当前在 EggDoc 中被定义为 Codex 使用的 OpenAI 兼容端点；这不能作为 Claude Code 兼容性的证据。

来源：[Other LLM gateways](https://code.claude.com/docs/en/llm-gateway)。

## 模型映射

`ANTHROPIC_BASE_URL` 只改变请求目的地，不改变模型。Claude Code 仍会在请求体中发送模型 ID。来源：[Model configuration](https://code.claude.com/docs/en/model-config)。

网关有三种可用策略：

1. 直接接受 Claude Code 内置的 Claude 模型 ID。
2. 启用 `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` 并实现 `GET /v1/models`。发现结果只接受 `id` 以 `claude` 或 `anthropic` 开头的模型。
3. 用环境变量显式映射模型家族：

```text
ANTHROPIC_DEFAULT_FABLE_MODEL
ANTHROPIC_DEFAULT_OPUS_MODEL
ANTHROPIC_DEFAULT_SONNET_MODEL
ANTHROPIC_DEFAULT_HAIKU_MODEL
```

还可以用 `ANTHROPIC_MODEL` 选择主会话模型，但 Claude Code 的后台功能会使用 Haiku 映射，规划和模型切换也可能使用其他家族。因此，只配置一个主模型并不能证明完整流程可用。

来源：[Model discovery](https://code.claude.com/docs/en/llm-gateway-protocol#model-discovery)、[Model environment variables](https://code.claude.com/docs/en/model-config#environment-variables)。

EggAi 当前的 `modelSummary.names` 只是字符串列表，没有协议、家族、能力或默认模型元数据。因此不能默认取第一个模型。当前产品契约明确提供以下 Claude 模型名称，EggDoc 据此按家族生成映射；长期仍建议 EggAi API 返回经过验证的结构化家族映射。

| Claude Code 角色 | 首选 EggAi 模型 | 回退规则 |
| --- | --- | --- |
| 主模型 | `claude-sonnet-5` | 最高版本 Sonnet，再依次使用 Opus、Fable、Haiku |
| Sonnet | `claude-sonnet-5` | 最高版本 Sonnet，最后使用主模型 |
| Opus | `claude-opus-4-8` | 最高版本 Opus，最后使用主模型 |
| Fable | `claude-fable-5` | 最高版本 Fable，再使用 Sonnet 或主模型 |
| Haiku | `claude-haiku-4-5` | 最高版本 Haiku，再使用 Fable、Sonnet 或主模型 |

`claude-opus-4-6` 和 `claude-sonnet-4-6` 保留为对应家族的可用模型，但不覆盖版本更高的默认值。Claude Code 的静态网关配置是“主模型加家族默认值”，不是把模型目录中的每个 ID 都逐项写进 `settings.json`。

`ANTHROPIC_DEFAULT_*_MODEL_SUPPORTED_CAPABILITIES` 只适用于 Bedrock、Google Cloud、Microsoft Foundry 等提供商配置；在普通 `ANTHROPIC_BASE_URL` 网关后不能靠这些变量声明虚假的 thinking 或 effort 能力。模型 ID 的 `_NAME` 和 `_DESCRIPTION` 可用于网关显示名称，但功能仍取决于真实协议支持。来源：[Customize pinned model display and capabilities](https://code.claude.com/docs/en/model-config#customize-pinned-model-display-and-capabilities)。

## 本地 EggAi 契约核对

当前实现：

- [`EggAiApiCredential`](../../src/lib/eggai/account-response.ts) 只有 `baseUrl`、`group`、`id`、`key` 和 `name`。
- [`EggAiModelSummary`](../../src/lib/eggai/account-response.ts) 只有模型总数和名称数组。
- [`parseCredential`](../../src/lib/eggai/ecosystem.ts) 优先使用 token 返回的 `base_url`，否则使用公共回退值；它只验证 HTTP(S) 并删除末尾斜杠，不处理 `/v1` 语义。
- [`PUBLIC_EGGAI_BASE_URL`](../../src/config/public.ts) 默认是 `https://api.eggai.icu/v1`。
- [本地真实服务验收说明](../tutorials/localhost-real-eggai-acceptance.md) 将该变量定义为 OpenAI-compatible API base URL。

当前契约缺少：

| 缺少字段或保证 | 为什么必须有 |
| --- | --- |
| Anthropic Messages 兼容性 | 决定 Claude Code 能否调用 `/v1/messages` |
| `anthropicBaseUrl` | 避免把 OpenAI `/v1` 根路径错误用作 URL 前缀 |
| 鉴权模式：Bearer 或 `x-api-key` | 决定使用 `ANTHROPIC_AUTH_TOKEN` 还是 `ANTHROPIC_API_KEY` |
| 模型家族映射或内置 Claude ID 保证 | 避免主会话、后台任务或模型切换请求不存在的模型 |
| 能力说明 | 确认流式输出、工具调用、thinking、beta 字段等功能是否可用 |

建议 EggAi API 契约新增独立的 Claude Code 集成元数据，而不是从通用 `baseUrl` 和 `key` 推断。例如：

```ts
type ClaudeCodeGatewayConfiguration = {
  authMode: "bearer" | "x-api-key";
  baseUrl: string;
  defaultModels: {
    fable?: string;
    opus: string;
    sonnet: string;
    haiku: string;
  };
  protocol: "anthropic-messages";
};
```

## 验证门槛

在把 EggAi 选项发布到 Claude Code 安装文章前，至少要用真实测试凭据完成：

1. `POST <anthropicBaseUrl>/v1/messages`，分别确认正确鉴权头和 Anthropic Messages JSON 响应。
2. 用 `stream: true` 验证 SSE 流式响应。
3. 用工具定义验证 tool use 请求和响应。
4. 启动 Claude Code，发送真实消息并通过 `/status` 确认 Base URL 与凭据来源。
5. 验证默认主模型、Haiku 后台功能以及模型切换。
6. 重启终端后再次验证用户级 `settings.json` 配置生效。

官方建议的最小直连测试使用 `max_tokens: 1`，成功响应应包含类似 `{"id":"msg_...","content":[...]}` 的 Anthropic Messages 结构。模型未知错误可以证明 URL 和鉴权通过，但不能证明模型映射或完整 Claude Code 功能可用。

## 安全与备份

Anthropic 官方建议先用临时 shell 环境变量验证，再持久化；轮换凭据或 vault/SSO 凭据应使用 `apiKeyHelper`。Claude Code 默认每五分钟或收到 HTTP 401 时重新调用 helper。固定 EggAi token 可以放在用户级 `env`，但会以 JSON 字符串存在本机设置文件中，应按明文密钥处理。官方网关部署指南还要求每个开发者使用自己的网关 key，以便正确归属使用量和单独撤销；EggDoc 应始终写入 Reader 当前选择的个人 EggAi API Credential，不能使用共享默认 key。

EggDoc 实现应遵守：

- 不把 key 写入项目 `.claude/settings.json`、Git、构建产物、日志、监控或测试快照。
- 不自动复制命令；只有用户明确选择 EggAi 配置并点击复制时才展示和复制凭据，继续遵守 [ADR 0028](../adr/0028-allow-explicit-copy-of-commands-containing-api-keys.md)。
- 私有 API 响应继续使用 `no-store`，EggDoc 服务器和浏览器存储不持久化原始 key，继续遵守 [ADR 0027](../adr/0027-return-api-credentials-without-persisting-them.md) 与 [ADR 0029](../adr/0029-fetch-personalized-credentials-after-page-load.md)。
- 修改用户设置前创建备份，但备份本身也可能包含密钥，必须保持与原文件同等严格的访问权限。
- POSIX 上建议新文件权限为仅当前用户可读写；Windows 上保留或收紧当前用户 ACL，不扩大继承权限。
- 写入失败时不留下截断 JSON；使用临时文件、JSON 校验和原子替换，并提供恢复备份的路径。
- 命令预览、剪贴板、shell 历史和截图会暴露凭据，界面必须继续显示警告。

其中 `settings.json`、项目设置警告和 `apiKeyHelper` 来自 [Claude Code gateway configuration](https://code.claude.com/docs/en/llm-gateway-connect)；原子写入、备份权限和 EggDoc 不持久化要求是本项目的安全实现约束。

## 实现决定

产品要求是在安装页提供和 Codex 相同的 `无配置安装` 与 `EggAi 配置` 双模式。为避免仅根据通用 Base URL 猜测兼容性，一键脚本执行：

1. 从 EggAi 模型列表生成主模型、Sonnet、Opus、Haiku 和 Fable 的明确映射，验证 key 和 HTTPS Base URL，并把末尾明确的 `/v1` 规范化掉。
2. 用所选 key 和主模型发送一次 `max_tokens: 16` 的强制工具调用流式请求；只有返回 Anthropic SSE、Messages ID、tool-use block 和 message-stop 才继续。
3. 安装或更新 Claude Code。
4. 备份并结构化合并 `~/.claude/settings.json`。
5. 写入 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_MODEL` 和四个家族默认模型，同时删除冲突的 `ANTHROPIC_API_KEY`。
6. 保留全部无关设置；解析或写入失败时保持原文件不变。安装器只收到旧版单模型参数时，各家族默认值回退到主模型，以保持向后兼容。

自动化测试使用本地固定凭据验证配置文件、界面行为、失败状态和流式工具调用响应形状，不向真实 EggAi 网关发送计费请求。Reader 运行 EggAi 命令时会对其所选分组执行真实的流式工具调用检查。Claude Code 交互式 `/status` 和长时间后台工作流不在脚本内自动执行；ADR 0033 明确记录并接受这一残余风险。

即使这些步骤全部完成，也应描述为“安装并配置 EggAi 网关”，而不是“已登录 Claude”。`ANTHROPIC_AUTH_TOKEN` 的认证优先级高于保存的 claude.ai 登录，因此配置存在时无需二次登录；网关凭据会覆盖但不会删除用户原有的 claude.ai 登录，移除网关变量后原登录仍可恢复使用。

## 来源

1. [Connect Claude Code to an LLM gateway](https://code.claude.com/docs/en/llm-gateway-connect)
2. [Gateway protocol reference](https://code.claude.com/docs/en/llm-gateway-protocol)
3. [Claude Code settings](https://code.claude.com/docs/en/settings)
4. [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
5. [Model configuration](https://code.claude.com/docs/en/model-config)
6. [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)
7. [Claude Code authentication](https://code.claude.com/docs/en/authentication)
8. [Roll out an LLM gateway](https://code.claude.com/docs/en/llm-gateway-rollout)
