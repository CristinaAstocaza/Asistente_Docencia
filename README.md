# Asistente IA para Docentes

Actualización del 13 de octubre: guías con editor visual, planificación, contexto, plantillas opcionales, recuperación, Kahoot y Cloudinary. Consulta la [entrega y pasos de despliegue](docs/entrega-2026-10-13.md) para verificaciones y configuración pendiente.

Copiloto docente: **fuentes → IA → generación → revisión → exportación**. El frontend existente ahora utiliza una API NestJS y datos persistentes; el acceso y los resultados dejaron de ser simulaciones.

## Ejecutar en Windows

Requisitos: Node.js 22 o posterior y npm. La configuración local creada durante la revisión utiliza PostgreSQL embebido con pgvector para funcionar sin Docker.

En una terminal:

```powershell
cd backend
npm ci
# Si todavía no existe .env:
Copy-Item .env.example .env
# En .env: DATABASE_DRIVER=pglite para desarrollo local sin Docker.
npm run migrate
npm run dev
```

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Crear una cuenta propia; ya no se acepta cualquier contraseña. La API escucha en `127.0.0.1:4000`. Next.js reenvía `/api` a ese servidor.

`backend/.env` admite configuración específica. Las claves no vacías de la `.env` compartida en la raíz se utilizan cuando no hay un valor local. No copiar claves a variables `NEXT_PUBLIC_*`. La configuración se lee desde el directorio `backend`, como en los comandos anteriores.

## PostgreSQL externo

```powershell
docker compose up -d
cd backend
# DATABASE_DRIVER=postgres
# DATABASE_URL=postgresql://docente:docente_dev@localhost:5432/docente
npm run migrate
npm run dev
```

PGlite es exclusivamente un modo de desarrollo de un solo proceso, persistido en `backend/data/postgres`. Para producción usar PostgreSQL con pgvector y Cloudinary privado (S3 sigue disponible). La configuración local usa Cloudinary para nuevos originales; los anteriores permanecen accesibles en disco mediante el registro de proveedores. `STORAGE_DRIVER=local` guarda archivos en `backend/storage`, fuera del frontend; los originales solo se descargan mediante endpoints autenticados.

## Funcionalidad

- Registro, inicio y cierre de sesión; cookies HttpOnly, acceso de 15 minutos, renovación rotativa hasta 30 días.
- Fuentes PDF, DOCX, PPTX, TXT, PNG, JPG y enlaces HTTPS; búsqueda, carpetas, renombrado, eliminación, vista previa del texto, descarga y reintentos.
- Procesamiento en segundo plano con recuperación de trabajos interrumpidos; extracción por página/diapositiva, fragmentos con solapamiento y embeddings de 768 dimensiones.
- Chat con memoria persistente, fuentes seleccionadas, modo exclusivo o complementado y referencias reales a fragmentos recuperados.
- Clases, sesiones, sílabos, preguntas, exámenes, rúbricas, resúmenes y presentaciones con contratos estructurados y agentes especializados por tarea.
- Edición, control de versiones, duplicación, reutilización de un material como contexto y exámenes desde un banco de preguntas.
- DOCX, PDF y PPTX reales; variantes A/B de exámenes, preguntas y alternativas aleatorias en B, solucionario separado.
- Excel para importar quizzes en Quizizz/Wayground usando sus plantillas oficiales; publicación manual en la plataforma externa.
- Dashboard, historial, perfil y consumo basados en datos del docente.

## IA y verificaciones

El proveedor está encapsulado en `backend/src/ai/provider.ts`. `GEMINI_MODEL` y `GEMINI_EMBEDDING_MODEL` son configurables. El modelo local `gemini-3.5-flash-lite` se verificó con esta cuenta: `gemini-2.5-flash` devolvió indisponibilidad y `gemini-3.8-flash` saturación temporal. El contrato REST utiliza el enum `APPLICATION_JSON` de `TextResponseFormat`, según la [referencia oficial](https://ai.google.dev/api/generate-content#TextResponseFormat). Se envía un esquema de forma compatible con el proveedor y se validan los límites y reglas completas en el servidor.

```powershell
cd backend
npm test
# Comprobación opcional: consume una solicitud pequeña de embeddings y una generación.
node scripts/check-ai.cjs
# Verifica el pipeline, chat, los ocho tipos de material y sus exportaciones con IA real.
# Usa una fuente sintética y una base efímera; consume varias solicitudes del proveedor.
node scripts/check-flow.cjs

cd ../frontend
npm run lint
npm run build
npm run test:e2e
```

Las pruebas de API usan PostgreSQL/pgvector real embebido, almacenamiento temporal y un proveedor IA determinista; no consumen créditos. Las pruebas de navegador levantan una API efímera y Chrome instalado. La prueba real del proveedor es independiente. Para el navegador se requiere una compilación reciente de frontend y backend y puertos 3100/4000 libres; la prueba usa 3100 para no interrumpir el frontend de desarrollo en 3000.

## Límites explícitos

- La extracción de PDF trabaja con la capa de texto. Para PDFs completamente escaneados subir las páginas como imágenes; estas se transcriben con el modelo multimodal. DOCX no inventa números de página porque el formato no contiene paginación estable.
- Las presentaciones usan una composición común para PPTX editable y PDF horizontal: portadas, tarjetas, actividades, diagramas y barras construidas con formas editables. Incorporan fotografías de Wikimedia Commons con autor, licencia y enlaces en las páginas de créditos. La selección se guarda en `backend/storage/presentation-assets` para reutilizar las mismas imágenes en ambos formatos. Si no hay conexión o imágenes adecuadas, la exportación conserva sus figuras y contenido. `PRESENTATION_IMAGES=off` desactiva las búsquedas; también se puede elegir «Sin fotografías» al generar. El contenido extenso se distribuye en diapositivas de continuación sin recortarlo; créditos y continuaciones pueden aumentar las páginas exportadas. «Ver diseño final» permite revisar el PDF antes de descargar.
- Se muestran las fuentes recuperadas. La revisión pedagógica y la fidelidad de cada afirmación siguen requiriendo al docente; el sistema no garantiza la ausencia de alucinaciones.
- Las integraciones exportan archivos; no conectan ni publican en cuentas externas. [procedimiento Wayground](https://help.wayground.com/support/solutions/articles/158000405095-wayground-ai-turn-worksheets-question-banks-more-into-interactive-assessments).
- Para producción se exige escaneo de archivos: `SCAN_URL` debe aceptar bytes y devolver `{ "clean": true }`. Desarrollo valida formato, firma, tamaño y límites de expansión Office; no afirma realizar antivirus sin un escáner.
- La recuperación está implementada y necesita un puente de correo configurado para entregar enlaces. No incluye OAuth, cobros, matrículas, asistencia ni registro de notas.

Arquitectura, datos y endpoints: [docs/arquitectura.md](docs/arquitectura.md). Estado de revisión y comprobaciones: [docs/revision.md](docs/revision.md).
