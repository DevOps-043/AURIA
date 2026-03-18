import { useCallback, useEffect, useState } from "react";
import { desktopBridge } from "../../../shared/api/desktop-bridge";
import {
  createAutodevRuntimeSnapshot,
  type AutodevRunRequest,
  type AutodevRuntimeSnapshot,
} from "../../../../shared/autodev-types";

interface UseAutonomousRuntimeArgs {
  repoFullName?: string;
  repoBranch?: string;
  repoProvider?: string;
  repoUrl?: string | null;
  localPath?: string | null;
}

interface UseAutonomousRuntimeResult {
  snapshot: AutodevRuntimeSnapshot;
  loading: boolean;
  error: string | null;
  runNow: () => Promise<{ success: boolean; runId?: string; error?: string }>;
  abortRun: () => Promise<{ success: boolean }>;
}

export function useAutonomousRuntime({
  repoFullName,
  repoBranch,
  repoProvider,
  repoUrl,
  localPath,
}: UseAutonomousRuntimeArgs): UseAutonomousRuntimeResult {
  const [snapshot, setSnapshot] = useState<AutodevRuntimeSnapshot>(
    createAutodevRuntimeSnapshot(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const context: AutodevRunRequest = {
    repoFullName,
    repoBranch,
    repoProvider,
    repoUrl,
    localPath,
  };

  useEffect(() => {
    let cancelled = false;

    const refreshSnapshot = async () => {
      const currentSnapshot = await desktopBridge.autodevGetRuntime();
      if (!cancelled) {
        setSnapshot(currentSnapshot);
      }
      return currentSnapshot;
    };

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        await desktopBridge.autodevSetContext(context);
        await refreshSnapshot();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo inicializar el runtime autonomo.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = desktopBridge.onAutodevRuntimeUpdate((nextSnapshot: AutodevRuntimeSnapshot) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      });
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo suscribir al runtime autonomo.",
        );
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshSnapshot().catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo refrescar el runtime autonomo.",
          );
        }
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, [localPath, repoBranch, repoFullName, repoProvider, repoUrl]);

  const runNow = useCallback(async () => {
    try {
      setError(null);
      const result = await desktopBridge.autodevRunNow(context);
      const currentSnapshot = await desktopBridge.autodevGetRuntime();
      setSnapshot(currentSnapshot);

      if (!result.success && result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo iniciar la ejecucion autonoma.";
      setError(message);
      return {
        success: false,
        error: message,
      };
    }
  }, [context]);

  const abortRun = useCallback(async () => {
    try {
      setError(null);
      const result = await desktopBridge.autodevAbortRun();
      const currentSnapshot = await desktopBridge.autodevGetRuntime();
      setSnapshot(currentSnapshot);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo abortar la ejecucion autonoma.";
      setError(message);
      return { success: false };
    }
  }, []);

  return {
    snapshot,
    loading,
    error,
    runNow,
    abortRun,
  };
}
