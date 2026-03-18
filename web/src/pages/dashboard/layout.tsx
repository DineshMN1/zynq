import { useEffect } from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/Sidebar';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { UploadProvider } from '@/context/UploadContext';
import { UploadManagerPopup } from '@/components/UploadManagerPopup';

function DashboardHeader() {
  const { state, isMobile } = useSidebar();
  const showLogo = state === 'collapsed' || isMobile;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      {showLogo && (
        <>
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Link to="/dashboard/files" className="font-semibold text-sm">
            ZynqCloud
          </Link>
        </>
      )}
    </header>
  );
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

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
      <SidebarProvider className="min-h-0! h-screen overflow-hidden">
        <AppSidebar user={user} />
        <SidebarInset className="overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <UploadManagerPopup />
    </UploadProvider>
  );
}
