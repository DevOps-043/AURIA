import { useState, useEffect } from 'react';
import { supabase } from '@/shared/api/supabase-client';
import { useDebounce } from './use-debounce';

type CheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

interface UniqueCheckResult {
  status: CheckStatus;
  message: string;
}

/**
 * Checks if a value already exists in a given column of public.users.
 * Uses debounce to avoid spamming the DB on every keystroke.
 */
export function useUniqueCheck(
  column: 'email' | 'phone' | 'github_username',
  value: string,
  minLength: number = 3,
): UniqueCheckResult {
  const debounced = useDebounce(value.trim(), 500);
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!debounced || debounced.length < minLength) {
      setStatus('idle');
      setMessage('');
      return;
    }

    if (!supabase) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('checking');
    setMessage('');

    const check = async () => {
      try {
        const { data, error } = await supabase!
          .from('users')
          .select('id')
          .eq(column, debounced)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setStatus('error');
          setMessage('No se pudo verificar la disponibilidad');
          return;
        }

        if (data) {
          setStatus('taken');
          setMessage(`Este ${column === 'github_username' ? 'usuario de GitHub' : column === 'email' ? 'correo' : 'telefono'} ya esta en uso`);
        } else {
          setStatus('available');
          setMessage('Disponible');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Error de red');
        }
      }
    };

    check();
    return () => { cancelled = true; };
  }, [debounced, column, minLength]);

  return { status, message };
}

/**
 * Username check — calls the server-side RPC `is_username_available`
 * which checks auth.users metadata directly.
 */
export function useUsernameCheck(username: string): UniqueCheckResult {
  const debounced = useDebounce(username.trim().toLowerCase(), 500);
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!debounced || debounced.length < 3) {
      setStatus('idle');
      setMessage('');
      return;
    }

    if (!supabase) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('checking');
    setMessage('');

    const check = async () => {
      try {
        const { data: available, error } = await supabase!.rpc(
          'is_username_available',
          { target_username: debounced },
        );

        if (cancelled) return;

        if (error) {
          // RPC not deployed yet — fallback to display_name check
          const { data: existing } = await supabase!
            .from('users')
            .select('id')
            .eq('display_name', debounced)
            .maybeSingle();

          if (cancelled) return;

          setStatus(existing ? 'taken' : 'available');
          setMessage(existing ? 'El nombre de usuario ya esta ocupado' : 'Disponible');
          return;
        }

        setStatus(available ? 'available' : 'taken');
        setMessage(available ? 'Disponible' : 'El nombre de usuario ya esta ocupado');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Error de red');
        }
      }
    };

    check();
    return () => { cancelled = true; };
  }, [debounced]);

  return { status, message };
}
