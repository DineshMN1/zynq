import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user, loading, needsSetup } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (needsSetup) {
      navigate('/setup', { replace: true });
    } else if (user) {
      navigate('/dashboard/files', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [loading, user, needsSetup, navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
