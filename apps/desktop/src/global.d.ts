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
} from "./shared/github-types";
import type {
  AutodevRunRequest,
  AutodevRuntimeSnapshot,
} from "./shared/autodev-types";

declare global {
  interface Window {
    auria?: {
      // Secure storage (OS-level encrypted)
      secureStorageGetItem: (key: string) => Promise<string | null>;
      secureStorageSetItem: (key: string, value: string) => Promise<void>;
      secureStorageRemoveItem: (key: string) => Promise<void>;

      // OAuth
      openOAuthWindow: (oauthUrl: string, redirectUrl: string) => Promise<void>;
      onOAuthCallback: (callback: (code: string) => void) => void;
      removeOAuthCallback: () => void;

      // GitHub API (proxied through main process)
      github: {
        listRepos: (page: number, perPage: number, query?: string) => Promise<GitHubListReposResult>;
        getRepo: (owner: string, repo: string) => Promise<GitHubRepo>;
        getBranches: (owner: string, repo: string) => Promise<GitHubBranch[]>;
        compareRefs: (owner: string, repo: string, base: string, head: string) => Promise<GitHubCompareResult>;
        listContents: (owner: string, repo: string, path?: string, ref?: string) => Promise<GitHubRepoContentEntry[]>;
        listTree: (owner: string, repo: string, ref: string) => Promise<GitHubRepoTreeEntry[]>;
        getFileContent: (owner: string, repo: string, path: string, ref?: string) => Promise<GitHubRepoFileContent>;
        getUser: () => Promise<GitHubUser>;
        hasToken: () => Promise<boolean>;
        clearToken: () => Promise<void>;
      };

      // Runtime
      getRuntimeHealth: () => Promise<RuntimeHealth>;
      getWorkspaceSnapshot: () => Promise<WorkspaceSnapshot>;
      pickRepositoryDirectory: () => Promise<string | null>;
      resizeWindow: (width: number, height: number) => Promise<void>;
      maximizeWindow: () => Promise<void>;
      unmaximizeWindow: () => Promise<void>;

      // Worker
      workerRunNow: () => Promise<{ success: boolean; runId?: string; error?: string }>;
      workerAbort: () => Promise<{ success: boolean }>;
      workerGetStatus: () => Promise<{
        running: boolean;
        currentPhase: string | null;
        currentRunId: string | null;
      }>;
      workerGetHistory: () => Promise<WorkerRun[]>;
      workerUpdateConfig: (config: WorkerConfig) => Promise<{ success: boolean }>;
      workerTriggerMicroFix: (description: string) => Promise<{ success: boolean }>;
      workerLogFeedback: (message: string) => Promise<void>;

      // AutoDev Agent Configuration
      autodevGetConfig: () => Promise<{ config: Record<string, unknown> }>;
      autodevUpdateConfig: (updates: Record<string, unknown>) => Promise<{ config: Record<string, unknown> }>;
      autodevGetRuntime: () => Promise<AutodevRuntimeSnapshot>;
      autodevSetContext: (context: AutodevRunRequest) => Promise<{ success: boolean }>;
      autodevRunNow: (request?: AutodevRunRequest) => Promise<{ success: boolean; runId?: string; error?: string }>;
      autodevAbortRun: () => Promise<{ success: boolean }>;
      onAutodevRuntimeUpdate: (callback: (snapshot: AutodevRuntimeSnapshot) => void) => () => void;

      // Filesystem & Shell
      fs: {
        list: (dirPath: string) => Promise<{ success: boolean; entries?: any[]; error?: string }>;
        readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      };
      shell: {
        runCommand: (command: string, cwd: string) => Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }>;
      };

      // App Settings
      getAutoLaunchEnabled: () => Promise<boolean>;
      setAutoLaunchEnabled: (enabled: boolean) => Promise<boolean>;
    };
  }
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

export {};
