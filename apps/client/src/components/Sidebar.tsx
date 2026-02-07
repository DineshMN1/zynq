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
  HardDrive,
  Activity,
  UserPlus,
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
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import type { User, StorageOverview } from '@/lib/api';
import { storageApi, authApi } from '@/lib/api';
import { useTheme } from './ThemeProvider';

interface SidebarProps {
  user: User | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageOverview | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    if (user) {
      loadStorageInfo();
    }
  }, [user]);

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
    { href: '/dashboard/shared', label: 'Shared with me', icon: Share2 },
    { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
  ];

  // Settings section links (for all users)
  const settingsLinks = [
    { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
  ];

  // Admin settings links
  const adminLinks = isAdmin
    ? [
        { href: '/dashboard/settings/users', label: 'Users', icon: Users },
        { href: '/dashboard/settings/invites', label: 'Invitations', icon: UserPlus },
        { href: '/dashboard/settings/notifications', label: 'Notifications', icon: Bell },
        { href: '/dashboard/settings/monitoring', label: 'Monitoring', icon: Activity },
      ]
    : [];

  const usedPercentage = storageInfo?.user.usedPercentage || 0;
  const isUnlimited = storageInfo?.user.isUnlimited;

  const isActiveLink = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const isActive = isActiveLink(href);
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <>
      {!collapsed ? (
        <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          {title}
        </p>
      ) : (
        <div className="border-t border-sidebar-border mx-2 my-3" />
      )}
    </>
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo Header */}
      <div className={cn('h-14 flex items-center border-b border-sidebar-border px-3', collapsed && 'justify-center')}>
        {!collapsed ? (
          <Link href="/dashboard/files" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">ZynqCloud</span>
          </Link>
        ) : (
          <Link href="/dashboard/files">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-sidebar-primary-foreground" />
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

      {/* Storage Indicator */}
      <div className={cn('px-3 py-3 border-t border-sidebar-border', collapsed && 'px-2')}>
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sidebar-foreground/60">Storage</span>
              {!loadingStorage && storageInfo && (
                <span className="text-sidebar-foreground/80">
                  {isUnlimited ? 'Unlimited' : `${formatBytes(storageInfo.user.usedBytes)} / ${formatBytes(storageInfo.user.quotaBytes)}`}
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
                  usedPercentage >= 75 && usedPercentage < 90 && '[&>div]:bg-amber-500',
                  usedPercentage < 75 && '[&>div]:bg-sidebar-primary'
                )}
              />
            ) : (
              <div className="h-1.5 bg-sidebar-primary/30 rounded-full" />
            )}
          </div>
        ) : (
          <div
            className="flex justify-center"
            title={storageInfo ? `${formatBytes(storageInfo.user.usedBytes)} used` : 'Loading...'}
          >
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                usedPercentage >= 90 && 'bg-red-500',
                usedPercentage >= 75 && usedPercentage < 90 && 'bg-amber-500',
                usedPercentage < 75 && 'bg-sidebar-primary'
              )}
            />
          </div>
        )}
      </div>

      {/* User Profile & Controls */}
      <div className={cn('px-2 py-2 border-t border-sidebar-border', collapsed && 'px-1')}>
        {user ? (
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md hover:bg-sidebar-accent transition-colors text-left flex-1 min-w-0',
                    collapsed && 'justify-center w-full'
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                      <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={collapsed ? 'center' : 'start'}
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

            {/* Collapse button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                collapsed && 'mt-1'
              )}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          <div className={cn('p-2', collapsed && 'flex justify-center')}>
            <div className="h-8 w-8 rounded-full bg-sidebar-accent animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}
