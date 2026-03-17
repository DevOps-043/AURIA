import {
  missionStatusOrder,
  type AgentStatus,
  type Mission,
  type MissionStatus,
  type WorkspaceSnapshot,
} from "@auria/contracts";

export type WorkspaceOverview = {
  activeAgents: number;
  blockedMissions: number;
  reviewQueue: number;
  completionRate: number;
  budgetBurnRate: number;
  readyKnowledgeDocuments: number;
};

export const groupMissionsByStatus = (missions: Mission[]) =>
  missionStatusOrder.reduce<Record<MissionStatus, Mission[]>>(
    (groups, status) => ({
      ...groups,
      [status]: missions.filter((mission) => mission.status === status),
    }),
    {
      discovered: [],
      analyzing: [],
      researching: [],
      executing: [],
      validating: [],
      review: [],
      blocked: [],
      completed: [],
    },
  );

export const summarizeWorkspace = (
  snapshot: WorkspaceSnapshot,
): WorkspaceOverview => {
  const activeAgents = snapshot.agents.filter((agent) => agent.state !== "idle").length;
  const completedMissions = snapshot.missions.filter(
    (mission) => mission.status === "completed",
  ).length;

  return {
    activeAgents,
    blockedMissions: snapshot.missions.filter((mission) => mission.status === "blocked")
      .length,
    reviewQueue: snapshot.reviewQueue.length,
    completionRate:
      snapshot.missions.length === 0
        ? 0
        : Math.round((completedMissions / snapshot.missions.length) * 100),
    budgetBurnRate: Math.round(
      (snapshot.billing.spendUsd / snapshot.billing.limitUsd) * 100,
    ),
    readyKnowledgeDocuments: snapshot.knowledgeBase.filter(
      (document) => document.status === "ready",
    ).length,
  };
};

export const sortAgentsByCost = (agents: AgentStatus[]) =>
  [...agents].sort((left, right) => right.costUsd - left.costUsd);
