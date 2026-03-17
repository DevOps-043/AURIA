/**
 * GitHub Service — Creación de PRs via API REST nativa (sin @octokit).
 * Adaptado de autodev-github.ts → sin WhatsApp, sin Electron.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PRResult {
  url: string;
  owner: string;
  repo: string;
}

export class GitHubService {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * Crea un Pull Request usando la API REST de GitHub.
   */
  async createPR(
    branch: string,
    title: string,
    body: string,
  ): Promise<PRResult> {
    const { owner, repo } = await this.getOwnerRepo();
    const token = await this.getToken();
    const base = await this.getBaseBranch();

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "AURIA-Worker",
        },
        body: JSON.stringify({
          title: title.startsWith("[AURIA]") ? title : `[AURIA] ${title}`,
          head: branch,
          base,
          body,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
      );
    }

    const data = (await response.json()) as { html_url: string };
    return { url: data.html_url, owner, repo };
  }

  private async getOwnerRepo(): Promise<{ owner: string; repo: string }> {
    const { stdout } = await execFileAsync(
      "git",
      ["config", "--get", "remote.origin.url"],
      { cwd: this.repoPath },
    );
    const match = stdout.match(/github\.com[:/](.+?)\/(.+?)(\.git)?\s*$/);
    if (!match) {
      throw new Error(
        "Could not determine GitHub owner/repo from remote origin.",
      );
    }
    return { owner: match[1], repo: match[2] };
  }

  private async getToken(): Promise<string> {
    const envToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (envToken) return envToken;

    try {
      const { stdout } = await execFileAsync("gh", ["auth", "token"], {
        cwd: this.repoPath,
      });
      return stdout.trim();
    } catch {
      throw new Error(
        "No GH_TOKEN in env and gh CLI not authenticated. Run: gh auth login",
      );
    }
  }

  private async getBaseBranch(): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["symbolic-ref", "refs/remotes/origin/HEAD"],
        { cwd: this.repoPath },
      );
      return stdout.trim().split("/").pop() || "main";
    } catch {
      return "main";
    }
  }
}
