# Plan maestro de OpenPalantir — 15 fases

**Alcance:** plataforma de inteligencia empresarial general, multiempresa y multisectorial.  
**Estrategia:** staging primero; producción únicamente después de evidencia verificable, revisión y aprobación explícita.  
**Reglas no negociables:** preservar el comportamiento estable; no introducir datos comerciales simulados; no registrar secretos ni datos sensibles; no activar funciones v2 por defecto; no declarar un despliegue sin verificar la versión activa en Cloudflare.

## Cómo se medirá el avance

Cada fase debe tener: (1) cambios identificables por commit, (2) pruebas automatizadas, (3) pruebas de integración cuando aplique, (4) evidencia de aceptación y (5) rollback o mitigación documentados. Un CI verde no demuestra que haya habido un despliegue. Un dry-run de Wrangler valida el paquete, no lo publica.

Estados iniciales basados en la información del repositorio al crear este plan:
- Fases 1 y 2: integradas en `main`; el despliegue de la versión actual en Cloudflare no está verificado.
- Fase 3: PR #15 abierto como borrador; su contenido existente es documentación de preparación, no un motor de inteligencia terminado.
- Fases 4–15: planificación, no implementación confirmada por este documento.

## Fase 1 — Despliegue reproducible y verificación de versión

**Objetivo:** poder publicar de forma controlada y demostrar qué commit corre en cada entorno.

**Entregables**
- Runbook de despliegue y reversión para Worker y servicios backend, distinguiendo sus ciclos de vida.
- Entornos aislados de staging y producción, con credenciales independientes y permisos mínimos.
- Flujo de publicación manual/protegido para staging; producción exige revisión y aprobación explícitas.
- Evidencia de versión desplegada y checklist de smoke tests.

**Pruebas**
- CI: pruebas de Worker, pruebas de API de ontología, políticas OPA y Wrangler dry-run.
- Staging: comprobar versión/commit, rutas esperadas, CORS, autenticación, upstream caído, timeout y respuesta autorizada.
- Simular una reversión en staging.

**Aceptación**
- Se identifica el commit exacto publicado y se verifica desde el entorno activo.
- Todas las pruebas de staging pasan y la reversión está ensayada.
- No se afirma que Cloudflare esté actualizado hasta tener evidencia de la publicación activa.

**Estado conocido:** código de Fase 2 integrado; despliegue en Cloudflare sin verificar.

## Fase 2 — Identidad, autorización y aislamiento multiempresa

**Objetivo:** impedir que una organización consulte o modifique datos de otra.

**Entregables**
- Principal autenticado de confianza; validación de emisor, audiencia, expiración y firma según el proveedor seleccionado.
- Autorización por tenant, rol y acción; denegación por defecto.
- Límites de solicitudes, protección frente a suplantación de cabeceras y gestión segura de secretos.
- Modelo de permisos documentado.

**Pruebas**
- Tokens ausentes, inválidos, manipulados, vencidos y de emisor/audiencia incorrectos.
- Acceso cruzado entre tenants, elevación de privilegios y solicitudes sin permisos.
- Revisión de logs para asegurar que no incluyan tokens ni datos sensibles.

**Aceptación**
- Todas las pruebas negativas se deniegan; los casos autorizados funcionan.
- El tenant deriva de identidad verificada, nunca de un valor arbitrario del cliente.
- No se habilita una ruta protegida si falta configuración de seguridad.

## Fase 3 — Contratos de datos, conectores y calidad

**Objetivo:** ingerir datos reales de fuentes autorizadas con controles de calidad y procedencia.

**Entregables**
- Contratos versionados por fuente, validación de esquema y políticas de retención.
- Conectores desacoplados, manejo de errores, reintentos acotados e idempotencia cuando corresponda.
- Metadatos de origen, instante de observación y estado de sincronización cuando la fuente los provea.
- Estado explícito de “sin fuente configurada” o “dato no disponible”; nunca completar con valores ficticios.

**Pruebas**
- Esquema inválido, campos ausentes, duplicados, datos atrasados, timeouts y fallas parciales.
- Reintentos sin duplicar registros; límites de tamaño y frecuencia.
- Verificar que datos de prueba estén claramente aislados y jamás se presenten como datos comerciales reales.

**Aceptación**
- Cada registro analítico puede rastrearse a su fuente o se marca explícitamente como no trazable.
- No hay fallback silencioso a datos sintéticos.
- Los errores de una fuente no contaminan otras fuentes o tenants.

## Fase 4 — Ontología empresarial

**Objetivo:** representar objetos, relaciones, eventos y reglas del dominio sin acoplar el sistema a un solo sector.

**Entregables**
- Registro versionado de tipos, propiedades, relaciones, identificadores y restricciones.
- Validación de integridad referencial y procedencia.
- Extensiones por dominio/sector sin cambiar el núcleo compartido.
- Política de migración y compatibilidad de esquema.

**Pruebas**
- Referencias rotas, tipos inválidos, ciclos prohibidos (si aplica), duplicados y versiones incompatibles.
- Aislamiento por tenant y autorización de lectura para cada objeto/relación.
- Migraciones hacia adelante y plan de reversión.

**Aceptación**
- La ontología valida integridad y versión; consultas no autorizadas no revelan metadatos sensibles.
- El núcleo puede incorporar un segundo dominio sin regresiones al primero.

## Fase 5 — Motor de consultas y analítica descriptiva

**Objetivo:** obtener indicadores reproducibles de datos reales.

**Entregables**
- Consultas tipadas, filtros, agregaciones, orden, paginación y límites de coste.
- Catálogo de métricas con fórmula, unidad, ventana temporal, fuente y propietario.
- Respuestas con metadatos de frescura y cobertura.

**Pruebas**
- Resultados frente a conjuntos de referencia autorizados; límites, paginación y consultas costosas.
- Consultas malformadas, intentos de acceso cruzado y condiciones de datos vacíos.
- Reproducibilidad de cálculos.

**Aceptación**
- Cada métrica tiene definición verificable y resultados reproducibles.
- Datos ausentes se reportan como ausentes, no como cero salvo que la definición lo establezca.

## Fase 6 — IA conectada a datos con evidencia

**Objetivo:** permitir preguntas en lenguaje natural sin saltarse permisos ni inventar hechos.

**Entregables**
- Capa de recuperación/consulta con identidad del usuario y filtrado de permisos.
- Respuestas estructuradas con fuentes, fecha/frescura y declaración de incertidumbre.
- Límites de tokens, tiempo y coste; manejo de prompt injection en contenido recuperado.
- Evaluaciones versionadas de calidad.

**Pruebas**
- Preguntas sin datos disponibles, fuentes contradictorias, prompt injection y acceso cruzado.
- Exactitud factual frente a consultas deterministas y citas de origen.
- Inyección de secretos y salida de datos no autorizados.

**Aceptación**
- Las respuestas factuales importantes se respaldan en datos recuperados; si no hay evidencia, el sistema lo dice.
- El modelo no puede elevar permisos ni ejecutar acciones por cuenta propia.

## Fase 7 — Predicción, anomalías y optimización

**Objetivo:** sumar capacidades predictivas medibles sin presentarlas como certezas.

**Entregables**
- Pipelines de entrenamiento/evaluación separados de producción.
- Registro de versiones de modelos, características, umbrales y métricas.
- Detección de deriva y comparación con una línea base sencilla.
- Explicación de factores relevantes y límites de uso.

**Pruebas**
- Separación temporal de entrenamiento y evaluación, prevención de fuga de datos y validación por segmento.
- Métricas de precisión adecuadas al caso, calibración y pruebas de deriva.
- Comportamiento con datos insuficientes o desactualizados.

**Aceptación**
- Cada modelo supera un umbral aprobado contra una línea base y muestra sus límites.
- Si no supera el umbral, no se habilita para decisiones operativas.

## Fase 8 — Documentos y búsqueda semántica

**Objetivo:** buscar conocimiento documental con permisos, procedencia y control de ciclo de vida.

**Entregables**
- Ingesta de documentos autorizados, extracción, indexación y eliminación sincronizada.
- Índices vectoriales opcionales con metadatos de tenant y ACL.
- Referencias al documento y fragmento de origen; controles de retención.

**Pruebas**
- Recuperación entre tenants, eliminación de documentos, permisos revocados y archivos malformados.
- Calidad de recuperación con consultas evaluadas y resistencia a instrucciones maliciosas en documentos.
- Consistencia entre origen e índice.

**Aceptación**
- Ningún fragmento aparece a usuarios no autorizados.
- Los resultados permiten localizar la fuente y respetan eliminaciones y permisos.

## Fase 9 — Aplicaciones, paneles y experiencia de operador

**Objetivo:** ofrecer vistas accionables adaptadas a distintos roles y sectores.

**Entregables**
- Aplicaciones con componentes reutilizables, filtros, estados de carga/error/vacío y accesibilidad.
- Paneles construidos sobre métricas certificadas, no cálculos duplicados en interfaz.
- Configuración por rol/tenant y registro de eventos de interfaz relevantes.

**Pruebas**
- Pruebas de permisos en backend, no solo ocultamiento visual.
- Accesibilidad básica, móvil, estados vacíos, errores y grandes volúmenes.
- Consistencia entre panel y consultas de referencia.

**Aceptación**
- La interfaz refleja datos autorizados y estados reales; no incluye métricas ficticias de relleno.
- Las decisiones de autorización se aplican en servidor.

## Fase 10 — Agentes y herramientas controladas

**Objetivo:** permitir que la IA encadene consultas y herramientas con límites claros.

**Entregables**
- Registro explícito de herramientas, esquemas de entrada/salida y permisos por acción.
- Planificación acotada, límites de pasos, presupuesto, timeout y cancelación.
- Separación entre sugerir, preparar y ejecutar acciones.

**Pruebas**
- Herramienta no autorizada, parámetros inválidos, bucles, timeouts y resultados contradictorios.
- Prompt injection, exfiltración y escalamiento de privilegios.
- Reproducibilidad y registro de cada invocación sin secretos.

**Aceptación**
- El agente solo invoca herramientas registradas y autorizadas.
- Las acciones con impacto requieren aprobación explícita conforme a política.

## Fase 11 — Flujos de trabajo y automatización

**Objetivo:** ejecutar procesos empresariales auditables y recuperables.

**Entregables**
- Motor de estados, disparadores, colas y reintentos idempotentes.
- Aprobaciones humanas para acciones sensibles, compensación y cancelación.
- Historial de ejecución y gestión de errores/reprocesamiento.

**Pruebas**
- Entrega duplicada, fallos parciales, reinicio, carrera de estados y reintento.
- Aprobación rechazada/expirada y usuario sin permiso.
- Prueba de reversión o compensación donde sea viable.

**Aceptación**
- Cada ejecución tiene estado final explicable y trazabilidad.
- No se realizan acciones de alto impacto sin autorización definida.

## Fase 12 — Gobernanza, auditoría y cumplimiento

**Objetivo:** demostrar quién accedió a qué, qué cambió y con qué fundamento.

**Entregables**
- Eventos de auditoría protegidos contra alteración ordinaria y con retención definida.
- Clasificación de datos, políticas de retención/eliminación y exportación autorizada.
- Inventario de proveedores, tratamientos, riesgos y responsabilidades.
- Procedimientos de acceso, corrección, exportación y eliminación según requisitos aplicables.

**Pruebas**
- Cobertura de auditoría para lecturas sensibles, cambios, acciones y fallos de autorización.
- Acceso a logs restringido, integridad y retención.
- Ensayos de solicitudes de eliminación/exportación.

**Aceptación**
- Operaciones sensibles dejan evidencia sin volcar secretos ni datos innecesarios.
- Los requisitos legales se determinan por jurisdicción y uso real; no se afirma certificación sin auditoría independiente.

## Fase 13 — Observabilidad y respuesta a incidentes

**Objetivo:** detectar fallos y riesgos sin exponer información confidencial.

**Entregables**
- Logs estructurados, métricas, trazas y correlación entre servicios.
- Alertas por errores, latencia, disponibilidad, abuso y gasto.
- Runbooks de incidentes, escalamiento y comunicación.
- SLOs definidos según el servicio acordado.

**Pruebas**
- Inyección controlada de errores y verificación de alertas.
- Revisión automática/manual de datos sensibles en logs.
- Simulacro de incidente y análisis posterior.

**Aceptación**
- Incidentes de prueba generan alertas y tienen procedimiento de respuesta.
- Las métricas se obtienen de telemetría real y no de valores de demostración.

## Fase 14 — Escala, rendimiento y continuidad

**Objetivo:** sostener carga, fallos y recuperación con límites medidos.

**Entregables**
- Presupuestos de latencia/capacidad, rate limits, backpressure y colas cuando proceda.
- Estrategias de copia de seguridad, restauración y recuperación por servicio.
- Pruebas de carga, degradación controlada y límites de gasto.
- Revisión de dependencias y capacidad por entorno.

**Pruebas**
- Carga sostenida, picos, saturación, proveedor externo lento y pérdida de dependencia.
- Restauración desde backup y recuperación de datos.
- Pruebas de límites por tenant para evitar agotamiento compartido.

**Aceptación**
- Se cumplen objetivos de rendimiento acordados y se documentan límites.
- La recuperación se demuestra con una prueba observada, no solo con un documento.

## Fase 15 — Certificación funcional y mejora continua

**Objetivo:** medir la plataforma contra un alcance explícito y mantener controles a lo largo del tiempo.

**Entregables**
- Matriz de requisitos, capacidades y pruebas con evidencia por versión.
- Evaluación independiente de seguridad y revisión de arquitectura.
- Evaluaciones de IA, rendimiento, accesibilidad y experiencia de operador.
- Proceso de lanzamiento, changelog, rollback, revisión de riesgos y eliminación de capacidades obsoletas.

**Pruebas**
- Regresión integral, pruebas de penetración autorizadas, recuperación, carga y evaluación de IA.
- Comparación con líneas base documentadas.
- Revisión de evidencias por una persona distinta de quien implementó el cambio.

**Aceptación**
- Cada requisito del alcance acordado tiene prueba, responsable y resultado.
- Las vulnerabilidades críticas/altas están resueltas o formalmente bloqueadas antes de producción.
- “100 %” significa 100 % de los requisitos definidos y verificados; no significa paridad total con cada producto propietario de Palantir.

## Puertas de aprobación obligatorias

1. **Gate A — Staging:** pruebas de CI verdes, secretos del entorno configurados de forma segura, despliegue del commit exacto y smoke tests aprobados.
2. **Gate B — Seguridad:** identidad, permisos, aislamiento multiempresa y revisión de datos/logs aprobados.
3. **Gate C — Funcionalidad:** datos reales autorizados, procedencia, resultados reproducibles y ausencia de datos sintéticos presentados como reales.
4. **Gate D — Producción:** revisión de cambios, aprobación explícita, plan de rollback probado y observabilidad operativa. No hay despliegue automático a producción por defecto.

## Registro de evidencia por fase

Para cada fase se debe guardar: ID de fase; alcance; PR y commit; pruebas ejecutadas y resultado; entorno; versión desplegada (si aplica); evidencia de smoke tests; riesgos abiertos; aprobador; plan de rollback; estado final.

Estados permitidos: **Planificada**, **En implementación**, **CI aprobada**, **Staging verificado**, **Aceptada**, **Bloqueada**. “CI aprobada” nunca equivale a “desplegada”.

## Orden de trabajo inmediato

1. Verificar y documentar el estado real de la publicación de Fase 2 en Cloudflare.
2. Preparar el flujo controlado de staging sin tocar producción y sin exponer secretos.
3. Completar las pruebas de identidad y aislamiento antes de exponer analítica.
4. Conectar una primera fuente de datos real autorizada y demostrar procedencia.
5. Avanzar a ontología y consultas analíticas con pruebas de aceptación.

**Límite de este documento:** define alcance y criterios; por sí mismo no implementa funciones, configura secretos, publica el Worker ni demuestra que un entorno esté desplegado.
