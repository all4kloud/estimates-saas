# Campaña de lanzamiento — Estimates & Invoices (correo)

Seis correos (3 en inglés, 3 en español) para Zoho Campaigns. Cada archivo trae el asunto en un comentario al inicio.

| Correo | Día | Enviar a | Asunto EN | Asunto ES |
|---|---|---|---|---|
| 1 | 1 | Toda la lista del idioma | Send estimates from your phone in 2 minutes | Envía estimados desde tu celular en 2 minutos |
| 2 | 5 | Quienes no se registraron | From the job site to an accepted estimate in 3 steps | Del trabajo al estimado aceptado en 3 pasos |
| 3 | 12 | Quienes no se registraron | Your 14 free days are waiting | Tus 14 días gratis te esperan |

- Las imágenes se sirven desde `https://estimates.all4kloud.net/email/estimates-ad-{en,es}.jpg` (carpeta `public/email`).
- Los botones llevan a `/signup` con `utm_campaign=lanzamiento-2026` y `utm_content=correoN-idioma`.
- Pie: dirección física (CAN-SPAM). Zoho Campaigns agrega el link de baja; revisa que aparezca en la vista previa.
- La prueba gratis pasa por Stripe Checkout (pide tarjeta, no cobra hasta el día 15): no prometer "sin tarjeta".
