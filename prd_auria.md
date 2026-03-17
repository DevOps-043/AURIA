# PRD — Auria

## 1. Información general del producto

**Nombre del producto:** Auria  
**Categoría:** Plataforma de mejora autónoma continua de repositorios impulsada por inteligencia artificial  
**Plataformas objetivo:** Aplicación de escritorio para **Windows** y **Linux**  
**Tipo de producto:** Desktop app con control plane en la nube y ejecución híbrida local/cloud  
**Versión del documento:** v1.0  
**Estado:** Borrador base para definición de producto y arquitectura

---

## 2. Resumen ejecutivo

Auria es una plataforma de escritorio orientada a repositorios de software que permite configurar objetivos de mejora continua sin necesidad de prompts técnicos constantes. El usuario conecta su repositorio, define políticas, límites y objetivos de operación, y el sistema analiza, prioriza, investiga, ejecuta y valida cambios de forma autónoma mediante múltiples agentes de IA coordinados.

Auria no se posiciona como un copiloto conversacional ni como un simple asistente de código. Su propuesta de valor es operar como una **capa de ingeniería autónoma** capaz de mejorar repositorios bajo reglas explícitas de riesgo, presupuesto, alcance, memoria histórica y gobernanza.

El sistema debe poder:

- detectar deuda técnica, problemas de calidad, riesgos de seguridad y oportunidades de mejora,
- investigar opciones usando herramientas externas,
- proponer y ejecutar cambios en paralelo,
- aprender de errores previos a nivel de aplicación,
- mantener una memoria persistente y acumulativa del repositorio,
- operar con límites claros sobre líneas modificadas, archivos leídos, archivos tocados y zonas críticas,
- permitir hasta **15 agentes concurrentes** trabajando bajo coordinación y políticas.

---

## 3. Visión del producto

Convertir a Auria en la plataforma de referencia para mejora autónoma continua de software, permitiendo que equipos y propietarios de repositorios deleguen trabajo técnico repetitivo, correctivo, preventivo y exploratorio a un sistema inteligente con memoria, evidencia y control.

---

## 4. Problema que resuelve

Los equipos de desarrollo acumulan deuda técnica, bugs, falta de cobertura, dependencias desactualizadas, problemas de documentación, vulnerabilidades y oportunidades de mejora que rara vez se atienden con consistencia.

Aunque existen asistentes de código y agentes capaces de resolver tareas puntuales, la mayoría de soluciones actuales dependen de:

- prompts explícitos,
- issues redactados manualmente,
- supervisión intensiva,
- contexto limitado,
- falta de memoria persistente del repositorio,
- poca trazabilidad sobre por qué actuaron,
- ausencia de aprendizaje operativo basado en fallos previos.

Auria resuelve esto proporcionando un sistema configurable desde interfaz gráfica que permite definir metas como:

- mejorar calidad,
- reducir deuda técnica,
- endurecer seguridad,
- actualizar dependencias,
- aumentar cobertura,
- investigar mejoras,
- innovar con bajo riesgo,

para que la plataforma opere por objetivos y políticas, no únicamente por prompts.

---

## 5. Propuesta de valor

### 5.3 Valor de contexto documental

Auria debe permitir que el usuario cargue documentación del sistema para mejorar el entendimiento funcional, técnico y operativo del producto analizado. Esta documentación servirá como fuente adicional de conocimiento para que los agentes comprendan mejor:

- qué hace el sistema,
- qué necesita hacer,
- cuáles son sus restricciones,
- cuáles son sus capacidades actuales,
- cuáles son sus oportunidades reales de innovación,
- qué mejoras son viables,
- y cómo proponer cambios alineados al contexto del negocio y del software.

La documentación cargada por el usuario se incorporará a la memoria del repositorio y será utilizada para análisis, innovación, priorización de mejoras, comprensión de alcance y toma de decisiones más precisas.


### 5.1 Propuesta de valor principal

Auria permite que un usuario conecte su repositorio y configure objetivos para que una red de agentes de IA:

1. entienda el repositorio,
2. construya memoria persistente,
3. detecte oportunidades de mejora,
4. investigue soluciones,
5. priorice por impacto y riesgo,
6. ejecute cambios dentro de límites definidos,
7. valide resultados,
8. entregue evidencia y trazabilidad.

### 5.2 Diferenciadores principales

- Operación por objetivos, no solamente por prompts.
- Memoria acumulativa del repositorio.
- Aprendizaje a partir de errores previos.
- Soporte para investigación con herramientas externas como búsqueda web y análisis de URLs.
- Configuración de múltiples modelos y agentes en paralelo.
- Gobernanza fina por políticas, límites y zonas críticas.
- Aplicación desktop con posibilidad de operación local/híbrida.

---

## 6. Objetivos del producto

### 6.1 Objetivos de negocio

- Crear una plataforma SaaS + desktop de suscripción recurrente.
- Diferenciarse de copilotos genéricos y asistentes de IDE.
- Posicionarse como herramienta de mejora autónoma continua del SDLC.
- Crear una base sólida para expansión enterprise y multi-repo.

### 6.2 Objetivos funcionales

- Permitir conexión a repositorios desde una app de escritorio.
- Permitir configuración visual de objetivos, políticas y límites.
- Ejecutar mejoras de manera autónoma con agentes especializados.
- Investigar soluciones externas con herramientas web controladas.
- Gestionar memoria persistente del repositorio y de ejecuciones previas.
- Operar hasta con 15 agentes concurrentes.
- Entregar resultados auditables, reproducibles y gobernables.

### 6.3 Objetivos de experiencia de usuario

- Reducir al mínimo la necesidad de escribir instrucciones técnicas.
- Hacer visible en tiempo real qué hace cada agente.
- Generar confianza mediante evidencia, métricas y trazabilidad.
- Permitir al usuario mantener control mediante políticas, límites y aprobaciones.

---

## 7. No objetivos iniciales

Quedan fuera del MVP o de la primera versión de producto:

- soporte nativo para macOS,
- despliegue automático a producción,
- cambios arquitectónicos de alto riesgo sin intervención humana,
- entrenamiento de modelos base propios,
- operación totalmente offline,
- soporte oficial multi-SCM desde día uno más allá del proveedor principal inicial,
- auto-merge de cambios complejos en áreas críticas,
- orquestación de infraestructura cloud del cliente.

---

## 8. Usuarios objetivo

### 8.1 Usuario primario

- Desarrolladores individuales avanzados.
- Tech leads.
- Fundadores técnicos.
- Equipos pequeños con alto backlog técnico.
- Equipos que quieren automatizar trabajo de mantenimiento, mejora y hardening.

### 8.2 Usuario secundario

- CTOs.
- QA leads.
- Engineering managers.
- Equipos de producto que necesitan acelerar calidad sin aumentar headcount.

### 8.3 Usuario enterprise futuro

- Organizaciones multi-equipo.
- Áreas con requerimientos de seguridad, trazabilidad y gobernanza.
- Repositorios con múltiples políticas por dominio o carpeta.

---

## 9. Casos de uso clave

1. El usuario conecta un repositorio y activa el objetivo “reducir deuda técnica”.
2. El usuario activa “mejorar seguridad” y Auria detecta hallazgos, los prioriza y propone correcciones.
3. El usuario configura una política para que se actualicen automáticamente dependencias patch de bajo riesgo.
4. El usuario limita a 300 líneas por misión y máximo 5 archivos modificados por tarea.
5. El usuario restringe lectura solo a determinadas carpetas del proyecto.
6. El usuario permite investigación externa para encontrar mejores prácticas o patrones de solución.
7. El usuario ejecuta 10 a 15 agentes en paralelo para atacar deuda, tests, documentación y refactors menores.
8. El sistema falla en una misión, registra la lección y ajusta el riesgo de ese tipo de intervención en el futuro.
9. El usuario revisa evidencia antes/después de una propuesta generada por el sistema.
10. El usuario deja Auria activo en segundo plano para analizar y proponer mejoras cuando sea pertinente dentro de reglas definidas.

---

## 10. Alcance funcional del producto

### 10.1 Capacidades núcleo

- Conexión a repositorios.
- Ingesta y comprensión del contexto del repo.
- Ingesta de documentación funcional, técnica y operativa del sistema.
- Construcción de memoria persistente.
- Definición de objetivos de mejora.
- Sistema de políticas y límites.
- Orquestación de agentes y modelos.
- Investigación externa controlada.
- Generación y validación de cambios.
- Evidencia y auditabilidad.
- Suscripciones y control de plan.

### 10.2 Modos operativos

#### Modo Cloud Repo
Auria opera sobre repos remotos a través de integraciones oficiales y pipelines de validación remota.

#### Modo Local / Hybrid
La aplicación de escritorio instala o ejecuta un worker local para analizar o modificar código dentro del equipo del usuario, conservando coordinación con el control plane.

---

## 11. Requerimientos funcionales

### 11.1 Gestión de cuenta y suscripción

- El usuario debe poder registrarse e iniciar sesión.
- El sistema debe soportar autenticación y sesiones seguras.
- El usuario debe poder suscribirse a un plan mensual o anual.
- El sistema debe reflejar estado de suscripción, consumo y límites.
- El usuario debe poder gestionar upgrades, downgrades, cancelaciones y método de pago.

### 11.2 Conexión de repositorio

- El usuario debe poder conectar uno o más repositorios permitidos por su plan.
- El sistema debe poder sincronizar metadatos del repositorio.
- El sistema debe poder identificar rama principal, estructura, archivos relevantes y carpetas críticas.
- El usuario debe poder seleccionar si el modo será cloud, local o híbrido.

### 11.2.1 Carga de documentación del sistema

- El usuario debe poder subir documentación del sistema para enriquecer el entendimiento de Auria.
- El sistema debe aceptar documentación técnica, funcional, operativa, arquitectónica y de producto, según los formatos soportados por la plataforma.
- El sistema debe procesar dicha documentación e integrarla como contexto recuperable para agentes, memoria e investigación.
- El sistema debe usar esta documentación para entender mejor qué hace actualmente el sistema y qué debería hacer.
- El sistema debe aprovechar esta documentación para generar propuestas de innovación, mejora, refactor, expansión funcional y recomendaciones más alineadas a la realidad del producto.
- La documentación cargada debe poder asociarse a un repositorio o workspace específico.
- El usuario debe poder actualizar, reemplazar o eliminar documentación previamente cargada.

### 11.3 Configuración de objetivos

El usuario debe poder activar o desactivar objetivos como:

- calidad,
- seguridad,
- deuda técnica,
- dependencias,
- cobertura,
- documentación,
- performance,
- innovación,
- investigación.

### 11.4 Políticas y límites

El sistema debe permitir definir políticas para:

- máximo de líneas modificadas por misión,
- máximo de líneas modificadas por archivo,
- máximo de archivos tocados,
- carpetas permitidas,
- carpetas prohibidas,
- tipos de archivo legibles,
- tipos de archivo excluidos,
- zonas críticas con aprobación obligatoria,
- horarios permitidos de ejecución,
- nivel de autonomía,
- umbrales de riesgo,
- cantidad máxima de agentes concurrentes,
- presupuesto por periodo,
- frecuencia de ejecución,
- modo solo propuesta / PR / auto-merge de bajo riesgo.

### 11.5 Investigación externa

El sistema debe poder usar herramientas de investigación configurables para:

- búsqueda web,
- lectura contextual de URLs,
- análisis comparativo de enfoques,
- construcción de reportes de investigación,
- soporte a propuestas de cambio basadas en fuentes externas.

La investigación externa debe estar gobernada por políticas y ser trazable.

### 11.6 Orquestación de agentes

El sistema debe poder:

- lanzar agentes especializados,
- ejecutar agentes en paralelo,
- coordinar prioridades,
- evitar conflictos de escritura sobre la misma zona del repo,
- reasignar subtareas,
- consolidar resultados,
- bloquear o escalar tareas de alto riesgo.

### 11.7 Ejecución de cambios

El sistema debe poder:

- analizar archivos permitidos,
- generar propuestas de modificación,
- crear ramas de trabajo,
- aplicar cambios dentro de límites establecidos,
- ejecutar validaciones,
- registrar hallazgos,
- producir evidencia,
- preparar resultados para revisión.

### 11.8 Validación y evidencia

Cada misión o propuesta debe incluir:

- objetivo atendido,
- justificación de la acción,
- archivos leídos,
- archivos modificados,
- líneas modificadas,
- validaciones ejecutadas,
- riesgo estimado,
- impacto esperado,
- lecciones aprendidas,
- referencias externas si hubo investigación,
- estado final de la misión.

### 11.9 Aprendizaje por errores

El sistema debe almacenar errores operativos y técnicos para:

- evitar repetir estrategias fallidas,
- subir el nivel de riesgo de ciertos patrones,
- sugerir alternativas que antes resultaron exitosas,
- enriquecer la memoria del repositorio,
- ajustar heurísticas específicas del proyecto.

### 11.10 Memoria persistente del repositorio

El sistema debe mantener una memoria acumulativa que registre:

- estructura del repo,
- decisiones previas,
- patrones de error,
- cambios exitosos,
- hallazgos históricos,
- zonas frágiles,
- contexto de PRs y misiones,
- documentación relevante,
- documentación cargada por el usuario sobre el sistema, alcance, reglas, módulos y comportamiento esperado,
- relaciones entre módulos, archivos y problemas.

---

## 12. Requerimientos no funcionales

### 12.1 Plataforma

- La aplicación debe funcionar en Windows y Linux.
- La aplicación debe poder operar en primer plano y segundo plano.
- La aplicación debe soportar actualizaciones seguras.

### 12.2 Seguridad

- Las credenciales sensibles no deben almacenarse inseguramente en el cliente.
- La comunicación con backend debe ser cifrada.
- Los accesos a datos deben regirse por políticas de seguridad y aislamiento.
- Debe existir auditoría de acciones críticas.

### 12.3 Escalabilidad

- La plataforma debe soportar múltiples workspaces.
- El backend debe soportar múltiples repositorios por usuario según plan.
- El sistema debe manejar concurrencia de hasta 15 agentes por workspace según configuración.

### 12.4 Disponibilidad

- El control plane debe ser resiliente a fallos parciales.
- El sistema debe registrar estados intermedios y permitir reintentos.

### 12.5 Observabilidad

- Deben existir logs de sistema, misión, agente y modelo.
- Deben poder auditarse decisiones y bloqueos por política.

---

## 13. Arquitectura del producto

### 13.1 Visión general

Auria se compone de tres capas principales:

1. **Cliente Desktop**  
   Interfaz de escritorio para Windows y Linux, configuración, visualización, control y worker local opcional.

2. **Control Plane Cloud**  
   Administración de cuentas, suscripciones, políticas, memoria global, orquestación, coordinación de agentes y estado de misiones.

3. **Execution Plane**  
   Runners o workers locales/remotos que analizan repositorios, ejecutan tareas, generan cambios y validan resultados.

### 13.2 Stack tecnológico propuesto

#### Cliente desktop
- Electron
- React
- TypeScript
- Vite
- Tailwind
- Zustand
- TanStack Query

#### Backend / control plane
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- pgvector sobre Postgres

#### Integraciones externas
- Proveedor de repositorios principal
- Pasarela de pago para suscripciones
- Proveedores de modelos de IA
- Herramientas de investigación externa y contexto web

---

## 14. Base de datos y memoria

### 14.0 Contexto documental adicional

Además del código fuente y del historial operativo del repositorio, Auria debe poder construir conocimiento a partir de documentación cargada por el usuario. Esta documentación debe ser tratada como una fuente prioritaria de contexto cuando describa funcionalidades, arquitectura, restricciones, procesos del negocio, objetivos del sistema o lineamientos deseados.

El uso de esta documentación permitirá que Auria no solo entienda mejor cómo está construido el sistema, sino también qué necesita lograr, qué innovaciones son viables, qué mejoras tienen sentido y cuáles propuestas estarían alineadas con la intención funcional del producto.



### 14.1 Motor de datos principal

La fuente de verdad del sistema será **Supabase Postgres**.

### 14.2 Componentes de almacenamiento

- **Postgres** para entidades transaccionales y configuración.
- **pgvector** para memoria semántica y recuperación contextual.
- **Storage** para artefactos, logs, reportes, snapshots y memoria fría.
- **Realtime** para estados de agentes y misiones en tiempo real.

### 14.3 Estrategia de memoria del repositorio

La “memoria infinita” se implementará como memoria acumulativa por capas:

#### Capa 1 — Memoria estructurada
Tablas relacionales de entidades, políticas, hallazgos y ejecuciones.

#### Capa 2 — Memoria semántica
Embeddings de archivos, módulos, documentación, PRs, errores y decisiones.

#### Capa 3 — Memoria episódica
Registro detallado de cada misión y su resultado.

#### Capa 4 — Memoria relacional/grafo
Relaciones entre módulos, carpetas, errores, fixes, owners y zonas críticas.

#### Capa 5 — Memoria fría
Históricos, logs extendidos, reportes y snapshots almacenados en Storage.

---

## 15. Esquema de datos inicial sugerido

### Entidades principales
- uploaded_documents
- document_chunks
- document_embeddings
- document_links
- workspaces
- users
- subscriptions
- repositories
- repository_connections
- repository_policies
- repository_paths
- repository_memory_profiles
- agent_profiles
- missions
- mission_tasks
- mission_events
- mission_artifacts
- pull_request_candidates
- findings
- validations
- research_sessions
- external_sources
- error_lessons
- memory_entries
- memory_embeddings
- memory_links
- usage_counters
- billing_events

### Buckets sugeridos de Storage
- repo-snapshots
- mission-artifacts
- research-reports
- logs
- cold-memory

---

## 16. Sistema de agentes

### 16.1 Principio general

Auria usará múltiples agentes coordinados, con hasta **15 agentes concurrentes** por workspace según plan y configuración.

### 16.2 Tipos de agentes sugeridos

- Planner Agent
- Risk / Gate Agent
- Research Agent
- Reviewer / Critic Agent
- Test Strategy Agent
- Debt Agent
- Security Agent
- Dependency Agent
- Coverage Agent
- Docs Agent
- Performance Agent
- Refactor Agent
- Innovation Agent
- Patch Verification Agent
- Memory Curator Agent

### 16.3 Reglas de coordinación

- Múltiples agentes pueden analizar en paralelo.
- Múltiples agentes pueden investigar en paralelo.
- No deben escribir simultáneamente sobre la misma zona crítica sin arbitraje.
- Debe existir un coordinador que asigne prioridad y resuelva conflictos.
- Toda propuesta relevante debe pasar por evaluación de riesgo.

### 16.4 Límite operativo

El sistema debe permitir configurar un máximo de agentes concurrentes hasta 15. Este límite puede depender del plan contratado, del presupuesto y del perfil del repositorio.

---

## 17. Configuración de modelos

### 17.1 Objetivo

Permitir al usuario o al sistema seleccionar modelos por rol y operar con múltiples modelos en paralelo.

### 17.2 Configuración por rol

Auria debe permitir configurar al menos:

- modelo principal por tipo de tarea,
- fallback por tipo de tarea,
- política de costo,
- política de latencia,
- nivel de profundidad de análisis,
- uso de herramientas externas,
- paralelismo por grupo de agentes.

### 17.3 Roles de modelo

- Modelo de planeación
- Modelo de implementación
- Modelo de investigación
- Modelo de revisión
- Modelo de crítica y riesgo
- Modelo de resumen y memoria

### 17.4 Requerimiento funcional

El usuario debe poder activar “modelos en paralelo” desde interfaz y asignar perfiles de operación por objetivo o tipo de misión.

---

## 18. Aprendizaje por errores

### 18.1 Enfoque

Auria no se basará en reentrenamiento continuo del modelo base, sino en aprendizaje a nivel de aplicación y repositorio.

### 18.2 Mecanismos

#### Failure Memory
Registro de errores técnicos, operativos y de validación.

#### Patch Ranking
Comparación de estrategias exitosas y fallidas.

#### Policy Adaptation
Ajuste automático o sugerido de políticas cuando ciertos patrones fallan repetidamente.

#### Repo-Specific Heuristics
Heurísticas específicas por repositorio, carpeta, stack, tipo de error o tipo de cambio.

### 18.3 Resultado esperado

Con el tiempo, Auria debe reducir repetición de errores, mejorar priorización y disminuir riesgos en misiones similares.

---

## 19. Sistema de políticas y guardrails

### 19.1 Guardrails de lectura

El usuario debe poder definir:

- carpetas permitidas,
- carpetas bloqueadas,
- tipos de archivo legibles,
- tipos de archivo prohibidos,
- exclusión de secretos, builds, cachés o artefactos.

### 19.2 Guardrails de escritura

El usuario debe poder definir:

- máximo de líneas modificadas por misión,
- máximo de líneas por archivo,
- máximo de archivos modificados,
- límites por carpeta,
- zonas con aprobación obligatoria,
- tipos de cambio permitidos.

### 19.3 Guardrails operativos

- cantidad de agentes concurrentes,
- presupuesto mensual,
- frecuencia de misiones,
- días y ventanas horarias,
- severidad máxima permitida,
- modo de autonomía,
- necesidad de revisión humana.

---

## 20. Interfaz gráfica

### 20.0 Vista adicional — Knowledge Intake

Objetivo: permitir al usuario cargar documentación del sistema para enriquecer el conocimiento operativo y funcional de Auria.

Debe permitir:
- subir archivos de documentación,
- clasificarlos por tipo,
- asociarlos a un repositorio o workspace,
- ver estado de procesamiento,
- activar o desactivar su uso para innovación, análisis y propuestas,
- actualizar versiones de documentación.

Esta vista será clave para que Auria entienda mejor el alcance del sistema y pueda innovar, mejorar y proponer cambios con mayor precisión.



### 20.1 Vista 1 — Onboarding

Objetivo: conectar cuenta, suscripción y repositorio.

Incluye:
- autenticación,
- selección de plan,
- conexión de repositorio,
- selección de modo cloud/local/híbrido,
- instalación/configuración inicial.

### 20.2 Vista 2 — Objective Builder

Objetivo: definir qué debe mejorar Auria.

Incluye toggles para:
- calidad,
- seguridad,
- deuda técnica,
- dependencias,
- cobertura,
- documentación,
- performance,
- innovación,
- investigación.

Incluye sliders y controles para:
- agresividad,
- riesgo,
- agentes máximos,
- líneas máximas,
- presupuesto,
- frecuencia.

### 20.3 Vista 3 — Model Router

Objetivo: configurar modelos, herramientas y paralelismo.

Incluye:
- modelo por rol,
- fallback,
- herramientas externas activas,
- profundidad de investigación,
- costos máximos,
- paralelismo por tipo de tarea.

### 20.4 Vista 4 — Policy Builder

Objetivo: gobernar el comportamiento del sistema.

Incluye:
- límites por líneas y archivos,
- paths permitidos y bloqueados,
- aprobación humana por zonas,
- ventanas horarias,
- presupuesto,
- autonomía.

### 20.5 Vista 5 — Mission Control

Objetivo: observar la operación en vivo.

Columnas sugeridas:
- descubiertas,
- analizando,
- investigando,
- ejecutando,
- validando,
- esperando revisión,
- bloqueadas,
- completadas.

Debe mostrar:
- agentes activos,
- estado por misión,
- riesgo,
- tiempo,
- costo estimado,
- evidencia disponible.

### 20.6 Vista 6 — Review Center

Objetivo: revisar propuestas o cambios generados.

Cada tarjeta debe mostrar:
- objetivo atendido,
- justificación,
- archivos tocados,
- líneas cambiadas,
- validaciones,
- riesgo,
- before/after,
- hallazgos,
- referencias de investigación,
- decisión final.

### 20.7 Vista 7 — Memory Console

Objetivo: exponer qué ha aprendido Auria.

Debe permitir ver:
- errores recurrentes,
- lecciones aprendidas,
- patrones del repo,
- historial de decisiones,
- zonas frágiles,
- recomendaciones acumuladas.

### 20.8 Vista 8 — Billing & Usage

Objetivo: gestionar suscripción y consumo.

Debe mostrar:
- plan actual,
- consumo,
- agentes permitidos,
- repos permitidos,
- historial de cobro,
- acceso a gestión de suscripción.

---

## 21. Suscripciones y pagos

### 21.1 Modelo comercial

Auria operará bajo suscripción recurrente con distintos niveles de capacidad y límites.

### 21.2 Capacidades que pueden variar por plan

- cantidad de repositorios,
- cantidad de agentes concurrentes,
- cantidad de misiones por periodo,
- presupuesto computacional,
- profundidad de memoria,
- nivel de investigación externa,
- features enterprise.

### 21.3 Requerimientos funcionales de billing

- El sistema debe crear suscripciones.
- El sistema debe registrar eventos de cobro.
- El sistema debe suspender o limitar capacidades si la suscripción expira.
- El usuario debe poder acceder a portal de gestión de pago.

---

## 22. Seguridad y cumplimiento

### 22.1 Principios

- mínimo privilegio,
- separación de responsabilidades,
- auditoría,
- cifrado en tránsito,
- no exponer secretos críticos en cliente,
- protección de rutas y workspace isolation.

### 22.2 Requerimientos

- Toda acción crítica debe quedar auditada.
- Las políticas del repositorio deben respetarse siempre.
- Deben existir mecanismos de revocación de acceso.
- Debe poder desactivarse investigación externa si el usuario lo requiere.
- Deben poder definirse archivos, carpetas o dominios restringidos.

---

## 23. Métricas de éxito

### 23.1 Métricas de producto

- número de repositorios conectados,
- número de misiones ejecutadas,
- tasa de finalización de misiones,
- tiempo medio hasta propuesta utilizable,
- tasa de aprobación de propuestas,
- frecuencia de uso semanal,
- retención por workspace.

### 23.2 Métricas técnicas

- líneas modificadas útiles,
- bugs corregidos,
- deuda técnica mitigada,
- vulnerabilidades atendidas,
- dependencias actualizadas,
- cobertura incrementada,
- número de validaciones exitosas,
- disminución de errores repetidos.

### 23.3 Métricas de confianza

- porcentaje de misiones bloqueadas correctamente por política,
- reversión de cambios,
- incidentes derivados de cambios automatizados,
- precisión percibida de propuestas,
- utilidad de la memoria histórica.

---

## 24. Roadmap sugerido

### Fase 1 — MVP

- App desktop Windows/Linux.
- Auth y gestión básica de cuenta.
- Suscripciones.
- Conexión de repositorio principal.
- Objective Builder.
- Policy Builder básico.
- Memoria estructurada y episódica.
- Hasta 5 agentes concurrentes inicialmente en beta.
- Investigación básica opcional.
- Review Center.
- Mission Control.

### Fase 2 — Expansión operativa

- Hasta 15 agentes concurrentes.
- Memoria semántica avanzada.
- Learning from errors ampliado.
- Model Router avanzado.
- Investigación profunda con URLs.
- Mejoras de performance y seguridad más sofisticadas.
- Reglas más finas por carpeta y tipo de cambio.

### Fase 3 — Enterprise readiness

- Multi-workspace avanzado.
- Roles y permisos.
- Reporting ejecutivo.
- Auditoría extendida.
- Políticas organizacionales.
- Integraciones adicionales.

---

## 25. Riesgos principales

- Conflictos entre agentes concurrentes.
- Sobreuso de costo computacional o de APIs.
- Cambios de bajo contexto en zonas sensibles.
- Exceso de confianza del usuario en automatización.
- Riesgo reputacional si la promesa de autonomía excede el control real.
- Complejidad de coordinación entre memoria, agentes, modelos y políticas.
- Dependencia operativa de herramientas externas.

---

## 26. Mitigaciones propuestas

- Gate de riesgo obligatorio.
- Límites de líneas, archivos y paths.
- Modos de autonomía graduada.
- Auditoría de todas las misiones.
- Aprendizaje por fallos y ranking de estrategias.
- Feature flags y rollout progresivo.
- Separación clara entre investigación, propuesta y ejecución.

---

## 27. Decisiones de producto ya definidas

1. El nombre del producto será **Auria**.
2. La plataforma será una **aplicación de escritorio**.
3. Las plataformas objetivo iniciales serán **Windows** y **Linux**.
4. Se utilizará **Supabase** como base de datos y backend base.
5. El sistema tendrá **suscripciones pagadas** con pasarela de pago.
6. El sistema deberá **aprender de sus errores** a nivel de aplicación.
7. El sistema deberá mantener una **memoria persistente acumulativa del repositorio**.
8. El sistema integrará herramientas de investigación externa como búsqueda web y análisis de URLs.
9. El sistema deberá permitir **configuración de modelos en paralelo**.
10. El sistema deberá permitir definir **límite de líneas modificadas** y restricciones de lectura/escritura.
11. El sistema deberá soportar **hasta 15 agentes trabajando en paralelo**.
12. El usuario podrá subir documentación del sistema para enriquecer el entendimiento funcional y técnico del producto por parte de Auria.
13. Esa documentación deberá incorporarse a la memoria y utilizarse para mejorar propuestas de innovación, evolución, mejora continua y comprensión de alcance.

---

## 28. Preguntas abiertas

- ¿Cuál será el proveedor inicial prioritario para repositorios?
- ¿Qué capacidades exactas dependerán de cloud y cuáles del worker local?
- ¿Qué niveles de plan comercial existirán y cómo se limitarán agentes y consumo?
- ¿Qué tipos de validación serán obligatorios antes de una propuesta?
- ¿Qué integración externa de investigación se activará por defecto?
- ¿Cuál será el criterio de riesgo para permitir auto-merge de bajo impacto?
- ¿Cómo se presentará el costo estimado por misión al usuario final?

---

## 29. Definición corta del producto

**Auria es una aplicación de escritorio para Windows y Linux que permite conectar un repositorio, definir objetivos de mejora y dejar que múltiples agentes de IA lo analicen, investiguen, mejoren y validen de forma autónoma, bajo políticas, memoria persistente, límites configurables y trazabilidad completa.**

---

## 30. Statement final de posicionamiento

Auria no es un copiloto que espera prompts. Auria es una plataforma de ingeniería autónoma que opera sobre repositorios con memoria, investigación, múltiples agentes, múltiples modelos y control fino del riesgo para mejorar continuamente el software de sus usuarios.

