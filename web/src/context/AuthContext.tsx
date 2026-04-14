// @refresh reset
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi, saveAuthToken, clearAuthToken, type User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  needsSetup: boolean | null;
  login: (user: User & { token?: string }) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  needsSetup: null,
  login: (_user) => {},
  logout: () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const logout = useCallback(() => {
    clearAuthToken();
    authApi.logout().catch(() => {});
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch {
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

        try {
          const userData = await authApi.me();
          if (canceled) return;
          setUser(userData);
        } catch {
          if (canceled) return;
          setUser(null);
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
      navigate('/setup', { replace: true });
    }
  }, [needsSetup, pathname, navigate]);

  const login = (userData: User & { token?: string }) => {
    if (userData.token) {
      saveAuthToken(userData.token);
    }
    // Strip the token field before storing in state
    const { token: _token, ...user } = userData;
    setUser(user as User);
    setNeedsSetup(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, needsSetup, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
