import React, { useEffect, useState } from "react";
import { Power, Monitor } from "lucide-react";
import { desktopBridge } from "@/shared/api/desktop-bridge";

export const GeneralSettings: React.FC = () => {
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    desktopBridge.getAutoLaunchEnabled().then((enabled) => {
      setAutoLaunch(enabled);
      setLoading(false);
    });
  }, []);

  const handleToggle = async () => {
    const next = !autoLaunch;
    setAutoLaunch(next);
    await desktopBridge.setAutoLaunchEnabled(next);
  };

  return (
    <div className="space-y-8">
      {/* Auto-launch */}
      <SettingRow
        icon={<Power className="w-5 h-5 text-cyan-300" />}
        iconBg="bg-cyan-500/10 border-cyan-500/20"
        title="Inicio automatico"
        description="Iniciar Auria al encender el equipo. La aplicacion arranca minimizada en la bandeja del sistema."
        toggle={
          <ToggleSwitch
            enabled={autoLaunch}
            disabled={loading}
            onToggle={handleToggle}
          />
        }
      />

      {/* Background mode (informational) */}
      <SettingRow
        icon={<Monitor className="w-5 h-5 text-violet-300" />}
        iconBg="bg-violet-500/10 border-violet-500/20"
        title="Modo segundo plano"
        description="Al cerrar la ventana, Auria permanece activa en la bandeja del sistema ejecutando agentes programados."
        badge="Siempre activo"
      />
    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────────────────── */

function SettingRow({
  icon,
  iconBg,
  title,
  description,
  toggle,
  badge,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  toggle?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-background/30 p-5">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {toggle}
      {badge && (
        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
          {badge}
        </span>
      )}
    </div>
  );
}

function ToggleSwitch({
  enabled,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 ${
        enabled
          ? "border-primary/40 bg-primary/20"
          : "border-border/60 bg-background/40"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-200 ${
          enabled
            ? "left-[calc(100%-1.45rem)] bg-primary"
            : "left-[0.15rem] bg-muted-foreground/60"
        }`}
      />
    </button>
  );
}
