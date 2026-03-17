/**
 * File Reader Service — Lee archivos del proyecto con budget de caracteres.
 * Adaptado de autodev-helpers.ts → soporte monorepo.
 */
import fs from "node:fs";
import path from "node:path";

const MAX_TOTAL_CHARS = 300_000;
const MAX_FILE_CHARS = 25_000;

const IGNORE_DIRS = [
  "node_modules",
  "dist",
  "dist-electron",
  ".git",
  "build",
  "coverage",
  ".next",
  ".turbo",
];

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Lee archivos del proyecto con un presupuesto de caracteres.
 * Prioriza archivos en directorios clave del monorepo.
 */
export function readProjectFiles(
  repoPath: string,
): Array<{ path: string; content: string }> {
  const allFiles: Array<{ path: string; size: number; priority: number }> = [];

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(repoPath, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (
          !IGNORE_DIRS.some(
            (d) => relPath.startsWith(d) || entry.name === d,
          )
        ) {
          walk(fullPath);
        }
        continue;
      }

      const ext = path.extname(entry.name);
      if (!CODE_EXTENSIONS.includes(ext)) continue;
      if (entry.name.endsWith(".d.ts")) continue;

      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > 500_000) continue;

        // Monorepo priority: packages/domain > packages/ > apps/ > supabase/ > rest
        let priority = 4;
        if (relPath.startsWith("packages/domain/")) priority = 0;
        else if (relPath.startsWith("packages/")) priority = 1;
        else if (relPath.startsWith("apps/")) priority = 2;
        else if (relPath.startsWith("supabase/")) priority = 3;

        allFiles.push({ path: relPath, size: stat.size, priority });
      } catch {
        /* skip */
      }
    }
  };

  walk(repoPath);
  allFiles.sort((a, b) => a.priority - b.priority || a.size - b.size);

  const files: Array<{ path: string; content: string }> = [];
  let totalChars = 0;

  for (const f of allFiles) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    try {
      const fullPath = path.join(repoPath, f.path);
      let content = fs.readFileSync(fullPath, "utf-8");
      if (content.length > MAX_FILE_CHARS) {
        content =
          content.slice(0, MAX_FILE_CHARS) +
          "\n// ... [truncated — file too large]";
      }
      const remaining = MAX_TOTAL_CHARS - totalChars;
      if (content.length > remaining) {
        content =
          content.slice(0, remaining) +
          "\n// ... [truncated — budget limit]";
      }
      files.push({ path: f.path, content });
      totalChars += content.length;
    } catch {
      /* skip */
    }
  }

  return files;
}

/**
 * Lee la lista de dependencias de package.json.
 */
export function getDependenciesList(repoPath: string): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoPath, "package.json"), "utf-8"),
    );
    return Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
      .map(([n, v]) => `${n}@${v}`)
      .join("\n");
  } catch {
    return "Could not read package.json";
  }
}

/**
 * Genera un set de todas las rutas de archivos existentes (para phantom import detection).
 */
export function buildFileIndex(repoPath: string): Set<string> {
  const files = new Set<string>();
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(repoPath, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.some((d) => entry.name === d)) walk(fullPath);
      } else {
        files.add(relPath);
      }
    }
  };
  walk(repoPath);
  return files;
}
