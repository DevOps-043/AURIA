import { useState } from 'react';
import { supabase } from '@/shared/api/supabase-client';
import { AUTH_ERRORS } from '@/shared/constants/errors';

interface LoginState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

/**
 * Manages login form state and authentication logic.
 * Supports login via email or username.
 */
export function useLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoginState>({
    loading: false,
    error: null,
    success: false,
  });

  const clearError = () => setState((s) => ({ ...s, error: null }));

  const login = async () => {
    if (!supabase) {
      setState({ loading: false, error: AUTH_ERRORS.DB_NOT_CONFIGURED, success: false });
      return;
    }
    if (!email.trim() || !password) return;

    setState({ loading: true, error: null, success: false });

    try {
      let targetEmail = email.trim();

      // If input doesn't contain '@', resolve username → email via RPC
      // (RPC uses security definer to bypass RLS — anon can't query users directly)
      if (!targetEmail.includes('@')) {
        const { data: resolvedEmail, error: lookupErr } = await supabase.rpc(
          'resolve_username_to_email',
          { target_username: targetEmail },
        );

        if (lookupErr || !resolvedEmail) {
          throw new Error(AUTH_ERRORS.USER_NOT_FOUND);
        }
        targetEmail = resolvedEmail;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (signInErr) throw signInErr;

      // Record login metadata (last_login_at, login_count)
      try {
        await supabase.rpc('record_login');
      } catch {
        // Non-critical — don't block login if metadata update fails
      }

      setState({ loading: false, error: null, success: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : AUTH_ERRORS.AUTH_FAILED;
      setState({ loading: false, error: message, success: false });
    }
  };

  const loginWithGitHub = async () => {
    if (!supabase) return;

    setState({ loading: true, error: null, success: false });

    try {
      // In Electron: use skipBrowserRedirect to get the OAuth URL without
      // navigating the main window, then open a dedicated OAuth window
      // that intercepts the redirect to capture the authorization code.
      // In browser: let Supabase handle the redirect normally.
      const isElectron = !!window.auria;
      const redirectTo = isElectron
        ? 'aqelor://auth/callback'
        : window.location.origin;

      console.log('[LoginForm] Starting GitHub OAuth, redirectTo:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          scopes: 'repo read:user read:org',
          skipBrowserRedirect: isElectron,
        },
      });

      if (error) throw error;

      console.log('[LoginForm] OAuth URL obtained:', data.url?.slice(0, 60) + '...');

      // In Electron, open the OAuth URL in a separate window
      if (isElectron && data.url) {
        await window.auria!.openOAuthWindow(data.url, redirectTo);
      }
      // The OAuth callback is handled by useAuth → exchangeCodeForSession
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : AUTH_ERRORS.GITHUB_FAILED;
      setState({ loading: false, error: message, success: false });
    } finally {
      // Reset loading after OAuth window opens (auth state is managed by useAuth)
      setState((s) => s.success ? s : { ...s, loading: false });
    }
  };

  const reset = () => {
    setEmail('');
    setPassword('');
    setState({ loading: false, error: null, success: false });
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading: state.loading,
    error: state.error,
    success: state.success,
    login,
    loginWithGitHub,
    clearError,
    reset,
  };
}
