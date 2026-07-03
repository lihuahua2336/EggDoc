---
type: lesson
title: Codex 安装与入门
description: 从 Codex 安装、EggAi 接入和基础使用开始，建立 AI 编程学习路径的第一个工作环境。
publishedAt: 2026-07-03
updatedAt: 2026-07-03
tags: [codex, ai-programming]
draft: false
featured: true
path: ai-programming
order: 10
---

这一节会带你完成 Codex 的安装、登录和基础使用。如果你准备用 EggAi 作为 Codex 的模型接入方式，可以先读这篇指南：

[用脚本把 Codex 接入 EggAi](/eggai/codex-installer/)

那篇文章负责具体的安装脚本、`baseurl`、`sk-key` 和 `language` 参数；这一节负责解释装好之后如何开始使用 Codex 做 AI 编程。

## 你会学到什么

- Codex 适合承担哪些编程任务
- 如何通过 EggAi 脚本完成 Codex 的安装与配置
- 如何打开一个项目并让 Codex 读取上下文
- 如何把需求描述成可以执行的任务

## 推荐安装路线

如果你使用 EggAi，优先使用脚本接入路线：

1. 打开 [用脚本把 Codex 接入 EggAi](/eggai/codex-installer/)。
2. 按你的系统选择 Linux shell 或 Windows PowerShell 命令。
3. 传入 EggAi 的 `sk-key`，必要时覆盖默认 `baseurl`。
4. 安装完成后，重新打开终端并运行 `codex login status`。

这样做的好处是：Codex 安装、EggAi Base URL、API Key 和默认语言偏好会在一个流程里完成，后面学习 AI 编程时就不需要反复手动修改配置文件。

## 第一次使用

安装完成后，进入一个项目目录，直接启动 Codex：

```sh
codex
```

第一次练习可以从一个很小的任务开始，例如：

```txt
请阅读这个项目的 README 和 package.json，告诉我本地开发和构建命令是什么。
```

确认 Codex 能读懂项目结构后，再把任务升级为“修改一个页面”“解释一个模块”或“运行构建并修复错误”。

## 下一步

完成环境准备后，我们会进入 AI 编程中的核心概念。
