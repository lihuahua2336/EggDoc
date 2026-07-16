import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  LoaderCircle,
  LogIn,
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
  buildCodexConfigToml,
  buildPowerShellInstallCommand,
  buildShellInstallCommand,
  type CodexLanguage,
} from "@/lib/codex/configuration";
import type { EggAiApiCredential, EggAiModelSummary } from "@/lib/eggai/account-response";

type CopyStatus = "idle" | "copied" | "error";
type CodexPlatform = "unix" | "windows";

const tutorialReturnTo = "/eggai/codex-installer/#codex-config";
const selectedCredentialStorageKey = "eggdoc:selected-api-credential-id";
const codexLanguageStorageKey = "eggdoc:codex-language";
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

function useCopyAction(getValue: () => string, resetKey: string) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    setStatus("idle");
  }, [resetKey]);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(getValue());
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return { copyValue, status };
}

function useCopyValue(value: string) {
  return useCopyAction(() => value, value);
}

function CopyableCommand({
  command,
  title,
}: {
  command: string;
  title: string;
}) {
  const { copyValue, status } = useCopyValue(command);

  return (
    <div className="min-w-0 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Button
          onClick={copyValue}
          size="sm"
          type="button"
          variant="outline"
        >
          {status === "copied" ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
          {status === "copied" ? `${title}已复制` : `复制 ${title}`}
        </Button>
      </div>
      <pre className="mt-2 max-h-40 min-w-0 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-5">
        <code>{command}</code>
      </pre>
      {status === "error" && (
        <p className="mt-2 text-sm text-destructive" role="status">
          复制失败，请手动选择命令。
        </p>
      )}
    </div>
  );
}

function QuickCopyCommand({
  command,
  getCopyValue,
  statusResetKey,
}: {
  command: string;
  getCopyValue: () => string;
  statusResetKey: string;
}) {
  const { copyValue, status } = useCopyAction(getCopyValue, statusResetKey);

  return (
    <div className="mt-5 min-w-0 overflow-hidden rounded-md border border-white/15 bg-black/20">
      <div className="flex min-w-0 items-stretch">
        <pre
          className="min-w-0 flex-1 overflow-x-auto !rounded-none !border-0 !bg-transparent !px-4 !py-3 text-xs leading-6 text-neutral-100 sm:text-sm"
          data-testid="codex-quick-command"
        >
          <code>{command}</code>
        </pre>
        <div className="flex shrink-0 items-center border-l border-white/10 px-2">
          <Button
            aria-label={status === "copied" ? "一键配置命令已复制" : "复制一键配置命令"}
            className="border-white/15 bg-white/5 text-neutral-100 hover:bg-white/10 hover:text-white"
            onClick={copyValue}
            size="sm"
            type="button"
            variant="outline"
          >
            {status === "copied" ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{status === "copied" ? "已复制" : "复制"}</span>
          </Button>
        </div>
      </div>
      {status === "error" && (
        <p className="border-t border-white/10 px-4 py-2 text-sm text-red-300" role="status">
          复制失败，请手动选择命令。
        </p>
      )}
    </div>
  );
}

function CopyableValue({
  buttonLabel,
  displayAsCode = false,
  inputLabel,
  value,
}: {
  buttonLabel: string;
  displayAsCode?: boolean;
  inputLabel: string;
  value: string;
}) {
  const { copyValue, status } = useCopyValue(value);

  return (
    <div className="min-w-0">
      {displayAsCode ? (
        <>
          <p className="text-xs font-medium text-muted-foreground">{inputLabel}</p>
          <code className="mt-2 block overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-sm">
            {value}
          </code>
        </>
      ) : (
        <>
          <label className="text-xs font-medium text-muted-foreground" htmlFor={inputLabel}>
            {inputLabel}
          </label>
          <input
            className="mt-2 h-10 w-full rounded-md border border-border bg-muted/30 px-3 font-mono text-sm text-foreground"
            id={inputLabel}
            readOnly
            value={value}
          />
        </>
      )}
      <Button className="mt-3" onClick={copyValue} size="sm" type="button" variant="outline">
        {status === "copied" ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Copy aria-hidden="true" className="h-4 w-4" />
        )}
        {status === "copied" ? `${buttonLabel} 已复制` : `复制 ${buttonLabel}`}
      </Button>
      {status === "error" && (
        <p className="mt-2 text-sm text-destructive" role="status">
          复制失败，请手动选择内容。
        </p>
      )}
    </div>
  );
}

function CredentialDetails({
  credential,
  credentials,
  modelSummary,
  onCredentialChange,
}: {
  credential: EggAiApiCredential;
  credentials: EggAiApiCredential[];
  modelSummary: EggAiModelSummary;
  onCredentialChange: (id: string) => void;
}) {
  return (
    <>
      {credentials.length > 1 && (
        <div className="sm:col-span-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="eggai-api-credential"
          >
            EggAi API Credential
          </label>
          <select
            className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            id="eggai-api-credential"
            onChange={(event) => onCredentialChange(event.target.value)}
            value={credential.id}
          >
            {credentials.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {option.group}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground">Token 名称</p>
        <p className="mt-2 text-sm font-medium">{credential.name}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Token 组</p>
        <p className="mt-2 text-sm font-medium">{credential.group}</p>
      </div>
      <div className="sm:col-span-2">
        <p className="text-xs font-medium text-muted-foreground">可用模型</p>
        <p className="mt-2 text-sm font-medium">{modelSummary.availableCount} 个可用模型</p>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {modelSummary.names.join("、") || "当前未返回模型名称"}
        </p>
      </div>
    </>
  );
}

export function EggAiCodexConfig() {
  const { accountState, checkAccount, markActivationStarted } = useEggAiApiAccount();
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>();
  const [language, setLanguage] = useState<CodexLanguage>(DEFAULT_CODEX_LANGUAGE);
  const [platform, setPlatform] = useState<CodexPlatform>("unix");

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
    try {
      const rememberedLanguage = window.localStorage.getItem(codexLanguageStorageKey);
      if (rememberedLanguage === "zh-cn" || rememberedLanguage === "en-us") {
        setLanguage(rememberedLanguage);
      }
    } catch {
      // The default language remains usable when persistent browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (accountState.kind !== "active") return;
    let rememberedId: string | null = null;
    try {
      rememberedId = window.localStorage.getItem(selectedCredentialStorageKey);
    } catch {
      // Selection remains usable when persistent browser storage is unavailable.
    }
    const nextId = accountState.credentials.some((credential) => credential.id === rememberedId)
      ? rememberedId!
      : accountState.credentials[0].id;
    setSelectedCredentialId(nextId);
    rememberSelectedCredential(nextId);
  }, [accountState]);

  useEffect(() => {
    function handleSessionCleared() {
      setSelectedCredentialId(undefined);
      try {
        window.localStorage.removeItem(selectedCredentialStorageKey);
      } catch {
        // The in-memory selection is still cleared.
      }
    }

    window.addEventListener("eggdoc:session-cleared", handleSessionCleared);
    return () => window.removeEventListener("eggdoc:session-cleared", handleSessionCleared);
  }, []);

  const selectedCredential =
    accountState.kind === "active"
      ? (accountState.credentials.find((credential) => credential.id === selectedCredentialId) ??
        accountState.credentials[0])
      : undefined;

  const configurationApiKey = selectedCredential?.key ?? CONFIGURATION_PLACEHOLDER;
  const configurationBaseUrl = selectedCredential?.baseUrl ?? PUBLIC_EGGAI_BASE_URL;
  const codexConfigToml = buildCodexConfigToml({ baseUrl: configurationBaseUrl, language });
  const buildInstallCommand = (apiKey: string) =>
    platform === "windows"
      ? buildPowerShellInstallCommand({
          apiKey,
          baseUrl: configurationBaseUrl,
          installerOrigin: PUBLIC_INSTALLER_ORIGIN,
          language,
        })
      : buildShellInstallCommand({
          apiKey,
          baseUrl: configurationBaseUrl,
          installerOrigin: PUBLIC_INSTALLER_ORIGIN,
          language,
        });
  const installCommandPreview = buildInstallCommand(
    selectedCredential ? "sk-REDACTED-EXPLICIT-COPY-ONLY" : CONFIGURATION_PLACEHOLDER,
  );

  function selectCredential(id: string) {
    setSelectedCredentialId(id);
    rememberSelectedCredential(id);
  }

  function selectLanguage(nextLanguage: CodexLanguage) {
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem(codexLanguageStorageKey, nextLanguage);
    } catch {
      // Language selection remains usable in memory.
    }
  }

  function selectPlatform(nextPlatform: CodexPlatform) {
    setPlatform(nextPlatform);
    try {
      window.localStorage.setItem(codexPlatformStorageKey, nextPlatform);
    } catch {
      // Platform selection remains usable in memory.
    }
  }

  let accountAction;
  if (accountState.kind === "loading") {
    accountAction = (
      <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        正在检查 EggAi API Account
      </p>
    );
  } else if (accountState.kind === "anonymous") {
    accountAction = (
      <>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          登录 EggAi 后可自动填入你的配置；不登录也可以复制下面的公开示例。
        </p>
        <Button asChild className="mt-3" size="sm" variant="outline">
          <a aria-label="登录 EggAi" href={loginHref()}>
            <LogIn aria-hidden="true" className="h-4 w-4" />
            登录 EggAi
          </a>
        </Button>
      </>
    );
  } else if (accountState.kind === "inactive") {
    accountAction = (
      <>
        <p className="mt-1 text-sm font-medium">尚未激活 EggAi API Account</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          激活会在新标签页完成，当前教程和阅读位置会保留。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <a
              aria-label="激活 EggAi API Account"
              href={accountState.activationUrl}
              onClick={markActivationStarted}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              激活 EggAi API Account
            </a>
          </Button>
          <Button onClick={() => void checkAccount()} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新检查
          </Button>
        </div>
      </>
    );
  } else if (accountState.kind === "active") {
    accountAction = (
      <>
        <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium">
          <CircleCheck aria-hidden="true" className="h-4 w-4 text-primary" />
          EggAi API Account 已激活
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={accountState.activationUrl} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              打开 EggAi API 平台
            </a>
          </Button>
          <Button onClick={() => void checkAccount()} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新检查
          </Button>
        </div>
      </>
    );
  } else if (accountState.kind === "reauthorization-required") {
    accountAction = (
      <>
        <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium">
          <CircleAlert aria-hidden="true" className="h-4 w-4 text-destructive" />
          EggAi 授权已过期
        </p>
        <Button asChild className="mt-3" size="sm" variant="outline">
          <a href={loginHref(true)}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新授权 EggAi
          </a>
        </Button>
      </>
    );
  } else {
    const unavailable = accountState.kind === "unavailable";
    accountAction = (
      <>
        <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium">
          <CircleAlert aria-hidden="true" className="h-4 w-4 text-destructive" />
          {unavailable ? "EggAi 配置服务暂不可用" : "暂时无法检查 EggAi API Account"}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          公开教程仍可阅读和使用，请稍后重试。
        </p>
        <Button className="mt-3" onClick={() => void checkAccount()} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重试
        </Button>
      </>
    );
  }

  return (
    <section
      id="codex-config"
      aria-label={
        accountState.kind === "anonymous" || accountState.kind === "reauthorization-required"
          ? "Codex 匿名配置"
          : "Codex 配置"
      }
      className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-50"
    >
      <div className="px-4 py-5 sm:px-7 sm:py-7">
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
          <Terminal aria-hidden="true" className="h-4 w-4" />
          <span>QUICK START</span>
          <span className="rounded border border-orange-400/30 bg-orange-400/15 px-2 py-0.5 text-orange-200">
            推荐 · 最省事
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold sm:text-2xl">一键配置</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
          {selectedCredential
            ? `已填入当前 EggAi API Credential。复制命令后，粘贴到${platform === "windows" ? " Windows PowerShell" : " macOS 或 Linux 终端"}运行即可。`
            : `复制命令后，将示例 API Key 替换为你的 EggAi API Key，再粘贴到${platform === "windows" ? " Windows PowerShell" : " macOS 或 Linux 终端"}运行。`}
        </p>

        <div
          aria-label="操作系统"
          className="mt-4 inline-flex max-w-full rounded-md border border-white/15 bg-white/5 p-1"
          role="group"
        >
          <Button
            aria-pressed={platform === "windows"}
            className={platform === "windows" ? "bg-white/15 text-white" : "text-neutral-300"}
            onClick={() => selectPlatform("windows")}
            size="sm"
            type="button"
            variant="ghost"
          >
            Windows
          </Button>
          <Button
            aria-pressed={platform === "unix"}
            className={platform === "unix" ? "bg-white/15 text-white" : "text-neutral-300"}
            onClick={() => selectPlatform("unix")}
            size="sm"
            type="button"
            variant="ghost"
          >
            macOS / Linux
          </Button>
        </div>

        <QuickCopyCommand
          command={installCommandPreview}
          getCopyValue={() => buildInstallCommand(configurationApiKey)}
          statusResetKey={`${platform}\u0000${configurationApiKey}\u0000${configurationBaseUrl}\u0000${language}`}
        />

        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-400">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
          <span>
            复制后的完整命令可能包含 API Key，请留意剪贴板和
            {platform === "windows" ? " PowerShell history" : " shell history"} 风险。
          </span>
        </p>
      </div>

      <div className="border-t border-border bg-card px-4 py-4 text-card-foreground sm:px-7">
        {accountAction}
      </div>

      <details className="group border-t border-neutral-800 bg-card text-card-foreground">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium sm:px-7">
          <span>配置详情</span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 border-t border-border p-4 sm:grid-cols-2 sm:p-7 [&>*]:min-w-0">
          {selectedCredential && accountState.kind === "active" ? (
            <CredentialDetails
              credential={selectedCredential}
              credentials={accountState.credentials}
              modelSummary={accountState.modelSummary}
              onCredentialChange={selectCredential}
            />
          ) : (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Configuration Placeholder</p>
              <p className="mt-2 text-sm font-medium text-destructive">这不是可用密钥</p>
            </div>
          )}

          <CopyableValue
            buttonLabel="API Key"
            displayAsCode
            inputLabel="Selected API Credential"
            value={configurationApiKey}
          />
          <CopyableValue
            buttonLabel="Base URL"
            inputLabel="EggAi Base URL"
            value={configurationBaseUrl}
          />

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="codex-language">
              Codex 默认语言
            </label>
            <select
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              id="codex-language"
              onChange={(event) => selectLanguage(event.target.value as CodexLanguage)}
              value={language}
            >
              <option value="zh-cn">简体中文 (zh-cn)</option>
              <option value="en-us">English (en-us)</option>
            </select>
          </div>

          <CopyableCommand command={codexConfigToml} title="config.toml" />
        </div>
      </details>
    </section>
  );
}

function rememberSelectedCredential(id: string) {
  try {
    window.localStorage.setItem(selectedCredentialStorageKey, id);
  } catch {
    // Token IDs are a convenience preference; selection still works in memory.
  }
}
