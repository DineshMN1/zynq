import { useState, useEffect, useCallback } from 'react';
import { spaceApi, type SpaceMember, ApiError } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Users2, Loader2, UserMinus } from 'lucide-react';
import { getInitials } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';
import { useAuth } from '@/context/AuthContext';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  contributor: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
  viewer: 'bg-muted text-muted-foreground border-border',
};

export default function TeamMembersPage() {
  const { user: currentUser } = useAuth();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<SpaceMember | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const [noSpace, setNoSpace] = useState(false);

  useEffect(() => {
    spaceApi.list()
      .then((spaces) => {
        if (spaces.length > 0) {
          setSpaceId(spaces[0].id);
        } else {
          setNoSpace(true);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const loadMembers = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const data = await spaceApi.listMembers(spaceId);
      setMembers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const handleRoleChange = async (member: SpaceMember, newRole: string) => {
    if (!spaceId) return;
    setUpdatingRole(member.user_id);
    try {
      await spaceApi.updateMember(spaceId, member.user_id, newRole);
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id
            ? { ...m, role: newRole as SpaceMember['role'] }
            : m,
        ),
      );
      toast({ title: 'Role updated' });
    } catch (err) {
      toast({
        title: 'Failed to update role',
        description: err instanceof ApiError ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleRemove = async () => {
    if (!spaceId || !removeTarget) return;
    try {
      await spaceApi.removeMember(spaceId, removeTarget.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== removeTarget.user_id));
      toast({ title: 'Member removed' });
      setRemoveTarget(null);
    } catch (err) {
      toast({
        title: 'Failed to remove member',
        description: err instanceof ApiError ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  if (noSpace) {
    return (
      <div className="flex flex-col h-full">
        <ToastContainer />
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <Users2 className="h-10 w-10 opacity-20" />
          <p className="text-sm">No team space available</p>
          <p className="text-xs text-center max-w-xs">Ask your administrator to create a team space.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ToastContainer />

      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border shrink-0">
        <Users2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-[15px] font-semibold">Members</h1>
        {members.length > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {members.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Users2 className="h-10 w-10 opacity-20" />
            <p className="text-sm">No members yet</p>
          </div>
        ) : (
          <div className="max-w-2xl divide-y divide-border rounded-lg border border-border overflow-hidden">
            {members.map((member) => {
              const name = member.user?.name ?? 'Unknown';
              const email = member.user?.email ?? '';
              const isSelf = member.user_id === currentUser?.id;

              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[11px] bg-primary/15 text-primary font-semibold">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate">
                      {name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">(you)</span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate">{email}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && !isSelf ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => void handleRoleChange(member, v)}
                        disabled={updatingRole === member.user_id}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="contributor">Contributor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`text-[11px] capitalize ${ROLE_COLORS[member.role] ?? ''}`}
                      >
                        {member.role}
                      </Badge>
                    )}

                    {isAdmin && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveTarget(member)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.user?.name}</strong> will lose access to the Team space.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
