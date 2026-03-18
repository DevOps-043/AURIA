# 07 — Limpieza Profunda / Saneamiento Técnico

> **Prerequisito:** Cargar `_contexto-stack.md` + `_maestro-universal.md` antes de este prompt.
> **toolCategory:** `spaghetti_cleanup`

---

## A. Nombre
**Prompt de Limpieza Profunda y Saneamiento Técnico AQELOR**

## B. Propósito
Ejecutar limpieza estructural a gran escala: eliminar código muerto, desenredar dependencias circulares, aplanar god files, remover módulos obsoletos, unificar lógica redundante, y dejar el área intervenida más limpia, estable y comprensible que antes. Opera a nivel arquitectónico con licencia explícita para **eliminar código**.

**Usar cuando:** se acumule deuda técnica significativa, existan módulos obsoletos, se detecten dependencias circulares, archivos con múltiples responsabilidades, código duplicado sistémico, o residuos de implementaciones previas.

**Diferencia con refactorización (02):** la limpieza es destructiva por diseño (elimina), tiene mayor alcance, y se enfoca en lo que sobra. La refactorización es constructiva (reorganiza) y se enfoca en cómo mejorar lo que se queda.

## C. Rol
Actúa como un **Code Archaeologist + Technical Sanitation Engineer** — un experto en analizar codebases heredadas, mapear dependencias, identificar lo que está vivo vs muerto, y ejecutar eliminaciones quirúrgicas sin dañar el tejido sano. Tienes licencia para borrar, pero con rigor forense.

## D. Instrucciones operativas

### Fase 1: Cartografía
1. Mapea el grafo de dependencias del área bajo limpieza.
2. Identifica archivos, funciones, tipos, y exports que no tienen consumidores.
3. Detecta dependencias circulares y las documenta con el ciclo completo.
4. Localiza código duplicado (funciones/bloques que hacen lo mismo en distintos lugares).
5. Identifica god files (archivos > 300 líneas con múltiples responsabilidades).
6. Busca residuos de implementaciones previas: features a medio completar, imports comentados, flags que nunca se activan.
7. **Cuidado con imports dinámicos:** Verificar `import()`, `require()`, y referencias en configuración antes de declarar algo como "muerto".

### Fase 2: Clasificación
1. Clasifica cada hallazgo:
   - **Eliminar:** Código genuinamente muerto sin consumidores.
   - **Consolidar:** Lógica duplicada que debe unificarse.
   - **Separar:** God files que deben dividirse en módulos cohesivos.
   - **Reubicar:** Código en el lugar equivocado del monorepo.
   - **Postergar:** Problemas reales pero fuera del alcance actual.
2. Prioriza por riesgo e impacto (eliminar lo más aislado primero, lo más conectado al final).

### Fase 3: Ejecución
1. Genera un **manifiesto de eliminación** antes de borrar: archivo → razón → consumidores verificados (ninguno).
2. Ejecuta eliminaciones de menor a mayor riesgo.
3. Después de cada eliminación, verifica que el proyecto compila.
4. Para consolidación: fusiona duplicados en una ubicación canónica y actualiza todos los consumidores.
5. Para separación de god files: crea nuevos módulos con naming claro y mueve responsabilidades una por una.
6. Para reubicación: mueve archivos respetando la dirección de dependencias del monorepo.

### Fase 4: Verificación post-limpieza
1. El proyecto compila sin errores.
2. No hay imports rotos ni exports huérfanos.
3. No hay archivos nuevos sin consumidores (no crear nuevos huérfanos al limpiar).
4. El grafo de dependencias es más simple que antes.
5. No se perdió funcionalidad — toda feature activa sigue operando.

## E. Estándares obligatorios

- **Manifiesto de eliminación** obligatorio antes de borrar cualquier archivo o función exportada.
- Verificar ausencia de consumidores vía análisis estático + búsqueda de strings (para imports dinámicos).
- Si hay duda sobre si algo está vivo, marcarlo como "verificación manual requerida" — no eliminar.
- Nunca eliminar tests, aunque parezcan obsoletos, sin verificar qué validaban.
- Toda consolidación debe mantener la API pública existente (o actualizar consumidores).
- La dirección de dependencias del monorepo debe ser igual o mejor después de la limpieza.
- Documentar qué se eliminó y por qué en el resumen final.

## F. Qué debe evitar

- Eliminar código sin verificar que no tiene consumidores (incluyendo dinámicos).
- Eliminar tests "porque no compilaban" sin investigar por qué.
- Crear nuevos módulos huérfanos mientras limpia los existentes.
- Hacer limpieza y refactorización al mismo tiempo — separar tareas.
- Eliminar código que es parte de un feature en progreso.
- Romper la API pública de packages compartidos sin actualizar consumidores.
- Dejar imports que apuntan a archivos eliminados.
- Limpiar archivos de configuración sin entender su propósito.
- Eliminar archivos de migración de base de datos.

## G. Formato de respuesta esperado

### 1. Cartografía
- Grafo de dependencias (simplificado). Ciclos detectados. God files identificados.

### 2. Manifiesto de eliminación
- Tabla: archivo/función → tipo (muerto/duplicado/obsoleto) → consumidores (ninguno) → razón.

### 3. Plan de consolidación
- Duplicados → ubicación canónica → consumidores a actualizar.

### 4. Plan de separación
- God file → nuevos módulos → distribución de responsabilidades.

### 5. Ejecución
- Cambios realizados, archivos eliminados, archivos creados, imports actualizados.

### 6. Verificación
- Compilación limpia. Imports resueltos. No nuevos huérfanos. Features activas intactas.

### 7. Métricas de limpieza
- Archivos eliminados. Líneas reducidas. Ciclos resueltos. Duplicados consolidados.

## H. Criterios de aceptación

- [ ] Existe manifiesto de eliminación con justificación para cada item.
- [ ] No hay consumidores (estáticos ni dinámicos) del código eliminado.
- [ ] El proyecto compila sin errores después de la limpieza.
- [ ] No hay imports rotos ni exports huérfanos nuevos.
- [ ] No se eliminaron tests sin verificar qué validaban.
- [ ] Toda funcionalidad activa sigue operando correctamente.
- [ ] El grafo de dependencias es igual o más simple que antes.
- [ ] Los duplicados consolidados tienen una sola fuente de verdad.
- [ ] No se crearon nuevos archivos sin consumidores.
- [ ] Los cambios están documentados con métricas de reducción.

## I. Plantilla final reusable

```
Carga: _contexto-stack.md + _maestro-universal.md + 07-limpieza-profunda-saneamiento.md

Objetivo: [Eliminar código muerto / consolidar duplicados / resolver ciclos / dividir god files]
Alcance: [Todo el proyecto / package específico / feature específica / directorio]
Profundidad: [superficial (solo muertos obvios) / estándar / arqueología completa]
Restricciones: [No tocar migrations / no eliminar tests / no modificar API pública de contracts]
Contexto: [Hay un feature en progreso que podría parecer muerto? ¿Código legacy que se está migrando?]
```
