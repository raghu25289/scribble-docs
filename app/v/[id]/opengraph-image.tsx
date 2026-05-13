import { ImageResponse } from 'next/og';
import { getDoc } from '@/lib/kv';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Scribble Docs';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDoc(id);

  if (!doc) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 64,
            fontWeight: 600,
          }}
        >
          Scribble Docs
        </div>
      ),
      size,
    );
  }

  const description = doc.description || 'A document shared with you via Scribble Docs.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 60,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#c4ff00',
            }}
          />
          <div style={{ fontSize: 24, color: '#737373', fontWeight: 500 }}>
            Scribble Docs
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 64,
              color: '#ffffff',
              fontWeight: 600,
              lineHeight: 1.15,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {doc.title}
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#a3a3a3',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: 20,
            color: '#c4ff00',
          }}
        >
          scribble.network
        </div>
      </div>
    ),
    size,
  );
}
