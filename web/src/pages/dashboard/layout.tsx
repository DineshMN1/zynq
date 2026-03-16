import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';
import { UploadProvider } from '@/context/UploadContext';
import { UploadManagerPopup } from '@/components/UploadManagerPopup';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

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
    <UploadProvider>
      <div className="h-screen flex overflow-hidden bg-background">
        <Sidebar user={user} />
        <main
          className={`flex-1 overflow-auto transition-colors duration-200 ${isMobile ? 'pt-14' : ''}`}
        >
          <Outlet />
        </main>
      </div>
      <UploadManagerPopup />
    </UploadProvider>
  );
}
