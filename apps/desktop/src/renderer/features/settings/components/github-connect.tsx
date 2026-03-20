import React, { useState } from 'react';
import { RefreshCw, Unlink, Link2, ExternalLink } from 'lucide-react';
import { GithubIcon } from '@/shared/components/ui/icons';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/shared/hooks/use-auth';
import { supabase } from '@/shared/api/supabase-client';
import { desktopBridge } from '@/shared/api/desktop-bridge';

export const GitHubConnect: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isConnected = user?.identities?.some(id => id.provider === 'github') ?? false;
  const githubIdentity = user?.identities?.find(id => id.provider === 'github');
  const githubUsername = user?.user_metadata?.preferred_username || user?.user_metadata?.user_name;

  /**
   * Links GitHub to the existing account using linkIdentity (not signInWithOAuth).
   * This preserves the current session instead of creating a new one.
   */
  const handleConnect = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const isElectron = !!window.auria;
      const redirectTo = isElectron
        ? 'aqelor://auth/callback'
        : window.location.origin;

      const { data, error: linkError } = await supabase.auth.linkIdentity({
        provider: 'github',
        options: {
          redirectTo,
          scopes: 'repo read:user read:org',
          skipBrowserRedirect: isElectron,
        },
      });

      if (linkError) throw linkError;

      // In Electron, open the OAuth URL in a separate window
      if (isElectron && data.url) {
        await window.auria!.openOAuthWindow(data.url, redirectTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar GitHub');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Re-fetches GitHub user info and updates the local profile.
   */
  const handleResync = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const githubUser = await desktopBridge.github.getUser();
      await supabase
        .from('users')
        .update({ github_username: githubUser.login })
        .eq('id', user!.id);
      setSuccess('Datos de GitHub sincronizados');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La resincronizacion fallo');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Unlinks GitHub identity and clears the stored provider token.
   */
  const handleUnlink = async () => {
    if (!supabase || !githubIdentity) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(githubIdentity);
      if (unlinkError) throw unlinkError;

      // Clear the stored GitHub token
      await desktopBridge.github.clearToken();

      // Clear github_username from profile
      await supabase
        .from('users')
        .update({ github_username: null })
        .eq('id', user!.id);

      setSuccess('Cuenta de GitHub desvinculada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular GitHub');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-3xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isConnected ? 'bg-[#24292f] text-white shadow-xl shadow-[#24292f]/20' : 'bg-muted text-muted-foreground'
            }`}>
              <GithubIcon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Integracion GitHub</h4>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">
                {isConnected ? 'Conexion activa' : 'Integracion pendiente'}
              </p>
            </div>
          </div>
          
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Activa</span>
            </div>
          )}
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <div className="p-4 bg-background border border-border rounded-2xl flex items-center justify-between group/item">
              <div className="flex items-center gap-3">
                <img 
                  src={user?.user_metadata?.avatar_url} 
                  alt="GH Avatar" 
                  className="w-8 h-8 rounded-full border border-border"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-foreground uppercase tracking-widest">@{githubUsername}</span>
                  <span className="text-[8px] text-muted-foreground font-bold">Sincronizado por OAuth 2.0</span>
                </div>
              </div>
              <a 
                href={`https://github.com/${githubUsername}`} 
                target="_blank" 
                rel="noreferrer"
                className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {(error || success) && (
              <div className={`p-3 rounded-xl text-[9px] font-bold uppercase tracking-wider ${
                error ? 'bg-red-500/5 border border-red-500/10 text-red-400' : 'bg-emerald-500/5 border border-emerald-500/10 text-emerald-400'
              }`}>
                {error || success}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10 border-border bg-transparent hover:bg-muted text-[10px] font-black uppercase tracking-widest rounded-xl"
                disabled={loading}
                onClick={handleResync}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Resincronizar
              </Button>
              <Button
                variant="outline"
                className="h-10 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl px-4"
                disabled={loading}
                onClick={handleUnlink}
              >
                <Unlink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
              Conecta tu cuenta de GitHub para habilitar sincronizacion de repositorios, automatizaciones y contexto de trabajo.
            </p>
            {error && (
              <div className="p-3 rounded-xl text-[9px] font-bold uppercase tracking-wider bg-red-500/5 border border-red-500/10 text-red-400">
                {error}
              </div>
            )}
            <Button
              onClick={handleConnect}
              disabled={loading}
              className="w-full h-12 bg-[#24292f] hover:bg-[#1a1e22] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-[#24292f]/10"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Autorizar conexion con GitHub
            </Button>
          </div>
        )}
      </div>

    </div>
  );
};
