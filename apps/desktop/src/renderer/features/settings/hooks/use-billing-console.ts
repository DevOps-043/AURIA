import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type {
  AqelorWallet,
  AuPackCatalog,
  AuPackPurchaseRecord,
  AuTransactionRecord,
  BillingCheckoutSessionRecord,
  BillingEventRecord,
  BillingGatewayState,
  BillingPlanOffer,
  BillingSubscriptionRecord,
  PlanAuAllocation,
  PlanCode,
  WorkspaceMode,
} from "@auria/contracts";
import {
  buildBillingConsoleSummary,
  type BillingConsoleSummary,
  type BillingWorkspaceRecord,
} from "@auria/domain";
import { supabase } from "@/shared/api/supabase-client";

export interface BillingWorkspaceViewModel extends BillingWorkspaceRecord {
  wallet: AqelorWallet | null;
  subscription: BillingSubscriptionRecord | null;
}

export interface BillingActionResult {
  status: string;
  url: string | null;
  message: string;
}

interface BillingConsoleState {
  gateway: BillingGatewayState;
  summary: BillingConsoleSummary;
  workspaces: BillingWorkspaceViewModel[];
  currentWorkspaceId: string | null;
  currentWorkspace: BillingWorkspaceViewModel | null;
  currentWallet: AqelorWallet | null;
  offers: BillingPlanOffer[];
  packs: AuPackCatalog[];
  checkoutSessions: BillingCheckoutSessionRecord[];
  purchases: AuPackPurchaseRecord[];
  events: BillingEventRecord[];
  transactions: AuTransactionRecord[];
  loading: boolean;
  error: string | null;
  warnings: string[];
  pendingAction: "plan" | "pack" | "portal" | null;
  setCurrentWorkspaceId: (workspaceId: string) => void;
  beginPlanCheckout: (offerCode: string) => Promise<BillingActionResult | null>;
  beginPackCheckout: (packCode: string) => Promise<BillingActionResult | null>;
  openBillingPortal: () => Promise<BillingActionResult | null>;
}

const DEFAULT_PLAN_ALLOCATIONS: PlanAuAllocation[] = [
  { planCode: "free", monthlyMicro: 0, rollover: false, maxRolloverMicro: 0 },
  { planCode: "starter", monthlyMicro: 15000, rollover: false, maxRolloverMicro: 0 },
  { planCode: "pro", monthlyMicro: 60000, rollover: true, maxRolloverMicro: 30000 },
  {
    planCode: "enterprise",
    monthlyMicro: 250000,
    rollover: true,
    maxRolloverMicro: 250000,
  },
];

const DEFAULT_PLAN_OFFERS: BillingPlanOffer[] = [
  createDefaultOffer({
    id: "offer-free-monthly",
    code: "free_monthly",
    planCode: "free",
    billingCycle: "monthly",
    displayName: "Gratis",
    description: "Plan de entrada controlado para espacios de evaluacion y actividad de bajo riesgo.",
    priceUsd: 0,
    budgetLimitUsd: 0,
    providerLookupKey: "auria_free_monthly",
    isCustomPrice: false,
    trialDays: 0,
    sortOrder: 0,
  }),
  createDefaultOffer({
    id: "offer-starter-monthly",
    code: "starter_monthly",
    planCode: "starter",
    billingCycle: "monthly",
    displayName: "Inicial",
    description: "Plan inicial operativo con concurrencia moderada y AU mensuales utiles.",
    priceUsd: 19,
    budgetLimitUsd: 100,
    providerLookupKey: "auria_starter_monthly",
    isCustomPrice: false,
    trialDays: 7,
    sortOrder: 1,
  }),
  createDefaultOffer({
    id: "offer-starter-yearly",
    code: "starter_yearly",
    planCode: "starter",
    billingCycle: "yearly",
    displayName: "Inicial Anual",
    description: "Plan Inicial facturado anualmente con la misma bolsa mensual de AU.",
    priceUsd: 190,
    budgetLimitUsd: 1200,
    providerLookupKey: "auria_starter_yearly",
    isCustomPrice: false,
    trialDays: 7,
    sortOrder: 2,
  }),
  createDefaultOffer({
    id: "offer-pro-monthly",
    code: "pro_monthly",
    planCode: "pro",
    billingCycle: "monthly",
    displayName: "Pro",
    description: "Mayor concurrencia, herramientas premium y una reserva mas amplia de AU para ejecucion sostenida.",
    priceUsd: 79,
    budgetLimitUsd: 500,
    providerLookupKey: "auria_pro_monthly",
    isCustomPrice: false,
    trialDays: 7,
    sortOrder: 3,
  }),
  createDefaultOffer({
    id: "offer-pro-yearly",
    code: "pro_yearly",
    planCode: "pro",
    billingCycle: "yearly",
    displayName: "Pro Anual",
    description: "Plan Pro anual con la misma bolsa operativa mensual.",
    priceUsd: 790,
    budgetLimitUsd: 6000,
    providerLookupKey: "auria_pro_yearly",
    isCustomPrice: false,
    trialDays: 7,
    sortOrder: 4,
  }),
  createDefaultOffer({
    id: "offer-enterprise-monthly",
    code: "enterprise_monthly",
    planCode: "enterprise",
    billingCycle: "monthly",
    displayName: "Empresarial",
    description: "Plan empresarial personalizado con concurrencia ampliada, gobernanza y soporte.",
    priceUsd: null,
    budgetLimitUsd: 0,
    providerLookupKey: "auria_enterprise_monthly",
    isCustomPrice: true,
    trialDays: 0,
    sortOrder: 5,
  }),
  createDefaultOffer({
    id: "offer-enterprise-yearly",
    code: "enterprise_yearly",
    planCode: "enterprise",
    billingCycle: "yearly",
    displayName: "Empresarial Anual",
    description: "Acuerdo empresarial personalizado con facturacion anual.",
    priceUsd: null,
    budgetLimitUsd: 0,
    providerLookupKey: "auria_enterprise_yearly",
    isCustomPrice: true,
    trialDays: 0,
    sortOrder: 6,
  }),
];

const DEFAULT_AU_PACKS: AuPackCatalog[] = [
  createDefaultPack({
    id: "pack-au-boost-10",
    code: "au_boost_10",
    name: "Impulso AU 10",
    description: "Paquete de recarga para una rafaga corta de ejecucion autonoma.",
    amountMicro: 10000,
    priceUsd: 10,
    bonusMicro: 0,
    providerLookupKey: "auria_au_boost_10",
    sortOrder: 1,
  }),
  createDefaultPack({
    id: "pack-au-boost-30",
    code: "au_boost_30",
    name: "Impulso AU 30",
    description: "Recarga equilibrada de AU con un pequeno bono para trabajo sostenido.",
    amountMicro: 30000,
    priceUsd: 27,
    bonusMicro: 3000,
    providerLookupKey: "auria_au_boost_30",
    sortOrder: 2,
  }),
  createDefaultPack({
    id: "pack-au-boost-80",
    code: "au_boost_80",
    name: "Impulso AU 80",
    description: "Recarga amplia de AU pensada para ventanas de ejecucion intensiva.",
    amountMicro: 80000,
    priceUsd: 64,
    bonusMicro: 12000,
    providerLookupKey: "auria_au_boost_80",
    sortOrder: 3,
  }),
];

const EMPTY_SUMMARY = buildBillingConsoleSummary({
  gateway: buildClientGatewayState(),
  workspaces: [],
  wallets: [],
  subscriptions: [],
  offers: DEFAULT_PLAN_OFFERS,
  planAllocations: DEFAULT_PLAN_ALLOCATIONS,
  packs: DEFAULT_AU_PACKS,
  events: [],
  transactions: [],
  checkoutSessions: [],
});

export function useBillingConsole(user: User | null): BillingConsoleState {
  const [gateway, setGateway] = useState<BillingGatewayState>(buildClientGatewayState());
  const [summary, setSummary] = useState<BillingConsoleSummary>({
    ...EMPTY_SUMMARY,
    gateway: buildClientGatewayState(),
  });
  const [workspaces, setWorkspaces] = useState<BillingWorkspaceViewModel[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [offers, setOffers] = useState<BillingPlanOffer[]>(DEFAULT_PLAN_OFFERS);
  const [packs, setPacks] = useState<AuPackCatalog[]>(DEFAULT_AU_PACKS);
  const [checkoutSessions, setCheckoutSessions] = useState<BillingCheckoutSessionRecord[]>([]);
  const [purchases, setPurchases] = useState<AuPackPurchaseRecord[]>([]);
  const [events, setEvents] = useState<BillingEventRecord[]>([]);
  const [transactions, setTransactions] = useState<AuTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<"plan" | "pack" | "portal" | null>(null);
  const loadBillingState = useCallback(async (): Promise<void> => {
    if (!supabase || !user) {
      setLoading(false);
      setError(user ? "Supabase no esta configurado." : "Inicia sesion para acceder a facturacion.");
      return;
    }

    const nextWarnings: string[] = [];

    try {
      setLoading(true);
      setError(null);

      const workspaceResult = await supabase
        .from("workspaces")
        .select("id, name, mode, subscription_id, max_concurrent_agents")
        .order("created_at", { ascending: true });

      if (workspaceResult.error) {
        throw workspaceResult.error;
      }

      const workspaceRecords: BillingWorkspaceRecord[] = (workspaceResult.data ?? []).map(
        mapWorkspace,
      );
      const workspaceIds = workspaceRecords.map(
        (workspace: BillingWorkspaceRecord) => workspace.id,
      );
      const workspaceSubscriptionIds = workspaceRecords
        .map((workspace: BillingWorkspaceRecord) => workspace.subscriptionId)
        .filter((subscriptionId): subscriptionId is string => Boolean(subscriptionId));

      const subscriptionResult =
        workspaceSubscriptionIds.length > 0
          ? await supabase
              .from("subscriptions")
              .select("*")
              .in("id", workspaceSubscriptionIds)
              .order("current_period_end", { ascending: false })
          : await supabase
              .from("subscriptions")
              .select("*")
              .eq("user_id", user.id)
              .order("current_period_end", { ascending: false });
      collectWarning(nextWarnings, "Suscripciones", subscriptionResult.error);

      const planOffersResult = await supabase
        .from("billing_plan_offers")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      collectWarning(nextWarnings, "Planes", planOffersResult.error);

      const planAllocationsResult = await supabase.from("plan_au_allocations").select("*");
      collectWarning(nextWarnings, "Asignaciones AU del plan", planAllocationsResult.error);

      const packCatalogResult = await supabase
        .from("au_packs")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      collectWarning(nextWarnings, "Paquetes AU", packCatalogResult.error);

      const subscriptions: BillingSubscriptionRecord[] = (
        subscriptionResult.data ?? []
      ).map(mapSubscription);
      const planAllocations =
        (planAllocationsResult.data ?? []).length > 0
          ? (planAllocationsResult.data ?? []).map(mapPlanAllocation)
          : DEFAULT_PLAN_ALLOCATIONS;
      const offersData =
        (planOffersResult.data ?? []).length > 0
          ? (planOffersResult.data ?? []).map((row: any) =>
              mapPlanOffer(row, planAllocations),
            )
          : DEFAULT_PLAN_OFFERS;
      const packData =
        (packCatalogResult.data ?? []).length > 0
          ? (packCatalogResult.data ?? []).map(mapPack)
          : DEFAULT_AU_PACKS;

      const walletResult =
        workspaceIds.length > 0
          ? await supabase.from("au_wallets").select("*").in("workspace_id", workspaceIds)
          : { data: [], error: null };
      collectWarning(nextWarnings, "Billeteras AU", walletResult.error);

      const wallets = (walletResult.data ?? []).map(mapWallet);
      const walletIds = wallets.map((wallet: AqelorWallet) => wallet.id);

      const transactionResult =
        walletIds.length > 0
          ? await supabase
              .from("au_transactions")
              .select("*")
              .in("wallet_id", walletIds)
              .order("created_at", { ascending: false })
              .limit(20)
          : { data: [], error: null };
      collectWarning(nextWarnings, "Transacciones AU", transactionResult.error);

      const checkoutResult = await supabase
        .from("billing_checkout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      collectWarning(nextWarnings, "Sesiones de checkout", checkoutResult.error);

      const purchaseResult = await supabase
        .from("au_pack_purchases")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      collectWarning(nextWarnings, "Compras de paquetes", purchaseResult.error);

      const eventsResult =
        workspaceIds.length > 0
          ? await supabase
              .from("billing_events")
              .select("*")
              .in("workspace_id", workspaceIds)
              .order("created_at", { ascending: false })
              .limit(20)
          : { data: [], error: null };
      collectWarning(nextWarnings, "Eventos de facturacion", eventsResult.error);

      const mappedTransactions = (transactionResult.data ?? []).map(mapTransaction);
      const mappedCheckoutSessions = (checkoutResult.data ?? []).map(mapCheckoutSession);
      const mappedPurchases = (purchaseResult.data ?? []).map(mapPackPurchase);
      const mappedEvents = (eventsResult.data ?? []).map(mapBillingEvent);
      const walletByWorkspaceId = new Map<string, AqelorWallet>(
        wallets.map((wallet: AqelorWallet) => [wallet.workspaceId, wallet] as const),
      );
      const subscriptionById = new Map<string, BillingSubscriptionRecord>(
        subscriptions.map(
          (subscription: BillingSubscriptionRecord) =>
            [subscription.id, subscription] as const,
        ),
      );
      const workspaceViewModels: BillingWorkspaceViewModel[] = workspaceRecords.map(
        (workspace: BillingWorkspaceRecord) => ({
          ...workspace,
          wallet: walletByWorkspaceId.get(workspace.id) ?? null,
          subscription: workspace.subscriptionId
            ? subscriptionById.get(workspace.subscriptionId) ?? null
            : null,
        }),
      );

      const nextGateway = buildClientGatewayState(subscriptions[0]?.provider ?? undefined);
      const nextSummary = buildBillingConsoleSummary({
        gateway: nextGateway,
        workspaces: workspaceRecords,
        wallets,
        subscriptions,
        offers: offersData,
        planAllocations,
        packs: packData,
        events: mappedEvents,
        transactions: mappedTransactions,
        checkoutSessions: mappedCheckoutSessions,
      });

      setGateway(nextGateway);
      setSummary(nextSummary);
      setWorkspaces(workspaceViewModels);
      setOffers(offersData);
      setPacks(packData);
      setTransactions(mappedTransactions);
      setCheckoutSessions(mappedCheckoutSessions);
      setPurchases(mappedPurchases);
      setEvents(mappedEvents);
      setWarnings(nextWarnings);
      setCurrentWorkspaceId((current: string | null) =>
        current &&
        workspaceViewModels.some(
          (workspace: BillingWorkspaceViewModel) => workspace.id === current,
        )
          ? current
          : workspaceViewModels[0]?.id ?? null,
      );
      setLoading(false);
    } catch (loadError) {
      setLoading(false);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la consola de facturacion.",
      );
    }
  }, [user]);

  useEffect(() => {
    void loadBillingState();
  }, [loadBillingState]);

  const currentWorkspace =
    workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? null;
  const currentWallet = currentWorkspace?.wallet ?? null;
  const simulationMode = gateway.mode !== "ready";

  const beginPlanCheckout = async (
    offerCode: string,
  ): Promise<BillingActionResult | null> => {
    if (!supabase || !currentWorkspaceId) {
      return null;
    }

    setPendingAction("plan");

    try {
      if (simulationMode) {
        const { data, error } = await supabase.rpc("simulate_billing_checkout", {
          p_workspace_id: currentWorkspaceId,
          p_checkout_kind: "subscription",
          p_offer_code: offerCode,
          p_pack_code: null,
        });

        if (error) {
          throw normalizeBillingActionError(error);
        }

        await loadBillingState();

        return {
          status: getSimulationStatus(data),
          url: null,
          message:
            getSimulationMessage(data) ??
            "La simulacion de checkout termino y se aplicaron los beneficios del plan.",
        };
      }

      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: {
          workspaceId: currentWorkspaceId,
          checkoutKind: "subscription",
          offerCode,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.gateway) {
        setGateway(normalizeGatewayResponse(data.gateway));
      }

      await loadBillingState();

      return {
        status: data?.checkout?.status ?? "unknown",
        url: data?.checkout?.url ?? null,
        message: data?.checkout?.message ?? "Se creo la sesion de checkout.",
      };
    } finally {
      setPendingAction(null);
    }
  };

  const beginPackCheckout = async (
    packCode: string,
  ): Promise<BillingActionResult | null> => {
    if (!supabase || !currentWorkspaceId) {
      return null;
    }

    setPendingAction("pack");

    try {
      if (simulationMode) {
        const { data, error } = await supabase.rpc("simulate_billing_checkout", {
          p_workspace_id: currentWorkspaceId,
          p_checkout_kind: "au_pack",
          p_offer_code: null,
          p_pack_code: packCode,
        });

        if (error) {
          throw normalizeBillingActionError(error);
        }

        await loadBillingState();

        return {
          status: getSimulationStatus(data),
          url: null,
          message:
            getSimulationMessage(data) ??
            "La simulacion de checkout termino y el paquete AU fue acreditado.",
        };
      }

      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: {
          workspaceId: currentWorkspaceId,
          checkoutKind: "au_pack",
          packCode,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.gateway) {
        setGateway(normalizeGatewayResponse(data.gateway));
      }

      await loadBillingState();

      return {
        status: data?.checkout?.status ?? "unknown",
        url: data?.checkout?.url ?? null,
        message: data?.checkout?.message ?? "Se creo la sesion de checkout del paquete.",
      };
    } finally {
      setPendingAction(null);
    }
  };

  const openBillingPortal = async (): Promise<BillingActionResult | null> => {
    if (!supabase || !currentWorkspaceId) {
      return null;
    }

    setPendingAction("portal");

    try {
      if (simulationMode) {
        const { data, error } = await supabase.rpc("simulate_billing_portal_session", {
          p_workspace_id: currentWorkspaceId,
        });

        if (error) {
          throw normalizeBillingActionError(error);
        }

        await loadBillingState();

        return {
          status: getSimulationStatus(data),
          url: null,
          message:
            getSimulationMessage(data) ??
            "El modo simulacion esta activo. Administra planes y AU desde esta pantalla.",
        };
      }

      const { data, error } = await supabase.functions.invoke("billing-portal", {
        body: {
          workspaceId: currentWorkspaceId,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.gateway) {
        setGateway(normalizeGatewayResponse(data.gateway));
      }

      await loadBillingState();

      return {
        status: data?.portal?.status ?? "unknown",
        url: data?.portal?.url ?? null,
        message: data?.portal?.message ?? "El portal de facturacion esta listo.",
      };
    } finally {
      setPendingAction(null);
    }
  };

  return {
    gateway,
    summary,
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    currentWallet,
    offers,
    packs,
    checkoutSessions,
    purchases,
    events,
    transactions,
    loading,
    error,
    warnings,
    pendingAction,
    setCurrentWorkspaceId,
    beginPlanCheckout,
    beginPackCheckout,
    openBillingPortal,
  };
}

function buildClientGatewayState(explicitProvider?: string): BillingGatewayState {
  const provider = normalizeProvider(explicitProvider ?? import.meta.env.VITE_BILLING_PROVIDER);

  if (provider === "disabled") {
    return {
      provider,
      configured: false,
      mode: "stub",
      publicLabel: "Simulacion activa",
      message:
        "Iniciar checkout ejecuta una simulacion de cobro y aplica planes o AU al instante hasta que exista una pasarela real.",
    };
  }

  if (provider === "custom") {
    return {
      provider,
      configured: true,
      mode: "ready",
      publicLabel: "Puente de facturacion personalizado",
      message: "Desktop espera un puente de checkout personalizado desde las edge functions de facturacion.",
    };
  }

  return {
    provider,
    configured: false,
    mode: "partial",
    publicLabel: provider === "stripe" ? "Stripe" : "Mercado Pago",
    message:
      "Desktop reconoce el proveedor seleccionado, pero el checkout seguira simulado hasta que el adaptador quede listo por completo.",
  };
}

function createDefaultOffer(
  offer: Omit<BillingPlanOffer, "provider" | "currency" | "isActive" | "includedAuMonthly">,
): BillingPlanOffer {
  return {
    ...offer,
    currency: "usd",
    provider: "disabled",
    isActive: true,
    includedAuMonthly:
      DEFAULT_PLAN_ALLOCATIONS.find((allocation) => allocation.planCode === offer.planCode)
        ?.monthlyMicro ?? 0,
  };
}

function createDefaultPack(
  pack: Omit<AuPackCatalog, "currency" | "provider" | "isActive">,
): AuPackCatalog {
  return {
    ...pack,
    currency: "usd",
    provider: "disabled",
    isActive: true,
  };
}

function collectWarning(
  warnings: string[],
  label: string,
  error: { message?: string } | null,
): void {
  if (error?.message) {
    warnings.push(`${label} no disponible: ${error.message}`);
  }
}

function normalizeProvider(value: unknown): BillingGatewayState["provider"] {
  return value === "stripe" || value === "mercado_pago" || value === "custom"
    ? value
    : "disabled";
}

function normalizePlanCode(value: unknown): PlanCode {
  return value === "starter" || value === "pro" || value === "enterprise"
    ? value
    : "free";
}

function normalizeWorkspaceMode(value: unknown): WorkspaceMode {
  return value === "cloud" || value === "hybrid" ? value : "local";
}

function normalizeGatewayResponse(value: unknown): BillingGatewayState {
  if (
    value &&
    typeof value === "object" &&
    "provider" in value &&
    "mode" in value &&
    "message" in value
  ) {
    const record = value as Record<string, unknown>;
    return {
      provider: normalizeProvider(record.provider),
      configured: Boolean(record.configured),
      mode:
        record.mode === "ready" || record.mode === "partial" ? record.mode : "stub",
      publicLabel:
        typeof record.publicLabel === "string"
          ? record.publicLabel
          : "Pasarela de pago",
      message:
        typeof record.message === "string"
          ? record.message
          : "El estado de la pasarela de pago se actualizo.",
    };
  }

  return buildClientGatewayState();
}

function getSimulationStatus(value: unknown): string {
  if (value && typeof value === "object" && "status" in value) {
    const record = value as Record<string, unknown>;
    return typeof record.status === "string" ? record.status : "completed";
  }

  return "completed";
}

function getSimulationMessage(value: unknown): string | null {
  if (value && typeof value === "object" && "message" in value) {
    const record = value as Record<string, unknown>;
    return typeof record.message === "string" ? record.message : null;
  }

  return null;
}

function normalizeBillingActionError(error: unknown): Error {
  if (error instanceof Error) {
    if (
      error.message.includes("simulate_billing_checkout") ||
      error.message.includes("simulate_billing_portal_session") ||
      error.message.includes("Could not find the function")
    ) {
      return new Error(
        "La RPC de simulacion de facturacion aun no esta disponible. Aplica la migracion 0009_billing_simulation_checkout_rpc.sql en Supabase.",
      );
    }

    return error;
  }

  return new Error("No se pudo completar la accion de facturacion.");
}

function mapWorkspace(row: any): BillingWorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    mode: normalizeWorkspaceMode(row.mode),
    subscriptionId: row.subscription_id ?? null,
    maxConcurrentAgents: toNumber(row.max_concurrent_agents, 1),
  };
}

function mapWallet(row: any): AqelorWallet {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    balanceMicro: toNumber(row.balance_micro),
    reservedMicro: toNumber(row.reserved_micro),
    lifetimeEarned: toNumber(row.lifetime_earned),
    lifetimeSpent: toNumber(row.lifetime_spent),
    lifetimeRefund: toNumber(row.lifetime_refund),
  };
}

function mapPlanAllocation(row: any): PlanAuAllocation {
  return {
    planCode: normalizePlanCode(row.plan_code),
    monthlyMicro: toNumber(row.monthly_micro),
    rollover: Boolean(row.rollover),
    maxRolloverMicro: toNumber(row.max_rollover_micro),
  };
}

function mapPlanOffer(row: any, allocations: PlanAuAllocation[]): BillingPlanOffer {
  return {
    id: row.id,
    code: row.code,
    planCode: normalizePlanCode(row.plan_code),
    billingCycle: row.billing_cycle === "yearly" ? "yearly" : "monthly",
    displayName: row.display_name,
    description: row.description ?? "",
    priceUsd: toNullableNumber(row.price_usd),
    currency: row.currency ?? "usd",
    budgetLimitUsd: toDecimal(row.budget_limit_usd),
    provider: normalizeProvider(row.provider),
    providerLookupKey: row.provider_lookup_key ?? null,
    isCustomPrice: Boolean(row.is_custom_price),
    trialDays: toNumber(row.trial_days),
    isActive: row.is_active !== false,
    sortOrder: toNumber(row.sort_order),
    includedAuMonthly:
      allocations.find(
        (allocation) => allocation.planCode === normalizePlanCode(row.plan_code),
      )?.monthlyMicro ?? 0,
  };
}

function mapSubscription(row: any): BillingSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    provider: normalizeProvider(row.provider),
    providerCustomerId: row.provider_customer_id ?? null,
    providerSubscriptionId: row.provider_subscription_id ?? null,
    offerCode: row.offer_code ?? null,
    planCode: normalizePlanCode(row.plan_code),
    status:
      row.status === "trialing" ||
      row.status === "active" ||
      row.status === "past_due" ||
      row.status === "canceled" ||
      row.status === "paused" ||
      row.status === "unpaid"
        ? row.status
        : "trialing",
    billingCycle: row.billing_cycle === "yearly" ? "yearly" : "monthly",
    budgetLimitUsd: toDecimal(row.budget_limit_usd),
    maxRepositories: toNumber(row.max_repositories, 1),
    maxAgents: toNumber(row.max_agents, 1),
    agentsAvailable: toNumber(row.agents_available, 1),
    agentsSimultaneous: toNumber(row.agents_simultaneous, 1),
    auIncludedMonthly: toNumber(row.au_included_monthly),
    auRollover: Boolean(row.au_rollover),
    currentPeriodStart: row.current_period_start ?? new Date().toISOString(),
    currentPeriodEnd: row.current_period_end ?? new Date().toISOString(),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    nextBillingAt: row.next_billing_at ?? null,
    paymentMethodSummary: row.payment_method_summary ?? null,
    statusReason: row.status_reason ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function mapPack(row: any): AuPackCatalog {
  return {
    id: row.id,
    code: row.code ?? row.id,
    name: row.name,
    description: row.description ?? "",
    amountMicro: toNumber(row.amount_micro, 1),
    priceUsd: toDecimal(row.price_usd),
    bonusMicro: toNumber(row.bonus_micro),
    currency: row.currency ?? "usd",
    provider: normalizeProvider(row.provider),
    providerLookupKey: row.provider_lookup_key ?? null,
    isActive: row.is_active !== false,
    sortOrder: toNumber(row.sort_order),
  };
}

function mapTransaction(row: any): AuTransactionRecord {
  return {
    id: row.id,
    walletId: row.wallet_id,
    transactionType: row.transaction_type,
    amountMicro: toNumber(row.amount_micro),
    balanceAfter: toNumber(row.balance_after),
    referenceType: row.reference_type ?? null,
    referenceId: row.reference_id ?? null,
    description: row.description ?? "",
    createdAt: row.created_at,
  };
}

function mapCheckoutSession(row: any): BillingCheckoutSessionRecord {
  return {
    id: row.id,
    sessionKind: row.session_kind === "au_pack" ? "au_pack" : "subscription",
    status:
      row.status === "open" ||
      row.status === "completed" ||
      row.status === "expired" ||
      row.status === "cancelled" ||
      row.status === "failed" ||
      row.status === "requires_gateway"
        ? row.status
        : "pending",
    provider: normalizeProvider(row.provider),
    userId: row.user_id,
    workspaceId: row.workspace_id,
    subscriptionId: row.subscription_id ?? null,
    planOfferId: row.plan_offer_id ?? null,
    auPackId: row.au_pack_id ?? null,
    providerCustomerId: row.provider_customer_id ?? null,
    providerSessionId: row.provider_session_id ?? null,
    providerPaymentIntentId: row.provider_payment_intent_id ?? null,
    checkoutUrl: row.checkout_url ?? null,
    currency: row.currency ?? "usd",
    amountUsd: toNullableNumber(row.amount_usd),
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? null,
    completedAt: row.completed_at ?? null,
  };
}

function mapPackPurchase(row: any): AuPackPurchaseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    auPackId: row.au_pack_id,
    checkoutSessionId: row.checkout_session_id ?? null,
    status:
      row.status === "awaiting_payment" ||
      row.status === "paid" ||
      row.status === "credited" ||
      row.status === "failed" ||
      row.status === "cancelled" ||
      row.status === "refunded"
        ? row.status
        : "initiated",
    grossAmountUsd: toDecimal(row.gross_amount_usd),
    currency: row.currency ?? "usd",
    provider: normalizeProvider(row.provider),
    providerPaymentId: row.provider_payment_id ?? null,
    creditedMicro: toNumber(row.credited_micro),
    bonusCreditedMicro: toNumber(row.bonus_credited_micro),
    creditedAt: row.credited_at ?? null,
    createdAt: row.created_at,
  };
}

function mapBillingEvent(row: any): BillingEventRecord {
  return {
    id: row.id,
    subscriptionId: row.subscription_id ?? null,
    workspaceId: row.workspace_id ?? null,
    checkoutSessionId: row.checkout_session_id ?? null,
    packPurchaseId: row.pack_purchase_id ?? null,
    provider: normalizeProvider(row.provider),
    eventType: row.event_type,
    providerEventId: row.provider_event_id ?? null,
    amountUsd: toNullableNumber(row.amount_usd),
    currency: row.currency ?? "usd",
    createdAt: row.created_at,
  };
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }

  return fallback;
}

function toDecimal(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toDecimal(value);
}
