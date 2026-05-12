'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Gate({
  docId,
  title,
  description,
}: {
  docId: string;
  title: string;
  description?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return;
    setSubmitting(true);
    // Set cookies via document.cookie (lax, 30 days)
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `viewer_email_${docId}=${encodeURIComponent(email)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (name) {
      document.cookie = `viewer_name_${docId}=${encodeURIComponent(name)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-6">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Shared with you</div>
          <h1 className="text-xl font-medium">{title}</h1>
          {description && <p className="text-sm text-muted mt-1">{description}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">Name (optional)</label>
          <input
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? 'Opening…' : 'Continue'}
        </button>
        <p className="text-[10px] text-muted text-center">
          The sender can see when you open this and how long you spent reading.
        </p>
      </form>
    </div>
  );
}
