import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { PDFDocument } from 'pdf-lib';
import { deleteDoc, getDoc, updateDoc, type Doc } from '@/lib/kv';
import { isAdmin } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const doc = await getDoc(id);
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await getDoc(id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const contentType = req.headers.get('content-type') || '';
  const patch: Partial<Doc> = {};

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const title = form.get('title');
    const description = form.get('description');
    const gated = form.get('gated');
    const pdf = form.get('pdf');
    const html = form.get('html');

    if (typeof title === 'string') patch.title = title.slice(0, 200);
    if (typeof description === 'string') patch.description = description.slice(0, 500);
    if (gated !== null) patch.gated = gated === 'true';

    if (pdf instanceof File) {
      const bytes = await pdf.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pdfPages = pdfDoc.getPageCount();

      if (existing.kind === 'pdf' && existing.pdfUrl) {
        await del(existing.pdfUrl).catch(() => {});
      }

      const blob = await put(pdf.name || 'document.pdf', pdf, {
        access: 'public',
        addRandomSuffix: true,
      });

      patch.kind = 'pdf';
      patch.pdfUrl = blob.url;
      patch.pdfPages = pdfPages;
      patch.html = undefined;
    } else if (typeof html === 'string') {
      patch.kind = 'html';
      patch.html = html;
    }
  } else {
    const body = await req.json();
    const { title, description, html, gated } = body || {};
    if (typeof title === 'string') patch.title = title.slice(0, 200);
    if (typeof description === 'string') patch.description = description.slice(0, 500);
    if (typeof html === 'string') patch.html = html;
    if (typeof gated === 'boolean') patch.gated = gated;
  }

  const updated = await updateDoc(id, patch);
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { html: _h, ...meta } = updated;
  return NextResponse.json(meta);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  await deleteDoc(id);
  return NextResponse.json({ ok: true });
}
