'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  HardDrive,
  Users,
  Database,
  Activity,
  Server,
  RefreshCw,
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
}

export default function MonitoringPage() {
  const [stats, setStats] = useState<SystemStats>({
    storage: null,
    users: [],
    usersStorage: [],
    loading: true,
  });
  const [refreshing, setRefreshing] = useState(false);
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
      });
    } catch (error) {
      console.error('Failed to load monitoring stats:', error);
      setStats((prev) => ({ ...prev, loading: false }));
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

  const systemUsedPercentage = stats.storage?.system
    ? Math.round(
        (stats.storage.system.usedBytes / stats.storage.system.totalBytes) *
          100,
      )
    : 0;

  const getStorageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 75) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '[&>div]:bg-red-500';
    if (percentage >= 75) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-emerald-500';
  };

  const getUserStorageInfo = (userId: string) => {
    return stats.usersStorage.find((s) => s.userId === userId);
  };

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
        toast({
          title: 'Quota too low',
          description: 'Quota cannot be lower than current usage.',
          variant: 'warning',
        });
        setSavingQuota(false);
        return;
      }

      if (
        quotaBytes !== 0 &&
        availableBytes != null &&
        quotaBytes > usedBytes + availableBytes
      ) {
        const maxAllowed = usedBytes + availableBytes;
        toast({
          title: 'Quota exceeds available storage',
          description: `Max allowed is ${formatBytes(maxAllowed)} based on free space.`,
          variant: 'warning',
        });
        setSavingQuota(false);
        return;
      }

      await storageApi.updateUserQuota(selectedUser.id, quotaBytes);
      setQuotaDialogOpen(false);
      await loadStats();
    } catch (error) {
      console.error('Failed to update quota:', error);
      toast({
        title: 'Failed to update quota',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingQuota(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ToastContainer />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            System overview and resource usage
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* System Storage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              System Storage
            </CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats.storage
                    ? formatBytes(stats.storage.system.usedBytes)
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  of{' '}
                  {stats.storage
                    ? formatBytes(stats.storage.system.totalBytes)
                    : '—'}{' '}
                  used
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Free Space */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Space</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div
                  className={cn(
                    'text-2xl font-bold',
                    getStorageColor(systemUsedPercentage),
                  )}
                >
                  {stats.storage
                    ? formatBytes(stats.storage.system.freeBytes)
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {100 - systemUsedPercentage}% available
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.users.length}</div>
                <p className="text-xs text-muted-foreground">
                  Registered accounts
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-500">
                  Online
                </div>
                <p className="text-xs text-muted-foreground">
                  All services running
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Storage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Storage Overview
          </CardTitle>
          <CardDescription>
            Detailed breakdown of system storage usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stats.loading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : stats.storage ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">System Disk</span>
                <span
                  className={cn(
                    'font-medium',
                    getStorageColor(systemUsedPercentage),
                  )}
                >
                  {systemUsedPercentage}% used
                </span>
              </div>
              <Progress
                value={systemUsedPercentage}
                className={cn('h-3', getProgressColor(systemUsedPercentage))}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Used: {formatBytes(stats.storage.system.usedBytes)}</span>
                <span>Free: {formatBytes(stats.storage.system.freeBytes)}</span>
                <span>
                  Total: {formatBytes(stats.storage.system.totalBytes)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Unable to load storage information
            </p>
          )}
        </CardContent>
      </Card>

      {/* Users Storage Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Storage Usage
          </CardTitle>
          <CardDescription>Storage usage breakdown by user</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {stats.loading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-medium">
                      Name
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Email
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Role
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Storage Used
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Quota
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Usage
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.users.map((user) => {
                    const storageInfo = getUserStorageInfo(user.id);
                    const usedPercent = storageInfo?.usedPercentage || 0;
                    const isOverQuota = usedPercent >= 100;
                    const isNearQuota = usedPercent >= 80 && usedPercent < 100;

                    return (
                      <TableRow
                        key={user.id}
                        className="border-border hover:bg-secondary/50 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.role === 'owner' ? 'default' : 'secondary'
                            }
                            className={cn(
                              'capitalize',
                              user.role === 'owner' &&
                                'bg-primary/20 text-primary border-0',
                              user.role === 'admin' &&
                                'bg-amber-500/20 text-amber-500 border-0',
                            )}
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              isOverQuota && 'text-red-500 font-medium',
                            )}
                          >
                            {formatBytes(storageInfo?.usedBytes || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {storageInfo?.isUnlimited ? (
                            <span className="text-primary font-medium">
                              Unlimited
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {formatBytes(storageInfo?.quotaBytes || 0)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="w-28">
                            <Progress
                              value={Math.min(usedPercent, 100)}
                              className={cn(
                                'h-2',
                                isOverQuota && '[&>div]:bg-red-500',
                                isNearQuota && '[&>div]:bg-amber-500',
                                !isOverQuota &&
                                  !isNearQuota &&
                                  '[&>div]:bg-primary',
                              )}
                            />
                            <span
                              className={cn(
                                'text-xs mt-1 block',
                                isOverQuota && 'text-red-500',
                                isNearQuota && 'text-amber-500',
                                !isOverQuota &&
                                  !isNearQuota &&
                                  'text-muted-foreground',
                              )}
                            >
                              {usedPercent}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openQuotaDialog(user)}
                          >
                            Edit quota
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Storage Quota</DialogTitle>
            <DialogDescription>
              Set the storage quota for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedUser && (
              <div className="px-3 py-2 rounded-lg bg-muted border border-border">
                <p className="text-sm text-muted-foreground">
                  Current usage:{' '}
                  <span className="font-medium text-foreground">
                    {formatBytes(
                      getUserStorageInfo(selectedUser.id)?.usedBytes || 0,
                    )}
                  </span>
                </p>
                {stats.storage && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Available system free:{' '}
                    <span className="font-medium text-foreground">
                      {formatBytes(stats.storage.system.freeBytes)}
                    </span>
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="quota_value">Quota</Label>
              <div className="flex gap-2">
                <Input
                  id="quota_value"
                  type="number"
                  placeholder="Enter quota"
                  value={quotaValue}
                  onChange={(e) => setQuotaValue(e.target.value)}
                  className="flex-1"
                  min="0"
                  step="0.01"
                />
                <Select
                  value={quotaUnit}
                  onValueChange={(v) => setQuotaUnit(v as typeof quotaUnit)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MB">MB</SelectItem>
                    <SelectItem value="GB">GB</SelectItem>
                    <SelectItem value="TB">TB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuota} disabled={savingQuota}>
              {savingQuota && <span className="mr-2">...</span>}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
