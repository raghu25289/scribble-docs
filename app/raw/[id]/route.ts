import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getDoc } from '@/lib/kv';
import { injectAll } from '@/lib/inject';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDoc(id);
  if (!doc) notFound();

  if (doc.kind === 'pdf') {
    if (!doc.pdfUrl) notFound();
    return NextResponse.redirect(doc.pdfUrl, 302);
  }

  const html = injectAll(doc.html ?? '');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
