# Despliegue en Google Cloud Run

Arquitectura de producción:

```
navegador / PWA ──► estimates.all4kloud.net ──► Cloud Run (us-east1, contenedor Next.js)
                                                   │
                     Supabase (Auth + Postgres + Storage, us-east-1) ◄─┤
                     Resend (email) ◄──────────────────────────────────┤
                     Stripe (Connect + Billing) ◄──── webhooks ────────┘
GitHub (main) ──► GitHub Actions ──► Artifact Registry ──► Cloud Run   (Workload Identity, sin llaves JSON)
```

Costo esperado al empezar: Cloud Run ~$0–10/mes (escala a cero), Artifact Registry centavos,
Supabase Pro $25/mes (recomendado antes de tener clientes que pagan: el plan gratuito pausa
el proyecto tras una semana sin actividad).

---

## 1. Supabase

1. Crea el proyecto (región `us-east-1`) y ejecuta en **SQL Editor**, en este orden:
   `0001_init.sql`, luego `0002_billing.sql` y luego `0003_hardening.sql` (carpeta `supabase/migrations`).
2. Configura Auth tal como dice el README (sección *Supabase*, pasos 3 a 7). Deja **apagado**
   "Allow new users to sign up": el registro de negocios pasa por `/signup`, que crea los
   usuarios desde el servidor. Deja **encendido** "Confirm email".
3. Carga los pilotos (quedan en cortesía, sin cobro): `npm run seed:clients` con `.env.local`
   apuntando a producción.

## 2. Stripe

1. **Producto y precio**: Product catalog → *Add product* → "Estimates & Invoices", precio
   recurrente **$100 / año**. Copia el `price_...` → `STRIPE_PRICE_ID`.
2. **Customer portal**: Settings → Billing → *Customer portal* → activa cancelar, actualizar
   tarjeta y ver facturas, y **guarda**. Sin esto, el botón "Tarjeta, facturas y cancelación" falla.
3. **Webhook de suscripciones** (eventos de *tu cuenta*):
   - URL: `https://estimates.all4kloud.net/api/stripe/billing-webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.paused`, `customer.subscription.resumed`
   - Secreto → `stripe-billing-webhook-secret`
4. **Webhook de Connect** (eventos de *cuentas conectadas*), igual que antes:
   - URL: `https://estimates.all4kloud.net/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated`
   - Secreto → `stripe-connect-webhook-secret`
5. Prueba todo primero con llaves de **modo test** (`sk_test_...`, tarjeta `4242 4242 4242 4242`).

## 3. Google Cloud (una sola vez)

1. Crea un proyecto **de all4kloud** (no el de Conectare), p. ej. `all4kloud-estimates`, con facturación.
2. En PowerShell, desde la carpeta del proyecto:
   ```powershell
   gcloud auth login
   .\scripts\gcp-setup.ps1 -ProjectId all4kloud-estimates
   ```
   El script activa las APIs, crea Artifact Registry, las cuentas de servicio, Workload Identity
   para GitHub y los secretos (te los pide uno por uno; lo que dejes vacío queda como `NOT_SET`).
   Para cambiar un secreto después:
   ```powershell
   Set-Content -NoNewline -Path s.txt -Value "whsec_..." ; gcloud secrets versions add stripe-billing-webhook-secret --data-file=s.txt ; Remove-Item s.txt
   ```
   Cloud Run lee `:latest`, así que el cambio aplica en el siguiente despliegue.

## 4. GitHub

1. El código vive en `all4kloud/estimates-saas`. Para trabajar en tu computadora:
   ```powershell
   git clone https://github.com/all4kloud/estimates-saas.git
   ```
2. Settings → Secrets and variables → Actions → **Variables**: las que imprime el script al final.
3. Cada push a `main` corre typecheck, construye la imagen y despliega. Los PR solo corren typecheck.
   Para redesplegar sin cambios: Actions → *Deploy to Cloud Run* → *Run workflow*.

## 5. Dominio `estimates.all4kloud.net`

1. Verifica el dominio con la misma cuenta de Google: `gcloud domains verify all4kloud.net`
   (abre Search Console y te da un registro TXT para el DNS).
2. Mapea el subdominio al servicio:
   ```powershell
   gcloud beta run domain-mappings create --service estimates --domain estimates.all4kloud.net --region us-east1
   ```
3. En el DNS de all4kloud.net crea un **CNAME** `estimates` → `ghs.googlehosted.com.`
   El certificado HTTPS se emite solo (de 15 min a unas horas).
4. Si cambias el dominio, actualiza `NEXT_PUBLIC_APP_URL` y redespliega: esa variable queda
   fija en la imagen al construirla.

## 6. Verificación del primer despliegue

- [ ] `/signup` crea el negocio y llega el email de confirmación (revisa Resend → Logs).
- [ ] El link del email abre `/billing`; "Empezar prueba gratis" abre Stripe Checkout.
- [ ] Al pagar con la tarjeta de prueba, `/billing` muestra la fecha de fin de la prueba y la app abre.
- [ ] En Stripe, cancela la suscripción: el negocio pasa a "Cancelada" y la app redirige a `/billing`.
- [ ] Los pilotos (cortesía) entran sin pasar por `/billing`.
- [ ] Subir un logo en Ajustes (Storage), enviar un estimado por email (Resend), pagar una
      factura con tarjeta (Connect). Estos tres no se pudieron probar fuera de producción.

## Operación

- **Logs**: Cloud Run → `estimates` → Logs (o `gcloud run services logs read estimates --region us-east1`).
- **Volver a una versión anterior**: Cloud Run → Revisions → *Manage traffic* → 100% a la revisión anterior.
- **Arranque en frío**: con `--min-instances 0` la primera visita tras un rato sin uso tarda 1–3 s.
  Con clientes pagando, `--min-instances 1` lo elimina por unos $10–15/mes.
