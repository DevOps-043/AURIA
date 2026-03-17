import { createDemoWorkspaceSnapshot } from "@auria/domain";
import { coordinateLocalWorker } from "../domain/mission-coordinator.ts";
import { printWorkerReport } from "../infrastructure/console-reporter.ts";

export const runDemoWorker = async () => {
  const snapshot = createDemoWorkspaceSnapshot();
  const plan = coordinateLocalWorker(snapshot);

  printWorkerReport(snapshot, plan);

  return plan;
};
