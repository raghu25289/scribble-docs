import { NextResponse } from 'next/server';
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
  const body = await req.json();
  const { title, description, html, gated } = body || {};
  const patch: Partial<Doc> = {};
  if (typeof title === 'string') patch.title = title.slice(0, 200);
  if (typeof description === 'string') patch.description = description.slice(0, 500);
  if (typeof html === 'string') patch.html = html;
  if (typeof gated === 'boolean') patch.gated = gated;
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
