import React, { useState, useEffect } from 'react';
import { Mail, Bell, Settings2, CheckCircle2, XCircle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/shared/hooks/use-auth';
import { supabase } from '@/shared/api/supabase-client';
import { Button } from '@/shared/components/ui/button';

interface NotificationPrefs {
  notify_email: boolean;
  notify_push: boolean;
  marketing_consent: boolean;
}

export const NotificationsPanel: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [prefs, setPrefs] = useState<NotificationPrefs>({
    notify_email: true,
    notify_push: true,
    marketing_consent: false,
  });

  useEffect(() => {
    const fetchPrefs = async () => {
      if (!user?.id || !supabase) {
        setFetching(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('notify_email, notify_push, marketing_consent')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setPrefs({
            notify_email: data.notify_email ?? true,
            notify_push: data.notify_push ?? true,
            marketing_consent: data.marketing_consent ?? false,
          });
        }
      } catch (err) {
        console.error('Error fetching notification prefs:', err);
      } finally {
        setFetching(false);
      }
    };

    fetchPrefs();
  }, [user?.id]);

  const handleSave = async () => {
    if (!supabase || !user?.id) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({ ...prefs, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Preferencias actualizadas' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar' });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Cargando preferencias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* System notifications info */}
      <div className="rounded-[1.8rem] border border-primary/15 bg-primary/5 px-6 py-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Notificaciones del sistema</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          AQELOR envia notificaciones nativas del sistema operativo cuando una ejecucion del agente se completa, falla o es abortada. Estas notificaciones siempre estan activas mientras la aplicacion este en ejecucion.
        </p>
      </div>

      {/* Toggle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <ToggleCard
          title="Notificaciones por correo"
          description="Recibe eventos y reportes por correo electronico"
          icon={<Mail className="w-4 h-4" />}
          checked={prefs.notify_email}
          onToggle={() => toggle('notify_email')}
        />
        <ToggleCard
          title="Alertas push"
          description="Alertas en tiempo real del sistema"
          icon={<Bell className="w-4 h-4" />}
          checked={prefs.notify_push}
          onToggle={() => toggle('notify_push')}
        />
        <ToggleCard
          title="Mejora del producto"
          description="Permite usar datos anonimos para mejorar el sistema"
          icon={<Settings2 className="w-4 h-4" />}
          checked={prefs.marketing_consent}
          onToggle={() => toggle('marketing_consent')}
        />
      </div>

      {/* Save button */}
      <div className="pt-8 border-t border-border/40 flex items-center gap-4">
        <Button
          type="button"
          disabled={loading}
          onClick={handleSave}
          className="bg-primary text-white h-14 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              Guardar preferencias
              <Save className="w-4 h-4" />
            </>
          )}
        </Button>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                message.type === 'success'
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/5 border-red-500/20 text-red-400'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

function ToggleCard({
  title,
  description,
  icon,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-4 p-5 rounded-[1.8rem] border transition-all cursor-pointer select-none text-left w-full ${
        checked ? 'bg-primary/5 border-primary/20' : 'bg-card border-border/40 hover:border-border'
      }`}
    >
      <div className={`p-2.5 rounded-xl ${checked ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-foreground uppercase tracking-widest">{title}</span>
          <div className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-5' : 'left-1'}`} />
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">{description}</p>
      </div>
    </button>
  );
}
