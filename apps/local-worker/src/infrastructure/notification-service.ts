/**
 * Notification Service — Servicio genérico de notificaciones.
 * Escribe eventos de notificación que el desktop app puede consumir.
 * Reemplaza la cola de WhatsApp del sistema anterior.
 */

export interface Notification {
  type: "run_started" | "run_completed" | "run_failed" | "pr_created" | "micro_fix";
  title: string;
  body: string;
  metadata?: Record<string, string>;
  timestamp: string;
}

export class NotificationService {
  private listeners: Array<(notification: Notification) => void> = [];

  onNotification(listener: (notification: Notification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify(notification: Notification): void {
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch (err: any) {
        console.error(
          `[NotificationService] Listener error: ${err.message}`,
        );
      }
    }
  }

  notifyRunStarted(runId: string, mode: string, strategy?: string): void {
    this.notify({
      type: "run_started",
      title: `AURIA Run iniciado`,
      body: `Run ${runId} (${mode}${strategy ? ` / ${strategy}` : ""}) ha comenzado.`,
      metadata: { runId, mode, strategy: strategy || "" },
      timestamp: new Date().toISOString(),
    });
  }

  notifyRunCompleted(
    runId: string,
    improvementsCount: number,
    prUrl?: string,
  ): void {
    this.notify({
      type: "run_completed",
      title: `AURIA Run completado`,
      body: `Run ${runId}: ${improvementsCount} mejoras aplicadas.${prUrl ? ` PR: ${prUrl}` : ""}`,
      metadata: { runId, improvements: String(improvementsCount), prUrl: prUrl || "" },
      timestamp: new Date().toISOString(),
    });
  }

  notifyRunFailed(runId: string, error: string): void {
    this.notify({
      type: "run_failed",
      title: `AURIA Run falló`,
      body: `Run ${runId} falló: ${error.slice(0, 200)}`,
      metadata: { runId, error },
      timestamp: new Date().toISOString(),
    });
  }

  notifyPRCreated(prUrl: string, title: string): void {
    this.notify({
      type: "pr_created",
      title: `PR creado`,
      body: `${title}\n${prUrl}`,
      metadata: { prUrl, title },
      timestamp: new Date().toISOString(),
    });
  }
}
