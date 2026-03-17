import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// ─── Secure Storage Adapter ──────────────────────────────────────────
// In Electron: tokens are encrypted via OS keychain (safeStorage IPC).
// In browser preview (no Electron): falls back to localStorage.
//
// Supabase SDK expects a synchronous-looking storage interface, but
// our IPC calls are async. We maintain an in-memory mirror that syncs
// with the encrypted store asynchronously. This is safe because:
//   1. On startup, getSession() is async and waits for storage
//   2. During runtime, writes go to memory immediately + async to disk

const isElectron = typeof window !== "undefined" && !!window.auria;
const memoryCache = new Map<string, string>();

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error("[Supabase] localStorage get failed:", error);
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error("[Supabase] localStorage set failed:", error);
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("[Supabase] localStorage remove failed:", error);
  }
}

const secureStorageAdapter = {
  getItem(key: string): string | null {
    // Memory cache first (always fastest)
    const cached = memoryCache.get(key);
    if (cached) return cached;

    // In browser mode: fall back to localStorage so PKCE verifier
    // and session tokens survive page reloads (OAuth redirect flow)
    if (!isElectron) {
      return safeLocalStorageGet(key);
    }

    return null;
  },

  setItem(key: string, value: string): void {
    memoryCache.set(key, value);

    if (isElectron) {
      // Async persist to OS-encrypted storage via IPC
      window.auria!.secureStorageSetItem(key, value);
    } else {
      // Browser fallback: persist to localStorage
      safeLocalStorageSet(key, value);
    }
  },

  removeItem(key: string): void {
    memoryCache.delete(key);

    if (isElectron) {
      window.auria!.secureStorageRemoveItem(key);
    } else {
      safeLocalStorageRemove(key);
    }
  },
};

// Pre-load cached tokens from encrypted storage on startup
async function hydrateSecureStorage(): Promise<void> {
  if (!window.auria) return;

  const ref = new URL(supabaseUrl!).hostname.split(".")[0];
  const keys = [
    `sb-${ref}-auth-token`,
    `sb-${ref}-auth-token-code-verifier`,
  ];

  for (const key of keys) {
    const value = await window.auria.secureStorageGetItem(key);
    if (value) memoryCache.set(key, value);
  }
}

// ─── Client Configuration ────────────────────────────────────────────
// PKCE flow: proof key for code exchange (prevents authorization code
// interception attacks). Required for desktop/native OAuth flows.
//
// autoRefreshToken: SDK auto-refreshes JWT before expiry.
// detectSessionInUrl: captures OAuth callback tokens from redirects.

function buildClient() {
  if (!hasSupabaseConfig) return null;

  try {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: secureStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
      global: {
        headers: {
          "X-Client-Info": "auria-desktop",
        },
      },
    });
  } catch (error) {
    console.error("[Supabase] Failed to create client:", error);
    return null;
  }
}

export const supabase = buildClient();

// Hydrate secure storage as soon as possible
if (hasSupabaseConfig) {
  hydrateSecureStorage().catch((error) => {
    console.error("[Supabase] Failed to hydrate secure storage:", error);
  });
}
