import { useState, useEffect } from 'react';
import { supabase } from '@/shared/api/supabase-client';

export interface Mission {
  id: string;
  title: string;
  summary: string | null;
  status: 'discovered' | 'analyzing' | 'researching' | 'executing' | 'validating' | 'review' | 'blocked' | 'completed';
  objective: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  actualCostUsd: number | null;
  createdAt: string;
}

export function useMissions(repoId: string | null) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId || !supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let cancelled = false;

    const fetchMissions = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await client
          .from('missions')
          .select('id, title, summary, status, objective, risk_level, actual_cost_usd, created_at')
          .eq('repository_id', repoId)
          .order('created_at', { ascending: false });

        if (err) throw err;
        if (cancelled) return;

        setMissions((data ?? []).map(m => ({
          id: m.id,
          title: m.title,
          summary: m.summary,
          status: m.status,
          objective: m.objective,
          riskLevel: m.risk_level,
          actualCostUsd: m.actual_cost_usd,
          createdAt: m.created_at
        })));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las misiones');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMissions();
    return () => { cancelled = true; };
  }, [repoId]);

  return { missions, loading, error };
}
