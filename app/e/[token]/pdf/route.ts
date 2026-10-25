import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { loadDoc, pdfFileName } from '@/lib/docs';
import { renderPdf } from '@/lib/pdf';
import type { Business } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) return new NextResponse('Not found', { status: 404 });
  const admin = createAdminClient();
  const doc = await loadDoc(admin, { token });
  if (!doc) return new NextResponse('Not found', { status: 404 });
  const { data: biz } = await admin.from('businesses').select('*').eq('id', doc.business_id).single<Business>();
  if (!biz?.active) return new NextResponse('Not found', { status: 404 });
  const l = req.nextUrl.searchParams.get('lang');
  const view = { ...doc, lang: l === 'es' || l === 'en' ? l : doc.lang };
  const pdf = await renderPdf(view, biz);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdfFileName(view)}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
