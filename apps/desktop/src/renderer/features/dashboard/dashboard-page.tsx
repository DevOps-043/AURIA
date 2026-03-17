import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/shared/components/ui/logo';
import {
  LogOut, Activity, Shield, Brain, Target, Cpu, Settings,
  User as UserIcon, Sun, Moon, Monitor, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/shared/hooks/use-auth';
import { useTheme, type Theme } from '@/shared/hooks/use-theme';
import { useDashboardData } from './hooks/use-dashboard-data';
import { SidebarItem } from './components/sidebar-item';
import { RepoCard, EmptyRepoSlot } from './components/repo-card';
import { ActivityFeed } from './components/activity-feed';
import { RepoPickerModal } from './components/repo-picker-modal';
import { SettingsView } from '../settings/settings-view';
import { RepositoryDetailView } from '../repository/repository-detail-view';

type TabId = 'dashboard' | 'missions' | 'memory' | 'policies' | 'models' | 'settings' | 'repository';

const MAX_VISIBLE_SLOTS = 4;

interface DashboardProps {
  onSignOut: () => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ onSignOut }) => {
  const [activeTab, setActiveTab] = React.useState<TabId>('dashboard');
  const [selectedRepoId, setSelectedRepoId] = React.useState<string | null>(null);
  const [showRepoPicker, setShowRepoPicker] = React.useState(false);
  const { repos, activities, plan, workspaceId, connectedExternalIds, loading, error, refetch } = useDashboardData();

  const handleRepoSelect = (id: string) => {
    setSelectedRepoId(id);
    setActiveTab('repository');
  };

  const lockedSlotCount = Math.max(0, MAX_VISIBLE_SLOTS - plan.totalSlots);
  const slotsAvailable = Math.max(0, plan.totalSlots - plan.usedSlots);

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Repo Picker Modal */}
      {showRepoPicker && workspaceId && (
        <RepoPickerModal
          workspaceId={workspaceId}
          connectedExternalIds={connectedExternalIds}
          slotsAvailable={slotsAvailable}
          onClose={() => setShowRepoPicker(false)}
          onConnected={refetch}
          onGoToSettings={() => setActiveTab('settings')}
        />
      )}

      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onSignOut={onSignOut} />

      {/* Main viewport */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

        <DashboardHeader 
          planName={plan.name} 
          title={
            activeTab === 'settings' 
              ? 'Identidad / Configuracion' 
              : activeTab === 'repository'
              ? 'Sistema / Nodo de repositorio'
              : 'Espacio de trabajo / Nodos activos'
          } 
        />

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-6xl mx-auto"
          >
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} />
            ) : activeTab === 'settings' ? (
              <SettingsView />
            ) : activeTab === 'repository' && selectedRepoId ? (
              <RepositoryDetailView 
                repoId={selectedRepoId} 
                onBack={() => setActiveTab('dashboard')} 
              />
            ) : (
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Repositories */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-foreground tracking-widest uppercase flex items-center gap-3">
                      Espacios de repositorio
                      <span className="text-[10px] font-bold text-muted-foreground bg-card px-2 py-0.5 rounded-md border border-border">
                        {plan.usedSlots}/{plan.totalSlots}
                      </span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {repos.map((repo) => (
                      <RepoCard key={repo.id} {...repo} onClick={handleRepoSelect} />
                    ))}
                    {plan.usedSlots < plan.totalSlots && (
                      <EmptyRepoSlot onClick={() => setShowRepoPicker(true)} />
                    )}
                    {Array.from({ length: lockedSlotCount }).map((_, i) => (
                      <EmptyRepoSlot key={`locked-${i}`} locked />
                    ))}
                  </div>

                  {repos.length === 0 && (
                    <div className="mt-12 text-center py-10 border border-dashed border-border rounded-3xl">
                      <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                        No se detectaron repositorios activos
                      </p>
                    </div>
                  )}
                </div>

                {/* Activity Feed */}
                <div className="w-full lg:w-80">
                  <ActivityFeed activities={activities} />
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

// ─── Layout Sub-components ──────────────────────────────────────────────

const NAV_ITEMS: { id: TabId; icon: React.ReactNode; tooltip: string }[] = [
  { id: 'dashboard', icon: <Activity className="w-5 h-5" />, tooltip: 'Centro de control' },
  { id: 'missions', icon: <Target className="w-5 h-5" />, tooltip: 'Misiones' },
  { id: 'memory', icon: <Brain className="w-5 h-5" />, tooltip: 'Memoria' },
  { id: 'policies', icon: <Shield className="w-5 h-5" />, tooltip: 'Politicas' },
  { id: 'models', icon: <Cpu className="w-5 h-5" />, tooltip: 'Modelos de IA' },
];

function Sidebar({
  activeTab,
  onTabChange,
  onSignOut,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="w-20 shrink-0 h-screen border-r border-border bg-card flex flex-col py-6 items-center overflow-visible z-50">
      <div className="mb-8 shrink-0">
        <Logo className="scale-75" hideText />
      </div>

      <nav className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden custom-scrollbar px-3 pb-6">
        <div className="flex flex-col gap-6 w-full items-center">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            active={activeTab === item.id}
            onClick={() => onTabChange(item.id)}
            tooltip={item.tooltip}
          />
        ))}
        </div>
      </nav>

      <div className="mt-4 shrink-0 flex flex-col items-center w-full px-3 pb-2">
        <UserMenu onSignOut={onSignOut} onOpenSettings={() => onTabChange('settings')} />
      </div>
    </aside>
  );
}

function UserMenu({ onSignOut, onOpenSettings }: { onSignOut: () => void; onOpenSettings: () => void }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url;
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Usuario';

  return (
    <div className="relative w-full flex justify-center" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-transparent hover:border-primary/50 transition-all active:scale-95 bg-muted flex items-center justify-center group"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Usuario" className="w-full h-full object-cover" />
        ) : (
          <UserIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 20, y: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 10 }}
            className="absolute left-full ml-4 bottom-0 w-64 bg-popover border border-border rounded-2xl shadow-2xl p-2 z-[100] backdrop-blur-xl"
          >
            <div className="px-4 py-3 border-b border-border mb-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[11px] font-black text-foreground truncate uppercase tracking-widest">{username}</span>
                <span className="text-[9px] text-muted-foreground truncate opacity-80">{user?.email}</span>
              </div>
            </div>

            <div className="space-y-1">
              <MenuButton icon={<Settings className="w-4 h-4" />} label="Configuracion" onClick={() => { onOpenSettings(); setIsOpen(false); }} />
              
              <div className="py-2 px-3">
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 px-1">Tema de la app</p>
                <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-xl">
                  <ThemeButton icon={<Moon className="w-3.5 h-3.5" />} mode="dark" active={theme === 'dark'} onClick={() => setTheme('dark')} />
                  <ThemeButton icon={<Sun className="w-3.5 h-3.5" />} mode="light" active={theme === 'light'} onClick={() => setTheme('light')} />
                  <ThemeButton icon={<Monitor className="w-3.5 h-3.5" />} mode="system" active={theme === 'system'} onClick={() => setTheme('system')} />
                </div>
              </div>

              <div className="h-px bg-border my-1" />
              
              <button
                onClick={onSignOut}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-400/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Cerrar sesion</span>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
    </button>
  );
}

function ThemeButton({
  icon,
  mode,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  mode: Theme;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={mode}
      onClick={onClick}
      className={`flex items-center justify-center py-2 rounded-lg transition-all ${
        active ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
    </button>
  );
}

function DashboardHeader({ planName, title }: { planName: string; title: string }) {
  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-border/50 bg-background/40 backdrop-blur-xl z-20">
      <span className="text-[10px] font-black text-primary tracking-[0.3em] uppercase">
        {title}
      </span>
      <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{planName}</span>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 grayscale opacity-50">
      <Activity className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
        Sincronizando sistema...
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mb-2">
        Error de conexion
      </p>
      <p className="text-[9px] text-muted-foreground">{message}</p>
    </div>
  );
}
