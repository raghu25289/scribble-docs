'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Wrong password.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <div className="w-3 h-3 bg-accent rounded-full mx-auto mb-3" />
          <h1 className="text-lg font-medium">Scribble Docs</h1>
          <p className="text-xs text-muted mt-1">Admin access</p>
        </div>
        <input
          type="password"
          className="input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
