'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  PanelLeftClose,
  PanelLeft,
  Activity,
  Menu,
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
import type { User, StorageOverview } from '@/lib/api';
import { storageApi, authApi } from '@/lib/api';
import { formatBytes, getInitials } from '@/lib/auth';
import { STORAGE_REFRESH_EVENT } from '@/lib/storage-events';
import { useTheme } from './ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
const GITHUB_REPO = 'DineshMn1/zynq';

interface SidebarProps {
  user: User | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageOverview | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    if (user) {
      loadStorageInfo();
    }
  }, [user]);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then((r) => r.json())
      .then((data: { tag_name?: string }) => {
        const tag = data.tag_name?.replace(/^v/, '');
        if (tag && tag !== APP_VERSION) {
          setUpdateAvailable(true);
          setLatestVersion(tag);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onStorageRefresh = () => {
      if (user) {
        void loadStorageInfo();
      }
    };

    window.addEventListener(STORAGE_REFRESH_EVENT, onStorageRefresh);
    return () => {
      window.removeEventListener(STORAGE_REFRESH_EVENT, onStorageRefresh);
    };
  }, [user]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const loadStorageInfo = async () => {
    try {
      setLoadingStorage(true);
      const data = await storageApi.getOverview();
      setStorageInfo(data);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      router.push('/login');
    }
  };

  // Home section links
  const homeLinks = [
    { href: '/dashboard/files', label: 'All Files', icon: Files },
    { href: '/dashboard/shared', label: 'Shared', icon: Share2 },
    { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
  ];

  // Settings section links (for all users)
  const settingsLinks = [
    { href: '/dashboard/settings', label: 'Preferences', icon: Settings },
    { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
  ];

  // Admin settings links
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

  const usedPercentage = storageInfo?.user.usedPercentage || 0;
  const isUnlimited = storageInfo?.user.isUnlimited;

  const isActiveLink = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const NavLink = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
  }) => {
    const isActive = isActiveLink(href);
    const showLabel = isMobile || !collapsed;
    const link = (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
          !showLabel && 'justify-center px-2',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {showLabel && <span>{label}</span>}
      </Link>
    );

    if (showLabel) return link;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <>
      {isMobile || !collapsed ? (
        <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          {title}
        </p>
      ) : (
        <div className="border-t border-sidebar-border mx-2 my-3" />
      )}
    </>
  );

  const sidebarContent = (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200',
        isMobile ? 'w-full' : collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
    >
      {/* Logo Header */}
      <div
        className={cn(
          'h-14 flex items-center border-b border-sidebar-border px-3',
          !isMobile && collapsed && 'justify-center',
        )}
      >
        {isMobile || !collapsed ? (
          <Link href="/dashboard/files" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white border border-sidebar-border flex items-center justify-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.ico"
                alt="App icon"
                className="h-full w-full object-contain p-1"
              />
            </div>
            <span className="font-semibold text-sidebar-foreground">
              ZynqCloud
            </span>
          </Link>
        ) : (
          <Link href="/dashboard/files">
            <div className="h-8 w-8 rounded-lg bg-white border border-sidebar-border flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.ico"
                alt="App icon"
                className="h-full w-full object-contain p-1"
              />
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {/* Home Section */}
        <div className="space-y-1">
          <SectionHeader title="Home" />
          {homeLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>

        {/* Settings Section */}
        <div className="mt-6 space-y-1">
          <SectionHeader title="Settings" />
          {settingsLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>

        {/* Admin Settings Section */}
        {isAdmin && adminLinks.length > 0 && (
          <div className="mt-6 space-y-1">
            <SectionHeader title="Admin Settings" />
            {adminLinks.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </div>
        )}
      </nav>

      {/* Version Tag */}
      <div
        className={cn(
          'px-3 py-2 border-t border-sidebar-border',
          !isMobile && collapsed && 'px-2',
        )}
      >
        {isMobile || !collapsed ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-sidebar-foreground/40 font-mono select-none">
              v{APP_VERSION}
            </span>
            {updateAvailable && latestVersion && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 cursor-default" />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Update available: v{latestVersion}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                {updateAvailable ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 cursor-default" />
                ) : (
                  <span className="text-[10px] text-sidebar-foreground/30 font-mono select-none cursor-default">
                    v
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {updateAvailable && latestVersion
                ? `Update available: v${latestVersion} (current: v${APP_VERSION})`
                : `v${APP_VERSION}`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Storage Indicator */}
      <div
        className={cn(
          'px-3 py-3 border-t border-sidebar-border',
          !isMobile && collapsed && 'px-2',
        )}
      >
        {isMobile || !collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sidebar-foreground/60">Storage</span>
              {!loadingStorage && storageInfo && (
                <span className="text-sidebar-foreground/80">
                  {isUnlimited
                    ? 'Unlimited'
                    : `${formatBytes(storageInfo.user.usedBytes)} / ${formatBytes(storageInfo.user.quotaBytes)}`}
                </span>
              )}
            </div>
            {loadingStorage ? (
              <div className="h-1.5 bg-sidebar-accent rounded-full animate-pulse" />
            ) : !isUnlimited ? (
              <Progress
                value={Math.min(usedPercentage, 100)}
                className={cn(
                  'h-1.5 bg-sidebar-accent',
                  usedPercentage >= 90 && '[&>div]:bg-red-500',
                  usedPercentage >= 75 &&
                    usedPercentage < 90 &&
                    '[&>div]:bg-amber-500',
                  usedPercentage < 75 && '[&>div]:bg-sidebar-primary',
                )}
              />
            ) : (
              <div className="h-1.5 bg-sidebar-primary/30 rounded-full" />
            )}
            {!loadingStorage && storageInfo && isUnlimited && (
              <p className="text-[10px] text-sidebar-foreground/40">
                {formatBytes(storageInfo.system.freeBytes)} free of{' '}
                {formatBytes(storageInfo.system.totalBytes)}
              </p>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    usedPercentage >= 90 && 'bg-red-500',
                    usedPercentage >= 75 &&
                      usedPercentage < 90 &&
                      'bg-amber-500',
                    usedPercentage < 75 && 'bg-sidebar-primary',
                  )}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {storageInfo
                ? isUnlimited
                  ? `${formatBytes(storageInfo.user.usedBytes)} used — ${formatBytes(storageInfo.system.freeBytes)} free`
                  : `${formatBytes(storageInfo.user.usedBytes)} / ${formatBytes(storageInfo.user.quotaBytes)}`
                : 'Loading...'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* User Profile & Controls */}
      <div
        className={cn(
          'px-2 py-2 border-t border-sidebar-border',
          !isMobile && collapsed && 'px-1',
        )}
      >
        {user ? (
          <div
            className={cn(
              'flex items-center gap-2',
              !isMobile && collapsed && 'flex-col',
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md hover:bg-sidebar-accent transition-colors text-left flex-1 min-w-0',
                    !isMobile && collapsed && 'justify-center w-full',
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  {(isMobile || !collapsed) && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-sidebar-foreground/60 truncate">
                        {user.email}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={!isMobile && collapsed ? 'center' : 'start'}
                side="top"
                className="w-56 mb-1"
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="cursor-pointer">
                    <UserIcon className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={toggleTheme}
                  className="cursor-pointer"
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

            {/* Collapse button — desktop only */}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                  'h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                  collapsed && 'mt-1',
                )}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'p-2',
              !isMobile && collapsed && 'flex justify-center',
            )}
          >
            <div className="h-8 w-8 rounded-full bg-sidebar-accent animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );

  // Mobile: render sidebar in a Sheet overlay
  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
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
          <Link href="/dashboard/files" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-white border border-sidebar-border flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.ico"
                alt="App icon"
                className="h-full w-full object-contain p-1"
              />
            </div>
            <span className="font-semibold text-sidebar-foreground text-sm">
              ZynqCloud
            </span>
          </Link>
        </div>
      </>
    );
  }

  // Desktop: render sidebar normally
  return sidebarContent;
}
