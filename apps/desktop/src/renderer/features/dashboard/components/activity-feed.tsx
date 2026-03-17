import React from 'react';
import { Activity, Brain, FileText, Shield } from 'lucide-react';
import type { AgentActivity } from '../hooks/use-dashboard-data';

const ACTIVITY_ICONS: Record<AgentActivity['type'], React.ReactNode> = {
  brain: <Brain className="w-3 h-3" />,
  file: <FileText className="w-3 h-3" />,
  shield: <Shield className="w-3 h-3" />,
  activity: <Activity className="w-3 h-3" />,
};

interface ActivityFeedProps {
  activities: AgentActivity[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => (
  <div className="bg-card/40 border border-border rounded-2xl overflow-hidden backdrop-blur-sm">
    <div className="px-5 py-4 border-b border-border bg-elevated/50">
      <h3 className="text-[10px] font-black text-foreground tracking-[0.2em] uppercase flex items-center gap-2">
        <Activity className="w-3 h-3 text-primary" />
        Actividad reciente
      </h3>
    </div>
    <div className="p-4 space-y-4">
      {activities.length > 0 ? (
        <>
          {activities.map((a) => (
            <ActivityItem
              key={a.id}
              icon={ACTIVITY_ICONS[a.type]}
              title={a.title}
              desc={a.desc}
              time={a.time}
            />
          ))}
          <button className="w-full py-2 text-[9px] font-black text-muted-foreground hover:text-primary uppercase tracking-[0.2em] transition-colors mt-2">
            Ver registro
          </button>
        </>
      ) : (
        <div className="py-6 text-center opacity-60">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Sin actividad reciente
          </p>
        </div>
      )}
    </div>
  </div>
);

function ActivityItem({
  icon,
  title,
  desc,
  time,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  time: string;
}) {
  return (
    <div className="flex gap-3 relative">
      <div className="absolute left-[7px] top-6 bottom-[-20px] w-px bg-border" />
      <div className="w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground relative z-10">
        {icon}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-black text-foreground uppercase tracking-wider">{title}</span>
          <span className="text-[8px] text-muted-foreground font-bold">{time}</span>
        </div>
        <p className="text-[9px] text-muted-foreground font-medium leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
