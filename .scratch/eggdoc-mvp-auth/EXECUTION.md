# EggDoc MVP 执行手册

本手册把 [PRD](./PRD.md) 和 [实施任务](./issues/) 整理为可顺序执行、逐项验收的工作流。每个任务必须在新的 Codex 任务中独立执行，完成测试、代码审查和单独提交后，才能进入下一项。

## 当前状态

- 需求访谈：已完成并确认。
- 领域词汇与 ADR：已完成，见根目录 `CONTEXT.md` 和 `docs/adr/0023` 至 `0031`。
- PRD：已完成，状态为 `ready-for-agent`。
- 任务拆分：已完成，共 9 项。
- 功能实现：任务 01–09 已完成。
- 实施验收：9/9 项完成；任务 09 已完成 7/7 项验收条件。
- 当前执行项：无；EggDoc MVP 全部 9 项任务均已完成。
- 最近已记录验证基线（任务 09）：`npm test` 通过 69 项测试；`npm run check` 为 0 个诊断；`npm run build` 成功生成 27 个静态页面，Pagefind 索引 6 篇正文。

| 顺序 | 任务 | 执行状态 | 验收进度 |
| --- | --- | --- | --- |
| 01 | 可移植运行时与匿名配置面板 | `completed` | 6/6 |
| 02 | EggAi 登录与 EggDoc Session | `completed` | 7/7 |
| 03 | EggAi API Account 激活 | `completed` | 6/6 |
| 04 | EggAi API Credential 展示与选择 | `completed` | 7/7 |
| 05 | Shell Codex 一键配置 | `completed` | 7/7 |
| 06 | Windows PowerShell 一键配置 | `completed` | 7/7 |
| 07 | 带身份状态的移动端导航 | `completed` | 6/6 |
| 08 | 文章复制、Callout 与视频地址 | `completed` | 6/6 |
| 09 | localhost 真实 EggAi 联调 | `completed` | 7/7 |

## 执行规则

1. 每项任务开启一个新的 Codex 任务，不在当前规划上下文直接实施。
2. 开始前完整阅读 `AGENTS.md`、`CONTEXT.md`、相关 ADR、PRD 和当前 issue。
3. 只实现当前 issue，不顺带处理后续任务，不回滚工作区中与当前任务无关的用户修改。
4. 按 issue 已约定的最高测试切入点执行 TDD：主要使用运行中的 Astro HTTP/浏览器边界，安装器使用 CLI syntax/dry-run 边界。
5. 开发过程中持续运行类型检查和相关测试；收尾时运行完整测试与构建。
6. 使用 `/code-review` 审查当前任务相对开始提交点的变更，修复所有阻塞性问题。
7. 只有验收条件已实际验证时，才把 issue 中对应复选框改为 `[x]`。
8. 在 issue 末尾追加实施记录，至少包含测试命令、结果、审查结论和提交 ID；不得记录任何真实 API Key、Client Secret、resource token 或 refresh token。
9. 每项 Agent 任务形成一个独立提交，不把已有无关改动纳入提交。
10. 09 是人工联调任务。凭据只能由用户写入本机忽略文件或环境变量，禁止粘贴到聊天、issue、日志或提交中。

## 验收门

每个 `ready-for-agent` 任务只有同时满足以下条件才算完成：

- 当前 issue 的全部 Acceptance criteria 已勾选并有测试或人工证据。
- 相关单测、HTTP 测试、Playwright 测试或安装器 dry-run 全部通过。
- `npm run check` 通过。
- 完整测试套件通过。
- `npm run build` 通过；涉及 Pagefind 时确认索引生成。
- `/code-review` 没有未解决的高优先级问题。
- 当前任务已有独立提交，且不包含无关用户改动。

09 的验收门不同：必须由用户使用测试账号完成真实 localhost 登录链路，并将经过脱敏的结果记录到 issue；自动化模拟测试不能替代这一步。

## 具体执行顺序

### 01. 可移植运行时与匿名配置面板

建立后续所有动态能力和浏览器测试的基础，同时保证公开内容、Pagefind 和匿名占位符配置不回归。完成前不得开始 02。

### 02. EggAi 登录与 EggDoc Session

接通独立 Logto Application、加密 Cookie、顶部登录状态、来源页回跳、重新授权和仅退出 EggDoc。完成前不得开始 03 或 07。

### 03. EggAi API Account 激活

通过适配层区分只有 EggAi Account 与已激活 EggAi API Account，交付新标签页激活、返回自动检查和错误降级。

### 04. EggAi API Credential 展示与选择

读取模型与 Token，直接显示 Selected API Credential，支持多 Token 选择，只记住 Token ID，并验证 Key 不进入静态输出、缓存和持久化存储。

### 05. Shell Codex 一键配置

交付通用凭据、`config.toml`、语言选择和含 Key 的 Shell 命令；同步验证托管 `.sh` 的参数、转义、脱敏和 dry-run。

### 06. Windows PowerShell 一键配置

在 Shell 路径稳定后增加操作系统选择、Windows 命令和 `.ps1` 验证，避免两套模板同时演进造成重复返工。

### 07. 带身份状态的移动端导航

在登录状态接口稳定后接入移动抽屉，覆盖匿名与已登录菜单。该任务技术上只依赖 02，但排在核心配置链之后执行，以减少同一 Header 区域的交叉修改。

### 08. 文章复制、Callout 与视频地址

补齐与认证无关的文章 MVP 体验。该任务没有代码依赖，但顺序执行时放在核心链之后，减少 Codex 教程 MDX 的并行冲突。

### 09. localhost 真实 EggAi 联调

在 06、07、08 全部通过后，由用户配置测试账号和 localhost 回调，完成真实登录、激活、Key 获取、复制、刷新和退出验收。本轮不部署 Cloudflare。

## 一键复制提示词

以下每段提示词都应粘贴到一个全新的 Codex 任务中。

### 任务 01

```text
/implement

请实现 EggDoc MVP 的任务 01：建立可移植运行时与匿名 Codex 配置面板。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\01-portable-runtime-and-anonymous-config.md

先完整读取 AGENTS.md、CONTEXT.md、docs/agents、相关 ADR、PRD 和 Issue。只实现任务 01，不处理后续任务，不回滚或提交无关用户改动。使用预先确认的 Astro HTTP/浏览器测试切入点按 TDD 实施，保持所有公开内容可匿名访问并保留 Pagefind、主题、Sitemap 和构建行为。

完成后运行相关测试、完整测试、npm run check 和 npm run build；使用 /code-review 审查并修复问题。只有实际验证后才能勾选 Issue 验收项，在 Issue 末尾记录测试结果、审查结论和提交 ID，并只提交本任务改动。不要自动开始任务 02。
```

### 任务 02

```text
/implement

请实现 EggDoc MVP 的任务 02：接入 EggAi 登录与 EggDoc Session。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\02-eggai-login-and-eggdoc-session.md

开始前确认任务 01 已全部验收并提交。完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。使用成熟的跨运行时 OIDC 库，不复制参考项目的手写协议实现。只实现登录、加密 EggDoc Session、来源页回跳、当前用户状态、重新授权和仅退出 EggDoc；所有内容始终公开。

通过模拟 Logto 的 HTTP/浏览器测试按 TDD 实施，不使用真实生产凭据。完成后运行相关测试、完整测试、npm run check 和 npm run build，执行 /code-review，修复问题，勾选已验证的验收项，追加脱敏实施记录并只提交本任务。不要自动开始任务 03。
```

### 任务 03

```text
/implement

请实现 EggDoc MVP 的任务 03：EggAi API Account 激活流程。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\03-eggai-api-account-activation.md

开始前确认任务 02 已全部验收并提交。完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。只实现 EggAi ecosystem account 适配、未激活状态、新标签页激活、返回自动检查、手动重试和面板内故障降级。不得让身份或上游故障影响公开文章。

使用模拟 ecosystem 响应的 HTTP/浏览器测试按 TDD 覆盖 active、inactive、authorization expired、unavailable 和 retry。完成后运行完整验证、执行 /code-review、修复问题、更新 Issue 验收和脱敏实施记录，并只提交本任务。不要自动开始任务 04。
```

### 任务 04

```text
/implement

请实现 EggDoc MVP 的任务 04：展示并选择 EggAi API Credential。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\04-display-and-select-api-credentials.md

开始前确认任务 03 已全部验收并提交。完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。只实现模型/Token 适配、明文 Key 展示、只读 Base URL、模型摘要、多 Token 选择和 Token ID 偏好。Key 只能存在于当前页面内存和 private no-store 响应，禁止进入日志、静态 HTML、Pagefind、缓存或持久化浏览器存储。

按 TDD 覆盖单 Token、多 Token、失效选择、Session 过期、异常上游数据和敏感信息隔离。完成后运行完整验证、执行 /code-review、更新 Issue 验收与脱敏实施记录，并只提交本任务。不要自动开始任务 05。
```

### 任务 05

```text
/implement

请实现 EggDoc MVP 的任务 05：生成 Shell Codex 一键配置。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\05-shell-codex-configuration.md

开始前确认任务 04 已全部验收并提交。完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。交付 API Key、Base URL、非密钥 config.toml、语言选择和完整 Shell 命令的复制能力；允许显式复制含 Key 命令，但必须显示剪贴板与 shell history 风险。维护现有 codex.sh，公开脚本域名必须可配置且默认语言为 zh-cn。

使用浏览器行为测试、模板/转义单测和 Shell syntax/dry-run 边界按 TDD 实施，禁止执行真实 Codex 安装。完成后运行完整验证、执行 /code-review、更新 Issue 验收与脱敏实施记录，并只提交本任务。不要自动开始任务 06。
```

### 任务 06

```text
/implement

请实现 EggDoc MVP 的任务 06：生成 Windows PowerShell 一键配置。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\06-windows-codex-configuration.md

开始前确认任务 05 已全部验收并提交。完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。在已有 Shell 配置能力上增加 Windows/macOS-Linux 分段选择、浏览器平台预选、非密钥偏好记忆、完整 PowerShell 命令和现有 codex.ps1 的验证。不得保存含 Key 的生成命令。

使用浏览器行为测试、PowerShell 转义/语法测试和 dry-run 边界按 TDD 实施，禁止真实安装或写入个人 Codex 配置。完成后运行完整验证、执行 /code-review、更新 Issue 验收与脱敏实施记录，并只提交本任务。不要自动开始任务 07。
```

### 任务 07

```text
/implement

请实现 EggDoc MVP 的任务 07：带 EggAi 身份状态的移动端导航。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\07-mobile-navigation-with-identity.md

开始前确认任务 02 已全部验收，并按执行手册确认前序核心任务状态。完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。只实现小屏幕抽屉导航、主导航链接、匿名登录入口、已登录身份/API 平台/退出入口、关闭与焦点行为；保持桌面导航、搜索和主题控件稳定。

使用移动和桌面 Playwright 测试按 TDD 覆盖匿名/登录状态、键盘、Escape、焦点、文本适配和无重叠。完成后运行完整验证、执行 /code-review、更新 Issue 验收与实施记录，并只提交本任务。不要自动开始任务 08。
```

### 任务 08

```text
/implement

请实现 EggDoc MVP 的任务 08：文章代码复制、Callout 与视频地址体验。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\08-article-interactions-and-video-links.md

完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。只实现代码块复制反馈、Note/Tip/Warning 三类 Callout，以及存在 videoUrl 时的安全外链。MVP 不实现 iframe、自动播放、Tabs、Accordion 或其他复杂 MDX 组件。保持普通 Markdown 和明暗主题可读。

使用浏览器测试按 TDD 覆盖复制成功/失败、Callout 语义和对比度、视频有无两种状态、移动/桌面文本适配。完成后运行完整验证、执行 /code-review、更新 Issue 验收与实施记录，并只提交本任务。不要自动开始任务 09。
```

### 任务 09

```text
请协助我完成 EggDoc MVP 的任务 09：localhost 真实 EggAi 联调验收。

工作区：C:\Users\Administrator\Documents\EggDoc
PRD：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\PRD.md
Issue：C:\Users\Administrator\Documents\EggDoc\.scratch\eggdoc-mvp-auth\issues\09-local-real-eggai-acceptance.md

开始前确认任务 06、07、08 均已全部验收并提交。完整读取 AGENTS.md、CONTEXT.md、相关 ADR、PRD 和 Issue。先运行自动化测试、npm run check 和 npm run build，再引导我在本机忽略文件或环境变量中配置 EggDoc Logto Application 与测试账号所需值。

不要要求我在聊天中发送任何 API Key、Client Secret、resource token 或 refresh token；不要读取、打印、记录或提交秘密值。按 Issue 顺序协助我验证真实登录回跳、API Account 激活、Credential 获取、多 Token、Shell/PowerShell 复制、Session refresh 和仅退出 EggDoc。只把脱敏结果写入 Issue 并勾选实际通过的验收项。本轮不部署 Cloudflare，不得用模拟测试替代真实联调。
```

## 全部完成后的最终验收

9 项任务完成后，再进行一次整体回归：

1. 从干净依赖安装开始运行类型检查、完整自动化测试和生产构建。
2. 使用生产式预览验证 Pagefind、Sitemap、公开文章和所有动态接口边界。
3. 检查构建产物、搜索索引、Git diff 和测试输出中不存在任何真实凭据。
4. 在常用桌面与移动视口验证无文本溢出、控件重叠和不可达操作。
5. 对整个 PRD 实施范围执行一次最终 `/code-review`。
6. 确认所有 issue 验收项已勾选、实施记录完整、提交彼此独立。
7. 记录尚未实施的 Cloudflare 生产部署和 VPS 部署为后续工作，不在本轮扩展范围。
