import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import tailwindcss from "@tailwindcss/vite";

const workspaceAliases = {
  "@": resolve(__dirname, "src/renderer"),
  "@auria/contracts": resolve(__dirname, "../../packages/contracts/src/index.ts"),
  "@auria/domain": resolve(__dirname, "../../packages/domain/src/index.ts"),
  "@auria/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
};

// Load .env from monorepo root (electron-vite only looks in apps/desktop/)
function loadRootEnv(): Record<string, string> {
  const envPath = resolve(__dirname, "../../.env");
  if (!existsSync(envPath)) return {};

  const vars: Record<string, string> = {};
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key.startsWith("VITE_")) {
      vars[key] = value;
    }
  }
  return vars;
}

const rootEnv = loadRootEnv();

// Build define map: import.meta.env.VITE_X → "value"
const envDefine: Record<string, string> = {};
for (const [key, value] of Object.entries(rootEnv)) {
  envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@auria/contracts", "@auria/domain", "@auria/ui"] })],
    resolve: {
      alias: workspaceAliases,
    },
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ["@auria/contracts", "@auria/domain", "@auria/ui"] })],
    resolve: {
      alias: workspaceAliases,
    },
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: workspaceAliases,
    },
    define: envDefine,
    server: {
      host: "127.0.0.1",
    },
  },
});
