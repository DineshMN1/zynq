import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LogIn,
  LogOut,
  AlertTriangle,
  Upload,
  Trash2,
  RotateCcw,
  Share2,
  ShieldOff,
  Eye,
  UserPlus,
  UserX,
  UserCog,
  KeyRound,
  FolderPlus,
  RefreshCw,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { auditApi, type AuditLogEntry } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Action metadata ────────────────────────────────────────────────────────

interface ActionMeta {
  label: string;
  icon: React.ElementType;
  color: string;       // Tailwind text color
  bg: string;          // Tailwind bg color for badge
}

const ACTION_META: Record<string, ActionMeta> = {
  // Auth
  'auth.login':           { label: 'Login',           icon: LogIn,      color: 'text-green-500',  bg: 'bg-green-500/10' },
  'auth.login_failed':    { label: 'Login Failed',    icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
  'auth.logout':          { label: 'Logout',          icon: LogOut,     color: 'text-slate-400',  bg: 'bg-slate-500/10' },
  'auth.password_change': { label: 'Password Change', icon: KeyRound,   color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  'auth.password_reset':  { label: 'Password Reset',  icon: KeyRound,   color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  // Files
  'file.upload':          { label: 'Upload',          icon: Upload,     color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  'file.delete':          { label: 'Delete',          icon: Trash2,     color: 'text-red-500',    bg: 'bg-red-500/10' },
  'file.restore':         { label: 'Restore',         icon: RotateCcw,  color: 'text-teal-500',   bg: 'bg-teal-500/10' },
  'file.rename':          { label: 'Rename',          icon: RefreshCw,  color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  'file.move':            { label: 'Move',            icon: RefreshCw,  color: 'text-violet-400', bg: 'bg-violet-500/10' },
  'folder.create':        { label: 'New Folder',      icon: FolderPlus, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  // Shares
  'share.create':         { label: 'Share Created',   icon: Share2,     color: 'text-cyan-500',   bg: 'bg-cyan-500/10' },
  'share.revoke':         { label: 'Share Revoked',   icon: ShieldOff,  color: 'text-orange-500', bg: 'bg-orange-500/10' },
  'share.access':         { label: 'Share Accessed',  icon: Eye,        color: 'text-slate-400',  bg: 'bg-slate-500/10' },
  // Users
  'user.register':        { label: 'Registered',      icon: UserPlus,   color: 'text-green-500',  bg: 'bg-green-500/10' },
  'user.invite':          { label: 'Invited',         icon: UserPlus,   color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  'user.delete':          { label: 'User Deleted',    icon: UserX,      color: 'text-red-500',    bg: 'bg-red-500/10' },
  'user.role_change':     { label: 'Role Changed',    icon: UserCog,    color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  'user.quota_change':    { label: 'Quota Changed',   icon: UserCog,    color: 'text-amber-500',  bg: 'bg-amber-500/10' },
};

const ALL_ACTIONS = Object.keys(ACTION_META);

function getMeta(action: string): ActionMeta {
  return (
    ACTION_META[action] ?? {
      label: action,
      icon: RefreshCw,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    }
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ActionBadge({ action }: { action: string }) {
  const meta = getMeta(action);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium',
        meta.color,
        meta.bg,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {meta.label}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        page,
        limit,
        search: search || undefined,
        action: filterAction === 'all' ? undefined : filterAction,
      });
      setLogs(res.items ?? []);
      setTotal(res.meta?.total ?? 0);
      setTotalPages(res.meta?.pages ?? 1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterAction]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterAction]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Audit Log</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {total.toLocaleString()} event{total !== 1 ? 's' : ''} recorded
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search user, file…"
                className="pl-8 h-8 w-52 text-sm"
              />
            </div>
          </form>

          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ALL_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {getMeta(a).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="h-8" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Eye className="h-10 w-10 opacity-20" />
            <p className="text-sm">No audit events found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground w-40">Time</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground w-44">Action</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground w-44">User</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">Resource</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground w-32">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                  {/* Time */}
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap font-mono">
                    {formatTime(log.created_at)}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-2.5">
                    <ActionBadge action={log.action} />
                  </td>

                  {/* User */}
                  <td className="px-4 py-2.5">
                    {log.user_name || log.user_email ? (
                      <div>
                        <p className="text-[12.5px] font-medium leading-tight truncate max-w-[160px]">
                          {log.user_name || '—'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                          {log.user_email}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[12px]">Anonymous</span>
                    )}
                  </td>

                  {/* Resource */}
                  <td className="px-4 py-2.5">
                    {log.resource_name ? (
                      <div className="flex items-center gap-1.5">
                        {log.resource_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide font-medium shrink-0">
                            {log.resource_type}
                          </span>
                        )}
                        <span className="text-[12.5px] truncate max-w-xs" title={log.resource_name}>
                          {log.resource_name}
                        </span>
                      </div>
                    ) : log.metadata ? (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {Object.entries(log.metadata)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[12px]">—</span>
                    )}
                  </td>

                  {/* IP */}
                  <td className="px-4 py-2.5 text-[11.5px] text-muted-foreground font-mono">
                    {log.ip_address || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0">
          <span className="text-[12px] text-muted-foreground">
            Page {page} of {totalPages} · {total.toLocaleString()} events
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
