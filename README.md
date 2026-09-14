# FUEL Rewards Platform

Backend + frontend real para el programa de lealtad "Protein Shake Rewards" de UFC GYM FUEL,
implementado a partir de `../README.md` y `../Rewards Platform.dc.html` (referencia visual/de flujo,
no código de producción).

Stack: **Next.js 14 (App Router, TypeScript)** para backend (API routes) y frontend, **PostgreSQL vía Prisma**,
firma real de `.pkpass` (Apple Wallet) y creación/actualización de Loyalty Objects (Google Wallet).

## Estado de credenciales

| Integración | Estado |
|---|---|
| Apple Wallet (PassKit) | **Conectado.** Certificado Pass Type ID real (`pass.com.ufcgym.fuel`), llave privada, Team ID (`2NP49AWVYH`) y certificado intermedio WWDR G4 ya están en `secrets/apple/`. Firma de `.pkpass` verificada con `npm run verify:pkpass`. |
| Google Wallet | **Pendiente.** El código está completo (creación de Loyalty Class/Object, JWT de "Save to Google Wallet"), pero corre en modo no-configurado hasta que agregues `GOOGLE_WALLET_ISSUER_ID` y el JSON de la service account. Mientras tanto la app funciona normal, solo el botón "+ Google Wallet" queda deshabilitado. |

## Puesta en marcha

1. **Base de datos** — Postgres local (`docker compose up -d`, usa el `docker-compose.yml` incluido) o una instancia
   cloud (Neon, Supabase, Railway). Copia `.env.example` a `.env` si no existe y ajusta `DATABASE_URL`.
   ```bash
   npm install
   npx prisma migrate dev --name init
   npm run seed   # crea el admin inicial (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD en .env)
   ```
2. **Correr en desarrollo**:
   ```bash
   npm run dev
   ```
   - `/signup` — registro público de clientes.
   - `/wallet/[serial]?t=...` — la "tarjeta" del cliente (enlace que se le entrega tras registrarse).
   - `/login` → `/staff` — panel de staff (buscar cliente, +1 sello, canjear, reiniciar ciclo, escaneo QR).
   - `/admin` — métricas + tabla de clientes (requiere rol ADMIN).
3. **Verificar la firma de Apple Wallet** sin tocar la base de datos:
   ```bash
   npm run verify:pkpass
   ```

## Completar Google Wallet

1. Crea una cuenta de **Google Wallet Issuer** (gratuita) y anota el **Issuer ID**.
2. Crea una **service account** en Google Cloud con acceso a la Google Wallet API, descarga su JSON de credenciales
   y colócalo en `secrets/google/service-account.json` (la ruta configurable vía
   `GOOGLE_WALLET_SERVICE_ACCOUNT_PATH`).
3. En `.env`, define `GOOGLE_WALLET_ISSUER_ID`.
4. Antes de correr el setup, edita `src/lib/google/classes.ts` y reemplaza `programLogo.sourceUri.uri` por una URL
   HTTPS real y pública del logo de UFC GYM FUEL (Google la valida al crear la clase; el valor actual es un
   placeholder que fallará).
5. Corre `npm run google:setup-class` una vez para crear la Loyalty Class del programa.
6. Reinicia el servidor — el botón "+ Google Wallet" se habilita automáticamente
   (`GET /api/config` refleja `googleWalletEnabled: true`).

## Poner Apple Wallet en producción (push real a dispositivos)

El código de PassKit Web Service (registro de dispositivo, notificación push vía APNs, servir el pase actualizado) ya
está implementado bajo `/api/apple/passkit/v1/...`, pero **Apple solo puede llamar a esa URL si es pública y HTTPS**
(`APP_BASE_URL` en `.env`). Para probar en un iPhone real antes de desplegar:
- Expón tu `localhost:3000` con un túnel HTTPS (ej. `ngrok http 3000`) y actualiza `APP_BASE_URL` con esa URL antes de
  generar el `.pkpass` (el campo `webServiceURL` se graba dentro del pase al firmarlo).
- En producción, despliega detrás de HTTPS real y usa esa URL como `APP_BASE_URL`.

## Assets visuales del pase (Apple Wallet)

`secrets/apple/assets/*.png` (icon/logo/strip en 1x/2x/3x) se generan automáticamente la primera vez que se arma un
`.pkpass`, como placeholders de marca (negro `#0b0b0c` + acentos rojo/dorado) — **no son el diseño final**. Sustitúyelos
por los PNG reales exportados del diseño (`../scraps/pdf-page-1.png` / `pdf-page-2.png`) respetando los mismos nombres
y tamaños; el sistema los usará sin más cambios de código.

## Reglas de negocio implementadas

Ver [`src/lib/loyalty/rules.ts`](src/lib/loyalty/rules.ts) — replica exactamente `README.md` del handoff:
- Etapa 1: 6 sellos → 7° gratis (no otorga sello).
- Etapa 2: al canjear el premio de etapa 1, continúa acumulando hasta 14 sellos adicionales (15 compras totales) → shaker.
- Vigencia de sellos: `STAMP_WINDOW_DAYS` días desde el primer sello del ciclo (default 15). Al vencer, el staff debe
  reiniciar el ciclo manualmente antes de seguir agregando sellos (no se borra el historial automáticamente).
- "Reiniciar ciclo" solo disponible cuando el ciclo está completo (ambos premios canjeados), igual que el prototipo.

## Notas de diseño pendientes de confirmar con negocio

- **Vigencia de sellos**: el README original marca esto como "confirmar con negocio la ventana real"; implementé el
  comportamiento más conservador (bloquear nuevos sellos/canjes y exigir reinicio manual del staff) en vez de borrar
  el progreso automáticamente. Ajustable si el negocio prefiere otro comportamiento.
- **Autenticación de staff/admin**: implementé un login propio (email + contraseña, cookie de sesión firmada) con dos
  roles (`STAFF`, `ADMIN`) porque el handoff no especifica un sistema de cuentas. Antes de producción, considera dar de
  alta cuentas individuales por empleado (hoy solo hay un script de seed para el admin inicial) en vez de compartir
  credenciales.
