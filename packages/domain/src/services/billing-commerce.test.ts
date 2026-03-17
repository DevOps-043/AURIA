import assert from "node:assert/strict";
import type {
  AqelorWallet,
  AuPackCatalog,
  BillingCheckoutSessionRecord,
  BillingEventRecord,
  BillingGatewayState,
  BillingPlanOffer,
  BillingSubscriptionRecord,
  PlanAuAllocation,
} from "@auria/contracts";
import {
  buildBillingConsoleSummary,
  getAvailableWalletMicro,
  microAuToAu,
  type BillingWorkspaceRecord,
} from "./billing-commerce.ts";

const gateway: BillingGatewayState = {
  provider: "disabled",
  configured: false,
  mode: "stub",
  publicLabel: "Gateway disabled",
  message: "No payment gateway configured yet.",
};

const workspace: BillingWorkspaceRecord = {
  id: "ws-1",
  name: "Core Platform",
  mode: "cloud",
  subscriptionId: "sub-1",
  maxConcurrentAgents: 2,
};

const wallet: AqelorWallet = {
  id: "wallet-1",
  workspaceId: "ws-1",
  balanceMicro: 8000,
  reservedMicro: 2000,
  lifetimeEarned: 24000,
  lifetimeSpent: 12000,
  lifetimeRefund: 3000,
};

const subscription: BillingSubscriptionRecord = {
  id: "sub-1",
  userId: "user-1",
  provider: "disabled",
  providerCustomerId: null,
  providerSubscriptionId: null,
  offerCode: "starter_monthly",
  planCode: "starter",
  status: "active",
  billingCycle: "monthly",
  budgetLimitUsd: 100,
  maxRepositories: 3,
  maxAgents: 10,
  agentsAvailable: 10,
  agentsSimultaneous: 2,
  auIncludedMonthly: 15000,
  auRollover: false,
  currentPeriodStart: "2026-03-01T00:00:00.000Z",
  currentPeriodEnd: "2026-03-31T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  nextBillingAt: "2026-03-31T00:00:00.000Z",
  paymentMethodSummary: "Visa **** 4242",
  statusReason: "",
  createdAt: "2026-03-01T00:00:00.000Z",
};

const planAllocation: PlanAuAllocation = {
  planCode: "starter",
  monthlyMicro: 15000,
  rollover: false,
  maxRolloverMicro: 0,
};

const starterOffer: BillingPlanOffer = {
  id: "offer-1",
  code: "starter_monthly",
  planCode: "starter",
  billingCycle: "monthly",
  displayName: "Starter",
  description: "Starter plan",
  priceUsd: 19,
  currency: "usd",
  budgetLimitUsd: 100,
  provider: "disabled",
  providerLookupKey: "starter_monthly",
  isCustomPrice: false,
  trialDays: 7,
  isActive: true,
  sortOrder: 1,
  includedAuMonthly: 15000,
};

const proOffer: BillingPlanOffer = {
  ...starterOffer,
  id: "offer-2",
  code: "pro_monthly",
  planCode: "pro",
  displayName: "Pro",
  priceUsd: 79,
  budgetLimitUsd: 500,
  sortOrder: 2,
  includedAuMonthly: 60000,
};

const pack: AuPackCatalog = {
  id: "pack-1",
  code: "au_boost_30",
  name: "AU Boost 30",
  description: "Extra AU",
  amountMicro: 30000,
  priceUsd: 27,
  bonusMicro: 3000,
  currency: "usd",
  provider: "disabled",
  providerLookupKey: "au_boost_30",
  isActive: true,
  sortOrder: 1,
};

const checkout: BillingCheckoutSessionRecord = {
  id: "checkout-1",
  sessionKind: "subscription",
  status: "requires_gateway",
  provider: "disabled",
  userId: "user-1",
  workspaceId: "ws-1",
  subscriptionId: "sub-1",
  planOfferId: "offer-2",
  auPackId: null,
  providerCustomerId: null,
  providerSessionId: null,
  providerPaymentIntentId: null,
  checkoutUrl: null,
  currency: "usd",
  amountUsd: 79,
  createdAt: "2026-03-16T02:00:00.000Z",
  expiresAt: null,
  completedAt: null,
};

const event: BillingEventRecord = {
  id: "event-1",
  subscriptionId: "sub-1",
  workspaceId: "ws-1",
  checkoutSessionId: "checkout-1",
  packPurchaseId: null,
  provider: "disabled",
  eventType: "checkout_session_created",
  providerEventId: null,
  amountUsd: 79,
  currency: "usd",
  createdAt: "2026-03-16T02:00:00.000Z",
};

assert.equal(microAuToAu(15550), 15.55, "micro AU should round to 2 decimals");
assert.equal(
  getAvailableWalletMicro(wallet),
  6000,
  "available AU should discount reserved balance",
);

const summary = buildBillingConsoleSummary({
  gateway,
  workspaces: [workspace],
  wallets: [wallet],
  subscriptions: [subscription],
  offers: [starterOffer, proOffer],
  planAllocations: [planAllocation],
  packs: [pack],
  events: [event],
  transactions: [],
  checkoutSessions: [checkout],
});

assert.equal(
  summary.currentOffer?.code,
  "starter_monthly",
  "current offer should map from the active subscription offer code",
);

assert.equal(
  summary.totalAvailableMicro,
  6000,
  "summary should aggregate available AU from wallets",
);

assert.equal(
  summary.recommendedPack?.code,
  "au_boost_30",
  "pack recommendation should be returned when wallet buffer is low",
);

assert.equal(
  summary.pendingCheckout?.id,
  "checkout-1",
  "pending checkout should expose the latest non-finalized session",
);

assert.equal(
  summary.workspaces[0]?.capabilityMode,
  "standard",
  "active subscriptions should keep standard capability mode",
);

const limitedSummary = buildBillingConsoleSummary({
  gateway,
  workspaces: [workspace],
  wallets: [wallet],
  subscriptions: [{ ...subscription, status: "past_due" }],
  offers: [starterOffer, proOffer],
  planAllocations: [planAllocation],
  packs: [pack],
  events: [event],
  transactions: [],
  checkoutSessions: [checkout],
});

assert.equal(
  limitedSummary.workspaces[0]?.capabilityMode,
  "limited",
  "non-active subscriptions should degrade the workspace capability mode",
);

console.log("billing-commerce.test.ts: ok");
