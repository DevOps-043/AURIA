import { ipcMain } from "electron";
import { GitHubAPI, GitHubAuthError, GitHubRateLimitError } from "./github-api";

interface SecureStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Registers all GitHub-related IPC handlers.
 * GitHub API calls are proxied through the main process to keep
 * the provider token isolated from the renderer (security boundary).
 */
export function registerGitHubHandlers(store: SecureStore): void {
  const github = new GitHubAPI(store);

  ipcMain.handle("github:listRepos", async (_e, page: number, perPage: number, query?: string) => {
    try {
      return await github.listRepos(page, perPage, query);
    } catch (err) {
      return handleGitHubError(err);
    }
  });

  ipcMain.handle("github:getRepo", async (_e, owner: string, repo: string) => {
    try {
      return await github.getRepo(owner, repo);
    } catch (err) {
      return handleGitHubError(err);
    }
  });

  ipcMain.handle("github:getBranches", async (_e, owner: string, repo: string) => {
    try {
      return await github.getBranches(owner, repo);
    } catch (err) {
      return handleGitHubError(err);
    }
  });

  ipcMain.handle(
    "github:compareRefs",
    async (_e, owner: string, repo: string, base: string, head: string) => {
      try {
        return await github.compareRefs(owner, repo, base, head);
      } catch (err) {
        return handleGitHubError(err);
      }
    },
  );

  ipcMain.handle(
    "github:listContents",
    async (_e, owner: string, repo: string, path?: string, ref?: string) => {
      try {
        return await github.listContents(owner, repo, path, ref);
      } catch (err) {
        return handleGitHubError(err);
      }
    },
  );

  ipcMain.handle("github:listTree", async (_e, owner: string, repo: string, ref: string) => {
    try {
      return await github.listTree(owner, repo, ref);
    } catch (err) {
      return handleGitHubError(err);
    }
  });

  ipcMain.handle(
    "github:getFileContent",
    async (_e, owner: string, repo: string, path: string, ref?: string) => {
      try {
        return await github.getFileContent(owner, repo, path, ref);
      } catch (err) {
        return handleGitHubError(err);
      }
    },
  );

  ipcMain.handle("github:getUser", async () => {
    try {
      return await github.getUser();
    } catch (err) {
      return handleGitHubError(err);
    }
  });

  ipcMain.handle("github:hasToken", async () => {
    return github.hasToken();
  });

  ipcMain.handle("github:clearToken", async () => {
    github.clearToken();
  });

  // Internal handler: store token from renderer after OAuth exchange
  ipcMain.handle("github:storeToken", async (_e, token: string, refreshToken?: string) => {
    github.storeToken(token);
    if (refreshToken) {
      github.storeRefreshToken(refreshToken);
    }
  });
}

/**
 * Converts GitHub API errors into serializable objects for IPC transport.
 * Never includes the token in error messages.
 */
function handleGitHubError(err: unknown): never {
  if (err instanceof GitHubAuthError) {
    throw new Error(`[AUTH] ${err.message}`);
  }
  if (err instanceof GitHubRateLimitError) {
    throw new Error(`[RATE_LIMIT] ${err.message}`);
  }
  if (err instanceof Error) {
    throw new Error(`[GITHUB_API] ${err.message}`);
  }
  throw new Error("[GITHUB_API] Unknown error occurred");
}
