/**
 * Prompts de retrospectiva — Auto-evaluación y análisis de capacidades.
 */
import type { RunStrategy } from "@auria/contracts";

export function getRetrospectivePrompt(runData: {
  id: string;
  strategy: RunStrategy;
  improvements: Array<{
    file: string;
    category: string;
    description: string;
    applied: boolean;
  }>;
  errors: string[];
  warnings: string[];
  durationMinutes: number;
  pastRetrospectives: string;
}): string {
  return `Eres el módulo de auto-evaluación de AURIA. Analiza el run que acaba de completar y genera una retrospectiva HONESTA.

## Run actual
- ID: ${runData.id}
- Estrategia elegida: ${runData.strategy}
- Duración: ${runData.durationMinutes} minutos
- Mejoras aplicadas: ${runData.improvements.filter((i) => i.applied).length}
- Mejoras fallidas: ${runData.improvements.filter((i) => !i.applied).length}
- Errores durante el run: ${runData.errors.length}

## Mejoras implementadas
${runData.improvements.filter((i) => i.applied).map((i) => `- [${i.category}] ${i.file}: ${i.description}`).join("\n") || "Ninguna"}

## Errores y warnings
${runData.errors.join("\n") || "Ninguno"}
${runData.warnings.join("\n") || ""}

## Retrospectivas anteriores
${runData.pastRetrospectives || "No hay retrospectivas anteriores"}

## Evalúa HONESTAMENTE:
1. **impactScore** (1-5): ¿El equipo puede ver algo NUEVO?
   - 1 = No cambió nada útil / solo cosmético
   - 2 = Mejora menor, casi no se nota
   - 3 = Mejora funcional visible
   - 4 = Feature nueva útil
   - 5 = Capacidad transformadora
2. **outcome**: Resumen de qué se logró realmente (1 oración honesta)
3. **lessons**: Lecciones aprendidas
4. **mistakes**: Errores cometidos
5. **suggestedGoals**: Objetivos estratégicos nuevos para el roadmap
6. **suggestedCapabilities**: Capacidades detectadas { name, status, files, gaps }
7. **nextStrategy**: Qué estrategia debería usar el SIGUIENTE run y por qué

## JSON esperado:
{
  "impactScore": 3,
  "outcome": "Se implementó X pero no se integró Y",
  "lessons": ["Lección 1", "Lección 2"],
  "mistakes": ["Error 1"],
  "suggestedGoals": [
    { "title": "Implementar X", "description": "...", "priority": "high", "area": "infrastructure" }
  ],
  "suggestedCapabilities": [
    { "name": "Feature X", "status": "functional", "files": ["src/x.ts"], "gaps": ["falta Y"] }
  ],
  "nextStrategy": { "strategy": "innovation", "focus": "...", "reason": "..." }
}`;
}

export function getCapabilityAnalysisPrompt(
  fileList: string,
  currentCapabilities: string,
): string {
  return `Eres un analista de arquitectura de software. Analiza el codebase e identifica:

## Archivos del proyecto
${fileList}

## Capacidades ya registradas
${currentCapabilities || "Ninguna registrada aún"}

## Tu trabajo:
1. **Capacidades existentes**: Qué puede hacer el sistema actualmente
2. **Gaps críticos**: Funcionalidades incompletas o desconectadas
3. **Oportunidades**: Funcionalidades nuevas de ALTO IMPACTO
4. **Código muerto**: Servicios/archivos que no están conectados
5. **Integraciones rotas**: Imports/handlers que referencian cosas inexistentes

## JSON esperado:
{
  "capabilities": [
    { "name": "X", "status": "functional|partial|broken|missing", "files": ["..."], "description": "...", "gaps": ["..."] }
  ],
  "criticalGaps": [
    { "gap": "...", "impact": "high|medium|low", "suggestedSolution": "..." }
  ],
  "opportunities": [
    { "feature": "...", "impact": "high|medium|low", "complexity": "low|medium|high", "description": "..." }
  ],
  "deadCode": ["archivo1.ts"],
  "brokenIntegrations": [
    { "file": "...", "issue": "..." }
  ]
}`;
}
