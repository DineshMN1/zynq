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
  HardDrive,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
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
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User, UpdateCheckResult } from '@/lib/api';
import { authApi, systemApi, storageApi } from '@/lib/api';
import { STORAGE_REFRESH_EVENT } from '@/lib/storage-events';
import { getInitials } from '@/lib/auth';
import { useTheme } from './ThemeProvider';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

interface AppSidebarProps {
  user: User | null;
}

type UpdateStep = 'idle' | 'pulling' | 'restarting' | 'done' | 'error';
type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = { id: string; label: string; items: NavItem[] };

// ── ZynqCloud Logo ─────────────────────────────────────────────────────────────
function ZynqLogo({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg bg-white flex items-center justify-center p-0.5"
    >
      <img
        src="/favicon.ico"
        alt="ZynqCloud"
        className="w-full h-full object-contain rounded-md"
      />
    </div>
  );
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStep, setUpdateStep] = useState<UpdateStep>('idle');
  const [diskTotal, setDiskTotal] = useState<number>(0);
  const [diskUsed, setDiskUsed] = useState<number>(0);
  const [localStorageUsed, setLocalStorageUsed] = useState<number>(user?.storage_used ?? 0);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';
  const updateAvailable = !!updateInfo?.hasUpdate;
  const latestVersion = updateInfo?.latest;

  const homeItems: NavItem[] = useMemo(() => [
    { href: '/dashboard/files', label: 'My Files',  icon: Files     },
    { href: '/dashboard/shared', label: 'Shared',   icon: Share2    },
    { href: '/dashboard/trash',  label: 'Trash',    icon: Trash2    },
    { href: '/team/files',       label: 'Team',     icon: Building2 },
  ], []);

  const settingsItems: NavItem[] = useMemo(() => [
    { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Hammer } as NavItem] : []),
  ], [isAdmin]);

  const navGroups: NavGroup[] = useMemo(() => [
    { id: 'home',     label: 'Home',     items: homeItems     },
    { id: 'settings', label: 'Settings', items: settingsItems },
  ], [homeItems, settingsItems]);

  useEffect(() => {
    systemApi.checkUpdate().then(setUpdateInfo).catch(() => {});
  }, []);

  const refreshStorage = useCallback(() => {
    const unlimited = !user?.storage_limit || user.storage_limit === 0;
    if (unlimited) {
      storageApi.getOverview().then((overview) => {
        setDiskTotal(overview.system.totalBytes);
        setDiskUsed(overview.system.usedBytes);
      }).catch(() => {});
    } else {
      authApi.me().then((u) => setLocalStorageUsed(u.storage_used ?? 0)).catch(() => {});
    }
  }, [user?.storage_limit]);

  // Initial fetch
  useEffect(() => { refreshStorage(); }, [refreshStorage]);

  // Update local storage used when user prop changes (e.g. after login)
  useEffect(() => { setLocalStorageUsed(user?.storage_used ?? 0); }, [user?.storage_used]);

  // Listen for upload/delete events to refresh storage display
  useEffect(() => {
    window.addEventListener(STORAGE_REFRESH_EVENT, refreshStorage);
    return () => window.removeEventListener(STORAGE_REFRESH_EVENT, refreshStorage);
  }, [refreshStorage]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    finally { navigate('/login'); }
  };

  const handleUpdate = async () => {
    setUpdateStep('pulling');
    try {
      await systemApi.triggerUpdate();
      setUpdateStep('restarting');
      const start = Date.now();
      const pollHealth = async (): Promise<void> => {
        if (Date.now() - start > 120_000) { setUpdateStep('error'); return; }
        try {
          const res = await fetch('/health', { cache: 'no-store' });
          if (res.ok) { setUpdateStep('done'); setTimeout(() => window.location.reload(), 2000); return; }
        } catch { /* still restarting */ }
        setTimeout(pollHealth, 2000);
      };
      setTimeout(pollHealth, 3000);
    } catch { setUpdateStep('error'); }
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* ── Update modal ── */}
      <AnimatePresence>
        {updateModalOpen && (
          <>
            <motion.div
              key="bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => { if (['idle','done','error'].includes(updateStep)) { setUpdateModalOpen(false); setUpdateStep('idle'); } }}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-background border border-border shadow-xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-semibold">Update Available</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">v{APP_VERSION} → v{latestVersion}</p>
                  </div>
                  {['idle','error'].includes(updateStep) && (
                    <button onClick={() => { setUpdateModalOpen(false); setUpdateStep('idle'); }} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {[
                    { step: 'pulling',    label: 'Pull latest image',   next: ['restarting','done'] },
                    { step: 'restarting', label: 'Restart container',   next: ['done'] },
                  ].map(({ step, label, next }) => {
                    const active = updateStep === step;
                    const done   = next.includes(updateStep) || updateStep === 'done';
                    return (
                      <div key={step} className={cn(
                        'flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors',
                        active && 'bg-blue-500/10 text-blue-500',
                        !active && done && 'text-muted-foreground',
                        !active && !done && 'text-muted-foreground/35',
                      )}>
                        {active ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                            <RefreshCw className="h-4 w-4" />
                          </motion.div>
                        ) : done ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-current" />
                        )}
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
                {updateStep === 'done' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-500 text-center">Done — reloading page…</motion.p>
                )}
                {updateStep === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4 shrink-0" />Update failed. Check server logs.
                  </div>
                )}
                {updateStep === 'idle' && (
                  <Button className="w-full" onClick={handleUpdate}>
                    <RefreshCw className="mr-2 h-4 w-4" />Update Now
                  </Button>
                )}
                {updateStep === 'error' && (
                  <Button variant="outline" className="w-full" onClick={() => setUpdateStep('idle')}>Retry</Button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <UISidebar collapsible="icon">

        {/* Header: Logo + workspace name */}
        <SidebarHeader className="border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                asChild
                tooltip="ZynqCloud"
                className="hover:bg-sidebar-accent/50"
              >
                <Link to="/dashboard/files">
                  <ZynqLogo size={32} />
                  <div className="flex flex-col min-w-0 flex-1 leading-none">
                    <span className="font-semibold text-[13.5px] truncate">ZynqCloud</span>
                    <span className="text-[11px] text-sidebar-foreground/50 capitalize truncate">
                      {user?.role ?? 'user'}
                    </span>
                  </div>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/40" />
                </Link>
              </SidebarMenuButton>
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
          {/* Update notice */}
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
          <SidebarMenu className="mb-1">
            <SidebarMenuItem>
              <Popover>
                <PopoverTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    tooltip={user?.name ?? 'Account'}
                  >
                    <Avatar className="h-7 w-7 shrink-0 rounded-lg">
                      <AvatarImage src={user?.avatar ?? undefined} alt={user?.name} className="rounded-lg object-cover" />
                      <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sidebar-foreground text-xs font-semibold">
                        {getInitials(user?.name ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                      <span className="block truncate font-semibold text-[13px] leading-tight">{user?.name}</span>
                      <span className="block truncate text-[11px] text-sidebar-foreground/50 leading-tight pb-px" title={user?.email}>{user?.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-sidebar-foreground/40" />
                  </SidebarMenuButton>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={6}
                  className="w-[--radix-popover-trigger-width] p-1.5 overflow-hidden
                    data-[state=open]:animate-in data-[state=closed]:animate-out
                    data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                    data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2
                    data-[state=open]:duration-200 data-[state=closed]:duration-150"
                >
                  {/* User identity */}
                  <div className="flex items-center gap-2.5 px-2.5 py-2.5 mb-1 rounded-lg bg-muted/50">
                    <Avatar className="h-9 w-9 rounded-lg shrink-0">
                      <AvatarImage src={user?.avatar ?? undefined} alt={user?.name} className="rounded-lg object-cover" />
                      <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-foreground text-sm font-semibold">
                        {getInitials(user?.name ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-tight truncate">{user?.name}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight truncate pb-px" title={user?.email}>{user?.email}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-[13px] rounded-lg mb-0.5" asChild>
                    <Link to="/dashboard/profile">
                      <UserIcon className="mr-2 h-3.5 w-3.5" />Profile
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-[13px] rounded-lg" onClick={toggleTheme}>
                    {theme === 'dark' ? (
                      <><Sun className="mr-2 h-3.5 w-3.5" />Light Mode</>
                    ) : (
                      <><Moon className="mr-2 h-3.5 w-3.5" />Dark Mode</>
                    )}
                  </Button>

                  {/* Divider + Sign out */}
                  <div className="my-1 h-px bg-border/60" />
                  <Button
                    variant="ghost" size="sm"
                    className="w-full justify-start h-8 text-[13px] rounded-lg text-red-500 hover:text-red-500 hover:bg-red-500/10"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />Sign Out
                  </Button>
                </PopoverContent>
              </Popover>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Storage usage */}
          {!collapsed && user != null && (
            <div className="px-2 pt-2 pb-2 space-y-2 border-t border-sidebar-border/50">
              {(() => {
                const limit = user.storage_limit ?? 0;
                const unlimited = limit === 0;
                const displayUsed = unlimited ? diskUsed : localStorageUsed;
                const displayTotal = unlimited ? diskTotal : limit;
                const pct = displayTotal > 0 ? Math.min(100, (displayUsed / displayTotal) * 100) : 0;
                const fmt = (b: number) => {
                  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
                  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
                  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
                  return `${b} B`;
                };
                const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-blue-500';
                return (
                  <>
                    <div className="flex items-center justify-between text-[10.5px] text-sidebar-foreground/50">
                      <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />Storage</span>
                      <span>{displayTotal > 0 ? `${fmt(displayUsed)} / ${fmt(displayTotal)}` : `${fmt(displayUsed)} used`}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-sidebar-accent overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {!collapsed && (
            <p className="px-2 pb-1 mt-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/30 text-center">
              v{APP_VERSION}
            </p>
          )}
        </SidebarFooter>

        <SidebarRail />
      </UISidebar>
    </>
  );
}
