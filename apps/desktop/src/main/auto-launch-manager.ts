import { app } from "electron";

const HIDDEN_ARG = "--hidden";

/**
 * Checks whether the app was launched with the --hidden flag,
 * indicating it should start minimized to the system tray.
 */
export function wasLaunchedHidden(): boolean {
  return process.argv.includes(HIDDEN_ARG);
}

/**
 * Reads the current auto-launch state from the OS login item settings.
 */
export function getAutoLaunchEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

/**
 * Registers or unregisters the app as a login item.
 *
 * On Windows/Linux the --hidden argument is passed so the app
 * starts minimized to the system tray. On macOS the native
 * openAsHidden property is used instead.
 */
export function setAutoLaunchEnabled(enabled: boolean): void {
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

  if (isDev) {
    console.warn(
      "[AutoLaunch] Skipping login item registration in development mode.",
    );
    return;
  }

  if (process.platform === "darwin") {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    });
  } else {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: enabled ? [HIDDEN_ARG] : [],
    });
  }
}
