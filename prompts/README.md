# Sistema de Prompts Operativos — AQELOR

## Estructura jerárquica

```
Tier 0: _contexto-stack.md          (datos factuales del stack — siempre cargar)
   ↓
Tier 1: _maestro-universal.md       (principios universales — siempre cargar)
   ↓
Tier 2: XX-especializado.md         (instrucciones por dominio — cargar según tarea)
   ↕
Capa transversal: 10-investigacion-tecnica.md  (se activa DENTRO de cualquier herramienta)
```

## Cómo usar

**Siempre cargar los 3 tiers:**

```
_contexto-stack.md + _maestro-universal.md + [prompt especializado]
```

### Prompts disponibles

| # | Archivo | toolCategory | Cuándo usar |
|---|---------|-------------|-------------|
| 01 | `01-documentacion.md` | `documentation` | JSDoc, ADRs, READMEs, guías |
| 02 | `02-mejora-tecnica-refactorizacion.md` | `improvement` | Reestructurar sin cambiar comportamiento |
| 03 | `03-correccion-qa-bugs-hardening.md` | `qa_correction` | Bugs, tests, hardening |
| 04 | `04-calidad-legibilidad-codigo.md` | `quality` | Auditoría de código, naming, tipado |
| 05 | `05-seguridad.md` | `security` | Vulnerabilidades, threat modeling, RLS |
| 06 | `06-optimizacion-performance.md` | `optimization` | Cuellos de botella, bundle, queries |
| 07 | `07-limpieza-profunda-saneamiento.md` | `spaghetti_cleanup` | Código muerto, duplicados, god files |
| 08 | `08-nueva-implementacion.md` | `implementation` | Features nuevas end-to-end |
| 09 | `09-base-datos-migraciones.md` | — | Migraciones SQL, RLS, Edge Functions |
| **10** | **`10-investigacion-tecnica.md`** | **`research`** | **Capa transversal — se activa dentro de cualquier herramienta** |

### Prompt 10 — Investigación (capa transversal)

El prompt `10-investigacion-tecnica.md` no es una herramienta independiente como las demás. Es una **capa de investigación obligatoria** que se activa automáticamente dentro de cualquier otra herramienta cuando esta necesita información actualizada.

**Por qué existe:** El modelo (Gemini 3 Flash) tiene conocimiento pre-entrenado que caduca. Sin investigación forzada, el sistema genera recomendaciones basadas en datos obsoletos. Este prompt obliga al uso de **Google Search** y **URL Context** para verificar toda afirmación técnica antes de entregarla.

**Cuándo se activa:**
- Cualquier herramienta que vaya a afirmar algo sobre versiones, APIs, CVEs, o best practices actuales.
- Siempre que se recomiende un patrón, librería, configuración, o práctica que podría haber cambiado.

### Composición de prompts

Se pueden combinar múltiples prompts especializados para tareas complejas:

- **Bug fix + hardening:** `03` + `04`
- **Feature nueva + seguridad:** `08` + `05`
- **Refactorización + limpieza:** `02` + `07`
- **Feature con DB:** `08` + `09`
- **Cualquier herramienta + investigación:** `XX` + `10` (cuando se necesite información actual verificada)

### Ejemplo de invocación

```
Carga: _contexto-stack.md + _maestro-universal.md + 08-nueva-implementacion.md

Feature: Panel de métricas de uso de herramientas
Requisito funcional: Mostrar consumo de AU por herramienta en el dashboard
Capas involucradas: contracts / domain / UI
Pantallas nuevas: No — componente dentro del dashboard existente
Integración con módulos existentes: dashboard feature, billing snapshot
Restricciones: Solo frontend, datos ya disponibles en workspace snapshot
Prioridad de negocio: media
```

## Relación con runtime prompts

Los prompts en `packages/domain/src/prompts/` son **runtime prompts** consumidos programáticamente por el worker pipeline. Este directorio (`prompts/`) contiene **governance prompts** para herramientas de IA usadas por desarrolladores. Ambos sistemas deben mantener alineación filosófica con `PRODUCT_VISION` en `packages/domain/src/prompts/vision.ts`.

## Mantenimiento

- **Una fuente de verdad para el stack:** Actualizar solo `_contexto-stack.md` cuando cambie el stack.
- **No duplicar contenido del maestro:** Los prompts especializados referencian al maestro, no lo copian.
- **Alineación con contracts:** Cuando se agreguen nuevos valores a `toolCategorySchema`, crear prompt correspondiente.
- **Líneas máximas:** Maestro ≤ 300, especializados ≤ 250, contexto ≤ 80.
