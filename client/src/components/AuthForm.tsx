import { useState } from 'react';

export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  footer,
}: {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => Promise<void>;
  footer: React.ReactNode;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const field =
    'w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-muted focus:border-muted';

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          await onSubmit(email, password);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
          setBusy(false);
        }
      }}
      className="animate-rise mx-auto mt-12 w-full max-w-sm rounded-lg border border-edge bg-panel p-6"
    >
      <h1 className="mb-5 text-lg font-semibold text-white">{title}</h1>

      <label className="mb-1 block text-xs text-muted" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`${field} mb-4`}
        placeholder="you@example.com"
      />

      <label className="mb-1 block text-xs text-muted" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        required
        minLength={8}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={field}
        placeholder="At least 8 characters"
      />

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-md bg-white py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Working…' : submitLabel}
      </button>

      <p className="mt-4 text-center text-xs text-muted">{footer}</p>
    </form>
  );
}
