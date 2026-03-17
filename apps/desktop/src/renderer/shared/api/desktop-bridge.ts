import {
  runtimeHealthSchema,
  workspaceSnapshotSchema,
  type RuntimeHealth,
  type WorkerConfig,
  type WorkerRun,
  type WorkspaceSnapshot,
} from "@auria/contracts";
import { createDemoWorkspaceSnapshot } from "@auria/domain";
import type {
  GitHubBranch,
  GitHubCompareResult,
  GitHubRepoFileContent,
  GitHubRepoContentEntry,
  GitHubRepoTreeEntry,
  GitHubListReposResult,
  GitHubRepo,
  GitHubUser,
} from "../../../shared/github-types";

const fallbackSnapshot = createDemoWorkspaceSnapshot();
const PRELOAD_REFRESH_KEY = "auria-preload-refresh-github-bridge";

const fallbackHealth: RuntimeHealth = runtimeHealthSchema.parse({
  appVersion: "0.1.0",
  platform: "browser-preview",
  workerMode: fallbackSnapshot.mode,
  workerStatus: "ready",
  lastSyncAt: new Date().toISOString(),
});

const GITHUB_API_BASE = "https://api.github.com";

function ensureGitHubBridgeMethod(
  methodName: keyof NonNullable<typeof window.auria>["github"],
): boolean {
  if (!window.auria?.github) {
    throw new Error("La API de GitHub no esta disponible en la vista previa del navegador");
  }

  if (typeof window.auria.github[methodName] === "function") {
    try {
      window.sessionStorage.removeItem(PRELOAD_REFRESH_KEY);
    } catch {
      // Ignore sessionStorage failures in restricted contexts.
    }
    return true;
  }

  const isDev = Boolean(import.meta.env.DEV);

  if (isDev) {
    try {
      const hasRefreshed = window.sessionStorage.getItem(PRELOAD_REFRESH_KEY) === "1";
      if (!hasRefreshed) {
        window.sessionStorage.setItem(PRELOAD_REFRESH_KEY, "1");
        window.location.reload();
        throw new Error("Recargando la interfaz para cargar el puente de escritorio actualizado...");
      }
    } catch {
      // Fall through to the persistent error below.
    }
  }

  throw new Error(
    `El puente de escritorio esta desactualizado. Reinicia la sesion de desarrollo de Electron para cargar github:${String(methodName)}.`,
  );
}

function isMissingIpcHandlerError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("No handler registered") ||
      err.message.includes("No hay un handler registrado"))
  );
}

function shouldFallbackToGitHubRest(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  return (
    err.message.includes("No handler registered") ||
    err.message.includes("Error invoking remote method") ||
    err.message.includes("Desktop bridge is outdated") ||
    err.message.includes("El puente de escritorio esta desactualizado") ||
    err.message.includes("channel") ||
    err.message.includes("IPC")
  );
}

async function getGitHubToken(): Promise<string> {
  if (!window.auria?.secureStorageGetItem) {
    throw new Error("El puente de almacenamiento seguro no esta disponible.");
  }

  const token = await window.auria.secureStorageGetItem("auria-github-token");
  if (!token) {
    throw new Error("No hay un token de GitHub disponible. Vuelve a conectar tu cuenta de GitHub.");
  }

  return token;
}

async function githubJsonFetch<T>(path: string): Promise<T> {
  const token = await getGitHubToken();
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.object+json",
      "User-Agent": "Auria-Desktop",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Error de la API de GitHub (${response.status}): ${body.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

async function githubTextFetch(url: string): Promise<string> {
  const token = await getGitHubToken();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "Auria-Desktop",
    },
  });

  if (!response.ok) {
    throw new Error(`La solicitud del archivo bruto de GitHub fallo (${response.status}).`);
  }

  return response.text();
}

function decodeBase64Utf8(base64: string): string {
  const normalized = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(normalized, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchRepoContents(
  owner: string,
  repo: string,
  path = "",
  ref?: string,
): Promise<GitHubRepoContentEntry[]> {
  const params = new URLSearchParams();
  if (ref) {
    params.set("ref", ref);
  }

  const normalizedPath = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const suffix = normalizedPath ? `/${normalizedPath}` : "";
  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await githubJsonFetch<{
    entries?: Array<{
      name: string;
      path: string;
      type: GitHubRepoContentEntry["type"];
      size?: number;
      sha: string;
      html_url?: string | null;
      download_url?: string | null;
    }>;
  }>(`/repos/${owner}/${repo}/contents${suffix}${query}`);

  return (response.entries ?? []).map((entry) => ({
    name: entry.name,
    path: entry.path,
    type: entry.type,
    size: entry.size ?? 0,
    sha: entry.sha,
    html_url: entry.html_url ?? null,
    download_url: entry.download_url ?? null,
  }));
}

async function fetchRepoTree(
  owner: string,
  repo: string,
  ref: string,
): Promise<GitHubRepoTreeEntry[]> {
  const normalizedRef = encodeURIComponent(ref);
  const response = await githubJsonFetch<{
    tree?: Array<{
      path?: string;
      type?: "blob" | "tree" | "commit";
      sha?: string;
      size?: number;
    }>;
  }>(`/repos/${owner}/${repo}/git/trees/${normalizedRef}?recursive=1`);

  return (response.tree ?? [])
    .filter((entry): entry is NonNullable<typeof response.tree>[number] & { path: string; type: "blob" | "tree"; sha: string } =>
      Boolean(entry.path) &&
      Boolean(entry.sha) &&
      (entry.type === "blob" || entry.type === "tree"),
    )
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      size: entry.size ?? 0,
      sha: entry.sha,
    }));
}

async function fetchRepoFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GitHubRepoFileContent> {
  const params = new URLSearchParams();
  if (ref) {
    params.set("ref", ref);
  }

  const normalizedPath = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await githubJsonFetch<{
    name: string;
    path: string;
    sha: string;
    size?: number;
    type: "file" | "dir" | "symlink" | "submodule";
    content?: string;
    encoding?: string;
    download_url?: string | null;
    html_url?: string | null;
  }>(`/repos/${owner}/${repo}/contents/${normalizedPath}${query}`);

  if (response.type !== "file") {
    throw new Error(`La ruta "${path}" no corresponde a un archivo.`);
  }

  const content = response.content
    ? decodeBase64Utf8(response.content)
    : response.download_url
      ? await githubTextFetch(response.download_url)
      : "";

  return {
    name: response.name,
    path: response.path,
    sha: response.sha,
    size: response.size ?? content.length,
    content,
    encoding: response.encoding ?? "utf-8",
    html_url: response.html_url ?? null,
  };
}

function mapGitHubCompareResponse(
  response: {
    status: GitHubCompareResult["status"];
    ahead_by: number;
    behind_by: number;
    total_commits: number;
    files?: Array<{
      filename: string;
      previous_filename?: string | null;
      status: GitHubCompareResult["files"][number]["status"];
      additions?: number;
      deletions?: number;
      changes?: number;
      patch?: string | null;
    }>;
    commits?: Array<{
      sha: string;
      commit: {
        message: string;
        author?: {
          name?: string | null;
          date?: string | null;
        } | null;
      };
    }>;
  },
  base: string,
  head: string,
): GitHubCompareResult {
  return {
    status: response.status,
    ahead_by: response.ahead_by,
    behind_by: response.behind_by,
    total_commits: response.total_commits,
    base_branch: base,
    head_branch: head,
    files: (response.files ?? []).map((file) => ({
      filename: file.filename,
      previous_filename: file.previous_filename ?? null,
      status: file.status,
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      changes: file.changes ?? 0,
      patch: file.patch ?? null,
    })),
    commits: (response.commits ?? []).map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      authorName: commit.commit.author?.name ?? null,
      authoredDate: commit.commit.author?.date ?? null,
    })),
  };
}

export const desktopBridge = {
  // ─── GitHub API (proxied through main process) ────────────────
  github: {
    listRepos: async (page: number, perPage: number, query?: string): Promise<GitHubListReposResult> =>
      window.auria
        ? window.auria.github.listRepos(page, perPage, query)
        : { repos: [], hasNextPage: false },
    getRepo: async (owner: string, repo: string): Promise<GitHubRepo> => {
      if (!window.auria) {
        throw new Error("La API de GitHub no esta disponible en la vista previa del navegador");
      }
      return window.auria.github.getRepo(owner, repo);
    },
    getBranches: async (owner: string, repo: string): Promise<GitHubBranch[]> =>
      window.auria
        ? window.auria.github.getBranches(owner, repo)
        : [],
    compareRefs: async (
      owner: string,
      repo: string,
      base: string,
      head: string,
    ): Promise<GitHubCompareResult> => {
      if (window.auria?.github && typeof window.auria.github.compareRefs === "function") {
        return window.auria.github.compareRefs(owner, repo, base, head);
      }

      const encodedBase = encodeURIComponent(base);
      const encodedHead = encodeURIComponent(head);
      const response = await githubJsonFetch<{
        status: GitHubCompareResult["status"];
        ahead_by: number;
        behind_by: number;
        total_commits: number;
        files?: Array<{
          filename: string;
          previous_filename?: string | null;
          status: GitHubCompareResult["files"][number]["status"];
          additions?: number;
          deletions?: number;
          changes?: number;
          patch?: string | null;
        }>;
        commits?: Array<{
          sha: string;
          commit: {
            message: string;
            author?: {
              name?: string | null;
              date?: string | null;
            } | null;
          };
        }>;
      }>(`/repos/${owner}/${repo}/compare/${encodedBase}...${encodedHead}`);

      return mapGitHubCompareResponse(response, base, head);
    },
    listContents: async (
      owner: string,
      repo: string,
      path?: string,
      ref?: string,
    ): Promise<GitHubRepoContentEntry[]> => {
      const githubBridge = window.auria?.github;

      if (typeof githubBridge?.listContents === "function") {
        try {
          return await githubBridge.listContents(owner, repo, path, ref);
        } catch (err) {
          if (!shouldFallbackToGitHubRest(err)) {
            throw err;
          }
        }
      }

      return fetchRepoContents(owner, repo, path, ref);
    },
    listTree: async (
      owner: string,
      repo: string,
      ref: string,
    ): Promise<GitHubRepoTreeEntry[]> => {
      const githubBridge = window.auria?.github;

      try {
        if (typeof githubBridge?.listTree === "function") {
          return await githubBridge.listTree(owner, repo, ref);
        }

        ensureGitHubBridgeMethod("listTree");
      } catch (err) {
        if (!shouldFallbackToGitHubRest(err)) {
          throw err;
        }
      }

      return fetchRepoTree(owner, repo, ref);
    },
    getFileContent: async (
      owner: string,
      repo: string,
      path: string,
      ref?: string,
    ): Promise<GitHubRepoFileContent> => {
      const githubBridge = window.auria?.github;

      try {
        if (typeof githubBridge?.getFileContent === "function") {
          return await githubBridge.getFileContent(owner, repo, path, ref);
        }

        ensureGitHubBridgeMethod("getFileContent");
      } catch (err) {
        if (!shouldFallbackToGitHubRest(err)) {
          throw err;
        }
      }

      return fetchRepoFileContent(owner, repo, path, ref);
    },
    getUser: async (): Promise<GitHubUser> => {
      if (!window.auria) {
        throw new Error("La API de GitHub no esta disponible en la vista previa del navegador");
      }
      return window.auria.github.getUser();
    },
    hasToken: async (): Promise<boolean> =>
      window.auria ? window.auria.github.hasToken() : false,
    clearToken: async (): Promise<void> => {
      if (window.auria) await window.auria.github.clearToken();
    },
  },

  // ─── Existing ──────────────────────────────────────────────────
  getRuntimeHealth: async () =>
    window.auria
      ? runtimeHealthSchema.parse(await window.auria.getRuntimeHealth())
      : fallbackHealth,
  getWorkspaceSnapshot: async (): Promise<WorkspaceSnapshot> =>
    window.auria
      ? workspaceSnapshotSchema.parse(await window.auria.getWorkspaceSnapshot())
      : fallbackSnapshot,
  pickRepositoryDirectory: async () =>
    window.auria ? window.auria.pickRepositoryDirectory() : "C:/workspace/auria",

  // ─── Worker Operations ─────────────────────────────────────────
  workerRunNow: async (): Promise<{ success: boolean; runId?: string; error?: string }> =>
    window.auria
      ? window.auria.workerRunNow()
      : { success: true, runId: `demo_${Date.now()}` },

  workerAbort: async (): Promise<{ success: boolean }> =>
    window.auria ? window.auria.workerAbort() : { success: true },

  workerGetStatus: async (): Promise<{
    running: boolean;
    currentPhase: string | null;
    currentRunId: string | null;
  }> =>
    window.auria
      ? window.auria.workerGetStatus()
      : { running: false, currentPhase: null, currentRunId: null },

  workerGetHistory: async (): Promise<WorkerRun[]> =>
    window.auria ? window.auria.workerGetHistory() : [],

  workerUpdateConfig: async (config: WorkerConfig): Promise<{ success: boolean }> =>
    window.auria
      ? window.auria.workerUpdateConfig(config)
      : { success: true },

  workerTriggerMicroFix: async (description: string): Promise<{ success: boolean }> =>
    window.auria
      ? window.auria.workerTriggerMicroFix(description)
      : { success: true },

  workerLogFeedback: async (message: string): Promise<void> => {
    if (window.auria) {
      await window.auria.workerLogFeedback(message);
    }
  },

  // ─── AutoDev Agent Configuration ─────────────────────────────
  autodevGetConfig: async (): Promise<Record<string, unknown>> => {
    if (window.auria?.autodevGetConfig) {
      try {
        const result = await window.auria.autodevGetConfig();
        return result.config ?? {};
      } catch {
        return {};
      }
    }
    return {};
  },

  autodevUpdateConfig: async (updates: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (window.auria?.autodevUpdateConfig) {
      try {
        const result = await window.auria.autodevUpdateConfig(updates);
        return result.config ?? {};
      } catch {
        return {};
      }
    }
    return {};
  },
};
