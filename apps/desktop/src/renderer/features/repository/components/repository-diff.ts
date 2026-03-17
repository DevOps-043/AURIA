import type { GitHubCompareResult, GitHubCompareFileStatus } from "../../../../shared/github-types";

export type RepositoryDiffStatus = GitHubCompareFileStatus;

export interface RepositoryDiffFile {
  path: string;
  previousPath: string | null;
  status: RepositoryDiffStatus;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
  changedLines: number[];
}

export interface RepositoryDiffSummary {
  baseBranch: string;
  headBranch: string;
  status: GitHubCompareResult["status"];
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  files: RepositoryDiffFile[];
  filesByPath: Record<string, RepositoryDiffFile>;
  countsByStatus: Partial<Record<RepositoryDiffStatus, number>>;
}

export function createEmptyRepositoryDiffSummary(
  baseBranch: string,
  headBranch: string,
): RepositoryDiffSummary {
  return {
    baseBranch,
    headBranch,
    status: baseBranch === headBranch ? "identical" : "ahead",
    aheadBy: 0,
    behindBy: 0,
    totalCommits: 0,
    files: [],
    filesByPath: {},
    countsByStatus: {},
  };
}

export function buildRepositoryDiffSummary(
  result: GitHubCompareResult,
): RepositoryDiffSummary {
  const files = result.files.map<RepositoryDiffFile>((file) => ({
    path: file.filename,
    previousPath: file.previous_filename ?? null,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch ?? null,
    changedLines: parsePatchChangedLines(file.patch ?? null),
  }));

  const filesByPath = files.reduce<Record<string, RepositoryDiffFile>>((accumulator, file) => {
    accumulator[file.path] = file;
    return accumulator;
  }, {});

  const countsByStatus = files.reduce<Partial<Record<RepositoryDiffStatus, number>>>((accumulator, file) => {
    accumulator[file.status] = (accumulator[file.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    baseBranch: result.base_branch,
    headBranch: result.head_branch,
    status: result.status,
    aheadBy: result.ahead_by,
    behindBy: result.behind_by,
    totalCommits: result.total_commits,
    files,
    filesByPath,
    countsByStatus,
  };
}

function parsePatchChangedLines(patch: string | null): number[] {
  if (!patch) {
    return [];
  }

  const changedLines = new Set<number>();
  const patchLines = patch.split("\n");
  let nextLineNumber = 0;

  for (const line of patchLines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (!match) {
        continue;
      }

      nextLineNumber = Number(match[1]);
      continue;
    }

    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    }

    if (line.startsWith("+")) {
      changedLines.add(nextLineNumber);
      nextLineNumber += 1;
      continue;
    }

    if (line.startsWith("-")) {
      continue;
    }

    nextLineNumber += 1;
  }

  return Array.from(changedLines).sort((left, right) => left - right);
}
