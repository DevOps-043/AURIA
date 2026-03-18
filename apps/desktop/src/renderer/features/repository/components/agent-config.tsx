import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Braces,
  Bug,
  Cable,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Cpu,
  FileText,
  Gauge,
  GitBranch,
  Loader2,
  Minus,
  Orbit,
  Pencil,
  Plus,
  Rocket,
  Shield,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { desktopBridge } from "@/shared/api/desktop-bridge";
import { Dropdown } from "@/shared/components/ui/dropdown";
import {
  useAgentConfiguration,
  type ScheduleEntry,
  DAYS_OF_WEEK,
  QUICK_TIMES,
  formatTime12h,
} from "../hooks/use-agent-configuration";

/* ────────────────────────────────────────────────────────────────── */
/*  Props                                                            */
/* ────────────────────────────────────────────────────────────────── */

interface AgentConfigProps {
  repositoryId: string;
  workspaceId: string;
  repoFullName: string;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Constants                                                        */
/* ────────────────────────────────────────────────────────────────── */

const TOOL_META: Record<string, [LucideIcon, string, string]> = {
  documentation: [FileText, "text-amber-300 border-amber-500/20 bg-amber-500/10", "Docs"],
  quality: [Wrench, "text-emerald-300 border-emerald-500/20 bg-emerald-500/10", "Calidad"],
  improvement: [Braces, "text-violet-300 border-violet-500/20 bg-violet-500/10", "Mejora"],
  qa_correction: [Bug, "text-orange-300 border-orange-500/20 bg-orange-500/10", "Correccion QA"],
  security: [Shield, "text-rose-300 border-rose-500/20 bg-rose-500/10", "Seguridad"],
  optimization: [Gauge, "text-lime-300 border-lime-500/20 bg-lime-500/10", "Optimizacion"],
  spaghetti_cleanup: [Cable, "text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/10", "Limpieza Profunda"],
  implementation: [Rocket, "text-indigo-300 border-indigo-500/20 bg-indigo-500/10", "Construccion"],
};

const INTERACTIVE_TOOLS: Array<{
  slug: string;
  label: string;
  category: string;
  description: string;
}> = [
  { slug: "autonomous_docs", label: "Documentacion Autonoma", category: "documentation", description: "Genera notas de commit, resumenes de PR, changelogs y documentos de entrega." },
  { slug: "quality", label: "Calidad", category: "quality", description: "Limpieza de nivel lint, revisiones de consistencia y mejoras de calidad." },
  { slug: "improvement", label: "Mejora Tecnica", category: "improvement", description: "Reduce deuda tecnica moderada con refactors acotados y limpieza estructural." },
  { slug: "qa_correction", label: "Correccion QA", category: "qa_correction", description: "Corrige bugs reproducibles, problemas de flujo y validaciones invalidas." },
  { slug: "security", label: "Seguridad", category: "security", description: "Analiza y corrige riesgos de seguridad, secretos expuestos y debilidades." },
  { slug: "optimization", label: "Optimizacion", category: "optimization", description: "Mejora rendimiento, rutas pesadas y flujos ineficientes." },
  { slug: "spaghetti_cleanup", label: "Limpieza Profunda", category: "spaghetti_cleanup", description: "Refactors profundos sobre zonas de codigo fragiles o muy acopladas." },
  { slug: "new_implementation", label: "Nueva Implementacion", category: "implementation", description: "Construye nuevas capacidades con analisis, diseno y planes." },
];

const AVAILABLE_MODELS = [
  // Gemini (API directa)
  { value: "gemini-3.1-pro-preview-customtools", label: "Gemini 3.1 Pro" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
  // Locales (Ollama / LM Studio)
  { value: "ollama/llama3.3:70b", label: "Llama 3.3 70B (Ollama)" },
  { value: "ollama/qwen3:32b", label: "Qwen 3 32B (Ollama)" },
  { value: "ollama/codellama:34b", label: "Code Llama 34B (Ollama)" },
  { value: "lmstudio/local-model", label: "Modelo local (LM Studio)" },
];

const MODEL_ROLES: Array<{
  key: "planning" | "coding" | "review" | "research";
  label: string;
  description: string;
}> = [
  { key: "planning", label: "Orquestacion / Plan", description: "Modelo que coordina analisis e implementacion" },
  { key: "coding", label: "Generacion de Codigo", description: "Modelo que escribe e implementa el codigo" },
  { key: "review", label: "Revision de Codigo", description: "Modelo que revisa calidad y aprueba cambios" },
  { key: "research", label: "Busqueda / Investigacion", description: "Modelo para investigacion web y analisis" },
];

const WORDS: Record<string, string> = {
  active: "activa", autonomous: "autonomo", canceled: "cancelada", cancelled: "cancelada",
  cloud: "nube", completed: "completada", critical: "critico", deep: "profunda",
  execution: "ejecucion", failed: "fallida", high: "alto", hybrid: "hibrido",
  implementation: "implementacion", latency: "latencia", lite: "ligero", local: "local",
  low: "bajo", memory: "memoria", moderate: "medio", paused: "pausada",
  planning: "planeacion", premium: "premium", queued: "en cola", research: "investigacion",
  review: "revision", running: "en ejecucion", shallow: "superficial", standard: "estandar",
  subscription: "suscripcion", tool: "herramienta", trialing: "prueba", unknown: "desconocido",
  unpaid: "impaga",
};

/* ────────────────────────────────────────────────────────────────── */
/*  Main Component                                                   */
/* ────────────────────────────────────────────────────────────────── */

export const AgentConfig: React.FC<AgentConfigProps> = ({ repositoryId, workspaceId, repoFullName }) => {
  const {
    summary, wallet, warnings, loading, error, saving, saveError,
    localConfig, mutations,
  } = useAgentConfiguration({ repositoryId, workspaceId });

  const availableMicro = Math.max(wallet.balanceMicro - wallet.reservedMicro, 0);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-border/60 bg-card/40">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Cpu className="h-6 w-6 animate-pulse" />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-primary">Calibrando control de agentes</p>
          <p className="mt-2 text-sm text-muted-foreground">Cargando politicas AQELOR, herramientas y economia del espacio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Panel tone="danger" title="Fuente de configuracion no disponible"><p className="text-sm text-muted-foreground">{error}</p></Panel> : null}
      {warnings.length > 0 ? (
        <Panel tone="warning" title="Modo de respaldo activo">
          <div className="space-y-2">{warnings.slice(0, 4).map((w) => <p key={w} className="text-xs font-medium text-amber-100/80">{w}</p>)}</div>
        </Panel>
      ) : null}

      {/* A: Schedule Configuration */}
      <ScheduleConfigPanel
        entries={localConfig.scheduleEntries}
        mutations={mutations}
      />

      {/* B: Metric Cards — Wallet + Capacity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard
          title="Billetera AU" icon={Coins}
          accent="text-primary border-primary/20 bg-primary/10"
          primary={formatAu(availableMicro)}
          subtitle="Disponible para nuevas ejecuciones"
          details={[["Reservado", formatAu(wallet.reservedMicro)], ["Reembolsado", formatAu(wallet.lifetimeRefund)], ["Gastado", formatAu(wallet.lifetimeSpent)]]}
        />
        <MetricCard
          title="Capacidad de agentes" icon={Orbit}
          accent="text-cyan-300 border-cyan-500/20 bg-cyan-500/10"
          primary={`${summary.effectiveSimultaneousAgents}/${summary.availableAgents}`}
          subtitle="Simultaneos efectivos / totales"
          details={[["Tope del plan", String(summary.simultaneousAgents)], ["Espacio", summary.workspaceConcurrencyCap ? String(summary.workspaceConcurrencyCap) : "n/d"], ["Repositorio", summary.repositoryConcurrencyCap ? String(summary.repositoryConcurrencyCap) : "n/d"]]}
        />
      </div>

      {/* C: General Configuration */}
      <Panel title="Configuracion general" subtitle="Parametros globales del sistema de agentes para este repositorio.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr_auto]">
          <AgentCountStepper
            value={localConfig.maxParallelAgents}
            max={summary.simultaneousAgents}
            onChange={mutations.updateAgentCount}
          />
          <BranchSelectors
            baseBranch={localConfig.targetBranch}
            workBranch={localConfig.workBranchPrefix}
            repoFullName={repoFullName}
            onBaseChange={mutations.updateTargetBranch}
            onWorkChange={mutations.updateWorkBranchPrefix}
          />
          <ExecutionLimitsSection
            maxLines={localConfig.maxLinesChanged}
            maxFiles={localConfig.maxFilesPerRun}
            onLinesChange={mutations.updateMaxLines}
            onFilesChange={mutations.updateMaxFiles}
          />
        </div>
        {saving ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2 text-xs text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Guardando...</span>
          </motion.div>
        ) : null}
        {saveError ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-xs text-rose-400">{saveError}</motion.p>
        ) : null}
      </Panel>

      {/* D: Model Configuration */}
      <Panel title="Configuracion de modelos" subtitle="Selecciona el modelo de IA para cada rol del pipeline de agentes.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MODEL_ROLES.map((role) => (
            <ModelDropdown
              key={role.key}
              label={role.label}
              description={role.description}
              value={localConfig.models[role.key]}
              options={AVAILABLE_MODELS}
              onChange={(model) => mutations.updateModel(role.key, model)}
            />
          ))}
        </div>
      </Panel>

      {/* E: Interactive Tool Selector */}
      <Panel title="Herramientas de implementacion" subtitle="Selecciona las herramientas que el sistema usara. Configura los agentes asignados a cada una.">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {INTERACTIVE_TOOLS.map((tool, index) => (
            <ToolSelectCard
              key={tool.slug}
              tool={tool}
              index={index}
              selected={localConfig.enabledToolSlugs.has(tool.slug)}
              agentConfig={localConfig.toolAgents[tool.slug]}
              onToggle={(enabled) => mutations.toggleTool(tool.slug, enabled)}
              onAgentsChange={(assigned, simultaneous) => mutations.updateToolAgents(tool.slug, assigned, simultaneous)}
              maxAgents={summary.simultaneousAgents}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                   */
/* ────────────────────────────────────────────────────────────────── */

function AgentCountStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => Promise<void> }) {
  const clamp = (n: number) => Math.max(1, Math.min(n, max));
  return (
    <div className="space-y-3">
      <p className="text-[8px] font-black uppercase tracking-[0.24em] text-muted-foreground">Agentes simultaneos</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[40px] text-center text-2xl font-black tracking-tight text-foreground">{value}</span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">Maximo del plan: {max}</p>
    </div>
  );
}

function BranchSelectors({ baseBranch, workBranch, repoFullName, onBaseChange, onWorkChange }: {
  baseBranch: string;
  workBranch: string;
  repoFullName?: string;
  onBaseChange: (branch: string) => Promise<void>;
  onWorkChange: (prefix: string) => Promise<void>;
}) {
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [localWork, setLocalWork] = useState(workBranch);
  const workTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setLocalWork(workBranch); }, [workBranch]);

  useEffect(() => {
    let cancelled = false;
    const loadBranches = async () => {
      if (!repoFullName) return;
      const parts = repoFullName.split("/").filter(Boolean);
      if (parts.length !== 2) return;

      setBranchesLoading(true);
      try {
        const result = await desktopBridge.github.getBranches(parts[0], parts[1]);
        if (!cancelled) {
          const names = result.map((b: { name: string }) => b.name);
          if (!names.includes(baseBranch)) names.unshift(baseBranch);
          setBranches(names);
        }
      } catch {
        if (!cancelled) setBranches([baseBranch]);
      } finally {
        if (!cancelled) setBranchesLoading(false);
      }
    };
    void loadBranches();
    return () => { cancelled = true; };
  }, [repoFullName, baseBranch]);

  const handleWorkChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalWork(next);
    if (workTimer.current) clearTimeout(workTimer.current);
    workTimer.current = setTimeout(() => { if (next.trim()) onWorkChange(next.trim()); }, 400);
  }, [onWorkChange]);

  return (
    <div className="space-y-3">
      <p className="text-[8px] font-black uppercase tracking-[0.24em] text-muted-foreground">Ramas</p>
      <div className="grid grid-cols-2 items-end gap-4">
        <div>
          <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Rama base</p>
          <Dropdown
            value={baseBranch}
            onChange={(val: string) => onBaseChange(val)}
            options={
              branches.length > 0
                ? branches.map((name) => ({ value: name, label: name }))
                : [{ value: baseBranch, label: branchesLoading ? "Cargando ramas..." : baseBranch }]
            }
            placeholder={branchesLoading ? "Cargando ramas..." : "Selecciona rama"}
            disabled={branchesLoading}
            icon={<GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        </div>
        <div>
          <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Prefijo rama de cambios</p>
          <div className="relative">
            <GitBranch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={localWork}
              onChange={handleWorkChange}
              placeholder="autodev/"
              className="h-10 w-full min-w-[180px] rounded-xl border border-border/60 bg-background/40 pl-8 pr-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecutionLimitsSection({
  maxLines, maxFiles, onLinesChange, onFilesChange,
}: {
  maxLines: number; maxFiles: number;
  onLinesChange: (n: number) => Promise<void>;
  onFilesChange: (n: number) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[8px] font-black uppercase tracking-[0.24em] text-muted-foreground">Limites de ejecucion</p>
      <div className="grid grid-cols-2 gap-3">
        <DebouncedNumberInput label="Max lineas" value={maxLines} onChange={onLinesChange} min={50} max={10000} />
        <DebouncedNumberInput label="Max archivos" value={maxFiles} onChange={onFilesChange} min={1} max={200} />
      </div>
    </div>
  );
}

function DebouncedNumberInput({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (n: number) => Promise<void>; min: number; max: number;
}) {
  const [local, setLocal] = useState(String(value));
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setLocal(String(value)); }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocal(raw);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= min && n <= max) onChange(n);
    }, 400);
  }, [onChange, min, max]);

  return (
    <div>
      <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <input
        type="number"
        value={local}
        onChange={handleChange}
        min={min}
        max={max}
        className="h-9 w-full rounded-xl border border-border/60 bg-background/40 px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

function ModelDropdown({ label, description, value, options, onChange }: {
  label: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (model: string) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-background/30 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-auto pt-3">
        <Dropdown
          value={value}
          onChange={onChange}
          options={options}
          placeholder="Selecciona modelo"
        />
      </div>
    </div>
  );
}

function ToolSelectCard({
  tool, index, selected, agentConfig, onToggle, onAgentsChange, maxAgents,
}: {
  tool: typeof INTERACTIVE_TOOLS[number];
  index: number;
  selected: boolean;
  agentConfig?: { assigned: number; simultaneous: number };
  onToggle: (enabled: boolean) => void;
  onAgentsChange: (assigned: number, simultaneous: number) => void;
  maxAgents: number;
}) {
  const [Icon, accent] = TOOL_META[tool.category] ?? [Cpu, "text-primary border-primary/20 bg-primary/10"];
  const assigned = agentConfig?.assigned ?? 1;
  const simultaneous = agentConfig?.simultaneous ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => onToggle(!selected)}
      className={cn(
        "cursor-pointer rounded-[24px] border p-5 transition-all duration-300",
        selected
          ? "border-primary/50 bg-card/60"
          : "border-border/60 bg-background/30 opacity-60 hover:opacity-80",
      )}
      style={selected ? {
        boxShadow: "0 0 28px rgba(59,130,246,0.25), 0 0 8px rgba(59,130,246,0.15)",
      } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <motion.div
            animate={selected ? {
              boxShadow: "0 0 16px rgba(59,130,246,0.35)",
            } : { boxShadow: "0 0 0px transparent" }}
            transition={{ duration: 0.4 }}
            className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", accent)}
          >
            <Icon className="h-5 w-5" />
          </motion.div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary">{TOOL_META[tool.category]?.[2] ?? tool.category}</p>
            <h4 className="mt-1 text-base font-black tracking-tight text-foreground">{tool.label}</h4>
          </div>
        </div>
        <motion.div
          animate={selected ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0.4 }}
          className={cn(
            "mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black",
            selected
              ? "border-primary/40 bg-primary/20 text-primary"
              : "border-border/60 bg-background/30 text-muted-foreground",
          )}
        >
          {selected ? "ON" : ""}
        </motion.div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>

      <AnimatePresence>
        {selected ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-4">
              <div>
                <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Agentes asignados</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAgentsChange(Math.max(1, assigned - 1), Math.min(simultaneous, Math.max(1, assigned - 1)))}
                    disabled={assigned <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground transition-colors hover:bg-primary/10 disabled:opacity-30"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="min-w-[24px] text-center text-lg font-black text-foreground">{assigned}</span>
                  <button
                    type="button"
                    onClick={() => onAgentsChange(Math.min(maxAgents, assigned + 1), simultaneous)}
                    disabled={assigned >= maxAgents}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground transition-colors hover:bg-primary/10 disabled:opacity-30"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Simultaneos</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAgentsChange(assigned, Math.max(1, simultaneous - 1))}
                    disabled={simultaneous <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground transition-colors hover:bg-primary/10 disabled:opacity-30"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="min-w-[24px] text-center text-lg font-black text-foreground">{simultaneous}</span>
                  <button
                    type="button"
                    onClick={() => onAgentsChange(assigned, Math.min(assigned, simultaneous + 1))}
                    disabled={simultaneous >= assigned}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground transition-colors hover:bg-primary/10 disabled:opacity-30"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Schedule Configuration Panel                                     */
/* ────────────────────────────────────────────────────────────────── */

function ScheduleConfigPanel({
  entries,
  mutations,
}: {
  entries: ScheduleEntry[];
  mutations: {
    addScheduleEntry: () => void;
    removeScheduleEntry: (id: string) => void;
    updateScheduleEntry: (id: string, patch: Partial<ScheduleEntry>) => void;
    toggleScheduleEntryEnabled: (id: string) => void;
    toggleScheduleEntryDay: (id: string, day: string) => void;
  };
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const activeCount = entries.filter((e) => e.enabled).length;

  return (
    <Panel
      title="Horarios de ejecucion automatica"
      subtitle={`Define los horarios en que AQELOR ejecutara los agentes de manera autonoma. ${activeCount} de ${entries.length} activos.`}
    >
      {/* Header actions */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 text-primary" />
          <span>{activeCount > 0 ? `${activeCount} horario${activeCount > 1 ? "s" : ""} activo${activeCount > 1 ? "s" : ""}` : "Sin horarios activos"}</span>
        </div>
        <button
          type="button"
          onClick={mutations.addScheduleEntry}
          className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/20 hover:border-primary/50"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar horario
        </button>
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-background/30 py-12 text-center">
          <Clock className="mb-3 h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Sin horarios configurados
          </p>
          <p className="mt-1 text-xs text-muted-foreground opacity-60">
            Agrega un horario para automatizar la ejecucion de agentes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const isEditing = editingId === entry.id;
            const daysLabel = entry.days.includes("*")
              ? "Diario"
              : entry.days.map((d) => DAYS_OF_WEEK.find((dw) => dw.cron === d)?.label ?? d).join(", ");

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-all duration-300",
                  isEditing
                    ? "border-primary/40 bg-card/60 shadow-lg shadow-primary/5"
                    : entry.enabled
                      ? "border-border/60 bg-card/40 hover:border-border"
                      : "border-border/40 bg-background/20 opacity-60",
                )}
              >
                {/* Entry header row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => mutations.toggleScheduleEntryEnabled(entry.id)}
                    className={cn(
                      "relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-all duration-300",
                      entry.enabled ? "bg-primary" : "bg-muted-foreground/20",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white transition-all duration-300",
                        entry.enabled ? "translate-x-[22px]" : "translate-x-1",
                      )}
                    />
                  </button>

                  {/* Time + info */}
                  <div
                    className="flex flex-1 cursor-pointer items-center gap-3"
                    onClick={() => setEditingId(isEditing ? null : entry.id)}
                  >
                    <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5">
                      <span className="text-sm font-black tabular-nums text-primary">
                        {formatTime12h(entry.hour, entry.minute)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {entry.label || formatTime12h(entry.hour, entry.minute)}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        {daysLabel}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : entry.id)}
                      className={cn(
                        "rounded-xl p-2 transition-all",
                        isEditing
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mutations.removeScheduleEntry(entry.id)}
                      className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded editor */}
                <AnimatePresence>
                  {isEditing ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-5 border-t border-border/40 px-5 pb-5 pt-4">
                        {/* Label */}
                        <div>
                          <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                            Etiqueta (opcional)
                          </p>
                          <input
                            type="text"
                            value={entry.label}
                            onChange={(e) => mutations.updateScheduleEntry(entry.id, { label: e.target.value })}
                            placeholder="Ej: Madrugada, Medio dia, Noche..."
                            className="h-9 w-full max-w-sm rounded-xl border border-border/60 bg-background/40 px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                          />
                        </div>

                        {/* Time picker */}
                        <div>
                          <p className="mb-2 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                            Hora de ejecucion
                          </p>
                          <div className="flex flex-wrap items-center gap-4">
                            {/* Hour stepper */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => mutations.updateScheduleEntry(entry.id, { hour: (entry.hour - 1 + 24) % 24 })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <div className="flex h-11 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-inner">
                                <span className="text-lg font-black tabular-nums text-foreground">
                                  {entry.hour.toString().padStart(2, "0")}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => mutations.updateScheduleEntry(entry.id, { hour: (entry.hour + 1) % 24 })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <span className="text-xl font-black text-muted-foreground/30">:</span>

                            {/* Minute stepper */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => mutations.updateScheduleEntry(entry.id, { minute: (entry.minute - 15 + 60) % 60 })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <div className="flex h-11 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-inner">
                                <span className="text-lg font-black tabular-nums text-foreground">
                                  {entry.minute.toString().padStart(2, "0")}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => mutations.updateScheduleEntry(entry.id, { minute: (entry.minute + 15) % 60 })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Quick presets */}
                            <div className="flex flex-wrap gap-1.5">
                              {QUICK_TIMES.map((qt) => (
                                <button
                                  key={qt.hour}
                                  type="button"
                                  onClick={() => mutations.updateScheduleEntry(entry.id, { hour: qt.hour, minute: 0 })}
                                  className={cn(
                                    "rounded-lg border px-2 py-1.5 text-[8px] font-black uppercase tracking-tight transition-all",
                                    entry.hour === qt.hour && entry.minute === 0
                                      ? "border-primary/40 bg-primary/10 text-primary"
                                      : "border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground",
                                  )}
                                >
                                  {qt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Day selector */}
                        <div>
                          <p className="mb-2 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                            Dias de ejecucion
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => mutations.toggleScheduleEntryDay(entry.id, "*")}
                              className={cn(
                                "rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all",
                                entry.days.includes("*")
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border/50 bg-background/30 text-muted-foreground hover:border-border",
                              )}
                            >
                              Diario
                            </button>
                            {DAYS_OF_WEEK.map((day) => (
                              <button
                                key={day.cron}
                                type="button"
                                onClick={() => mutations.toggleScheduleEntryDay(entry.id, day.cron)}
                                title={day.name}
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-black transition-all",
                                  !entry.days.includes("*") && entry.days.includes(day.cron)
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-border/50 bg-background/30 text-muted-foreground hover:border-border",
                                )}
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Shared sub-components (kept from original)                       */
/* ────────────────────────────────────────────────────────────────── */

function Panel({ title, subtitle, tone = "default", children }: { title: string; subtitle?: string; tone?: "default" | "warning" | "danger"; children: React.ReactNode }) {
  const toneClasses = tone === "warning" ? "border-amber-500/20 bg-amber-500/5" : tone === "danger" ? "border-rose-500/20 bg-rose-500/5" : "border-border/60 bg-card/40";
  return (
    <div className={cn("rounded-[28px] border p-5", toneClasses)}>
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-primary">{title}</p>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ title, icon: Icon, accent, primary, subtitle, details }: {
  title: string; icon: LucideIcon; accent: string; primary: string; subtitle: string; details: Array<[string, string]>;
}) {
  return (
    <div className="rounded-[26px] border border-border/60 bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
      </div>
      <div className="mt-6">
        <p className="text-3xl font-black tracking-tight text-foreground">{primary}</p>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {details.map(([label, value]) => <MiniMetric key={label} label={label} value={value} />)}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5">
      <p className="text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground">{value}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                          */
/* ────────────────────────────────────────────────────────────────── */

function formatAu(micro: number): string {
  return `${(micro / 1000).toFixed(2)} AU`;
}

function pretty(value: string): string {
  const normalized = value.trim().toLowerCase();
  const result = normalized.split(/[_\s-]+/).map((part) => WORDS[part] ?? part).join(" ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function planLabel(value: string): string {
  return value === "free" ? "Gratis" : value === "starter" ? "Inicial" : value === "pro" ? "Pro" : value === "enterprise" ? "Empresarial" : pretty(value);
}
