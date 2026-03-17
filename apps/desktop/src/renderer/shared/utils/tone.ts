import type { MissionStatus, RiskLevel } from "@auria/contracts";
import type { PillTone } from "@auria/ui";

export const riskTone = (risk: RiskLevel): PillTone => {
  switch (risk) {
    case "low":
      return "success";
    case "moderate":
      return "info";
    case "high":
      return "warning";
    case "critical":
      return "danger";
  }
};

export const missionStatusTone = (status: MissionStatus): PillTone => {
  switch (status) {
    case "completed":
      return "success";
    case "blocked":
      return "danger";
    case "executing":
    case "validating":
      return "warning";
    case "review":
      return "info";
    default:
      return "neutral";
  }
};

export const workerStatusTone = (
  status: "ready" | "warming" | "offline",
): PillTone => {
  switch (status) {
    case "ready":
      return "success";
    case "warming":
      return "warning";
    case "offline":
      return "danger";
  }
};
