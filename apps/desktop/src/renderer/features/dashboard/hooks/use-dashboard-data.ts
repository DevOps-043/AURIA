import { useState, useEffect } from 'react';
import type { RuntimeHealth } from '@auria/contracts';
import { supabase } from '@/shared/api/supabase-client';

export interface Repository {
  id: string;
  externalId: string;
  name: string;
  fullName: string;
  provider: string;
  status: string;
  lastAction: string;
  time: string;
  branch?: string;
  language?: string | null;
}

export interface AgentActivity {
  id: string;
  type: 'brain' | 'file' | 'shield' | 'activity';
  title: string;
  desc: string;
  time: string;
}

export interface WorkspacePlan {
  name: string;
  usedSlots: number;
  totalSlots: number;
}

const DEFAULT_PLAN: WorkspacePlan = {
  name: 'Plan Inicial',
  usedSlots: 0,
  totalSlots: 3,
};

interface DashboardData {
  health: RuntimeHealth | null;
  repos: Repository[];
  activities: AgentActivity[];
  plan: WorkspacePlan;
  workspaceId: string | null;
  connectedExternalIds: Set<string>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches and manages all data needed by the dashboard.
 * Queries real repository data from Supabase and plan slot info.
 */
export function useDashboardData(): DashboardData {
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [plan, setPlan] = useState<WorkspacePlan>(DEFAULT_PLAN);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [connectedExternalIds, setConnectedExternalIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = () => setFetchTrigger((n) => n + 1);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch runtime health from Electron
        const healthData = await window.auria?.getRuntimeHealth();
        if (cancelled) return;
        if (healthData) setHealth(healthData);

        if (!supabase) {
          setRepos([]);
          setActivities([]);
          setPlan(DEFAULT_PLAN);
          setLoading(false);
          return;
        }

        // Get the user's first workspace (owner)
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) {
          setLoading(false);
          return;
        }

        const { data: workspaceRows } = await supabase
          .from('workspaces')
          .select('id, name, subscription_id')
          .eq('owner_id', user.id)
          .limit(1);

        if (cancelled) return;

        const workspace = workspaceRows?.[0];
        if (!workspace) {
          // No workspace yet — show empty state with defaults
          setRepos([]);
          setPlan(DEFAULT_PLAN);
          setLoading(false);
          return;
        }

        setWorkspaceId(workspace.id);

        // Fetch connected repositories with their connections
        const { data: repoRows } = await supabase
          .from('repositories')
          .select('id, external_id, name, full_name, provider, default_branch, language, is_active, updated_at, repository_connections(connection_status)')
          .eq('workspace_id', workspace.id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false });

        if (cancelled) return;

        const mappedRepos: Repository[] = (repoRows ?? []).map((row) => {
          const connectionStatus =
            Array.isArray(row.repository_connections) && row.repository_connections.length > 0
              ? (row.repository_connections[0] as { connection_status: string }).connection_status
              : 'unknown';

          return {
            id: row.id,
            externalId: row.external_id ?? '',
            name: row.name,
            fullName: row.full_name,
            provider: row.provider,
            status: connectionStatus === 'active' ? 'Activo' : connectionStatus,
            lastAction: 'Conectado',
            time: formatRelativeTime(row.updated_at),
            branch: row.default_branch ?? 'main',
            language: row.language,
          };
        });

        setRepos(mappedRepos);
        setConnectedExternalIds(
          new Set(mappedRepos.map((r) => r.externalId)),
        );

        // Fetch repo slot info via RPC
        const { data: slotInfo } = await supabase.rpc('get_repo_slot_info', {
          target_workspace_id: workspace.id,
        });

        if (cancelled) return;

        if (slotInfo) {
          // Get plan name from subscription
          let planName = 'Plan Inicial';
          if (workspace.subscription_id) {
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('plan_code')
              .eq('id', workspace.subscription_id)
              .single();
            if (sub?.plan_code) {
              planName = formatPlanName(sub.plan_code);
            }
          }

          setPlan({
            name: planName,
            usedSlots: (slotInfo as { used: number }).used,
            totalSlots: (slotInfo as { total: number }).total,
          });
        }

        // Activities remain empty until mission system is active
        setActivities([]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos del panel');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [fetchTrigger]);

  return { health, repos, activities, plan, workspaceId, connectedExternalIds, loading, error, refetch };
}

function formatPlanName(planCode: string): string {
  const normalized = planCode.trim().toLowerCase();

  if (normalized === 'starter') return 'Plan Inicial';
  if (normalized === 'pro') return 'Plan Pro';
  if (normalized === 'enterprise') return 'Plan Empresarial';

  return `Plan ${planCode.charAt(0).toUpperCase()}${planCode.slice(1)}`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays < 30) return `hace ${diffDays} d`;
  return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}
