import {
  corsHeaders,
  createServiceClient,
  getBillingGatewayState,
  hasValidWebhookSecret,
  jsonResponse,
  normalizeWebhookPayload,
  readJsonBody,
} from "../_shared/billing.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody<Record<string, unknown>>(request);
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const gateway = getBillingGatewayState();
  const signatureValid = hasValidWebhookSecret(request);
  const service = createServiceClient();
  const normalized = normalizeWebhookPayload(payload);

  const ledgerInsert = await service
    .from("billing_webhook_events")
    .insert({
      provider: gateway.provider,
      provider_event_id: normalized.providerEventId,
      event_type: normalized.eventType,
      signature_valid: signatureValid,
      processing_status: signatureValid ? "pending" : "failed",
      error_message: signatureValid ? null : "Invalid webhook secret.",
      payload,
      processed_at: signatureValid ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (ledgerInsert.error) {
    return jsonResponse({ error: ledgerInsert.error.message }, 500);
  }

  if (!signatureValid) {
    return jsonResponse({ error: "Invalid webhook secret." }, 401);
  }

  try {
    let handled = false;

    if (
      normalized.checkoutSessionId &&
      [
        "checkout_session_completed",
        "checkout.completed",
        "payment_succeeded",
        "payment.succeeded",
      ].includes(normalized.eventType)
    ) {
      const completion = await service.rpc("apply_checkout_completion", {
        p_checkout_session_id: normalized.checkoutSessionId,
        p_provider_session_id: normalized.providerSessionId,
        p_provider_payment_id: normalized.providerPaymentId,
        p_provider_subscription_id: normalized.providerSubscriptionId,
        p_provider_customer_id: normalized.providerCustomerId,
        p_subscription_status: normalized.subscriptionStatus ?? "active",
        p_period_start: normalized.periodStart ?? new Date().toISOString(),
        p_period_end:
          normalized.periodEnd ??
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (completion.error) {
        throw new Error(completion.error.message);
      }

      handled = true;
    } else if (
      [
        "subscription_updated",
        "subscription.updated",
        "subscription_canceled",
        "subscription.canceled",
      ].includes(normalized.eventType)
    ) {
      let subscriptionId = normalized.subscriptionId;

      if (!subscriptionId && normalized.providerSubscriptionId) {
        const subscriptionLookup = await service
          .from("subscriptions")
          .select("id")
          .eq("provider", gateway.provider)
          .eq("provider_subscription_id", normalized.providerSubscriptionId)
          .maybeSingle();

        if (subscriptionLookup.error) {
          throw new Error(subscriptionLookup.error.message);
        }

        subscriptionId = subscriptionLookup.data?.id ?? null;
      }

      if (subscriptionId) {
        const statusUpdate = await service.rpc("apply_subscription_status_change", {
          p_subscription_id: subscriptionId,
          p_status:
            normalized.subscriptionStatus ??
            (normalized.eventType.includes("canceled") ? "canceled" : "active"),
          p_reason: normalized.eventType,
        });

        if (statusUpdate.error) {
          throw new Error(statusUpdate.error.message);
        }

        handled = true;
      }
    }

    await service
      .from("billing_webhook_events")
      .update({
        processing_status: handled ? "processed" : "ignored",
        error_message: handled ? null : "No actionable billing transition found.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", ledgerInsert.data.id);

    return jsonResponse({
      accepted: true,
      processed: handled,
      gateway,
      eventType: normalized.eventType,
    });
  } catch (error) {
    await service
      .from("billing_webhook_events")
      .update({
        processing_status: "failed",
        error_message: error instanceof Error ? error.message : "Webhook processing failed.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", ledgerInsert.data.id);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Webhook processing failed.",
      },
      500,
    );
  }
});
