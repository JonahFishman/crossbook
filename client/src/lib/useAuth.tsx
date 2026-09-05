import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // One /me call on mount tells us whether the session cookie is still good.
  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser((await api.login(email, password)).user);
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    setUser((await api.register(email, password)).user);
  }, []);
  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
