import type { Lang } from './types';

export const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

export const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const fmtDate = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

export const fmtDateTime = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Date(iso).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) : '';

export const todayISO = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtPhone = (p: string | null | undefined) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || '';
};

export const e164 = (p: string | null | undefined) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;
  return d ? '+' + d : '';
};

export const itemName = (i: { name_en: string; name_es: string }, lang: Lang) =>
  (lang === 'es' ? i.name_es || i.name_en : i.name_en || i.name_es) || '';

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const publicDocUrl = (token: string) => `${appUrl()}/e/${token}`;
