#!/usr/bin/env node
/**
 * Crea o actualiza los negocios de supabase/seed/clients.json:
 * datos del negocio, servicios, logo (Storage) e invitación al dueño.
 *
 *   npm run seed:clients                 # usa .env.local
 *   npm run seed:clients -- --dry-run    # muestra lo que haría, sin cambiar nada
 *   npm run seed:clients -- --no-invite  # no envía emails de invitación
 *   npm run seed:clients -- --only=mejias-construction
 *
 * Se puede correr varias veces: no duplica negocios, servicios ni membresías,
 * y no cambia precios ni textos que el dueño ya haya editado en la app.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const INVITE = !args.includes('--no-invite');
const ONLY = args.find(a => a.startsWith('--only='))?.split('=')[1];

// --- variables de entorno (.env.local / .env, sin dependencias) ---
for (const f of ['.env.local', '.env']) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '');
  }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!URL || !KEY) { console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (.env.local)'); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const seedDir = join(root, 'supabase', 'seed');
const { businesses } = JSON.parse(readFileSync(join(seedDir, 'clients.json'), 'utf8'));
const log = (...a) => console.log(DRY ? '[dry-run]' : ' ', ...a);
const die = (msg, err) => { console.error(`✗ ${msg}:`, err?.message || err); process.exit(1); };

// campos que se fijan solo al CREAR (después los maneja el dueño desde Ajustes)
// billing_exempt: los pilotos usan la app sin suscripción (requiere la migración 0002)
const CREATE_ONLY = ['billing_exempt', 'payment_text_en', 'payment_text_es', 'tagline', 'brand_color', 'accent_color', 'default_lang', 'website'];
const ALWAYS = ['name', 'owner_name', 'address1', 'address2', 'phone', 'email'];

async function findUserId(email) {
  const { data } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
  return data?.id || null;
}

for (const b of businesses) {
  if (ONLY && b.slug !== ONLY) continue;
  console.log(`\n▶ ${b.name} (${b.slug})`);

  // 1) negocio
  const { data: existing, error: e0 } = await sb.from('businesses').select('*').eq('slug', b.slug).maybeSingle();
  if (e0) die('leyendo negocios (¿corriste la migración?)', e0);
  let biz = existing;
  const pick = keys => Object.fromEntries(keys.filter(k => b[k] !== undefined).map(k => [k, b[k]]));
  if (!biz) {
    log('crear negocio');
    if (!DRY) {
      const { data, error } = await sb.from('businesses').insert({ slug: b.slug, ...pick(ALWAYS), ...pick(CREATE_ONLY) }).select('*').single();
      if (error) die('creando negocio', error);
      biz = data;
    } else biz = { id: '(nuevo)', logo_url: null };
  } else {
    log('ya existe → actualizar datos de contacto');
    if (!DRY) {
      const { error } = await sb.from('businesses').update(pick(ALWAYS)).eq('id', biz.id);
      if (error) die('actualizando negocio', error);
    }
  }

  // 2) servicios: agrega los que falten (por nombre en inglés); no toca precios existentes
  const { data: svcs } = biz.id === '(nuevo)' ? { data: [] } : await sb.from('services').select('name_en, sort').eq('business_id', biz.id);
  const have = new Set((svcs || []).map(s => s.name_en.trim().toLowerCase()));
  const maxSort = Math.max(-1, ...(svcs || []).map(s => s.sort));
  const toAdd = (b.services || []).filter(([en]) => !have.has(en.trim().toLowerCase()))
    .map(([en, es, price], i) => ({ business_id: biz.id, name_en: en, name_es: es || '', price: Number(price) || 0, sort: maxSort + 1 + i }));
  log(`servicios: ${toAdd.length} nuevos, ${(b.services || []).length - toAdd.length} ya estaban`);
  if (toAdd.length && !DRY) {
    const { error } = await sb.from('services').insert(toAdd);
    if (error) die('creando servicios', error);
  }

  // 3) logo → Storage (bucket "logos"), solo si el negocio todavía no tiene
  if (b.logo && !biz.logo_url) {
    const file = join(seedDir, b.logo);
    if (!existsSync(file)) console.warn(`  ⚠ no existe ${file}`);
    else {
      log(`subir logo ${b.logo}`);
      if (!DRY) {
        const ext = file.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        const path = `${biz.id}/logo-${Date.now()}.${ext}`;
        const { error } = await sb.storage.from('logos').upload(path, readFileSync(file), { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true });
        if (error) console.warn('  ⚠ no se pudo subir el logo (súbelo en Ajustes):', error.message);
        else {
          const { data } = sb.storage.from('logos').getPublicUrl(path);
          await sb.from('businesses').update({ logo_url: data.publicUrl }).eq('id', biz.id);
        }
      }
    }
  } else if (biz.logo_url) log('logo: ya tiene');

  // 4) dueño: invitar por email (o reutilizar el usuario si ya existe) y darle rol owner
  const email = String(b.owner_email || '').trim().toLowerCase();
  if (!email) { console.warn('  ⚠ sin owner_email: invita al dueño desde /admin'); continue; }
  let uid = DRY ? null : await findUserId(email);
  if (!uid) {
    if (!INVITE) { log(`dueño ${email}: no existe y --no-invite → omitido`); continue; }
    log(`invitar a ${email}`);
    if (!DRY) {
      const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${APP}/account/set-password`, data: { full_name: b.owner_name || '' },
      });
      if (error) die(`invitando a ${email}`, error);
      uid = data.user.id;
    }
  } else log(`dueño ${email}: el usuario ya existe`);
  if (!DRY && uid) {
    const { data: m } = await sb.from('memberships').select('role').eq('business_id', biz.id).eq('user_id', uid).maybeSingle();
    if (m?.role === 'owner') log('ya es dueño');
    else {
      const { error } = await sb.from('memberships').upsert({ business_id: biz.id, user_id: uid, role: 'owner' }, { onConflict: 'business_id,user_id' });
      if (error) die('asignando dueño', error);
      log('rol owner asignado');
    }
  }
}
console.log('\n✓ Listo');
