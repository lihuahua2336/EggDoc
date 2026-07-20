# AI 编程最终实战录制提纲：从 0 用 Codex 开发并部署 EggDoc

这份提纲用于第三期视频、PPT 或直播。定位不是复盘已有项目，而是边录制、边使用当前教程，从空文件夹复现 EggDoc。

## 一句话目标

让新手看到：AI 编程不是让 Codex 一次性生成完整项目，而是从空目录开始，通过 Prompt、Context、Tool、Agent、Skill 和 Harness，一步步搭建、验证并部署一个真实文档站。

## 视频建议结构

建议拆成两个视频，或者一条 35 到 50 分钟的长视频。

### 版本 A：一条长视频

1. 开场和目标说明
2. 创建空项目文件夹
3. 让 Codex 做规划
4. 创建 README 和计划文档
5. 初始化 Astro
6. 建立内容模型
7. 创建页面路由
8. 优化文章阅读体验
9. 接入 Pagefind 搜索
10. 加入 EggAi Codex 安装脚本
11. 写三节课程内容
12. 构建验证
13. Cloudflare Pages 部署
14. 回顾 Harness 流程

### 版本 B：拆成上下两集

**上集：从 0 到本地站点跑起来**

- 创建文件夹
- 规划项目
- 初始化 Astro
- 内容模型
- 页面路由
- 本地预览

**下集：从可运行到可发布**

- 阅读体验
- Pagefind 搜索
- EggAi 安装脚本
- 教程内容
- 构建
- Cloudflare Pages 部署
- Harness 总结

## 录制主线

整期视频只围绕一条线：

```txt
空文件夹 -> 项目上下文 -> 小切片 -> 验证 -> 下一个切片 -> 部署
```

每一步都要回答三个问题：

1. 现在要让 Codex 做什么？
2. 这一步对应哪个 AI 编程概念？
3. 如何验证它真的完成了？

## 详细脚本

### 1. 开场

口播：

```txt
前两期我们已经完成了 Codex 安装和 AI 编程核心概念。
这一期我们从一个空文件夹开始，用 Codex 搭建 EggDoc 文档站。
我会一边操作，一边解释每一步对应哪个概念：
Prompt、Context、Tool、Agent、Skill 和 Harness。
```

屏幕动作：

- 打开终端
- 进入准备录制的工作目录

### 2. 创建项目文件夹

命令：

```bash
mkdir EggDoc
cd EggDoc
git init
```

概念穿插：

- AI 编程仍然是工程流程
- Git 是回退点
- 空目录让观众确认项目是从 0 开始

### 3. 让 Codex 做规划

启动：

```bash
codex
```

Prompt：

```txt
我想从 0 创建一个中文优先的文档站，名字叫 EggDoc。

目标：
- 用 Astro 做静态站点
- 用 Markdown/MDX 写内容
- 有 EggAi 指南、AI 编程学习路径、工具概念笔记
- 有文章页、标签页、搜索页
- 支持 Pagefind 搜索
- 支持 light/dark/system 主题
- 最后部署到 Cloudflare Pages

请先给我一个分阶段实现计划。
暂时不要创建文件。
```

概念穿插：

- 这是 Prompt
- 好 Prompt 包含目标、约束、输出要求和边界
- “暂时不要创建文件”就是边界

### 4. 建立项目上下文

Prompt：

```txt
请根据刚才的计划，创建：
- README.md
- docs/plan.md

README 写清楚项目是什么、如何运行、如何构建。
docs/plan.md 写清楚 MVP 范围、内容类型、技术架构和非目标。
先只创建文档，不初始化 Astro。
```

概念穿插：

- README 和 plan.md 是后续 Context
- Context 不是越多越好，而是越相关越好
- 先写非目标，可以减少后面跑偏

验证：

```bash
git diff
```

### 5. 初始化 Astro

Prompt：

```txt
请初始化 Astro 项目。

要求：
- 使用 TypeScript
- 保持静态站点
- 安装 Markdown/MDX、React、Tailwind、Pagefind、sitemap 相关依赖
- 不加入数据库、登录、SSR 或服务端功能
- 完成后告诉我应该运行哪些命令验证
```

概念穿插：

- Codex 开始调用 Tool
- Tool 包括运行命令、写文件、读 package.json
- 不是只听 Codex 总结，要实际运行验证

验证：

```bash
npm.cmd run check
npm.cmd run build
```

### 6. 建立内容模型

Prompt：

```txt
请实现 Astro Content Collections。

内容类型：
- guides：任务型指南
- lessons：学习路径里的课程
- notes：工具介绍和概念笔记

共享字段：
- title
- description
- publishedAt
- updatedAt
- tags
- draft
- featured

guides 需要 service、app、order。
lessons 需要 path、order、可选 videoUrl。
notes 需要可选 topic。

完成后创建每类内容的最小示例文章，并运行类型检查。
```

概念穿插：

- 内容模型就是项目的结构化上下文
- Token 预算要用在关键字段和规则上
- schema 能把自然语言需求变成可验证规则

验证：

```bash
npm.cmd run check
```

### 7. 创建页面路由

Prompt：

```txt
请基于内容集合创建这些页面：
- /
- /eggai/
- /eggai/[...slug]/
- /learn/
- /learn/[...slug]/
- /notes/
- /notes/[...slug]/
- /tags/[tag]/
- /search/

要求：
- 首页是内容入口，不做营销落地页
- lesson 有上一节/下一节
- 文章页显示标题、描述、日期、标签、目录和相关文章
- 完成后运行 build
```

概念穿插：

- Codex 此时像 Agent
- 它要读 schema、改 pages、处理 URL、运行 build
- Agent 的关键是循环：计划、行动、观察、修正

验证：

```bash
npm.cmd run build
npm.cmd run dev
```

浏览器打开：

```txt
http://127.0.0.1:4321/
```

### 8. 优化阅读体验

Prompt：

```txt
请优化基础阅读体验：
- BaseLayout 负责 SEO、canonical、Open Graph
- Header 有主导航、搜索入口和主题切换
- ArticleLayout 有目录、标签、发布时间、更新时间、相关文章
- 支持 light、dark、system 主题

保持设计克制，优先阅读，不要做营销风格首页。
```

概念穿插：

- Harness 包含设计边界
- 我们不是让 AI 自由发挥，而是让它在文档站目标内发挥

验证：

- 浏览首页
- 切换主题
- 打开文章页
- 检查移动端宽度

### 9. 接入搜索

Prompt：

```txt
请接入 Pagefind 静态搜索。

要求：
- build 后生成 Pagefind 索引
- 搜索页使用 /pagefind/pagefind.js
- 只索引文章正文
- 搜索框提示可以搜索 Codex、EggAi、MCP、Agent
- 开发模式下如果索引不存在，要给出友好提示
```

概念穿插：

- Tool 的结果会进入反馈循环
- build 后 Pagefind 才有索引
- 搜索要在浏览器里实际试

验证：

```bash
npm.cmd run build
npm.cmd run preview
```

### 10. 加入 EggAi Codex 安装脚本

Prompt：

```txt
请为 EggAi + Codex 接入创建托管脚本：
- public/install/codex.sh
- public/install/codex.ps1

要求：
- 支持 baseurl，默认 https://api.eggai.icu/v1
- 支持 sk-key / SK_KEY
- 支持 language：zh-cn 或 en-us
- 支持 dry-run
- dry-run 只输出计划，不安装、不写文件、不登录
- 真实执行时先验证 EggAi `/models`，再更新 `~/.codex/config.toml` 和 provider-scoped `EGGAI_API_KEY`，不调用 `codex login`
- Windows Codex 脚本只通过 winget 安装 OpenAI 的精确 Microsoft Store 产品 `9PLM9XGG6VKS`；官方商店不可用时明确报错并停止，不切换第三方下载源
```

概念穿插：

- 安装脚本是 Skill 思维
- dry-run 是 Harness 的安全设计
- 它让用户先看将要发生什么

验证：

```bash
bash -n public/install/codex.sh
bash public/install/codex.sh --dry-run
powershell -NoProfile -ExecutionPolicy Bypass -File public\install\codex.ps1 -DryRun
npm.cmd run build
```

### 11. 写课程内容

Prompt：

```txt
请创建 AI 编程入门学习路径的三节课：

1. Codex 安装与入门
2. AI 编程的核心概念
3. 从 0 用 Codex 开发并部署 EggDoc

要求：
- 第一节引用 EggAi Codex 脚本指南
- 第二节解释 LLM、Prompt、Token、Context、Tool、MCP、Agent、Skill
- 第三节是跟做型项目实战，从创建项目文件夹开始
```

概念穿插：

- 课程内容本身也是 Context
- 后面的读者会沿着这条学习路径理解项目

### 12. 部署

本地验证：

```bash
npm.cmd run build
```

Cloudflare Pages 配置：

```txt
Framework preset: Astro
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 22 or newer
```

可选 CLI：

```bash
npm run deploy:cloudflare
```

概念穿插：

- 部署是交付闭环
- 构建通过不等于用户能访问
- AI 编程最终要落到可访问成果

### 13. 总结 Harness

总结图：

```txt
空文件夹
-> README / plan.md
-> Astro 项目
-> 内容模型
-> 页面路由
-> 阅读体验
-> 搜索
-> 安装脚本
-> 课程内容
-> 构建
-> 部署
```

对应概念：

```txt
Prompt：每一步给 Codex 的任务
Context：文档、代码、错误输出和决策
Tool：读写文件、运行命令、构建和预览
Agent：Codex 的规划、执行、验证、修正
Skill：可复用的脚本和流程
Harness：目标、边界、工具、验证、部署组成的整体工程外壳
```

## PPT 页建议

1. 标题：从 0 用 Codex 开发并部署 EggDoc
2. 前两期回顾
3. 本期最终成果
4. 空文件夹开始
5. Prompt：先规划，不写代码
6. Context：README 和 plan.md
7. Tool：初始化 Astro 和运行构建
8. Agent：内容模型到页面路由
9. Harness：边界、验证和反馈
10. Skill：EggAi 安装脚本和 dry-run
11. Deploy：Cloudflare Pages
12. 总结：AI 编程不是一次生成，而是逐步交付

## 录制提醒

- 不要提前准备完整代码粘贴。
- 可以提前准备 Prompt，但让 Codex 现场执行。
- 每个阶段都要运行验证命令。
- 如果出现错误，不要急着剪掉，解释它如何成为 Context。
- 控制每步范围，避免一次让 Codex 改太多文件。
- 视频里反复强调：小切片、强验证、可部署。
