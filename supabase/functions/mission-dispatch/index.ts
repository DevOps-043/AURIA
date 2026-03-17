import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MissionDispatchRequest = {
  workspaceId: string;
  missionId: string;
  objective: string;
  priority?: number;
};

// ─── JWT Verification Middleware ──────────────────────────────────────
// Extracts and validates the Bearer token from the Authorization header.
// Returns the authenticated Supabase client scoped to the user's JWT,
// ensuring all subsequent queries respect RLS policies.

async function authenticateRequest(request: Request) {
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

  // Validate the JWT by fetching the user it belongs to
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid or expired token", status: 403 };
  }

  return { supabase, user };
}

// ─── Request Handler ─────────────────────────────────────────────────

Deno.serve(async (request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // 1. Authenticate — verify JWT
  const auth = await authenticateRequest(request);
  if ("error" in auth) {
    return Response.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const { supabase, user } = auth;

  // 2. Parse and validate payload
  let payload: Partial<MissionDispatchRequest>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.workspaceId || !payload.missionId || !payload.objective) {
    return Response.json(
      { error: "workspaceId, missionId and objective are required." },
      { status: 400 },
    );
  }

  // 3. Authorization — verify user has access to the workspace (via RLS)
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", payload.workspaceId)
    .maybeSingle();

  if (wsError || !workspace) {
    return Response.json(
      { error: "Workspace not found or access denied" },
      { status: 403 },
    );
  }

  // 4. Dispatch mission
  return Response.json({
    accepted: true,
    dispatchedAt: new Date().toISOString(),
    queue: "mission-control",
    userId: user.id,
    mission: payload,
  });
});
