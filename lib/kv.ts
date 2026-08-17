import { Redis } from '@upstash/redis';
import { del } from '@vercel/blob';

export const redis = Redis.fromEnv();

export type Doc = {
  id: string;
  title: string;
  description?: string;
  kind: 'html' | 'pdf';
  html?: string; // only for kind === 'html'
  pdfUrl?: string; // only for kind === 'pdf'
  pdfPages?: number; // only for kind === 'pdf'
  createdAt: number;
  gated: boolean;
  version: number;
  updatedAt?: number;
};

export type View = {
  sessionId: string;
  docId: string;
  email?: string;
  name?: string;
  openedAt: number;
  lastSeenAt: number;
  closedAt?: number;
  maxScroll: number; // 0..100
  duration: number; // seconds
  ip?: string;
  ua?: string;
  country?: string;
  city?: string;
  sections?: Record<string, number>;
  pagesViewed?: Record<number, number>; // pageNumber -> total dwell ms
  maxPage?: number;
  docVersion?: number;
};

const DOC = (id: string) => `doc:${id}`;
const DOC_INDEX = 'docs:index';
const VIEW = (sid: string) => `view:${sid}`;
const DOC_VIEWS = (id: string) => `doc:${id}:views`;

function normalizeDoc(d: Doc): Doc {
  return d.kind ? d : { ...d, kind: 'html' };
}

export async function createDoc(doc: Doc) {
  await redis.set(DOC(doc.id), doc);
  await redis.zadd(DOC_INDEX, { score: doc.createdAt, member: doc.id });
  return doc;
}

export async function getDoc(id: string): Promise<Doc | null> {
  const d = await redis.get<Doc>(DOC(id));
  return d ? normalizeDoc(d) : null;
}

export async function updateDoc(id: string, patch: Partial<Doc>): Promise<Doc | null> {
  const existing = await getDoc(id);
  if (!existing) return null;
  const currentVersion = existing.version ?? 1;
  const htmlChanged = typeof patch.html === 'string' && patch.html !== existing.html;
  const pdfChanged = typeof patch.pdfUrl === 'string' && patch.pdfUrl !== existing.pdfUrl;
  const merged: Doc = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    version: htmlChanged || pdfChanged ? currentVersion + 1 : currentVersion,
    updatedAt: Date.now(),
  };
  await redis.set(DOC(id), merged);
  return merged;
}

export async function deleteDoc(id: string) {
  const doc = await getDoc(id);
  if (doc?.kind === 'pdf' && doc.pdfUrl) {
    await del(doc.pdfUrl).catch(() => {});
  }
  const sids = (await redis.lrange<string>(DOC_VIEWS(id), 0, -1)) ?? [];
  if (sids.length) {
    await Promise.all(sids.map((s) => redis.del(VIEW(s))));
  }
  await redis.del(DOC_VIEWS(id));
  await redis.del(DOC(id));
  await redis.zrem(DOC_INDEX, id);
}

export async function listDocs(): Promise<Doc[]> {
  const ids = (await redis.zrange<string[]>(DOC_INDEX, 0, -1, { rev: true })) ?? [];
  if (!ids.length) return [];
  const docs = await Promise.all(ids.map((id) => redis.get<Doc>(DOC(id))));
  return docs.filter(Boolean).map((d) => normalizeDoc(d as Doc));
}

export async function listDocsWithStats(): Promise<(Doc & { viewCount: number; lastViewedAt?: number })[]> {
  const docs = await listDocs();
  const stats = await Promise.all(
    docs.map(async (d) => {
      const sids = (await redis.lrange<string>(DOC_VIEWS(d.id), 0, -1)) ?? [];
      const count = sids.length;
      let lastViewedAt: number | undefined;
      if (count > 0) {
        const last = await redis.get<View>(VIEW(sids[0]));
        lastViewedAt = last?.lastSeenAt ?? last?.openedAt;
      }
      return { ...d, viewCount: count, lastViewedAt };
    })
  );
  return stats;
}

export async function recordOpen(view: View) {
  await redis.set(VIEW(view.sessionId), view);
  await redis.lpush(DOC_VIEWS(view.docId), view.sessionId);
}

export async function updateView(sessionId: string, patch: Partial<View>) {
  const existing = await redis.get<View>(VIEW(sessionId));
  if (!existing) return;
  const merged: View = { ...existing, ...patch };
  await redis.set(VIEW(sessionId), merged);
}

export async function getView(sessionId: string): Promise<View | null> {
  const v = await redis.get<View>(VIEW(sessionId));
  return v ?? null;
}

export async function getViews(docId: string): Promise<View[]> {
  const sids = (await redis.lrange<string>(DOC_VIEWS(docId), 0, -1)) ?? [];
  if (!sids.length) return [];
  const views = await Promise.all(sids.map((s) => redis.get<View>(VIEW(s))));
  return views.filter(Boolean) as View[];
}
