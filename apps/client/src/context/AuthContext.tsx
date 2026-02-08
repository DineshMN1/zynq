'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi, type User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  needsSetup: boolean | null;
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  needsSetup: null,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch {
      // Token is invalid, clear it
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  }, []);

  // Initialize auth on mount only
  useEffect(() => {
    let canceled = false;

    const initializeAuth = async () => {
      try {
        const setupResponse = await authApi.getSetupStatus();
        if (canceled) return;
        setNeedsSetup(setupResponse.needsSetup);

        if (setupResponse.needsSetup) {
          setLoading(false);
          return;
        }

        const savedToken = localStorage.getItem('token');
        if (savedToken) {
          setToken(savedToken);
          try {
            const userData = await authApi.me();
            if (canceled) return;
            setUser(userData);
          } catch {
            if (canceled) return;
            localStorage.removeItem('token');
            setToken(null);
          }
        }
      } catch (error) {
        if (canceled) return;
        console.error('Failed to initialize auth:', error);
        setNeedsSetup(false);
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      canceled = true;
    };
  }, []);

  // Redirect to /setup when needed
  useEffect(() => {
    if (needsSetup && pathname !== '/setup') {
      router.replace('/setup');
    }
  }, [needsSetup, pathname, router]);

  const login = (user: User) => {
    if (user.token) {
      localStorage.setItem('token', user.token);
      setToken(user.token);
      setUser(user);
      setNeedsSetup(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, needsSetup, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
