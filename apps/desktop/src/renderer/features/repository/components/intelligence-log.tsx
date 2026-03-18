import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  FileText,
  FlaskConical,
  History,
  ListChecks,
  RefreshCw,
  Search,
  Target,
  XCircle,
} from "lucide-react";
import { cn } from "../../../shared/lib/utils";
import { MarkdownContent } from "../../../shared/components/markdown-content";
import type { Mission } from "../hooks/use-missions";
import type {
  AutodevHistoryEntry,
  AutodevQaCheck,
  AutodevRuntimeSnapshot,
} from "../../../../shared/autodev-types";

interface IntelligenceLogProps {
  snapshot: AutodevRuntimeSnapshot;
  missions: Mission[];
  missionsLoading: boolean;
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

export const IntelligenceLog: React.FC<IntelligenceLogProps> = ({
  snapshot,
  missions,
  missionsLoading,
}) => {
  const report = snapshot.state.report;
  const hasHistory = snapshot.history.length > 0;

  return (
    <div className="space-y-6">
      {report ? (
        <div className="rounded-[30px] border border-border/60 bg-card/40 p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                Informe mas reciente
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Evidencia consolidada del ultimo run autonomo ejecutado por el sistema.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <ReportMetric label="Objetivo" value={report.objective} />
            <ReportMetric label="Archivos" value={String(report.filesModified)} />
            <ReportMetric label="Lineas" value={String(report.linesModified)} />
            <ReportMetric label="Leidos" value={String(report.filesRead)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4">
              <SectionCard
                icon={Target}
                title="Resultado"
                content={report.resultSummary}
              />

              <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-cyan-300" />
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                    Queries de investigacion
                  </p>
                </div>
                <div className="space-y-2">
                  {report.researchQueries.map((query) => (
                    <div
                      key={query}
                      className="rounded-2xl border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground/85"
                    >
                      {query}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-emerald-300" />
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                    Validaciones ejecutadas
                  </p>
                </div>
                <div className="space-y-2">
                  {report.validations.map((validation) => (
                    <div
                      key={validation}
                      className="rounded-2xl border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground/85"
                    >
                      {validation}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                    Archivos modificados
                  </p>
                </div>
                <div className="space-y-2">
                  {report.files.map((file) => (
                    <div
                      key={file.path}
                      className="rounded-2xl border border-border/50 bg-background/50 px-3 py-3"
                    >
                      <p className="break-all text-[11px] font-black uppercase tracking-[0.12em] text-foreground">
                        {file.path}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {file.action}
                      </p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        {file.lines} lineas
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-amber-300" />
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                    QA ejecutado
                  </p>
                </div>
                <div className="space-y-2">
                  {report.qaChecks.map((check) => (
                    <QaCheckRow key={check.id} check={check} />
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-violet-300" />
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                    Herramientas usadas
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.selectedTools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground"
                    >
                      {TOOL_LABELS[tool] ?? tool}
                    </span>
                  ))}
                </div>
              </div>

              {report.documentsUsed.length > 0 ? (
                <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      Documentos usados
                    </p>
                  </div>
                  <div className="space-y-2">
                    {report.documentsUsed.map((document) => (
                      <div
                        key={document}
                        className="rounded-2xl border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground/85"
                      >
                        {document}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {report.warnings.length > 0 ? (
                <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-amber-300" />
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      Advertencias
                    </p>
                  </div>
                  <div className="space-y-2">
                    {report.warnings.map((warning) => (
                      <div
                        key={warning}
                        className="rounded-2xl border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground/85"
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[30px] border border-border/60 bg-card/40 p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Historial de ejecuciones
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Runs autonomos recientes con objetivo, trigger y alcance ejecutado.
            </p>
          </div>
        </div>

        {hasHistory ? (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {snapshot.history.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="Sin runs registrados"
            description="Los informes apareceran aqui despues de completar la primera ejecucion autonoma."
          />
        )}
      </div>

      <div className="rounded-[30px] border border-border/60 bg-card/40 p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Misiones persistidas
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Contexto operativo adicional almacenado en la capa de datos actual.
            </p>
          </div>
        </div>

        {missionsLoading ? (
          <div className="flex justify-center p-10">
            <RefreshCw className="h-6 w-6 animate-spin text-primary opacity-40" />
          </div>
        ) : missions.length > 0 ? (
          <div className="space-y-3">
            {missions.map((mission) => (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-[24px] border border-border/50 bg-background/30 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground">
                      {mission.title}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {mission.summary || "Sin resumen disponible."}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em]",
                    missionTone(mission.status),
                  )}>
                    {mission.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="Sin misiones almacenadas"
            description="La instancia actual todavia no devuelve misiones persistidas para este repositorio."
          />
        )}
      </div>
    </div>
  );
};

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border/50 bg-background/30 px-4 py-4">
      <p className="text-[8px] font-black uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  content,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/50 bg-background/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
          {title}
        </p>
      </div>
      <MarkdownContent text={content} className="space-y-1.5" />
    </div>
  );
}

function QaCheckRow({ check }: { check: AutodevQaCheck }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 px-3 py-3">
      <div className="flex items-center gap-2">
        {check.result === "passed" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <XCircle className="h-4 w-4 text-rose-300" />
        )}
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground">
          {check.label}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{check.details}</p>
    </div>
  );
}

function HistoryRow({ entry }: { entry: AutodevHistoryEntry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-border/50 bg-background/30 p-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-foreground">
            {entry.objective}
          </p>
          <p className="text-sm text-muted-foreground">{entry.summary}</p>
        </div>
        <span className={cn(
          "rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em]",
          historyTone(entry.status),
        )}>
          {entry.status}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <MiniMetric label="Trigger" value={entry.triggerSource === "scheduled" ? "Horario" : "Manual"} />
        <MiniMetric label="Archivos" value={String(entry.filesModified)} />
        <MiniMetric label="Lineas" value={String(entry.linesModified)} />
        <MiniMetric label="Finalizo" value={formatDateTime(entry.completedAt)} />
      </div>
    </motion.div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 px-3 py-3">
      <p className="text-[8px] font-black uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border/50 bg-background/20 px-6 text-center">
      <Icon className="mb-4 h-8 w-8 text-muted-foreground/50" />
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function historyTone(status: AutodevHistoryEntry["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "aborted":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    default:
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  }
}

function missionTone(status: Mission["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "blocked":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    case "executing":
    case "validating":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    default:
      return "border-border/50 bg-background/50 text-muted-foreground";
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
