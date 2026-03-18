import { contextBridge, ipcRenderer } from "electron";
import type {
  RuntimeHealth,
  WorkerConfig,
  WorkerRun,
  WorkspaceSnapshot,
} from "@auria/contracts";
import type {
  GitHubBranch,
  GitHubCompareResult,
  GitHubRepoFileContent,
  GitHubRepoContentEntry,
  GitHubRepoTreeEntry,
  GitHubListReposResult,
  GitHubRepo,
  GitHubUser,
} from "../shared/github-types";
import {
  AUTODEV_RUNTIME_CHANNEL,
  type AutodevRunRequest,
  type AutodevRuntimeSnapshot,
} from "../shared/autodev-types";

const auriaBridge = {
  // ─── Secure Storage (OS-level encryption via safeStorage) ─────
  secureStorageGetItem: (key: string) =>
    ipcRenderer.invoke("secureStorage:getItem", key) as Promise<string | null>,
  secureStorageSetItem: (key: string, value: string) =>
    ipcRenderer.invoke("secureStorage:setItem", key, value) as Promise<void>,
  secureStorageRemoveItem: (key: string) =>
    ipcRenderer.invoke("secureStorage:removeItem", key) as Promise<void>,

  // ─── OAuth ─────────────────────────────────────────────────────
  openOAuthWindow: (oauthUrl: string, redirectUrl: string) =>
    ipcRenderer.invoke("auth:openOAuthWindow", oauthUrl, redirectUrl) as Promise<void>,
  onOAuthCallback: (callback: (code: string) => void) => {
    ipcRenderer.on("auth:oauth-callback", (_e, code: string) => callback(code));
  },
  removeOAuthCallback: () => {
    ipcRenderer.removeAllListeners("auth:oauth-callback");
  },

  // ─── GitHub API (all calls proxied through main process) ──────
  github: {
    listRepos: (page: number, perPage: number, query?: string) =>
      ipcRenderer.invoke("github:listRepos", page, perPage, query) as Promise<GitHubListReposResult>,
    getRepo: (owner: string, repo: string) =>
      ipcRenderer.invoke("github:getRepo", owner, repo) as Promise<GitHubRepo>,
    getBranches: (owner: string, repo: string) =>
      ipcRenderer.invoke("github:getBranches", owner, repo) as Promise<GitHubBranch[]>,
    compareRefs: (owner: string, repo: string, base: string, head: string) =>
      ipcRenderer.invoke("github:compareRefs", owner, repo, base, head) as Promise<GitHubCompareResult>,
    listContents: (owner: string, repo: string, path?: string, ref?: string) =>
      ipcRenderer.invoke("github:listContents", owner, repo, path, ref) as Promise<GitHubRepoContentEntry[]>,
    listTree: (owner: string, repo: string, ref: string) =>
      ipcRenderer.invoke("github:listTree", owner, repo, ref) as Promise<GitHubRepoTreeEntry[]>,
    getFileContent: (owner: string, repo: string, path: string, ref?: string) =>
      ipcRenderer.invoke("github:getFileContent", owner, repo, path, ref) as Promise<GitHubRepoFileContent>,
    getUser: () =>
      ipcRenderer.invoke("github:getUser") as Promise<GitHubUser>,
    hasToken: () =>
      ipcRenderer.invoke("github:hasToken") as Promise<boolean>,
    clearToken: () =>
      ipcRenderer.invoke("github:clearToken") as Promise<void>,
  },

  // ─── Existing ──────────────────────────────────────────────────
  getRuntimeHealth: () =>
    ipcRenderer.invoke("runtime:getHealth") as Promise<RuntimeHealth>,
  getWorkspaceSnapshot: () =>
    ipcRenderer.invoke("workspace:getSnapshot") as Promise<WorkspaceSnapshot>,
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.invoke("window:setSize", width, height) as Promise<void>,
  maximizeWindow: () =>
    ipcRenderer.invoke("window:maximize") as Promise<void>,
  unmaximizeWindow: () =>
    ipcRenderer.invoke("window:unmaximize") as Promise<void>,
  pickRepositoryDirectory: () =>
    ipcRenderer.invoke("workspace:pickRepositoryDirectory") as Promise<
      string | null
    >,

  // ─── Worker Operations ─────────────────────────────────────────
  workerRunNow: () =>
    ipcRenderer.invoke("worker:runNow") as Promise<{ success: boolean; runId?: string; error?: string }>,
  workerAbort: () =>
    ipcRenderer.invoke("worker:abort") as Promise<{ success: boolean }>,
  workerGetStatus: () =>
    ipcRenderer.invoke("worker:getStatus") as Promise<{
      running: boolean;
      currentPhase: string | null;
      currentRunId: string | null;
    }>,
  workerGetHistory: () =>
    ipcRenderer.invoke("worker:getHistory") as Promise<WorkerRun[]>,
  workerUpdateConfig: (config: WorkerConfig) =>
    ipcRenderer.invoke("worker:updateConfig", config) as Promise<{ success: boolean }>,
  workerTriggerMicroFix: (description: string) =>
    ipcRenderer.invoke("worker:triggerMicroFix", description) as Promise<{ success: boolean }>,
  workerLogFeedback: (message: string) =>
    ipcRenderer.invoke("worker:logFeedback", message) as Promise<void>,

  // ─── AutoDev Agent Configuration ─────────────────────────────
  autodevGetConfig: () =>
    ipcRenderer.invoke("autodev:get-config") as Promise<{ config: Record<string, unknown> }>,
  autodevUpdateConfig: (updates: Record<string, unknown>) =>
    ipcRenderer.invoke("autodev:update-config", updates) as Promise<{ config: Record<string, unknown> }>,
  autodevGetRuntime: () =>
    ipcRenderer.invoke("autodev:get-runtime") as Promise<AutodevRuntimeSnapshot>,
  autodevSetContext: (context: AutodevRunRequest) =>
    ipcRenderer.invoke("autodev:set-context", context) as Promise<{ success: boolean }>,
  autodevRunNow: (request?: AutodevRunRequest) =>
    ipcRenderer.invoke("autodev:run-now", request) as Promise<{ success: boolean; runId?: string; error?: string }>,
  autodevAbortRun: () =>
    ipcRenderer.invoke("autodev:abort-run") as Promise<{ success: boolean }>,
  onAutodevRuntimeUpdate: (callback: (snapshot: AutodevRuntimeSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AutodevRuntimeSnapshot) => {
      callback(snapshot);
    };
    ipcRenderer.on(AUTODEV_RUNTIME_CHANNEL, listener);
    return () => ipcRenderer.removeListener(AUTODEV_RUNTIME_CHANNEL, listener);
  },

  // ─── Filesystem & Shell ────────────────────────────────────────
  fs: {
    list: (dirPath: string) => 
      ipcRenderer.invoke("fs:list", dirPath) as Promise<{ success: boolean; entries?: any[]; error?: string }>,
    readFile: (filePath: string) =>
      ipcRenderer.invoke("fs:readFile", filePath) as Promise<{ success: boolean; content?: string; error?: string }>,
  },
  shell: {
    runCommand: (command: string, cwd: string) =>
      ipcRenderer.invoke("shell:runCommand", command, cwd) as Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }>,
  },

  // ─── App Settings (auto-launch / background) ─────────────────
  getAutoLaunchEnabled: () =>
    ipcRenderer.invoke("app:getAutoLaunch") as Promise<boolean>,
  setAutoLaunchEnabled: (enabled: boolean) =>
    ipcRenderer.invoke("app:setAutoLaunch", enabled) as Promise<boolean>,
};

contextBridge.exposeInMainWorld("auria", auriaBridge);
