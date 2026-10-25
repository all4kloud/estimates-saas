import 'server-only';
import { headers } from 'next/headers';

/** Idioma para pantallas sin sesión (login): según el navegador. */
export async function browserLang(): Promise<'es' | 'en'> {
  const al = (await headers()).get('accept-language') || '';
  return al.toLowerCase().startsWith('en') ? 'en' : 'es';
}
