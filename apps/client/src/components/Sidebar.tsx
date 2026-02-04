'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Cloud,
  Files,
  FolderOpen,
  Clock,
  Star,
  Share2,
  Trash2,
  Settings,
  Users,
  Mail,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
  MoreVertical,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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

  const mainLinks = [
    { href: '/dashboard/files', label: 'All Files', icon: Files },
    { href: '/dashboard/shared', label: 'Shared', icon: Share2 },
    { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
  ];

  const settingsLinks = [
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  const adminLinks = isAdmin
    ? [
        { href: '/dashboard/settings/users', label: 'Users', icon: Users },
        { href: '/dashboard/settings/invites', label: 'Invites', icon: Mail },
      ]
    : [];

  const usedPercentage = storageInfo?.user.usedPercentage || 0;

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-background border-r border-border transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Fixed Header */}
      <div className="flex items-center h-14 px-3 border-b border-border shrink-0">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2 flex-1">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">ZynqCloud</span>
          </Link>
        ) : (
          <div className="flex-1 flex justify-center">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-6">
        {/* Primary Navigation */}
        <div className="space-y-0.5">
          {mainLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? link.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Settings Section */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
              Settings
            </p>
          )}
          {collapsed && <div className="border-t border-border mx-2 my-2" />}
          <div className="space-y-0.5">
            {settingsLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? link.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                Admin
              </p>
            )}
            {collapsed && <div className="border-t border-border mx-2 my-2" />}
            <div className="space-y-0.5">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all',
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                      collapsed && 'justify-center px-2'
                    )}
                    title={collapsed ? link.label : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Fixed Storage Indicator */}
      <div className={cn('px-3 py-3 border-t border-border shrink-0', collapsed && 'px-2')}>
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground/70">Storage</span>
              {!loadingStorage && storageInfo && (
                <span className="text-xs text-muted-foreground">
                  {formatBytes(storageInfo.user.usedBytes)}
                </span>
              )}
            </div>
            {loadingStorage ? (
              <div className="h-1.5 bg-secondary rounded-full animate-pulse" />
            ) : (
              <Progress
                value={Math.min(usedPercentage, 100)}
                className={cn(
                  'h-1.5 bg-secondary',
                  usedPercentage >= 90 && '[&>div]:bg-red-500',
                  usedPercentage >= 75 && usedPercentage < 90 && '[&>div]:bg-amber-500',
                  usedPercentage < 75 && '[&>div]:bg-primary'
                )}
              />
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
                usedPercentage < 75 && 'bg-primary'
              )}
            />
          </div>
        )}
      </div>

      {/* Fixed User Profile */}
      <div className={cn('px-2 py-2 border-t border-border shrink-0', collapsed && 'px-1')}>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-colors text-left',
                  collapsed && 'justify-center'
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">{user.email}</p>
                    </div>
                    <MoreVertical className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={collapsed ? 'center' : 'end'}
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
                  Settings
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
        ) : (
          <div className={cn('p-2', collapsed && 'flex justify-center')}>
            <div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}
