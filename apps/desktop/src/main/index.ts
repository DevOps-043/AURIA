import { app, BrowserWindow, dialog, ipcMain, safeStorage, session as electronSession } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { createDemoWorkspaceSnapshot } from "@auria/domain";
import { runtimeHealthSchema } from "@auria/contracts";
import { registerGitHubHandlers } from "./github-handlers";

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
if (isDev) {
  const tempDir = process.env.TEMP ?? process.env.TMP ?? app.getPath("temp");
  const devUserDataDir = join(tempDir, "auria-desktop-dev");
  const devDiskCacheDir = join(devUserDataDir, "cache");

  app.setPath("userData", devUserDataDir);
  app.commandLine.appendSwitch("disable-http-cache");
  app.commandLine.appendSwitch("disk-cache-dir", devDiskCacheDir);
}

let mainWindow: BrowserWindow | null = null;
let workspaceSnapshot = createDemoWorkspaceSnapshot();
const RENDERER_LOAD_RETRY_MS = [150, 300, 600, 1_200, 2_000];

// ─── Deep Link Protocol (OAuth callback) ────────────────────────────
// Register 'auria' as a custom protocol so GitHub OAuth can redirect
// back to the app via aqelor://auth/callback?code=XXXX
const PROTOCOL = "aqelor";
const OAUTH_CALLBACK_PREFIX = `${PROTOCOL}://auth/callback`;

if (process.defaultApp) {
  // In dev, need to pass the app path for protocol registration
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      join(__dirname, ".."),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Ensure single instance — required for deep link handling on Windows/Linux
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

/**
 * Extracts the OAuth authorization code from a deep link URL.
 * Validates the URL matches the expected callback pattern before parsing.
 */
function extractOAuthCode(deepLinkUrl: string): string | null {
  if (!deepLinkUrl.startsWith(OAUTH_CALLBACK_PREFIX)) return null;

  try {
    // Deep links may have the format aqelor://auth/callback?code=XXX
    // URL constructor needs a valid base for protocol-relative URLs
    const url = new URL(deepLinkUrl.replace(`${PROTOCOL}://`, "https://"));
    return url.searchParams.get("code");
  } catch {
    return null;
  }
}

/**
 * Forwards the OAuth code to the renderer process for session exchange.
 */
function handleDeepLink(url: string): void {
  const code = extractOAuthCode(url);
  if (code && mainWindow) {
    mainWindow.webContents.send("auth:oauth-callback", code);

    // Bring the app window to front after OAuth redirect
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

// ─── OAuth Window (in-app browser for GitHub authorization) ─────────
// Opens a dedicated BrowserWindow for the OAuth flow. Registers a
// protocol handler for 'aqelor://' in the window's session so that
// when Supabase redirects to aqelor://auth/callback?code=XXX, the
// handler fires, extracts the code, and sends it to the renderer.
//
// Why protocol.handle? Because webRequest.onBeforeRequest with URL
// pattern filters does NOT match custom protocols — only http/https.

let oauthWindow: BrowserWindow | null = null;

function openOAuthWindow(oauthUrl: string): void {
  if (oauthWindow) {
    oauthWindow.focus();
    return;
  }

  // Use a dedicated partition so the protocol handler doesn't leak
  // into the main window's session or persist cookies across flows.
  const oauthSession = electronSession.fromPartition("oauth-github");

  // Register our custom protocol in this session. When Supabase
  // redirects to aqelor://auth/callback?code=XXX, this handler fires.
  oauthSession.protocol.handle(PROTOCOL, (request) => {
    const url = request.url;
    console.log("[OAuth] Protocol handler fired with URL:", url);

    try {
      const parsed = new URL(url.replace(`${PROTOCOL}://`, "https://"));
      const code = parsed.searchParams.get("code");
      console.log("[OAuth] Extracted code:", code ? `${code.slice(0, 8)}...` : "null");

      if (code && mainWindow) {
        mainWindow.webContents.send("auth:oauth-callback", code);
        console.log("[OAuth] Code sent to renderer via IPC");
      } else {
        console.warn("[OAuth] Missing code or mainWindow", { hasCode: !!code, hasMainWindow: !!mainWindow });
      }
    } catch (err) {
      console.error("[OAuth] URL parsing failed:", err);
    }

    // Close the OAuth window after capturing the code
    setImmediate(() => oauthWindow?.close());

    // Return an empty response (the window is closing anyway)
    return new Response("", { status: 200 });
  });

  oauthWindow = new BrowserWindow({
    width: 600,
    height: 700,
    parent: mainWindow ?? undefined,
    modal: false,
    title: "Sign in with GitHub — AQELOR",
    backgroundColor: "#24292f",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      session: oauthSession,
    },
  });

  oauthWindow.loadURL(oauthUrl);

  oauthWindow.on("closed", () => {
    oauthWindow = null;
    // Unregister the protocol handler to avoid leaks
    oauthSession.protocol.unhandle(PROTOCOL);
  });
}

// ─── Secure Token Storage (Electron safeStorage) ─────────────────────
// Tokens are encrypted at rest using the OS keychain (DPAPI on Windows,
// Keychain on macOS, libsecret on Linux). This prevents reading tokens
// from disk even if the filesystem is compromised.

const getSecureStoragePath = () => {
  const dir = join(app.getPath("userData"), "secure");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
};

const secureStore = {
  getItem(key: string): string | null {
    try {
      const filePath = join(getSecureStoragePath(), `${key}.enc`);
      if (!existsSync(filePath)) return null;

      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = readFileSync(filePath);
        return safeStorage.decryptString(encrypted);
      }
      // Fallback if encryption unavailable (rare)
      return readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      const filePath = join(getSecureStoragePath(), `${key}.enc`);
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value);
        writeFileSync(filePath, encrypted);
      } else {
        writeFileSync(filePath, value, "utf-8");
      }
    } catch {
      // Silent fail — session won't persist but app still works
    }
  },

  removeItem(key: string): void {
    try {
      const filePath = join(getSecureStoragePath(), `${key}.enc`);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // Silent fail
    }
  },
};

const getPreloadPath = () => join(__dirname, "../preload/index.cjs");

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function getRendererUrl(): string | null {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (!rendererUrl) return null;

  try {
    const parsed = new URL(rendererUrl);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.toString();
  } catch {
    return rendererUrl;
  }
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  const rendererUrl = getRendererUrl();
  if (!rendererUrl) {
    await window.loadFile(join(__dirname, "../renderer/index.html"));
    return;
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < RENDERER_LOAD_RETRY_MS.length; attempt += 1) {
    try {
      await window.loadURL(rendererUrl);
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `[Window] Renderer load failed (attempt ${attempt + 1}/${RENDERER_LOAD_RETRY_MS.length})`,
        error,
      );

      if (attempt < RENDERER_LOAD_RETRY_MS.length - 1) {
        await wait(RENDERER_LOAD_RETRY_MS[attempt]);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Renderer failed to load after multiple attempts.");
}

function attachWindowDiagnostics(window: BrowserWindow): void {
  window.webContents.on("did-start-loading", () => {
    console.log("[Window] did-start-loading");
  });

  window.webContents.on("dom-ready", async () => {
    console.log("[Window] dom-ready");

    try {
      const snapshot = await window.webContents.executeJavaScript(`
        (() => ({
          href: window.location.href,
          readyState: document.readyState,
          rootExists: Boolean(document.getElementById("root")),
          rootChildCount: document.getElementById("root")?.childElementCount ?? 0,
          bodyClass: document.body.className,
          bodyTextLength: document.body.innerText.length,
          htmlClass: document.documentElement.className,
        }))()
      `);
      console.log("[Window] dom snapshot", snapshot);
    } catch (error) {
      console.error("[Window] failed to inspect DOM:", error);
    }
  });

  window.webContents.on("did-finish-load", () => {
    console.log("[Window] did-finish-load", window.webContents.getURL());
  });

  window.webContents.on("did-stop-loading", () => {
    console.log("[Window] did-stop-loading");
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error("[Window] did-fail-load", {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    },
  );

  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Window] render-process-gone", details);
  });

  window.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      console.log("[Renderer console]", { level, message, line, sourceId });
    },
  );
}

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    backgroundColor: "#0B0F14",
    title: "Auria",
    autoHideMenuBar: true,
    center: true,
    show: false, // Show when ready to prevent flicker
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  attachWindowDiagnostics(mainWindow);

  await loadRenderer(mainWindow);

  // Open DevTools in development after the renderer has mounted.
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

// ─── Worker state (demo mode) ─────────────────────────────────────
let workerRunning = false;
let workerCurrentPhase: string | null = null;
let workerCurrentRunId: string | null = null;

const registerIpcHandlers = () => {
  // ─── Secure Storage IPC (encrypted token persistence) ───────────
  ipcMain.handle("secureStorage:getItem", (_e, key: string) =>
    secureStore.getItem(key),
  );
  ipcMain.handle("secureStorage:setItem", (_e, key: string, value: string) =>
    secureStore.setItem(key, value),
  );
  ipcMain.handle("secureStorage:removeItem", (_e, key: string) =>
    secureStore.removeItem(key),
  );

  // ─── OAuth Window IPC ────────────────────────────────────────────
  ipcMain.handle("auth:openOAuthWindow", (_e, oauthUrl: string) => {
    openOAuthWindow(oauthUrl);
  });

  ipcMain.handle("window:setSize", (_e, width: number, height: number) => {
    if (mainWindow) {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(width, 300);
      mainWindow.setContentSize(width, height, false);
      mainWindow.center();
    }
  });

  ipcMain.handle("window:maximize", () => {
    if (mainWindow) {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(800, 600);
      mainWindow.maximize();
    }
  });

  ipcMain.handle("window:unmaximize", () => {
    if (mainWindow) {
      mainWindow.unmaximize();
      mainWindow.setContentSize(540, 740, false);
      mainWindow.center();
    }
  });

  ipcMain.handle("workspace:getSnapshot", async () => workspaceSnapshot);

  ipcMain.handle("workspace:pickRepositoryDirectory", async () => {
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select a repository folder",
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return workspaceSnapshot.localRepositoryPath;
    }

    const [selectedPath] = result.filePaths;
    workspaceSnapshot = {
      ...workspaceSnapshot,
      localRepositoryPath: selectedPath,
      mode: workspaceSnapshot.mode === "cloud" ? "hybrid" : workspaceSnapshot.mode,
    };

    return selectedPath;
  });

  ipcMain.handle("runtime:getHealth", async () =>
    runtimeHealthSchema.parse({
      appVersion: app.getVersion(),
      platform: process.platform,
      workerMode: workspaceSnapshot.mode,
      workerStatus: "ready",
      lastSyncAt: new Date().toISOString(),
    }),
  );

  // ─── Worker IPC Handlers (demo mode) ───────────────────────────

  ipcMain.handle("worker:runNow", async () => {
    if (workerRunning) {
      return { success: false, error: "A run is already in progress." };
    }
    workerRunning = true;
    workerCurrentRunId = `demo_${Date.now()}`;
    workerCurrentPhase = "strategic-awareness";
    // In production, this would trigger the local-worker process
    return { success: true, runId: workerCurrentRunId };
  });

  ipcMain.handle("worker:abort", async () => {
    workerRunning = false;
    workerCurrentPhase = null;
    workerCurrentRunId = null;
    return { success: true };
  });

  ipcMain.handle("worker:getStatus", async () => ({
    running: workerRunning,
    currentPhase: workerCurrentPhase,
    currentRunId: workerCurrentRunId,
  }));

  ipcMain.handle("worker:getHistory", async () => []);

  ipcMain.handle("worker:updateConfig", async (_e, _config) => {
    // In production, this would update worker config in Supabase
    return { success: true };
  });

  ipcMain.handle("worker:triggerMicroFix", async (_e, _description) => {
    // In production, this would queue a micro-fix in the local-worker
    return { success: true };
  });

  ipcMain.handle("worker:logFeedback", async (_e, _message) => {
    // In production, this feeds user message to the self-learning system
  });

  // ─── Filesystem & Shell Handlers ───────────────────────────
  ipcMain.handle("fs:list", async (_e, dirPath: string) => {
    try {
      const { readdirSync, statSync } = await import("node:fs");
      const { join } = await import("node:path");
      
      if (!existsSync(dirPath)) throw new Error("Directory not found");
      
      const entries = readdirSync(dirPath).map(name => {
        const fullPath = join(dirPath, name);
        const stats = statSync(fullPath);
        return {
          name,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          updatedAt: stats.mtime.toISOString()
        };
      });
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("fs:readFile", async (_e, filePath: string) => {
    try {
      const { readFileSync } = await import("node:fs");
      if (!existsSync(filePath)) throw new Error("File not found");
      const content = readFileSync(filePath, "utf-8");
      return { success: true, content };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("shell:runCommand", async (_e, command: string, cwd: string) => {
    return new Promise((resolve) => {
      import("node:child_process").then(({ exec }) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
          resolve({
            success: !error,
            stdout,
            stderr,
            exitCode: error?.code || 0
          });
        });
      });
    });
  });
};

// ─── Second instance handler (Windows/Linux deep link) ──────────────
app.on("second-instance", (_event, argv) => {
  // On Windows/Linux, the deep link URL is passed as the last argument
  const deepLink = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (deepLink) handleDeepLink(deepLink);
});

app.whenReady()
  .then(async () => {
    if (isDev) {
      console.log("[App] userData path:", app.getPath("userData"));
      console.log("[App] sessionData path:", app.getPath("sessionData"));
      await electronSession.defaultSession.clearCache();
    }

    registerIpcHandlers();
    registerGitHubHandlers(secureStore);
    await createMainWindow();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow();
      }
    });

    // On macOS, deep links arrive via the open-url event
    app.on("open-url", (_event, url) => {
      handleDeepLink(url);
    });
  })
  .catch((error) => {
    console.error("[App] Failed to initialize desktop shell:", error);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
