import { useState, useEffect, useCallback } from 'react';
import { spaceApi, type SpaceActivity } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, Upload, Trash2, Pencil, UserPlus, UserMinus, UserCog } from 'lucide-react';
import { getInitials } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ToastContainer } from '@/components/toast-container';

const ACTION_ICON: Record<string, React.ElementType> = {
  upload: Upload,
  delete: Trash2,
  rename: Pencil,
  move: Pencil,
  member_added: UserPlus,
  member_removed: UserMinus,
  member_role_changed: UserCog,
};

const ACTION_LABEL: Record<string, string> = {
  upload: 'uploaded',
  delete: 'deleted',
  rename: 'renamed',
  move: 'moved',
  member_added: 'added a member',
  member_removed: 'removed a member',
  member_role_changed: 'updated a member role',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TeamActivityPage() {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [activities, setActivities] = useState<SpaceActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 30;

  useEffect(() => {
    spaceApi.list()
      .then((spaces) => {
        if (spaces.length > 0) {
          setSpaceId(spaces[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const loadActivity = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const res = await spaceApi.getActivity(spaceId, { page, limit });
      setActivities(res.items ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [spaceId, page]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full">
      <ToastContainer />

      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border shrink-0">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-[15px] font-semibold">Activity</h1>
        {total > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {total}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Clock className="h-10 w-10 opacity-20" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-0.5">
            {activities.map((act) => {
              const ActionIcon = ACTION_ICON[act.action] ?? Clock;
              const label = ACTION_LABEL[act.action] ?? act.action;
              const userName = act.user?.name ?? 'Someone';
              const isFileAction = !!act.file_name;

              return (
                <div
                  key={act.id}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2.5 rounded-lg',
                    'hover:bg-muted/50 transition-colors',
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-semibold">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug">
                      <span className="font-medium">{userName}</span>
                      {' '}
                      <span className="text-muted-foreground">{label}</span>
                      {isFileAction && (
                        <>
                          {' '}
                          <span className="font-medium truncate">{act.file_name}</span>
                        </>
                      )}
                      {act.action === 'rename' && typeof act.details?.old_name === 'string' && (
                        <span className="text-muted-foreground text-xs ml-1">
                          (was {act.details.old_name})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ActionIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(act.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
