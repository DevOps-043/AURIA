import { net } from "electron";
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

const GITHUB_API_BASE = "https://api.github.com";

interface SecureStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ─── GitHub REST API Client ──────────────────────────────────────────
// All calls go through the main process to keep tokens out of the renderer.
// Uses Electron's net module which respects system proxy settings.

export class GitHubAPI {
  private store: SecureStore;

  constructor(store: SecureStore) {
    this.store = store;
  }

  // ─── Token Management ──────────────────────────────────────────

  getToken(): string | null {
    return this.store.getItem("auria-github-token");
  }

  hasToken(): boolean {
    return this.getToken() !== null;
  }

  storeToken(token: string): void {
    this.store.setItem("auria-github-token", token);
  }

  storeRefreshToken(token: string): void {
    this.store.setItem("auria-github-refresh-token", token);
  }

  clearToken(): void {
    this.store.removeItem("auria-github-token");
    this.store.removeItem("auria-github-refresh-token");
  }

  // ─── API Calls ─────────────────────────────────────────────────

  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>("/user");
  }

  async listRepos(
    page: number,
    perPage: number,
    query?: string,
  ): Promise<GitHubListReposResult> {
    // If there's a search query, use the GitHub search API
    if (query && query.trim().length > 0) {
      return this.searchRepos(query.trim(), page, perPage);
    }

    const params = new URLSearchParams({
      visibility: "all",
      affiliation: "owner,collaborator,organization_member",
      sort: "updated",
      direction: "desc",
      page: String(page),
      per_page: String(perPage),
    });

    const response = await this.requestWithHeaders<GitHubRepo[]>(
      `/user/repos?${params}`,
    );

    const hasNextPage = this.parseLinkHeaderForNext(
      response.headers.get("link"),
    );

    return {
      repos: response.data,
      hasNextPage,
    };
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    const params = new URLSearchParams({
      per_page: "100",
    });
    return this.request<GitHubBranch[]>(
      `/repos/${owner}/${repo}/branches?${params}`,
    );
  }

  async compareRefs(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<GitHubCompareResult> {
    const encodedBase = encodeURIComponent(base);
    const encodedHead = encodeURIComponent(head);
    const response = await this.requestWithHeaders<GitHubCompareResponse>(
      `/repos/${owner}/${repo}/compare/${encodedBase}...${encodedHead}`,
    );

    return {
      status: response.data.status,
      ahead_by: response.data.ahead_by,
      behind_by: response.data.behind_by,
      total_commits: response.data.total_commits,
      base_branch: base,
      head_branch: head,
      files: (response.data.files ?? []).map((file) => ({
        filename: file.filename,
        previous_filename: file.previous_filename ?? null,
        status: file.status,
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
        changes: file.changes ?? 0,
        patch: file.patch ?? null,
      })),
      commits: (response.data.commits ?? []).map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        authorName: commit.commit.author?.name ?? null,
        authoredDate: commit.commit.author?.date ?? null,
      })),
    };
  }

  async listContents(
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

    const response = await this.requestWithHeaders<GitHubContentsDirectoryResponse>(
      `/repos/${owner}/${repo}/contents${suffix}${query}`,
      {
        accept: "application/vnd.github.object+json",
      },
    );

    return (response.data.entries ?? []).map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type,
      size: entry.size ?? 0,
      sha: entry.sha,
      html_url: entry.html_url ?? null,
      download_url: entry.download_url ?? null,
    }));
  }

  async listTree(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<GitHubRepoTreeEntry[]> {
    const normalizedRef = encodeURIComponent(ref);
    const response = await this.requestWithHeaders<GitHubTreeResponse>(
      `/repos/${owner}/${repo}/git/trees/${normalizedRef}?recursive=1`,
    );

    return (response.data.tree ?? [])
      .filter((entry): entry is GitHubTreeResponse["tree"][number] & { path: string; type: GitHubRepoTreeEntry["type"]; sha: string } =>
        Boolean(entry.path) &&
        (entry.type === "blob" || entry.type === "tree") &&
        Boolean(entry.sha),
      )
      .map((entry) => ({
        path: entry.path,
        type: entry.type,
        size: entry.size ?? 0,
        sha: entry.sha,
      }));
  }

  async getFileContent(
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

    const response = await this.requestWithHeaders<GitHubFileContentResponse>(
      `/repos/${owner}/${repo}/contents/${normalizedPath}${query}`,
      {
        accept: "application/vnd.github.object+json",
      },
    );

    if (response.data.type !== "file") {
      throw new GitHubApiRequestError(400, `Path "${path}" is not a file.`);
    }

    const decodedContent = response.data.content
      ? Buffer.from(response.data.content.replace(/\n/g, ""), "base64").toString("utf-8")
      : response.data.download_url
        ? await this.requestTextFromUrl(response.data.download_url)
        : "";

    return {
      name: response.data.name,
      path: response.data.path,
      sha: response.data.sha,
      size: response.data.size ?? decodedContent.length,
      content: decodedContent,
      encoding: response.data.encoding ?? "utf-8",
      html_url: response.data.html_url ?? null,
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private async searchRepos(
    query: string,
    page: number,
    perPage: number,
  ): Promise<GitHubListReposResult> {
    const params = new URLSearchParams({
      q: `${query} in:name fork:true`,
      sort: "updated",
      order: "desc",
      page: String(page),
      per_page: String(perPage),
    });

    const result = await this.request<{
      total_count: number;
      items: GitHubRepo[];
    }>(`/search/repositories?${params}`);

    return {
      repos: result.items,
      hasNextPage: result.total_count > page * perPage,
      totalCount: result.total_count,
    };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.requestWithHeaders<T>(path);
    return response.data;
  }

  private async requestWithHeaders<T>(
    path: string,
    options?: { accept?: string },
  ): Promise<{ data: T; headers: Headers }> {
    const token = this.getToken();
    if (!token) {
      throw new GitHubAuthError("No GitHub token available. Please connect your GitHub account.");
    }

    const url = `${GITHUB_API_BASE}${path}`;
    const response = await net.fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: options?.accept ?? "application/vnd.github.v3+json",
        "User-Agent": "AQELOR-Desktop",
      },
    });

    if (response.status === 401) {
      throw new GitHubAuthError("GitHub token expired or revoked. Please reconnect your GitHub account.");
    }

    if (response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        const resetAt = response.headers.get("x-ratelimit-reset");
        const resetDate = resetAt
          ? new Date(Number(resetAt) * 1000).toISOString()
          : "unknown";
        throw new GitHubRateLimitError(
          `GitHub API rate limit exceeded. Resets at ${resetDate}.`,
        );
      }
      throw new GitHubApiRequestError(403, "Forbidden: insufficient permissions.");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GitHubApiRequestError(
        response.status,
        `GitHub API error (${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as T;
    return { data, headers: response.headers };
  }

  private async requestTextFromUrl(url: string): Promise<string> {
    const token = this.getToken();
    if (!token) {
      throw new GitHubAuthError("No GitHub token available. Please connect your GitHub account.");
    }

    const response = await net.fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "AQELOR-Desktop",
      },
    });

    if (!response.ok) {
      throw new GitHubApiRequestError(
        response.status,
        `GitHub raw file request failed (${response.status}).`,
      );
    }

    return response.text();
  }

  private parseLinkHeaderForNext(linkHeader: string | null): boolean {
    if (!linkHeader) return false;
    return linkHeader.includes('rel="next"');
  }
}

interface GitHubContentsDirectoryResponse {
  entries?: Array<{
    name: string;
    path: string;
    type: GitHubRepoContentEntry["type"];
    size?: number;
    sha: string;
    html_url?: string | null;
    download_url?: string | null;
  }>;
}

interface GitHubTreeResponse {
  tree: Array<{
    path?: string;
    type?: "blob" | "tree" | "commit";
    sha?: string;
    size?: number;
  }>;
}

interface GitHubFileContentResponse {
  name: string;
  path: string;
  sha: string;
  size?: number;
  type: "file" | "dir" | "symlink" | "submodule";
  content?: string;
  encoding?: string;
  download_url?: string | null;
  html_url?: string | null;
}

interface GitHubCompareResponse {
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
}

// ─── Error Types ─────────────────────────────────────────────────────

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAuthError";
  }
}

export class GitHubRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

export class GitHubApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubApiRequestError";
    this.status = status;
  }
}
