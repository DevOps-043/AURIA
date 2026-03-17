import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Braces,
  Bug,
  Cable,
  ChevronDown,
  Coins,
  Cpu,
  FileText,
  Gauge,
  GitBranch,
  Loader2,
  Minus,
  Orbit,
  Plus,
  Rocket,
  Shield,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { desktopBridge } from "@/shared/api/desktop-bridge";
import { Dropdown } from "@/shared/components/ui/dropdown";
import { useAgentConfiguration } from "../hooks/use-agent-configuration";

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
  // Gemini (Vertex AI / API directa)
  { value: "gemini-3.1-pro-preview-customtools", label: "Gemini 3.1 Pro" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  // Anthropic (Vertex AI Model Garden)
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  // Mistral (Vertex AI Model Garden)
  { value: "mistral-large-latest", label: "Mistral Large" },
  { value: "mistral-medium-latest", label: "Mistral Medium" },
  { value: "codestral-latest", label: "Codestral" },
  { value: "mistral-small-latest", label: "Mistral Small" },
  // GPT (Vertex AI Model Garden)
  { value: "gpt-oss-120b", label: "GPT OSS 120B" },
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

      {/* A: Metric Cards — Wallet + Capacity */}
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

      {/* B: General Configuration */}
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

      {/* C: Model Configuration */}
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

      {/* D: Interactive Tool Selector */}
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
