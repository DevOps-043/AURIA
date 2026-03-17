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

type PortalRequest = {
  workspaceId?: string;
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

  let payload: PortalRequest;
  try {
    payload = await readJsonBody<PortalRequest>(request);
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.workspaceId) {
    return jsonResponse({ error: "workspaceId is required." }, 400);
  }

  const workspace = await verifyWorkspaceAccess(auth, payload.workspaceId);
  if (!workspace) {
    return jsonResponse(
      { error: "Workspace not found or access denied." },
      403,
    );
  }

  const gateway = getBillingGatewayState();
  const adapter = getBillingGatewayAdapter(gateway);
  const service = createServiceClient();

  try {
    await upsertBillingCustomer(service, {
      userId: auth.user.id,
      email: auth.user.email,
      workspaceId: payload.workspaceId,
      provider: gateway.provider,
    });

    if (shouldSimulateBillingCheckout(gateway)) {
      await service.from("billing_events").insert({
        subscription_id: workspace.subscription_id,
        workspace_id: payload.workspaceId,
        provider: gateway.provider,
        event_type: "portal_session_created",
        payload: {
          status: "simulation",
          simulation: true,
        },
      });

      return jsonResponse({
        gateway,
        simulation: true,
        portal: {
          status: "open",
          url: null,
          message:
            "Simulation mode is active. Use the plan catalog and AU packs in this screen to manage billing changes until the portal gateway is ready.",
        },
      });
    }

    const portal = await adapter.createPortalSession({
      workspaceId: payload.workspaceId,
    });

    await service.from("billing_events").insert({
      subscription_id: workspace.subscription_id,
      workspace_id: payload.workspaceId,
      provider: gateway.provider,
      event_type: "portal_session_created",
      payload: {
        status: portal.status,
        url: portal.url,
      },
    });

    return jsonResponse({
      gateway,
      portal,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to create billing portal session.",
      },
      500,
    );
  }
});
