import { NextRequest, NextResponse } from 'next/server';
import { recordOpen, updateView, getDoc } from '@/lib/kv';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, sessionId, docId, email, name, maxScroll, duration } = body || {};

  if (!sessionId || !docId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // Validate doc exists
  const doc = await getDoc(docId);
  if (!doc) return NextResponse.json({ error: 'doc not found' }, { status: 404 });

  const now = Date.now();
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    undefined;
  const ua = req.headers.get('user-agent') || undefined;
  // Vercel injects geo headers
  const country = req.headers.get('x-vercel-ip-country') || undefined;
  const city = req.headers.get('x-vercel-ip-city') || undefined;

  if (action === 'open') {
    await recordOpen({
      sessionId,
      docId,
      email,
      name,
      openedAt: now,
      lastSeenAt: now,
      maxScroll: 0,
      duration: 0,
      ip,
      ua,
      country,
      city: city ? decodeURIComponent(city) : undefined,
    });
  } else if (action === 'heartbeat') {
    await updateView(sessionId, {
      lastSeenAt: now,
      maxScroll: Number(maxScroll) || 0,
      duration: Number(duration) || 0,
    });
  } else if (action === 'close') {
    await updateView(sessionId, {
      lastSeenAt: now,
      closedAt: now,
      maxScroll: Number(maxScroll) || 0,
      duration: Number(duration) || 0,
    });
  }

  return NextResponse.json({ ok: true });
}
