import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, Terminal as TerminalIcon2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalLine {
  type: 'cmd' | 'out' | 'err';
  content: string;
}

interface EmbeddedTerminalProps {
  cwd: string;
}

export const EmbeddedTerminal: React.FC<EmbeddedTerminalProps> = ({ cwd }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'out', content: 'AURIA NODE CONSOLE [Version 1.0.4]' },
    { type: 'out', content: 'Neural link stable. Listening for directives...' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const currentCmd = input;
    setLines(prev => [...prev, { type: 'cmd', content: currentCmd }]);
    setInput('');
    setLoading(true);

    try {
      if (currentCmd === 'clear') {
        setLines([{ type: 'out', content: 'Neural link reset.' }]);
        setLoading(false);
        return;
      }

      const result = await window.auria?.shell?.runCommand(currentCmd, cwd);
      if (result) {
        if (result.stdout) {
          setLines(prev => [...prev, { type: 'out', content: result.stdout }]);
        }
        if (result.stderr) {
          setLines(prev => [...prev, { type: 'err', content: result.stderr }]);
        }
        if (!result.stdout && !result.stderr && result.success) {
          setLines(prev => [...prev, { type: 'out', content: 'Command executed successfully.' }]);
        }
      }
    } catch (err) {
      setLines(prev => [...prev, { type: 'err', content: `CRITICAL ERROR: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl">
      <div className="px-4 py-2 border-b border-border/30 flex items-center justify-between bg-muted/10">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-primary" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Neural Shell</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/30" />
          <div className="w-2 h-2 rounded-full bg-amber-500/20 border border-amber-500/30" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px] custom-scrollbar selection:bg-primary/30"
      >
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap ${
            line.type === 'cmd' ? 'text-primary flex items-start gap-2' : 
            line.type === 'err' ? 'text-red-400 opacity-90' : 
            'text-foreground opacity-70'
          }`}>
            {line.type === 'cmd' && <span className="opacity-50">$</span>}
            {line.content}
          </div>
        ))}
        {loading && (
          <div className="text-primary animate-pulse opacity-50">_ Processing Neural Request...</div>
        )}
      </div>

      <form 
        onSubmit={handleSubmit}
        className="p-3 bg-muted/5 border-t border-border/30 flex items-center gap-3"
      >
        <span className="text-primary font-mono text-[11px] opacity-40">$</span>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ENTER DIRECTIVE..."
          className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono text-primary placeholder:text-primary/20"
          autoFocus
        />
        <button 
          type="submit"
          className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors text-primary disabled:opacity-30"
          disabled={loading || !input.trim()}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
