'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Mail, Loader2, Copy, Check, XCircle } from 'lucide-react';
import { inviteApi, type Invitation } from '@/lib/api';

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', role: 'user' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString() : '-';

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const loadInvites = async () => {
    try {
      setLoading(true);
      clearMessages();
      const data = await inviteApi.list();
      setInvites(data);
    } catch (error: any) {
      console.error('Failed to load invites:', error);
      setErrorMessage(
        error?.message || 'Failed to load invites. Check your network/auth.'
      );
    } finally {
      setLoading(false);
    }
  };

const buildInviteLink = (invite: Invitation) => {
  if ((invite as any).link) return (invite as any).link;
  if (invite.token) return `${window.location.origin}/register?inviteToken=${invite.token}`;
  if (invite.id) return `${window.location.origin}/register?inviteId=${invite.id}`;
  return window.location.origin;
};


  const handleCreateInvite = async () => {
    clearMessages();
    if (!formData.email || !isValidEmail(formData.email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setCreating(true);
    try {
      const invite = await inviteApi.create({
        email: formData.email,
        role: formData.role,
      });

      // for debugging - check backend response shape
      console.log('invite created:', invite);

      // refresh list AFTER server successfully creates invite
      await loadInvites();

      // build link and copy
      const link = buildInviteLink(invite);
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(link);
          setCopiedId(invite.id);
          setTimeout(() => setCopiedId(null), 3000);
          setSuccessMessage('Invite created and link copied to clipboard.');
        } else {
          // fallback: prompt the user with the link
          // (use window.prompt so the user can copy manually)
          // eslint-disable-next-line no-alert
          window.prompt('Copy invite link', link);
          setSuccessMessage('Invite created. Please copy the link from the prompt.');
        }
      } catch (writeErr) {
        console.error('Clipboard write failed', writeErr);
        // fallback to prompt
        // eslint-disable-next-line no-alert
        window.prompt('Copy invite link', link);
        setSuccessMessage('Invite created. Please copy the link from the prompt.');
      }

      // Reset form + close dialog
      setFormData({ email: '', role: 'user' });
      setDialogOpen(false);
    } catch (err: any) {
      console.error('Failed to create invite:', err);
      // give actionable error if backend returned JSON
      setErrorMessage(
        err?.message ||
          'Failed to create invite. Check that you are authenticated and your backend is reachable.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (invite: Invitation) => {
    clearMessages();
    const link = buildInviteLink(invite);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(link);
        setCopiedId(invite.id);
        setTimeout(() => setCopiedId(null), 3000);
        setSuccessMessage('Invite link copied.');
      } else {
        // fallback prompt
        // eslint-disable-next-line no-alert
        window.prompt('Copy invite link', link);
      }
    } catch (err) {
      console.error('Copy failed', err);
      // fallback prompt
      // eslint-disable-next-line no-alert
      window.prompt('Copy invite link', link);
      setErrorMessage('Failed to copy link automatically — use the prompt to copy.');
    }
  };

  const handleRevokeInvite = async (id: string) => {
    clearMessages();
    if (!confirm('Are you sure you want to revoke this invite?')) return;
    try {
      setRevokingId(id);
      await inviteApi.revoke(id);
      setSuccessMessage('Invite revoked.');
      await loadInvites();
    } catch (err) {
      console.error('Failed to revoke invite:', err);
      setErrorMessage('Failed to revoke invite. Check your network/auth.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Pending Invites</h1>
          <p className="text-muted-foreground mt-1">
            Manage and send invitations to new users
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) clearMessages();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="mr-2 h-4 w-4" />
              Create Invite
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Invitation</DialogTitle>
              <DialogDescription>Send an invitation link to a new user</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {errorMessage && (
                <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-2 rounded bg-primary/10 text-primary text-sm">
                  {successMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
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
                disabled={creating || !isValidEmail(formData.email)}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Copy Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* messages above list */}
      {errorMessage && (
        <div className="p-3 rounded bg-destructive/10 text-destructive text-sm max-w-3xl">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3 rounded bg-primary/10 text-primary text-sm max-w-3xl">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : invites.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No pending invites</h3>
              <p className="text-sm text-muted-foreground">Create an invite to get started</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
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
                  <TableCell>{formatDate(invite.created_at)}</TableCell>
                  <TableCell>{formatDate(invite.expires_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyLink(invite)}
                        disabled={invite.status !== 'pending'}
                      >
                        {copiedId === invite.id ? (
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
                          disabled={revokingId === invite.id}
                        >
                          {revokingId === invite.id ? (
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
        </Card>
      )}
    </div>
  );
}
