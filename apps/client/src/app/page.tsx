'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, loading, needsSetup } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (needsSetup) {
      router.replace('/setup');
    } else if (user) {
      router.replace('/dashboard/files');
    } else {
      router.replace('/login');
    }
  }, [loading, user, needsSetup, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
