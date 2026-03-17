# AQELOR — Documento de Análisis Funcional, Reglas de Negocio, Requerimientos y Escalabilidad Inicial

## 1. Propósito del documento

Este documento consolida las decisiones funcionales y de producto analizadas para **AQELOR**, dejando fuera el PRD formal, el branding visual y la guía de colores.

Su objetivo es servir como base para:

- casos de uso,
- historias de usuario,
- reglas de negocio,
- requerimientos funcionales,
- requerimientos no funcionales,
- límites operativos,
- definición del MVP,
- y planeación de escalabilidad inicial.

---

## 2. Definición breve del producto

**AQELOR** es una plataforma de ingeniería autónoma para repositorios de software que permite conectar un proyecto, definir objetivos, aplicar políticas y ejecutar herramientas especializadas impulsadas por IA para analizar, documentar, investigar, mejorar, corregir y evolucionar el sistema con control de riesgo, memoria persistente y trazabilidad.

AQELOR no debe entenderse como un simple copiloto conversacional ni como una herramienta de prompt manual. Su propuesta es operar por **objetivos, reglas, límites, memoria y herramientas especializadas**.

---

## 3. Alcance conceptual del sistema

AQELOR debe poder:

1. conectarse a un repositorio,
2. entender su contexto técnico y funcional,
3. ingerir documentación del sistema cargada por el usuario,
4. mantener memoria persistente sobre el repositorio,
5. operar herramientas especializadas,
6. documentar automáticamente cambios y código,
7. investigar mejores prácticas y opciones de implementación,
8. ejecutar tareas parciales o completas según factibilidad,
9. aplicar límites por líneas, archivos, agentes y AU,
10. aprender de errores previos,
11. reembolsar parcialmente créditos cuando las fallas sean atribuibles a la plataforma,
12. permitir modelos configurables por el usuario en ciertas capas,
13. y escalar gradualmente desde una arquitectura inicial de bajo costo.

---

## 4. Actores principales

### 4.1 Usuario principal
Persona que conecta el repositorio, configura objetivos, ejecuta herramientas, revisa resultados y administra su saldo de AU.

### 4.2 Equipo de desarrollo
Conjunto de desarrolladores que consumen la documentación generada, revisan propuestas, usan la memoria del sistema y aprovechan resultados producidos por AQELOR.

### 4.3 Administrador de workspace
Persona que define políticas, límites, roles, acceso a repositorios, agentes disponibles, modelos permitidos y topes de uso.

### 4.4 Plataforma AQELOR
Sistema autónomo que coordina agentes, modelos, herramientas, memoria, búsqueda, reglas de negocio y ejecución.

---

## 5. Principios de operación

1. **Autonomía gobernada**  
   AQELOR puede actuar de forma autónoma, pero siempre dentro de límites configurables.

2. **Seguridad y consistencia primero**  
   No toda tarea debe ejecutarse parcialmente. Solo debe hacerse si el resultado parcial es útil y seguro.

3. **Factibilidad antes de ejecutar**  
   El sistema debe verificar si el usuario tiene AU suficientes para una ejecución completa, parcial o solo diagnóstica.

4. **Memoria y aprendizaje acumulativo**  
   AQELOR debe registrar errores, decisiones, patrones y resultados para operar mejor con el tiempo.

5. **Separación entre herramientas**  
   Cada herramienta tiene propósito, costo, límites y reglas propias.

6. **Costo controlado desde el diseño**  
   El sistema debe ser usable con presupuesto bajo al inicio, evitando cargas innecesarias de tokens, almacenamiento y ejecución.

---

## 6. Capacidades funcionales base

### 6.1 Conexión de repositorios
- Conectar uno o más repositorios.
- Leer estructura, ramas, archivos y metadatos.
- Respetar límites por rutas y tipos de archivo.

### 6.2 Carga de documentación del sistema
- El usuario puede subir documentación técnica, funcional u operativa.
- Esa documentación debe usarse como contexto adicional para entender el sistema.
- Su función principal es mejorar el conocimiento del producto y apoyar innovación, mejora, análisis y alcance.

### 6.3 Memoria persistente del repositorio
- Guardar contexto del código.
- Guardar hallazgos, decisiones, errores recurrentes y cambios previos.
- Relacionar código, documentación, resultados y patrones.

### 6.4 Herramientas especializadas
AQELOR debe exponer herramientas con costos, límites y comportamiento propios.

### 6.5 Documentación autónoma
AQELOR debe generar documentación automáticamente para que el usuario no tenga que documentar manualmente commits, cambios o fragmentos de código.

### 6.6 Investigación asistida
AQELOR debe poder investigar en la web y usar URL context para enriquecer propuestas, análisis técnicos y mejoras.

### 6.7 Ejecución parcial por factibilidad
Cuando el usuario no tenga AU suficientes, AQELOR debe evaluar si puede entregar una versión parcial útil y segura.

### 6.8 Protección de créditos
Cuando la falla sea atribuible a AQELOR o a un proveedor externo, el sistema debe devolver un porcentaje de AU.

---

## 7. Herramientas del sistema

## 7.1 Knowledge Intake
Herramienta para cargar documentación existente del sistema.

### Objetivo
Mejorar el entendimiento funcional, técnico y operativo del producto.

### Ejemplos de salida
- contexto funcional del sistema,
- mapa de módulos,
- restricciones del negocio,
- capacidades actuales,
- oportunidades de mejora.

### Naturaleza
No reemplaza documentación autónoma. Es una fuente de conocimiento de entrada.

---

## 7.2 Documentación autónoma
Herramienta que genera documentación técnica automáticamente a partir del código y los cambios.

### Objetivo
Evitar que el usuario documente manualmente commits, cambios, módulos o partes del código, y facilitar que otros desarrolladores entiendan el sistema.

### Ejemplos de salida
- resumen de commit,
- descripción de PR,
- changelog,
- documentación de archivo,
- documentación de módulo,
- explicación técnica de refactor,
- notas para QA,
- handoff técnico.

### Regla clave
La documentación autónoma debe reflejar el cambio real del repositorio, no solo producir texto genérico.

---

## 7.3 Research / búsqueda / URL context
Herramienta para investigar opciones, patrones, referencias y mejores prácticas usando búsqueda web y análisis contextual de URLs.

### Objetivo
Soportar decisiones técnicas, innovación, comparativas y propuestas de mejora.

### Regla clave
La búsqueda y URL context forman parte del costo base gestionado por AQELOR.

---

## 7.4 Calidad
Herramienta para limpieza básica, consistencia, lint, revisión técnica ligera y mejora estructural menor.

### Ejemplos
- arreglos de formato,
- consistencia de código,
- limpieza básica,
- simplificación menor.

---

## 7.5 Mejora técnica
Herramienta para reducir deuda técnica moderada y mejorar la salud del código.

### Ejemplos
- refactors pequeños,
- reducción de complejidad,
- mejora de estructura de archivos,
- reorganización acotada.

---

## 7.6 Corrección QA
Herramienta enfocada en corregir defectos detectados por QA, validaciones o comportamientos incorrectos.

### Ejemplos
- fix funcional,
- corrección de flujo,
- ajuste de validaciones,
- solución de error reproducible.

---

## 7.7 Seguridad
Herramienta para análisis y remediación de riesgos o hallazgos de seguridad.

### Ejemplos
- exposición de secretos,
- malas prácticas de seguridad,
- endurecimiento de validaciones,
- ajustes sobre riesgos detectados.

---

## 7.8 Optimización
Herramienta para mejorar rendimiento, eficiencia, tiempos o uso de recursos.

### Ejemplos
- reducción de trabajo redundante,
- mejora de consultas,
- simplificación de rutas pesadas,
- optimización operativa.

---

## 7.9 Eliminación de código spaghetti
Herramienta premium para refactorizar zonas complejas, acopladas o difíciles de mantener.

### Regla clave
No debe ejecutarse parcialmente si deja código inconsistente o más difícil de mantener.

---

## 7.10 Implementación nueva
Herramienta para construir nuevas capacidades o ampliar el sistema.

### Regla clave
No debe ejecutarse parcialmente como “media implementación” si eso deja el sistema roto, inconsistente o sin valor usable.

### Lo que sí puede hacerse parcialmente
- análisis de factibilidad,
- diseño técnico,
- desglose de tareas,
- propuesta de arquitectura,
- plan de implementación.

---

## 8. Sistema de AU (AQELOR Units)

## 8.1 Concepto
Los AU son la unidad de consumo de la plataforma.

No deben entenderse como prompts ni como tokens directos. Deben representar valor de herramienta ejecutada dentro de AQELOR.

## 8.2 Créditos fraccionarios
Los AU deben poder manejarse de forma decimal para permitir:

- cobros parciales,
- reembolsos parciales,
- ejecuciones reducidas,
- y mejor aprovechamiento del saldo.

### Regla recomendada
- Visualmente: mostrar hasta 2 decimales.
- Internamente: manejar micro-AU.

Ejemplo:
- 1 AU = 1000 micro-AU.

---

## 9. Feasibility-aware execution

## 9.1 Regla general
Antes de ejecutar una herramienta, AQELOR debe calcular:

- AU disponibles,
- costo mínimo útil,
- costo estándar,
- costo completo,
- posibilidad de ejecución parcial,
- y riesgo de dejar una salida inútil o peligrosa.

## 9.2 Estados posibles

### Full
La herramienta puede ejecutarse completa.

### Partial
La herramienta puede ejecutarse parcialmente con valor útil y seguro.

### Not feasible
No hay AU suficientes ni para una versión parcial coherente.

---

## 10. Ejecución parcial por herramienta

## 10.1 Herramientas con ejecución parcial permitida
- documentación autónoma,
- research,
- calidad,
- QA correction pequeña,
- análisis de seguridad,
- optimización diagnóstica.

## 10.2 Herramientas con ejecución parcial restringida
- implementación nueva,
- spaghetti cleanup grande,
- refactor estructural de alto impacto,
- remediación crítica de seguridad,
- cambios multiarchivo de alto riesgo.

### Regla
En estas herramientas, la ejecución parcial debe convertirse en:
- diagnóstico,
- diseño técnico,
- alcance,
- propuesta,
- plan,
- estimación.

No en ejecución incompleta peligrosa.

---

## 11. Reembolsos de AU

## 11.1 Política base
Si una misión falla, AQELOR debe evaluar el origen del fallo y devolver AU de forma parcial cuando corresponda.

## 11.2 Reglas recomendadas

### Fallo interno de AQELOR
- Reembolso sugerido: 70%

### Fallo de proveedor externo
- Reembolso sugerido: 60%

### Valor parcial entregado
- Reembolso sugerido: 40%

### Fallo atribuible al repositorio o configuración del usuario
- Reembolso sugerido: 0%

### Bloqueo por política o límites
- Reembolso sugerido: 0%

### Cancelación manual del usuario
- Reembolso sugerido: 0% a 20%

## 11.3 Regla premium
Si una herramienta cara falla por culpa de AQELOR y no entrega valor, el reembolso puede subir.

---

## 12. Agentes

## 12.1 Agentes disponibles
Cantidad total de agentes especializados que el usuario puede tener habilitados.

## 12.2 Agentes simultáneos
Cantidad máxima de agentes que pueden ejecutar tareas al mismo tiempo.

### Diferencia clave
Se puede tener acceso a muchos agentes, pero solo un subconjunto puede correr en paralelo.

---

## 13. Modelos y política de uso

## 13.1 Capa fija gestionada por AQELOR
La búsqueda web y el URL context deben permanecer del lado de AQELOR.

### Razón
- control de costo,
- control de experiencia,
- consistencia de resultados,
- y trazabilidad.

## 13.2 Capa configurable por el usuario
El usuario puede cambiar:
- orquestación,
- planning,
- desarrollo,
- QA,
- review,
- y otros modelos de trabajo principal.

## 13.3 Recomendación para el arranque
Para una fase inicial con presupuesto limitado, conviene lanzar con **Gemini-only** y dejar modelos externos como fase posterior o modo BYOK.

---

## 14. Reglas de negocio candidatas

### RN-01
AQELOR debe operar por objetivos y herramientas, no depender exclusivamente de prompts libres.

### RN-02
Toda misión debe pasar por verificación de factibilidad antes de ejecutarse.

### RN-03
Toda misión debe respetar límites de líneas, archivos, rutas y políticas del workspace.

### RN-04
La documentación cargada por el usuario y la documentación generada autónomamente son capacidades distintas y deben tratarse como módulos separados.

### RN-05
La herramienta de documentación autónoma debe producir documentación útil para terceros, no solo mensajes de commit superficiales.

### RN-06
Si una herramienta puede ejecutarse parcialmente sin comprometer utilidad ni seguridad, AQELOR puede ofrecer modo parcial proporcional al saldo del usuario.

### RN-07
Si una herramienta no puede generar una salida parcial coherente, AQELOR debe bloquearla y recomendar alternativa o recarga de AU.

### RN-08
Los AU deben poder consumirse y devolverse de forma fraccionaria.

### RN-09
Si una misión falla por causa atribuible a AQELOR o a un proveedor externo, se aplicará reembolso parcial automático.

### RN-10
Si una misión falla por causas del repositorio del usuario, no debe aplicarse reembolso automático, salvo política especial.

### RN-11
La búsqueda web y el URL context deben costearse como parte de la plataforma, no quedar a libre elección del usuario.

### RN-12
El usuario sí puede aportar su propio modelo en roles configurables, pero seguirá pagando por la plataforma.

### RN-13
La cantidad de agentes disponibles y la de agentes simultáneos deben manejarse como conceptos distintos.

### RN-14
Las herramientas premium o de alto riesgo deben tener mayores requisitos de AU y de factibilidad.

### RN-15
El sistema debe registrar errores, éxitos y comportamiento previo para mejorar futuras decisiones.

---

## 15. Requerimientos funcionales candidatos

### RF-01
El sistema debe permitir conectar repositorios.

### RF-02
El sistema debe permitir cargar documentación del sistema.

### RF-03
El sistema debe generar documentación autónoma basada en código y cambios reales.

### RF-04
El sistema debe ofrecer herramientas diferenciadas por dominio: documentación, research, calidad, mejora, QA, seguridad, optimización, spaghetti e implementación nueva.

### RF-05
El sistema debe calcular factibilidad antes de ejecutar.

### RF-06
El sistema debe soportar AU fraccionarios.

### RF-07
El sistema debe permitir ejecución parcial solo en herramientas y escenarios autorizados.

### RF-08
El sistema debe informar al usuario qué parte de una tarea puede ejecutarse con el saldo actual.

### RF-09
El sistema debe bloquear tareas no factibles y recomendar recarga o reducción de alcance.

### RF-10
El sistema debe registrar y aplicar reembolsos parciales de AU.

### RF-11
El sistema debe manejar agentes disponibles y agentes simultáneos como parámetros separados.

### RF-12
El sistema debe permitir definir límites de líneas modificadas por ejecución.

### RF-13
El sistema debe permitir definir límites de archivos leídos y modificados.

### RF-14
El sistema debe permitir configurar modelos por rol en las capas habilitadas.

### RF-15
El sistema debe mantener memoria persistente del repositorio y de las misiones.

### RF-16
El sistema debe mostrar trazabilidad de lo ejecutado, lo bloqueado y lo reembolsado.

---

## 16. Requerimientos no funcionales candidatos

### RNF-01
La plataforma debe funcionar con costos controlados en una fase inicial de presupuesto limitado.

### RNF-02
Debe poder operar inicialmente con una base de datos gratuita y presupuesto restringido de IA.

### RNF-03
Debe registrar logs suficientes para auditoría, pero con estrategia de retención para no saturar almacenamiento.

### RNF-04
Debe usar recursos de forma predecible y medible.

### RNF-05
Debe permitir escalar de MVP privado a beta cerrada sin reescribir la lógica de negocio principal.

### RNF-06
Debe separar costo de plataforma de costo de modelos configurables.

### RNF-07
Debe proteger la consistencia del sistema evitando parciales inseguros.

### RNF-08
Debe degradar con elegancia cuando no haya AU suficientes.

---

## 17. Estrategia de escalabilidad inicial

## 17.1 Condición de arranque
Se asume:

- base de datos gratuita,
- presupuesto inicial aproximado de **USD 300** para Gemini API,
- y uso inicial de modelos Gemini para arrancar.

## 17.2 Recomendación de lanzamiento
Lanzar una **Fase 1 Gemini-only** y posponer el costo base de modelos externos.

### Recomendación de reparto
- **Gemini 3.1 Flash-Lite Preview** para:
  - clasificación,
  - resúmenes,
  - documentación autónoma,
  - extracción simple,
  - análisis ligero,
  - triage,
  - validaciones de bajo costo.

- **Gemini 3 Flash Preview** para:
  - research,
  - búsqueda con grounding,
  - URL context,
  - análisis técnico más profundo,
  - tareas de mayor complejidad,
  - correcciones y mejoras medianas.

### Recomendación adicional
No basar el MVP en modelos Pro Preview como centro del sistema si el presupuesto es bajo y la prioridad es estabilidad de costo.

---

## 18. Escalabilidad con base de datos gratuita

## 18.1 Lectura práctica
Una base gratuita es útil para:
- pruebas internas,
- alpha,
- demos controladas,
- beta cerrada pequeña.

No es recomendable asumir que será suficiente para crecimiento sin control.

## 18.2 Riesgos principales
- almacenamiento insuficiente de logs y artefactos,
- crecimiento de memoria semántica,
- acumulación de documentación generada,
- historial de misiones demasiado pesado,
- snapshots y resultados persistidos en exceso.

## 18.3 Estrategia para hacerla viable al inicio
1. No guardar contexto crudo completo de cada ejecución.
2. Guardar solo resúmenes, metadatos y referencias cuando sea posible.
3. Aplicar TTL o retención corta a artefactos temporales.
4. Comprimir o resumir memoria histórica.
5. Separar memoria caliente de memoria fría.
6. Limitar tamaño y frecuencia de documentación generada en planes bajos.
7. Evitar guardar archivos binarios o duplicados innecesarios.
8. Mantener una política de limpieza programada.

## 18.4 Recomendación práctica
La base de datos gratuita debe considerarse para **MVP / alpha / beta pequeña**, no como estado final del sistema.

---

## 19. Escalabilidad con USD 300 en Gemini

## 19.1 Visión realista
USD 300 sí permiten arrancar si:

- el sistema usa una jerarquía de modelos,
- la mayoría de tareas baratas caen en Flash-Lite,
- las tareas pesadas se reservan para Flash,
- y se limitan bien los planes Free y Starter.

## 19.2 Riesgos de gastar de más
- usar modelos caros para todo,
- permitir demasiadas búsquedas profundas,
- no limitar líneas/archivos,
- no limitar agentes simultáneos,
- no limitar herramientas premium,
- guardar demasiado contexto en cada llamada,
- retry agresivo,
- y demasiada investigación con grounding.

## 19.3 Estrategia de control
- usar modelos más baratos por defecto,
- reservar las tareas pesadas para planes superiores,
- limitar AU y herramientas premium,
- evitar paralelismo excesivo en Free/Starter,
- imponer topes mensuales por herramienta,
- y medir costo promedio por misión desde el día 1.

---

## 20. Recomendación operativa de fases

## Fase 0 — Prototipo interno
- un solo workspace,
- pocos repos,
- Gemini-only,
- herramientas principales: documentación, research, calidad y QA correction.

## Fase 1 — Alpha cerrada
- Free muy controlado,
- Starter utilizable,
- sin saturar storage,
- memoria resumida,
- reembolsos automáticos simples.

## Fase 2 — Beta cerrada
- más herramientas premium,
- mejor observabilidad,
- packs de AU,
- BYOK opcional,
- Team limitado.

## Fase 3 — Escala inicial
- pasar la base de datos a plan pagado,
- ampliar workers,
- ampliar retención,
- afinar costos reales por herramienta,
- y abrir modelos externos como opción adicional.

---

## 21. Riesgos de producto que deben quedar claros

1. No toda herramienta debe tener parcial.
2. El usuario no debe quedar con la expectativa de que cualquier saldo sirve para cualquier tarea.
3. La documentación cargada y la documentación autónoma no deben mezclarse conceptualmente.
4. El sistema debe explicar por qué una ejecución es parcial, completa o no factible.
5. La base de datos gratuita puede saturarse rápido si se guardan demasiados artefactos.
6. USD 300 de Gemini sí alcanzan para arrancar, pero no si el sistema se diseña sin disciplina de costo.

---

## 22. Recomendación ejecutiva final

Para arrancar con buen control de costo y buena base funcional:

- usar una arquitectura inicial **Gemini-only**,
- dejar modelos externos como fase 2 o BYOK,
- limitar bien Free y Starter,
- modelar todas las herramientas con costo mínimo útil, estándar y completo,
- permitir AU fraccionarios,
- aplicar reembolsos parciales automáticos,
- separar claramente **Knowledge Intake** de **Documentación Autónoma**,
- y usar la base gratuita solo como etapa inicial controlada.

---

## 23. Referencias consultadas para la parte de escalabilidad

- Google AI for Developers — Gemini API Pricing
- Google AI for Developers — URL Context
- Google AI for Developers — Gemini 3 Flash Preview
- Google AI for Developers — Gemini 3.1 Flash-Lite Preview
- Google AI for Developers — Gemini API Rate Limits
- Supabase Pricing
- Supabase official comparison / free plan summary
- Supabase changelog on database space limits for Free plan
