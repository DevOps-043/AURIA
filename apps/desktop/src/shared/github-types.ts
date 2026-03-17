// ─── GitHub API Response Types ──────────────────────────────────────
// Shared between main process, preload bridge, and renderer.
// These types mirror the relevant subset of the GitHub REST API v3.

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

export interface GitHubRepoOwner {
  login: string;
  avatar_url: string;
  type: "User" | "Organization";
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubRepoOwner;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  updated_at: string;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
}

export type GitHubCompareStatus = "ahead" | "behind" | "diverged" | "identical";

export type GitHubCompareFileStatus =
  | "added"
  | "modified"
  | "removed"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export type GitHubRepoContentType = "file" | "dir" | "symlink" | "submodule";

export interface GitHubRepoContentEntry {
  name: string;
  path: string;
  type: GitHubRepoContentType;
  size: number;
  sha: string;
  html_url: string | null;
  download_url: string | null;
}

export type GitHubRepoTreeEntryType = "blob" | "tree";

export interface GitHubRepoTreeEntry {
  path: string;
  type: GitHubRepoTreeEntryType;
  size: number;
  sha: string;
}

export interface GitHubRepoFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  html_url: string | null;
}

export interface GitHubCompareFile {
  filename: string;
  previous_filename?: string | null;
  status: GitHubCompareFileStatus;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | null;
}

export interface GitHubCompareCommit {
  sha: string;
  message: string;
  authorName: string | null;
  authoredDate: string | null;
}

export interface GitHubCompareResult {
  status: GitHubCompareStatus;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  base_branch: string;
  head_branch: string;
  files: GitHubCompareFile[];
  commits: GitHubCompareCommit[];
}

export interface GitHubListReposResult {
  repos: GitHubRepo[];
  hasNextPage: boolean;
  totalCount?: number;
}

export interface GitHubApiError {
  status: number;
  message: string;
}
