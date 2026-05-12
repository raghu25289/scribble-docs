import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDoc } from '@/lib/kv';
import Gate from './Gate';
import Viewer from './Viewer';

export const dynamic = 'force-dynamic';

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDoc(id);
  if (!doc) notFound();

  const c = await cookies();
  const email = c.get(`viewer_email_${id}`)?.value;
  const name = c.get(`viewer_name_${id}`)?.value;

  if (doc.gated && !email) {
    return <Gate docId={id} title={doc.title} description={doc.description} />;
  }

  return <Viewer docId={id} html={doc.html} email={email} name={name} title={doc.title} />;
}
