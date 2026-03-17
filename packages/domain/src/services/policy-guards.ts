import type { Mission, PolicySettings, RiskLevel } from "@auria/contracts";

const riskRank: Record<RiskLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

export const touchesCriticalPath = (
  mission: Mission,
  policies: PolicySettings,
): boolean =>
  mission.touchedFiles.some((file) =>
    policies.criticalPaths.some((criticalPath) => file.startsWith(criticalPath)),
  );

export const requiresHumanReview = (
  mission: Mission,
  policies: PolicySettings,
): boolean => {
  if (riskRank[mission.risk] >= riskRank[policies.requireHumanReviewAbove]) {
    return true;
  }

  if (mission.changedLines > policies.maxLinesPerMission) {
    return true;
  }

  if (mission.touchedFiles.length > policies.maxFilesTouched) {
    return true;
  }

  return touchesCriticalPath(mission, policies);
};

export const canAutoExecuteMission = (
  mission: Mission,
  policies: PolicySettings,
): boolean => !requiresHumanReview(mission, policies);
