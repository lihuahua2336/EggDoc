# EggDoc + Sub2API 配置与排障手册

更新日期：2026-10-26。本次 `testdoc.eggai.icu` 登录和个性化配置已由使用者确认恢复正常。本文保留当时的域名、Client ID 作为历史示例；新应用应换成自己的参数。现用 Client Secret、Session Secret、Token 和 API Key 不写入文档，示例密钥占位值不可直接用于部署。

## 1. 地址和参数对应关系

| 参数 | 本次历史示例 | 必须对应 |
| --- | --- | --- |
| EggDoc 公开 Origin | `https://testdoc.eggai.icu` | `EGGDOC_SITE_URL`、浏览器入口 |
| 安装脚本站点 | `https://testdoc.eggai.icu` | `PUBLIC_INSTALLER_ORIGIN` |
| OIDC issuer | `https://auth.eggai.icu/oidc` | 目标 API 信任的 issuer |
| EggDoc Client ID | `e3qhv659xqe2pa7fezshw` | EggDoc 自己的 Logto Traditional Web 应用、目标 API 客户端白名单 |
| Resource / audience | `https://api.eggai.icu/api` | Logto API Resource Identifier、目标 Sub2API audience |
| 生态接口根地址 | `https://api.eggai.icu` | `EGGDOC_EGGAI_ECOSYSTEM_URL` |
| 激活和管理入口 | `https://api.eggai.icu` | `EGGDOC_EGGAI_PLATFORM_URL` |
| 模型 API Base URL | `https://api.eggai.icu/v1` | `PUBLIC_EGGAI_BASE_URL`，用于生成配置，不用于生态请求 |
| OIDC 回调 | `https://testdoc.eggai.icu/auth/callback` | Logto 中精确注册的 Redirect URI |

不要根据域名推算 audience。先读取目标服务的公开 `/api/v1/ecosystem/docs`；本次本机另一套 Sub2API 使用 `https://sub.eggai.icu/api`，与 EggDoc 实际调用的公网 API 不同。更新本机容器不会自动修改公网另一实例。

## 2. Logto 和 Sub2API 前置配置

1. 为 EggDoc 创建自己的 Logto Traditional Web 应用，不复用其他项目的密钥。
2. 注册上述回调地址。EggDoc 退出只清除自己的 Session，不需要配置 Logto 全局退出回调。
3. 让 API Resource Identifier 与 `EGGDOC_OIDC_RESOURCE` 和目标 Sub2API audience 完全一致。
4. 为 API Resource 定义 `ecosystem:me`、`ecosystem:models:read`、`ecosystem:tokens:read`，并通过角色授予用户。
5. 把 EggDoc 的 Client ID 追加到**目标 Sub2API 实例**的客户端白名单，保留原有 ID。
6. 用户先通过相同 issuer 登录或绑定 Sub2API，确保本地用户已启用。

`ecosystem:groups:read` 是可选权限；当前 EggDoc 不调用 groups 接口。如果以后要显示分组详情，应同时配置并申请该权限。基础登录 scopes 使用 `openid profile offline_access`，需要邮箱时可加 `email`。授权请求包含 `prompt=consent`，EggDoc Session 需要 refresh token。

Sub2API 新界面的入口为 **系统设置 → 安全设置 → Logto 生态适配层 → 允许的 Client ID（逗号分隔）**。如果看不到控件，要确认 API 的镜像包含配置界面修复。后台字段名是 `ecosystem_allowed_client_ids`，启动环境变量是 `ECOSYSTEM_ALLOWED_CLIENT_IDS`；数据库已有非空白名单时优先使用数据库值，单独修改启动环境变量可能无效。

## 3. 容器 .env 示例

在项目根目录创建被 Git 忽略的 `.env`：

```dotenv
EGGDOC_SITE_URL=https://testdoc.eggai.icu
PUBLIC_INSTALLER_ORIGIN=https://testdoc.eggai.icu

EGGDOC_OIDC_ISSUER=https://auth.eggai.icu/oidc
EGGDOC_OIDC_CLIENT_ID=e3qhv659xqe2pa7fezshw
EGGDOC_OIDC_CLIENT_SECRET=replace-with-your-eggdoc-client-secret
EGGDOC_OIDC_RESOURCE=https://api.eggai.icu/api
EGGDOC_OIDC_SCOPES="openid profile offline_access ecosystem:me ecosystem:models:read ecosystem:tokens:read"
EGGDOC_SESSION_SECRET=replace-with-a-random-32-byte-base64url-value

EGGDOC_EGGAI_PLATFORM_URL=https://api.eggai.icu
EGGDOC_EGGAI_ECOSYSTEM_URL=https://api.eggai.icu
PUBLIC_EGGAI_BASE_URL=https://api.eggai.icu/v1

# 仅供 compose.vps.yaml 使用；tag 是历史示例，部署应选含所需修复的版本
EGGDOC_IMAGE=ghcr.io/lihuahua2336/eggdoc:1.6
```

生成独立的会话密钥后填入 `EGGDOC_SESSION_SECRET`：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
chmod 600 .env
```

密钥必须是 32 字节随机值的无填充 Base64URL 编码，不要使用重复字符，也不要复用 Client Secret。轮换 Session Secret 会使已有 Session 失效。

当前代码读取的是 `EGGDOC_*`，不要直接套用其他项目的 `LOGTO_CLIENT_ID`、`EGGAI_API_LOGTO_AUDIENCE` 或 `NEW_API_*` 变量名。`EGGDOC_EGGAI_ECOSYSTEM_URL` 只填根地址，不要添加 `/v1`，也不能用它替换代码内以 `/` 开头的接口路径。

## 4. 构建、更新和 Nginx

本地源码构建：

```bash
cd ~/apps/EggDoc
docker compose config --quiet
docker compose up -d --build app
docker compose ps
curl -fsS http://127.0.0.1:4322/api/health
```

本地 `compose.yaml` 构建 `eggdoc:local`，不读取 `EGGDOC_IMAGE` 来选择运行镜像。发布镜像方式则使用 `compose.vps.yaml` 和 `deploy/vps/deploy.sh`，详见 README 的部署章节。

- 修改源码、`EGGDOC_SITE_URL` 或 `PUBLIC_*`：重新构建并替换容器。
- 修改 OIDC / Session Secret：用 `docker compose up -d --force-recreate app` 重建容器以重新注入变量；普通 `docker compose restart` 不会更新环境。
- 改 resource、scopes 或角色授权：重新获取有相应权限的 Token。
- 仅在 Sub2API 白名单追加 Client ID：通常刷新 EggDoc 配置即可，不需重新构建 EggDoc。

本地构建后可比较以下两个镜像标识，确认更新的不仅是镜像标签；不要输出完整 inspect 内容：

```bash
docker inspect eggdoc-app-1 --format '{{.Image}}'
docker image inspect eggdoc:local --format '{{.Id}}'
```

Nginx 的 HTTPS 入口反代至 `http://127.0.0.1:4322`，保持端口只绑定回环地址。证书签发前先启用 HTTP ACME 配置，证书存在后再启用 HTTPS；`nginx -t` 成功后才 reload。本次配置文件：

- [HTTP 验证配置](../../deploy/nginx/testdoc.eggai.icu.bootstrap.conf)
- [HTTPS 代理配置](../../deploy/nginx/testdoc.eggai.icu.conf)

更换文档站域名时，同时更新 `EGGDOC_SITE_URL`、`PUBLIC_INSTALLER_ORIGIN` 和 Logto 回调地址；模型 API Base URL 保持指向模型网关。

## 5. 真实接口契约与修复范围

[生态客户端](../../src/lib/eggai/ecosystem.ts) 当前调用：

- `GET /api/v1/ecosystem/me`
- `GET /api/v1/ecosystem/models`
- `GET /api/v1/ecosystem/keys?page=1&page_size=100`，继续读取后续页

Sub2API 成功响应使用 `code: 0`，不是旧接口的 `success: true`。Key 列表在 `data.items`，分页由 `data.page/pages` 等字段描述；不能把整个 `data` 直接当数组。

| 内容 | Sub2API 字段 | EggDoc 行为 |
| --- | --- | --- |
| 模型名称 | `model` | 解析并去重 |
| Key 标识、密钥、名称 | `id/key/name` | 转成 EggAi API Credential |
| 分组 | `group_id`，可以为 null | 显示 ID，空值显示“未分组” |
| Base URL | 当前 Key 响应不提供 | 使用 `PUBLIC_EGGAI_BASE_URL` |
| 不可用 Key | `is_expired/is_quota_exhausted` | 排除明确标为 true 的项目 |

适配器保留了旧成功信封及字段的解析兼容，但请求路径固定为 Sub2API 的新路径，**不会回退调用旧的 `/api/ecosystem/tokens`**。参见 [ADR 0030](../adr/0030-adapt-the-eggai-ecosystem-contract.md)。

## 6. 这次出现的错误与解决方法

### 登录成功，但 EggAi 配置仍 401 / 403

`/api/auth/user` 的 `authenticated: true` 只代表 EggDoc Session 已建立。旧代码把上游 403 也映射成 401 并清除 Session，因此最初看起来像登录失败。

修复后保留有效 Session，并返回：

```json
{
  "state": "temporary-error",
  "reason": "ecosystem_client_not_allowed"
}
```

最终根因是**实际调用的公网 Sub2API 尚未放行 EggDoc Client ID**。在目标实例白名单中追加相应 ID 后恢复。仅重建 EggDoc 或本机另一套后端不会解决该拒绝。

| 响应 / 现象 | 处理方式 |
| --- | --- |
| `401 anonymous` | 重新登录；核对 Cookie 域名、HTTPS 和 Session Secret |
| 上游 `401 invalid_logto_token` | 核对指定 resource 的用户 Access Token、audience、issuer、签名、类型和有效期 |
| `403 ecosystem_client_not_allowed` | 在目标 API 的白名单追加 EggDoc Client ID，不填 Client Secret |
| `403 insufficient_scope` | 给用户分配 API Resource 权限，并重新取得有 scope 的 Token |
| 上游 `403 ecosystem_identity_not_linked` | 用户先登录/绑定目标 Sub2API；EggDoc 显示待激活并保留登录 |
| `403 ecosystem_user_unavailable` | 检查 Sub2API 用户是否禁用或删除 |
| `403 ecosystem_disabled` | 在目标 API 启用生态适配层 |
| `502 temporary-error` | 检查网络、路径、`code: 0`、分页和字段，不能只看 HTTP 200 |
| Logto 拒绝回调 | 注册精确的 `https://testdoc.eggai.icu/auth/callback` |
| 源码已改但页面仍旧 | 核对运行容器是否使用新镜像，确认更新的是 EggDoc 还是 Sub2API |
| 本机正常，公网仍失败 | 分别核对根地址、audience、容器和数据库，不把两套实例混为一套 |

### 测试通过，但真实 API 仍失败

最初 mock 仅模拟旧信封和数组，没有模拟 Sub2API 的 `code: 0` 和 Key 分页，漏掉了响应解析问题。现在 mock 与真实格式对齐，并增加权限拒绝不清 Session、未绑定账户激活等回归验证。

本次已通过 16 项相关集成测试，以及分页和空分组的定向检查。后续验收仍应使用测试用户走真实登录，不把 mock 成功等同于线上权限已经配好。

## 7. 验收与安全记录

1. 从 EggDoc 容器请求目标 API 的 `/api/v1/ecosystem/docs`，核对真实参数。
2. 确认运行容器的镜像、健康状态以及公开 HTTPS 健康接口。
3. 登录后查看 `/api/auth/user`，再查看 `/api/eggai/account`，成功时应为 HTTP 200、`state: active`。
4. 确认模型可用、多 Key 可切换，刷新和退出行为正确。
5. 失败时仅提供 HTTP 状态、`state` 和 `reason`；可用 `docker compose logs --tail 50 app` 查看已脱敏的权限拒绝原因。

不要提交 Cookie、Token、现用 Client/Session Secret 或返回的 API Key，也不要发送完整 `docker inspect` / `docker compose config` 输出。已轮换的旧密钥也不应复用；文档示例统一使用占位符。
