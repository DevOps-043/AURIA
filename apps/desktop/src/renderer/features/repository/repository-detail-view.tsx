import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Cpu,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  LayoutGrid,
  ListChecks,
  FileCode2,
  Play,
  Sparkles,
} from "lucide-react";
import { useRepositoryDetail } from "./hooks/use-repository-detail";
import { AgentConfig } from "./components/agent-config";
import { useMissions } from "./hooks/use-missions";
import { NodeCommandCenter } from "./components/node-command-center";
import { AutonomousRunPanel } from "./components/autonomous-run-panel";
import { IntelligenceLog } from "./components/intelligence-log";
import { useAutonomousRuntime } from "./hooks/use-autonomous-runtime";
import { desktopBridge } from "../../shared/api/desktop-bridge";
import { Dropdown } from "../../shared/components/ui/dropdown";
import type { GitHubBranch } from "../../../shared/github-types";

interface RepositoryDetailViewProps {
  repoId: string;
  onBack: () => void;
}

type SubTabId =
  | "overview"
  | "autonomous"
  | "command"
  | "agents"
  | "missions";

export const RepositoryDetailView: React.FC<RepositoryDetailViewProps> = ({
  repoId,
  onBack,
}) => {
  const { repo, loading, error, refetch } = useRepositoryDetail(repoId);
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("autonomous");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [selectedLocalPath, setSelectedLocalPath] = useState<string | null>(null);
  const autonomousRuntime = useAutonomousRuntime({
    repoFullName: repo?.fullName,
    repoBranch: selectedBranch || repo?.branch,
    repoProvider: repo?.provider,
    repoUrl: repo?.url,
    localPath: selectedLocalPath ?? repo?.localPath,
  });

  useEffect(() => {
    if (repo?.branch) {
      setSelectedBranch(repo.branch);
    }
  }, [repo?.branch, repo?.id]);

  useEffect(() => {
    setSelectedLocalPath(repo?.localPath ?? null);
  }, [repo?.id, repo?.localPath]);

  useEffect(() => {
    let cancelled = false;

    const loadBranches = async () => {
      if (!repo || repo.provider.toLowerCase() !== "github") {
        setBranches([]);
        setBranchesLoading(false);
        setBranchError(null);
        return;
      }

      const repoIdentity = parseRepoIdentity(repo.fullName);
      if (!repoIdentity) {
        setBranches([]);
        setBranchError("Identificador de repositorio invalido.");
        setBranchesLoading(false);
        return;
      }

      try {
        setBranchesLoading(true);
        setBranchError(null);

        const result = await desktopBridge.github.getBranches(
          repoIdentity.owner,
          repoIdentity.repo,
        );

        if (!cancelled) {
          setBranches(result);
        }
      } catch (err) {
        if (!cancelled) {
          setBranches([]);
          setBranchError(
            err instanceof Error ? err.message : "No se pudieron cargar las ramas.",
          );
        }
      } finally {
        if (!cancelled) {
          setBranchesLoading(false);
        }
      }
    };

    void loadBranches();

    return () => {
      cancelled = true;
    };
  }, [repo?.fullName, repo?.provider, repo?.id]);

  const branchOptions = useMemo(() => {
    if (!repo) {
      return [];
    }

    const branchNames = new Set(branches.map((branch) => branch.name));
    branchNames.add(repo.branch);

    return Array.from(branchNames).sort((left, right) => {
      if (left === repo.branch) return -1;
      if (right === repo.branch) return 1;
      return left.localeCompare(right);
    });
  }, [branches, repo]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onBack={onBack} />;
  if (!repo) return null;

  const runButtonLabel = autonomousRuntime.snapshot.state.running
    ? "En ejecucion"
    : autonomousRuntime.loading
      ? "Conectando"
      : "Iniciar ahora";

  const handleRunNow = async () => {
    setActiveSubTab("autonomous");
    await autonomousRuntime.runNow();
  };

  const handlePickRepositorySource = async () => {
    const pickedPath = await desktopBridge.pickRepositoryDirectory();
    if (pickedPath) {
      setSelectedLocalPath(pickedPath);
      setActiveSubTab("autonomous");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-4">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary"
          >
            <ChevronLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
            Centro de control
          </button>

          <div className="flex items-center gap-4">
            <div className="rounded-3xl border border-primary/10 bg-primary/5 p-4 text-primary shadow-lg shadow-primary/5">
              <GitBranch className="w-8 h-8" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-3">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">
                  {repo.name}
                </h1>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/10 bg-emerald-500/5 px-2.5 py-0.5">
                  <div className="h-1 w-1 rounded-full bg-emerald-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                    {formatSyncState(repo.syncState)}
                  </span>
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="opacity-60">{repo.fullName}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
                <span className="font-bold text-primary">
                  {selectedBranch || repo.branch}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px]">
                   <Dropdown
                     value={selectedBranch || repo.branch}
                     onChange={setSelectedBranch}
                     options={branchOptions.map((branchName) => ({
                       value: branchName,
                       label: branchName,
                     }))}
                     placeholder="Selecciona rama"
                     disabled={branchesLoading || branchOptions.length === 0}
                     className="w-full"
                     icon={<GitBranch className="h-3.5 w-3.5 text-primary" />}
                   />
                 </div>

                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {branchesLoading
                    ? "Cargando ramas..."
                    : `${branchOptions.length} ramas disponibles`}
                </span>

                {selectedBranch && selectedBranch !== repo.branch && (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-primary">
                    Comparando contra {repo.branch}
                  </span>
                )}
              </div>
              {branchError && (
                <p className="mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-red-400">
                  {branchError}
                </p>
              )}
              <p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Fuente local: {selectedLocalPath ?? repo.localPath ?? "Sin carpeta vinculada"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3">
          <button
            onClick={() => void handleRunNow()}
            disabled={autonomousRuntime.loading || autonomousRuntime.snapshot.state.running}
            className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5" />
            {runButtonLabel}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handlePickRepositorySource()}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all hover:border-primary/50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Repositorio fuente
            </button>
            <button
              onClick={() => refetch()}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-2xl border border-border/50 bg-muted/30 p-1">
        <TabButton
          active={activeSubTab === "autonomous"}
          onClick={() => setActiveSubTab("autonomous")}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Ejecucion autonoma"
        />
        <TabButton
          active={activeSubTab === "overview"}
          onClick={() => setActiveSubTab("overview")}
          icon={<LayoutGrid className="w-3.5 h-3.5" />}
          label="Resumen"
        />
        <TabButton
          active={activeSubTab === "command"}
          onClick={() => setActiveSubTab("command")}
          icon={<FileCode2 className="w-3.5 h-3.5" />}
          label="Explorador de codigo"
        />
        <TabButton
          active={activeSubTab === "agents"}
          onClick={() => setActiveSubTab("agents")}
          icon={<Cpu className="w-3.5 h-3.5" />}
          label="Configuracion de agentes"
        />
        <TabButton
          active={activeSubTab === "missions"}
          onClick={() => setActiveSubTab("missions")}
          icon={<ListChecks className="w-3.5 h-3.5" />}
          label="Registro de inteligencia"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="min-h-[400px]"
        >
          {activeSubTab === "overview" && <OverviewTab repo={repo} />}
          {activeSubTab === "autonomous" && (
            <AutonomousRunPanel
              snapshot={autonomousRuntime.snapshot}
              loading={autonomousRuntime.loading}
              error={autonomousRuntime.error}
              onRunNow={async () => {
                await autonomousRuntime.runNow();
              }}
              onAbortRun={async () => {
                await autonomousRuntime.abortRun();
              }}
            />
          )}
          {activeSubTab === "command" && (
            <NodeCommandCenter
              repoFullName={repo.fullName}
              repoBranch={selectedBranch || repo.branch}
              baseBranch={repo.branch}
              repoProvider={repo.provider}
            />
          )}
          {activeSubTab === "agents" && (
            <AgentConfig
              repositoryId={repo.id}
              workspaceId={repo.workspaceId}
              repoFullName={repo.fullName}
            />
          )}
          {activeSubTab === "missions" && (
            <MissionsTab
              repoId={repoId}
              snapshot={autonomousRuntime.snapshot}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

function OverviewTab({ repo }: { repo: any }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 bg-primary/5 blur-3xl" />
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-primary">
            Resumen del repositorio
          </h3>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {repo.description || "No hay una descripcion disponible para este repositorio."}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <h4 className="mb-5 text-[10px] font-black uppercase tracking-widest text-primary">
            Detalles del repositorio
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RepositoryField label="Nombre completo" value={repo.fullName} />
            <RepositoryField label="Proveedor" value={repo.provider} />
            <RepositoryField label="Rama principal" value={repo.branch} />
            <RepositoryField
              label="Lenguaje principal"
              value={repo.language || "Desconocido"}
            />
            <RepositoryField
              label="Estado de sincronizacion"
              value={formatSyncState(repo.syncState)}
            />
            <RepositoryField
              label="Estado del repositorio"
              value={repo.isActive ? "Activo" : "Inactivo"}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        <h4 className="mb-4 text-sm font-black uppercase tracking-widest text-primary">
          Metadatos de origen
        </h4>
        <div className="space-y-4">
          <RepositoryField label="Nombre" value={repo.name} compact />
          <RepositoryField
            label="URL"
            value={repo.url || "Sin URL registrada"}
            compact
            breakAll
          />
          <RepositoryField label="Rama" value={repo.branch} compact />
          <RepositoryField
            label="Lenguaje"
            value={repo.language || "Desconocido"}
            compact
          />
        </div>
      </div>
    </div>
  );
}

function MissionsTab({
  repoId,
  snapshot,
}: {
  repoId: string;
  snapshot: ReturnType<typeof useAutonomousRuntime>["snapshot"];
}) {
  const { missions, loading } = useMissions(repoId);

  return (
    <IntelligenceLog
      snapshot={snapshot}
      missions={missions}
      missionsLoading={loading}
    />
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function parseRepoIdentity(
  repoFullName: string,
): { owner: string; repo: string } | null {
  const segments = repoFullName.split("/").filter(Boolean);
  if (segments.length !== 2) {
    return null;
  }

  return {
    owner: segments[0],
    repo: segments[1],
  };
}

function LoadingState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center grayscale opacity-50">
      <div className="relative">
        <RefreshCw className="w-10 h-10 animate-spin text-primary opacity-30" />
        <Cpu className="absolute left-1/2 top-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
      </div>
      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">
        Conectando con el nodo...
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="rounded-3xl border border-red-500/10 bg-red-500/5 p-10 text-center">
      <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-red-500">
        Error de desconexion del nodo
      </p>
      <p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground">
        {message}
      </p>
      <button
        onClick={onBack}
        className="rounded-xl border border-border bg-background px-6 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:border-red-500/50"
      >
        Restaurar conexion
      </button>
    </div>
  );
}

function RepositoryField({
  label,
  value,
  compact = false,
  breakAll = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border border-border/50 bg-background/40 ${
        compact ? "px-4 py-3" : "px-4 py-4"
      }`}
    >
      <span className="text-[8px] font-black uppercase leading-none tracking-widest text-muted-foreground opacity-70">
        {label}
      </span>
      <span
        className={`text-[11px] font-bold text-foreground ${
          breakAll ? "break-all" : "break-words"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function formatSyncState(value: string): string {
  switch (value) {
    case "active":
      return "Activo";
    case "synced":
      return "Sincronizado";
    case "pending":
      return "Pendiente";
    case "error":
      return "Error";
    default:
      return value;
  }
}
