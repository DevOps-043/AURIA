import React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Clock3,
  FileCode2,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  TerminalSquare,
} from "lucide-react";
import { cn } from "../../../shared/lib/utils";
import { MarkdownContent } from "../../../shared/components/markdown-content";
import {
  getAutodevModelLabel,
  type AutodevConsoleEntry,
  type AutodevLiveFileActivity,
  type AutodevRuntimeSnapshot,
  type AutodevStage,
  type AutodevStageStatus,
} from "../../../../shared/autodev-types";

interface AutonomousRunPanelProps {
  snapshot: AutodevRuntimeSnapshot;
  loading: boolean;
  error: string | null;
  onRunNow: () => Promise<void>;
  onAbortRun: () => Promise<void>;
}

const TOOL_LABELS: Record<string, string> = {
  knowledge_intake: "Carga de conocimiento",
  autonomous_docs: "Documentacion",
  research: "Investigacion",
  quality: "Calidad",
  improvement: "Mejora tecnica",
  qa_correction: "Correccion QA",
  security: "Seguridad",
  optimization: "Optimizacion",
  spaghetti_cleanup: "Limpieza profunda",
  new_implementation: "Nueva implementacion",
};

export const AutonomousRunPanel: React.FC<AutonomousRunPanelProps> = ({
  snapshot,
  loading,
  error,
  onRunNow,
  onAbortRun,
}) => {
  const { config, state } = snapshot;
  const tools = config.enabledToolSlugs.map((slug) => TOOL_LABELS[slug] ?? slug);

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[26px] border border-border/50 bg-card/40"
            />
          ))}
        </div>
        <div className="h-[520px] animate-pulse rounded-[30px] border border-border/50 bg-card/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error || state.lastError ? (
        <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/5 px-5 py-4 text-sm text-rose-200">
          {error ?? state.lastError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard
          icon={Sparkles}
          title="Estado del flujo"
          value={
            state.running
              ? "En ejecucion"
              : state.status === "completed"
                ? "Ultimo run completado"
                : "Listo para iniciar"
          }
          detail={
            state.triggerSource === "scheduled"
              ? `Trigger: ${state.scheduleLabel ?? "Horario programado"}`
              : "Trigger manual disponible"
          }
          accent="text-primary border-primary/20 bg-primary/10"
        />
        <MetricCard
          icon={Bot}
          title="Agentes activos"
          value={`${config.maxParallelAgents} simultaneos`}
          detail={`${tools.length} herramientas habilitadas`}
          accent="text-cyan-300 border-cyan-500/20 bg-cyan-500/10"
        />
        <MetricCard
          icon={FileCode2}
          title="Limites del run"
          value={`${config.maxFilesPerRun} archivos`}
          detail={`${config.maxLinesChanged} lineas maximas`}
          accent="text-emerald-300 border-emerald-500/20 bg-emerald-500/10"
        />
        <MetricCard
          icon={Clock3}
          title="Horario principal"
          value={formatPrimarySchedule(config)}
          detail={state.startedAt ? `Ultimo inicio: ${formatDateTime(state.startedAt)}` : "Sin ejecuciones recientes"}
          accent="text-amber-300 border-amber-500/20 bg-amber-500/10"
        />
      </div>

      <div className="rounded-[30px] border border-border/60 bg-card/40 p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Panel de ejecucion autonoma
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Este panel concentra el flujo operativo completo: trigger manual o programado,
              fases del pipeline, consola auditada y archivos intervenidos en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onRunNow()}
              disabled={state.running}
              className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-primary transition-all hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" />
              Iniciar ahora
            </button>
            <button
              type="button"
              onClick={() => void onAbortRun()}
              disabled={!state.running}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/50 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Square className="h-3.5 w-3.5" />
              Detener
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tools.length > 0 ? (
            tools.map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground"
              >
                {tool}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Sin herramientas activas
            </span>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
          {state.stages.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              active={state.currentStageId === stage.id}
            />
          ))}
        </div>
      </div>

      <div className="grid min-h-[560px] grid-cols-1 gap-6 xl:grid-cols-2">
        <ConsoleWindow entries={state.console} />
        <LiveFilesWindow files={state.liveFiles} />
      </div>

      <div className="rounded-[30px] border border-border/60 bg-card/40 p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Ultimo informe generado
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              El registro de inteligencia debe mostrar objetivo, archivos modificados, lineas,
              validaciones de QA y resultado final del run.
            </p>
          </div>
        </div>

        {state.report ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <ReportMetric label="Objetivo" value={state.report.objective} />
              <ReportMetric label="Archivos modificados" value={String(state.report.filesModified)} />
              <ReportMetric label="Lineas modificadas" value={String(state.report.linesModified)} />
              <ReportMetric label="Archivos leidos" value={String(state.report.filesRead)} />
            </div>

            <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                Resultado
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {state.report.resultSummary}
              </p>
            </div>

            {state.report.documentsUsed.length > 0 ? (
              <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  Documentos usados
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.report.documentsUsed.map((document) => (
                    <span
                      key={document}
                      className="rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      {document}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-border/50 bg-background/20 px-5 py-10 text-center">
            <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
              Aun no hay informe consolidado
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="rounded-[26px] border border-border/60 bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
          {title}
        </p>
      </div>
      <p className="mt-6 text-2xl font-black tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function StageCard({
  stage,
  active,
}: {
  stage: AutodevStage;
  active: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-[24px] border p-4 transition-all",
        stage.status === "completed"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : active
            ? "border-primary/30 bg-primary/10 shadow-lg shadow-primary/10"
            : stage.status === "blocked"
              ? "border-rose-500/20 bg-rose-500/5"
              : "border-border/60 bg-background/30",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[8px] font-black uppercase tracking-[0.22em] text-primary">
          {labelForStageStatus(stage.status)}
        </span>
        <span className="rounded-full border border-border/50 bg-background/50 px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {stage.parallelAgents} ag.
        </span>
      </div>
      <h4 className="mt-4 text-sm font-black tracking-tight text-foreground">
        {stage.title}
      </h4>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {stage.description}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
        <span className="text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground">
          {getAutodevModelLabel(stage.model)}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {stage.startedAt ? formatDateTime(stage.startedAt) : "Pendiente"}
        </span>
      </div>
    </motion.div>
  );
}

function ConsoleWindow({ entries }: { entries: AutodevConsoleEntry[] }) {
  return (
    <div className="flex h-150 flex-col overflow-hidden rounded-[30px] border border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <TerminalSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Consola auditada
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Eventos del flujo, comandos relevantes y resultados de cada fase.
            </p>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="min-w-0 overflow-hidden rounded-[22px] border border-border/50 bg-background/30 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em]",
                  consoleTone(entry.level),
                )}>
                  {labelForConsoleLevel(entry.level)}
                </span>
                <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDateTime(entry.timestamp)}
                </span>
              </div>
              <p className="mt-3 break-words text-[11px] font-black uppercase tracking-[0.16em] text-foreground">
                {entry.title}
              </p>
              <MarkdownContent text={entry.content} />
              {entry.command ? (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-border/50 bg-background/60 px-3 py-2 font-mono text-[11px] break-all text-primary">
                  {entry.command}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyWindow
            icon={TerminalSquare}
            title="Consola esperando trigger"
            description="Cuando el usuario pulse Iniciar ahora o se active un horario, la consola empezara a registrar el flujo completo."
          />
        )}
      </div>
    </div>
  );
}

function LiveFilesWindow({ files }: { files: AutodevLiveFileActivity[] }) {
  return (
    <div className="flex h-150 flex-col overflow-hidden rounded-[30px] border border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <Search className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Archivos en vivo
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rutas activas, lineas tocadas y fragmentos del cambio en curso.
            </p>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {files.length > 0 ? (
          files.map((file) => (
            <div
              key={file.id}
              className="rounded-[22px] border border-border/50 bg-background/30 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn(
                  "rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em]",
                  liveFileTone(file.status),
                )}>
                  {labelForLiveFileStatus(file.status)}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDateTime(file.updatedAt)}
                </span>
              </div>
              <p className="mt-3 break-all text-[11px] font-black uppercase tracking-[0.12em] text-foreground">
                {file.path}
              </p>
              <MarkdownContent text={file.summary} />
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {file.agent}
                </span>
                <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {file.lineRange}
                </span>
                <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {file.linesTouched} lineas
                </span>
              </div>
              <pre className="custom-scrollbar mt-3 max-h-48 overflow-auto rounded-2xl border border-border/50 bg-background/70 p-3 text-[11px] leading-relaxed text-foreground/85">
                {file.excerpt}
              </pre>
            </div>
          ))
        ) : (
          <EmptyWindow
            icon={FileCode2}
            title="Sin archivos activos"
            description="El stream de archivos se activa cuando la orquestacion entra en lectura, escritura, revision o QA."
          />
        )}
      </div>
    </div>
  );
}

function ReportMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/50 bg-background/30 px-4 py-4">
      <p className="text-[8px] font-black uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyWindow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border/50 bg-background/20 px-6 text-center">
      <Icon className="mb-4 h-8 w-8 text-muted-foreground/50" />
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function labelForStageStatus(status: AutodevStageStatus): string {
  switch (status) {
    case "running":
      return "En curso";
    case "completed":
      return "Completada";
    case "blocked":
      return "Bloqueada";
    default:
      return "Pendiente";
  }
}

function labelForConsoleLevel(level: AutodevConsoleEntry["level"]): string {
  switch (level) {
    case "command":
      return "Comando";
    case "phase":
      return "Fase";
    case "result":
      return "Resultado";
    case "research":
      return "Research";
    case "warning":
      return "Advertencia";
    case "error":
      return "Error";
    default:
      return "Sistema";
  }
}

function labelForLiveFileStatus(status: AutodevLiveFileActivity["status"]): string {
  switch (status) {
    case "indexing":
      return "Indexando";
    case "reading":
      return "Leyendo";
    case "writing":
      return "Escribiendo";
    case "compiling":
      return "Compilando";
    case "reviewing":
      return "Revisando";
    case "testing":
      return "Probando";
    default:
      return "Listo";
  }
}

function consoleTone(level: AutodevConsoleEntry["level"]): string {
  switch (level) {
    case "command":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "phase":
      return "border-primary/20 bg-primary/10 text-primary";
    case "result":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "research":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
    case "warning":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "error":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    default:
      return "border-border/50 bg-background/50 text-muted-foreground";
  }
}

function liveFileTone(status: AutodevLiveFileActivity["status"]): string {
  switch (status) {
    case "writing":
      return "border-primary/20 bg-primary/10 text-primary";
    case "compiling":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
    case "reviewing":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "testing":
      return "border-violet-500/20 bg-violet-500/10 text-violet-300";
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-border/50 bg-background/50 text-muted-foreground";
  }
}

function formatPrimarySchedule(snapshot: AutodevRuntimeSnapshot["config"]): string {
  const primary = snapshot.scheduleEntries.find((entry) => entry.enabled) ?? snapshot.scheduleEntries[0];
  if (!primary) {
    return "Sin horario";
  }
  return `${primary.label || "Horario"} ${primary.hour.toString().padStart(2, "0")}:${primary.minute.toString().padStart(2, "0")}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
