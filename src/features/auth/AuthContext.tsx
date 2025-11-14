import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { findAccountByEmail, type DemoAccount } from './accounts';
import { clearSession, loadSession, persistSession } from '../../services/auth/sessionService';

type AuthContextValue = {
  user: DemoAccount | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticating: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<DemoAccount | null>(null);
  const [isAuthenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = typeof window !== 'undefined' ? loadSession() : null;
    if (storedEmail) {
      const account = findAccountByEmail(storedEmail);
      if (account) {
        setUser(account);
      } else {
        clearSession();
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAuthenticating(true);
    setError(null);
    try {
      const account = findAccountByEmail(email);
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!account || account.password !== password) {
        throw new Error('メールアドレスまたはパスワードが正しくありません。');
      }
      setUser(account);
      persistSession(account.email);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ログインに失敗しました。';
      setError(message);
      throw err;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearSession();
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isAuthenticating,
      error
    }),
    [error, isAuthenticating, login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
