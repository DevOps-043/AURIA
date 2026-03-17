/**
 * Git Service — Wrapper de Git con safety guards.
 * Usa execFile (no exec) para prevenir shell injection.
 * Adaptado de autodev-git.ts → sin dependencia de Electron.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROTECTED_BRANCHES = ["main", "master"];

export class GitService {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  // ─── Internal ──────────────────────────────────────────────────

  private async run(cmd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(cmd, args, {
      cwd: this.repoPath,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60_000,
    });
    return stdout.trim();
  }

  private async git(...args: string[]): Promise<string> {
    return this.run("git", args);
  }

  private async assertNotProtected(): Promise<void> {
    const branch = await this.getCurrentBranch();
    if (PROTECTED_BRANCHES.includes(branch)) {
      throw new Error(
        `[GitService] SAFETY: Refusing write operation on protected branch "${branch}"`,
      );
    }
  }

  // ─── Read-only operations ──────────────────────────────────────

  async getCurrentBranch(): Promise<string> {
    return this.git("rev-parse", "--abbrev-ref", "HEAD");
  }

  async getRepoRoot(): Promise<string> {
    return this.git("rev-parse", "--show-toplevel");
  }

  async getDiffStat(): Promise<string> {
    return this.git("diff", "--cached", "--stat");
  }

  async getFullDiff(): Promise<string> {
    return this.git("diff", "--cached");
  }

  async getDiffLineCount(): Promise<number> {
    try {
      const stat = await this.git(
        "diff", "--cached", "--shortstat",
        "--", ".", ":!package-lock.json", ":!yarn.lock",
      );
      const insertionsMatch = stat.match(/(\d+) insertion/);
      const deletionsMatch = stat.match(/(\d+) deletion/);
      const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
      const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;
      return insertions + deletions;
    } catch {
      return 0;
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git("status", "--porcelain");
    return status.length > 0;
  }

  async hasRemote(): Promise<boolean> {
    try {
      const remotes = await this.git("remote", "-v");
      return remotes.includes("origin");
    } catch {
      return false;
    }
  }

  async isGhAuthenticated(): Promise<boolean> {
    try {
      await this.run("gh", ["auth", "status"]);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Write operations (guarded) ────────────────────────────────

  async createWorkBranch(
    name: string,
    baseBranch: string = "main",
    prefix: string = "auria/",
  ): Promise<string> {
    const branchName = name.startsWith(prefix)
      ? name
      : `${prefix}${name}`;

    const current = await this.getCurrentBranch();
    if (current !== baseBranch) {
      try {
        await this.git("checkout", baseBranch);
      } catch {
        try {
          await this.git("stash");
          await this.git("checkout", baseBranch);
        } catch (err: any) {
          console.warn(
            `[GitService] Could not switch to ${baseBranch}: ${err.message}`,
          );
        }
      }
    }

    try {
      await this.git("pull", "origin", baseBranch, "--ff-only");
    } catch {
      // Pull may fail if no remote, that's ok
    }

    try {
      await this.git("branch", "-D", branchName);
    } catch {
      // Branch didn't exist
    }

    let finalBranchName = branchName;
    try {
      await this.git("checkout", "-b", finalBranchName);
    } catch {
      finalBranchName = `${branchName}-${Date.now()}`;
      await this.git("checkout", "-b", finalBranchName);
    }

    return finalBranchName;
  }

  async stageFiles(files: string[]): Promise<void> {
    await this.assertNotProtected();
    if (files.length === 0) return;
    await this.git("add", ...files);
  }

  async stageAll(): Promise<void> {
    await this.assertNotProtected();
    await this.git("add", "-A");
  }

  async commitChanges(message: string): Promise<string> {
    await this.assertNotProtected();
    const fullMessage = message.startsWith("[AURIA]")
      ? message
      : `[AURIA] ${message}`;
    await this.git("commit", "-m", fullMessage);
    const hash = await this.git("rev-parse", "--short", "HEAD");
    return hash;
  }

  async pushBranch(branchName: string): Promise<void> {
    await this.assertNotProtected();
    if (PROTECTED_BRANCHES.includes(branchName)) {
      throw new Error(
        `[GitService] SAFETY: Refusing to push to protected branch "${branchName}"`,
      );
    }
    await this.git("push", "-u", "origin", branchName);
  }

  async createPR(
    title: string,
    body: string,
    baseBranch: string,
  ): Promise<string> {
    const prTitle = title.startsWith("[AURIA]")
      ? title
      : `[AURIA] ${title}`;
    const result = await this.run("gh", [
      "pr", "create",
      "--title", prTitle,
      "--body", body,
      "--base", baseBranch,
    ]);
    return result.trim().split("\n").pop() || result.trim();
  }

  async switchBranch(name: string): Promise<void> {
    await this.git("checkout", name);
  }

  async cleanupBranch(branchName: string): Promise<void> {
    if (PROTECTED_BRANCHES.includes(branchName)) return;
    try {
      const current = await this.getCurrentBranch();
      if (current === branchName) {
        await this.git("reset", "--hard", "HEAD");
        await this.git("clean", "-fd");
        await this.git("checkout", "main");
      }
      await this.git("branch", "-D", branchName);
    } catch (err: any) {
      console.warn(`[GitService] Cleanup warning: ${err.message}`);
    }
  }
}
