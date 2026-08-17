import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { put } from '@vercel/blob';
import { PDFDocument } from 'pdf-lib';
import { createDoc, listDocsWithStats, type Doc } from '@/lib/kv';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const docs = await listDocsWithStats();
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const title = form.get('title');
    const description = form.get('description');
    const gated = form.get('gated') === 'true';
    const pdf = form.get('pdf');

    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    if (pdf instanceof File) {
      const bytes = await pdf.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pdfPages = pdfDoc.getPageCount();

      const blob = await put(pdf.name || 'document.pdf', pdf, {
        access: 'public',
        addRandomSuffix: true,
      });

      const doc: Doc = {
        id: nanoid(10),
        title: String(title).slice(0, 200),
        description: description ? String(description).slice(0, 500) : undefined,
        kind: 'pdf',
        pdfUrl: blob.url,
        pdfPages,
        createdAt: Date.now(),
        gated: Boolean(gated),
        version: 1,
      };
      await createDoc(doc);
      return NextResponse.json(doc);
    }

    const html = form.get('html');
    if (!html) {
      return NextResponse.json({ error: 'html or pdf required' }, { status: 400 });
    }
    const doc: Doc = {
      id: nanoid(10),
      title: String(title).slice(0, 200),
      description: description ? String(description).slice(0, 500) : undefined,
      kind: 'html',
      html: String(html),
      createdAt: Date.now(),
      gated: Boolean(gated),
      version: 1,
    };
    await createDoc(doc);
    const { html: _h, ...meta } = doc;
    return NextResponse.json(meta);
  }

  // Backward-compat JSON path (HTML only)
  const body = await req.json();
  const { title, description, html, gated } = body || {};
  if (!title || !html) {
    return NextResponse.json({ error: 'title and html required' }, { status: 400 });
  }
  const doc: Doc = {
    id: nanoid(10),
    title: String(title).slice(0, 200),
    description: description ? String(description).slice(0, 500) : undefined,
    kind: 'html',
    html: String(html),
    createdAt: Date.now(),
    gated: Boolean(gated),
    version: 1,
  };
  await createDoc(doc);
  const { html: _h, ...meta } = doc;
  return NextResponse.json(meta);
}
