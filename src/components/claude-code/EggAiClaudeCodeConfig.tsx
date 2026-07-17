import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  LogIn,
  PlugZap,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useEggAiApiAccount } from "@/components/codex/useEggAiApiAccount";
import { Button } from "@/components/ui/button";
import {
  CONFIGURATION_PLACEHOLDER,
  PUBLIC_EGGAI_BASE_URL,
  PUBLIC_INSTALLER_ORIGIN,
} from "@/config/public";
import {
  buildClaudeCodePowerShellDefaultInstallCommand,
  buildClaudeCodePowerShellInstallCommand,
  buildClaudeCodeShellDefaultInstallCommand,
  buildClaudeCodeShellInstallCommand,
  selectClaudeCodeModel,
} from "@/lib/claude-code/configuration";

type CopyStatus = "idle" | "copied" | "error";
type InstallMode = "official" | "eggai";
type Platform = "unix" | "windows";

const tutorialReturnTo = "/eggai/claude-code-install/#claude-code-config";
const platformStorageKey = "eggdoc:claude-code-platform";

function detectBrowserPlatform(): Platform {
  const browserNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = browserNavigator.userAgentData?.platform ?? browserNavigator.platform;
  return /^win/i.test(platform) ? "windows" : "unix";
}

function loginHref(reauthorize = false) {
  return `/auth/login?returnTo=${encodeURIComponent(tutorialReturnTo)}${reauthorize ? "&reauthorize=1" : ""}`;
}

function QuickCopyCommand({
  command,
  disabled,
  disabledLabel,
  resetKey,
}: {
  command: string;
  disabled: boolean;
  disabledLabel: string;
  resetKey: string;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => setStatus("idle"), [resetKey]);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-5 min-w-0 overflow-hidden rounded-sm border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
        <span>{command.startsWith("irm") || command.startsWith("&") ? "PowerShell" : "Shell"}</span>
        <Button
          aria-label={
            disabled
              ? disabledLabel
              : status === "copied"
                ? "安装命令已复制"
                : "复制安装命令"
          }
          className="h-8 bg-card"
          disabled={disabled}
          onClick={copyCommand}
          size="sm"
          type="button"
          variant="outline"
        >
          {status === "copied" ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
          {disabled ? "暂不可复制" : status === "copied" ? "已复制" : "复制"}
        </Button>
      </div>
      <pre
        className="m-0 max-h-44 min-w-0 overflow-auto border-0 bg-card p-4 text-sm leading-6 text-foreground"
        data-testid="claude-code-quick-command"
      >
        <code>{command}</code>
      </pre>
      {status === "error" && (
        <p className="border-t border-border px-4 py-2 text-sm text-destructive" role="status">
          复制失败，请手动选择命令。
        </p>
      )}
    </div>
  );
}

export function EggAiClaudeCodeConfig() {
  const [mode, setMode] = useState<InstallMode>("official");
  const { accountState, checkAccount, markActivationStarted } = useEggAiApiAccount(
    mode === "eggai",
  );
  const [platform, setPlatform] = useState<Platform>("unix");
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>();

  useEffect(() => {
    try {
      const rememberedPlatform = window.localStorage.getItem(platformStorageKey);
      if (rememberedPlatform === "unix" || rememberedPlatform === "windows") {
        setPlatform(rememberedPlatform);
        return;
      }
    } catch {
      // Browser detection remains available when persistent storage is unavailable.
    }
    setPlatform(detectBrowserPlatform());
  }, []);

  useEffect(() => {
    if (accountState.kind !== "active") return;
    setSelectedCredentialId(accountState.credentials[0].id);
  }, [accountState]);

  useEffect(() => {
    function handleSessionCleared() {
      setSelectedCredentialId(undefined);
    }
    window.addEventListener("eggdoc:session-cleared", handleSessionCleared);
    return () => window.removeEventListener("eggdoc:session-cleared", handleSessionCleared);
  }, []);

  const selectedCredential =
    accountState.kind === "active"
      ? (accountState.credentials.find((credential) => credential.id === selectedCredentialId) ??
        accountState.credentials[0])
      : undefined;
  const apiKey = selectedCredential?.key ?? CONFIGURATION_PLACEHOLDER;
  const baseUrl = selectedCredential?.baseUrl ?? PUBLIC_EGGAI_BASE_URL;
  const claudeModel =
    accountState.kind === "active"
      ? selectClaudeCodeModel(accountState.modelSummary.names)
      : undefined;
  const modelForPreview = claudeModel ?? "claude-model-unavailable";
  const officialCommand =
    platform === "windows"
      ? buildClaudeCodePowerShellDefaultInstallCommand(PUBLIC_INSTALLER_ORIGIN)
      : buildClaudeCodeShellDefaultInstallCommand(PUBLIC_INSTALLER_ORIGIN);
  const eggAiCommand =
    platform === "windows"
      ? buildClaudeCodePowerShellInstallCommand({
          apiKey,
          baseUrl,
          installerOrigin: PUBLIC_INSTALLER_ORIGIN,
          model: modelForPreview,
        })
      : buildClaudeCodeShellInstallCommand({
          apiKey,
          baseUrl,
          installerOrigin: PUBLIC_INSTALLER_ORIGIN,
          model: modelForPreview,
        });
  const command = mode === "official" ? officialCommand : eggAiCommand;

  function selectPlatform(nextPlatform: Platform) {
    setPlatform(nextPlatform);
    try {
      window.localStorage.setItem(platformStorageKey, nextPlatform);
    } catch {
      // Platform selection remains usable in memory.
    }
  }

  let eggAiAccount;
  if (accountState.kind === "loading") {
    eggAiAccount = (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        正在读取 EggAi 配置
      </p>
    );
  } else if (accountState.kind === "active") {
    eggAiAccount = (
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <label className="text-sm font-medium" htmlFor="claude-code-eggai-api-credential">
            EggAi 配置分组
          </label>
          <select
            className="mt-2 h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
            id="claude-code-eggai-api-credential"
            onChange={(event) => setSelectedCredentialId(event.target.value)}
            value={selectedCredential?.id}
          >
            {accountState.credentials.map((credential, index) => (
              <option key={credential.id} value={credential.id}>
                {index === 0 ? "默认 · " : ""}
                {credential.name} · {credential.group}
              </option>
            ))}
          </select>
        </div>
        <p className="inline-flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          {claudeModel ? (
            <CircleCheck aria-hidden="true" className="h-4 w-4 text-primary" />
          ) : (
            <CircleAlert aria-hidden="true" className="h-4 w-4 text-destructive" />
          )}
          {claudeModel ? "已就绪" : "暂无可用 Claude 模型"}
        </p>
      </div>
    );
  } else if (accountState.kind === "anonymous") {
    eggAiAccount = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">登录后自动填入 API Key 和默认配置分组。</p>
        <Button asChild size="sm" variant="outline">
          <a href={loginHref()}>
            <LogIn aria-hidden="true" className="h-4 w-4" />
            登录 EggAi
          </a>
        </Button>
      </div>
    );
  } else if (accountState.kind === "inactive") {
    eggAiAccount = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">先激活 EggAi API Account，再返回一键配置。</p>
        <Button asChild size="sm">
          <a
            href={accountState.activationUrl}
            onClick={markActivationStarted}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            激活 EggAi
          </a>
        </Button>
      </div>
    );
  } else if (accountState.kind === "reauthorization-required") {
    eggAiAccount = (
      <Button asChild size="sm" variant="outline">
        <a href={loginHref(true)}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重新授权 EggAi
        </a>
      </Button>
    );
  } else {
    eggAiAccount = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <CircleAlert aria-hidden="true" className="h-4 w-4 text-destructive" />
          暂时无法读取 EggAi 配置
        </p>
        <Button onClick={() => void checkAccount()} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label="Claude Code 安装"
      className="not-prose my-7 overflow-hidden rounded-sm border border-border bg-background text-foreground"
      data-code-copy-ignore
      data-configuration-placeholder={CONFIGURATION_PLACEHOLDER}
      id="claude-code-config"
    >
      <div className="border-b border-border px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Terminal aria-hidden="true" className="h-4 w-4" />
          快速安装
        </div>
        <h2 className="mt-2 text-xl font-semibold">选择安装方式</h2>
        <div aria-label="安装方式" className="mt-5 flex gap-5" role="tablist">
          <button
            aria-controls="claude-code-install-panel"
            aria-selected={mode === "official"}
            className="inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors data-[selected=false]:border-transparent data-[selected=false]:text-muted-foreground data-[selected=true]:border-primary data-[selected=true]:text-primary"
            data-selected={mode === "official"}
            onClick={() => setMode("official")}
            role="tab"
            type="button"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            无配置安装
          </button>
          <button
            aria-controls="claude-code-install-panel"
            aria-selected={mode === "eggai"}
            className="inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors data-[selected=false]:border-transparent data-[selected=false]:text-muted-foreground data-[selected=true]:border-primary data-[selected=true]:text-primary"
            data-selected={mode === "eggai"}
            onClick={() => setMode("eggai")}
            role="tab"
            type="button"
          >
            <PlugZap aria-hidden="true" className="h-4 w-4" />
            EggAi 配置
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6" id="claude-code-install-panel" role="tabpanel">
        <p className="text-sm leading-6 text-muted-foreground">
          {mode === "official"
            ? "无需登录。复制命令并在终端运行，只安装 Claude Code，不修改认证或模型提供方。"
            : "选择 EggAi 配置后，脚本会安装 Claude Code，并将所选分组写入全局 settings.json。"}
        </p>

        {mode === "eggai" && (
          <div className="mt-4 border-l-2 border-primary bg-muted/50 px-4 py-3">{eggAiAccount}</div>
        )}

        <div aria-label="操作系统" className="mt-5 inline-flex border border-border" role="group">
          <button
            aria-pressed={platform === "unix"}
            className="min-h-9 border-r border-border px-3 text-sm data-[active=true]:bg-muted data-[active=true]:font-semibold"
            data-active={platform === "unix"}
            onClick={() => selectPlatform("unix")}
            type="button"
          >
            macOS / Linux / WSL
          </button>
          <button
            aria-pressed={platform === "windows"}
            className="min-h-9 px-3 text-sm data-[active=true]:bg-muted data-[active=true]:font-semibold"
            data-active={platform === "windows"}
            onClick={() => selectPlatform("windows")}
            type="button"
          >
            Windows
          </button>
        </div>

        <QuickCopyCommand
          command={command}
          disabled={mode === "eggai" && (!selectedCredential || !claudeModel)}
          disabledLabel={selectedCredential ? "暂无可用 Claude 模型" : "登录 EggAi 后复制"}
          resetKey={`${mode}\u0000${platform}\u0000${apiKey}\u0000${baseUrl}\u0000${claudeModel}`}
        />

        {mode === "eggai" && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            脚本会发送一次 max_tokens=16 的流式工具调用检查。完整命令包含 API Key，剪贴板、终端历史、截图和 settings.json 都可能泄露密钥。
          </p>
        )}
      </div>
    </section>
  );
}
