import { useCallback, useEffect, useRef, useState } from "react";

import { parseEggAiApiAccountResponse } from "@/lib/eggai/account-response";

export type EggAiApiAccountState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { activationUrl: string; kind: "active" | "inactive" }
  | { kind: "reauthorization-required" }
  | { kind: "temporary-error" }
  | { kind: "unavailable" };

export function useEggAiApiAccount() {
  const [accountState, setAccountState] = useState<EggAiApiAccountState>({ kind: "loading" });
  const awaitingActivationReturn = useRef(false);

  const checkAccount = useCallback(async (signal?: AbortSignal) => {
    setAccountState({ kind: "loading" });
    try {
      const response = await fetch("/api/eggai/account", {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const data = parseEggAiApiAccountResponse(await response.json());
      if (!data) {
        setAccountState({ kind: "temporary-error" });
      } else if (data.state === "active" || data.state === "inactive") {
        setAccountState({ activationUrl: data.activationUrl, kind: data.state });
      } else {
        setAccountState({ kind: data.state });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAccountState({ kind: "temporary-error" });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkAccount(controller.signal);

    function handleFocus() {
      if (!awaitingActivationReturn.current) return;
      awaitingActivationReturn.current = false;
      void checkAccount();
    }

    function handleSessionCleared() {
      awaitingActivationReturn.current = false;
      setAccountState({ kind: "anonymous" });
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("eggdoc:session-cleared", handleSessionCleared);
    return () => {
      controller.abort();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("eggdoc:session-cleared", handleSessionCleared);
    };
  }, [checkAccount]);

  return {
    accountState,
    checkAccount,
    markActivationStarted: () => {
      awaitingActivationReturn.current = true;
    },
  };
}
