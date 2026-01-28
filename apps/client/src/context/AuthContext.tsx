'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    // Load saved token if page refreshes
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      authApi
        .me()
        .then((data) => setUser(data))
        .catch(() => logout());
    }
  }, [logout]);

  const login = (user: User) => {
    if (user.token) {
      localStorage.setItem('token', user.token);
      setToken(user.token);
      setUser(user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
