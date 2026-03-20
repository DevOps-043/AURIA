# AQELOR

**Autonomous Quality Engineering, Learning, Orchestration & Repositories**

Aplicacion de escritorio para DevOps autonomo impulsado por IA. AQELOR analiza repositorios, planifica mejoras, genera codigo en paralelo y valida los cambios — todo de forma autonoma.

## Arquitectura

```
apps/
  desktop/           → Aplicacion Electron (main + renderer)
packages/
  contracts/         → Schemas Zod compartidos (tipos, validaciones)
  domain/            → Logica de dominio (parsers, prompts, utilidades)
  ui/                → Componentes UI reutilizables
supabase/
  migrations/        → Migraciones SQL (auth, billing, herramientas, incidencias)
```

## Funcionalidades principales

- **Agente autonomo** — Pipeline de 10 etapas: escaneo, memoria, contexto, herramientas, investigacion web, plan, codificacion paralela, revision, QA y reporte
- **Multi-modelo** — Soporte para Gemini (3.1 Pro, 3 Flash, 2.5 Pro/Flash), modelos locales via Ollama/LM Studio
- **GitHub Integration** — OAuth SSO, listado/busqueda de repos, comparacion de ramas, navegacion de contenido
- **Sistema de incidencias** — Deteccion automatica de errores (modelo, git, build, lint, test, implementacion) con persistencia en Supabase
- **Notificaciones nativas** — Alertas del sistema operativo al completar/fallar ejecuciones
- **Actualizaciones OTA** — Auto-updater integrado con electron-updater
- **Facturacion** — Sistema AU (unidades autonomas) con wallets, paquetes y suscripciones
- **Seguridad** — Tokens encriptados via OS keychain (safeStorage), PKCE OAuth flow, RLS en todas las tablas

## Requisitos

- Node.js >= 22
- npm >= 10
- Cuenta Supabase (variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`)

## Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev --workspace=apps/desktop

# Build de produccion
npm run build --workspace=apps/desktop
```

## Migraciones Supabase

Las migraciones estan en `supabase/migrations/` y deben aplicarse en orden:

```bash
supabase db push
```

## Licencia

Propietario — todos los derechos reservados.
