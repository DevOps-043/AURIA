/**
 * Updater Service (Renderer-side)
 * Wrapper tipado para el sistema de auto-actualización vía IPC.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  downloadProgress: number | null
  error: string | null
}

export interface UpdateAvailableInfo {
  version: string
  releaseNotes: string | null
  releaseDate: string
}

export interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

// ─── Public API ─────────────────────────────────────────────────────

export async function checkForUpdates(): Promise<UpdaterStatus | null> {
  if (typeof window.auria?.updater === 'undefined') return null
  const result = await window.auria.updater.checkForUpdates()
  if (!result.success) return null
  return window.auria.updater.getStatus() as Promise<UpdaterStatus>
}

export async function downloadUpdate(): Promise<void> {
  await window.auria?.updater.downloadUpdate()
}

export async function installUpdate(): Promise<void> {
  await window.auria?.updater.installUpdate()
}

export async function getUpdaterStatus(): Promise<UpdaterStatus | null> {
  if (typeof window.auria?.updater === 'undefined') return null
  return window.auria.updater.getStatus() as Promise<UpdaterStatus>
}
