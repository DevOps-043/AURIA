import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitHubConnect } from './github-connect';
import { ApiKeysManager } from './api-keys-manager';

type ConnectionTab = 'github' | 'api-keys';

export const ConnectionsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConnectionTab>('github');

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-2">
        <SubTabButton active={activeTab === 'github'} onClick={() => setActiveTab('github')} label="GitHub" />
        <SubTabButton active={activeTab === 'api-keys'} onClick={() => setActiveTab('api-keys')} label="API Keys" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'github' && <GitHubConnect />}
          {activeTab === 'api-keys' && <ApiKeysManager />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

function SubTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-6 py-2.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
        active
          ? 'bg-foreground text-background shadow-lg shadow-foreground/10'
          : 'text-muted-foreground hover:bg-card hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
