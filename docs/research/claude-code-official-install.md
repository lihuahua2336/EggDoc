# Claude Code 官方安装方式调研

调研日期：2026-07-17

范围：仅使用 Anthropic 官方 Claude Code 文档、Anthropic 官方安装端点和 Anthropic 官方 GitHub 仓库。本文用于约束 EggDoc 一键安装脚本的实现，不是面向最终用户的安装教程。

## 结论

EggDoc 可以提供一个很薄的一键安装包装器：按用户当前平台调用 Anthropic 推荐的原生安装器，透传 `latest`、`stable` 或具体版本，检查安装命令的退出状态，并用 `claude --version` 验证结果。包装器不应自行下载、拼装或替换 Claude Code 二进制，也不应把“安装完成”描述成“登录完成”。

官方推荐的原生安装命令是：

```bash
# macOS、Linux、WSL
curl -fsSL https://claude.ai/install.sh | bash
```

```powershell
# Windows PowerShell
irm https://claude.ai/install.ps1 | iex
```

```batch
:: Windows CMD
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

来源：[Advanced setup - Install Claude Code](https://code.claude.com/docs/en/setup#install-claude-code)。

## 支持范围与前置条件

- 操作系统：macOS 13.0+、Windows 10 1809+ 或 Windows Server 2019+、Ubuntu 20.04+、Debian 10+、Alpine Linux 3.19+。
- 硬件：至少 4 GB 内存，x64 或 ARM64 处理器。
- 需要互联网连接，并且用户所在地区必须在 Anthropic 支持国家或地区列表内。
- 支持 Bash、Zsh、PowerShell 和 CMD。
- 原生安装不依赖 Node.js。Node.js 22+ 只适用于可选的 npm 安装方式。

来源：[System requirements](https://code.claude.com/docs/en/setup#system-requirements)、[Install with npm](https://code.claude.com/docs/en/setup#install-with-npm)。

### Windows 与 WSL

- Windows 可以原生运行，也可以在 WSL 1/2 中运行；WSL 需要在 WSL 终端内执行 Linux 安装命令，不能从 PowerShell 或 CMD 代替执行。
- 原生 Windows 安装不需要管理员权限。
- Git for Windows 当前是可选项，不是安装前置条件。安装后 Claude Code 可以使用 Git Bash；没有 Git for Windows 时则使用 PowerShell 工具。
- WSL 2 支持 Claude Code 沙箱，原生 Windows 和 WSL 1 当前不支持。

来源：[Set up on Windows](https://code.claude.com/docs/en/setup#set-up-on-windows)。

### Alpine Linux

Alpine 和其他 musl/uClibc 系统还需要 `bash`、`curl`、`libgcc`、`libstdc++` 和 `ripgrep`，并要设置 `USE_BUILTIN_RIPGREP=0`。因此通用包装器不能只执行官方安装端点后就承诺所有 Alpine 环境可用。

来源：[Alpine Linux and musl-based distributions](https://code.claude.com/docs/en/setup#alpine-linux-and-musl-based-distributions)。

## 原生安装器行为

- 原生安装是官方推荐方式。
- 原生安装会在后台自动检查、下载更新，新版本在下次启动 Claude Code 时生效。
- macOS/Linux 的启动器位于 `~/.local/bin/claude`，版本文件位于 `~/.local/share/claude/versions/`。
- Windows 原生安装对应的可执行文件位于 `%USERPROFILE%\.local\bin\claude.exe`，版本数据位于 `%USERPROFILE%\.local\share\claude`。
- `claude update` 可以立即触发原生安装的更新；`claude doctor` 会报告最近一次更新尝试和安装健康状态。

来源：[Auto-updates](https://code.claude.com/docs/en/setup#auto-updates)、[Update manually](https://code.claude.com/docs/en/setup#update-manually)、[Native installation uninstall paths](https://code.claude.com/docs/en/setup#native-installation)。

Homebrew 和 WinGet 是官方支持的替代安装方式，但默认不自动更新：

```bash
brew install --cask claude-code
brew upgrade claude-code
```

```powershell
winget install Anthropic.ClaudeCode
winget upgrade Anthropic.ClaudeCode
```

Homebrew 的 `claude-code` cask 跟随约滞后一周、会跳过重大回归版本的 `stable` 通道；`claude-code@latest` 跟随最新通道。来源：[Install Claude Code](https://code.claude.com/docs/en/setup#install-claude-code)、[Update Claude Code](https://code.claude.com/docs/en/setup#update-claude-code)。

## 版本与发布通道

原生安装器接受三类值：

- `latest`：默认值，发布后尽快获取新版本。
- `stable`：通常比最新版本滞后一周，并跳过有重大回归的版本。
- 明确版本号，例如 `2.1.89`。

安装时选择的通道会成为后续自动更新的默认通道。官方命令如下：

```bash
curl -fsSL https://claude.ai/install.sh | bash -s stable
curl -fsSL https://claude.ai/install.sh | bash -s 2.1.89
```

```powershell
& ([scriptblock]::Create((irm https://claude.ai/install.ps1))) stable
& ([scriptblock]::Create((irm https://claude.ai/install.ps1))) 2.1.89
```

```batch
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd stable && del install.cmd
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd 2.1.89 && del install.cmd
```

来源：[Install a specific version](https://code.claude.com/docs/en/setup#install-a-specific-version)、[Configure release channel](https://code.claude.com/docs/en/setup#configure-release-channel)。

EggDoc 包装器应只允许 `latest`、`stable` 或严格的数字点分版本，不能把未经验证的字符串拼进 shell 命令。

## 验证与认证

安装后的最小验证是：

```bash
claude --version
```

更完整且只读的诊断是：

```bash
claude doctor
```

`claude doctor` 会检查安装健康状况、设置文件错误和警告，但包装器不应把它当作无条件成功标准，因为网络、用户配置等外部状态也可能产生警告。

安装并不等于认证。官方流程是在安装后运行 `claude`，再完成浏览器登录。Claude Code 需要 Pro、Max、Team、Enterprise 或 Console 账户；免费 Claude.ai 方案不包含 Claude Code。也可以使用官方列出的第三方云提供商。包装器不能承诺自动完成浏览器登录或账户资格验证。

来源：[Verify your installation](https://code.claude.com/docs/en/setup#verify-your-installation)、[Authenticate](https://code.claude.com/docs/en/setup#authenticate)。

## 卸载

原生安装：

```bash
rm -f ~/.local/bin/claude
rm -rf ~/.local/share/claude
```

```powershell
Remove-Item -Path "$env:USERPROFILE\.local\bin\claude.exe" -Force
Remove-Item -Path "$env:USERPROFILE\.local\share\claude" -Recurse -Force
```

其他安装方式：

```bash
brew uninstall --cask claude-code
npm uninstall -g @anthropic-ai/claude-code
```

```powershell
winget uninstall Anthropic.ClaudeCode
```

删除 `~/.claude`、`~/.claude.json`、项目 `.claude` 或 `.mcp.json` 会删除设置、权限、MCP 配置和会话历史，不能作为默认卸载动作；必须由用户另行明确选择。

来源：[Uninstall Claude Code](https://code.claude.com/docs/en/setup#uninstall-claude-code)、[Remove configuration files](https://code.claude.com/docs/en/setup#remove-configuration-files)。

## EggDoc 一键包装器的安全边界

包装器可以承诺：

- 调用 Anthropic 当前文档推荐的原生安装器。
- 支持 macOS/Linux/WSL 与 Windows PowerShell，并按需透传官方支持的发布通道或明确版本。
- 在官方安装器正常退出后刷新/提示 PATH，并运行 `claude --version` 验证命令是否可用。
- 安装失败时保留官方错误信息和非零退出状态，不伪造成功结果。

包装器不能承诺：

- 在 Anthropic 不支持的国家或地区、受限网络、代理或 TLS 拦截环境中一定成功。官方文档明确列出地区限制，并记录安装端点可能返回 HTML、403 或连接错误。来源：[System requirements](https://code.claude.com/docs/en/setup#system-requirements)、[Troubleshoot installation and login](https://code.claude.com/docs/en/troubleshoot-install#find-your-error)。
- 自动完成 Claude 账户登录、订阅资格检查或第三方提供商认证。
- 修改 Anthropic 安装器内部行为、替 Anthropic 固定二进制内容，或保证未来安装端点永不变化。
- 在 Alpine 等特殊发行版上自动满足全部系统依赖，除非 EggDoc 明确实现并测试对应分支。
- 删除用户的 `~/.claude`、`~/.claude.json`、`.claude` 或 `.mcp.json`。

实现时还应在执行下载内容前检查 HTTP 失败，并避免把 HTML 错误页交给 `bash` 或 PowerShell 解释器。官方排障页把 `syntax error near unexpected token '<'`、`Invoke-Expression: Missing argument in parameter list` 和 HTTP 403 都归因到安装脚本返回 HTML 或被网络/地区策略拦截。

## 来源清单

1. [Claude Code Docs: Advanced setup](https://code.claude.com/docs/en/setup)
2. [Claude Code Docs: Troubleshoot installation and login](https://code.claude.com/docs/en/troubleshoot-install)
3. [Anthropic Claude Code official GitHub repository](https://github.com/anthropics/claude-code)
4. [Anthropic supported countries](https://www.anthropic.com/supported-countries)
5. 官方安装端点：[Shell](https://claude.ai/install.sh)、[PowerShell](https://claude.ai/install.ps1)、[CMD](https://claude.ai/install.cmd)

补充说明：Anthropic 官方 GitHub 仓库当前没有公开这三个安装端点的脚本源码，因此包装器应把它们视为由 Anthropic 管理的远程安装入口，而不是可由 EggDoc 复制维护的稳定源码接口。
