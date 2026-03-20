# Changelog

## [0.1.2] - 2026-03-20

### Added
- **Sistema de incidencias automatico** — Detecta y registra errores del pipeline autonomo (modelo/API, git, build, lint, test, implementacion, permisos) en Supabase
  - Tabla `autodev_incidents` con severidad, categoria, metadata y estado (open/acknowledged/resolved/dismissed)
  - Clasificacion inteligente de errores por etapa y contenido del mensaje
  - Registro automatico de fallos de modelo con fallback (sobrecarga, rate limit)
  - Sync automatico al finalizar cada run via hook `useIncidentSync`
  - RLS: cada usuario solo ve sus propias incidencias
  - Limpieza automatica de incidencias resueltas mayores a 90 dias
- README actualizado con arquitectura, funcionalidades y guia de desarrollo

### Changed
- Renombrado "Auria" → "AQELOR" en toda la interfaz (titulo ventana, tray, settings, user-agents)

### Fixed
- Datos de perfil SSO (nombre, avatar, usuario GitHub) ahora se cargan correctamente desde `user_metadata` de GitHub OAuth
- Trigger `handle_new_user` actualizado para extraer metadata de GitHub OAuth (full_name, avatar_url, user_name)
- Backfill de usuarios existentes con perfiles vacios desde SSO
- Bucket de storage `avatars` creado con politicas RLS para subida/lectura

## [0.1.1] - 2026-03-20

### Fixed
- Corregido error `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` al iniciar la aplicacion instalada
- Los paquetes workspace (`@auria/contracts`, `@auria/domain`, `@auria/ui`) ahora se bundlean en el build en lugar de externalizarse, evitando que Node intente procesar archivos `.ts` desde `node_modules`

## [0.1.0] - 2026-03-18

### Added
- Sistema de agentes autonomos con Gemini AI
- Gestion de repositorios y analisis de codigo
- Sistema de prompts con plantillas personalizables
- Autenticacion con Supabase (GitHub OAuth + email)
- Panel de configuracion completo (identidad, conexiones, API keys, facturacion)
- Sistema de actualizaciones automaticas OTA
- Interfaz oscura con diseno Signal Cyan
