import { Check, Copy, KeyRound, LogIn } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CONFIGURATION_PLACEHOLDER,
  DEFAULT_CODEX_LANGUAGE,
  POWERSHELL_INSTALL_COMMAND,
  PUBLIC_EGGAI_BASE_URL,
  SHELL_INSTALL_COMMAND,
} from "@/config/public";

type CopyStatus = "idle" | "copied" | "error";

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

export function AnonymousCodexConfig() {
  const { copyValue: copyBaseUrl, status: baseUrlCopyStatus } =
    useCopyValue(PUBLIC_EGGAI_BASE_URL);

  return (
    <section
      id="codex-config"
      aria-labelledby="anonymous-codex-config-title"
      className="not-prose my-8 overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
    >
      <header className="border-b border-border bg-muted/40 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <KeyRound aria-hidden="true" className="h-5 w-5 text-primary" />
          <div>
            <h2 id="anonymous-codex-config-title" className="text-base font-semibold">
              Codex 匿名配置
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              登录 EggAi 后可自动填入你的配置；不登录也可以复制下面的公开示例。
            </p>
            <Button asChild className="mt-3" size="sm" variant="outline">
              <a
                aria-label="登录 EggAi"
                href="/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config"
              >
                <LogIn aria-hidden="true" className="h-4 w-4" />
                登录 EggAi
              </a>
            </Button>
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
