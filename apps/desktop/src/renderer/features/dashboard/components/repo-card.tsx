import React from 'react';
import { motion } from 'framer-motion';
import { GitBranch, ArrowRight, Target, Shield } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface RepoCardProps {
  id: string;
  name: string;
  fullName?: string;
  status: string;
  lastAction: string;
  time: string;
  branch?: string;
  language?: string | null;
  provider?: string;
  onClick?: (id: string) => void;
}

export const RepoCard: React.FC<RepoCardProps> = ({
  id,
  name,
  fullName,
  status,
  lastAction,
  time,
  branch = 'main',
  language,
  onClick,
}) => (
  <motion.div
    whileHover={{ y: -4 }}
    onClick={() => onClick?.(id)}
    className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden group cursor-pointer"
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition-all" />

    <div className="flex items-start justify-between mb-4">
      <div className="p-2.5 bg-background border border-border rounded-xl text-primary">
        <GitBranch className="w-5 h-5" />
      </div>
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
        <div className="w-1 h-1 rounded-full bg-emerald-400" />
        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">{status}</span>
      </div>
    </div>

    <h3 className="text-sm font-black text-foreground tracking-widest uppercase mb-1">{fullName || name}</h3>
    <div className="flex items-center gap-2 mb-4">
      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">{branch}</p>
      {language && (
        <span className="text-[8px] font-bold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded uppercase tracking-wider">
          {language}
        </span>
      )}
    </div>

    <div className="pt-4 border-t border-border/50">
      <div className="flex items-center justify-between text-[9px] font-bold">
        <span className="text-muted-foreground uppercase tracking-widest">Ultima actividad:</span>
        <span className="text-foreground">{lastAction}</span>
      </div>
      <div className="flex items-center justify-between text-[8px] font-medium text-muted-foreground mt-1">
        <span>{time}</span>
        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  </motion.div>
);

interface EmptyRepoSlotProps {
  locked?: boolean;
  onClick?: () => void;
}

export const EmptyRepoSlot: React.FC<EmptyRepoSlotProps> = ({ locked = false, onClick }) => (
  <motion.button
    whileHover={!locked ? { scale: 1.01, backgroundColor: 'rgba(59, 130, 246, 0.02)' } : {}}
    onClick={!locked ? onClick : undefined}
    className={cn(
      "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all min-h-[160px]",
      locked
        ? "border-border/30 bg-background/50 cursor-not-allowed"
        : "border-border hover:border-primary/40 text-muted-foreground hover:text-primary"
    )}
  >
    {locked ? (
      <>
        <Shield className="w-6 h-6 mb-3 opacity-30" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Requiere mejora</span>
      </>
    ) : (
      <>
        <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center mb-3">
          <Target className="w-5 h-5" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/70">Asignar repositorio</span>
      </>
    )}
  </motion.button>
);
