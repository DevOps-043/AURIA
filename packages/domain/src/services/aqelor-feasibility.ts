import type {
  AqelorPlanLimits,
  AqelorToolDefinition,
  FeasibilityVerdict,
  PlanCode,
} from "@auria/contracts";

const planOrder: Record<PlanCode, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export interface ToolFeasibilityInput {
  availableMicro: number;
  tool: AqelorToolDefinition;
  planCode: PlanCode;
  simultaneousAgents: number;
  premiumToolsEnabled?: boolean;
}

export interface ToolFeasibilityResult {
  verdict: FeasibilityVerdict;
  reason: string;
  blockers: string[];
  chargeMicro: number;
}

export const comparePlans = (left: PlanCode, right: PlanCode): number =>
  planOrder[left] - planOrder[right];

export const planMeetsRequirement = (
  planCode: PlanCode,
  minimumPlan: PlanCode,
): boolean => comparePlans(planCode, minimumPlan) >= 0;

export const getToolMonthlyLimit = (
  tool: AqelorToolDefinition,
  planCode: PlanCode,
): number | null => {
  switch (planCode) {
    case "free":
      return tool.monthlyLimitFree;
    case "starter":
      return tool.monthlyLimitStarter;
    case "pro":
      return tool.monthlyLimitPro;
    case "enterprise":
      return null;
    default:
      return null;
  }
};

export const getEffectiveSimultaneousAgents = (
  planLimits: Pick<AqelorPlanLimits, "maxAgentsSimultaneous">,
  repositoryCap?: number | null,
  workspaceCap?: number | null,
): number =>
  [planLimits.maxAgentsSimultaneous, repositoryCap, workspaceCap]
    .filter((value): value is number => typeof value === "number" && value > 0)
    .reduce((smallest, current) => Math.min(smallest, current));

export function evaluateToolFeasibility(
  input: ToolFeasibilityInput,
): ToolFeasibilityResult {
  const blockers: string[] = [];

  if (!input.tool.isActive) {
    blockers.push("Tool is inactive.");
  }

  if (!planMeetsRequirement(input.planCode, input.tool.minPlanRequired)) {
    blockers.push(`Requires ${input.tool.minPlanRequired} plan or higher.`);
  }

  if (input.tool.isPremium && input.premiumToolsEnabled === false) {
    blockers.push("Premium tools are disabled for this plan.");
  }

  if (input.simultaneousAgents < input.tool.maxAgentsRequired) {
    blockers.push(
      `Needs ${input.tool.maxAgentsRequired} simultaneous agents, but only ${input.simultaneousAgents} are available.`,
    );
  }

  if (blockers.length > 0) {
    return {
      verdict: "not_feasible",
      reason: blockers[0],
      blockers,
      chargeMicro: 0,
    };
  }

  if (input.availableMicro >= input.tool.costFullMicro) {
    return {
      verdict: "full",
      reason: "Budget covers the full execution envelope.",
      blockers: [],
      chargeMicro: input.tool.costFullMicro,
    };
  }

  if (input.tool.allowsPartial && input.availableMicro >= input.tool.costMinimumMicro) {
    const coversStandard = input.availableMicro >= input.tool.costStandardMicro;

    return {
      verdict: "partial",
      reason: coversStandard
        ? "Budget covers a standard execution but not the full envelope."
        : "Budget only covers the minimum useful scope.",
      blockers: [],
      chargeMicro: coversStandard
        ? input.tool.costStandardMicro
        : input.tool.costMinimumMicro,
    };
  }

  return {
    verdict: "not_feasible",
    reason: input.tool.allowsPartial
      ? `Minimum useful scope starts at ${input.tool.costMinimumMicro} micro-AU.`
      : `Full execution requires ${input.tool.costFullMicro} micro-AU.`,
    blockers: [],
    chargeMicro: 0,
  };
}
