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
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useEggAiApiAccount } from "@/components/codex/useEggAiApiAccount";
import {
  CONFIGURATION_PLACEHOLDER,
  DEFAULT_CODEX_LANGUAGE,
  POWERSHELL_INSTALL_COMMAND,
  PUBLIC_EGGAI_BASE_URL,
  SHELL_INSTALL_COMMAND,
} from "@/config/public";

type CopyStatus = "idle" | "copied" | "error";

const tutorialReturnTo = "/eggai/codex-installer/#codex-config";

function loginHref(reauthorize = false) {
  return `/auth/login?returnTo=${encodeURIComponent(tutorialReturnTo)}${reauthorize ? "&reauthorize=1" : ""}`;
}

function useCopyValue(value: string) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return { copyValue, status };
}

function CopyableCommand({ command, title }: { command: string; title: string }) {
  const { copyValue, status } = useCopyValue(command);

  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Button onClick={copyValue} size="sm" type="button" variant="outline">
          {status === "copied" ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
          {status === "copied" ? `${title}已复制` : `复制 ${title}`}
        </Button>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-5">
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

export function EggAiCodexConfig() {
  const { copyValue: copyBaseUrl, status: baseUrlCopyStatus } =
    useCopyValue(PUBLIC_EGGAI_BASE_URL);
  const { accountState, checkAccount, markActivationStarted } = useEggAiApiAccount();

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

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Configuration Placeholder</p>
          <code className="mt-2 block overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-sm">
            {CONFIGURATION_PLACEHOLDER}
          </code>
          <p className="mt-2 text-sm font-medium text-destructive">这不是可用密钥</p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">EggAi Base URL</p>
          <code className="mt-2 block overflow-x-auto text-sm">{PUBLIC_EGGAI_BASE_URL}</code>
          <Button
            className="mt-3"
            onClick={copyBaseUrl}
            size="sm"
            type="button"
            variant="outline"
          >
            {baseUrlCopyStatus === "copied" ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
            {baseUrlCopyStatus === "copied" ? "Base URL 已复制" : "复制 Base URL"}
          </Button>
          {baseUrlCopyStatus === "error" && (
            <p className="mt-2 text-sm text-destructive" role="status">
              复制失败，请手动选择地址。
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">默认语言</p>
          <code className="mt-2 block text-sm">{DEFAULT_CODEX_LANGUAGE}</code>
        </div>

        <CopyableCommand command={SHELL_INSTALL_COMMAND} title="Shell 示例" />
        <CopyableCommand command={POWERSHELL_INSTALL_COMMAND} title="PowerShell 示例" />
      </div>
    </section>
  );
}
