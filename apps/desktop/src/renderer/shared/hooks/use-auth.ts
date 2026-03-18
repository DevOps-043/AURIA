import { useState, useEffect, useCallback } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/shared/api/supabase-client';
import { syncGeminiKeyToSecureStorage } from '@/shared/services/credentials-sync';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  oauthError: string | null;
}

/**
 * Persists the GitHub provider token to secure storage via the main process.
 * This token is needed for GitHub API calls (listing repos, creating PRs, etc.)
 * and must be captured immediately on SIGNED_IN because Supabase does not
 * persist it — only the Supabase JWT is kept.
 */
async function persistGitHubProviderToken(session: Session | null): Promise<void> {
  if (!session?.provider_token || !window.auria) return;

  // Only persist if this is a GitHub OAuth session
  const isGitHubProvider = session.user?.app_metadata?.provider === 'github'
    || session.user?.identities?.some((id) => id.provider === 'github');

  if (!isGitHubProvider) return;

  await window.auria.secureStorageSetItem('auria-github-token', session.provider_token);

  if (session.provider_refresh_token) {
    await window.auria.secureStorageSetItem(
      'auria-github-refresh-token',
      session.provider_refresh_token,
    );
  }
}

/**
 * Manages Supabase auth state reactively.
 *
 * Security features:
 * - Subscribes to onAuthStateChange (login, logout, token refresh)
 * - Detects expired sessions and forces re-auth
 * - Handles TOKEN_REFRESHED to keep JWT current
 * - Clears state immediately on SIGNED_OUT
 * - Handles OAuth deep link callback (aqelor://auth/callback) for Electron
 * - Captures and securely stores GitHub provider token for API access
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    session: null,
    oauthError: null,
  });
  useEffect(() => {
    if (!supabase) {
      setState({ status: 'unauthenticated', user: null, session: null, oauthError: null });
      return;
    }

    // ─── Deep Link OAuth Callback Handler ────────────────────────
    // When the system browser redirects to aqelor://auth/callback?code=XXX,
    // Electron's main process forwards the code here via IPC.
    if (window.auria) {
      window.auria.onOAuthCallback(async (code: string) => {
        console.log('[Auth] OAuth callback received, code:', code?.slice(0, 8) + '...');
        try {
          const { data, error } = await supabase!.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[Auth] OAuth code exchange failed:', error.message);
            setState((s) => ({ ...s, oauthError: `El intercambio de OAuth fallo: ${error.message}` }));
            return;
          }
          console.log('[Auth] OAuth code exchange succeeded, user:', data.session?.user?.email);
          // Capture the GitHub provider token before it disappears
          await persistGitHubProviderToken(data.session);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error desconocido de OAuth';
          console.error('[Auth] OAuth callback error:', msg);
          setState((s) => ({ ...s, oauthError: msg }));
        }
      });
    }

    // Fetch current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] getSession result:', session ? `user=${session.user?.email}` : 'no session');
      if (session) {
        // Verify the token hasn't expired
        const expiresAt = session.expires_at ?? 0;
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt > now) {
          setState({ status: 'authenticated', user: session.user, session, oauthError: null });
            // Sync Gemini API key on app startup when session is valid
            syncGeminiKeyToSecureStorage();
        } else {
          // Token expired — attempt refresh
          supabase!.auth.refreshSession().then(({ data: { session: refreshed } }) => {
            setState({
              status: refreshed ? 'authenticated' : 'unauthenticated',
              user: refreshed?.user ?? null,
              session: refreshed,
              oauthError: null,
            });
          });
        }
      } else {
        setState({ status: 'unauthenticated', user: null, session: null, oauthError: null });
      }
    });

    // Listen for all auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session) => {
        console.log('[Auth] onAuthStateChange:', event, session ? `user=${session.user?.email}` : 'no session');
        switch (event) {
          case 'SIGNED_IN':
            // Capture GitHub provider token on OAuth sign-in
            await persistGitHubProviderToken(session);
            // Sync Gemini API key from Supabase to secure storage
            syncGeminiKeyToSecureStorage();
            setState({
              status: 'authenticated',
              user: session?.user ?? null,
              session,
              oauthError: null,
            });
            break;

          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
            setState({
              status: 'authenticated',
              user: session?.user ?? null,
              session,
              oauthError: null,
            });
            break;

          case 'SIGNED_OUT':
            // Clean up tokens on sign out
            if (window.auria) {
              await window.auria.secureStorageRemoveItem('auria-github-token');
              await window.auria.secureStorageRemoveItem('auria-github-refresh-token');
              await window.auria.secureStorageRemoveItem('auria-gemini-api-key');
            }
            setState({ status: 'unauthenticated', user: null, session: null, oauthError: null });
            break;

          default:
            if (session) {
              setState({ status: 'authenticated', user: session.user, session, oauthError: null });
            }
        }
      },
    );

    return () => {
      subscription.unsubscribe();
      // Clean up deep link listener
      if (window.auria) {
        window.auria.removeOAuthCallback();
      }
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return { ...state, signOut };
}
