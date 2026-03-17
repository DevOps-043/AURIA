import assert from "node:assert/strict";
import type { AqelorPlanLimits, AqelorToolDefinition } from "@auria/contracts";
import {
  evaluateToolFeasibility,
  getEffectiveSimultaneousAgents,
  planMeetsRequirement,
} from "./aqelor-feasibility.ts";

const tool: AqelorToolDefinition = {
  id: "tool-1",
  slug: "quality",
  name: "Quality",
  description: "Code quality improvements",
  category: "quality",
  costMinimumMicro: 200,
  costStandardMicro: 500,
  costFullMicro: 1000,
  allowsPartial: true,
  partialOutputType: "reduced_scope",
  isPremium: false,
  riskLevel: "low",
  maxLinesPerExecution: 200,
  maxFilesPerExecution: 10,
  maxAgentsRequired: 1,
  defaultModelTier: "lite",
  minPlanRequired: "free",
  monthlyLimitFree: 5,
  monthlyLimitStarter: 15,
  monthlyLimitPro: 50,
  isActive: true,
  sortOrder: 1,
};

const planLimits: AqelorPlanLimits = {
  planCode: "starter",
  maxAgentsAvailable: 10,
  maxAgentsSimultaneous: 2,
  maxRepositories: 3,
  maxLinesPerExecution: 500,
  maxFilesPerExecution: 20,
  maxDailyExecutions: 20,
  premiumToolsEnabled: false,
  maxResearchQueriesDaily: 15,
  maxDocsUploaded: 10,
  maxDocSizeBytes: 5_242_880,
  memoryRetentionDays: 30,
  byokEnabled: false,
  configurableModelRoles: [],
};

assert.equal(
  planMeetsRequirement("starter", "free"),
  true,
  "starter should satisfy free tool requirements",
);

assert.equal(
  getEffectiveSimultaneousAgents(planLimits, 4, 6),
  2,
  "effective simultaneous agents should honor the smallest cap",
);

assert.equal(
  evaluateToolFeasibility({
    availableMicro: 1000,
    tool,
    planCode: "starter",
    simultaneousAgents: 2,
    premiumToolsEnabled: false,
  }).verdict,
  "full",
  "full verdict should be returned when the full cost is covered",
);

assert.equal(
  evaluateToolFeasibility({
    availableMicro: 300,
    tool,
    planCode: "starter",
    simultaneousAgents: 2,
    premiumToolsEnabled: false,
  }).verdict,
  "partial",
  "partial verdict should be returned when only the minimum useful scope is covered",
);

assert.equal(
  evaluateToolFeasibility({
    availableMicro: 100,
    tool: {
      ...tool,
      allowsPartial: false,
    },
    planCode: "starter",
    simultaneousAgents: 2,
    premiumToolsEnabled: false,
  }).verdict,
  "not_feasible",
  "not_feasible should be returned when the tool cannot run partially",
);

console.log("aqelor-feasibility.test.ts: ok");
