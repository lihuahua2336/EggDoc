# EggDoc

EggDoc 是一个中文优先的 AI 工具教程站，当前聚焦 Codex、Claude Code 与 EggAi 的安装和配置。站点将公开教程预渲染为静态页面，同时使用轻量服务端运行时完成 EggAi 登录、加密会话和个性化配置读取。

> 当前阶段：Codex 与 Claude Code 教程、托管安装脚本、EggAi 登录和个性化配置已经落地。Learning Path、Lesson 和 Note 已被明确移出当前产品范围，只有新的架构决策才能恢复。项目的早期愿景见 [`docs/plan.md`](docs/plan.md)，当前实现和架构决策以代码、[`CONTEXT.md`](CONTEXT.md) 与 [`docs/adr/`](docs/adr/) 为准。

## 核心能力

- 使用 Markdown/MDX 编写并由 Astro Content Collections 校验教程内容。
- 提供 Codex 与 Claude Code 的 Shell、PowerShell 托管安装脚本。
- 匿名读者可获取不修改第三方提供商配置的默认安装命令。
- 读者可通过 EggAi/Logto 登录，按 EggAi API Credential 生成可复制的个性化配置命令。
- 公开内容保持匿名可访问并在构建时预渲染；动态 API 仅处理身份和个性化数据。
- 使用 Pagefind 提供静态全文搜索，并生成 Sitemap。
- 支持浅色、深色和跟随系统三种主题以及移动端导航。
- 通过单元测试、安装脚本测试、浏览器端到端测试和生产构建预览测试覆盖关键流程。

## 技术栈

| 领域 | 方案 |
| --- | --- |
| Web 框架 | Astro 7 + TypeScript |
| 内容 | Astro Content Collections + Markdown/MDX |
| 交互组件 | React 19 |
| 样式 | Tailwind CSS 4 + Radix UI + shadcn/ui 组件约定 |
| 搜索 | Pagefind |
| 身份认证 | EggAi Logto、OIDC Authorization Code + PKCE |
| 会话 | Web Crypto 加密的 HttpOnly Cookie，无数据库 |
| 运行时 | Docker + Astro Node standalone；Cloudflare Worker 为可选目标 |
| 测试 | Playwright + Astro 类型检查 |

## 工作方式

```text
Markdown / MDX
      |
      v
Astro Content Collections -----> 预渲染教程、标签页、搜索索引、Sitemap
      |
      +-------------------------> React 交互组件

Reader -----> EggAi / Logto -----> 加密 EggDoc Session
  |                                      |
  +-----> /api/eggai/account <-----------+
                  |
                  v
          EggAi Ecosystem API
          (账户、模型、凭据)
```

公开文章不要求登录。EggDoc Session 只用于读取个性化配置；服务端不使用数据库保存会话，也不持久化 EggAi API Credential。完整术语和安全边界见 [`CONTEXT.md`](CONTEXT.md)。

## 目录结构

```text
EggDoc/
|- deploy/nginx/               # 宿主机 Nginx 反向代理示例
|- public/install/             # 面向读者的 Codex、Claude Code 安装脚本
|- scripts/                    # 本地环境生成等维护脚本
|- src/
|  |- components/              # React/Astro 组件及基础 UI
|  |- config/                  # 可公开的站点配置
|  |- content/guides/          # 已发布教程的 Markdown/MDX 源文件
|  |- layouts/                 # 页面与文章布局
|  |- lib/
|  |  |- auth/                 # OIDC、重定向与加密会话
|  |  |- codex/                # Codex 配置命令生成
|  |  |- claude-code/          # Claude Code 配置命令与模型选择
|  |  `- eggai/                # EggAi 外部接口适配层
|  |- pages/                   # 静态页面、认证路由和 API 路由
|  `- styles/                  # 全局样式与主题变量
|- tests/
|  |- unit/                    # 配置和会话单元测试
|  |- install/                 # Shell/PowerShell 安装脚本测试
|  |- e2e/                     # 浏览器、认证和个性化配置流程
|  |- preview/                 # 生产构建、搜索和 Sitemap 验收
|  `- fixtures/                # 测试服务与预览启动器
|- docs/
|  |- adr/                     # 架构决策记录
|  |- agents/                  # Agent 协作约定
|  |- research/                # 外部资料调研
|  `- tutorials/               # 维护和验收教程
|- CONTEXT.md                  # 项目领域语言的唯一入口
|- astro.config.mjs            # Astro、Node/Cloudflare、MDX、React、Sitemap 配置
|- compose.yaml                # 容器构建、运行、安全和端口配置
|- Dockerfile                  # Node standalone 多阶段生产镜像
|- playwright.config.ts        # 浏览器测试与本地测试服务配置
`- wrangler.toml               # Cloudflare Worker 与测试环境变量
```

构建产物、依赖和本地密钥文件不进入版本控制；相关规则见 [`.gitignore`](.gitignore)。

## 本地开发

### 环境要求

- Node.js 22 或更新版本
- npm（项目提交了 `package-lock.json`）
- Chrome（本地 Playwright 默认使用已安装的 Chrome；CI 使用 Playwright Chromium）
- 如需测试 Shell 安装脚本，Windows 环境还需要 Git for Windows 提供的 Bash

### 启动项目

```bash
git clone <repository-url>
cd EggDoc
npm install
npm run dev
```

开发服务器默认地址为 <http://localhost:4321>。不配置认证环境变量也可以浏览公开内容和开发普通页面；登录与个性化配置区域会显示为不可用。

在 Windows PowerShell 中，如果执行策略拦截 `npm.ps1`，可将上述命令中的 `npm` 替换为 `npm.cmd`。

### 配置本地环境

需要验证真实 EggAi 登录与配置读取时，复制示例文件：

```powershell
Copy-Item .env.example .env.local
```

生成独立的 32 字节 Base64URL 会话密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

将输出写入 `.env.local` 的 `EGGDOC_SESSION_SECRET`，再填写专用于 EggDoc 的 Logto 应用信息。真实联调步骤见 [`docs/tutorials/localhost-real-eggai-acceptance.md`](docs/tutorials/localhost-real-eggai-acceptance.md)。不要提交 `.env.local` 或任何真实凭据。

## 环境变量

| 变量 | 可见性 | 用途 |
| --- | --- | --- |
| `EGGDOC_SITE_URL` | 服务端及构建期 | 对外 HTTPS Origin，用于 canonical URL、OIDC 回调和安全 Cookie |
| `EGGDOC_IMAGE` | Compose | VPS 拉取的公开 GHCR 镜像，例如 `ghcr.io/owner/eggdoc:latest` |
| `EGGDOC_OIDC_ISSUER` | 服务端 | Logto OIDC Issuer URL |
| `EGGDOC_OIDC_CLIENT_ID` | 服务端 | EggDoc 专用 OIDC Client ID |
| `EGGDOC_OIDC_CLIENT_SECRET` | 服务端，可选 | Confidential Client 的密钥 |
| `EGGDOC_OIDC_RESOURCE` | 服务端 | EggAi API Resource/Audience |
| `EGGDOC_OIDC_SCOPES` | 服务端 | 登录和 Ecosystem API 所需 scopes |
| `EGGDOC_SESSION_SECRET` | 服务端 | 加密 EggDoc Session 的 32 字节 Base64URL 密钥 |
| `EGGDOC_EGGAI_PLATFORM_URL` | 服务端 | EggAi API Account 激活入口 |
| `EGGDOC_EGGAI_ECOSYSTEM_URL` | 服务端 | EggAi Ecosystem API 根地址 |
| `PUBLIC_EGGAI_BASE_URL` | 公开 | 生成集成配置时使用的默认 API Base URL |
| `PUBLIC_INSTALLER_ORIGIN` | 公开 | 托管安装脚本的站点 Origin |

前缀为 `PUBLIC_` 的值会进入客户端构建，不能包含秘密。服务端变量缺失或格式无效时，公开教程仍可访问，但认证和个性化配置接口会降级为不可用状态。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Astro 开发服务器 |
| `npm run check` | 检查 Astro 与 TypeScript 类型 |
| `npm run build` | 类型检查、生产构建、Pagefind 建索引并校验公开内容 |
| `npm run build:container` | 使用 Astro Node standalone 生成容器运行产物 |
| `npm run build:test` | 使用隔离测试配置生成测试构建 |
| `npm run env:container` | 从 `.env.local` 生成被 Git 忽略的容器 `.env` |
| `npm run preview` | 预览已生成的 Cloudflare 构建 |
| `npm run start:container` | 运行已构建的 Node standalone 产物 |
| `npm run test:e2e` | 构建并运行浏览器端到端测试 |
| `npm run test:preview` | 验收生产构建、搜索与 Sitemap |
| `npm test` | 运行完整测试套件 |
| `npm run deploy:cloudflare` | 构建并通过 Wrangler 部署 Cloudflare Worker |

## 内容维护

当前已实现的内容集合只有 `guides`，源文件位于 `src/content/guides/`。文件名使用简短英文 slug，页面标题和正文以中文为主。Markdown 是默认格式；只有需要交互组件、可复用提示框或更丰富布局时才使用 MDX。

每篇 Tutorial 在代码中属于 `guides` 集合，其 Frontmatter 必须满足 [`src/content.config.ts`](src/content.config.ts) 中的 schema：

```yaml
---
type: guide
title: Codex 安装
description: 复制一条命令安装 Codex，并按需完成 EggAi 配置。
publishedAt: 2026-07-03
updatedAt: 2026-07-17
tags: [install, codex, eggai]
draft: false
order: 10
---
```

- `draft: true` 的内容只在开发模式出现，不进入生产站点。
- `order` 决定教程列表顺序；相同顺序按更新时间倒序排列。
- `publishedAt` 和 `updatedAt` 必须是可解析日期。
- 新增或修改内容后至少运行 `npm run check` 和 `npm run build`。
- `lessons`、`notes` 及 Learning Path 当前不在产品范围内；恢复这些能力前必须先用新 ADR 修改现有决策。

## 路由与运行时边界

主要公开路由：

| 路由 | 类型 | 说明 |
| --- | --- | --- |
| `/` | 预渲染 | 教程入口 |
| `/eggai/` | 预渲染 | EggAi 工具教程列表 |
| `/eggai/[...slug]/` | 预渲染 | 教程正文 |
| `/tags/[tag]/` | 预渲染 | 标签聚合页 |
| `/search/` | 预渲染 | Pagefind 搜索页 |
| `/auth/login`、`/auth/callback`、`/auth/logout` | 动态 | OIDC 登录、回调和退出 |
| `/api/auth/user` | 动态 | 当前 EggDoc Session 身份 |
| `/api/eggai/account` | 动态 | EggAi API Account、模型和 EggAi API Credential 适配接口 |
| `/api/health` | 动态 | 无缓存健康检查 |

公开页面和搜索索引在构建阶段生成；动态路由由 Node standalone 服务或可选的 Cloudflare Worker 执行。因此本项目不是纯静态站，也不应将 `dist/client` 单独当作完整站点部署。

## 测试策略

完整测试由 `npm test` 驱动，包含以下层次：

1. `astro check` 验证内容 schema、Astro 和 TypeScript。
2. Unit 测试覆盖会话加密、配置转义与模型选择。
3. Install 测试在隔离目录中验证 Shell/PowerShell 语法、dry-run、安全校验、备份和失败保护。
4. E2E 测试通过本地模拟 EggAi/Logto 服务验证登录、账户激活、配置选择、移动端布局和交互。
5. Preview 测试验证真实生产输出、匿名预渲染页面、Pagefind 和 Sitemap。

测试默认占用 `127.0.0.1:4322`（站点）和 `127.0.0.1:4323`（模拟服务）。运行前应确保端口未被其他进程占用。

## 容器部署

生产部署采用“容器监听宿主机回环端口，宿主机 Nginx/Caddy 绑定域名并终止 TLS”的方式。容器同时提供预渲染页面、静态资源和动态 API，不需要数据库或持久化卷。

### 1. 生成容器环境

已有 `.env.local` 时运行：

```bash
npm run env:container
```

脚本会复制现有业务变量到被 Git 忽略的 `.env`，并从 `PUBLIC_INSTALLER_ORIGIN` 推导 `EGGDOC_SITE_URL`。它不会打印变量值，也不会覆盖已有 `.env`；需要重新生成时使用：

```bash
npm run env:container -- --force
```

部署前检查 `.env` 中以下两个值都使用真实 HTTPS 域名且 Origin 一致：

```dotenv
EGGDOC_SITE_URL=https://docs.example.com
PUBLIC_INSTALLER_ORIGIN=https://docs.example.com
```

`EGGDOC_SITE_URL` 不能包含路径、查询参数或片段。真实 `.env` 不得提交、复制进镜像或发送到日志。

### 2. 构建并启动

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

默认只开放宿主机回环地址，宿主机和容器内部端口均固定为 `4322`：

```text
127.0.0.1:4322 -> container:4322
```

不要修改端口映射或将端口绑定改为 `0.0.0.0`，公网流量应统一经过 HTTPS 反向代理。

### 3. 配置域名

复制 [`deploy/nginx/eggdoc.conf.example`](deploy/nginx/eggdoc.conf.example) 到宿主机 Nginx 配置，替换 `docs.example.com`，再由 Certbot、面板或现有证书流程启用 HTTPS。反向代理目标保持为：

```text
http://127.0.0.1:4322
```

同时在 Logto 的 EggDoc 应用中注册精确回调地址：

```text
https://docs.example.com/auth/callback
```

容器内部使用 HTTP，但认证路由依据 `EGGDOC_SITE_URL` 生成 HTTPS 回调、验证 Origin 并设置 Secure Cookie，不依赖不受信任的转发头推断外部地址。

### 4. 验收和运维

```bash
curl http://127.0.0.1:4322/api/health
docker compose logs -f app
docker compose restart app
docker compose down
```

健康响应应为 `{"status":"ok"}`。升级时重新拉取代码并执行：

```bash
docker compose build --pull
docker compose up -d
```

镜像使用非 root 用户、只读根文件系统、移除 Linux capabilities，并且不包含 `.env`。多副本必须共享相同的 `EGGDOC_SESSION_SECRET`；更换该值会让现有 EggDoc Session 失效。

### 可选 Cloudflare 部署

Cloudflare Adapter 与 Wrangler 配置仍保留为次要目标：

```bash
npm run deploy:cloudflare
```

Cloudflare 配置见 [`wrangler.toml`](wrangler.toml)；`[env.test.vars]` 只用于隔离测试，不是生产配置。

### GitHub 与 VPS 自动发布

推送到 `main` 或 `v*` Tag 时，[`publish-container.yml`](.github/workflows/publish-container.yml) 会先扫描 Git 历史中的密钥，再构建 `linux/amd64`、`linux/arm64` 镜像并发布到 GitHub Container Registry。Workflow 使用固定版本的第三方 Action，并且只接收三个公开的 Repository Variables：

- `EGGDOC_SITE_URL`
- `PUBLIC_EGGAI_BASE_URL`
- `PUBLIC_INSTALLER_ORIGIN`

OIDC Client Secret、EggDoc Session Secret 和 EggAi 服务端配置不进入 GitHub Actions。它们只保存在 VPS 上被 Git 忽略的 `.env` 中，由 Compose 的 `env_file` 在容器启动时注入。

VPS 首次部署时克隆公开仓库、创建 `.env` 并填写生产值，其中镜像地址使用：

```dotenv
EGGDOC_IMAGE=ghcr.io/lihuahua2336/eggdoc:latest
```

以后部署或升级只需运行：

```bash
./deploy/vps/deploy.sh
```

脚本会拉取最新镜像、无构建重建容器，并等待 `/api/health` 变为健康。VPS 配置使用 [`compose.vps.yaml`](compose.vps.yaml) 覆盖本地镜像，但继续复用固定的 `127.0.0.1:4322` 端口、安全限制和 `.env` 注入。

## 安全约束

- EggDoc 将最小授权信息加密后写入最长七天的 HttpOnly Cookie，不使用服务端会话数据库。
- EggAi API Credential 只能由认证后的客户端面板在页面加载后通过私有、不可缓存的接口读取；不得注入预渲染或服务端渲染的 HTML，也不得进入构建产物、Pagefind 索引、页面源代码或 CDN 页面缓存。
- EggDoc 不得缓存、记录、监控或持久化原始 EggAi API Credential，浏览器存储也不得保存原始凭据。
- 个性化安装命令可能包含真实 API Key；`无配置安装` 必须保持为非秘密默认选项，界面不得自动复制，并须提示剪贴板、Shell 历史、截图、共享命令和应用设置可能暴露凭据。
- 日志、错误信息、测试快照和文档不得包含 Cookie、Token、Client Secret 或 API Key。
- 安装脚本修改用户配置前必须验证输入，并保留既有配置或创建备份；dry-run 不得写文件或保存凭据。
- 所有外部重定向、上游响应和 URL 都需要继续在项目适配层内验证。

## 项目文档

| 文档 | 职责 |
| --- | --- |
| [`CONTEXT.md`](CONTEXT.md) | 项目领域术语与禁用替代词，撰写代码和文档前必读 |
| [`docs/adr/`](docs/adr/) | 已接受的架构决策；新实现不得静默冲突 |
| [`docs/plan.md`](docs/plan.md) | 早期产品愿景和待实现内容，不代表全部已落地 |
| [`docs/tutorials/`](docs/tutorials/) | 本地联调、验收和内容制作教程 |
| [`docs/research/`](docs/research/) | 官方资料和技术调研记录 |
| [`AGENTS.md`](AGENTS.md) | Repository Agent 入口约定 |
| [`docs/agents/`](docs/agents/) | 本地 Issue Tracker、Triage 与领域文档规则 |

## 维护约定

1. 开始改动前阅读 `CONTEXT.md` 和相关 ADR。
2. 保持公开内容预渲染；只有身份、会话和个性化数据使用动态路由。
3. 外部 EggAi 接口变化应收敛在 `src/lib/eggai/`，不要把上游字段传播到教程组件。
4. 配置命令生成保持在 `src/lib/codex/` 或 `src/lib/claude-code/`，并用单元测试锁定转义和安全行为。
5. 新决策需要补充 ADR；计划与实现不一致时，先标明状态，不把未来能力写成现有能力。
6. 提交前运行与改动相关的快速检查，并在最终交付前运行完整测试。

项目尚未声明开源许可证；除非仓库所有者另行授权，不应假定代码和内容可被公开再分发。
