import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import type { GitHubRepo } from "../../../shared/github-types";

interface ConnectRepoParams {
  workspaceId: string;
  githubRepo: GitHubRepo;
}

/**
 * Connects a GitHub repository to an Auria workspace.
 * Uses the server-side RPC `connect_github_repository` which atomically:
 *   1. Validates workspace access and slot availability
 *   2. Inserts into repositories
 *   3. Creates repository_connections (api_only mode)
 *   4. Creates default repository_policies
 *
 * On success, invalidates the dashboard queries so the UI refreshes.
 */
export function useConnectRepository() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ workspaceId, githubRepo }: ConnectRepoParams) => {
      if (!supabase) throw new Error("Supabase no esta configurado");

      const { data, error } = await supabase.rpc("connect_github_repository", {
        target_workspace_id: workspaceId,
        github_external_id: String(githubRepo.id),
        repo_full_name: githubRepo.full_name,
        repo_name: githubRepo.name,
        repo_default_branch: githubRepo.default_branch,
        repo_language: githubRepo.language,
        repo_description: githubRepo.description,
        repo_url: githubRepo.html_url,
        repo_is_private: githubRepo.private,
      });

      if (error) throw new Error(error.message);

      return data as string; // returns the new repository UUID
    },
    onSuccess: () => {
      // Refresh dashboard data and repo slot info
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-repos"] });
      queryClient.invalidateQueries({ queryKey: ["repo-slot-info"] });
    },
  });

  return {
    connectRepo: mutation.mutateAsync,
    isConnecting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
