import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Files,
  Share2,
  Trash2,
  LogOut,
  User as UserIcon,
  Moon,
  Sun,
  Hammer,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronsUpDown,
  Building2,
  Bell,
  HardDrive,
} from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverBody,
  PopoverFooter,
} from './ui/popover';
import { Button } from './ui/button';
import {
  Sidebar as UISidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from './ui/sidebar';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User, UpdateCheckResult } from '@/lib/api';
import { authApi, systemApi } from '@/lib/api';
import { getInitials } from '@/lib/auth';
import { useTheme } from './ThemeProvider';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

interface AppSidebarProps {
  user: User | null;
}

type UpdateStep = 'idle' | 'pulling' | 'restarting' | 'done' | 'error';

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export function AppSidebar({ user }: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStep, setUpdateStep] = useState<UpdateStep>('idle');

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';
  const updateAvailable = !!updateInfo?.hasUpdate;
  const latestVersion = updateInfo?.latest;

  const homeItems: NavItem[] = useMemo(
    () => [
      { href: '/dashboard/files', label: 'My Files', icon: Files },
      { href: '/dashboard/shared', label: 'Shared', icon: Share2 },
      { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
      { href: '/team/files', label: 'Team', icon: Building2 },
    ],
    [],
  );

  const settingsItems: NavItem[] = useMemo(
    () => [
      { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
      ...(isAdmin
        ? [{ href: '/admin', label: 'Admin', icon: Hammer } as NavItem]
        : []),
    ],
    [isAdmin],
  );

  const navGroups: NavGroup[] = useMemo(
    () => [
      { id: 'home', label: 'Home', items: homeItems },
      { id: 'settings', label: 'Settings', items: settingsItems },
    ],
    [homeItems, settingsItems],
  );

  useEffect(() => {
    systemApi.checkUpdate().then(setUpdateInfo).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    } finally {
      navigate('/login');
    }
  };

  const handleUpdate = async () => {
    setUpdateStep('pulling');
    try {
      await systemApi.triggerUpdate();
      setUpdateStep('restarting');
      const start = Date.now();
      const pollHealth = async (): Promise<void> => {
        if (Date.now() - start > 120_000) {
          setUpdateStep('error');
          return;
        }
        try {
          const res = await fetch('/health', { cache: 'no-store' });
          if (res.ok) {
            setUpdateStep('done');
            setTimeout(() => window.location.reload(), 2000);
            return;
          }
        } catch {
          // still restarting
        }
        setTimeout(pollHealth, 2000);
      };
      setTimeout(pollHealth, 3000);
    } catch {
      setUpdateStep('error');
    }
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Update modal */}
      <AnimatePresence>
        {updateModalOpen && (
          <>
            <motion.div
              key="bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => {
                if (updateStep === 'idle' || updateStep === 'done' || updateStep === 'error') {
                  setUpdateModalOpen(false);
                  setUpdateStep('idle');
                }
              }}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-background border border-border shadow-xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-semibold">Update Available</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      v{APP_VERSION} → v{latestVersion}
                    </p>
                  </div>
                  {(updateStep === 'idle' || updateStep === 'error') && (
                    <button
                      onClick={() => {
                        setUpdateModalOpen(false);
                        setUpdateStep('idle');
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <div
                    className={cn(
                      'flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors',
                      updateStep === 'pulling' && 'bg-blue-500/10 text-blue-500',
                      (updateStep === 'restarting' || updateStep === 'done') && 'text-muted-foreground',
                      updateStep === 'idle' && 'text-muted-foreground/50',
                    )}
                  >
                    {updateStep === 'pulling' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                        <RefreshCw className="h-4 w-4" />
                      </motion.div>
                    ) : updateStep === 'restarting' || updateStep === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-current" />
                    )}
                    <span>Pull latest image</span>
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors',
                      updateStep === 'restarting' && 'bg-blue-500/10 text-blue-500',
                      updateStep === 'done' && 'text-muted-foreground',
                      (updateStep === 'idle' || updateStep === 'pulling') && 'text-muted-foreground/35',
                    )}
                  >
                    {updateStep === 'restarting' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                        <RefreshCw className="h-4 w-4" />
                      </motion.div>
                    ) : updateStep === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-current" />
                    )}
                    <span>Restart container</span>
                  </div>
                </div>
                {updateStep === 'done' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-500 text-center">
                    Done — reloading page…
                  </motion.p>
                )}
                {updateStep === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Update failed. Check server logs.
                  </div>
                )}
                {updateStep === 'idle' && (
                  <Button className="w-full" onClick={handleUpdate}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update Now
                  </Button>
                )}
                {updateStep === 'error' && (
                  <Button variant="outline" className="w-full" onClick={() => setUpdateStep('idle')}>
                    Retry
                  </Button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <UISidebar collapsible="icon">
        {/* Header: Workspace selector */}
        <SidebarHeader className="border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-1 px-1 py-1.5">
                <SidebarMenuButton
                  size="lg"
                  className="flex-1 data-[state=open]:bg-sidebar-accent"
                  tooltip="ZynqCloud"
                  asChild
                >
                  <Link to="/dashboard/files">
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/10">
                      <HardDrive className="size-4 text-sidebar-primary" />
                    </div>
                    <div className="flex flex-1 flex-col gap-0 leading-none min-w-0">
                      <span className="font-semibold text-[14px] truncate">ZynqCloud</span>
                      <span className="text-[11px] text-sidebar-foreground/50 truncate">
                        {user?.role ?? 'user'}
                      </span>
                    </div>
                    <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/40" />
                  </Link>
                </SidebarMenuButton>
                {!collapsed && (
                  <button
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="size-4" />
                    {updateAvailable && (
                      <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </button>
                )}
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Nav groups */}
        <SidebarContent>
          {navGroups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        tooltip={item.label}
                      >
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
          ))}
        </SidebarContent>

        {/* Footer: Account */}
        <SidebarFooter className="border-t border-sidebar-border">
          {/* Update button */}
          {!collapsed && isOwner && updateAvailable && latestVersion && (
            <button
              onClick={() => setUpdateModalOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              Update to v{latestVersion}
            </button>
          )}
          {collapsed && updateAvailable && (
            <div className="flex justify-center py-1">
              <button
                onClick={isOwner ? () => setUpdateModalOpen(true) : undefined}
                className={cn('flex items-center justify-center h-4', isOwner && 'cursor-pointer')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 block" />
              </button>
            </div>
          )}

          {/* Account row */}
          <SidebarMenu>
            <SidebarMenuItem>
              <Popover>
                <PopoverTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    tooltip={user?.name ?? 'Account'}
                  >
                    <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sidebar-foreground text-xs font-semibold">
                        {getInitials(user?.name ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                      <span className="truncate font-semibold">{user?.name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/50">{user?.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 text-sidebar-foreground/40" />
                  </SidebarMenuButton>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  className="w-64 p-0"
                >
                  <PopoverHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 rounded-lg shrink-0">
                        <AvatarFallback className="rounded-lg bg-muted text-foreground text-sm font-semibold">
                          {getInitials(user?.name ?? '')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <PopoverTitle className="text-[13.5px] truncate">
                          {user?.name}
                        </PopoverTitle>
                        <PopoverDescription className="text-[11px] truncate">
                          {user?.email}
                        </PopoverDescription>
                      </div>
                    </div>
                  </PopoverHeader>
                  <PopoverBody className="space-y-0.5 px-2 py-1.5">
                    <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                      <Link to="/dashboard/profile">
                        <UserIcon className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={toggleTheme}
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="mr-2 h-4 w-4" />
                          Light Mode
                        </>
                      ) : (
                        <>
                          <Moon className="mr-2 h-4 w-4" />
                          Dark Mode
                        </>
                      )}
                    </Button>
                  </PopoverBody>
                  <PopoverFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-transparent text-red-500 hover:text-red-500 border-red-500/20 hover:bg-red-500/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </PopoverFooter>
                </PopoverContent>
              </Popover>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Version */}
          {!collapsed && (
            <p className="px-2 pb-1 text-[11px] text-sidebar-foreground/30 text-center">
              Version v{APP_VERSION}
            </p>
          )}
        </SidebarFooter>

        <SidebarRail />
      </UISidebar>
    </>
  );
}
