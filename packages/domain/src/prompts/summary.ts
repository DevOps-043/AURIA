/**
 * Prompt de resumen — Genera reporte del run para notificaciones.
 */

export const SUMMARY_PROMPT = `Genera un INFORME COMPLETO del siguiente run de AURIA.

## Run info
{RUN_INFO}

## Mejoras aplicadas
{IMPROVEMENTS}

## Investigación realizada
{RESEARCH_FINDINGS}

## Instrucciones
- Escribe en español
- Máximo 3000 caracteres
- Estructura del informe:

### Sección 1: Resumen ejecutivo (2-3 líneas)
- Qué se hizo en este run y cuántas líneas de código se implementaron

### Sección 2: Mejoras implementadas (detallado)
- Lista cada mejora con descripción de qué hace
- Si se corrigieron vulnerabilidades, detalla cuáles
- Si se agregaron funcionalidades, explica cómo usarlas

### Sección 3: Estado del sistema (si aplica)
- Errores encontrados y corregidos
- Vulnerabilidades parcheadas

### Sección 4: Próximos pasos
- Qué se investigó pero no se implementó aún
- Qué se planea para el próximo run

### Formato
- Incluye el link al PR al final
- Incluye métricas: líneas implementadas, archivos tocados, tiempo del run

## Output
Responde SOLO con el texto del mensaje (no JSON).`;
