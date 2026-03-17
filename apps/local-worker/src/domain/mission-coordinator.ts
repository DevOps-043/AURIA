import type { WorkspaceSnapshot } from "@auria/contracts";
import { buildWorkerCycle } from "@auria/domain";

export const coordinateLocalWorker = (snapshot: WorkspaceSnapshot) =>
  buildWorkerCycle(snapshot);
