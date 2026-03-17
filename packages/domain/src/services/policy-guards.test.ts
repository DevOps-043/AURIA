import assert from "node:assert/strict";
import { createDemoWorkspaceSnapshot } from "../entities/demo-workspace.ts";
import { requiresHumanReview } from "./policy-guards.ts";
import { buildWorkerCycle } from "./worker-plan.ts";

const snapshot = createDemoWorkspaceSnapshot();
const mission = snapshot.missions.find((candidate) => candidate.id === "mission-2");

assert.ok(mission, "mission-2 should exist in the demo snapshot");
assert.equal(
  requiresHumanReview(mission, snapshot.policies),
  true,
  "high-risk missions should require human review",
);

const limitedSnapshot = {
  ...snapshot,
  policies: {
    ...snapshot.policies,
    maxConcurrentAgents: 2,
  },
};

assert.equal(
  buildWorkerCycle(limitedSnapshot).length,
  2,
  "worker cycle should honor the max concurrent agents policy",
);

console.log("policy-guards.test.ts: ok");
