import { appUrl } from '@/lib/format';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BID_COOKIE } from '@/lib/auth';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL('/login', appUrl()), { status: 303 });
  res.cookies.delete(BID_COOKIE);
  return res;
}
