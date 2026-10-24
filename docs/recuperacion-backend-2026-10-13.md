# Recuperación del backend

El proceso Node permanecía abierto sin escuchar en el puerto 4000 porque la inicialización de PGlite abortaba. El diagnóstico sobre una copia encontró `PANIC: could not locate a valid checkpoint record` e `invalid resource manager ID in checkpoint record`.

Se conservó `backend/data/postgres` y se creó una copia bajo `backend/data/recovery-*`. El archivo de control tenía un CRC válido, pero apuntaba a un registro que no era un checkpoint utilizable. Se localizaron checkpoints existentes con CRC válido en el WAL de la copia, se apuntó su control al más reciente y PostgreSQL reprodujo el WAL hasta su final. No se vació ni reemplazó el WAL por un registro artificial. Después se reconstruyeron los índices y se aplicó el esquema aditivo.

La copia abrió con 6 cuentas, 14 documentos, 31 materiales y 8 mensajes. Esos conteos verifican los registros legibles recuperados; no constituyen una garantía sobre transacciones que no llegaron a persistirse antes del fallo. La base original permanece conservada para revisión.

La configuración local `backend/.env` utiliza ahora esa copia en `PGLITE_PATH`. Se arrancó la API desde `dist/main.js` y se comprobaron HTTP 200 en `http://127.0.0.1:4000/api/health` y `http://localhost:3000/api/health`. Los registros de arranque están en `artifacts/backend-runtime.stdout.log` y `backend-runtime.stderr.log`, ignorados por Git.

Se añadieron:

- Bloqueo por proceso antes de abrir una base PGlite persistente. Una segunda API o una migración concurrente falla antes de tocar los archivos. Los bloqueos de procesos ya terminados se recuperan y los cierres liberan el bloqueo.
- Cierre de la aplicación si falla el arranque y un mensaje que incluye la causa real, para evitar procesos abiertos que aparentan servir la API.
- Prueba del bloqueo, recuperación de bloqueo obsoleto y liberación. Suite: 59 pruebas aprobadas.

No ejecutar migraciones mientras la API utiliza PGlite. Para producción se mantiene la recomendación de PostgreSQL externo. Los directorios de `backend/data` contienen información privada y permanecen ignorados por Git.
