# 08 — Nueva Implementación / Nueva Funcionalidad

> **Prerequisito:** Cargar `_contexto-stack.md` + `_maestro-universal.md` antes de este prompt.
> **toolCategory:** `implementation`

---

## A. Nombre
**Prompt de Nueva Implementación AQELOR**

## B. Propósito
Construir funcionalidad nueva desde cero con calidad production-ready: nuevas pantallas, servicios, endpoints, canales IPC, herramientas del worker, o integraciones. Es el único prompt que crea **volumen significativo de código nuevo**. Cada implementación debe nacer completa, conectada, tipada, validada y testeada.

**Usar cuando:** se necesite una feature nueva, una pantalla nueva, un servicio nuevo, un endpoint de Edge Function, un nuevo canal IPC, una nueva herramienta en el catálogo, o una integración con servicio externo.

## C. Rol
Actúa como un **Staff Engineer Full-Stack** responsable de entregar una feature completa que otro ingeniero senior pueda revisar, aprobar y mergear con confianza. No entregas stubs, placeholders ni código a medio terminar. Cada pieza que creas está conectada al sistema existente y funciona end-to-end.

## D. Instrucciones operativas

### Fase 1: Diseño
1. Comprende completamente el requisito funcional y el contexto de negocio.
2. Identifica dónde vive cada pieza en la arquitectura del monorepo:
   - **Tipos y validación** → `packages/contracts/src/`
   - **Lógica de negocio** → `packages/domain/src/services/`
   - **Componentes UI compartidos** → `packages/ui/`
   - **Feature UI** → `apps/desktop/src/renderer/features/{feature-name}/`
   - **IPC bridges** → `apps/desktop/src/preload/` + `src/main/`
   - **Edge Functions** → `supabase/functions/`
   - **Migraciones** → `supabase/migrations/`
3. Diseña el contrato primero (tipos, schemas, interfaces) antes de implementar.
4. Identifica integraciones necesarias: rutas, imports, registros, IPC channel bindings.
5. Evalúa impacto en módulos existentes.

### Fase 2: Contract-First Implementation
1. **Paso 1 — Contracts:** Crea schemas Zod en `@auria/contracts` para toda entidad o DTO nuevo. Exporta tipos inferidos.
2. **Paso 2 — Domain:** Implementa lógica de negocio pura en `@auria/domain`. Usa ports/adapters para dependencias externas. Sin dependencia de framework, UI, o Electron.
3. **Paso 3 — Infrastructure:** Si necesita DB: crea migración en `supabase/migrations/`. Si necesita Edge Function: crea en `supabase/functions/`. Si necesita IPC: define canal en preload y handler en main.
4. **Paso 4 — UI:** Implementa componentes en la feature folder correspondiente. Usa hooks para datos (TanStack Query), Zustand para estado local complejo. Sigue patrones de componentes existentes.
5. **Paso 5 — Wiring:** Conecta todo: registra rutas, agrega imports, exporta desde barrel files, vincula IPC channels, registra en catálogos.

### Fase 3: Calidad
1. Manejo de errores explícito en cada capa (domain throws, UI muestra, IPC transmite).
2. Loading states y error states en componentes UI.
3. Validación Zod en toda frontera de datos.
4. TypeScript strict — cero `any`, cero type assertions sin justificación.
5. Naming semántico y consistente con el resto del proyecto.

### Fase 4: Testing
1. Tests unitarios para lógica de domain (Vitest).
2. Tests para schemas Zod (validación positiva y negativa).
3. Tests para edge cases identificados durante el diseño.
4. Propuesta de tests de integración si el flujo cruza múltiples capas.

### Fase 5: Documentación de la implementación
1. Lista completa de archivos creados y modificados.
2. Diagrama de flujo de datos (texto) si la feature tiene más de 3 capas.
3. Decisiones de diseño relevantes y sus alternativas descartadas.
4. Puntos de extensión para futuras iteraciones.

## E. Estándares obligatorios

- **Contract-first:** No implementar UI ni servicios sin antes definir schemas en `@auria/contracts`.
- **No código huérfano:** Todo archivo creado debe estar importado/consumido por alguien. Toda ruta registrada. Todo IPC channel conectado.
- **Domain puro:** La lógica de negocio en `@auria/domain` no puede depender de React, Electron, ni Supabase directamente — usa ports.
- **Feature folders:** Nuevas pantallas van en `apps/desktop/src/renderer/features/{nombre}/` con subcarpetas `components/` y `hooks/`.
- **Electron boundaries:** Renderer nunca accede a Node APIs. Todo vía IPC tipado.
- **Loading/Error states:** Todo componente que consume datos async debe manejar loading, error, y empty states.
- **No stubs:** No entregar funciones vacías, `// TODO`, ni `console.log("implement later")`.

## F. Qué debe evitar

- Crear archivos que nadie importa (código huérfano desde el día 0).
- Poner lógica de negocio en componentes React o handlers de IPC.
- Crear tipos sueltos fuera de `@auria/contracts` para datos que cruzan fronteras.
- Hardcodear configuración que debe estar en variables de entorno o settings.
- Implementar sin considerar los estados de UI (loading, error, empty, success).
- Saltarse la capa de domain e ir directo de UI a Supabase.
- Crear servicios que dependen de `window`, `document`, `electron`, o `process` fuera de su runtime.
- Entregar la feature sin probar que se puede navegar/acceder/ejecutar desde la UI.
- Duplicar lógica que ya existe en el proyecto.
- Crear nuevas dependencias npm sin justificación.

## G. Formato de respuesta esperado

### 1. Entendimiento del requisito
- Qué se construye, para quién, cuál es el flujo de usuario esperado.

### 2. Diseño arquitectónico
- Distribución de responsabilidades por capa del monorepo.
- Schemas/tipos nuevos. Servicios nuevos. Componentes nuevos. IPC channels. DB changes.

### 3. Implementación completa
- Código organizado por capa, en orden de implementación:
  1. Contracts (schemas, tipos)
  2. Domain (servicios, ports)
  3. Infrastructure (migrations, edge functions, IPC)
  4. UI (componentes, hooks, rutas)
  5. Wiring (imports, registros, conexiones)

### 4. Tests
- Suite de tests por capa.

### 5. Lista de archivos
- Tabla: archivo → acción (creado/modificado) → propósito.

### 6. Riesgos y validaciones
- Edge cases. Regresiones posibles. Cómo probar end-to-end. Puntos de extensión futura.

## H. Criterios de aceptación

- [ ] Los schemas Zod están definidos en `@auria/contracts` antes que el código de domain o UI.
- [ ] La lógica de negocio vive en `@auria/domain`, libre de dependencias de framework.
- [ ] Todo archivo creado tiene al menos un consumidor (no hay huérfanos).
- [ ] Las rutas están registradas y son navegables.
- [ ] Los IPC channels están definidos en preload y manejados en main.
- [ ] Los componentes UI manejan loading, error y empty states.
- [ ] No hay `any`, type assertions injustificadas, ni errores de TypeScript strict.
- [ ] Existen tests unitarios para la lógica de domain.
- [ ] Existen tests para los schemas Zod (positivos y negativos).
- [ ] La feature funciona end-to-end (se puede acceder y usar desde la UI).
- [ ] No se duplicó lógica ya existente en el proyecto.

## I. Plantilla final reusable

```
Carga: _contexto-stack.md + _maestro-universal.md + 08-nueva-implementacion.md

Feature: [Nombre y descripción de la funcionalidad]
Requisito funcional: [Qué debe hacer, flujo de usuario esperado]
Capas involucradas: [contracts / domain / UI / IPC / DB / edge function]
Pantallas nuevas: [Sí/No — nombres si aplica]
Integración con módulos existentes: [Cuáles]
Restricciones: [Solo frontend / no DB / no nuevas dependencias / incremental]
Prioridad de negocio: [alta / media / baja]
```
