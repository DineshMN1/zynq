import { Link, useLocation } from 'react-router-dom';
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
  Building2,
  HardDrive,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
  Sidebar as UISidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from './ui/sidebar';
import { TooltipProvider } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User, UpdateCheckResult } from '@/lib/api';
import { systemApi, storageApi, authApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { STORAGE_REFRESH_EVENT } from '@/lib/storage-events';
import { getInitials } from '@/lib/auth';
import { useTheme } from './ThemeProvider';
import {
  ZynqLogo,
  NavItem,
  SectionLabel,
  IconAction,
  RoleBadge,
  NavTooltip,
} from './sidebar-primitives';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

interface AppSidebarProps {
  user: User | null;
}

type UpdateStep = 'idle' | 'pulling' | 'restarting' | 'done' | 'error';

// ── Storage bar ───────────────────────────────────────────────────────────────
function StorageBar({
  used,
  total,
  unlimited,
  diskUsed,
  diskTotal,
}: {
  used: number;
  total: number;
  unlimited: boolean;
  diskUsed: number;
  diskTotal: number;
}) {
  const displayUsed = unlimited ? diskUsed : used;
  const displayTotal = unlimited ? diskTotal : total;
  const pct = displayTotal > 0 ? Math.min(100, (displayUsed / displayTotal) * 100) : 0;

  const fmt = (b: number) => {
    if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
    if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
    if (b >= 1_024) return `${(b / 1_024).toFixed(0)} KB`;
    return `${b} B`;
  };

  const barColor =
    pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary';

  return (
    <div className="space-y-1.5 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-foreground/50">
          <HardDrive className="h-3 w-3" />
          Storage
        </span>
        <span className="text-[11px] text-sidebar-foreground/40 tabular-nums">
          {displayTotal > 0
            ? `${fmt(displayUsed)} / ${fmt(displayTotal)}`
            : `${fmt(displayUsed)} used`}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-sidebar-border/60">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: 'bg-violet-500/10 text-violet-500',
    admin: 'bg-blue-500/10 text-blue-500',
    user:  'bg-muted text-muted-foreground',
  };
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-semibold capitalize', styles[role] ?? styles.user)}>
      {role}
    </span>
  );
}

// ── Update modal ──────────────────────────────────────────────────────────────
function UpdateModal({
  open,
  onClose,
  step,
  currentVersion,
  latestVersion,
  onUpdate,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  step: UpdateStep;
  currentVersion: string;
  latestVersion: string;
  onUpdate: () => void;
  onRetry: () => void;
}) {
  const canClose = ['idle', 'done', 'error'].includes(step);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => canClose && onClose()}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-background border border-border shadow-2xl shadow-black/20 p-6 space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-semibold">Update Available</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <span className="font-mono">v{currentVersion}</span>
                    <ChevronRight className="inline h-3 w-3 mx-0.5 opacity-50" />
                    <span className="font-mono text-primary">v{latestVersion}</span>
                  </p>
                </div>
                {canClose && (
                  <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-1 rounded-xl bg-muted/40 p-1">
                {([
                  { key: 'pulling',    label: 'Pull latest image',  nexts: ['restarting', 'done'] },
                  { key: 'restarting', label: 'Restart container',  nexts: ['done'] },
                ] as { key: UpdateStep; label: string; nexts: UpdateStep[] }[]).map(({ key, label, nexts }) => {
                  const active = step === key;
                  const done   = nexts.includes(step) || step === 'done';
                  return (
                    <div key={key} className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      active && 'bg-primary/10 text-primary',
                      !active && done  && 'text-muted-foreground',
                      !active && !done && 'text-muted-foreground/30',
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
                      <span className="font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>

              {step === 'done' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-500 text-center font-medium">
                  Done — reloading…
                </motion.p>
              )}
              {step === 'error' && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/8 px-3 py-2.5 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Update failed. Check server logs.</span>
                </div>
              )}

              {step === 'idle' && (
                <Button className="w-full" onClick={onUpdate}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Update Now
                </Button>
              )}
              {step === 'error' && (
                <Button variant="outline" className="w-full" onClick={onRetry}>Retry</Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────
export function AppSidebar({ user }: AppSidebarProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStep, setUpdateStep] = useState<UpdateStep>('idle');
  const [diskTotal, setDiskTotal] = useState(0);
  const [diskUsed, setDiskUsed] = useState(0);
  const [localStorageUsed, setLocalStorageUsed] = useState(user?.storage_used ?? 0);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';
  const updateAvailable = !!updateInfo?.hasUpdate;
  const latestVersion = updateInfo?.latest ?? '';

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  // ── Storage refresh ────────────────────────────────────────────────────────
  const refreshStorage = useCallback(() => {
    const unlimited = !user?.storage_limit || user.storage_limit === 0;
    if (unlimited) {
      storageApi.getOverview().then((o) => {
        setDiskTotal(o.system.totalBytes);
        setDiskUsed(o.system.usedBytes);
      }).catch(() => {});
    } else {
      authApi.me().then((u) => setLocalStorageUsed(u.storage_used ?? 0)).catch(() => {});
    }
  }, [user]);

  useEffect(() => { refreshStorage(); }, [refreshStorage]);
  useEffect(() => { setLocalStorageUsed(user?.storage_used ?? 0); }, [user?.storage_used]);
  useEffect(() => {
    window.addEventListener(STORAGE_REFRESH_EVENT, refreshStorage);
    return () => window.removeEventListener(STORAGE_REFRESH_EVENT, refreshStorage);
  }, [refreshStorage]);

  // ── Update check ───────────────────────────────────────────────────────────
  useEffect(() => {
    systemApi.checkUpdate().then(setUpdateInfo).catch(() => {});
  }, []);

  const handleUpdate = async () => {
    setUpdateStep('pulling');
    try {
      await systemApi.triggerUpdate();
      setUpdateStep('restarting');
      const start = Date.now();
      const poll = async (): Promise<void> => {
        if (Date.now() - start > 120_000) { setUpdateStep('error'); return; }
        try {
          const res = await fetch('/health', { cache: 'no-store' });
          if (res.ok) { setUpdateStep('done'); setTimeout(() => window.location.reload(), 2000); return; }
        } catch { /* still restarting */ }
        setTimeout(poll, 2000);
      };
      setTimeout(poll, 3000);
    } catch {
      setUpdateStep('error');
    }
  };

  // ── Nav structure ──────────────────────────────────────────────────────────
  const storage = [
    { href: '/dashboard/files',  label: 'My Files', icon: Files  },
    { href: '/dashboard/shared', label: 'Shared',   icon: Share2 },
    { href: '/dashboard/trash',  label: 'Trash',    icon: Trash2 },
  ];

  const workspace = [
    { href: '/team/files', label: 'Team', icon: Building2 },
  ];

  const general = [
    { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin Panel', icon: Hammer }] : []),
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <UpdateModal
        open={updateModalOpen}
        onClose={() => { setUpdateModalOpen(false); setUpdateStep('idle'); }}
        step={updateStep}
        currentVersion={APP_VERSION}
        latestVersion={latestVersion}
        onUpdate={handleUpdate}
        onRetry={() => setUpdateStep('idle')}
      />

      <UISidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">

        {/* ── Header ── */}
        <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3">
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col gap-2')}>
            <Link
              to="/dashboard/files"
              className={cn(
                'flex flex-1 min-w-0 items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent/40',
                collapsed && 'justify-center flex-none',
              )}
            >
              <ZynqLogo size={28} />
              {!collapsed && (
                <div className="flex min-w-0 flex-1 flex-col leading-none">
                  <span className="text-[13.5px] font-bold tracking-tight text-sidebar-foreground truncate">
                    ZynqCloud
                  </span>
                  <span className="text-[10.5px] text-sidebar-foreground/40 mt-0.5 font-mono">
                    v{APP_VERSION}
                  </span>
                </div>
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

          <SectionLabel label="Storage" collapsed={collapsed} />
          <nav className="space-y-0.5">
            {storage.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
          </nav>

          <SectionLabel label="Workspace" collapsed={collapsed} />
          <nav className="space-y-0.5">
            {workspace.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
          </nav>

          <SectionLabel label="General" collapsed={collapsed} />
          <nav className="space-y-0.5">
            {general.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
          </nav>

        </SidebarContent>

        {/* ── Footer ── */}
        <SidebarFooter className="border-t border-sidebar-border/60 p-0">

          {/* Update badge */}
          {updateAvailable && isOwner && !collapsed && (
            <button
              onClick={() => setUpdateModalOpen(true)}
              className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2 text-left transition-colors hover:bg-blue-500/12"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 animate-pulse" />
              <span className="flex-1 min-w-0 text-[11px] font-medium text-blue-500 truncate">
                Update to v{latestVersion}
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 text-blue-500/60" />
            </button>
          )}
          {updateAvailable && collapsed && (
            <div className="flex justify-center pt-2">
              <button
                onClick={isOwner ? () => setUpdateModalOpen(true) : undefined}
                className={cn('rounded-full p-1', isOwner && 'cursor-pointer hover:bg-sidebar-accent')}
              >
                <span className="block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              </button>
            </div>
          )}

          {/* Storage */}
          {!collapsed && user != null && (
            <div className="mx-1 mt-2 rounded-xl bg-sidebar-accent/40">
              <StorageBar
                used={localStorageUsed}
                total={user.storage_limit ?? 0}
                unlimited={!user.storage_limit || user.storage_limit === 0}
                diskUsed={diskUsed}
                diskTotal={diskTotal}
              />
            </div>
          )}

          {/* User row */}
          <div className={cn(
            'flex items-center gap-2.5 p-3',
            collapsed && 'flex-col gap-2 items-center',
          )}>
            {/* Avatar */}
            <NavTooltip label={user?.name ?? 'Account'} collapsed={collapsed}>
              <Link to="/dashboard/profile" className="shrink-0">
                <Avatar className="h-8 w-8 rounded-lg ring-2 ring-sidebar-border hover:ring-primary/40 transition-all">
                  <AvatarImage src={user?.avatar ?? undefined} alt={user?.name} className="rounded-lg object-cover" />
                  <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-[11px] font-bold">
                    {getInitials(user?.name ?? '')}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </NavTooltip>

            {!collapsed && (
              <>
                {/* Name + role */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-sidebar-foreground leading-tight">
                      {user?.name}
                    </p>
                    <RoleBadge role={user?.role ?? 'user'} />
                  </div>
                  <p className="truncate text-[11px] text-sidebar-foreground/40 leading-tight mt-0.5" title={user?.email}>
                    {user?.email}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconAction
                    icon={theme === 'dark' ? Sun : Moon}
                    label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    onClick={toggleTheme}
                  />
                  <IconAction
                    icon={LogOut}
                    label="Sign out"
                    onClick={logout}
                    danger
                  />
                </div>
              </>
            )}

            {/* Collapsed: just theme + logout stacked */}
            {collapsed && (
              <>
                <IconAction
                  icon={theme === 'dark' ? Sun : Moon}
                  label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  onClick={toggleTheme}
                />
                <IconAction
                  icon={LogOut}
                  label="Sign out"
                  onClick={logout}
                  danger
                />
              </>
            )}
          </div>
        </SidebarFooter>

      </UISidebar>
    </TooltipProvider>
  );
}
