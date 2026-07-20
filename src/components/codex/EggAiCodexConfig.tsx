import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  ExternalLink,
  FileCog,
  KeyRound,
  LoaderCircle,
  LogIn,
  PlugZap,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useEggAiApiAccount } from "@/components/codex/useEggAiApiAccount";
import {
  CONFIGURATION_PLACEHOLDER,
  DEFAULT_CODEX_LANGUAGE,
  PUBLIC_EGGAI_BASE_URL,
  PUBLIC_INSTALLER_ORIGIN,
} from "@/config/public";
import {
  CODEX_DEFAULT_MODEL,
  buildCodexConfigToml,
  buildPowerShellDefaultInstallCommand,
  buildPowerShellInstallCommand,
  buildShellDefaultInstallCommand,
  buildShellInstallCommand,
  selectCodexModel,
} from "@/lib/codex/configuration";

type CopyStatus = "idle" | "copied" | "error";
type CodexPlatform = "unix" | "windows";
type InstallMode = "official" | "eggai";

const tutorialReturnTo = "/eggai/codex-installer/#codex-config";
const codexPlatformStorageKey = "eggdoc:codex-platform";

function detectBrowserPlatform(): CodexPlatform {
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
  copyValue,
  disabled = false,
  platform,
  resetKey,
}: {
  command: string;
  copyValue: string;
  disabled?: boolean;
  platform: CodexPlatform;
  resetKey: string;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => setStatus("idle"), [resetKey]);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-5 min-w-0 overflow-hidden rounded-sm border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
        <span>{platform === "windows" ? "PowerShell" : "Shell"}</span>
        <Button
          aria-label={
            disabled ? "登录 EggAi 后复制" : status === "copied" ? "安装命令已复制" : "复制安装命令"
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
          {disabled ? "登录后复制" : status === "copied" ? "已复制" : "复制"}
        </Button>
      </div>
      <pre
        className="m-0 w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden border-0 bg-card p-4 text-sm leading-6 text-foreground"
        data-testid="codex-quick-command"
      >
        <code className="block w-max min-w-full whitespace-nowrap">{command}</code>
      </pre>
      {status === "error" && (
        <p className="border-t border-border px-4 py-2 text-sm text-destructive" role="status">
          复制失败，请手动选择命令。
        </p>
      )}
    </div>
  );
}

function CopyValueButton({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Copy;
  label: string;
  value: string;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <Button onClick={copyValue} size="sm" type="button" variant="outline">
        {status === "copied" ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Icon aria-hidden="true" className="h-4 w-4" />
        )}
        {status === "copied" ? `${label} 已复制` : `复制 ${label}`}
      </Button>
      {status === "error" && (
        <p className="mt-2 text-xs text-destructive" role="status">
          复制失败，请重试。
        </p>
      )}
    </div>
  );
}

export function EggAiCodexConfig() {
  const [mode, setMode] = useState<InstallMode>("official");
  const { accountState, checkAccount, markActivationStarted } = useEggAiApiAccount(
    mode === "eggai",
  );
  const [platform, setPlatform] = useState<CodexPlatform>("unix");
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>();

  useEffect(() => {
    try {
      const rememberedPlatform = window.localStorage.getItem(codexPlatformStorageKey);
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
  const codexModel =
    accountState.kind === "active"
      ? selectCodexModel(accountState.modelSummary.names)
      : undefined;
  const commandModel = codexModel ?? CODEX_DEFAULT_MODEL;
  const codexConfigToml = buildCodexConfigToml({
    baseUrl,
    language: DEFAULT_CODEX_LANGUAGE,
    model: commandModel,
  });

  const officialCommand =
    platform === "windows"
      ? buildPowerShellDefaultInstallCommand(PUBLIC_INSTALLER_ORIGIN)
      : buildShellDefaultInstallCommand(PUBLIC_INSTALLER_ORIGIN);
  const buildEggAiCommand = (key: string) =>
    platform === "windows"
      ? buildPowerShellInstallCommand({
          apiKey: key,
          baseUrl,
          installerOrigin: PUBLIC_INSTALLER_ORIGIN,
          language: DEFAULT_CODEX_LANGUAGE,
          model: commandModel,
        })
      : buildShellInstallCommand({
          apiKey: key,
          baseUrl,
          installerOrigin: PUBLIC_INSTALLER_ORIGIN,
          language: DEFAULT_CODEX_LANGUAGE,
          model: commandModel,
        });
  const eggAiPreview = buildEggAiCommand(apiKey);
  const commandPreview = mode === "official" ? officialCommand : eggAiPreview;
  const commandCopyValue = mode === "official" ? officialCommand : buildEggAiCommand(apiKey);

  function selectPlatform(nextPlatform: CodexPlatform) {
    setPlatform(nextPlatform);
    try {
      window.localStorage.setItem(codexPlatformStorageKey, nextPlatform);
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
          <label className="text-sm font-medium" htmlFor="eggai-api-credential">
            EggAi 配置分组
          </label>
          <select
            className="mt-2 h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
            id="eggai-api-credential"
            onChange={(event) => setSelectedCredentialId(event.target.value)}
            value={selectedCredential?.id}
          >
            {accountState.credentials.map((credential, index) => (
              <option key={credential.id} value={credential.id}>
                {index === 0 ? "默认 · " : ""}{credential.name} · {credential.group}
              </option>
            ))}
          </select>
        </div>
        <p className="inline-flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          {codexModel ? (
            <CircleCheck aria-hidden="true" className="h-4 w-4 text-primary" />
          ) : (
            <CircleAlert aria-hidden="true" className="h-4 w-4 text-destructive" />
          )}
          {codexModel ? `模型 ${codexModel}` : "暂无可用 GPT 模型"}
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
      aria-label="Codex 安装"
      className="not-prose my-7 overflow-hidden rounded-sm border border-border bg-background text-foreground"
      data-code-copy-ignore
      data-configuration-placeholder={CONFIGURATION_PLACEHOLDER}
      id="codex-config"
    >
      <div className="border-b border-border px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Terminal aria-hidden="true" className="h-4 w-4" />
          快速安装
        </div>
        <h2 className="mt-2 text-xl font-semibold">选择安装方式</h2>
        <div aria-label="安装方式" className="mt-5 flex gap-5" role="tablist">
          <button
            aria-controls="codex-install-panel"
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
            aria-controls="codex-install-panel"
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

      <div className="p-4 sm:p-6" id="codex-install-panel" role="tabpanel">
        <p className="text-sm leading-6 text-muted-foreground">
          {mode === "official"
            ? "无需登录。复制命令并在终端运行，只安装 Codex，不修改模型提供方。"
            : "选择 EggAi 配置后，脚本会安装 Codex，并一次写好 config.toml 与 EGGAI_API_KEY 环境变量。"}
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
          command={commandPreview}
          copyValue={commandCopyValue}
          disabled={mode === "eggai" && (!selectedCredential || !codexModel)}
          platform={platform}
          resetKey={`${mode}\u0000${platform}\u0000${apiKey}\u0000${baseUrl}\u0000${commandModel}`}
        />

        {mode === "eggai" && selectedCredential && codexModel && (
          <details className="group mt-4 border-t border-border pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
              分别复制配置
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyValueButton icon={KeyRound} label="API Key" value={apiKey} />
              <CopyValueButton icon={FileCog} label="config.toml" value={codexConfigToml} />
            </div>
          </details>
        )}

        {mode === "eggai" && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            完整命令可能包含 API Key。剪贴板、终端历史、截图或分享命令都可能泄露密钥。
          </p>
        )}
      </div>
    </section>
  );
}
