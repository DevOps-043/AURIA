import type {
  AqelorWallet,
  AuPackCatalog,
  AuTransactionRecord,
  BillingCheckoutSessionRecord,
  BillingEventRecord,
  BillingGatewayState,
  BillingPlanOffer,
  BillingSubscriptionRecord,
  PlanAuAllocation,
  PlanCode,
  SubscriptionStatus,
  WorkspaceMode,
} from "@auria/contracts";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["trialing", "active"];
const PENDING_CHECKOUT_STATUSES = new Set([
  "pending",
  "open",
  "requires_gateway",
]);

export interface BillingWorkspaceRecord {
  id: string;
  name: string;
  mode: WorkspaceMode;
  subscriptionId: string | null;
  maxConcurrentAgents: number;
}

export interface BillingWorkspaceSummary {
  workspaceId: string;
  name: string;
  mode: WorkspaceMode;
  planCode: PlanCode;
  subscriptionStatus: SubscriptionStatus | "none";
  capabilityMode: "standard" | "limited";
  availableMicro: number;
  reservedMicro: number;
  includedAuMonthlyMicro: number;
  maxRepositories: number;
  maxAgentsSimultaneous: number;
}

export interface BillingConsoleSummary {
  gateway: BillingGatewayState;
  currentSubscription: BillingSubscriptionRecord | null;
  currentOffer: BillingPlanOffer | null;
  currentAllocation: PlanAuAllocation | null;
  totalAvailableMicro: number;
  totalReservedMicro: number;
  totalLifetimeEarnedMicro: number;
  totalLifetimeSpentMicro: number;
  totalLifetimeRefundMicro: number;
  workspaces: BillingWorkspaceSummary[];
  recentEvents: BillingEventRecord[];
  recentTransactions: AuTransactionRecord[];
  recommendedOffers: BillingPlanOffer[];
  recommendedPack: AuPackCatalog | null;
  pendingCheckout: BillingCheckoutSessionRecord | null;
}

interface BuildBillingConsoleSummaryArgs {
  gateway: BillingGatewayState;
  workspaces: BillingWorkspaceRecord[];
  wallets: AqelorWallet[];
  subscriptions: BillingSubscriptionRecord[];
  offers: BillingPlanOffer[];
  planAllocations: PlanAuAllocation[];
  packs: AuPackCatalog[];
  events: BillingEventRecord[];
  transactions: AuTransactionRecord[];
  checkoutSessions: BillingCheckoutSessionRecord[];
}

export function microAuToAu(micro: number): number {
  return Math.round((micro / 1000) * 100) / 100;
}

export function getAvailableWalletMicro(wallet: AqelorWallet | null | undefined): number {
  if (!wallet) {
    return 0;
  }

  return Math.max(wallet.balanceMicro - wallet.reservedMicro, 0);
}

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function buildBillingConsoleSummary({
  gateway,
  workspaces,
  wallets,
  subscriptions,
  offers,
  planAllocations,
  packs,
  events,
  transactions,
  checkoutSessions,
}: BuildBillingConsoleSummaryArgs): BillingConsoleSummary {
  const walletByWorkspaceId = new Map(wallets.map((wallet) => [wallet.workspaceId, wallet]));
  const subscriptionById = new Map(
    subscriptions.map((subscription) => [subscription.id, subscription]),
  );
  const allocationByPlan = new Map(
    planAllocations.map((allocation) => [allocation.planCode, allocation]),
  );

  const currentSubscription = selectCurrentSubscription(subscriptions);
  const currentOffer =
    offers.find((offer) => offer.code === currentSubscription?.offerCode) ??
    offers.find(
      (offer) =>
        offer.planCode === currentSubscription?.planCode &&
        offer.billingCycle === currentSubscription?.billingCycle,
    ) ??
    null;
  const currentAllocation = currentSubscription
    ? allocationByPlan.get(currentSubscription.planCode) ?? null
    : null;

  const workspaceSummaries: BillingWorkspaceSummary[] = workspaces.map((workspace) => {
    const subscription = workspace.subscriptionId
      ? subscriptionById.get(workspace.subscriptionId) ?? null
      : null;
    const wallet = walletByWorkspaceId.get(workspace.id) ?? null;
    const allocation = subscription
      ? allocationByPlan.get(subscription.planCode) ?? null
      : null;

    return {
      workspaceId: workspace.id,
      name: workspace.name,
      mode: workspace.mode,
      planCode: subscription?.planCode ?? "free",
      subscriptionStatus: subscription?.status ?? "none",
      capabilityMode:
        subscription && isSubscriptionActive(subscription.status)
          ? "standard"
          : "limited",
      availableMicro: getAvailableWalletMicro(wallet),
      reservedMicro: wallet?.reservedMicro ?? 0,
      includedAuMonthlyMicro: allocation?.monthlyMicro ?? 0,
      maxRepositories: subscription?.maxRepositories ?? 1,
      maxAgentsSimultaneous:
        subscription?.agentsSimultaneous ?? workspace.maxConcurrentAgents,
    };
  });

  const activePacks = packs
    .filter((pack) => pack.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const totalAvailableMicro = wallets.reduce(
    (total, wallet) => total + getAvailableWalletMicro(wallet),
    0,
  );
  const totalReservedMicro = wallets.reduce(
    (total, wallet) => total + wallet.reservedMicro,
    0,
  );
  const totalLifetimeEarnedMicro = wallets.reduce(
    (total, wallet) => total + wallet.lifetimeEarned,
    0,
  );
  const totalLifetimeSpentMicro = wallets.reduce(
    (total, wallet) => total + wallet.lifetimeSpent,
    0,
  );
  const totalLifetimeRefundMicro = wallets.reduce(
    (total, wallet) => total + wallet.lifetimeRefund,
    0,
  );
  const recommendedPack = selectRecommendedPack(
    activePacks,
    totalAvailableMicro,
    currentAllocation?.monthlyMicro ?? 0,
  );

  const recentEvents = [...events]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);
  const recentTransactions = [...transactions]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);
  const pendingCheckout =
    [...checkoutSessions]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .find((session) => PENDING_CHECKOUT_STATUSES.has(session.status)) ?? null;

  const recommendedOffers = offers
    .filter((offer) => offer.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .filter((offer) => {
      if (!currentSubscription) {
        return offer.planCode !== "free";
      }

      return (
        offer.code !== currentSubscription.offerCode &&
        offer.planCode !== currentSubscription.planCode
      );
    })
    .slice(0, 4);

  return {
    gateway,
    currentSubscription,
    currentOffer,
    currentAllocation,
    totalAvailableMicro,
    totalReservedMicro,
    totalLifetimeEarnedMicro,
    totalLifetimeSpentMicro,
    totalLifetimeRefundMicro,
    workspaces: workspaceSummaries,
    recentEvents,
    recentTransactions,
    recommendedOffers,
    recommendedPack,
    pendingCheckout,
  };
}

function selectCurrentSubscription(
  subscriptions: BillingSubscriptionRecord[],
): BillingSubscriptionRecord | null {
  const sorted = [...subscriptions].sort((left, right) =>
    right.currentPeriodEnd.localeCompare(left.currentPeriodEnd),
  );

  return (
    sorted.find((subscription) => isSubscriptionActive(subscription.status)) ??
    sorted[0] ??
    null
  );
}

function selectRecommendedPack(
  packs: AuPackCatalog[],
  totalAvailableMicro: number,
  allocationMicro: number,
): AuPackCatalog | null {
  if (packs.length === 0) {
    return null;
  }

  const targetMicro = allocationMicro > 0 ? allocationMicro : 10000;
  const minimumUsefulBuffer = Math.max(Math.trunc(targetMicro / 2), 5000);

  if (totalAvailableMicro >= minimumUsefulBuffer) {
    return null;
  }

  const deficit = Math.max(targetMicro - totalAvailableMicro, 0);

  return (
    packs.find((pack) => pack.amountMicro + pack.bonusMicro >= deficit) ??
    packs[packs.length - 1] ??
    null
  );
}
