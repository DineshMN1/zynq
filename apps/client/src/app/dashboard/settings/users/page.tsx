'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MoreVertical,
  Loader2,
  UserPlus,
  HardDrive,
  Users,
  Database,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { adminApi, storageApi, type User, type StorageOverview, type UserStorageInfo } from '@/lib/api';
import { cn } from '@/lib/utils';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [usersStorage, setUsersStorage] = useState<UserStorageInfo[]>([]);
  const [storageOverview, setStorageOverview] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page] = useState(1);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [quotaValue, setQuotaValue] = useState('');
  const [quotaUnit, setQuotaUnit] = useState<'GB' | 'MB' | 'TB'>('GB');
  const [savingQuota, setSavingQuota] = useState(false);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [savingRole, setSavingRole] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [usersRes, storageRes, usersStorageRes] = await Promise.all([
        adminApi.listUsers({ page, limit: 50 }),
        storageApi.getOverview(),
        storageApi.getAllUsersStorage(),
      ]);
      setUsers(usersRes.items);
      setStorageOverview(storageRes);
      setUsersStorage(usersStorageRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDeleteUser = (id: string) => {
    setDeleteUserId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeleteDialogOpen(false);
    try {
      await adminApi.deleteUser(deleteUserId);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
      setTimeout(loadData, 500);
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setDeleteUserId(null);
    }
  };

  const openQuotaDialog = (user: User) => {
    setSelectedUser(user);
    const storageInfo = usersStorage.find((s) => s.userId === user.id);
    if (storageInfo) {
      const quotaGB = storageInfo.quotaBytes / (1024 ** 3);
      if (quotaGB >= 1024) {
        setQuotaValue((quotaGB / 1024).toFixed(2));
        setQuotaUnit('TB');
      } else if (quotaGB >= 1) {
        setQuotaValue(quotaGB.toFixed(2));
        setQuotaUnit('GB');
      } else {
        setQuotaValue((storageInfo.quotaBytes / (1024 ** 2)).toFixed(2));
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
      await storageApi.updateUserQuota(selectedUser.id, quotaBytes);
      setQuotaDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to update quota:', error);
    } finally {
      setSavingQuota(false);
    }
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;
    setSavingRole(true);
    try {
      await adminApi.updateUser(selectedUser.id, { role: selectedRole });
      setRoleDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setSavingRole(false);
    }
  };

  const getUserStorageInfo = (userId: string) => {
    return usersStorage.find((s) => s.userId === userId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Users & Storage</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, permissions, and storage quotas
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
          <Button asChild>
            <Link href="/dashboard/settings/invites">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Link>
          </Button>
        </div>
      </div>

      {/* Storage Dashboard */}
      {storageOverview && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* System Storage Card */}
          <Card className="bg-card/50 border-border shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Storage</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <HardDrive className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(storageOverview.system.usedBytes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                of {formatBytes(storageOverview.system.totalBytes)} total
              </p>
              <Progress
                value={storageOverview.system.usedPercentage}
                className={cn(
                  'h-2 mt-4',
                  storageOverview.system.usedPercentage >= 90 && '[&>div]:bg-red-500',
                  storageOverview.system.usedPercentage >= 75 &&
                    storageOverview.system.usedPercentage < 90 &&
                    '[&>div]:bg-amber-500',
                  storageOverview.system.usedPercentage < 75 && '[&>div]:bg-primary'
                )}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {storageOverview.system.usedPercentage}% used
              </p>
            </CardContent>
          </Card>

          {/* Users Count Card */}
          <Card className="bg-card/50 border-border shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {users.filter((u) => u.role === 'admin' || u.role === 'owner').length} administrators
              </p>
              <div className="flex gap-2 mt-4 flex-wrap">
                <Badge variant="default" className="bg-primary/20 text-primary border-0">
                  {users.filter((u) => u.role === 'owner').length} owner
                </Badge>
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 border-0">
                  {users.filter((u) => u.role === 'admin').length} admin
                </Badge>
                <Badge variant="secondary">
                  {users.filter((u) => u.role === 'user').length} user
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Free Space Card */}
          <Card className="bg-card/50 border-border shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Free Space</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(storageOverview.system.freeBytes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">available for new files</p>
              {storageOverview.system.usedPercentage >= 90 && (
                <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-500">Storage critically low</span>
                </div>
              )}
              {storageOverview.system.usedPercentage >= 75 &&
                storageOverview.system.usedPercentage < 90 && (
                  <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-amber-500">Storage running low</span>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card className="bg-card/50 border-border shadow-lg overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-medium">Name</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Email</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Role</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Storage Used</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Quota</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Usage</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Joined</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const storageInfo = getUserStorageInfo(user.id);
                  const usedPercent = storageInfo?.usedPercentage || 0;
                  const isOverQuota = usedPercent >= 100;
                  const isNearQuota = usedPercent >= 80 && usedPercent < 100;

                  return (
                    <TableRow
                      key={user.id}
                      className="border-border hover:bg-secondary/50 transition-colors"
                    >
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === 'owner' ? 'default' : 'secondary'}
                          className={cn(
                            'capitalize',
                            user.role === 'owner' && 'bg-primary/20 text-primary border-0',
                            user.role === 'admin' && 'bg-amber-500/20 text-amber-500 border-0'
                          )}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={cn(isOverQuota && 'text-red-500 font-medium')}>
                          {formatBytes(storageInfo?.usedBytes || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {storageInfo?.isUnlimited ? (
                          <span className="text-primary font-medium">Unlimited</span>
                        ) : (
                          <span className="text-muted-foreground">{formatBytes(storageInfo?.quotaBytes || 0)}</span>
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
                              !isOverQuota && !isNearQuota && '[&>div]:bg-primary'
                            )}
                          />
                          <span
                            className={cn(
                              'text-xs mt-1 block',
                              isOverQuota && 'text-red-500',
                              isNearQuota && 'text-amber-500',
                              !isOverQuota && !isNearQuota && 'text-muted-foreground'
                            )}
                          >
                            {usedPercent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openRoleDialog(user)}
                              disabled={user.role === 'owner'}
                            >
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openQuotaDialog(user)}
                              disabled={user.role === 'owner'}
                            >
                              Update Quota
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-500 focus:text-red-500"
                              disabled={user.role === 'owner'}
                            >
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quota Editor Dialog */}
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
                    {formatBytes(getUserStorageInfo(selectedUser.id)?.usedBytes || 0)}
                  </span>
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter quota"
                value={quotaValue}
                onChange={(e) => setQuotaValue(e.target.value)}
                className="flex-1"
                min="0"
                step="0.01"
              />
              <Select value={quotaUnit} onValueChange={(v) => setQuotaUnit(v as typeof quotaUnit)}>
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
            <div className="flex gap-2 flex-wrap">
              {['5', '10', '50', '100'].map((val) => (
                <Button
                  key={val}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuotaValue(val);
                    setQuotaUnit('GB');
                  }}
                >
                  {val} GB
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuotaValue('1');
                  setQuotaUnit('TB');
                }}
              >
                1 TB
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuota} disabled={savingQuota}>
              {savingQuota && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Editor Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">
                  <div className="flex flex-col">
                    <span>User</span>
                    <span className="text-xs text-muted-foreground">
                      Standard access, subject to storage quota
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex flex-col">
                    <span>Admin</span>
                    <span className="text-xs text-muted-foreground">
                      Can manage users and invites
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={savingRole}>
              {savingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteUserId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteUser}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
