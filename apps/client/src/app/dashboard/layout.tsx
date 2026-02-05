'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { authApi, type User } from '@/lib/api';
import { Loader2 } from 'lucide-react';

/**
 * Layout that enforces authentication and renders the dashboard UI for an authenticated user.
 *
 * While mounting, the component verifies the current user; it shows a centered loading indicator during verification,
 * redirects to `/login` if authentication fails, and renders nothing if no user is present after loading.
 *
 * @param children - Content to display in the main dashboard area to the right of the sidebar.
 * @returns The dashboard layout element when a user is authenticated, `null` when unauthenticated, or a loading indicator element while authentication is in progress.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authApi.me();
        setUser(userData);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}