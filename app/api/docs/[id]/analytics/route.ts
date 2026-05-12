import { NextResponse } from 'next/server';
import { getViews } from '@/lib/kv';
import { isAdmin } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const views = await getViews(id);
  return NextResponse.json({ views });
}
