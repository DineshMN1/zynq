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
  FolderOpen,
  Shield,
  ChevronsUpDown,
} from 'lucide-react';
import { Progress } from './ui/progress';
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
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Sheet, SheetContent } from './ui/sheet';
import {
  SidebarProvider,
  Sidebar as UISidebar,
  SidebarHeader as UISidebarHeader,
  SidebarContent as UISidebarContent,
  SidebarFooter as UISidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from './ui/sidebar';
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

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

const RAIL_W = 60;
const PANEL_W = 200;

export function Sidebar({ user }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [activeGroup, setActiveGroup] = useState<string>('files');
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageOverview | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStep, setUpdateStep] = useState<UpdateStep>('idle');
  const isMobile = useIsMobile(); // true for < 1024px (mobile + tablet)

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';
  const updateAvailable = !!updateInfo?.hasUpdate;
  const latestVersion = updateInfo?.latest;
  const usedPercentage = storageInfo?.user.usedPercentage || 0;
  const isUnlimited = storageInfo?.user.isUnlimited;

  const navGroups: NavGroup[] = [
    {
      id: 'files',
      label: 'Files',
      icon: FolderOpen,
      items: [
        { href: '/dashboard/files', label: 'All Files', icon: Files },
        { href: '/dashboard/shared', label: 'Shared', icon: Share2 },
        { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      items: [
        { href: '/dashboard/settings', label: 'Preferences', icon: Settings },
        { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
      ],
    },
    ...(isAdmin
      ? [
          {
            id: 'admin',
            label: 'Admin',
            icon: Shield,
            items: [
              {
                href: '/dashboard/settings/users',
                label: 'Users',
                icon: Users,
              },
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
            ],
          },
        ]
      : []),
  ];

  useEffect(() => {
    const matched = navGroups.find((g) =>
      g.items.some(
        (i) => pathname === i.href || pathname.startsWith(i.href + '/'),
      ),
    );
    if (matched) setActiveGroup(matched.id);
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user) void loadStorageInfo();
  }, [user]);

  useEffect(() => {
    systemApi.checkUpdate().then(setUpdateInfo).catch(() => {});
  }, []);

  useEffect(() => {
    const cb = () => {
      if (user) void loadStorageInfo();
    };
    window.addEventListener(STORAGE_REFRESH_EVENT, cb);
    return () => window.removeEventListener(STORAGE_REFRESH_EVENT, cb);
  }, [user]);

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

  const handleRailClick = (groupId: string) => {
    if (activeGroup === groupId) {
      setPanelOpen((p) => !p);
    } else {
      setActiveGroup(groupId);
      setPanelOpen(true);
    }
  };

  const currentGroup = navGroups.find((g) => g.id === activeGroup);

  // ── Shared: user popover content ─────────────────────────────────────────────
  const UserPopoverContent = ({ side }: { side: 'top' | 'right' }) => (
    <PopoverContent align="center" side={side} sideOffset={8} className="w-64 p-0">
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
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          asChild
        >
          <Link to="/dashboard/profile">
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          asChild
        >
          <Link to="/dashboard/settings">
            <Settings className="mr-2 h-4 w-4" />
            Preferences
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
  );

  // ── Shared: storage bar ───────────────────────────────────────────────────────
  const StorageBar = () => (
    <div className="px-4 py-3 border-t border-sidebar-border shrink-0">
      <div className="flex items-center justify-between mb-1.5 text-[11px]">
        <span className="text-sidebar-foreground/40">Storage</span>
        {!loadingStorage && storageInfo && (
          <span className="text-sidebar-foreground/50 text-right leading-tight">
            {isOwner
              ? `${formatBytes(storageInfo.system.freeBytes)} free`
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
  );

  // ── Update modal ─────────────────────────────────────────────────────────────
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

  // ── Mobile / Tablet (< 1024px) ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {updateModal}

        {/* Fixed top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-3 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-sidebar-foreground shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/dashboard/files" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-white border border-sidebar-border flex items-center justify-center overflow-hidden shrink-0">
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
          {updateAvailable && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          )}
        </div>

        {/* Mobile Sheet sidebar using shadcn sidebar primitives */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[280px] bg-sidebar [&>button]:hidden"
          >
            {/*
              SidebarProvider as pure context wrapper (display:contents)
              so SidebarMenuButton can access useSidebar() context.
              The Sheet itself handles open/close.
            */}
            <SidebarProvider
              defaultOpen={true}
              className="[display:contents]"
              style={{} as React.CSSProperties}
            >
              <UISidebar collapsible="none" className="w-full border-none">
                {/* Header */}
                <UISidebarHeader className="border-b border-sidebar-border">
                  <div className="flex items-center gap-2.5 px-1 py-1">
                    <div className="h-7 w-7 rounded-md bg-white border border-sidebar-border flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src="/favicon.ico"
                        alt="logo"
                        className="h-full w-full object-contain p-0.5"
                      />
                    </div>
                    <span className="font-semibold text-[15px] text-sidebar-foreground">
                      ZynqCloud
                    </span>
                  </div>
                </UISidebarHeader>

                {/* Nav content */}
                <UISidebarContent>
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
                                size="default"
                                onClick={() => setMobileOpen(false)}
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
                </UISidebarContent>

                <SidebarSeparator />

                {/* Storage bar */}
                <StorageBar />

                {/* Footer: user row */}
                <UISidebarFooter className="border-t border-sidebar-border p-2">
                  {/* Update button */}
                  {isOwner && updateAvailable && latestVersion && (
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        setUpdateModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                      Update to v{latestVersion}
                    </button>
                  )}

                  {/* User popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className="w-full data-[state=open]:bg-sidebar-accent"
                      >
                        <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                          <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sidebar-foreground text-xs font-semibold">
                            {getInitials(user?.name ?? '')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">
                            {user?.name}
                          </p>
                          <p className="text-[11px] text-sidebar-foreground/50 leading-tight truncate mt-0.5">
                            {user?.email}
                          </p>
                        </div>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/40 ml-auto" />
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <UserPopoverContent side="top" />
                  </Popover>

                  {/* Version string */}
                  <p className="text-center text-[11px] text-sidebar-foreground/30 select-none pt-1">
                    v{APP_VERSION}
                  </p>
                </UISidebarFooter>
              </UISidebar>
            </SidebarProvider>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // ── Desktop (≥ 1024px): two-column rail + detail panel ───────────────────────
  return (
    <>
      {updateModal}
      <div className="relative flex-shrink-0 h-full flex">
        {/* Left icon rail */}
        <div
          className="flex flex-col items-center bg-sidebar border-r border-sidebar-border h-full shrink-0"
          style={{ width: RAIL_W }}
        >
          {/* Logo */}
          <div className="h-14 flex items-center justify-center border-b border-sidebar-border w-full shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/dashboard/files">
                  <div className="h-7 w-7 rounded-md bg-white border border-sidebar-border flex items-center justify-center overflow-hidden">
                    <img
                      src="/favicon.ico"
                      alt="logo"
                      className="h-full w-full object-contain p-0.5"
                    />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                ZynqCloud
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Section icons */}
          <nav className="flex-1 flex flex-col items-center gap-1 py-3 px-1.5">
            {navGroups.map((group) => {
              const isGroupActive = group.items.some((i) => isActive(i.href));
              const isPanelShowing = panelOpen && activeGroup === group.id;
              return (
                <Tooltip key={group.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleRailClick(group.id)}
                      className={cn(
                        'flex items-center justify-center rounded-lg h-9 w-9 transition-colors',
                        isPanelShowing
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : isGroupActive
                            ? 'bg-sidebar-accent/60 text-sidebar-foreground'
                            : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
                      )}
                    >
                      <group.icon className="h-[18px] w-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {group.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Bottom: update dot + user avatar */}
          <div className="flex flex-col items-center gap-2 pb-3 px-1.5 shrink-0">
            {updateAvailable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center justify-center h-4',
                      isOwner && 'cursor-pointer',
                    )}
                    onClick={
                      isOwner ? () => setUpdateModalOpen(true) : undefined
                    }
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 block" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Update available: v{latestVersion}
                </TooltipContent>
              </Tooltip>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center rounded-lg h-9 w-9 hover:bg-sidebar-accent/60 transition-colors">
                  <Avatar className="h-7 w-7 shrink-0 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sidebar-foreground text-[11px] font-semibold">
                      {getInitials(user?.name ?? '')}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <UserPopoverContent side="right" />
            </Popover>
          </div>
        </div>

        {/* Right detail panel */}
        <AnimatePresence initial={false}>
          {panelOpen && currentGroup && (
            <motion.div
              key={activeGroup}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: PANEL_W, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden shrink-0"
            >
              {/* Panel header */}
              <div className="h-14 shrink-0 flex items-center px-4 border-b border-sidebar-border">
                <span className="font-semibold text-[15px] text-sidebar-foreground whitespace-nowrap">
                  {currentGroup.label}
                </span>
              </div>

              {/* Nav items */}
              <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                {currentGroup.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap',
                      isActive(item.href)
                        ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                        : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="text-[14px] font-medium leading-none">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </nav>

              {/* Storage bar (files section only) */}
              {activeGroup === 'files' && <StorageBar />}

              {/* Version / update */}
              <div className="shrink-0 pb-2.5 pt-1.5 flex justify-center border-t border-sidebar-border">
                {isOwner && updateAvailable && latestVersion ? (
                  <button
                    onClick={() => setUpdateModalOpen(true)}
                    className="flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    Update to v{latestVersion}
                  </button>
                ) : updateAvailable && latestVersion ? (
                  <span className="text-[11px] text-sidebar-foreground/30 select-none flex items-center gap-1.5">
                    v{APP_VERSION}
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  </span>
                ) : (
                  <span className="text-[11px] text-sidebar-foreground/30 select-none">
                    v{APP_VERSION}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
