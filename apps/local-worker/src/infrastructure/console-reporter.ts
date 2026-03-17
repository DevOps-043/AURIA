import type { WorkspaceSnapshot } from "@auria/contracts";
import type { WorkerPlanItem } from "@auria/domain";

export const printWorkerReport = (
  snapshot: WorkspaceSnapshot,
  plan: WorkerPlanItem[],
) => {
  console.log("");
  console.log("Auria local worker demo");
  console.log(`Workspace: ${snapshot.name}`);
  console.log(`Mode: ${snapshot.mode}`);
  console.log(`Policy window: ${snapshot.policies.executionWindow}`);
  console.log(`Concurrent agents: ${snapshot.policies.maxConcurrentAgents}`);
  console.log("");

  for (const item of plan) {
    console.log(`- ${item.title}`);
    console.log(`  lane: ${item.lane}`);
    console.log(`  approval required: ${item.approvalRequired ? "yes" : "no"}`);
    console.log(`  agents: ${item.assignedAgents.join(", ")}`);

    if (item.reason) {
      console.log(`  note: ${item.reason}`);
    }
  }

  console.log("");
};
