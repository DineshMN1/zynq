import { useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Sidebar as UISidebar,
  SidebarProvider,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
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
  User as UserIcon,
  Hammer,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { UploadProvider } from '@/context/UploadContext';
import { UploadManagerPopup } from '@/components/UploadManagerPopup';
import { useTheme } from '@/components/ThemeProvider';
import { getInitials } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { NavItem, SectionLabel, IconAction, RoleBadge, NavTooltip } from '@/components/sidebar-primitives';

const FILE_NAV = [
  { href: '/team/files',   label: 'All Files', icon: Files    },
  { href: '/team/photos',  label: 'Photos',    icon: Image    },
  { href: '/team/docs',    label: 'Docs',      icon: FileText },
  { href: '/team/videos',  label: 'Videos',    icon: Video    },
  { href: '/team/audio',   label: 'Audio',     icon: Music    },
  { href: '/team/code',    label: 'Code',      icon: Code2    },
  { href: '/team/others',  label: 'Others',    icon: File     },
];

const SPACE_NAV = [
  { href: '/team/activity', label: 'Activity', icon: Clock  },
  { href: '/team/members',  label: 'Members',  icon: Users2 },
];

function TeamSidebarInner({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const generalNav = [
    { href: '/dashboard/profile', label: 'Profile',     icon: UserIcon },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin Panel', icon: Hammer }] : []),
  ];

  return (
    <UISidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">

      {/* ── Header ── */}
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3">
        <div className={cn('flex items-center gap-2', collapsed && 'flex-col gap-2')}>
          <Link
            to="/team/files"
            className={cn(
              'flex flex-1 min-w-0 items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent/40',
              collapsed && 'justify-center flex-none',
            )}
          >
            <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <span className="text-[13.5px] font-bold tracking-tight text-sidebar-foreground truncate">
                Team
              </span>
            )}
          </Link>

          <button
            onClick={toggleSidebar}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />
            }
          </button>
        </div>
      </SidebarHeader>

      {/* ── Nav ── */}
      <SidebarContent className="px-2 py-1 overflow-y-auto">

        <SectionLabel label="Files" collapsed={collapsed} />
        <nav className="space-y-0.5">
          {FILE_NAV.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
          ))}
        </nav>

        <SectionLabel label="Space" collapsed={collapsed} />
        <nav className="space-y-0.5">
          {SPACE_NAV.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
          ))}
        </nav>

        <SectionLabel label="General" collapsed={collapsed} />
        <nav className="space-y-0.5">
          {generalNav.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
          ))}
        </nav>

      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-0">

        {/* Back to home */}
        <div className="p-2">
          <NavTooltip label="Back to Home" collapsed={collapsed}>
            <Link
              to="/dashboard/files"
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors',
                collapsed && 'justify-center px-2',
              )}
            >
              <ArrowLeft className={cn('shrink-0', collapsed ? 'h-4.5 w-4.5' : 'h-4 w-4')} strokeWidth={1.8} />
              {!collapsed && <span>Back to Home</span>}
            </Link>
          </NavTooltip>
        </div>

        {/* User row */}
        <div className={cn(
          'flex items-center gap-2.5 border-t border-sidebar-border/60 p-3',
          collapsed && 'flex-col gap-2 items-center',
        )}>
          <NavTooltip label={user.name ?? 'Account'} collapsed={collapsed}>
            <Link to="/dashboard/profile" className="shrink-0">
              <Avatar className="h-8 w-8 rounded-lg ring-2 ring-sidebar-border hover:ring-primary/40 transition-all">
                <AvatarImage src={user.avatar ?? undefined} alt={user.name} className="rounded-lg object-cover" />
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-[11px] font-bold">
                  {getInitials(user.name ?? '')}
                </AvatarFallback>
              </Avatar>
            </Link>
          </NavTooltip>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-sidebar-foreground leading-tight">
                    {user.name}
                  </p>
                  <RoleBadge role={user.role ?? 'user'} />
                </div>
                <p className="truncate text-[11px] text-sidebar-foreground/40 leading-tight mt-0.5" title={user.email}>
                  {user.email}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <IconAction
                  icon={theme === 'dark' ? Sun : Moon}
                  label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  onClick={toggleTheme}
                />
                <IconAction icon={LogOut} label="Sign out" onClick={logout} danger />
              </div>
            </>
          )}

          {collapsed && (
            <>
              <IconAction
                icon={theme === 'dark' ? Sun : Moon}
                label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                onClick={toggleTheme}
              />
              <IconAction icon={LogOut} label="Sign out" onClick={logout} danger />
            </>
          )}
        </div>
      </SidebarFooter>
    </UISidebar>
  );
}

export default function TeamLayout() {
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
      <TooltipProvider delayDuration={0}>
        <SidebarProvider className="min-h-0! h-screen overflow-hidden">
          <TeamSidebarInner user={user} />
          <SidebarInset className="overflow-hidden">
            <main className="flex-1 overflow-auto h-full">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
      <UploadManagerPopup />
    </UploadProvider>
  );
}
