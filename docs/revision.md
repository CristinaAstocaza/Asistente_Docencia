# Revisión e implementación — 6 de octubre de 2026

## Estado encontrado

El proyecto tenía una landing, acceso/registro, sidebar y las pantallas del dashboard. No había backend ni esquema de datos. El acceso aceptaba cualquier contraseña, la carga de fuentes era simulada, el chat respondía con texto fijo sobre bases de datos y las pantallas de generación utilizaban ejemplos locales. Los archivos de `agents/` eran descripciones breves, sin orquestación ejecutable.

El prompt maestro se utilizó como referencia de producto y alcance. Sus instrucciones dirigidas a otros agentes se distinguieron del pedido actual de revisar el proyecto y completar lo faltante.

## Implementado

| Prioridad del prompt | Resultado |
|---|---|
| Autenticación | Registro real, scrypt, cookies HttpOnly, sesiones revocables, rotación de refresh |
| Fuentes | Carga real, validación, propiedad, almacenamiento, carpetas, preview, enlaces y estados |
| RAG | Extracción, chunks por página/diapositiva, embeddings, pgvector y recuperación limitada a fuentes seleccionadas |
| Chat | Proveedor real, historial persistente, modo de contexto, referencias y router de generación |
| Clases | JSON estructurado, edición, guardado y reutilización |
| Preguntas | Banco persistente, tipos, soluciones y explicaciones |
| Exámenes | Generación, banco existente, variantes A/B y exportación de solucionario |
| Rúbricas | Cuatro niveles, criterios, pesos y tabla editable |
| Sesiones | Competencia, logro, recursos y etapas con tiempo total validado |
| Sílabos | Unidades, semanas, resultados, metodología, evaluación y bibliografía |
| Presentaciones | Cinco estilos, vista final, notas, fotografías de Wikimedia con créditos, diagramas/barras editables y PDF con composición compartida |
| Exportaciones | DOCX/PDF/PPTX generados con bibliotecas de documentos |
| Integraciones | XLSX desde plantillas oficiales de Quizizz/Wayground |
| Historial/perfil/dashboard | Datos reales por docente, edición, duplicación, versiones y consumo |
| Arquitectura | Monolito modular, documentación, diagrama de módulos/agentes/datos y endpoints |

Se mantuvo la identidad del frontend y se conectaron los flujos mediante componentes compartidos, en lugar de conservar formularios y resultados simulados independientes.

## Verificación

- **23 pruebas de backend aprobadas**: autenticación, permisos entre docentes, CSRF por origen, procesamiento e indexación, memoria, RAG, versiones, cuotas, banco/exámenes, rotación y revocación de tokens; extracción real de PDF/DOCX/PPTX; DOCX/PDF/PPTX, gráficos editables y plantillas XLSX.
- **3 pruebas de Chrome aprobadas**: registro y fuentes con dashboard real, menú móvil/cierre de sesión/protección de acceso, error de contraseña y ajuste del login al viewport móvil.
- **Lint del frontend aprobado, sin advertencias**; TypeScript del frontend y compilación del backend aprobados.
- **Compilación de producción de Next.js aprobada** para todas las rutas.
- **Prueba real de Gemini aprobada** con fuente sintética, base temporal y almacenamiento temporal: extracción → embeddings de 768 dimensiones → pgvector → chat con referencias → los ocho tipos de material con JSON validado → exportaciones PDF/PPTX.

Las pruebas automáticas usan un proveedor determinista para ser repetibles y no gastar créditos. La prueba real del proveedor se ejecutó separadamente; su disponibilidad y resultados pueden variar en otras ejecuciones.

## Configuración y límites operativos

Docker Desktop inició, pero la API del daemon devolvió HTTP 500 al levantar el contenedor. Se añadió un modo local PGlite con pgvector y persistencia en disco, se aplicó su esquema y se utilizó también en las pruebas. `compose.yaml` queda listo para PostgreSQL externo cuando Docker funcione.

La clave compartida de Gemini sí generó embeddings. El modelo antiguo devolvió HTTP 404; el modelo Flash más reciente devolvió saturación temporal. Se configuró y verificó `gemini-3.5-flash-lite` sin modificar ni exponer la clave existente.

La entrega es un MVP funcional local. La publicación pública necesita provisionar PostgreSQL, almacenamiento y escáner de archivos; no se realizó despliegue. Los quizzes se importan mediante archivos, no se publican en cuentas externas. PDF escaneado completo y generación de fotografías con IA quedan fuera de esta implementación; las presentaciones descargan fotografías educativas de Wikimedia y renderizan diagramas y barras editables en ambos formatos. Consulta los límites detallados en [README](../README.md).
