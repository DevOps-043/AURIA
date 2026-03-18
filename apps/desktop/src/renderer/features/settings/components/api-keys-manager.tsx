import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  Plus,
  Trash2,
  Check,
  Loader2,
  Server,
  Cloud,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { supabase } from "@/shared/api/supabase-client";
import { Dropdown } from "@/shared/components/ui/dropdown";

/* ────────────────────────────────────────────────────────────────── */
/*  Types                                                            */
/* ────────────────────────────────────────────────────────────────── */

interface ApiKeyEntry {
  id: string;
  provider: string;
  label: string;
  config: Record<string, string>;
  is_active: boolean;
  priority: number;
  last_used_at: string | null;
  created_at: string;
  key_hint: string;
}

const PROVIDER_OPTIONS = [
  { value: "gemini", label: "Google Gemini (API directa)" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "lm_studio", label: "LM Studio (local)" },
  { value: "custom", label: "Proveedor personalizado" },
];

const PROVIDER_META: Record<string, { icon: React.ReactNode; accent: string; description: string }> = {
  gemini: { icon: <Cloud className="h-4 w-4" />, accent: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10", description: "API directa de Google Gemini" },
  ollama: { icon: <Server className="h-4 w-4" />, accent: "text-lime-400 border-lime-500/20 bg-lime-500/10", description: "Modelos locales via Ollama" },
  lm_studio: { icon: <Server className="h-4 w-4" />, accent: "text-amber-400 border-amber-500/20 bg-amber-500/10", description: "Modelos locales via LM Studio" },
  custom: { icon: <Key className="h-4 w-4" />, accent: "text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/10", description: "Endpoint personalizado compatible con OpenAI" },
};

const LOCAL_PROVIDERS = new Set(["ollama", "lm_studio"]);

/* ────────────────────────────────────────────────────────────────── */
/*  Main Component                                                   */
/* ────────────────────────────────────────────────────────────────── */

export const ApiKeysManager: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("list_user_api_keys");
      if (rpcError) throw rpcError;
      setKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const handleDelete = useCallback(async (keyId: string) => {
    if (!supabase) return;
    try {
      const { error: rpcError } = await supabase.rpc("delete_user_api_key", { target_key_id: keyId });
      if (rpcError) throw rpcError;
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la API key.");
    }
  }, []);

  const handleAdded = useCallback(() => {
    setShowAddForm(false);
    void loadKeys();
  }, [loadKeys]);

  const activeCount = keys.filter((k) => k.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-primary">
            API Keys de modelos
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Configura hasta 3 API keys propias. Si no configuras ninguna, se usaran las credenciales de AQELOR por defecto.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            {activeCount}/3 activas
          </span>
          {activeCount < 3 && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar key
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <p className="text-xs font-medium text-rose-300">{error}</p>
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-2xl border border-primary/10 bg-primary/5 px-5 py-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-primary">Por defecto</span>, AQELOR usa sus propias credenciales de Vertex AI para todos los modelos.
          Si agregas tus propias keys, tus keys tendran prioridad. Al eliminarlas, se restauran las credenciales de AQELOR automaticamente.
          Para modelos locales (Ollama, LM Studio) no se necesita API key, solo la URL del servidor.
        </p>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <AddKeyForm
              onAdded={handleAdded}
              onCancel={() => setShowAddForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keys list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-background/30 p-8 text-center">
          <Key className="mx-auto h-8 w-8 text-muted-foreground opacity-30" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Usando credenciales de AQELOR por defecto
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            No tienes API keys propias configuradas. Todos los modelos usan las credenciales de la plataforma.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key, index) => (
            <KeyCard
              key={key.id}
              entry={key}
              index={index}
              onDelete={() => handleDelete(key.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Add Key Form                                                     */
/* ────────────────────────────────────────────────────────────────── */

function AddKeyForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [provider, setProvider] = useState("vertex_ai");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("default");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434");
  const [projectId, setProjectId] = useState("");
  const [location, setLocation] = useState("us-central1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const isLocal = LOCAL_PROVIDERS.has(provider);

  const handleSubmit = async () => {
    if (!supabase) return;
    if (!isLocal && apiKey.length < 8) {
      setError("La API key debe tener al menos 8 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);

    const config: Record<string, string> = {};
    if (isLocal) config.base_url = baseUrl;
    if (provider === "vertex_ai") {
      config.project_id = projectId;
      config.location = location;
    }

    try {
      const { error: rpcError } = await supabase.rpc("upsert_user_api_key", {
        target_provider: provider,
        api_key: isLocal ? `local-${provider}` : apiKey,
        key_label: label,
        key_config: config,
      });
      if (rpcError) throw rpcError;
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la API key.");
    } finally {
      setSaving(false);
    }
  };

  const meta = PROVIDER_META[provider];

  return (
    <div className="rounded-[28px] border border-primary/20 bg-card/60 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-primary">
          Nueva API key
        </p>
        <button
          onClick={onCancel}
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Proveedor</p>
          <Dropdown
            value={provider}
            onChange={setProvider}
            options={PROVIDER_OPTIONS}
            placeholder="Selecciona proveedor"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Etiqueta</p>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="default"
            className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>

      {meta && (
        <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", meta.accent)}>
          {meta.icon}
          <p className="text-xs font-medium">{meta.description}</p>
        </div>
      )}

      {!isLocal && (
        <div>
          <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">API Key</p>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... / AIza... / tu-api-key"
              className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-3 pr-10 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {provider === "vertex_ai" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Project ID</p>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="my-gcp-project"
              className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">Region</p>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="us-central1"
              className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>
      )}

      {isLocal && (
        <div>
          <p className="mb-1.5 text-[7px] font-black uppercase tracking-[0.22em] text-muted-foreground">URL del servidor</p>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provider === "ollama" ? "http://localhost:11434" : "http://localhost:1234"}
            className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-3 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
      )}

      {error && (
        <p className="text-xs font-medium text-rose-400">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={saving || (!isLocal && apiKey.length < 8)}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary/90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Guardar
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Key Card                                                         */
/* ────────────────────────────────────────────────────────────────── */

function KeyCard({ entry, index, onDelete }: { entry: ApiKeyEntry; index: number; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const meta = PROVIDER_META[entry.provider] ?? PROVIDER_META.custom;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  const providerLabel = PROVIDER_OPTIONS.find((p) => p.value === entry.provider)?.label ?? entry.provider;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/30 p-4"
    >
      <div className="flex items-center gap-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", meta.accent)}>
          {meta.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">{providerLabel}</p>
            <span className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              {entry.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">{entry.key_hint}</span>
            {entry.config?.base_url && (
              <span className="text-[9px] text-muted-foreground">{entry.config.base_url}</span>
            )}
            {entry.last_used_at && (
              <span className="text-[9px] text-muted-foreground">
                Usado: {new Date(entry.last_used_at).toLocaleDateString("es-MX")}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-muted-foreground transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </motion.div>
  );
}
