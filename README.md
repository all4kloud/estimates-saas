# Estimates & Invoices v2 (multi-negocio)

Webapp para que pequeños negocios de servicios (power washing, landscaping, limpieza…) creen y envíen
**estimados y facturas desde el teléfono**. Los documentos salen en **inglés por defecto**, con opción
de **español** por cliente o por documento.

**Stack:** Next.js 15 (App Router) · Supabase (Auth + Postgres con RLS + Storage) · Resend (email) ·
Stripe Connect (pagos con tarjeta) · Stripe Billing (suscripción de cada negocio) · Google Cloud Run.

> **Despliegue:** ver [`DEPLOY-CLOUD-RUN.md`](DEPLOY-CLOUD-RUN.md) (Cloud Run + GitHub Actions + dominio).

---

## Qué incluye

| Área | Funciones |
|---|---|
| **Multi-negocio** | Cada negocio tiene sus clientes, servicios, numeración, logo, colores y textos. Aislamiento con Row Level Security en la base de datos. |
| **Roles** | `owner` (todo, incluido Stripe y nombrar dueños) · `admin` (ajustes y equipo) · `member` (clientes, estimados y facturas). El superadmin de la plataforma ve y administra todos los negocios. |
| **Seguridad** | Login con email y contraseña, invitaciones por email, recuperación de contraseña, cambio de contraseña (pide la actual), perfil con idioma de la app. |
| **Documentos** | Editor móvil con los servicios a un toque, numeración automática (E-1001, INV-1001), totales calculados en la base de datos, PDF con logo, estimado → factura, historial de eventos. |
| **Envío** | **SMS** desde el teléfono del negocio con un link al documento · **Email** desde la plataforma (Resend) con PDF adjunto · compartir el PDF por WhatsApp u otras apps. |
| **Link público** `/e/<token>` | El cliente ve el documento en su idioma (y puede cambiarlo), **acepta o rechaza** el estimado escribiendo su nombre, **paga la factura con tarjeta** y descarga el PDF. El negocio recibe un aviso por email. |
| **Pagos** | Stripe Connect Standard: cada negocio conecta su propia cuenta y el dinero va directo a ella. Comisión opcional de la plataforma (`PLATFORM_FEE_PERCENT`). |
| **Registro** | `/signup`: el negocio crea su cuenta solo, confirma su email y activa el plan (prueba gratis de `TRIAL_DAYS` días). |
| **Suscripción** | Stripe Billing: plan anual (`STRIPE_PRICE_ID`), portal para cambiar tarjeta o cancelar, y la app se bloquea (redirige a `/billing`) si el plan no está al día. Los pilotos quedan en **cortesía**. |
| **Plataforma** | `/admin`: crear negocios con servicios iniciales e invitar al dueño, activar o desactivar negocios, entrar a cualquier negocio. |
| **Migración** | Ajustes → *Importar datos de la versión 1* sube el respaldo JSON de la app anterior (clientes, estimados, facturas y precios). |

---

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en supabase.com (región `us-east`).
2. Abre **SQL Editor** y ejecuta, en orden, `0001_init.sql`, `0002_billing.sql` y `0003_hardening.sql` (carpeta `supabase/migrations`).
   (Con la CLI: `supabase link` y luego `supabase db push`.)
3. **Authentication → Sign In / Providers**: deja Email activo y **desactiva "Allow new users to sign up"**
   (el registro de negocios pasa por `/signup`, que crea los usuarios desde el servidor; los miembros de equipo entran por invitación).
4. **Authentication → URL Configuration**
   - Site URL: `https://estimates.all4kloud.net` (tu subdominio)
   - Redirect URLs: `https://estimates.all4kloud.net/**`
5. **Authentication → Emails → SMTP Settings**: usa el SMTP de Resend (`smtp.resend.com`, puerto 465,
   usuario `resend`, contraseña = API key). El SMTP por defecto de Supabase tiene un límite muy bajo.
6. **Authentication → Emails → Templates**: reemplaza el link de estas plantillas
   (necesario para que el link funcione aunque se abra en otro dispositivo):

   | Plantilla | Link |
   |---|---|
   | Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/account/set-password` |
   | Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/set-password` |
   | Change email | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/account` |

   Ejemplo para *Invite user*:
   ```html
   <h2>You're invited / Está invitado</h2>
   <p>Create your password to start sending estimates and invoices.<br>
      Cree su contraseña para empezar a enviar estimados y facturas.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/account/set-password">Accept / Aceptar</a></p>
   ```
7. **Tu usuario superadmin**: en *Authentication → Users → Add user* crea tu usuario con contraseña y luego, en SQL Editor:
   ```sql
   update public.profiles set is_superadmin = true where email = 'TU_EMAIL';
   ```

### 2. Resend (email)
1. En resend.com agrega el dominio `all4kloud.net` y crea los registros DNS que te indique (SPF, DKIM).
2. Crea una API key. Los emails a clientes salen como **"Nombre del Negocio" &lt;estimates@all4kloud.net&gt;**,
   y las respuestas llegan al email del negocio (reply-to).

### 3. Stripe
**Suscripciones (Billing):** producto, precio anual, portal de clientes y webhook `/api/stripe/billing-webhook`:
ver [`DEPLOY-CLOUD-RUN.md`](DEPLOY-CLOUD-RUN.md), sección *Stripe*.

**Connect (opcional, para que cada negocio cobre facturas con tarjeta):**
1. En dashboard.stripe.com activa **Connect** (Platform; cuentas *Standard*).
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://estimates.all4kloud.net/api/stripe/webhook`
   - *Listen to*: **Events on Connected accounts**
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated`
3. Copia el *Signing secret* (`whsec_…`) a `STRIPE_WEBHOOK_SECRET`.
4. Cada dueño conecta su cuenta en **Ajustes → Pagos con tarjeta → Conectar Stripe**.

### 4. Cloud Run
Todo el despliegue (Google Cloud, GitHub Actions, secretos, dominio y Stripe Billing) está en
[`DEPLOY-CLOUD-RUN.md`](DEPLOY-CLOUD-RUN.md).

### 5. Cargar los negocios (José y Javier)
Los dos negocios iniciales están definidos en `supabase/seed/clients.json`, con sus logos en `supabase/seed/logos/`:

| Negocio | Dueño | Email de acceso | Servicios |
|---|---|---|---|
| Power Washing Services LLC | José Mejía | powerwashingllcnc@gmail.com | 5 (power washing) |
| Mejia's Construction | Javier Mejía | mejiasconstructionnc@gmail.com | 6 (construcción) |

Con `.env.local` apuntando al proyecto de Supabase **de producción**:
```bash
npm install
npm run seed:clients -- --dry-run   # revisa lo que va a hacer
npm run seed:clients                # crea negocios, servicios, logos e invita a los dueños
```
- Cada dueño recibe un email, crea su contraseña y entra directo a **su** negocio, con su logo y sus colores.
- El script se puede volver a correr: no duplica nada y no cambia precios ni textos que el dueño ya editó.
  Para agregar otro negocio, añádelo al JSON (o usa **/admin** en la app).
- Opciones: `--no-invite` (sin emails), `--only=mejias-construction` (un solo negocio).
- Después cada dueño, en **Más → Ajustes**, pone los precios base y las formas de pago, y conecta Stripe.
- Si ya usaban la v1: en la app vieja **Ajustes → Descargar respaldo**, y en la v2
  **Ajustes → Importar datos de la versión 1**.

Como superadmin ves los dos negocios en **/admin** y puedes cambiar de uno a otro con el selector de arriba.

---

## Desarrollo local
```bash
npm install
cp .env.example .env.local   # completar con un proyecto Supabase de pruebas
npm run dev
```

## Estructura
```
supabase/migrations/0001_init.sql   esquema, triggers (numeración, totales), RLS, bucket de logos
supabase/migrations/0002_billing.sql suscripción por negocio (pilotos en cortesía)
supabase/seed/                      negocios iniciales (JSON) y sus logos
scripts/seed-clients.mjs            crea/actualiza esos negocios e invita a los dueños
middleware.ts                       sesión y protección de rutas
lib/                                auth/contexto, PDF (jsPDF), email (Resend), Stripe, textos EN/ES
app/(app)/                          app del negocio: estimados, facturas, clientes, ajustes, equipo
app/e/[token]/                      página pública del cliente: aceptar, rechazar, pagar, PDF
app/admin/                          panel de plataforma (superadmin): cortesía, activar/desactivar
app/signup/                         registro por autoservicio
app/billing/                        estado de la suscripción, checkout y portal
app/api/                            PDF interno, Stripe Connect, Billing y sus webhooks
lib/billing.ts                      reglas de acceso y sincronización con Stripe Billing
Dockerfile, .github/workflows/      imagen y CI/CD para Cloud Run
scripts/gcp-setup.ps1               configuración única de Google Cloud
```

## Notas de seguridad
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor, y siempre después de verificar el rol
  (invitaciones, página pública por token, webhook, importación).
- RLS impide leer o escribir datos de otro negocio, darse permisos, marcarse superadmin o cambiar el
  estado de Stripe desde el cliente. Siempre queda al menos un dueño por negocio.
- El link público usa un token aleatorio de 144 bits y no se indexa (`noindex`).
- Probado de punta a punta (login, invitaciones, roles, estimado → aceptado → factura → pagada, aislamiento
  entre negocios, recuperación de contraseña) contra Postgres, PostgREST y Supabase Auth reales.
  Storage (logos), Resend y Stripe no se pudieron probar en ese entorno: hay que verificarlos en el primer despliegue.
