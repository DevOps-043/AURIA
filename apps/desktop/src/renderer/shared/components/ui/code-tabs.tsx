import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, FileCode2, GitCommitHorizontal, Loader2, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { RepositoryDiffFile, RepositoryDiffStatus, RepositoryDiffSummary } from '@/features/repository/components/repository-diff';

export interface CodeTabDocument {
  name: string;
  path: string;
  content: string;
  language: string;
  size: number;
  sha: string;
  htmlUrl?: string | null;
}

interface CodeTabsProps {
  files: CodeTabDocument[];
  activePath: string | null;
  repoFullName: string;
  branch: string;
  baseBranch: string;
  loadingPath?: string | null;
  error?: string | null;
  diffSummary: RepositoryDiffSummary;
  diffLoading?: boolean;
  diffError?: string | null;
  fileDiffs: Record<string, RepositoryDiffFile>;
  onActiveChange: (path: string) => void;
  onClose: (path: string) => void;
}

export const CodeTabs: React.FC<CodeTabsProps> = ({
  files,
  activePath,
  repoFullName,
  branch,
  baseBranch,
  loadingPath,
  error,
  diffSummary,
  diffLoading = false,
  diffError = null,
  fileDiffs,
  onActiveChange,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);
  const activeFile = files.find((file) => file.path === activePath) ?? files[0] ?? null;
  const activeDiff = activeFile ? fileDiffs[activeFile.path] : undefined;
  const lines = React.useMemo(
    () => (activeFile ? activeFile.content.replace(/\r\n/g, '\n').split('\n') : []),
    [activeFile],
  );
  const changedLineSet = React.useMemo(
    () => new Set(activeDiff?.changedLines ?? []),
    [activeDiff],
  );

  const handleCopy = async () => {
    if (!activeFile) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-[#0a0d13] shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-border/40 bg-white/[0.03] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.3em] text-primary">
              Pestanas de codigo
            </p>
            <p className="truncate text-[10px] font-medium text-muted-foreground">
              {repoFullName} / {branch}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {diffLoading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.25em] text-amber-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              Diferencias
            </div>
          ) : branch !== baseBranch ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.25em] text-primary">
              <GitCommitHorizontal className="h-3 w-3" />
              {diffSummary.files.length} archivos vs {baseBranch}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground">
              Rama base
            </div>
          )}

          {loadingPath && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.25em] text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!activeFile}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="border-b border-border/40 bg-white/[0.02]">
        <div className="flex min-w-0 gap-1 overflow-x-auto px-3 py-2 custom-scrollbar">
          {files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Abre un archivo desde el explorador
            </div>
          ) : (
            files.map((file) => {
              const active = file.path === activeFile?.path;
              const fileDiff = fileDiffs[file.path];
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => onActiveChange(file.path)}
                  className={cn(
                    'group relative flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all',
                    active
                      ? 'border-primary/30 bg-primary/10 text-foreground'
                      : fileDiff
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-foreground hover:border-emerald-400/40'
                      : 'border-transparent bg-background/50 text-muted-foreground hover:border-border/60 hover:text-foreground',
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="active-code-tab"
                      className="absolute inset-0 rounded-xl border border-primary/20"
                    />
                  )}

                  <span className="relative z-10 max-w-[180px] truncate text-[10px] font-bold tracking-tight">
                    {file.name}
                  </span>
                  {fileDiff && (
                    <span
                      className={cn(
                        'relative z-10 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.18em]',
                        getDiffStatusChipClass(fileDiff.status),
                      )}
                    >
                      {formatDiffStatus(fileDiff.status)}
                    </span>
                  )}
                  <span className="relative z-10 rounded-full border border-border/50 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {file.language}
                  </span>
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose(file.path);
                    }}
                    className="relative z-10 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-md rounded-[1.5rem] border border-red-500/10 bg-red-500/5 px-6 py-8">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                Error del editor
              </p>
              <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
                {error}
              </p>
            </div>
          </div>
        ) : !activeFile ? (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-md rounded-[1.75rem] border border-dashed border-border/40 bg-background/30 px-6 py-10">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.3em] text-foreground">
                Visor de codigo listo
              </p>
              <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
                Selecciona un archivo en el panel izquierdo para abrirlo aqui.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFile.path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-foreground">
                    {activeFile.path}
                  </p>
                  <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {activeFile.language} | {formatSize(activeFile.size)} | {lines.length} lineas
                  </p>
                </div>

                {activeDiff && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em]',
                        getDiffStatusChipClass(activeDiff.status),
                      )}
                    >
                      {formatDiffStatus(activeDiff.status)}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em] text-emerald-300">
                      +{activeDiff.additions}
                    </span>
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em] text-red-300">
                      -{activeDiff.deletions}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4 custom-scrollbar [scrollbar-gutter:stable]">
                <div className="min-w-max rounded-[1.25rem] border border-border/40 bg-white/[0.02]">
                  <div className="border-b border-border/30 px-4 py-2 text-[10px] font-medium text-muted-foreground">
                    // {repoFullName} :: {activeFile.path}
                  </div>
                  {diffError && (
                    <div className="border-b border-red-500/10 bg-red-500/5 px-4 py-2 text-[9px] font-bold text-red-300">
                      {diffError}
                    </div>
                  )}
                  {activeDiff && (
                    <div className="border-b border-emerald-500/10 bg-emerald-500/5 px-4 py-2 text-[9px] font-bold text-emerald-200">
                      Las lineas resaltadas corresponden a cambios en {branch} frente a {baseBranch}.
                    </div>
                  )}
                  <div className="px-0 py-3 font-mono text-[12px] leading-6">
                    {lines.map((line, index) => (
                      <div
                        key={`${activeFile.sha}-${index}`}
                        className={cn(
                          'grid grid-cols-[56px_minmax(0,1fr)] gap-4 px-4 hover:bg-white/[0.03]',
                          changedLineSet.has(index + 1) && 'border-l-2 border-emerald-400 bg-emerald-500/[0.08]',
                        )}
                      >
                        <span
                          className={cn(
                            'select-none text-right text-[10px] text-muted-foreground/70',
                            changedLineSet.has(index + 1) && 'text-emerald-300',
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="whitespace-pre text-foreground/90 [tab-size:2]">
                          {line || ' '}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

function formatDiffStatus(status: RepositoryDiffStatus): string {
  switch (status) {
    case 'added':
      return 'agregado';
    case 'modified':
      return 'editado';
    case 'removed':
      return 'eliminado';
    case 'renamed':
      return 'renombrado';
    case 'copied':
      return 'copiado';
    case 'changed':
      return 'cambiado';
    default:
      return status;
  }
}

function getDiffStatusChipClass(status: RepositoryDiffStatus): string {
  switch (status) {
    case 'added':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'modified':
    case 'changed':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-300';
    case 'removed':
      return 'border-red-500/20 bg-red-500/10 text-red-300';
    case 'renamed':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    case 'copied':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-300';
    default:
      return 'border-border/50 bg-background/60 text-muted-foreground';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
