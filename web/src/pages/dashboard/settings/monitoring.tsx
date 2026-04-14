import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HardDrive,
  Users,
  Database,
  Activity,
  Server,
  RefreshCw,
  AlertTriangle,
  Zap,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  storageApi,
  adminApi,
  type StorageOverview,
  type User,
  type UserStorageInfo,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/auth';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function parseQuotaInput(value: string): number {
  const match = value.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return Math.floor(num * (multipliers[unit] || 1));
}

interface SystemStats {
  storage: StorageOverview | null;
  users: User[];
  usersStorage: UserStorageInfo[];
  loading: boolean;
  error: boolean;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  loading,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconClass: string;
  loading: boolean;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={cn('mt-1 text-2xl font-bold tracking-tight', accent)}>
              {value}
            </p>
          )}
          {loading ? (
            <Skeleton className="mt-1.5 h-3.5 w-20" />
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
          )}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconClass,
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

// ── Storage bar ───────────────────────────────────────────────────────────────
function StorageBar({
  pct,
  loading,
}: {
  pct: number;
  loading: boolean;
}) {
  const color =
    pct >= 90
      ? 'bg-red-500'
      : pct >= 75
        ? 'bg-amber-500'
        : 'bg-emerald-500';
  const glow =
    pct >= 90
      ? 'shadow-red-500/30'
      : pct >= 75
        ? 'shadow-amber-500/30'
        : 'shadow-emerald-500/30';
  const textColor =
    pct >= 90
      ? 'text-red-500'
      : pct >= 75
        ? 'text-amber-500'
        : 'text-emerald-500';

  return loading ? (
    <Skeleton className="h-3 w-full rounded-full" />
  ) : (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full shadow-lg transition-all duration-700', color, glow)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ── Role badge ─────────────────────────────────────────────────────────────────
function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    user: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize',
        styles[role] ?? styles.user,
      )}
    >
      {role}
    </span>
  );
}

// ── Inline mini progress bar ───────────────────────────────────────────────────
function MiniBar({ pct }: { pct: number }) {
  const color =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span
        className={cn(
          'w-8 text-right text-[10px] font-medium tabular-nums',
          pct >= 100
            ? 'text-red-500'
            : pct >= 80
              ? 'text-amber-500'
              : 'text-muted-foreground',
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function MonitoringPage() {
  const [stats, setStats] = useState<SystemStats>({
    storage: null,
    users: [],
    usersStorage: [],
    loading: true,
    error: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [quotaValue, setQuotaValue] = useState('');
  const [quotaUnit, setQuotaUnit] = useState<'GB' | 'MB' | 'TB'>('GB');
  const [savingQuota, setSavingQuota] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [storageData, usersData, usersStorageData] = await Promise.all([
        storageApi.getOverview(),
        adminApi.getUsers().catch(() => null),
        storageApi.getAllUsersStorage().catch(() => []),
      ]);
      setStats({
        storage: storageData,
        users: usersData?.items || [],
        usersStorage: usersStorageData,
        loading: false,
        error: false,
      });
      setLastRefreshed(new Date());
    } catch {
      setStats((prev) => ({ ...prev, loading: false, error: true }));
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const sysPct = stats.storage
    ? Math.round((stats.storage.system.usedBytes / stats.storage.system.totalBytes) * 100)
    : 0;

  const getUserStorageInfo = (userId: string) =>
    stats.usersStorage.find((s) => s.userId === userId);

  const openQuotaDialog = (user: User) => {
    setSelectedUser(user);
    const storageInfo = getUserStorageInfo(user.id);
    if (storageInfo) {
      const quotaGB = storageInfo.quotaBytes / 1024 ** 3;
      if (quotaGB >= 1024) {
        setQuotaValue((quotaGB / 1024).toFixed(2));
        setQuotaUnit('TB');
      } else if (quotaGB >= 1) {
        setQuotaValue(quotaGB.toFixed(2));
        setQuotaUnit('GB');
      } else {
        setQuotaValue((storageInfo.quotaBytes / 1024 ** 2).toFixed(2));
        setQuotaUnit('MB');
      }
    } else {
      setQuotaValue('10');
      setQuotaUnit('GB');
    }
    setQuotaDialogOpen(true);
  };

  const handleSaveQuota = async () => {
    if (!selectedUser) return;
    setSavingQuota(true);
    try {
      const quotaBytes = parseQuotaInput(`${quotaValue} ${quotaUnit}`);
      const usedBytes = getUserStorageInfo(selectedUser.id)?.usedBytes || 0;
      const availableBytes = stats.storage?.system?.freeBytes;

      if (quotaBytes !== 0 && quotaBytes < usedBytes) {
        toast({ title: 'Quota too low', description: 'Quota cannot be lower than current usage.', variant: 'warning' });
        setSavingQuota(false);
        return;
      }
      if (quotaBytes !== 0 && availableBytes != null && quotaBytes > usedBytes + availableBytes) {
        toast({
          title: 'Quota exceeds available storage',
          description: `Max allowed is ${formatBytes(usedBytes + availableBytes)} based on free space.`,
          variant: 'warning',
        });
        setSavingQuota(false);
        return;
      }

      await storageApi.updateUserQuota(selectedUser.id, quotaBytes);
      setQuotaDialogOpen(false);
      await loadStats();
    } catch {
      toast({ title: 'Failed to update quota', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingQuota(false);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <ToastContainer />

      {/* ── Page header ── */}
      <div className="border-b border-border/60 bg-card/50 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight text-foreground">
                Monitoring
              </h1>
              <p className="text-[12px] text-muted-foreground">
                System overview · auto-refreshes every 30s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            {!stats.loading && !stats.error && (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Live
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        {!stats.loading && (
          <p className="mt-2 text-[11px] text-muted-foreground/50">
            Last updated {lastRefreshed.toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="space-y-6 p-6">

        {/* ── Error banner ── */}
        {stats.error && !stats.loading && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Failed to load monitoring data</p>
              <p className="mt-0.5 text-[12px] text-destructive/70">
                Check your connection and ensure you are signed in, then click Refresh.
              </p>
            </div>
          </div>
        )}

        {/* ── Stat cards ── */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="System Storage"
            value={stats.storage ? formatBytes(stats.storage.system.usedBytes) : '—'}
            sub={`of ${stats.storage ? formatBytes(stats.storage.system.totalBytes) : '—'} total`}
            icon={HardDrive}
            iconClass="bg-blue-500/10 text-blue-500"
            loading={stats.loading}
          />
          <StatCard
            label="Free Space"
            value={stats.storage ? formatBytes(stats.storage.system.freeBytes) : '—'}
            sub={`${100 - sysPct}% available`}
            icon={Database}
            iconClass={
              sysPct >= 90
                ? 'bg-red-500/10 text-red-500'
                : sysPct >= 75
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-emerald-500/10 text-emerald-500'
            }
            accent={
              sysPct >= 90
                ? 'text-red-500'
                : sysPct >= 75
                  ? 'text-amber-500'
                  : 'text-emerald-500'
            }
            loading={stats.loading}
          />
          <StatCard
            label="Total Users"
            value={String(stats.users.length)}
            sub="Registered accounts"
            icon={Users}
            iconClass="bg-violet-500/10 text-violet-500"
            loading={stats.loading}
          />
          <StatCard
            label="System Status"
            value={stats.error ? 'Degraded' : 'Online'}
            sub="All services running"
            icon={Zap}
            iconClass={stats.error ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}
            accent={stats.error ? 'text-red-500' : 'text-emerald-500'}
            loading={stats.loading}
          />
        </div>

        {/* ── Storage overview ── */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Server className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-foreground">Storage Overview</p>
              <p className="text-[11px] text-muted-foreground">System disk breakdown</p>
            </div>
          </div>

          <div className="p-5">
            {stats.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : stats.storage ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-foreground">System Disk</span>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      sysPct >= 90
                        ? 'text-red-500'
                        : sysPct >= 75
                          ? 'text-amber-500'
                          : 'text-emerald-500',
                    )}
                  >
                    {sysPct}% used
                  </span>
                </div>

                <StorageBar pct={sysPct} loading={false} />

                <div className="grid grid-cols-3 gap-4 pt-1">
                  {[
                    { label: 'Used', value: formatBytes(stats.storage.system.usedBytes), color: 'bg-primary' },
                    { label: 'Free', value: formatBytes(stats.storage.system.freeBytes), color: sysPct >= 90 ? 'bg-red-500' : sysPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500' },
                    { label: 'Total', value: formatBytes(stats.storage.system.totalBytes), color: 'bg-muted-foreground' },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-2 w-2 rounded-full', item.color)} />
                        <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="text-[13px] font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load storage information</p>
            )}
          </div>
        </div>

        {/* ── User storage table ── */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[13.5px] font-semibold text-foreground">User Storage</p>
                <p className="text-[11px] text-muted-foreground">
                  {stats.users.length} {stats.users.length === 1 ? 'account' : 'accounts'}
                </p>
              </div>
            </div>
          </div>

          {stats.loading ? (
            <div className="divide-y divide-border/40">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : stats.users.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {stats.users.map((user) => {
                const storageInfo = getUserStorageInfo(user.id);
                const usedPct = storageInfo?.usedPercentage || 0;
                const isOver = usedPct >= 100;
                const isNear = usedPct >= 80 && !isOver;

                return (
                  <div
                    key={user.id}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                        {getInitials(user.name ?? '')}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name + email */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-[13px] font-semibold text-foreground">
                          {user.name}
                        </span>
                        <RolePill role={user.role ?? 'user'} />
                        {isOver && (
                          <span className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-red-500">
                            OVER QUOTA
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground/60">{user.email}</p>
                    </div>

                    {/* Storage figures */}
                    <div className="hidden items-end gap-1 text-right md:flex md:flex-col">
                      <span
                        className={cn(
                          'text-[12.5px] font-semibold tabular-nums',
                          isOver ? 'text-red-500' : isNear ? 'text-amber-500' : 'text-foreground',
                        )}
                      >
                        {formatBytes(storageInfo?.usedBytes || 0)}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground/50">
                        {storageInfo?.isUnlimited ? (
                          <span className="text-primary font-medium">Unlimited</span>
                        ) : (
                          `of ${formatBytes(storageInfo?.quotaBytes || 0)}`
                        )}
                      </span>
                    </div>

                    {/* Mini bar */}
                    <div className="hidden lg:block">
                      {storageInfo?.isUnlimited ? (
                        <span className="text-[11px] font-medium text-primary">∞</span>
                      ) : (
                        <MiniBar pct={usedPct} />
                      )}
                    </div>

                    {/* Edit quota button */}
                    <button
                      onClick={() => openQuotaDialog(user)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit quota"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quota dialog ── */}
      <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Edit Storage Quota</DialogTitle>
            <DialogDescription className="text-[12.5px]">
              Set storage quota for{' '}
              <span className="font-semibold text-foreground">{selectedUser?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current usage summary */}
            {selectedUser && (
              <div className="rounded-lg border border-border/60 bg-muted/50 px-4 py-3 space-y-2">
                {(() => {
                  const info = getUserStorageInfo(selectedUser.id);
                  const pct = info?.usedPercentage || 0;
                  return (
                    <>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-muted-foreground">Current usage</span>
                        <span className="font-semibold text-foreground">
                          {formatBytes(info?.usedBytes || 0)}
                        </span>
                      </div>
                      {!info?.isUnlimited && (
                        <>
                          <StorageBar pct={pct} loading={false} />
                          <div className="flex justify-between text-[11px] text-muted-foreground/60">
                            <span>{pct}% used</span>
                            <span>Quota: {formatBytes(info?.quotaBytes || 0)}</span>
                          </div>
                        </>
                      )}
                      {stats.storage && (
                        <div className="flex justify-between text-[11px] border-t border-border/40 pt-2 mt-1">
                          <span className="text-muted-foreground">System free</span>
                          <span className="font-medium text-foreground">
                            {formatBytes(stats.storage.system.freeBytes)}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="quota_value" className="text-[12.5px] font-medium">
                New Quota
              </Label>
              <div className="flex gap-2">
                <Input
                  id="quota_value"
                  type="number"
                  placeholder="0 = unlimited"
                  value={quotaValue}
                  onChange={(e) => setQuotaValue(e.target.value)}
                  className="flex-1 h-9 text-sm"
                  min="0"
                  step="0.01"
                />
                <Select
                  value={quotaUnit}
                  onValueChange={(v) => setQuotaUnit(v as typeof quotaUnit)}
                >
                  <SelectTrigger className="w-20 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MB">MB</SelectItem>
                    <SelectItem value="GB">GB</SelectItem>
                    <SelectItem value="TB">TB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">Set to 0 for unlimited storage.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuotaDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveQuota} disabled={savingQuota}>
              {savingQuota && <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Quota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
