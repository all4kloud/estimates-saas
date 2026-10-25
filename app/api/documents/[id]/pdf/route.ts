import { NextResponse, type NextRequest } from 'next/server';
import { getCtx } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadDoc, pdfFileName } from '@/lib/docs';
import { renderPdf } from '@/lib/pdf';
import type { Business } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;
  const supabase = await createClient();
  const doc = await loadDoc(supabase, { id });          // RLS: solo si pertenece a un negocio del usuario
  if (!doc) return new NextResponse('Not found', { status: 404 });
  const { data: biz } = await supabase.from('businesses').select('*').eq('id', doc.business_id).single<Business>();
  if (!biz) return new NextResponse('Not found', { status: 404 });
  const pdf = await renderPdf(doc, biz);
  const disp = req.nextUrl.searchParams.get('download') ? 'attachment' : 'inline';
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disp}; filename="${pdfFileName(doc)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
