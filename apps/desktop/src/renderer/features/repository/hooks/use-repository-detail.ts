import { useState, useEffect } from 'react';
import { supabase } from '@/shared/api/supabase-client';

export interface RepositoryDetail {
  id: string;
  workspaceId: string;
  name: string;
  fullName: string;
  provider: string;
  branch: string;
  language: string | null;
  description: string | null;
  url: string | null;
  isActive: boolean;
  syncState: string;
  localPath: string | null;
}

export interface AgentProfile {
  id: string;
  role: string;
  primaryModel: string;
  fallbackModel: string | null;
  externalToolsEnabled: boolean;
  depth: 'focused' | 'balanced' | 'deep';
  costPolicy: 'efficient' | 'balanced' | 'premium';
  latencyPolicy: 'fast' | 'balanced' | 'deliberate';
  parallelism: number;
}

export interface RepositoryPolicy {
  autonomyMode: 'proposal' | 'pull_request' | 'guarded_autonomy';
  humanReviewAbove: 'low' | 'moderate' | 'high' | 'critical';
  maxLinesMission: number;
  maxLinesFile: number;
  maxFilesTouched: number;
  maxConcurrentAgents: number;
}

interface RepositoryDetailData {
  repo: RepositoryDetail | null;
  agents: AgentProfile[];
  policy: RepositoryPolicy | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRepositoryDetail(repoId: string | null): RepositoryDetailData {
  const [repo, setRepo] = useState<RepositoryDetail | null>(null);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [policy, setPolicy] = useState<RepositoryPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = () => setTrigger(t => t + 1);

  useEffect(() => {
    if (!repoId || !supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Repo Info
        const { data: repoRow, error: repoErr } = await client
          .from('repositories')
          .select(`
            id, workspace_id, name, full_name, provider, default_branch, language, description, url, is_active, local_path,
            repository_connections(sync_state)
          `)
          .eq('id', repoId)
          .single();

        if (repoErr) throw repoErr;
        if (cancelled) return;

        const connection = Array.isArray(repoRow.repository_connections) ? repoRow.repository_connections[0] : repoRow.repository_connections;

        setRepo({
          id: repoRow.id,
          workspaceId: repoRow.workspace_id,
          name: repoRow.name,
          fullName: repoRow.full_name,
          provider: repoRow.provider,
          branch: repoRow.default_branch,
          language: repoRow.language,
          description: repoRow.description,
          url: repoRow.url,
          isActive: repoRow.is_active,
          syncState: connection?.sync_state ?? 'unknown',
          localPath: repoRow.local_path
        });

        // 2. Fetch Workspace Agents
        const { data: agentRows, error: agentErr } = await client
          .from('agent_profiles')
          .select('*')
          .eq('workspace_id', repoRow.workspace_id);

        if (agentErr) throw agentErr;
        if (cancelled) return;

        setAgents((agentRows ?? []).map(row => ({
          id: row.id,
          role: row.role,
          primaryModel: row.primary_model,
          fallbackModel: row.fallback_model,
          externalToolsEnabled: row.external_tools_enabled,
          depth: row.depth,
          costPolicy: row.cost_policy,
          latencyPolicy: row.latency_policy,
          parallelism: row.parallelism
        })));

        // 3. Fetch Repo Policy
        const { data: policyRow, error: policyErr } = await client
          .from('repository_policies')
          .select('*')
          .eq('repository_id', repoId)
          .single();

        if (policyErr && policyErr.code !== 'PGRST116') throw policyErr; // PGRST116 is code for 'no rows found'
        if (cancelled) return;

        if (policyRow) {
          setPolicy({
            autonomyMode: policyRow.autonomy_mode,
            humanReviewAbove: policyRow.require_human_review_above,
            maxLinesMission: policyRow.max_lines_per_mission,
            maxLinesFile: policyRow.max_lines_per_file,
            maxFilesTouched: policyRow.max_files_touched,
            maxConcurrentAgents: policyRow.max_concurrent_agents
          });
        }

      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar los detalles del repositorio');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [repoId, trigger]);

  return { repo, agents, policy, loading, error, refetch };
}
