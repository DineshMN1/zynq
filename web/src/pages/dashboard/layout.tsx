import { useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/Sidebar';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { UploadProvider } from '@/context/UploadContext';
import { UploadManagerPopup } from '@/components/UploadManagerPopup';

// Map routes to page names for the breadcrumb
const PAGE_NAMES: Record<string, string> = {
  '/dashboard/files':    'My Files',
  '/dashboard/shared':   'Shared',
  '/dashboard/trash':    'Trash',
  '/dashboard/profile':  'Profile',
  '/dashboard/settings': 'Settings',
  '/team/files':         'Team Files',
  '/team/members':       'Members',
  '/team/activity':      'Activity',
  '/admin':              'Admin',
  '/admin/users':        'Users',
  '/admin/notifications':'Notifications',
  '/admin/monitoring':   'Monitoring',
};

function getPageName(pathname: string): string {
  // Exact match first
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname];
  // Prefix match (longest first)
  const match = Object.keys(PAGE_NAMES)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_NAMES[match] : 'ZynqCloud';
}

function DashboardHeader() {
  const { pathname } = useLocation();
  const pageName = getPageName(pathname);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <span className="text-sm font-medium text-foreground/80">{pageName}</span>
    </header>
  );
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <UploadProvider>
      <SidebarProvider defaultOpen={true} className="min-h-0! h-screen overflow-hidden">
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
