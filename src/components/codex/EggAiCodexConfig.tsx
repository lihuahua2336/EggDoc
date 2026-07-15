import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useEggAiApiAccount } from "@/components/codex/useEggAiApiAccount";
import {
  CONFIGURATION_PLACEHOLDER,
  DEFAULT_CODEX_LANGUAGE,
  POWERSHELL_INSTALL_COMMAND,
  PUBLIC_EGGAI_BASE_URL,
  PUBLIC_INSTALLER_ORIGIN,
} from "@/config/public";
import {
  buildCodexConfigToml,
  buildShellInstallCommand,
  type CodexLanguage,
} from "@/lib/codex/configuration";
import type { EggAiApiCredential, EggAiModelSummary } from "@/lib/eggai/account-response";

type CopyStatus = "idle" | "copied" | "error";

const tutorialReturnTo = "/eggai/codex-installer/#codex-config";
const selectedCredentialStorageKey = "eggdoc:selected-api-credential-id";
const codexLanguageStorageKey = "eggdoc:codex-language";

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
  copyButtonLabel,
  getCopyValue,
  statusResetKey,
  title,
}: {
  command: string;
  copyButtonLabel?: string;
  getCopyValue?: () => string;
  statusResetKey?: string;
  title: string;
}) {
  const { copyValue, status } = useCopyAction(
    () => getCopyValue?.() ?? command,
    statusResetKey ?? command,
  );

  return (
    <div className="min-w-0 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Button
          aria-label={status === "copied" ? `${title}已复制` : copyButtonLabel}
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
  const shellCommandPreview = buildShellInstallCommand({
    apiKey: selectedCredential
      ? "sk-REDACTED-EXPLICIT-COPY-ONLY"
      : CONFIGURATION_PLACEHOLDER,
    baseUrl: configurationBaseUrl,
    installerOrigin: PUBLIC_INSTALLER_ORIGIN,
    language,
  });

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

  let panelTitle = "Codex 配置";
  let accountAction;
  if (accountState.kind === "loading") {
    accountAction = (
      <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        正在检查 EggAi API Account
      </p>
    );
  } else if (accountState.kind === "anonymous") {
    panelTitle = "Codex 匿名配置";
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
    panelTitle = "Codex 匿名配置";
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
      aria-labelledby="codex-config-title"
      className="not-prose my-8 overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
    >
      <header className="border-b border-border bg-muted/40 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <KeyRound aria-hidden="true" className="h-5 w-5 text-primary" />
          <div>
            <h2 id="codex-config-title" className="text-base font-semibold">
              {panelTitle}
            </h2>
            {accountAction}
          </div>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:grid-cols-2 sm:p-5 [&>*]:min-w-0">
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

        <div className="sm:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-6">
          <p className="flex items-start gap-2">
            <CircleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>
              点击“复制完整 Shell 命令”时，生成的命令会包含 API Key。复制后，剪贴板、shell
              history、截图或分享的命令都可能暴露密钥。
            </span>
          </p>
        </div>

        <CopyableCommand
          command={shellCommandPreview}
          copyButtonLabel="复制完整 Shell 命令"
          getCopyValue={() =>
            buildShellInstallCommand({
              apiKey: configurationApiKey,
              baseUrl: configurationBaseUrl,
              installerOrigin: PUBLIC_INSTALLER_ORIGIN,
              language,
            })
          }
          statusResetKey={`${configurationApiKey}\u0000${configurationBaseUrl}\u0000${language}`}
          title="完整 Shell 命令"
        />
        <CopyableCommand command={POWERSHELL_INSTALL_COMMAND} title="PowerShell 示例" />
      </div>
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
