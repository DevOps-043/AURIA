/** Centralized user-facing error messages for consistency. */

export const AUTH_ERRORS = {
  DB_NOT_CONFIGURED:
    'Base de datos no configurada. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env.',
  INCOMPLETE_FIELDS: 'Completa todos los campos obligatorios.',
  USER_NOT_FOUND: 'Usuario no encontrado',
  AUTH_FAILED: 'La autenticacion fallo',
  GITHUB_FAILED: 'El acceso con GitHub fallo',
  REGISTRATION_FAILED: 'El registro fallo. Intentalo de nuevo.',
} as const;
