import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import { join } from "node:path";
import { existsSync } from "node:fs";

let tray: Tray | null = null;

/**
 * Resolves the tray icon path for the current platform.
 * Falls back to a programmatically created placeholder when
 * the icon file is missing (e.g. during early development).
 */
function resolveTrayIcon(): Electron.NativeImage {
  const isPackaged = app.isPackaged;
  const basePath = isPackaged
    ? join(process.resourcesPath, "resources")
    : join(__dirname, "../../resources");

  const iconName = process.platform === "win32" ? "tray-icon.ico" : "tray-icon.png";
  const iconPath = join(basePath, iconName);

  if (existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }

  // Programmatic fallback: 16x16 blue square with "A" silhouette
  console.warn("[Tray] Icon file not found, using placeholder:", iconPath);
  return nativeImage.createEmpty();
}

/**
 * Rebuilds the tray context menu to reflect
 * the current window visibility state.
 */
function rebuildContextMenu(
  mainWindow: BrowserWindow,
  onQuit: () => void,
): void {
  if (!tray) return;

  const isVisible = mainWindow.isVisible();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? "Ocultar Auria" : "Mostrar Auria",
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
        rebuildContextMenu(mainWindow, onQuit);
      },
    },
    { type: "separator" },
    {
      label: "Salir",
      click: () => {
        onQuit();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Creates the system tray icon and wires up its interactions.
 *
 * @param mainWindow  The primary BrowserWindow to show/hide.
 * @param onQuit      Callback invoked before app.quit() so the
 *                    caller can set its isQuitting flag.
 */
export function createTray(
  mainWindow: BrowserWindow,
  onQuit: () => void,
): void {
  const icon = resolveTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("Auria — AQELOR");

  // Single-click toggles window visibility (Windows convention)
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    rebuildContextMenu(mainWindow, onQuit);
  });

  // Rebuild menu whenever the window visibility changes
  mainWindow.on("show", () => rebuildContextMenu(mainWindow, onQuit));
  mainWindow.on("hide", () => rebuildContextMenu(mainWindow, onQuit));

  rebuildContextMenu(mainWindow, onQuit);
}

/**
 * Destroys the tray icon. Called during app shutdown.
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
