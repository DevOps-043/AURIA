/**
 * Scheduler — Cron-based scheduler para runs automáticos.
 * Lee configuración del workspace y respeta límites diarios.
 */
import type { WorkerConfig } from "@auria/contracts";
import { isWithinDailyRunLimit, isWithinDailyMicroRunLimit } from "@auria/domain";

export interface SchedulerCallbacks {
  onFullRunTrigger: () => Promise<void>;
  onMicroFixTrigger: () => Promise<void>;
  getRunCountToday: () => Promise<number>;
  getMicroRunCountToday: () => Promise<number>;
}

export class WorkerScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private config: WorkerConfig | null = null;
  private callbacks: SchedulerCallbacks;
  private running = false;

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Inicia el scheduler con la configuración dada.
   * Usa setInterval como alternativa simple a node-cron
   * para evitar la dependencia externa.
   */
  start(config: WorkerConfig): void {
    this.config = config;
    this.stop();

    if (!config.enabled) {
      console.log("[Scheduler] Worker disabled in config. Not scheduling.");
      return;
    }

    // Parse simple cron-like schedule: check every minute
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 60_000);

    console.log(
      `[Scheduler] Started. Cron: ${config.cronSchedule}. Will check every minute.`,
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  updateConfig(config: WorkerConfig): void {
    this.config = config;
    if (!config.enabled) {
      this.stop();
    }
  }

  private async tick(): Promise<void> {
    if (!this.config?.enabled || this.running) return;

    const now = new Date();
    if (!this.matchesCron(this.config.cronSchedule, now)) return;

    this.running = true;
    try {
      const runsToday = await this.callbacks.getRunCountToday();
      const guard = isWithinDailyRunLimit(runsToday, this.config.maxDailyRuns);
      if (!guard.passed) {
        console.log(`[Scheduler] ${guard.reason}`);
        return;
      }

      console.log("[Scheduler] Triggering full run...");
      await this.callbacks.onFullRunTrigger();
    } catch (err: any) {
      console.error(`[Scheduler] Run trigger failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }

  async canTriggerMicroFix(): Promise<boolean> {
    if (!this.config?.microFixEnabled) return false;
    const count = await this.callbacks.getMicroRunCountToday();
    return isWithinDailyMicroRunLimit(count, this.config.maxDailyMicroRuns).passed;
  }

  /**
   * Simple cron matcher for "minute hour * * *" format.
   * Matches if the current time matches the cron schedule.
   */
  private matchesCron(cron: string, now: Date): boolean {
    try {
      const parts = cron.trim().split(/\s+/);
      if (parts.length < 5) return false;

      const [minute, hour] = parts;

      const matchMinute =
        minute === "*" || parseInt(minute) === now.getMinutes();
      const matchHour =
        hour === "*" || parseInt(hour) === now.getHours();

      return matchMinute && matchHour;
    } catch {
      return false;
    }
  }
}
