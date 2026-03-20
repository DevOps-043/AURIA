import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  Link2,
  Download,
  Fingerprint,
  Monitor,
} from 'lucide-react';
import { ProfileForm } from './components/profile-form';
import { ConnectionsPanel } from './components/connections-panel';
import { GeneralSettings } from './components/general-settings';
import { UpdatePanel } from './components/update-panel';

type SettingsTab = 'general' | 'profile' | 'connections' | 'updates';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="max-w-[1520px] mx-auto px-4 md:px-6 py-8 md:py-10 xl:py-12 space-y-8 md:space-y-10 pb-24">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 xl:gap-8">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-[1.4rem] shrink-0">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase italic break-words">
              Configuracion del sistema
            </h1>
          </div>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.3em] ml-1 opacity-70 break-words">
            Centro de control / Perfil / v2.0
          </p>
        </div>
      </div>

      <div className="space-y-5 md:space-y-6">
        <div className="rounded-[2rem] border border-border/50 bg-card/35 backdrop-blur-xl p-3 md:p-4">
          <div className="flex flex-wrap gap-2">
            <TabButton
              active={activeTab === 'general'}
              onClick={() => setActiveTab('general')}
              icon={<Monitor className="w-4 h-4" />}
              label="General"
            />
            <TabButton
              active={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
              icon={<User className="w-4 h-4" />}
              label="Identidad"
            />
            <TabButton
              active={activeTab === 'connections'}
              onClick={() => setActiveTab('connections')}
              icon={<Link2 className="w-4 h-4" />}
              label="Conexiones"
            />
            <TabButton
              active={activeTab === 'updates'}
              onClick={() => setActiveTab('updates')}
              icon={<Download className="w-4 h-4" />}
              label="Actualizaciones"
            />
          </div>
        </div>

        <div className="rounded-[2rem] border border-primary/10 bg-primary/5 px-5 py-4 md:px-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">
            Auria Intelligence
          </p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            La navegacion lateral se elimino para que cada seccion use todo el ancho disponible.
            La configuracion del espacio, la facturacion y la seguridad ahora viven en una sola superficie central.
          </p>
        </div>

        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-card/40 backdrop-blur-2xl border border-border/60 rounded-[2.5rem] md:rounded-[2.8rem] p-6 md:p-8 xl:p-10 shadow-2xl shadow-black/5 overflow-hidden min-w-0"
            >
              {activeTab === 'general' && (
                <section className="space-y-8 md:space-y-10 min-w-0">
                  <SectionHeader
                    title="Configuracion general"
                    subtitle="Comportamiento del sistema, inicio automatico y ejecucion en segundo plano"
                    icon={<Monitor className="w-5 h-5" />}
                  />
                  <GeneralSettings />
                </section>
              )}

              {activeTab === 'profile' && (
                <section className="space-y-8 md:space-y-10 min-w-0">
                  <SectionHeader
                    title="Gestion de identidad"
                    subtitle="Configura tu informacion principal y tus datos profesionales"
                    icon={<Fingerprint className="w-5 h-5" />}
                  />
                  <ProfileForm />
                </section>
              )}

              {activeTab === 'connections' && (
                <section className="space-y-8 md:space-y-10 min-w-0">
                  <SectionHeader
                    title="Conexiones y API Keys"
                    subtitle="Administra integraciones, enlaces a servicios de terceros y credenciales de IA"
                    icon={<Link2 className="w-5 h-5" />}
                  />
                  <ConnectionsPanel />
                </section>
              )}

              {activeTab === 'updates' && (
                <section className="space-y-8 md:space-y-10 min-w-0">
                  <SectionHeader
                    title="Actualizaciones"
                    subtitle="Manten AQELOR actualizado con las ultimas mejoras y correcciones"
                    icon={<Download className="w-5 h-5" />}
                  />
                  <UpdatePanel />
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 md:px-5 py-3 rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
        active 
          ? 'bg-primary text-white shadow-lg shadow-primary/20' 
          : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string, subtitle: string, icon: React.ReactNode }) {
  return (
    <div className="space-y-3 pb-6 border-b border-border/40 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="text-primary shrink-0">{icon}</div>}
        <h2 className="text-2xl md:text-[2rem] font-black text-foreground tracking-[0.08em] uppercase italic break-words">{title}</h2>
      </div>
      <p className="text-sm leading-6 text-muted-foreground font-medium max-w-3xl break-words">{subtitle}</p>
    </div>
  );
}

function EmptyStateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[2rem] border border-border/50 bg-card/30 px-6 py-10 md:px-8 md:py-12 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        {icon}
      </div>
      <h3 className="mt-6 text-xl md:text-2xl font-black tracking-tight text-foreground break-words">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground break-words">
        {description}
      </p>
      <button
        onClick={onAction}
        className="mt-8 rounded-[1.2rem] border border-primary/30 bg-primary/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/15"
      >
        {actionLabel}
      </button>
    </div>
  );
}
