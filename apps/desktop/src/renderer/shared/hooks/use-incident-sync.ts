import { useEffect, useRef } from "react";
import { supabase } from "@/shared/api/supabase-client";
import { desktopBridge } from "@/shared/api/desktop-bridge";
import type { AutodevIncident, AutodevRuntimeSnapshot } from "../../../../shared/autodev-types";

/**
 * Syncs autodev incidents to Supabase when a run finishes.
 *
 * Listens for runtime snapshot updates. When the run transitions from
 * "running" to a terminal state (completed/failed/aborted) and there
 * are incidents in the snapshot, it batch-inserts them into the
 * `autodev_incidents` table.
 */
export function useIncidentSync(userId: string | undefined): void {
  const lastStatusRef = useRef<string | null>(null);
  const syncedRunIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!userId || !supabase) return;

    const unsubscribe = desktopBridge.onAutodevRuntimeUpdate(
      (snapshot: AutodevRuntimeSnapshot) => {
        const { status, currentRunId, incidents } = snapshot.state;
        const prevStatus = lastStatusRef.current;
        lastStatusRef.current = status;

        // Only sync when a run finishes
        const isTerminal = status === "completed" || status === "failed" || status === "aborted";
        if (prevStatus !== "running" || !isTerminal) return;
        if (!currentRunId || incidents.length === 0) return;

        // Avoid double-syncing the same run
        if (syncedRunIdsRef.current.has(currentRunId)) return;
        syncedRunIdsRef.current.add(currentRunId);

        // Keep set bounded
        if (syncedRunIdsRef.current.size > 50) {
          const entries = [...syncedRunIdsRef.current];
          syncedRunIdsRef.current = new Set(entries.slice(-25));
        }

        void syncIncidentsToSupabase(userId, incidents);
      },
    );

    return unsubscribe;
  }, [userId]);
}

async function syncIncidentsToSupabase(
  userId: string,
  incidents: AutodevIncident[],
): Promise<void> {
  if (!supabase || incidents.length === 0) return;

  const rows = incidents.map((inc) => ({
    user_id: userId,
    run_id: inc.runId,
    stage_id: inc.stageId,
    category: inc.category,
    severity: inc.severity,
    title: inc.title,
    message: inc.message,
    metadata: inc.metadata,
    status: inc.status,
    created_at: inc.createdAt,
  }));

  try {
    const { error } = await supabase.from("autodev_incidents").insert(rows);
    if (error) {
      console.error("[IncidentSync] Failed to insert incidents:", error.message);
    } else {
      console.log(`[IncidentSync] Synced ${rows.length} incident(s) for run.`);
    }
  } catch (err) {
    console.error("[IncidentSync] Unexpected error syncing incidents:", err);
  }
}
