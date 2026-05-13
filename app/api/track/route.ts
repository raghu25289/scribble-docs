import { NextRequest, NextResponse } from 'next/server';
import { recordOpen, updateView, getDoc, getView } from '@/lib/kv';

const SECTION_DWELL_CAP_MS = 30 * 60 * 1000;

function notifyDiscord(payload: {
  doc: { id: string; title: string };
  email?: string;
  city?: string;
  country?: string;
}) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const body = {
    embeds: [
      {
        title: 'New doc view',
        description: `**${payload.doc.title}** was just opened`,
        color: 12910336,
        fields: [
          { name: 'Viewer', value: payload.email || 'Anonymous', inline: true },
          {
            name: 'Location',
            value: [payload.city, payload.country].filter(Boolean).join(', ') || 'Unknown',
            inline: true,
          },
          { name: 'Doc ID', value: payload.doc.id, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // swallow
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, sessionId, docId, email, name, maxScroll, duration, id, dwell } = body || {};

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
  const cityRaw = req.headers.get('x-vercel-ip-city') || undefined;
  const city = cityRaw ? decodeURIComponent(cityRaw) : undefined;

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
      city,
    });
    notifyDiscord({ doc: { id: docId, title: doc.title }, email, city, country });
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
  } else if (action === 'section') {
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'missing section id' }, { status: 400 });
    }
    const addDwell = Math.min(Math.max(Number(dwell) || 0, 0), SECTION_DWELL_CAP_MS);
    if (addDwell > 0) {
      const existing = await getView(sessionId);
      if (existing) {
        const sections = { ...(existing.sections || {}) };
        sections[id] = Math.min((sections[id] || 0) + addDwell, SECTION_DWELL_CAP_MS);
        await updateView(sessionId, { sections, lastSeenAt: now });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
