import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Files,
  Share2,
  Trash2,
  Settings,
  Users,
  Bell,
  LogOut,
  User as UserIcon,
  Moon,
  Sun,
  Activity,
  Menu,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User, UpdateCheckResult, StorageOverview } from '@/lib/api';
import { storageApi, authApi, systemApi } from '@/lib/api';
import { formatBytes, getInitials } from '@/lib/auth';
import { STORAGE_REFRESH_EVENT } from '@/lib/storage-events';
import { useTheme } from './ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

interface SidebarProps {
  user: User | null;
}

type UpdateStep = 'idle' | 'pulling' | 'restarting' | 'done' | 'error';

export function Sidebar({ user }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageOverview | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStep, setUpdateStep] = useState<UpdateStep>('idle');
  const isMobile = useIsMobile();

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';
  const updateAvailable = !!updateInfo?.hasUpdate;
  const latestVersion = updateInfo?.latest;
  const usedPercentage = storageInfo?.user.usedPercentage || 0;
  const isUnlimited = storageInfo?.user.isUnlimited;

  useEffect(() => {
    if (user) void loadStorageInfo();
  }, [user]);

  useEffect(() => {
    systemApi
      .checkUpdate()
      .then(setUpdateInfo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cb = () => {
      if (user) void loadStorageInfo();
    };
    window.addEventListener(STORAGE_REFRESH_EVENT, cb);
    return () => window.removeEventListener(STORAGE_REFRESH_EVENT, cb);
  }, [user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const loadStorageInfo = async () => {
    try {
      setLoadingStorage(true);
      setStorageInfo(await storageApi.getOverview());
    } catch {
      /* ignore */
    } finally {
      setLoadingStorage(false);
    }
  };

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

      // Poll /health every 2 s (up to 120 s) instead of using a fixed timer.
      // The container may come back faster or slower than 8 s depending on
      // image size and host load. A real health check avoids both false "done"
      // (page reloaded before service is ready) and unnecessary 8 s waits.
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
          // Container still restarting — keep polling.
        }
        setTimeout(pollHealth, 2000);
      };
      // Give the container a 3 s head-start before the first health check.
      setTimeout(pollHealth, 3000);
    } catch {
      setUpdateStep('error');
    }
  };

  // ── Nav link definitions ────────────────────────────────────────────────────
  const mainLinks = [
    { href: '/dashboard/files', label: 'All Files', icon: Files },
    { href: '/dashboard/shared', label: 'Shared', icon: Share2 },
    { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
  ];

  const settingsLinks = [
    { href: '/dashboard/settings', label: 'Preferences', icon: Settings },
    { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
  ];

  const adminLinks = isAdmin
    ? [
        { href: '/dashboard/settings/users', label: 'Users', icon: Users },
        {
          href: '/dashboard/settings/notifications',
          label: 'Notifications',
          icon: Bell,
        },
        {
          href: '/dashboard/settings/monitoring',
          label: 'Monitoring',
          icon: Activity,
        },
      ]
    : [];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  // ── Sub-components ──────────────────────────────────────────────────────────

  /** Single navigation item. Wraps in tooltip when sidebar is collapsed. */
  const NavItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
  }) => {
    const active = isActive(href);
    const showLabel = isMobile || !collapsed;

    const inner = (
      <Link
        to={href}
        className={cn(
          'flex items-center gap-3 px-3 rounded-lg transition-colors',
          showLabel ? 'py-2.5' : 'py-2 justify-center',
          active
            ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
            : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {showLabel && (
          <span className="text-[14px] font-medium leading-none">{label}</span>
        )}
      </Link>
    );

    if (showLabel) return inner;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  /** Thin group separator with optional label (Dokploy "Extra" style). */
  const GroupLabel = ({ title }: { title: string }) =>
    isMobile || !collapsed ? (
      <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold text-sidebar-foreground/45 select-none uppercase tracking-wider">
        {title}
      </p>
    ) : (
      <div className="my-3 border-t border-sidebar-border mx-3" />
    );

  // ── Sidebar body ────────────────────────────────────────────────────────────
  const sidebarContent = (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200',
        isMobile ? 'w-full' : collapsed ? 'w-[60px]' : 'w-[256px]',
      )}
    >
      {/* ── Header — logo only, no toggle inside ── */}
      <div
        className={cn(
          'h-14 shrink-0 flex items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        {collapsed ? (
          <Link to="/dashboard/files">
            <div className="h-7 w-7 rounded-md bg-white border border-sidebar-border flex items-center justify-center overflow-hidden">
              <img
                src="/favicon.ico"
                alt="logo"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
          </Link>
        ) : (
          <Link
            to="/dashboard/files"
            className="flex items-center gap-2.5 min-w-0"
          >
            <div className="h-7 w-7 rounded-md bg-white border border-sidebar-border flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="/favicon.ico"
                alt="logo"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <span className="font-semibold text-[15px] text-sidebar-foreground truncate">
              ZynqCloud
            </span>
          </Link>
        )}
      </div>

      {/* ── Navigation (scrollable) ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {mainLinks.map((l) => (
          <NavItem key={l.href} {...l} />
        ))}

        <GroupLabel title="Settings" />
        {settingsLinks.map((l) => (
          <NavItem key={l.href} {...l} />
        ))}

        {isAdmin && adminLinks.length > 0 && (
          <>
            <GroupLabel title="Admin" />
            {adminLinks.map((l) => (
              <NavItem key={l.href} {...l} />
            ))}
          </>
        )}
      </nav>

      {/* ── Storage bar ── */}
      {(isMobile || !collapsed) && (
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between mb-1.5 text-[11px]">
            <span className="text-sidebar-foreground/40">Storage</span>
            {!loadingStorage && storageInfo && (
              <span className="text-sidebar-foreground/50">
                {isOwner
                  ? `${formatBytes(storageInfo.system.freeBytes)} free of ${formatBytes(storageInfo.system.totalBytes)}`
                  : isUnlimited
                    ? 'Unlimited'
                    : `${formatBytes(storageInfo.user.usedBytes)} / ${formatBytes(storageInfo.user.quotaBytes)}`}
              </span>
            )}
          </div>
          {loadingStorage ? (
            <div className="h-1 bg-sidebar-accent rounded-full animate-pulse" />
          ) : isOwner && storageInfo ? (
            <Progress
              value={Math.min(storageInfo.system.usedPercentage, 100)}
              className={cn(
                'h-1 bg-sidebar-accent/60',
                storageInfo.system.usedPercentage >= 90 && '[&>div]:bg-red-500',
                storageInfo.system.usedPercentage >= 75 &&
                  storageInfo.system.usedPercentage < 90 &&
                  '[&>div]:bg-amber-500',
                storageInfo.system.usedPercentage < 75 &&
                  '[&>div]:bg-sidebar-primary',
              )}
            />
          ) : !isUnlimited ? (
            <Progress
              value={Math.min(usedPercentage, 100)}
              className={cn(
                'h-1 bg-sidebar-accent/60',
                usedPercentage >= 90 && '[&>div]:bg-red-500',
                usedPercentage >= 75 &&
                  usedPercentage < 90 &&
                  '[&>div]:bg-amber-500',
                usedPercentage < 75 && '[&>div]:bg-sidebar-primary',
              )}
            />
          ) : (
            <div className="h-1 bg-sidebar-primary/20 rounded-full" />
          )}
        </div>
      )}

      {/* ── User row (Dokploy style) ── */}
      <div className="shrink-0 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-sidebar-accent/60 transition-colors',
                !isMobile && collapsed && 'justify-center px-2',
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sidebar-foreground text-xs font-semibold">
                  {getInitials(user?.name ?? '')}
                </AvatarFallback>
              </Avatar>
              {(isMobile || !collapsed) && user && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13.5px] font-semibold text-sidebar-foreground leading-tight truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/50 leading-tight truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={!isMobile && collapsed ? 'center' : 'start'}
            side="top"
            className="w-56 mb-1"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard/profile" className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
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
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-500 focus:text-red-500 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── Version string (Dokploy style — centered, very muted) ── */}
        {(isMobile || !collapsed) && (
          <div className="flex items-center justify-center gap-2 pb-2.5 pt-0">
            {isOwner && updateAvailable && latestVersion ? (
              <button
                onClick={() => setUpdateModalOpen(true)}
                className="flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                Update to v{latestVersion}
              </button>
            ) : updateAvailable && latestVersion ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] text-sidebar-foreground/30 select-none flex items-center gap-1.5">
                    Version v{APP_VERSION}
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Update available: v{latestVersion}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-[11px] text-sidebar-foreground/30 select-none">
                Version v{APP_VERSION}
              </span>
            )}
          </div>
        )}
        {/* Collapsed — update dot in version area */}
        {!isMobile && collapsed && updateAvailable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'pb-3 pt-0.5 flex justify-center',
                  isOwner && 'cursor-pointer',
                )}
                onClick={isOwner ? () => setUpdateModalOpen(true) : undefined}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              Update available: v{latestVersion}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );

  // ── Update modal ────────────────────────────────────────────────────────────
  const updateModal = (
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
              if (
                updateStep === 'idle' ||
                updateStep === 'done' ||
                updateStep === 'error'
              ) {
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
                  <h2 className="text-[15px] font-semibold">
                    Update Available
                  </h2>
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
                {/* Step 1 */}
                <div
                  className={cn(
                    'flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors',
                    updateStep === 'pulling' && 'bg-blue-500/10 text-blue-500',
                    (updateStep === 'restarting' || updateStep === 'done') &&
                      'text-muted-foreground',
                    updateStep === 'idle' && 'text-muted-foreground/50',
                  )}
                >
                  {updateStep === 'pulling' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 1,
                        ease: 'linear',
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </motion.div>
                  ) : updateStep === 'restarting' || updateStep === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-current" />
                  )}
                  <span>Pull latest image</span>
                </div>

                {/* Step 2 */}
                <div
                  className={cn(
                    'flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors',
                    updateStep === 'restarting' &&
                      'bg-blue-500/10 text-blue-500',
                    updateStep === 'done' && 'text-muted-foreground',
                    (updateStep === 'idle' || updateStep === 'pulling') &&
                      'text-muted-foreground/35',
                  )}
                >
                  {updateStep === 'restarting' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 1,
                        ease: 'linear',
                      }}
                    >
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
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-green-500 text-center"
                >
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setUpdateStep('idle')}
                >
                  Retry
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // ── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {updateModal}
        <div className="fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-3 gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-sidebar-foreground"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] bg-sidebar">
              {sidebarContent}
            </SheetContent>
          </Sheet>
          <Link to="/dashboard/files" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-white border border-sidebar-border flex items-center justify-center overflow-hidden">
              <img
                src="/favicon.ico"
                alt="logo"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <span className="font-semibold text-sidebar-foreground text-[15px]">
              ZynqCloud
            </span>
          </Link>
        </div>
      </>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────────────────────
  return (
    <>
      {updateModal}
      {/* Wrapper gives us a positioned ancestor for the floating edge handle */}
      <div className="relative flex-shrink-0">
        {sidebarContent}
        {/* Floating toggle — sits on the right border of the sidebar, half-outside.
            Matches the Dokploy pattern: handle is outside the sidebar body. */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-[18px] -right-3 z-30 h-6 w-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all shadow-sm"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </div>
    </>
  );
}
