import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Lock,
  Globe,
  Loader2,
  AlertCircle,
  GitBranch,
  Check,
} from "lucide-react";
import { useGitHubRepos } from "@/shared/hooks/use-github-repos";
import { useConnectRepository } from "@/shared/hooks/use-connect-repository";
import type { GitHubRepo } from "../../../../shared/github-types";

interface RepoPickerModalProps {
  workspaceId: string;
  connectedExternalIds: Set<string>;
  slotsAvailable: number;
  onClose: () => void;
  onConnected: () => void;
  onGoToSettings?: () => void;
}

/**
 * Modal for selecting and connecting GitHub repositories to a workspace.
 * Lists the user's GitHub repos with search, pagination, and connection status.
 */
export const RepoPickerModal: React.FC<RepoPickerModalProps> = ({
  workspaceId,
  connectedExternalIds,
  slotsAvailable,
  onClose,
  onConnected,
  onGoToSettings,
}) => {
  const {
    repos,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
    search,
    setSearch,
  } = useGitHubRepos();

  const { connectRepo, isConnecting } = useConnectRepository();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [connectError, setConnectError] = useState<string | null>(null);

  const toggleSelection = useCallback(
    (repo: GitHubRepo) => {
      const isAlreadyConnected = connectedExternalIds.has(String(repo.id));
      if (isAlreadyConnected) return;

      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(repo.id)) {
          next.delete(repo.id);
        } else {
          // Enforce slot limit
          if (next.size >= slotsAvailable) return prev;
          next.add(repo.id);
        }
        return next;
      });
    },
    [connectedExternalIds, slotsAvailable],
  );

  const handleConnect = async () => {
    setConnectError(null);
    const selectedRepos = repos.filter((r) => selected.has(r.id));

    try {
      for (const repo of selectedRepos) {
        await connectRepo({ workspaceId, githubRepo: repo });
      }
      onConnected();
      onClose();
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "No se pudo conectar el repositorio",
      );
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-black text-foreground tracking-widest uppercase">
                Conectar repositorio
              </h2>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                {slotsAvailable} espacio{slotsAvailable !== 1 ? "s" : ""} disponible{slotsAvailable !== 1 ? "s" : ""}
                {selected.size > 0 && (
                  <span className="text-primary ml-2">
                    {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar repositorios..."
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-[11px] font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 tracking-wider uppercase"
              />
            </div>
          </div>

          {/* Repo List */}
          <div
            className="flex-1 overflow-y-auto custom-scrollbar"
            onScroll={handleScroll}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Cargando repositorios...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <AlertCircle className="w-6 h-6 text-red-400 mb-3" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400 text-center mb-4">
                  {error instanceof Error
                    ? error.message.includes("[AUTH]")
                      ? "GitHub no esta conectado. Vincula tu cuenta primero."
                      : error.message
                    : "No se pudieron cargar los repositorios"}
                </p>
                {error instanceof Error && error.message.includes("[AUTH]") && onGoToSettings && (
                  <button
                    onClick={() => { onClose(); onGoToSettings(); }}
                    className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                  >
                    Ir a configuracion
                  </button>
                )}
              </div>
            ) : repos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <GitBranch className="w-6 h-6 text-muted-foreground mb-3" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {search ? "Ningun repositorio coincide con tu busqueda" : "No se encontraron repositorios"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {repos.map((repo) => (
                  <RepoRow
                    key={repo.id}
                    repo={repo}
                    isConnected={connectedExternalIds.has(String(repo.id))}
                    isSelected={selected.has(repo.id)}
                    disabled={
                      !selected.has(repo.id) &&
                      selected.size >= slotsAvailable
                    }
                    onToggle={() => toggleSelection(repo)}
                  />
                ))}
                {isFetchingNextPage && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {connectError && (
            <div className="px-6 py-2 bg-red-500/5 border-t border-red-500/10">
              <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider">
                {connectError}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background/50">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleConnect}
              disabled={selected.size === 0 || isConnecting}
              className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              Conectar{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Repo Row ────────────────────────────────────────────────────────

function RepoRow({
  repo,
  isConnected,
  isSelected,
  disabled,
  onToggle,
}: {
  repo: GitHubRepo;
  isConnected: boolean;
  isSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const updatedAt = formatRelativeTime(repo.updated_at);

  return (
    <button
      onClick={onToggle}
      disabled={isConnected || disabled}
      className={`w-full flex items-center gap-4 px-6 py-3.5 text-left transition-all ${
        isConnected
          ? "opacity-50 cursor-not-allowed"
          : disabled
            ? "opacity-40 cursor-not-allowed"
            : isSelected
              ? "bg-primary/5"
              : "hover:bg-muted/50"
      }`}
    >
      {/* Selection indicator */}
      <div
        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          isConnected
            ? "border-emerald-500/40 bg-emerald-500/10"
            : isSelected
              ? "border-primary bg-primary"
              : "border-border"
        }`}
      >
        {(isConnected || isSelected) && (
          <Check className={`w-3 h-3 ${isConnected ? "text-emerald-400" : "text-primary-foreground"}`} />
        )}
      </div>

      {/* Repo info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-foreground tracking-wider uppercase truncate">
            {repo.full_name}
          </span>
          {repo.private ? (
            <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
          ) : (
            <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
          {repo.archived && (
            <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Archivado
            </span>
          )}
          {isConnected && (
            <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Conectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {repo.language && (
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
              {repo.language}
            </span>
          )}
          <span className="text-[8px] font-medium text-muted-foreground/70">
            {updatedAt}
          </span>
          {repo.description && (
            <span className="text-[8px] font-medium text-muted-foreground/50 truncate">
              {repo.description}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays < 30) return `hace ${diffDays} d`;
  return date.toLocaleDateString("es-MX", { month: "short", day: "numeric" });
}
