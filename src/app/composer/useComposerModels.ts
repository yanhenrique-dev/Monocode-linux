import { useCallback, type Dispatch, type SetStateAction } from "react";
import { forgetHarnessSession } from "../../lib/harness";
import {
  isPreparingHandoff,
  planComposerSwitch,
} from "../../lib/handoff";
import {
  preferredModelSettings,
  resolveModel,
  saveLastModelSettings,
  saveRecentModelChoice,
} from "../../lib/models";
import type { HarnessId, RuntimeMode, Session } from "../../lib/session";
import { withHarnessChoice } from "../sessionTransforms";

export type ComposerModelDeps = {
  sessionsRef: { current: Session[] };
  setSessions: Dispatch<SetStateAction<Session[]>>;
};

export type ComposerModelApi = {
  onModelChange: (sessionId: string, harness: HarnessId, model: string) => void;
  onModelSettingsChange: (
    sessionId: string,
    modelSettings: Record<string, string>,
  ) => void;
  onRuntimeModeChange: (sessionId: string, runtimeMode: RuntimeMode) => void;
};

/**
 * Model/harness selection for the composer (Fase 3c): pure session-list
 * updates with stable identities. Extracted from useComposer verbatim.
 */
export function useComposerModels(deps: ComposerModelDeps): ComposerModelApi {
  const { sessionsRef, setSessions } = deps;

  const onModelChange = useCallback(
    (sessionId: string, harness: HarnessId, model: string) => {
      const current = sessionsRef.current.find((s) => s.id === sessionId);
      if (!current) return;
      if (isPreparingHandoff(current)) return;
      const resolved = resolveModel(harness, model);
      saveRecentModelChoice(resolved.harness, resolved.id);
      if (current.modelSettings) {
        saveLastModelSettings(current.modelSettings, "fill");
      }
      const modelSettings = preferredModelSettings(
        resolved,
        current.modelSettings,
      );
      const plan = planComposerSwitch(current, harness);
      if (plan.kind === "empty") {
        void forgetHarnessSession(plan.forget, sessionId);
      }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const next = withHarnessChoice(
            s,
            harness,
            resolved.id,
            modelSettings,
          );
          if (plan.kind === "arm") {
            return { ...next, pendingSwitch: plan.pending };
          }
          if (plan.kind === "revert") {
            return {
              ...next,
              pendingSwitch: undefined,
              ...(plan.restoreProviderSessionId
                ? { providerSessionId: plan.restoreProviderSessionId }
                : { providerSessionId: undefined }),
              ...(plan.restoreProviderAccountId
                ? { providerAccountId: plan.restoreProviderAccountId }
                : { providerAccountId: undefined }),
            };
          }
          if (plan.kind === "empty") {
            return { ...next, pendingSwitch: undefined };
          }
          return next;
        }),
      );
    },
    [sessionsRef, setSessions],
  );

  const onModelSettingsChange = useCallback(
    (sessionId: string, modelSettings: Record<string, string>) => {
      saveLastModelSettings(modelSettings);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, modelSettings } : s)),
      );
    },
    [setSessions],
  );

  const onRuntimeModeChange = useCallback(
    (sessionId: string, runtimeMode: RuntimeMode) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, runtimeMode } : s)),
      );
    },
    [setSessions],
  );

  return { onModelChange, onModelSettingsChange, onRuntimeModeChange };
}
