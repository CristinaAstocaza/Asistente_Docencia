# Corrección de generación de guías

La solicitud «Crea una guía práctica de react con visual, incluyendo código y, ejemplos», con carrera ING. SISTEMAS, curso Desarrollo de Software, duración 90 y visuales IA, se comprobó con Gemini en una base efímera. Resultado: 36 segundos y 15 bloques válidos; sin modelo de imágenes configurado se devuelve una guía con texto/código/diagramas y un aviso.

El proxy HTTP de Next.js tenía un tiempo de espera predeterminado de 30 segundos. Se configuró `experimental.proxyTimeout=600000` para las solicitudes al backend, dejando margen para recuperación, Gemini y recursos visuales opcionales. Esto evita el error genérico del proxy en generaciones que continúan trabajando después del segundo 30.

Se añadió una prueba Chrome que mantiene al proveedor de pruebas trabajando durante 35 segundos y exige HTTP 201, apertura del editor y ausencia de errores de conexión. Se comprueban también las opciones de la solicitud reportada y el aviso previo de que no hay modelo de imágenes configurado. El retraso está limitado al servidor efímero de pruebas; no se incorpora a la aplicación.

Archivos: `frontend/next.config.ts`, `GuideWorkspace.tsx`, `e2e/proxy-timeout.spec.ts`, `playwright.proxy.config.ts` y el servidor de pruebas. La comprobación Gemini real está en `backend/scripts/check-react-guide.cjs` y su resultado en `artifacts/react-guide-check.txt`.
