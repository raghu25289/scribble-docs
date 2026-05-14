import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createDoc, listDocsWithStats, type Doc } from '@/lib/kv';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const docs = await listDocsWithStats();
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { title, description, html, gated } = body || {};
  if (!title || !html) {
    return NextResponse.json({ error: 'title and html required' }, { status: 400 });
  }
  const doc: Doc = {
    id: nanoid(10),
    title: String(title).slice(0, 200),
    description: description ? String(description).slice(0, 500) : undefined,
    html: String(html),
    createdAt: Date.now(),
    gated: Boolean(gated),
    version: 1,
  };
  await createDoc(doc);
  const { html: _h, ...meta } = doc;
  return NextResponse.json(meta);
}
