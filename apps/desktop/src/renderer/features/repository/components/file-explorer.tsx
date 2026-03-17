import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Binary,
  Braces,
  ChevronDown,
  ChevronRight,
  Database,
  File,
  FileCode2,
  FileJson2,
  FileText,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderTree,
  Image,
  Link2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { desktopBridge } from '@/shared/api/desktop-bridge';
import { cn } from '@/shared/lib/utils';
import type { RepositoryDiffFile, RepositoryDiffStatus, RepositoryDiffSummary } from './repository-diff';
import type {
  GitHubRepoContentEntry,
  GitHubRepoTreeEntry,
} from '../../../../shared/github-types';

interface FileExplorerProps {
  provider: string;
  repoFullName: string;
  branch: string;
  baseBranch: string;
  selectedPath?: string | null;
  fileDiffs?: Record<string, RepositoryDiffFile>;
  diffSummary?: RepositoryDiffSummary | null;
  diffLoading?: boolean;
  diffError?: string | null;
  onFileSelect?: (path: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  provider,
  repoFullName,
  branch,
  baseBranch,
  selectedPath = null,
  fileDiffs = {},
  diffSummary = null,
  diffLoading = false,
  diffError = null,
  onFileSelect,
}) => {
  const [entries, setEntries] = useState<GitHubRepoContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [treeIndex, setTreeIndex] = useState<GitHubRepoTreeEntry[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const repoIdentity = parseRepoIdentity(repoFullName);
  const isGitHubProvider = provider.toLowerCase() === 'github';
  const normalizedQuery = query.trim().toLowerCase();
  const rootLabel = repoIdentity?.repo ?? repoFullName;
  const directoryDiffCounts = useMemo(
    () => buildDirectoryDiffCounts(fileDiffs),
    [fileDiffs],
  );

  const searchResults = useMemo(() => {
    if (normalizedQuery.length < 2 || !treeIndex) {
      return [];
    }

    return treeIndex
      .filter((entry) => entry.type === 'blob' && entry.path.toLowerCase().includes(normalizedQuery))
      .slice(0, 150);
  }, [normalizedQuery, treeIndex]);

  const loadRoot = async () => {
    if (!isGitHubProvider) {
      setEntries([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!repoIdentity) {
      setEntries([]);
      setError('Identificador de repositorio invalido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await desktopBridge.github.listContents(
        repoIdentity.owner,
        repoIdentity.repo,
        '',
        branch,
      );

      setEntries(sortEntries(result));
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar el arbol del repositorio'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSearchIndex = async () => {
    if (!repoIdentity || !isGitHubProvider || treeIndex || searchLoading) {
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const result = await desktopBridge.github.listTree(
        repoIdentity.owner,
        repoIdentity.repo,
        branch,
      );
      setTreeIndex(result);
    } catch (err) {
      setSearchError(getErrorMessage(err, 'No se pudo crear el indice de busqueda'));
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    void loadRoot();
  }, [provider, repoFullName, branch]);

  useEffect(() => {
    setQuery('');
    setTreeIndex(null);
    setSearchError(null);
  }, [provider, repoFullName, branch]);

  useEffect(() => {
    if (normalizedQuery.length >= 2) {
      void loadSearchIndex();
    }
  }, [normalizedQuery, provider, repoFullName, branch, treeIndex]);

  return (
    <div className="bg-card/40 border border-border/60 rounded-[1.75rem] flex h-full min-h-0 max-h-full flex-col overflow-hidden shadow-xl shadow-black/10">
      <div className="px-4 py-4 border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <FolderTree className="w-3.5 h-3.5 text-primary" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                Explorador
              </h4>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              Arbol remoto con busqueda de archivos
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRoot()}
              disabled={!isGitHubProvider || !repoIdentity || loading}
              className="p-2 rounded-xl border border-border/60 bg-background/70 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-40"
              title="Actualizar arbol del repositorio"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {repoIdentity && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/20 bg-background/70 text-primary">
                <FolderGit2 className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground truncate">
                  {rootLabel}
                </p>
                <p className="text-[8px] font-bold text-muted-foreground truncate">
                  {repoFullName}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[7px] font-black uppercase tracking-widest text-muted-foreground">
                  {branch}
                </p>
                <p className="text-[9px] font-black uppercase tracking-tight text-primary">
                  {entries.length} elementos
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-4 rounded-2xl border border-border/50 bg-background/40 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.24em] text-primary">
                Cambios de rama
              </p>
              <p className="truncate text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
                {branch === baseBranch ? 'Rama base seleccionada' : `${branch} vs ${baseBranch}`}
              </p>
            </div>

            {diffLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : diffSummary && diffSummary.files.length > 0 ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em] text-emerald-300">
                {diffSummary.files.length} files
              </span>
            ) : (
              <span className="rounded-full border border-border/50 bg-background/60 px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Sin diff
              </span>
            )}
          </div>

          {diffError ? (
            <p className="mt-2 text-[8px] font-bold uppercase tracking-tight text-red-400">
              {diffError}
            </p>
          ) : diffSummary && diffSummary.files.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(diffSummary.countsByStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={cn(
                    'rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em]',
                    getDiffStatusChipClass(status as RepositoryDiffStatus),
                  )}
                >
                  {count} {formatDiffStatus(status as RepositoryDiffStatus)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[8px] font-bold uppercase tracking-tight text-muted-foreground">
              Selecciona otra rama para revisar archivos y lineas cambiadas.
            </p>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-border/50 bg-background/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar archivos en el repositorio..."
              className="w-full bg-transparent text-[10px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <span>
              {normalizedQuery.length >= 2
                ? searchLoading
                  ? 'Indexando repositorio'
                  : `${searchResults.length} coincidencias`
                : 'Escribe 2 caracteres para buscar'}
            </span>
            {searchError && <span className="text-red-400">{searchError}</span>}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 custom-scrollbar [scrollbar-gutter:stable]">
        {!isGitHubProvider ? (
          <UnsupportedProviderState provider={provider} />
        ) : !repoIdentity ? (
          <InvalidRepositoryState />
        ) : normalizedQuery.length >= 2 ? (
          searchLoading && !treeIndex ? (
            <LoadingExplorerState />
          ) : searchResults.length > 0 ? (
            <div className="space-y-1">
              {searchResults.map((entry) => (
                <SearchResultRow
                  key={entry.path}
                  entry={entry}
                  selected={selectedPath === entry.path}
                  fileDiff={fileDiffs[entry.path]}
                  onFileSelect={onFileSelect}
                />
              ))}
            </div>
          ) : (
            <EmptySearchState query={query} />
          )
        ) : loading && entries.length === 0 ? (
          <LoadingExplorerState />
        ) : error ? (
          <ErrorExplorerState message={error} onRetry={() => void loadRoot()} />
        ) : entries.length === 0 ? (
          <EmptyDirectoryState />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1"
          >
            {entries.map((entry) => (
              <ExplorerNode
                key={entry.path}
                branch={branch}
                owner={repoIdentity.owner}
                repo={repoIdentity.repo}
                depth={0}
                entry={entry}
                fileDiffs={fileDiffs}
                directoryDiffCounts={directoryDiffCounts}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

const ExplorerNode: React.FC<{
  branch: string;
  owner: string;
  repo: string;
  entry: GitHubRepoContentEntry;
  depth: number;
  fileDiffs: Record<string, RepositoryDiffFile>;
  directoryDiffCounts: Record<string, number>;
  onFileSelect?: (path: string) => void;
  selectedPath?: string | null;
}> = ({ branch, owner, repo, entry, depth, fileDiffs, directoryDiffCounts, onFileSelect, selectedPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<GitHubRepoContentEntry[]>([]);
  const visual = getEntryVisual(entry);
  const isDirectory = entry.type === 'dir';
  const indentOffset = Math.min(depth, 6) * 12;
  const childOffset = 18 + Math.min(depth, 6) * 12;
  const showTrailingBadge = depth < 2;
  const isSelected = selectedPath === entry.path;
  const fileDiff = fileDiffs[entry.path];
  const descendantChangeCount = directoryDiffCounts[entry.path] ?? 0;

  const handleActivate = async () => {
    if (!isDirectory) {
      onFileSelect?.(entry.path);
      return;
    }

    const nextState = !isOpen;
    setIsOpen(nextState);

    if (!nextState || children.length > 0 || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await desktopBridge.github.listContents(
        owner,
        repo,
        entry.path,
        branch,
      );

      setChildren(sortEntries(result));
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo expandir la carpeta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.995 }}
        onClick={() => void handleActivate()}
        title={entry.path}
        className={cn(
          'group relative flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-all',
          isSelected
            ? 'border-primary/30 bg-primary/10'
            : fileDiff
              ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40 hover:bg-emerald-500/10'
              : descendantChangeCount > 0
                ? 'border-amber-500/15 bg-amber-500/5 hover:border-amber-400/35 hover:bg-amber-500/10'
            : 'border-transparent bg-transparent hover:border-border/60 hover:bg-background/70',
        )}
        style={{ paddingLeft: 8 + indentOffset }}
      >
        <span className="flex h-6 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {isDirectory ? (
            isOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${visual.surfaceClass}`}>
          <visual.icon className={`w-3.5 h-3.5 ${visual.iconClass}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`min-w-0 truncate text-[11px] font-semibold tracking-tight ${isDirectory ? 'text-foreground' : 'text-foreground/90'}`}>
              {entry.name}
            </p>
            {fileDiff && (
              <span className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.2em]',
                getDiffStatusChipClass(fileDiff.status),
              )}>
                {formatDiffStatus(fileDiff.status)}
              </span>
            )}
            {!fileDiff && isDirectory && descendantChangeCount > 0 && (
              <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.2em] text-amber-300">
                {descendantChangeCount} cambios
              </span>
            )}
            {showTrailingBadge && (
              <span className="shrink-0 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {isDirectory ? 'Carpeta' : getFileKind(entry.name)}
              </span>
            )}
          </div>
          <p className="truncate text-[9px] font-medium tracking-tight text-muted-foreground">
            {isDirectory ? 'Carpeta' : describeFile(entry)}
          </p>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {isOpen && isDirectory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className="ml-3 border-l border-border/20 pl-2.5"
              style={{ marginLeft: childOffset }}
            >
              {loading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-9 rounded-xl border border-border/30 bg-background/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="px-2 py-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-red-400">
                    {error}
                  </p>
                </div>
              ) : children.length === 0 ? (
                <div className="px-2 py-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                    Carpeta vacia
                  </p>
                </div>
              ) : (
                children.map((child) => (
                  <ExplorerNode
                    key={child.path}
                    branch={branch}
                    owner={owner}
                    repo={repo}
                    entry={child}
                    depth={depth + 1}
                    fileDiffs={fileDiffs}
                    directoryDiffCounts={directoryDiffCounts}
                    onFileSelect={onFileSelect}
                    selectedPath={selectedPath}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function SearchResultRow({
  entry,
  selected,
  fileDiff,
  onFileSelect,
}: {
  entry: GitHubRepoTreeEntry;
  selected: boolean;
  fileDiff?: RepositoryDiffFile;
  onFileSelect?: (path: string) => void;
}) {
  const name = getLastSegment(entry.path);
  const parentPath = getParentPath(entry.path);
  const visual = getTreeVisual(entry.path);

  return (
    <button
      type="button"
      title={entry.path}
      onClick={() => onFileSelect?.(entry.path)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all',
        selected
          ? 'border-primary/30 bg-primary/10'
          : fileDiff
            ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40 hover:bg-emerald-500/10'
          : 'border-transparent bg-transparent hover:border-border/60 hover:bg-background/70',
      )}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${visual.surfaceClass}`}>
        <visual.icon className={`h-4 w-4 ${visual.iconClass}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[11px] font-semibold text-foreground">
            {name}
          </p>
          {fileDiff && (
            <span className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.2em]',
              getDiffStatusChipClass(fileDiff.status),
            )}>
              {formatDiffStatus(fileDiff.status)}
            </span>
          )}
          <span className="shrink-0 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {getFileKind(name)}
          </span>
        </div>
        <p className="truncate text-[9px] font-medium text-muted-foreground">
          {parentPath || '/'}
        </p>
      </div>
    </button>
  );
}

function UnsupportedProviderState({ provider }: { provider: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border/60 bg-background/40 px-6 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
        <Link2 className="w-7 h-7" />
      </div>

      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground mb-2">
        Proveedor no compatible
      </p>
      <p className="max-w-xs text-[9px] font-bold uppercase tracking-tight text-muted-foreground leading-relaxed">
        El arbol remoto solo esta disponible para GitHub. Proveedor activo: {provider || 'desconocido'}.
      </p>
    </motion.div>
  );
}

function InvalidRepositoryState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.75rem] border border-border/50 bg-background/30 px-6 text-center">
      <FolderTree className="w-8 h-8 text-muted-foreground/50 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground mb-2">
        Repositorio invalido
      </p>
      <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
        Falta un propietario o nombre valido en el registro del repositorio.
      </p>
    </div>
  );
}

function LoadingExplorerState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="h-11 rounded-2xl border border-border/40 bg-background/40 animate-pulse"
        />
      ))}
    </div>
  );
}

function ErrorExplorerState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.75rem] border border-red-500/10 bg-red-500/5 px-6 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400 mb-2">
        Error del explorador
      </p>
      <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground mb-5">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 px-4 py-2 text-[8px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/10 transition-all"
      >
        <RefreshCw className="w-3 h-3" />
        Reintentar
      </button>
    </div>
  );
}

function EmptyDirectoryState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.75rem] border border-border/50 bg-background/30 px-6 text-center">
      <FolderOpen className="w-8 h-8 text-muted-foreground/50 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground mb-2">
        Raiz del repositorio vacia
      </p>
      <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
        No se devolvieron archivos para la rama seleccionada.
      </p>
    </div>
  );
}

function EmptySearchState({ query }: { query: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.75rem] border border-border/50 bg-background/30 px-6 text-center">
      <Search className="w-8 h-8 text-muted-foreground/50 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground mb-2">
        Sin resultados
      </p>
      <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
        Ningun archivo coincide con "{query}".
      </p>
    </div>
  );
}

function parseRepoIdentity(repoFullName: string): { owner: string; repo: string } | null {
  const segments = repoFullName.split('/').filter(Boolean);
  if (segments.length !== 2) {
    return null;
  }

  return {
    owner: segments[0],
    repo: segments[1],
  };
}

function sortEntries(entries: GitHubRepoContentEntry[]): GitHubRepoContentEntry[] {
  return [...entries].sort((left, right) => {
    if (left.type === right.type) {
      return left.name.localeCompare(right.name);
    }

    if (left.type === 'dir') {
      return -1;
    }

    if (right.type === 'dir') {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildDirectoryDiffCounts(fileDiffs: Record<string, RepositoryDiffFile>): Record<string, number> {
  const counts: Record<string, number> = {};

  Object.keys(fileDiffs).forEach((path) => {
    const segments = path.split('/').filter(Boolean);

    for (let index = 0; index < segments.length - 1; index += 1) {
      const directoryPath = segments.slice(0, index + 1).join('/');
      counts[directoryPath] = (counts[directoryPath] ?? 0) + 1;
    }
  });

  return counts;
}

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

function describeFile(entry: GitHubRepoContentEntry): string {
  return `${getFileKind(entry.name)} | ${formatSize(entry.size)}`;
}

function getFileKind(name: string): string {
  const extension = name.includes('.')
    ? name.split('.').pop()?.toUpperCase()
    : 'FILE';

  return extension || 'FILE';
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
}

function getEntryVisual(entry: GitHubRepoContentEntry) {
  if (entry.type === 'dir') {
    return {
      icon: isLikelyPackageFolder(entry.name) ? Package : Folder,
      iconClass: 'text-primary',
      surfaceClass: 'border-primary/20 bg-primary/10',
    };
  }

  if (entry.type === 'symlink') {
    return {
      icon: Link2,
      iconClass: 'text-cyan-300',
      surfaceClass: 'border-cyan-500/15 bg-cyan-500/10',
    };
  }

  if (entry.type === 'submodule') {
    return {
      icon: Package,
      iconClass: 'text-amber-300',
      surfaceClass: 'border-amber-500/15 bg-amber-500/10',
    };
  }

  return getTreeVisual(entry.name);
}

function getTreeVisual(path: string) {
  const extension = getLastSegment(path).split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return {
        icon: FileCode2,
        iconClass: 'text-blue-300',
        surfaceClass: 'border-blue-500/15 bg-blue-500/10',
      };
    case 'json':
      return {
        icon: FileJson2,
        iconClass: 'text-amber-300',
        surfaceClass: 'border-amber-500/15 bg-amber-500/10',
      };
    case 'md':
    case 'txt':
      return {
        icon: FileText,
        iconClass: 'text-emerald-300',
        surfaceClass: 'border-emerald-500/15 bg-emerald-500/10',
      };
    case 'sql':
      return {
        icon: Database,
        iconClass: 'text-fuchsia-300',
        surfaceClass: 'border-fuchsia-500/15 bg-fuchsia-500/10',
      };
    case 'css':
    case 'scss':
      return {
        icon: Braces,
        iconClass: 'text-cyan-300',
        surfaceClass: 'border-cyan-500/15 bg-cyan-500/10',
      };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
      return {
        icon: Image,
        iconClass: 'text-rose-300',
        surfaceClass: 'border-rose-500/15 bg-rose-500/10',
      };
    case 'lock':
    case 'bin':
      return {
        icon: Binary,
        iconClass: 'text-violet-300',
        surfaceClass: 'border-violet-500/15 bg-violet-500/10',
      };
    default:
      return {
        icon: File,
        iconClass: 'text-muted-foreground',
        surfaceClass: 'border-border/60 bg-background/70',
      };
  }
}

function getLastSegment(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function getParentPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  segments.pop();
  return segments.join('/');
}

function isLikelyPackageFolder(name: string): boolean {
  return ['src', 'app', 'components', 'packages', 'modules'].includes(name.toLowerCase());
}
