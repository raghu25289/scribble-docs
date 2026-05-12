import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { listDocsWithStats } from '@/lib/kv';
import Dashboard from './Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!(await isAdmin())) {
    redirect('/login');
  }
  const docs = await listDocsWithStats();
  return <Dashboard initialDocs={docs} />;
}
