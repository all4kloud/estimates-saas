import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/format';

// Links de los emails de Supabase (invitación, recuperar contraseña, cambio de email).
// Plantillas: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/account/set-password
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') || '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  const supabase = await createClient();

  let ok = false;
  if (token_hash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  // En Cloud Run req.url trae el host interno (0.0.0.0:8080): el destino se arma con la URL pública.
  const dest = new URL(ok ? next : '/login', appUrl());
  if (!ok) dest.searchParams.set('expired', '1');
  return NextResponse.redirect(dest);
}
