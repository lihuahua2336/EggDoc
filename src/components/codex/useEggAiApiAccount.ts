import { useCallback, useEffect, useRef, useState } from "react";

import {
  parseEggAiApiAccountResponse,
  type EggAiApiCredential,
  type EggAiModelSummary,
} from "@/lib/eggai/account-response";

export type EggAiApiAccountState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | {
      activationUrl: string;
      credentials: EggAiApiCredential[];
      kind: "active";
      modelSummary: EggAiModelSummary;
    }
  | { activationUrl: string; kind: "inactive" }
  | { kind: "reauthorization-required" }
  | { kind: "temporary-error" }
  | { kind: "unavailable" };

export function useEggAiApiAccount() {
  const [accountState, setAccountState] = useState<EggAiApiAccountState>({ kind: "loading" });
  const awaitingActivationReturn = useRef(false);
  const requestSequence = useRef(0);

  const checkAccount = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setAccountState({ kind: "loading" });
    try {
      const response = await fetch("/api/eggai/account", {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const data = parseEggAiApiAccountResponse(await response.json());
      if (sequence !== requestSequence.current) return;
      if (!data) {
        setAccountState({ kind: "temporary-error" });
      } else if (data.state === "active") {
        setAccountState({
          activationUrl: data.activationUrl,
          credentials: data.credentials,
          kind: data.state,
          modelSummary: data.modelSummary,
        });
      } else if (data.state === "inactive") {
        setAccountState({ activationUrl: data.activationUrl, kind: data.state });
      } else {
        setAccountState({ kind: data.state });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== requestSequence.current) return;
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
      requestSequence.current += 1;
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
