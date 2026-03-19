import { useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Sidebar as UISidebar,
  SidebarProvider,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  Files,
  Image,
  FileText,
  Video,
  Music,
  Code2,
  File,
  Clock,
  Users2,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { UploadProvider } from '@/context/UploadContext';
import { UploadManagerPopup } from '@/components/UploadManagerPopup';

const FILE_NAV = [
  { href: '/team/files', label: 'All Files', icon: Files },
  { href: '/team/photos', label: 'Photos', icon: Image },
  { href: '/team/docs', label: 'Docs', icon: FileText },
  { href: '/team/videos', label: 'Videos', icon: Video },
  { href: '/team/audio', label: 'Audio', icon: Music },
  { href: '/team/code', label: 'Code', icon: Code2 },
  { href: '/team/others', label: 'Others', icon: File },
];

export default function TeamLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

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

  if (!user) return null;

  return (
    <UploadProvider>
    <SidebarProvider className="min-h-0! h-screen overflow-hidden">
      <UISidebar collapsible="none" className="border-r">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="size-4 text-primary" />
            </div>
            <span className="font-semibold text-[15px]">Team</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {FILE_NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link to={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/team/activity'}>
                    <Link to="/team/activity">
                      <Clock />
                      <span>Activity</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/team/members'}>
                      <Link to="/team/members">
                        <Users2 />
                        <span>Members</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/dashboard/files">
                  <ArrowLeft />
                  <span>Back to Home</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </UISidebar>

      <SidebarInset className="overflow-hidden">
        <main className="flex-1 overflow-auto h-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
    <UploadManagerPopup />
    </UploadProvider>
  );
}
