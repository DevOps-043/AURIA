# Changelog

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
