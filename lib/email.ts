import 'server-only';
import { Resend } from 'resend';
import { env } from './env';
import type { Business } from './types';

export const emailConfigured = () => !!env('RESEND_API_KEY') && !!env('RESEND_FROM_EMAIL');

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** HTML sencillo y compatible con clientes de correo: texto + botón con el link. */
export function simpleHtml(text: string, biz: Pick<Business, 'name' | 'logo_url' | 'accent_color'>, button?: { label: string; url: string }) {
  const body = escapeHtml(text)
    .split('\n')
    .map(l => (button && l.trim() === button.url ? '' : l))
    .join('<br>');
  const logo = biz.logo_url ? `<img src="${biz.logo_url}" alt="${escapeHtml(biz.name)}" style="max-height:72px;max-width:220px;margin-bottom:16px">` : '';
  const btn = button
    ? `<p style="margin:24px 0"><a href="${button.url}" style="background:${biz.accent_color};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#14213a;max-width:560px">${logo}<div>${body}</div>${btn}</div>`;
}

export async function sendEmail(opts: {
  biz: Business; to: string; subject: string; text: string; html?: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  if (!emailConfigured()) throw new Error('EMAIL_NOT_CONFIGURED');
  const resend = new Resend(env('RESEND_API_KEY'));
  const { error } = await resend.emails.send({
    from: `${opts.biz.name.replace(/[<>"]/g, '')} <${env('RESEND_FROM_EMAIL')}>`,
    to: [opts.to],
    replyTo: opts.biz.email || undefined,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
  });
  if (error) throw new Error(error.message);
}

/** Email de la plataforma (no de un negocio): confirmación de cuenta, avisos de suscripción. */
export async function sendPlatformEmail(opts: { to: string; subject: string; text: string; button?: { label: string; url: string } }) {
  if (!emailConfigured()) throw new Error('EMAIL_NOT_CONFIGURED');
  const resend = new Resend(env('RESEND_API_KEY'));
  const html = simpleHtml(opts.text, { name: 'Estimates & Invoices', logo_url: null, accent_color: '#1f9a9a' }, opts.button);
  const { error } = await resend.emails.send({
    from: `Estimates & Invoices <${env('RESEND_FROM_EMAIL')}>`,
    to: [opts.to],
    subject: opts.subject,
    text: opts.button ? `${opts.text}\n\n${opts.button.url}` : opts.text,
    html,
  });
  if (error) throw new Error(error.message);
}

/** Aviso al negocio (aceptado, rechazado, pagado). Nunca rompe el flujo del cliente. */
export async function notifyBusiness(biz: Business, subject: string, text: string) {
  if (!emailConfigured() || !biz.email) return;
  try {
    await sendEmail({ biz: { ...biz, email: '' }, to: biz.email, subject, text });
  } catch (e) {
    console.error('notifyBusiness', e);
  }
}
