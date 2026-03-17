import { runDemoWorker } from "./application/run-demo.ts";

const isDemoMode = process.argv.includes("--demo");

if (isDemoMode) {
  void runDemoWorker();
} else {
  console.log("[AURIA Worker] Starting in production mode...");
  console.log("[AURIA Worker] Waiting for IPC commands from desktop app.");
  console.log("[AURIA Worker] Use --demo flag for demo mode.");
  // Real mode initialization will be driven by the desktop app
  // via IPC once Supabase persistence is connected.
}
