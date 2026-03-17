/**
 * Safety Guards — 18 guards de seguridad consolidados como funciones puras.
 * Sin I/O, sin dependencias de runtime. Solo lógica de validación.
 *
 * Re-exporta los policy guards existentes para un punto de acceso unificado.
 */
import type {
  Improvement,
  ParsedBuildError,
  PolicySettings,
  SafetyGuardResult,
} from "@auria/contracts";

// Re-export existing policy guards
export {
  touchesCriticalPath,
  requiresHumanReview,
  canAutoExecuteMission,
} from "./policy-guards.ts";

// ─── Constants ─────────────────────────────────────────────────────

export const PROTECTED_BRANCHES = ["main", "master"] as const;

export const IGNORE_DIRS = [
  "node_modules",
  "dist",
  "dist-electron",
  ".git",
  "build",
  "coverage",
] as const;

const PROTECTED_PACKAGES = [
  "react",
  "react-dom",
  "vite",
  "electron",
  "typescript",
  "@electron/rebuild",
  "@electron-toolkit/preload",
  "@electron-toolkit/utils",
  "electron-builder",
  "electron-vite",
];

export const MAX_TOTAL_CHARS = 300_000;
export const MAX_FILE_CHARS = 25_000;

// ─── 1. Protected Branch Guard ─────────────────────────────────────

export function isProtectedBranch(branch: string): SafetyGuardResult {
  const passed = !PROTECTED_BRANCHES.includes(
    branch as (typeof PROTECTED_BRANCHES)[number],
  );
  return {
    guard: "protected-branch",
    passed,
    reason: passed
      ? `Branch "${branch}" is not protected.`
      : `Branch "${branch}" is protected. Refusing write operation.`,
  };
}

// ─── 2. Phantom Import Detection ───────────────────────────────────

export function findPhantomImports(
  code: string,
  existingFiles: Set<string>,
  filePath: string,
): string[] {
  const phantoms: string[] = [];
  const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const resolved = resolvePath(dir, importPath);
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".json"];
    const found =
      extensions.some((ext) => existingFiles.has(resolved + ext)) ||
      existingFiles.has(resolved + "/index.ts") ||
      existingFiles.has(resolved + "/index.tsx") ||
      existingFiles.has(resolved + "/index.js");
    if (!found) {
      phantoms.push(importPath);
    }
  }
  return phantoms;
}

function resolvePath(base: string, relative: string): string {
  const parts = base.split("/").filter(Boolean);
  for (const segment of relative.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

// ─── 3. Code Completeness Check ────────────────────────────────────

export function isCodeComplete(code: string): SafetyGuardResult {
  if (
    code.endsWith("// ...") ||
    code.endsWith("...") ||
    code.endsWith("// TODO")
  ) {
    return {
      guard: "code-completeness",
      passed: false,
      reason: "Code ends with truncation marker (// ..., ..., or // TODO).",
    };
  }

  let braceCount = 0;
  let inString = false;
  let stringChar = "";
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inComment) {
      if (ch === "*" && next === "/") {
        inComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "{") braceCount++;
    if (ch === "}") braceCount--;
  }

  if (braceCount > 2) {
    return {
      guard: "code-completeness",
      passed: false,
      reason: `Unbalanced braces detected (${braceCount} unclosed). Code appears truncated.`,
    };
  }
  return { guard: "code-completeness", passed: true, reason: "Code is complete." };
}

// ─── 4. Build Error Parsing ────────────────────────────────────────

export function parseBuildErrors(buildOutput: string): ParsedBuildError[] {
  const errors: ParsedBuildError[] = [];
  const seen = new Set<string>();

  const tsPatterns = [
    /([^\s(]+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g,
    /([^\s(]+\.tsx?)[:.](\d+)[:.](\d+)\s*[-–]\s*error\s+(TS\d+):\s*(.+)/g,
    /ERROR.*?([^\s]+\.tsx?):(\d+):(\d+)/g,
  ];

  for (const pattern of tsPatterns) {
    let match;
    while ((match = pattern.exec(buildOutput)) !== null) {
      const key = `${match[1]}:${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({
        file: match[1].replace(/\\/g, "/"),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10) || undefined,
        code: match[4] || undefined,
        message: match[5]?.trim() || "Unknown error",
      });
    }
  }

  if (errors.length === 0) {
    const vitePatterns = [
      /(?:Rollup|vite).*?failed to resolve import\s+"([^"]+)"\s+in\s+"([^"]+)"/gi,
      /Could not resolve\s+"([^"]+)"\s+(?:from|in)\s+"([^"]+)"/gi,
      /(?:RollupError|Error):\s*(.+?)\s+in\s+([^\s]+\.tsx?)/gi,
      /\[vite\].*?(?:error|Error)\s+(.+?)(?:\s+at\s+([^\s]+\.tsx?))?/gi,
      /✘\s*\[ERROR\]\s*(.+)/gi,
    ];

    for (const pattern of vitePatterns) {
      let match;
      while ((match = pattern.exec(buildOutput)) !== null) {
        const file = (match[2] || "unknown").replace(/\\/g, "/");
        const message =
          match[1]?.trim() || match[0]?.trim() || "Vite/Rollup error";
        const key = `vite:${file}:${message.slice(0, 50)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        errors.push({ file, message: `[Vite/Rollup] ${message}`, code: "VITE_ERR" });
      }
    }

    if (
      errors.length === 0 &&
      /build failed|error during build|rollup.*error/i.test(buildOutput)
    ) {
      errors.push({
        file: "unknown",
        message: `Build failed with unparsed error. Raw output: ${buildOutput.slice(0, 2000)}`,
        code: "BUILD_FAIL",
      });
    }
  }

  return errors;
}

// ─── 5. Major Version Bump Detection ───────────────────────────────

export function hasMajorVersionBump(
  oldContent: string,
  newContent: string,
): SafetyGuardResult {
  try {
    const oldPkg = JSON.parse(oldContent);
    const newPkg = JSON.parse(newContent);

    for (const section of ["dependencies", "devDependencies"] as const) {
      const oldDeps = oldPkg[section] || {};
      const newDeps = newPkg[section] || {};
      for (const pkg of Object.keys(newDeps)) {
        if (!oldDeps[pkg]) continue;
        const oldMajor = (oldDeps[pkg] as string)
          .replace(/[\^~>=<\s]/g, "")
          .split(".")[0];
        const newMajor = (newDeps[pkg] as string)
          .replace(/[\^~>=<\s]/g, "")
          .split(".")[0];
        if (
          oldMajor !== newMajor &&
          (PROTECTED_PACKAGES.includes(pkg) ||
            parseInt(newMajor) > parseInt(oldMajor))
        ) {
          return {
            guard: "major-version-bump",
            passed: false,
            reason: `Major version bump detected: ${pkg} ${oldDeps[pkg]} → ${newDeps[pkg]}.`,
          };
        }
      }
    }
  } catch {
    return {
      guard: "major-version-bump",
      passed: false,
      reason: "Could not parse package.json for version comparison.",
    };
  }
  return { guard: "major-version-bump", passed: true, reason: "No major bumps." };
}

// ─── 6. Dependency-Dominated Plan Filter ───────────────────────────

export function isDependencyDominated(
  improvements: Improvement[],
): SafetyGuardResult {
  if (improvements.length === 0) {
    return { guard: "dependency-domination", passed: true, reason: "No improvements." };
  }
  const depCount = improvements.filter(
    (i) => i.category === "dependencies",
  ).length;
  const ratio = depCount / improvements.length;
  const passed = ratio <= 0.5;
  return {
    guard: "dependency-domination",
    passed,
    reason: passed
      ? `Dependency ratio ${(ratio * 100).toFixed(0)}% is within limit.`
      : `${(ratio * 100).toFixed(0)}% of improvements are dependencies (max 50%). Run rejected.`,
  };
}

// ─── 7. Feature Ratio Gate ─────────────────────────────────────────

export function hasMinimumFeatureRatio(
  improvements: Improvement[],
  minRatio = 0.7,
): SafetyGuardResult {
  if (improvements.length === 0) {
    return { guard: "feature-ratio", passed: true, reason: "No improvements." };
  }
  const featureCount = improvements.filter(
    (i) => i.category === "features",
  ).length;
  const ratio = featureCount / improvements.length;
  const passed = ratio >= minRatio;
  return {
    guard: "feature-ratio",
    passed,
    reason: passed
      ? `Feature ratio ${(ratio * 100).toFixed(0)}% meets minimum ${(minRatio * 100).toFixed(0)}%.`
      : `Feature ratio ${(ratio * 100).toFixed(0)}% below minimum ${(minRatio * 100).toFixed(0)}%.`,
  };
}

// ─── 8. Max Lines Changed Guard ────────────────────────────────────

export function isWithinLineLimit(
  linesChanged: number,
  maxLines: number,
): SafetyGuardResult {
  const passed = linesChanged <= maxLines;
  return {
    guard: "max-lines",
    passed,
    reason: passed
      ? `${linesChanged} lines within limit of ${maxLines}.`
      : `${linesChanged} lines exceeds limit of ${maxLines}.`,
  };
}

// ─── 9. Max Files Guard ────────────────────────────────────────────

export function isWithinFileLimit(
  filesCount: number,
  maxFiles: number,
): SafetyGuardResult {
  const passed = filesCount <= maxFiles;
  return {
    guard: "max-files",
    passed,
    reason: passed
      ? `${filesCount} files within limit of ${maxFiles}.`
      : `${filesCount} files exceeds limit of ${maxFiles}.`,
  };
}

// ─── 10. Daily Run Limit ───────────────────────────────────────────

export function isWithinDailyRunLimit(
  runsToday: number,
  maxDailyRuns: number,
): SafetyGuardResult {
  const passed = runsToday < maxDailyRuns;
  return {
    guard: "daily-run-limit",
    passed,
    reason: passed
      ? `${runsToday}/${maxDailyRuns} runs today.`
      : `Daily limit reached: ${runsToday}/${maxDailyRuns} runs.`,
  };
}

// ─── 11. Daily Micro-Run Limit ─────────────────────────────────────

export function isWithinDailyMicroRunLimit(
  microRunsToday: number,
  maxDailyMicroRuns: number,
): SafetyGuardResult {
  const passed = microRunsToday < maxDailyMicroRuns;
  return {
    guard: "daily-micro-run-limit",
    passed,
    reason: passed
      ? `${microRunsToday}/${maxDailyMicroRuns} micro-runs today.`
      : `Daily micro-run limit reached: ${microRunsToday}/${maxDailyMicroRuns}.`,
  };
}

// ─── 12. Research Query Limit ──────────────────────────────────────

export function isWithinResearchQueryLimit(
  queriesUsed: number,
  maxQueries: number,
): SafetyGuardResult {
  const passed = queriesUsed < maxQueries;
  return {
    guard: "research-query-limit",
    passed,
    reason: passed
      ? `${queriesUsed}/${maxQueries} research queries used.`
      : `Research query limit reached: ${queriesUsed}/${maxQueries}.`,
  };
}

// ─── 13. Blocked Paths Guard ───────────────────────────────────────

export function isPathAllowed(
  filePath: string,
  policies: PolicySettings,
): SafetyGuardResult {
  const isBlocked = policies.blockedPaths.some((blocked) =>
    filePath.startsWith(blocked),
  );
  if (isBlocked) {
    return {
      guard: "blocked-path",
      passed: false,
      reason: `Path "${filePath}" is in the blocked paths list.`,
    };
  }
  if (policies.allowedPaths.length > 0) {
    const isAllowed = policies.allowedPaths.some((allowed) =>
      filePath.startsWith(allowed),
    );
    if (!isAllowed) {
      return {
        guard: "blocked-path",
        passed: false,
        reason: `Path "${filePath}" is not in the allowed paths list.`,
      };
    }
  }
  return { guard: "blocked-path", passed: true, reason: "Path is allowed." };
}

// ─── 14. Blocked File Types Guard ──────────────────────────────────

export function isFileTypeAllowed(
  filePath: string,
  policies: PolicySettings,
): SafetyGuardResult {
  const ext = filePath.substring(filePath.lastIndexOf("."));
  if (policies.blockedFileTypes.includes(ext)) {
    return {
      guard: "blocked-file-type",
      passed: false,
      reason: `File type "${ext}" is blocked.`,
    };
  }
  if (
    policies.allowedFileTypes.length > 0 &&
    !policies.allowedFileTypes.includes(ext)
  ) {
    return {
      guard: "blocked-file-type",
      passed: false,
      reason: `File type "${ext}" is not in the allowed list.`,
    };
  }
  return { guard: "blocked-file-type", passed: true, reason: "File type allowed." };
}

// ─── 15. Merge Conflict Markers ────────────────────────────────────

export function hasMergeConflictMarkers(code: string): SafetyGuardResult {
  const hasMarkers =
    code.includes("<<<<<<<") ||
    code.includes(">>>>>>>") ||
    code.includes("=======\n");
  return {
    guard: "merge-conflict",
    passed: !hasMarkers,
    reason: hasMarkers
      ? "Code contains merge conflict markers."
      : "No merge conflict markers found.",
  };
}

// ─── 16. Destructive Rewrite Blocker ───────────────────────────────

export function isNotDestructiveRewrite(
  originalSize: number,
  newSize: number,
): SafetyGuardResult {
  if (originalSize === 0) {
    return {
      guard: "destructive-rewrite",
      passed: true,
      reason: "New file, no original to compare.",
    };
  }
  const ratio = newSize / originalSize;
  const passed = ratio >= 0.4;
  return {
    guard: "destructive-rewrite",
    passed,
    reason: passed
      ? `Size ratio ${(ratio * 100).toFixed(0)}% is acceptable.`
      : `New file is ${(ratio * 100).toFixed(0)}% of original (min 40%). Destructive rewrite blocked.`,
  };
}

// ─── 17. File Size Guard ───────────────────────────────────────────

export function isFileSizeAcceptable(
  contentLength: number,
): SafetyGuardResult {
  const passed = contentLength <= MAX_FILE_CHARS;
  return {
    guard: "file-size",
    passed,
    reason: passed
      ? `File size ${contentLength} chars within ${MAX_FILE_CHARS} limit.`
      : `File size ${contentLength} chars exceeds ${MAX_FILE_CHARS} limit.`,
  };
}

// ─── 18. Orphan File Detection ─────────────────────────────────────

export function detectOrphanFiles(
  newFiles: string[],
  allImports: Set<string>,
): SafetyGuardResult {
  const orphans = newFiles.filter((f) => !allImports.has(f));
  const passed = orphans.length === 0;
  return {
    guard: "orphan-files",
    passed,
    reason: passed
      ? "All new files are imported somewhere."
      : `Orphan files detected (not imported anywhere): ${orphans.join(", ")}`,
  };
}

// ─── Batch Guard Runner ────────────────────────────────────────────

export function runGuards(
  guards: SafetyGuardResult[],
): { allPassed: boolean; failed: SafetyGuardResult[] } {
  const failed = guards.filter((g) => !g.passed);
  return { allPassed: failed.length === 0, failed };
}
