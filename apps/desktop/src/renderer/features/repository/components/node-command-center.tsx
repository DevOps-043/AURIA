import React from 'react';
import { desktopBridge } from '@/shared/api/desktop-bridge';
import { CodeTabs, type CodeTabDocument } from '@/shared/components/ui/code-tabs';
import { FileExplorer } from './file-explorer';
import {
  buildRepositoryDiffSummary,
  createEmptyRepositoryDiffSummary,
  type RepositoryDiffSummary,
} from './repository-diff';

interface NodeCommandCenterProps {
  repoFullName: string;
  repoBranch: string;
  baseBranch: string;
  repoProvider: string;
}

export const NodeCommandCenter: React.FC<NodeCommandCenterProps> = ({
  repoFullName,
  repoBranch,
  baseBranch,
  repoProvider,
}) => {
  const [openFiles, setOpenFiles] = React.useState<CodeTabDocument[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [loadingPath, setLoadingPath] = React.useState<string | null>(null);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [diffSummary, setDiffSummary] = React.useState<RepositoryDiffSummary>(
    () => createEmptyRepositoryDiffSummary(baseBranch, repoBranch),
  );
  const [diffLoading, setDiffLoading] = React.useState(false);
  const [diffError, setDiffError] = React.useState<string | null>(null);
  const repoIdentity = parseRepoIdentity(repoFullName);
  const activeFile = openFiles.find((file) => file.path === activePath) ?? openFiles[0] ?? null;

  React.useEffect(() => {
    setOpenFiles([]);
    setActivePath(null);
    setLoadingPath(null);
    setEditorError(null);
  }, [repoFullName, repoBranch]);

  React.useEffect(() => {
    let cancelled = false;

    const loadDiff = async () => {
      if (repoProvider.toLowerCase() !== 'github' || !repoIdentity) {
        setDiffSummary(createEmptyRepositoryDiffSummary(baseBranch, repoBranch));
        setDiffLoading(false);
        setDiffError(null);
        return;
      }

      if (baseBranch === repoBranch) {
        setDiffSummary(createEmptyRepositoryDiffSummary(baseBranch, repoBranch));
        setDiffLoading(false);
        setDiffError(null);
        return;
      }

      try {
        setDiffLoading(true);
        setDiffError(null);

        const result = await desktopBridge.github.compareRefs(
          repoIdentity.owner,
          repoIdentity.repo,
          baseBranch,
          repoBranch,
        );

        if (!cancelled) {
          setDiffSummary(buildRepositoryDiffSummary(result));
        }
      } catch (err) {
        if (!cancelled) {
          setDiffSummary(createEmptyRepositoryDiffSummary(baseBranch, repoBranch));
          setDiffError(getErrorMessage(err, 'No se pudieron cargar los cambios entre ramas.'));
        }
      } finally {
        if (!cancelled) {
          setDiffLoading(false);
        }
      }
    };

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [baseBranch, repoBranch, repoProvider, repoIdentity?.owner, repoIdentity?.repo]);

  const handleFileSelect = async (path: string) => {
    setEditorError(null);

    const existingFile = openFiles.find((file) => file.path === path);
    if (existingFile) {
      setActivePath(path);
      return;
    }

    if (!repoIdentity) {
      setEditorError('Identificador de repositorio invalido.');
      return;
    }

    setLoadingPath(path);

    try {
      const file = await desktopBridge.github.getFileContent(
        repoIdentity.owner,
        repoIdentity.repo,
        path,
        repoBranch,
      );

      const nextFile: CodeTabDocument = {
        name: file.name,
        path: file.path,
        content: file.content,
        language: getFileLanguage(file.path),
        size: file.size,
        sha: file.sha,
        htmlUrl: file.html_url,
      };

      setOpenFiles((previous) => [...previous, nextFile]);
      setActivePath(nextFile.path);
    } catch (err) {
      setEditorError(getErrorMessage(err, 'No se pudo cargar el contenido del archivo.'));
    } finally {
      setLoadingPath(null);
    }
  };

  const handleCloseFile = (path: string) => {
    const remainingFiles = openFiles.filter((file) => file.path !== path);
    setOpenFiles(remainingFiles);

    if (activePath === path) {
      setActivePath(remainingFiles[remainingFiles.length - 1]?.path ?? null);
    }
  };

  return (
    <div
      className="grid h-[75vh] min-h-[520px] max-h-[760px] grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)]"
    >
      <div className="h-full min-h-0 min-w-0 overflow-hidden">
        <FileExplorer
          provider={repoProvider}
          repoFullName={repoFullName}
          branch={repoBranch}
          baseBranch={baseBranch}
          selectedPath={activeFile?.path ?? null}
          fileDiffs={diffSummary.filesByPath}
          diffSummary={diffSummary}
          diffLoading={diffLoading}
          diffError={diffError}
          onFileSelect={(path) => void handleFileSelect(path)}
        />
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0">
          <CodeTabs
            files={openFiles}
            activePath={activeFile?.path ?? null}
            repoFullName={repoFullName}
            branch={repoBranch}
            baseBranch={baseBranch}
            loadingPath={loadingPath}
            error={editorError}
            diffSummary={diffSummary}
            diffLoading={diffLoading}
            diffError={diffError}
            fileDiffs={diffSummary.filesByPath}
            onActiveChange={setActivePath}
            onClose={handleCloseFile}
          />
        </div>
      </div>
    </div>
  );
};

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

function getFileLanguage(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'ts':
      return 'TypeScript';
    case 'tsx':
      return 'TSX';
    case 'js':
      return 'JavaScript';
    case 'jsx':
      return 'JSX';
    case 'json':
      return 'JSON';
    case 'md':
      return 'Markdown';
    case 'css':
      return 'CSS';
    case 'scss':
      return 'SCSS';
    case 'sql':
      return 'SQL';
    case 'html':
      return 'HTML';
    case 'yml':
    case 'yaml':
      return 'YAML';
    default:
      return extension ? extension.toUpperCase() : 'Texto';
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
}
