'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi, type User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  needsSetup: boolean | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  needsSetup: null,
  login: () => {},
  logout: () => {},
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

  // Check setup status and auth on initial load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, check if setup is needed
        const setupResponse = await authApi.checkSetupStatus();
        setNeedsSetup(setupResponse.needsSetup);

        if (setupResponse.needsSetup) {
          // If setup is needed and we're not on setup page, redirect
          if (pathname !== '/setup') {
            router.replace('/setup');
          }
          setLoading(false);
          return;
        }

        // Setup is complete, check for saved token
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
          setToken(savedToken);
          try {
            const userData = await authApi.me();
            setUser(userData);
          } catch {
            // Token is invalid, clear it
            localStorage.removeItem('token');
            setToken(null);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        // On error, assume no setup needed and continue
        setNeedsSetup(false);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [pathname, router]);

  const login = (user: User) => {
    if (user.token) {
      localStorage.setItem('token', user.token);
      setToken(user.token);
      setUser(user);
      setNeedsSetup(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, needsSetup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
