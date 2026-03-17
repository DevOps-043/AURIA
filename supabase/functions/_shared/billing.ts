import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type BillingProvider = "disabled" | "stripe" | "mercado_pago" | "custom";
export type BillingGatewayMode = "stub" | "partial" | "ready";

export interface BillingGatewayState {
  provider: BillingProvider;
  configured: boolean;
  mode: BillingGatewayMode;
  publicLabel: string;
  message: string;
}

export interface GatewayCheckoutInput {
  checkoutSessionId: string;
  workspaceId: string;
  sessionKind: "subscription" | "au_pack";
  successUrl?: string | null;
  cancelUrl?: string | null;
}

export interface GatewayCheckoutResult {
  status: "open" | "requires_gateway" | "failed";
  url: string | null;
  providerSessionId: string | null;
  message: string;
}

export interface GatewayPortalInput {
  workspaceId: string;
}

export interface GatewayPortalResult {
  status: "open" | "requires_gateway" | "failed";
  url: string | null;
  message: string;
}

export interface BillingCustomerRecord {
  id: string;
  provider_customer_id: string | null;
}

export interface AuthenticatedRequest {
  supabase: ReturnType<typeof createClient>;
  user: { id: string; email?: string | null };
}

export interface NormalizedBillingWebhookEvent {
  eventType: string;
  checkoutSessionId: string | null;
  subscriptionId: string | null;
  providerSubscriptionId: string | null;
  providerSessionId: string | null;
  providerPaymentId: string | null;
  providerCustomerId: string | null;
  providerEventId: string | null;
  subscriptionStatus: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  raw: unknown;
}

interface BillingGatewayAdapter {
  createCheckoutSession(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult>;
  createPortalSession(input: GatewayPortalInput): Promise<GatewayPortalResult>;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-billing-webhook-secret",
};

export function jsonResponse(
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export function normalizeBillingProvider(value: string | null | undefined): BillingProvider {
  if (value === "stripe" || value === "mercado_pago" || value === "custom") {
    return value;
  }

  return "disabled";
}

export function getBillingGatewayState(): BillingGatewayState {
  const provider = normalizeBillingProvider(Deno.env.get("BILLING_PROVIDER"));

  if (provider === "disabled") {
    return {
      provider,
      configured: false,
      mode: "stub",
      publicLabel: "Simulation active",
      message:
        "Checkout simulation is active. Plans and AU packs are applied instantly until a real gateway is configured.",
    };
  }

  if (provider === "custom") {
    const configured =
      Boolean(Deno.env.get("BILLING_CUSTOM_CHECKOUT_URL")) ||
      Boolean(Deno.env.get("BILLING_CUSTOM_PORTAL_URL"));

    return {
      provider,
      configured,
      mode: configured ? "ready" : "partial",
      publicLabel: "Custom billing bridge",
      message: configured
        ? "Custom checkout and portal URLs are configured."
        : "Custom bridge selected, but checkout or portal URLs are missing. Simulation stays active until the bridge is ready.",
    };
  }

  const configured =
    provider === "stripe"
      ? Boolean(Deno.env.get("STRIPE_SECRET_KEY"))
      : Boolean(Deno.env.get("MERCADOPAGO_ACCESS_TOKEN"));

  return {
    provider,
    configured,
    mode: "partial",
    publicLabel: provider === "stripe" ? "Stripe" : "Mercado Pago",
    message: configured
      ? "Provider credentials are present, but checkout still runs in simulation until the provider adapter is implemented."
      : "Provider selected, but credentials are still missing. Checkout simulation remains active.",
  };
}

export function shouldSimulateBillingCheckout(state: BillingGatewayState): boolean {
  return state.mode !== "ready";
}

export async function authenticateRequest(
  request: Request,
): Promise<AuthenticatedRequest | { error: string; status: number }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid or expired token", status: 403 };
  }

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  };
}

export function createServiceClient(): ReturnType<typeof createClient> {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for billing functions.");
  }

  return createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export async function verifyWorkspaceAccess(
  authenticated: AuthenticatedRequest,
  workspaceId: string,
): Promise<{ id: string; subscription_id: string | null } | null> {
  const { data, error } = await authenticated.supabase
    .from("workspaces")
    .select("id, subscription_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function upsertBillingCustomer(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    userId: string;
    email?: string | null;
    workspaceId: string;
    provider: BillingProvider;
  },
): Promise<BillingCustomerRecord> {
  const existing = await serviceClient
    .from("billing_customers")
    .select("id, provider_customer_id")
    .eq("user_id", input.userId)
    .eq("provider", input.provider)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data) {
    await serviceClient
      .from("billing_customers")
      .update({
        default_workspace_id: input.workspaceId,
        email: input.email ?? null,
      })
      .eq("id", existing.data.id);

    return existing.data;
  }

  const inserted = await serviceClient
    .from("billing_customers")
    .insert({
      user_id: input.userId,
      default_workspace_id: input.workspaceId,
      provider: input.provider,
      email: input.email ?? null,
    })
    .select("id, provider_customer_id")
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  return inserted.data;
}

export function getBillingGatewayAdapter(
  state: BillingGatewayState,
): BillingGatewayAdapter {
  if (state.provider === "disabled") {
    return disabledAdapter;
  }

  if (state.provider === "custom") {
    return customAdapter;
  }

  return createStubProviderAdapter(state);
}

export function hasValidWebhookSecret(request: Request): boolean {
  const expectedSecret = Deno.env.get("BILLING_WEBHOOK_SECRET");

  if (!expectedSecret) {
    return true;
  }

  const receivedSecret = request.headers.get("x-billing-webhook-secret");
  return receivedSecret === expectedSecret;
}

export function normalizeWebhookPayload(
  payload: Record<string, unknown>,
): NormalizedBillingWebhookEvent {
  return {
    eventType: typeof payload.eventType === "string" ? payload.eventType : "unknown",
    checkoutSessionId:
      typeof payload.checkoutSessionId === "string" ? payload.checkoutSessionId : null,
    subscriptionId:
      typeof payload.subscriptionId === "string" ? payload.subscriptionId : null,
    providerSubscriptionId:
      typeof payload.providerSubscriptionId === "string"
        ? payload.providerSubscriptionId
        : null,
    providerSessionId:
      typeof payload.providerSessionId === "string" ? payload.providerSessionId : null,
    providerPaymentId:
      typeof payload.providerPaymentId === "string" ? payload.providerPaymentId : null,
    providerCustomerId:
      typeof payload.providerCustomerId === "string" ? payload.providerCustomerId : null,
    providerEventId:
      typeof payload.providerEventId === "string" ? payload.providerEventId : null,
    subscriptionStatus:
      typeof payload.subscriptionStatus === "string" ? payload.subscriptionStatus : null,
    periodStart: typeof payload.periodStart === "string" ? payload.periodStart : null,
    periodEnd: typeof payload.periodEnd === "string" ? payload.periodEnd : null,
    raw: payload,
  };
}

const disabledAdapter: BillingGatewayAdapter = {
  async createCheckoutSession(): Promise<GatewayCheckoutResult> {
    return {
      status: "requires_gateway",
      url: null,
      providerSessionId: null,
      message: "Billing gateway disabled. The checkout session was recorded in stub mode.",
    };
  },
  async createPortalSession(): Promise<GatewayPortalResult> {
    return {
      status: "requires_gateway",
      url: null,
      message: "Billing gateway disabled. Portal access is waiting for a provider.",
    };
  },
};

const customAdapter: BillingGatewayAdapter = {
  async createCheckoutSession(input): Promise<GatewayCheckoutResult> {
    const checkoutBaseUrl = Deno.env.get("BILLING_CUSTOM_CHECKOUT_URL");

    if (!checkoutBaseUrl) {
      return {
        status: "requires_gateway",
        url: null,
        providerSessionId: null,
        message: "Custom billing bridge selected, but BILLING_CUSTOM_CHECKOUT_URL is missing.",
      };
    }

    const url = buildUrl(checkoutBaseUrl, {
      session_id: input.checkoutSessionId,
      workspace_id: input.workspaceId,
      kind: input.sessionKind,
      success_url: input.successUrl ?? "",
      cancel_url: input.cancelUrl ?? "",
    });

    return {
      status: "open",
      url,
      providerSessionId: input.checkoutSessionId,
      message: "Custom checkout URL generated.",
    };
  },
  async createPortalSession(input): Promise<GatewayPortalResult> {
    const portalBaseUrl = Deno.env.get("BILLING_CUSTOM_PORTAL_URL");

    if (!portalBaseUrl) {
      return {
        status: "requires_gateway",
        url: null,
        message: "Custom billing bridge selected, but BILLING_CUSTOM_PORTAL_URL is missing.",
      };
    }

    return {
      status: "open",
      url: buildUrl(portalBaseUrl, {
        workspace_id: input.workspaceId,
      }),
      message: "Custom portal URL generated.",
    };
  },
};

function createStubProviderAdapter(
  state: BillingGatewayState,
): BillingGatewayAdapter {
  return {
    async createCheckoutSession(): Promise<GatewayCheckoutResult> {
      return {
        status: "requires_gateway",
        url: null,
        providerSessionId: null,
        message: state.configured
          ? `${state.publicLabel} is configured, but the provider-specific checkout adapter is still pending.`
          : `${state.publicLabel} is selected, but required credentials are still missing.`,
      };
    },
    async createPortalSession(): Promise<GatewayPortalResult> {
      return {
        status: "requires_gateway",
        url: null,
        message: state.configured
          ? `${state.publicLabel} is configured, but the provider-specific portal adapter is still pending.`
          : `${state.publicLabel} is selected, but required credentials are still missing.`,
      };
    },
  };
}

function buildUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
