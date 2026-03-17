import type { Mission, PolicySettings } from "@auria/contracts";
import { requiresHumanReview, touchesCriticalPath } from "@auria/domain";

export const evaluateRiskGate = (
  mission: Mission,
  policies: PolicySettings,
) => ({
  approvalRequired: requiresHumanReview(mission, policies),
  touchesCriticalPath: touchesCriticalPath(mission, policies),
  reason: requiresHumanReview(mission, policies)
    ? "Mission requires a human checkpoint before execution."
    : "Mission is inside the current guardrails.",
});
