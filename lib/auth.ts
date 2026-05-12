import { cookies } from 'next/headers';

const COOKIE = 'ds_admin';

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  const v = c.get(COOKIE)?.value;
  return v === process.env.ADMIN_PASSWORD;
}

export function adminCookieName() {
  return COOKIE;
}
