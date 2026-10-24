# Guías como documento terminado

La pantalla de guías ya no incluye edición de bloques, guardado manual, deshacer ni restauración de versiones. El historial ofrece acceso al documento terminado. La planificación y los demás materiales conservan sus funciones propias.

La cantidad de páginas se muestra en el formulario y comprende la portada (2–30 páginas). La IA planifica los apartados y desarrolla cada página con explicaciones, ejemplos, procedimientos y actividades. Se rechazan páginas demasiado breves o que no caben; la respuesta se intenta corregir antes de informar el problema. El PDF se renderiza antes de guardar el material para impedir guardar un resultado que no pueda exportarse.

Las referencias PDF se analizan visualmente; en Word se analizan los estilos. Se conserva la estructura y se obtiene color de acento y familia tipográfica. Es una adaptación, no una reproducción exacta de un diseño institucional. Las plantillas anteriores reciben el análisis visual al reutilizarlas en una guía.

La vista previa usa el mismo renderizador que la descarga PDF, con portada, encabezados, numeración, paneles de código y tablas. Word conserva secciones, estilos, tablas, código y saltos entre apartados; su paginación puede variar según la aplicación y las fuentes disponibles.

Validación: Gemini produjo una guía real de React de 10 páginas PDF, con 51 bloques, en 35 segundos. Archivos en `artifacts/react-guide-10.pdf` y `.docx`. Pruebas de backend: 61 aprobadas. Chrome: generación de 10 páginas, vista previa, descarga Word, historial sin edición y prueba de solicitud de más de 30 segundos aprobadas. El backend local se reinició con cierre limpio de la base de datos y responde en `/api/health`.

Los materiales anteriores conservan su contenido; una guía antigua breve requiere una nueva generación para desarrollar la extensión solicitada. No se agregan páginas vacías para aparentar que cumple.

Correccion posterior: hasta cuatro intentos por apartado, reutilizando el borrador rechazado y el motivo concreto. Un ejemplo funcional de ocho lineas de codigo admite 100 palabras de explicacion; las paginas sin ese ejemplo requieren 150. Prueba real posterior: diez paginas completadas con 47 bloques y correcciones automaticas de apartados largos.
