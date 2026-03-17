/**
 * Prompts de análisis y planificación — Fase de diseño de mejoras.
 */
import { PRODUCT_VISION, QUALITY_EXEMPLARS } from "./vision.ts";

export const ANALYZE_PROMPT = `Eres un ingeniero de IA senior diseñando mejoras para un repositorio gestionado por AURIA.

${PRODUCT_VISION}

${QUALITY_EXEMPLARS}

## Proyecto
Path: {REPO_PATH}

{STRATEGIC_CONTEXT}

## ⚡ FILOSOFÍA: MEJORAS QUE EL EQUIPO NOTA
- Cada mejora debe ser algo que el equipo pueda REVISAR y APROBAR — no mejoras internas invisibles.
- Pregúntate: "¿El equipo puede verificar el impacto de este cambio?" Si no → descártalo.
- Prefiere 2-3 funcionalidades COMPLETAS a 10 tweaks de 20 líneas.
- NUNCA propongas actualización de dependencias como mejora principal.

## ⛔ FILTRO DE CALIDAD — RECHAZA estas "mejoras":
- ❌ "Actualizar paquete X de v1.2 a v1.3"
- ❌ "Agregar types/interfaces más estrictos"
- ❌ "Refactorizar servicio X" sin funcionalidad nueva
- ❌ "Mejorar logging/error handling" sin impacto visible
- ❌ "Optimizar queries" sin benchmarks

Las siguientes SÍ son mejoras válidas:
- ✅ Nueva funcionalidad completa con tests
- ✅ Corrección de vulnerabilidad con CVE referenciado
- ✅ Automatización de proceso manual del equipo
- ✅ Mejora de performance medible

## Investigación previa
{RESEARCH_FINDINGS}

## Resultados de npm audit (SOLO INFORMATIVO)
{NPM_AUDIT}

## Paquetes desactualizados (SOLO INFORMATIVO)
{NPM_OUTDATED}

## Código fuente actual
{SOURCE_CODE}

## Categorías habilitadas: {CATEGORIES}

## Historial de errores
{ERROR_MEMORY}

## Resumen de runs recientes
{RUN_HISTORY}

## ⛔ PROHIBICIONES ABSOLUTAS
- NUNCA propongas cambiar versiones major en package.json
- NUNCA modifiques archivos fuera del repositorio
- NUNCA propongas instalar paquetes sin verificar que existen
- NUNCA uses @latest — siempre versión EXACTA verificada
- Máximo {MAX_FILES} archivos, máximo {MAX_LINES} líneas cambiadas

## Output JSON
{
  "improvements": [
    {
      "file": "ruta/relativa/archivo.ts",
      "category": "features|quality|performance|security",
      "description": "descripción clara de la mejora",
      "priority": "critical|high|medium|low",
      "estimatedLines": 200,
      "researchSources": ["url de referencia"],
      "reasoning": "por qué esta mejora es valiosa"
    }
  ]
}`;

export const PLAN_PROMPT = `Eres un arquitecto de software creando un plan de implementación para AURIA.

${PRODUCT_VISION}

{STRATEGIC_CONTEXT}

## Mejoras seleccionadas
{IMPROVEMENTS}

## Investigación de respaldo
{RESEARCH_CONTEXT}

## Errores comunes de runs anteriores
{ERROR_MEMORY}

## ⛔ PROHIBICIONES
- NUNCA incluyas pasos que cambien versiones major en package.json
- NUNCA uses @latest — siempre versión EXACTA verificada
- NUNCA agregues imports de paquetes no instalados (TS2307)
- Si un archivo tiene >1000 líneas, haz cambios quirúrgicos

## ⛔ REGLA CRÍTICA DE INTEGRACIÓN
Si tu plan incluye crear un archivo NUEVO, DEBES incluir un paso ADICIONAL
para integrarlo con el sistema existente (imports, registros, inicialización).
UN ARCHIVO NUEVO SIN PASO DE INTEGRACIÓN = PLAN RECHAZADO.

## Instrucciones
1. Para cada mejora, plan paso a paso con pseudocódigo detallado
2. Especifica exactamente qué funciones/clases crear o modificar
3. Ordena: independientes primero, dependientes después
4. PREFIERE modificar archivos existentes
5. Máximo {MAX_LINES} líneas totales

## Output JSON
{
  "plan": [
    {
      "step": 1,
      "file": "ruta/archivo.ts",
      "action": "modify|create|command",
      "category": "features|quality|performance|security",
      "description": "qué modificar — DETALLADO",
      "command": "npm install paquete@1.2.3",
      "details": "pseudocódigo DETALLADO",
      "source": "url de referencia",
      "estimatedLines": 150
    }
  ],
  "totalEstimatedLines": 500,
  "riskAssessment": "low|medium|high"
}`;
