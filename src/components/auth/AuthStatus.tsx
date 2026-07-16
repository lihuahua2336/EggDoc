import { ExternalLink, LoaderCircle, LogIn, LogOut, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Identity = {
  email?: string;
  name: string;
  picture?: string;
  subject: string;
};

type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "reauthorization-required" }
  | { kind: "unavailable" }
  | { eggAiPlatformUrl: string; identity: Identity; kind: "authenticated" };

type AuthStatusProps = {
  layout?: "drawer" | "header";
  onAction?: () => void;
};

const authMessages = {
  cancelled: "登录已取消，当前页面仍可公开阅读。",
  failed: "登录未完成，请重试。当前页面仍可公开阅读。",
  unavailable: "登录服务暂时不可用，当前页面仍可公开阅读。",
} as const;

function getReturnTo() {
  const current = new URL(window.location.href);
  current.searchParams.delete("auth_error");
  return `${current.pathname}${current.search}${current.hash}`;
}

function getLoginHref(returnTo: string, reauthorize = false) {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}${reauthorize ? "&reauthorize=1" : ""}`;
}

export function AuthStatus({ layout = "header", onAction }: AuthStatusProps) {
  const [state, setState] = useState<AuthState>({ kind: "loading" });
  const [returnTo, setReturnTo] = useState("/");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setReturnTo(getReturnTo());
    const error = new URL(window.location.href).searchParams.get("auth_error");
    if (error && error in authMessages) {
      setMessage(authMessages[error as keyof typeof authMessages]);
    }

    const controller = new AbortController();
    fetch("/api/auth/user", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (data.authenticated) {
          setState({
            eggAiPlatformUrl: data.eggAiPlatformUrl,
            kind: "authenticated",
            identity: data.identity,
          });
        } else if (data.reauthorizationRequired) {
          setState({ kind: "reauthorization-required" });
        } else if (data.unavailable) {
          setState({ kind: "unavailable" });
        } else {
          setState({ kind: "anonymous" });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ kind: "unavailable" });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const clearIdentity = () => setState({ kind: "anonymous" });
    window.addEventListener("eggdoc:session-cleared", clearIdentity);
    return () => window.removeEventListener("eggdoc:session-cleared", clearIdentity);
  }, []);

  async function logout() {
    const response = await fetch("/auth/logout", {
      credentials: "same-origin",
      method: "POST",
    });
    if (!response.ok) return;
    window.dispatchEvent(new CustomEvent("eggdoc:session-cleared"));
    onAction?.();
  }

  let action;
  if (layout === "drawer" && state.kind === "authenticated") {
    action = (
      <div className="min-w-0 space-y-3" aria-label="EggAi 当前身份">
        <div className="flex min-w-0 items-center gap-3 px-3">
          <UserRound aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{state.identity.name}</p>
            {state.identity.email && (
              <p className="truncate text-xs text-muted-foreground">{state.identity.email}</p>
            )}
          </div>
        </div>
        <Button asChild className="w-full justify-start" variant="ghost">
          <a
            href={state.eggAiPlatformUrl}
            onClick={onAction}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            打开 EggAi API 平台
          </a>
        </Button>
        <Button className="w-full justify-start" onClick={logout} type="button" variant="ghost">
          <LogOut aria-hidden="true" className="h-4 w-4" />
          退出 EggDoc
        </Button>
      </div>
    );
  } else if (state.kind === "authenticated") {
    action = (
      <div className="flex items-center gap-1" aria-label="EggAi 当前身份">
        <span className="hidden max-w-28 truncate text-sm font-medium lg:inline">
          {state.identity.name}
        </span>
        <UserRound aria-hidden="true" className="h-4 w-4 text-muted-foreground lg:hidden" />
        <Button asChild size="icon" variant="ghost">
          <a
            aria-label="打开 EggAi API 平台"
            href={state.eggAiPlatformUrl}
            rel="noreferrer"
            target="_blank"
            title="打开 EggAi API 平台"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        </Button>
        <Button asChild size="icon" variant="ghost">
          <a
            aria-label="重新授权 EggAi"
            href={getLoginHref(returnTo, true)}
            title="重新授权 EggAi"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          </a>
        </Button>
        <Button
          aria-label="退出 EggDoc"
          onClick={logout}
          size="icon"
          title="退出 EggDoc"
          type="button"
          variant="ghost"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    );
  } else if (layout === "drawer" && state.kind === "loading") {
    action = (
      <span
        aria-label="正在读取 EggAi 身份"
        className="flex h-10 items-center gap-2 px-3 text-sm text-muted-foreground"
      >
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        正在读取 EggAi 身份
      </span>
    );
  } else if (state.kind === "loading") {
    action = (
      <span
        aria-label="正在读取 EggAi 身份"
        className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground"
      >
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      </span>
    );
  } else if (layout === "drawer" && state.kind === "reauthorization-required") {
    action = (
      <Button asChild className="w-full justify-start" variant="outline">
        <a href={getLoginHref(returnTo, true)} onClick={onAction}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重新授权 EggAi
        </a>
      </Button>
    );
  } else if (state.kind === "reauthorization-required") {
    action = (
      <Button asChild size="sm" variant="outline">
        <a aria-label="重新授权 EggAi" href={getLoginHref(returnTo, true)}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          <span className="hidden lg:inline">重新授权</span>
        </a>
      </Button>
    );
  } else if (layout === "drawer" && state.kind === "unavailable") {
    action = <span className="block px-3 text-sm text-muted-foreground">登录暂不可用</span>;
  } else if (state.kind === "unavailable") {
    action = <span className="hidden text-sm text-muted-foreground lg:inline">登录暂不可用</span>;
  } else if (layout === "drawer") {
    action = (
      <Button asChild className="w-full justify-start" variant="outline">
        <a aria-label="登录 EggAi" href={getLoginHref(returnTo)} onClick={onAction}>
          <LogIn aria-hidden="true" className="h-4 w-4" />
          登录 EggAi
        </a>
      </Button>
    );
  } else {
    action = (
      <Button asChild size="sm" variant="outline">
        <a aria-label="登录 EggAi" href={getLoginHref(returnTo)}>
          <LogIn aria-hidden="true" className="h-4 w-4" />
          <span className="hidden lg:inline">登录 EggAi</span>
        </a>
      </Button>
    );
  }

  return (
    <>
      {action}
      {message && (
        <p
          className="fixed right-4 top-20 z-50 max-w-sm rounded-md border border-border bg-background px-4 py-3 text-sm shadow-sm"
          role="status"
        >
          {message}
        </p>
      )}
    </>
  );
}
