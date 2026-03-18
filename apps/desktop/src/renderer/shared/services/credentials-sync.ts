import { supabase } from '@/shared/api/supabase-client';

/**
 * Resolves the Gemini API key from Supabase (user key > platform default)
 * and stores it in the OS-encrypted secure storage so the main process
 * autodev-runtime can access it without needing direct Supabase access.
 *
 * Called on:
 * - SIGNED_IN (first auth)
 * - App startup when session is valid (to keep key fresh)
 */
export async function syncGeminiKeyToSecureStorage(): Promise<void> {
  if (!supabase || !window.auria) return;

  try {
    const { data, error } = await supabase.rpc('resolve_model_credentials', {
      target_provider: 'gemini',
    });

    if (error) {
      console.warn('[CredentialsSync] Failed to resolve Gemini credentials:', error.message);
      return;
    }

    if (data?.source === 'none' || !data?.encrypted_key) {
      console.log('[CredentialsSync] No Gemini API key configured in database');
      return;
    }

    // Store in OS-encrypted storage where autodev-runtime reads it
    await window.auria.secureStorageSetItem('auria-gemini-api-key', data.encrypted_key);
    console.log(`[CredentialsSync] Gemini API key synced (source: ${data.source}, label: ${data.label})`);
  } catch (err) {
    console.warn('[CredentialsSync] Error syncing Gemini key:', err);
  }
}
