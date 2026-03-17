import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";

/**
 * Disconnects a repository from an Auria workspace.
 * Uses the server-side RPC `disconnect_repository` which:
 *   1. Validates workspace access
 *   2. Soft-deletes the repository (is_active = false)
 *   3. Updates connection_status to 'disconnected'
 *
 * On success, invalidates dashboard queries to refresh the UI.
 */
export function useDisconnectRepository() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      if (!supabase) throw new Error("Supabase no esta configurado");

      const { error } = await supabase.rpc("disconnect_repository", {
        target_repo_id: repositoryId,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-repos"] });
      queryClient.invalidateQueries({ queryKey: ["repo-slot-info"] });
    },
  });

  return {
    disconnectRepo: mutation.mutateAsync,
    isDisconnecting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
