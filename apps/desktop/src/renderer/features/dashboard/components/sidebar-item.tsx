import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

interface SidebarItemProps {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip: string;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ icon, active, onClick, tooltip }) => (
  <div className="relative group">
    <button
      onClick={onClick}
      className={cn(
        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 relative overflow-hidden",
        active
          ? "bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          : "text-muted-foreground hover:text-foreground hover:bg-card"
      )}
    >
      {icon}
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full"
        />
      )}
    </button>

    <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover border border-border rounded-lg text-[9px] font-bold text-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60] shadow-xl">
      {tooltip}
    </div>
  </div>
);
