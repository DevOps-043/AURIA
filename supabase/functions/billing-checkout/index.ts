import {
  authenticateRequest,
  corsHeaders,
  createServiceClient,
  getBillingGatewayAdapter,
  getBillingGatewayState,
  jsonResponse,
  readJsonBody,
  shouldSimulateBillingCheckout,
  upsertBillingCustomer,
  verifyWorkspaceAccess,
} from "../_shared/billing.ts";

type CheckoutRequest = {
  workspaceId?: string;
  checkoutKind?: "subscription" | "au_pack";
  offerCode?: string;
  packCode?: string;
  successUrl?: string;
  cancelUrl?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticateRequest(request);
  if ("error" in auth) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  let payload: CheckoutRequest;
  try {
    payload = await readJsonBody<CheckoutRequest>(request);
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.workspaceId || !payload.checkoutKind) {
    return jsonResponse(
      { error: "workspaceId and checkoutKind are required." },
      400,
    );
  }

  const workspace = await verifyWorkspaceAccess(auth, payload.workspaceId);
  if (!workspace) {
    return jsonResponse(
      { error: "Workspace not found or access denied." },
      403,
    );
  }

  const gateway = getBillingGatewayState();
  const gatewayAdapter = getBillingGatewayAdapter(gateway);
  const service = createServiceClient();

  try {
    const customer = await upsertBillingCustomer(service, {
      userId: auth.user.id,
      email: auth.user.email,
      workspaceId: payload.workspaceId,
      provider: gateway.provider,
    });

    if (payload.checkoutKind === "subscription") {
      if (!payload.offerCode) {
        return jsonResponse({ error: "offerCode is required." }, 400);
      }

      const offerResult = await service
        .from("billing_plan_offers")
        .select("id, code, display_name, price_usd, currency, billing_cycle, trial_days")
        .eq("code", payload.offerCode)
        .eq("is_active", true)
        .maybeSingle();

      if (offerResult.error) {
        throw new Error(offerResult.error.message);
      }

      if (!offerResult.data) {
        return jsonResponse({ error: "Billing plan offer not found." }, 404);
      }

      const checkoutInsert = await service
        .from("billing_checkout_sessions")
        .insert({
          session_kind: "subscription",
          status: "pending",
          provider: gateway.provider,
          user_id: auth.user.id,
          workspace_id: payload.workspaceId,
          subscription_id: workspace.subscription_id,
          plan_offer_id: offerResult.data.id,
          provider_customer_id: customer.provider_customer_id,
          currency: offerResult.data.currency,
          amount_usd: offerResult.data.price_usd,
        })
        .select("id")
        .single();

      if (checkoutInsert.error) {
        throw new Error(checkoutInsert.error.message);
      }

      await service.from("billing_events").insert({
        subscription_id: workspace.subscription_id,
        workspace_id: payload.workspaceId,
        checkout_session_id: checkoutInsert.data.id,
        provider: gateway.provider,
        event_type: "checkout_session_created",
        amount_usd: offerResult.data.price_usd,
        currency: offerResult.data.currency,
        payload: {
          checkoutKind: "subscription",
          offerCode: offerResult.data.code,
          offerName: offerResult.data.display_name,
        },
      });

      if (shouldSimulateBillingCheckout(gateway)) {
        const period = createSimulationPeriod(offerResult.data.billing_cycle);
        const simulatedProviderSessionId = `sim_checkout_${checkoutInsert.data.id}`;
        const simulatedProviderPaymentId = `sim_payment_${checkoutInsert.data.id}`;
        const simulatedProviderSubscriptionId = `sim_subscription_${checkoutInsert.data.id}`;
        const simulatedProviderCustomerId =
          customer.provider_customer_id ?? `sim_customer_${auth.user.id}`;

        const completion = await service.rpc("apply_checkout_completion", {
          p_checkout_session_id: checkoutInsert.data.id,
          p_provider_session_id: simulatedProviderSessionId,
          p_provider_payment_id: simulatedProviderPaymentId,
          p_provider_subscription_id: simulatedProviderSubscriptionId,
          p_provider_customer_id: simulatedProviderCustomerId,
          p_subscription_status:
            offerResult.data.trial_days > 0 ? "trialing" : "active",
          p_period_start: period.start.toISOString(),
          p_period_end: period.end.toISOString(),
        });

        if (completion.error) {
          throw new Error(completion.error.message);
        }

        return jsonResponse({
          gateway,
          simulation: true,
          completion: completion.data,
          checkout: {
            id: checkoutInsert.data.id,
            kind: "subscription",
            status: "completed",
            url: null,
            message:
              "Simulated checkout completed. Plan benefits and included AU were applied instantly.",
            offerCode: offerResult.data.code,
          },
        });
      }

      const checkout = await gatewayAdapter.createCheckoutSession({
        checkoutSessionId: checkoutInsert.data.id,
        workspaceId: payload.workspaceId,
        sessionKind: "subscription",
        successUrl: payload.successUrl,
        cancelUrl: payload.cancelUrl,
      });

      await service
        .from("billing_checkout_sessions")
        .update({
          status: checkout.status,
          checkout_url: checkout.url,
          provider_session_id: checkout.providerSessionId,
        })
        .eq("id", checkoutInsert.data.id);

      return jsonResponse({
        gateway,
        checkout: {
          id: checkoutInsert.data.id,
          kind: "subscription",
          status: checkout.status,
          url: checkout.url,
          message: checkout.message,
          offerCode: offerResult.data.code,
        },
      });
    }

    if (!payload.packCode) {
      return jsonResponse({ error: "packCode is required." }, 400);
    }

    const packResult = await service
      .from("au_packs")
      .select("id, code, name, price_usd, currency")
      .eq("code", payload.packCode)
      .eq("is_active", true)
      .maybeSingle();

    if (packResult.error) {
      throw new Error(packResult.error.message);
    }

    if (!packResult.data) {
      return jsonResponse({ error: "AU pack not found." }, 404);
    }

    const checkoutInsert = await service
      .from("billing_checkout_sessions")
      .insert({
        session_kind: "au_pack",
        status: "pending",
        provider: gateway.provider,
        user_id: auth.user.id,
        workspace_id: payload.workspaceId,
        au_pack_id: packResult.data.id,
        provider_customer_id: customer.provider_customer_id,
        currency: packResult.data.currency,
        amount_usd: packResult.data.price_usd,
      })
      .select("id")
      .single();

    if (checkoutInsert.error) {
      throw new Error(checkoutInsert.error.message);
    }

    const purchaseInsert = await service
      .from("au_pack_purchases")
      .insert({
        user_id: auth.user.id,
        workspace_id: payload.workspaceId,
        au_pack_id: packResult.data.id,
        checkout_session_id: checkoutInsert.data.id,
        status: "initiated",
        gross_amount_usd: packResult.data.price_usd,
        currency: packResult.data.currency,
        provider: gateway.provider,
      })
      .select("id")
      .single();

    if (purchaseInsert.error) {
      throw new Error(purchaseInsert.error.message);
    }

    await service.from("billing_events").insert({
      workspace_id: payload.workspaceId,
      checkout_session_id: checkoutInsert.data.id,
      pack_purchase_id: purchaseInsert.data.id,
      provider: gateway.provider,
      event_type: "checkout_session_created",
      amount_usd: packResult.data.price_usd,
      currency: packResult.data.currency,
      payload: {
        checkoutKind: "au_pack",
        packCode: packResult.data.code,
        packName: packResult.data.name,
      },
    });

    if (shouldSimulateBillingCheckout(gateway)) {
      const simulatedProviderSessionId = `sim_checkout_${checkoutInsert.data.id}`;
      const simulatedProviderPaymentId = `sim_payment_${checkoutInsert.data.id}`;
      const simulatedProviderCustomerId =
        customer.provider_customer_id ?? `sim_customer_${auth.user.id}`;

      const completion = await service.rpc("apply_checkout_completion", {
        p_checkout_session_id: checkoutInsert.data.id,
        p_provider_session_id: simulatedProviderSessionId,
        p_provider_payment_id: simulatedProviderPaymentId,
        p_provider_customer_id: simulatedProviderCustomerId,
      });

      if (completion.error) {
        throw new Error(completion.error.message);
      }

      return jsonResponse({
        gateway,
        simulation: true,
        completion: completion.data,
        checkout: {
          id: checkoutInsert.data.id,
          kind: "au_pack",
          status: "completed",
          url: null,
          message:
            "Simulated checkout completed. The AU pack was credited to the workspace instantly.",
          packCode: packResult.data.code,
        },
      });
    }

    const checkout = await gatewayAdapter.createCheckoutSession({
      checkoutSessionId: checkoutInsert.data.id,
      workspaceId: payload.workspaceId,
      sessionKind: "au_pack",
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
    });

    await service
      .from("billing_checkout_sessions")
      .update({
        status: checkout.status,
        checkout_url: checkout.url,
        provider_session_id: checkout.providerSessionId,
      })
      .eq("id", checkoutInsert.data.id);

    await service
      .from("au_pack_purchases")
      .update({
        status:
          checkout.status === "open"
            ? "awaiting_payment"
            : checkout.status === "failed"
              ? "failed"
              : "initiated",
      })
      .eq("id", purchaseInsert.data.id);

    return jsonResponse({
      gateway,
      checkout: {
        id: checkoutInsert.data.id,
        kind: "au_pack",
        status: checkout.status,
        url: checkout.url,
        message: checkout.message,
        packCode: packResult.data.code,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to create checkout session.",
      },
      500,
    );
  }
});

function createSimulationPeriod(
  billingCycle: "monthly" | "yearly",
): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date(start);

  if (billingCycle === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  return { start, end };
}
