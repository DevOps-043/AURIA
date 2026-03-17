import type { MissionStatus, WorkspaceSnapshot } from "@auria/contracts";
import {
  canAutoExecuteMission,
  requiresHumanReview,
} from "./policy-guards.ts";

export type WorkerPlanItem = {
  missionId: string;
  title: string;
  lane: "proposal" | "execution";
  approvalRequired: boolean;
  reason: string | null;
  assignedAgents: string[];
};

const queueableStatuses = new Set<MissionStatus>([
  "discovered",
  "analyzing",
  "researching",
]);

export const buildWorkerCycle = (
  snapshot: WorkspaceSnapshot,
): WorkerPlanItem[] =>
  snapshot.missions
    .filter((mission) => queueableStatuses.has(mission.status))
    .slice(0, snapshot.policies.maxConcurrentAgents)
    .map((mission) => {
      const approvalRequired = requiresHumanReview(mission, snapshot.policies);
      const lane = canAutoExecuteMission(mission, snapshot.policies)
        ? "execution"
        : "proposal";

      return {
        missionId: mission.id,
        title: mission.title,
        lane,
        approvalRequired,
        reason: approvalRequired
          ? "Mission exceeds the current policy envelope or touches a critical zone."
          : null,
        assignedAgents: mission.assignedAgents,
      };
    });
