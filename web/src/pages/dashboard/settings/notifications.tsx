import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Plus, Pencil, Trash2, Loader2, XCircle,
  Mail, Send, Webhook, CheckCircle2, ChevronLeft, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  notificationChannelApi,
  ALL_NOTIFICATION_ACTIONS,
  type NotificationChannel,
  type NotificationChannelType,
  ApiError,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChannelConfig = Record<string, unknown>;

// ── Provider definitions ──────────────────────────────────────────────────────

interface ProviderMeta {
  type: NotificationChannelType;
  label: string;
  subtitle: string;
  color: string;
  defaultActions: string[];
  defaultConfig: ChannelConfig;
  icon: React.ReactNode;
}

const PROVIDER_META: ProviderMeta[] = [
  {
    type: 'email',
    label: 'Email',
    subtitle: 'SMTP',
    color: 'bg-blue-500/10 text-blue-500',
    defaultActions: ['user_invited'],
    defaultConfig: { smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', from: '', to_addresses: [''] },
    icon: <Mail className="h-5 w-5" />,
  },
  {
    type: 'teams',
    label: 'Microsoft Teams',
    subtitle: 'Webhook',
    color: 'bg-[#6264A7]/10 text-[#6264A7]',
    defaultActions: [],
    defaultConfig: { webhook_url: '' },
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#6264A7]">
        <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm-4.75 3.5a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5zM17 16h-4.5v-4h-1V16H9v-5.5A2.5 2.5 0 0111.5 8H13a2.5 2.5 0 012.5 2.5V11H17v5z" />
      </svg>
    ),
  },
  {
    type: 'resend',
    label: 'Resend',
    subtitle: 'API',
    color: 'bg-orange-500/10 text-orange-500',
    defaultActions: ['storage_warning'],
    defaultConfig: { api_key: '', from: '', to_addresses: [''] },
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v1.5L12 13 3 6.5V5zm0 3.5V19a2 2 0 002 2h14a2 2 0 002-2V8.5L12 15 3 8.5z" />
      </svg>
    ),
  },
];

function getProviderMeta(type: NotificationChannelType): ProviderMeta {
  return PROVIDER_META.find((p) => p.type === type) ?? PROVIDER_META[0];
}

// ── Multi-address input ───────────────────────────────────────────────────────

function MultiAddressInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const items = values.length > 0 ? values : [''];

  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };

  const remove = (i: number) => {
    if (items.length <= 1) {
      onChange(['']);
    } else {
      onChange(items.filter((_, j) => j !== i));
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {items.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            type="email"
            placeholder="email@example.com"
            value={v}
            onChange={(e) => update(i, e.target.value)}
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 h-9 px-3"
            onClick={() => remove(i)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onChange([...items, ''])}
      >
        Add
      </Button>
    </div>
  );
}

// ── Provider-specific config forms ───────────────────────────────────────────

function EmailConfigForm({
  config,
  onChange,
}: {
  config: ChannelConfig;
  onChange: (c: ChannelConfig) => void;
}) {
  const [showPass, setShowPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const toAddresses = (config.to_addresses as string[] | undefined) ?? [''];

  const passValue = (config.smtp_pass as string) ?? '';
  const isRedacted = passValue === '••••••••';
  const showSavedState = isRedacted && !changingPass;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">SMTP Server</Label>
          <Input
            placeholder="smtp.gmail.com"
            value={(config.smtp_host as string) ?? ''}
            onChange={(e) => onChange({ ...config, smtp_host: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">SMTP Port</Label>
          <Input
            type="number"
            placeholder="587"
            value={(config.smtp_port as string) ?? '587'}
            onChange={(e) => onChange({ ...config, smtp_port: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Username</Label>
          <Input
            placeholder="user@gmail.com"
            value={(config.smtp_user as string) ?? ''}
            onChange={(e) => onChange({ ...config, smtp_user: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Password</Label>
            {showSavedState && (
              <button
                type="button"
                onClick={() => { setChangingPass(true); onChange({ ...config, smtp_pass: '' }); setShowPass(false); }}
                className="text-[11px] text-primary hover:underline"
              >
                Change
              </button>
            )}
          </div>
          {showSavedState ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
              <span className="flex-1 text-xs">Password saved</span>
            </div>
          ) : (
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter password"
                value={changingPass ? passValue : passValue}
                onChange={(e) => onChange({ ...config, smtp_pass: e.target.value })}
                className="h-9 text-sm pr-9"
                autoFocus={changingPass}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">From Address</Label>
        <Input
          placeholder="from@example.com"
          value={(config.from as string) ?? ''}
          onChange={(e) => onChange({ ...config, from: e.target.value })}
          className="h-9 text-sm"
        />
      </div>
      <MultiAddressInput
        label="To Addresses"
        values={toAddresses}
        onChange={(addrs) => onChange({ ...config, to_addresses: addrs })}
      />
    </div>
  );
}

function TeamsConfigForm({
  config,
  onChange,
}: {
  config: ChannelConfig;
  onChange: (c: ChannelConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Webhook URL</Label>
        <Input
          type="url"
          placeholder="https://xxx.webhook.office.com/webhookb2/..."
          value={(config.webhook_url as string) ?? ''}
          onChange={(e) => onChange({ ...config, webhook_url: e.target.value })}
          className="h-9 text-sm font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground leading-snug">
          Incoming Webhook URL from a Teams channel. Add an Incoming Webhook in your channel settings to get the URL.
        </p>
      </div>
    </div>
  );
}

function ResendConfigForm({
  config,
  onChange,
}: {
  config: ChannelConfig;
  onChange: (c: ChannelConfig) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [changingKey, setChangingKey] = useState(false);
  const toAddresses = (config.to_addresses as string[] | undefined) ?? [''];

  const apiKeyValue = (config.api_key as string) ?? '';
  const isRedacted = apiKeyValue === '••••••••';
  const showSavedState = isRedacted && !changingKey;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">API Key</Label>
          {showSavedState && (
            <button
              type="button"
              onClick={() => { setChangingKey(true); onChange({ ...config, api_key: '' }); setShowKey(false); }}
              className="text-[11px] text-primary hover:underline"
            >
              Change
            </button>
          )}
        </div>
        {showSavedState ? (
          <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
            <span className="flex-1 text-xs">API key saved</span>
          </div>
        ) : (
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="re_xxxxxxxxxxxxxxxxxxxx"
              value={apiKeyValue}
              onChange={(e) => onChange({ ...config, api_key: e.target.value })}
              className="h-9 text-sm pr-9 font-mono"
              autoFocus={changingKey}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">From Address</Label>
        <Input
          placeholder="ZynqCloud <no-reply@yourdomain.com>"
          value={(config.from as string) ?? ''}
          onChange={(e) => onChange({ ...config, from: e.target.value })}
          className="h-9 text-sm"
        />
      </div>
      <MultiAddressInput
        label="To Addresses"
        values={toAddresses}
        onChange={(addrs) => onChange({ ...config, to_addresses: addrs })}
      />
    </div>
  );
}

function ProviderConfigForm({
  type,
  config,
  onChange,
}: {
  type: NotificationChannelType;
  config: ChannelConfig;
  onChange: (c: ChannelConfig) => void;
}) {
  if (type === 'email') return <EmailConfigForm config={config} onChange={onChange} />;
  if (type === 'teams') return <TeamsConfigForm config={config} onChange={onChange} />;
  if (type === 'resend') return <ResendConfigForm config={config} onChange={onChange} />;
  return null;
}

// ── Channel card ──────────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  onEdit,
  onDelete,
  onToggle,
}: {
  channel: NotificationChannel;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const meta = getProviderMeta(channel.type);
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta.color)}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{channel.name}</p>
        <p className="text-xs text-muted-foreground">{meta.label} · {meta.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={channel.enabled} onCheckedChange={onToggle} />
        <button onClick={onEdit} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Add/Edit dialog ───────────────────────────────────────────────────────────

type DialogMode = 'select' | 'configure';

function ChannelDialog({
  open,
  editing,
  onClose,
  onSaved,
  onCreated,
}: {
  open: boolean;
  editing: NotificationChannel | null;
  onClose: () => void;
  onSaved: (ch: NotificationChannel) => void;
  onCreated?: (ch: NotificationChannel) => void;
}) {
  const [mode, setMode] = useState<DialogMode>(editing ? 'configure' : 'select');
  const [selectedType, setSelectedType] = useState<NotificationChannelType | null>(
    editing ? editing.type : null,
  );
  const [name, setName] = useState(editing?.name ?? '');
  const [config, setConfig] = useState<ChannelConfig>(
    (editing?.config as ChannelConfig) ?? {},
  );
  const [actions, setActions] = useState<string[]>(editing?.actions ?? []);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  // Tracks a channel that was auto-saved during the Test flow (new channel only)
  const [savedChannel, setSavedChannel] = useState<NotificationChannel | null>(null);

  // The "effective" channel: prefer one saved during this session over the editing prop
  const effectiveChannel = savedChannel ?? editing;

  useEffect(() => {
    if (open) {
      setMode(editing ? 'configure' : 'select');
      setSelectedType(editing ? editing.type : null);
      setName(editing?.name ?? '');
      setConfig((editing?.config as ChannelConfig) ?? {});
      setActions(editing?.actions ?? []);
      setSaving(false);
      setTesting(false);
      setTestResult(null);
      setSavedChannel(null);
    }
  }, [open, editing]);

  const meta = selectedType ? getProviderMeta(selectedType) : null;

  const selectProvider = (p: ProviderMeta) => {
    setSelectedType(p.type);
    setConfig(p.defaultConfig);
    setActions(p.defaultActions);
    setName('');
    setMode('configure');
  };

  const toggleAction = (id: string) => {
    setActions((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!selectedType) return;
    setSaving(true);
    try {
      let saved: NotificationChannel;
      if (effectiveChannel) {
        saved = await notificationChannelApi.update(effectiveChannel.id, { name, config, actions });
      } else {
        saved = await notificationChannelApi.create({ name, type: selectedType, config, actions });
      }
      toast({ title: effectiveChannel ? 'Updated' : 'Created', description: `"${saved.name}" saved.`, variant: 'success' });
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedType) return;
    setTesting(true);
    setTestResult(null);
    try {
      let ch = effectiveChannel;
      // For a brand-new channel: save it first so we have an ID to test against
      if (!ch) {
        if (!name.trim()) {
          setTestResult({ success: false, message: 'Please enter a channel name before testing.' });
          return;
        }
        ch = await notificationChannelApi.create({ name, type: selectedType, config, actions });
        setSavedChannel(ch);
        onCreated?.(ch); // update parent list without closing dialog
      }
      const r = await notificationChannelApi.test(ch.id);
      setTestResult(r);
      toast({
        title: r.success ? 'Test sent' : 'Test failed',
        description: r.message,
        variant: r.success ? 'success' : 'destructive',
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Test failed.';
      setTestResult({ success: false, message: msg });
      toast({ title: 'Test failed', description: msg, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="text-base">
            {editing ? 'Edit Notification' : 'Add Notification'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === 'select'
              ? 'Select a provider to receive notifications.'
              : `Configure ${meta?.label ?? ''} settings and triggers.`}
          </DialogDescription>
        </DialogHeader>

        {/* ── Provider picker ── */}
        {mode === 'select' && (
          <div className="p-5 grid grid-cols-3 gap-3">
            {PROVIDER_META.map((p) => (
              <button
                key={p.type}
                onClick={() => selectProvider(p)}
                className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/40 transition-colors"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', p.color)}>
                  {p.icon}
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold leading-tight">{p.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Configuration ── */}
        {mode === 'configure' && meta && selectedType && (
          <div className="overflow-y-auto max-h-[75vh] flex flex-col">
            <div className="flex-1 px-6 py-4 space-y-5">

              {/* Back button (new only) */}
              {!editing && (
                <button
                  onClick={() => setMode('select')}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to providers
                </button>
              )}

              {/* Provider pill */}
              <div className="flex items-center gap-2.5">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.color)}>
                  {meta.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground">{meta.subtitle}</p>
                </div>
              </div>

              {/* Channel name */}
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder={`My ${meta.label} notifications`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* Provider-specific form */}
              <ProviderConfigForm
                type={selectedType}
                config={config}
                onChange={setConfig}
              />

              {/* Actions */}
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Select the actions</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Choose which events trigger this notification.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_NOTIFICATION_ACTIONS.map((a) => {
                    const active = actions.includes(a.id);
                    return (
                      <div
                        key={a.id}
                        onClick={() => toggleAction(a.id)}
                        className={cn(
                          'flex items-start justify-between gap-2 rounded-lg border p-3 cursor-pointer transition-colors',
                          active
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:bg-muted/30',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{a.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            {a.description}
                          </p>
                        </div>
                        <Switch
                          checked={active}
                          onCheckedChange={() => toggleAction(a.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 scale-90 mt-0.5"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
                  testResult.success
                    ? 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'border-destructive/20 bg-destructive/10 text-destructive',
                )}>
                  {testResult.success
                    ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || saving || !name.trim()}
                className="gap-2"
                title={!name.trim() ? 'Enter a name first' : undefined}
              >
                {testing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
                Test
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {effectiveChannel ? 'Save Changes' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteDialog({
  channel,
  onClose,
  onDeleted,
}: {
  channel: NotificationChannel | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!channel) return;
    setDeleting(true);
    try {
      await notificationChannelApi.delete(channel.id);
      toast({ title: 'Deleted', description: `"${channel.name}" removed.`, variant: 'success' });
      onDeleted(channel.id);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!channel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Notification Channel</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{channel?.name}</strong>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-2">
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationChannel | null>(null);
  const [deleting, setDeleting] = useState<NotificationChannel | null>(null);

  useEffect(() => {
    if (user && !isAdmin) navigate('/dashboard/settings');
    else if (user) void load();
  }, [user, isAdmin, navigate]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setChannels(await notificationChannelApi.list());
    } catch {
      toast({ title: 'Error', description: 'Failed to load notification channels.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = async (ch: NotificationChannel, enabled: boolean) => {
    try {
      const updated = await notificationChannelApi.update(ch.id, { enabled });
      setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      toast({ title: 'Error', description: 'Failed to update.', variant: 'destructive' });
    }
  };

  const upsertChannel = (ch: NotificationChannel) => {
    setChannels((prev) => {
      const idx = prev.findIndex((c) => c.id === ch.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = ch;
        return next;
      }
      return [ch, ...prev];
    });
  };

  const handleSaved = (ch: NotificationChannel) => {
    upsertChannel(ch);
    setDialogOpen(false);
    setEditing(null);
  };

  const handleCreated = (ch: NotificationChannel) => {
    upsertChannel(ch);
  };

  const handleDeleted = (id: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold text-lg">Access Denied</p>
        <p className="text-sm text-muted-foreground">You need admin access to manage notifications.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 max-w-2xl mx-auto space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add providers to receive notifications — Email (SMTP), Microsoft Teams, or Resend.
          </p>
        </div>
      </div>


      {/* Channel list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Webhook className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No notification channels yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Add a channel to start receiving notifications for file uploads, shares, and more.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {channels.map((ch) => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onEdit={() => { setEditing(ch); setDialogOpen(true); }}
                onDelete={() => setDeleting(ch)}
                onToggle={(enabled) => void handleToggle(ch, enabled)}
              />
            ))}
          </div>
        )}

        {/* Add button */}
        <div className="flex justify-end px-5 py-3 border-t border-border bg-muted/20">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => { setEditing(null); setDialogOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Notification
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <ChannelDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSaved={handleSaved}
        onCreated={handleCreated}
      />
      <DeleteDialog
        channel={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
