# Nakama · sistema de tesis

Aplicación local de mesa de ayuda basada en la guía de construcción. La base local vive en `.local/nakama`; el proyecto no se conecta a la app anterior ni a la cuenta de otra persona.

## Inicio local

1. Instala dependencias con `pnpm install`.
2. Copia `.env.example` como `.env.local` y deja `NAKAMA_ALLOW_REMOTE_DB=0` y `DATABASE_URL` vacío.
3. Prepara el entorno de Python e instala los paquetes:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
   ```

4. Inicializa la base: `pnpm db:seed`.
5. Importa el histórico que servirá como pretest:

   ```powershell
   pnpm import:historico -- "C:\ruta\Base_incidencias_2026_Nakama.xlsx"
   ```

6. Entrena con la partición temporal indicada en la guía y registra el modelo:

   ```powershell
   .\.venv\Scripts\python.exe ml\entrenar_y_exportar.py "C:\ruta\Base_incidencias_2026_Nakama.xlsx" src\lib\ml\modelo.json --corte 2026-07-01
   pnpm ml:parity
   pnpm ml:register
   ```

7. Inicia la aplicación con `pnpm dev` y abre `http://127.0.0.1:3001`.

En modo local se identifica al supervisor con `DEV_USER_EMAIL` (por defecto `supervisor@nakama.local`). El supervisor registra los correos, áreas y especialidades de los usuarios en la pantalla Usuarios. Los códigos del histórico se importan inactivos y sin correos; no se inventan cuentas ni registros operativos.

## Datos del histórico

El importador solo lee `Categoría confirmada`; descarta `Categoría sugerida` porque no fue generada por este modelo. Conserva las fechas y horas registradas. Los 123 casos sin fecha y hora de cierre quedan sin cierre y no entran en I2. Las filas de pretest usan `origen = historico`; los casos nuevos usan `origen = sistema`.

El archivo de origen y la base se mantienen fuera del control de versiones. El modelo JSON conserva únicamente vocabulario, parámetros y métricas, sin descripciones ni identificadores personales. El archivo de control de paridad queda ignorado por Git.

## Acceso remoto opcional

La aplicación queda en modo local por defecto. Un despliegue propio requiere configurar una Neon propia, `DATABASE_URL`, `NAKAMA_ALLOW_REMOTE_DB=1` y Cloudflare Access (`CF_ACCESS_TEAM`, `CF_ACCESS_AUD`). `wrangler.jsonc` habilita el acceso remoto para el Worker; no se ha creado ni conectado ningún servicio remoto.

## Indicadores

- **I1:** promedio de duración de las exportaciones, en minutos.
- **I2:** promedio y mediana del registro hasta resolución o cierre, solo casos cerrados; filtro pretest/postest.
- **I3:** consultas actualizadas con respuesta de hasta 3 segundos.
- **I4:** verificaciones dentro de la tolerancia relativa de 1 %.
- **I5:** actividades no canceladas ejecutadas hasta su fecha límite.
- **ML:** exactitud, F1 macro y kappa; en producción compara sugerencia con categoría confirmada para incidencias postest.

Los indicadores se calculan desde las tablas. Cuando no hay observaciones, la pantalla muestra «Sin datos».
