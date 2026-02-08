'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
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
  RefreshCw,
  Mail,
  Copy,
  Check,
  XCircle,
} from 'lucide-react';
import {
  adminApi,
  storageApi,
  inviteApi,
  type User,
  type UserStorageInfo,
  type Invitation,
  type StorageOverview,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';

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
  const [storageOverview, setStorageOverview] =
    useState<StorageOverview | null>(null);
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

  // Invite state
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user' });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [revokeInviteDialogOpen, setRevokeInviteDialogOpen] = useState(false);
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString() : '-';

  const loadInvites = useCallback(async () => {
    try {
      setLoadingInvites(true);
      const data = await inviteApi.list();
      setInvites(data);
    } catch (error) {
      console.error('Failed to load invites:', error);
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  const buildInviteLink = (invite: Invitation & { link?: string }) => {
    if (invite.link) return invite.link;
    if (invite.token)
      return `${window.location.origin}/register?inviteToken=${invite.token}`;
    if (invite.id)
      return `${window.location.origin}/register?invite=${invite.id}`;
    const identifier = invite.email || invite.id || invite.token || 'unknown';
    throw new Error(
      `Invite link unavailable: invite id/token/link required (invite: ${identifier}).`,
    );
  };

  const handleCreateInvite = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    if (!inviteForm.email || !isValidEmail(inviteForm.email)) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    setCreatingInvite(true);
    try {
      const invite = await inviteApi.create({
        email: inviteForm.email,
        role: inviteForm.role,
      });
      await loadInvites();
      setInviteForm({ email: '', role: 'user' });
      setInviteSuccess('Invite created.');

      let link: string | null = null;
      try {
        link = buildInviteLink(invite);
        if (
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === 'function'
        ) {
          await navigator.clipboard.writeText(link);
          setCopiedInviteId(invite.id);
          setTimeout(() => setCopiedInviteId(null), 3000);
          setInviteSuccess('Invite created and link copied to clipboard.');
        } else {
          window.prompt('Copy invite link', link);
        }
      } catch (error) {
        console.warn('Failed to copy invite link:', error);
        if (link) {
          window.prompt('Copy invite link', link);
        }
      }

      if (invite.email_sent) {
        toast({
          title: 'Invite email sent',
          description: invite.email_message || 'Invitation email delivered.',
          variant: 'success',
        });
      } else {
        toast({
          title: 'Invite created — email delivery failed',
          description:
            invite.email_message || 'Failed to send invitation email.',
          variant: 'warning',
        });
      }

      setInviteDialogOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create invite.';
      setInviteError(message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInviteLink = async (invite: Invitation) => {
    let link: string | null = null;
    try {
      link = buildInviteLink(invite);
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(link);
        setCopiedInviteId(invite.id);
        setTimeout(() => setCopiedInviteId(null), 3000);
      } else {
        window.prompt('Copy invite link', link);
      }
    } catch {
      window.prompt('Copy invite link', link ?? '');
    }
  };

  const handleRevokeInvite = (id: string) => {
    setSelectedInviteId(id);
    setRevokeInviteDialogOpen(true);
  };

  const confirmRevokeInvite = async () => {
    if (!selectedInviteId) return;
    try {
      setRevokingInviteId(selectedInviteId);
      await inviteApi.revoke(selectedInviteId);
      await loadInvites();
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    } finally {
      setRevokingInviteId(null);
      setRevokeInviteDialogOpen(false);
      setSelectedInviteId(null);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [usersRes, usersStorageRes, overviewRes] = await Promise.all([
        adminApi.listUsers({ page, limit: 50 }),
        storageApi.getAllUsersStorage(),
        storageApi.getOverview(),
      ]);
      setUsers(usersRes.items);
      setUsersStorage(usersStorageRes);
      setStorageOverview(overviewRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => {
    loadData();
    loadInvites();
    const interval = setInterval(() => {
      loadData();
      loadInvites();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, loadInvites]);

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
      const availableBytes = storageOverview?.system.freeBytes ?? 0;
      const maxAllowed = usedBytes + availableBytes;

      if (quotaBytes !== 0 && quotaBytes < usedBytes) {
        toast({
          title: 'Quota too low',
          description: 'Quota cannot be lower than current usage.',
          variant: 'warning',
        });
        setSavingQuota(false);
        return;
      }

      if (quotaBytes !== 0 && quotaBytes > maxAllowed) {
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
      loadData();
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
      <ToastContainer />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage users and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
            />
          </Button>
          <Dialog
            open={inviteDialogOpen}
            onOpenChange={(open) => {
              setInviteDialogOpen(open);
              if (!open) {
                setInviteError(null);
                setInviteSuccess(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Invitation</DialogTitle>
                <DialogDescription>
                  Send an invitation link to a new user
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {inviteError && (
                  <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div className="p-2 rounded bg-primary/10 text-primary text-sm">
                    {inviteSuccess}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value) =>
                      setInviteForm({ ...inviteForm, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateInvite}
                  disabled={creatingInvite || !isValidEmail(inviteForm.email)}
                >
                  {creatingInvite && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create & Copy Link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                    Joined
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  return (
                    <TableRow
                      key={user.id}
                      className="border-border hover:bg-secondary/50 transition-colors"
                    >
                      <TableCell className="font-medium">{user.name}</TableCell>
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
                      <TableCell className="text-muted-foreground">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
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

      {/* Pending Invites Section */}
      <Card className="bg-card/50 border-border shadow-lg overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Invitations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingInvites ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : invites.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No pending invites. Click &quot;Invite User&quot; to send one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-medium">
                      Email
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Role
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Created
                    </TableHead>
                    <TableHead className="text-muted-foreground font-medium">
                      Expires
                    </TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow
                      key={invite.id}
                      className="border-border hover:bg-secondary/50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        {invite.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invite.status === 'pending'
                              ? 'default'
                              : invite.status === 'accepted'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="capitalize"
                        >
                          {invite.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(invite.created_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(invite.expires_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopyInviteLink(invite)}
                            disabled={invite.status !== 'pending'}
                          >
                            {copiedInviteId === invite.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          {invite.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleRevokeInvite(invite.id)}
                              disabled={revokingInviteId === invite.id}
                            >
                              {revokingInviteId === invite.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
                    {formatBytes(
                      getUserStorageInfo(selectedUser.id)?.usedBytes || 0,
                    )}
                  </span>
                </p>
                {storageOverview && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Available system free:{' '}
                    <span className="font-medium text-foreground">
                      {formatBytes(storageOverview.system.freeBytes)}
                    </span>
                  </p>
                )}
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
              This will permanently delete the user account and all associated
              data. This action cannot be undone.
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

      {/* Revoke Invite Confirmation */}
      <AlertDialog
        open={revokeInviteDialogOpen}
        onOpenChange={setRevokeInviteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invite?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invite? The invitation link
              will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeInvite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
