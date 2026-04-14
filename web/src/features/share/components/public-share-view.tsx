import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Eye, Lock, AlertTriangle, LinkIcon } from 'lucide-react';
import { formatBytes } from '@/lib/auth';
import { ApiError, publicApi } from '@/lib/api';
import { PublicSharePreviewDialog } from '@/features/share/components/public-share-preview-dialog';
import { FileTypeIcon } from '@/features/file/components/file-type-icon';
import { getPreviewType } from '@/features/file/utils/preview-type';

interface SharedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderSize?: number;
  owner: string;
  ownerId: string;
  createdAt: string;
  isFolder: boolean;
  hasContent: boolean;
}

interface PublicShareViewProps {
  token: string;
}

// ── Branding ──────────────────────────────────────────────────────────────────
function ZynqBrand() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow-sm">
        <img src="/favicon.ico" alt="ZynqCloud" className="w-5 h-5 object-contain rounded-sm" />
      </div>
      <span className="text-sm font-semibold tracking-tight text-foreground/70">ZynqCloud</span>
    </div>
  );
}

// ── Background decoration ─────────────────────────────────────────────────────
function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Primary blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/6 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full bg-primary/4 blur-3xl" />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <BackgroundDecor />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 relative z-10"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Loading share…</p>
      </motion.div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <BackgroundDecor />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm"
      >
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h1 className="text-[15px] font-semibold">{message}</h1>
          <p className="text-sm text-muted-foreground">The link may be invalid, expired, or removed.</p>
        </div>
        <ZynqBrand />
      </motion.div>
    </div>
  );
}

// ── Password gate ─────────────────────────────────────────────────────────────
function PasswordGate({
  error,
  value,
  onChange,
  onSubmit,
}: {
  error: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <BackgroundDecor />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/10 p-8 space-y-6">
          {/* Icon */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-[15px] font-semibold">Password protected</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Enter the password to access this share</p>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence mode="wait">
            {error && error !== 'This share is password protected.' && (
              <motion.p
                key={error}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-destructive text-center bg-destructive/8 rounded-lg py-2 px-3"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Share password"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSubmit(); }}
              className="h-10 text-sm bg-muted/40 border-border/60 focus-visible:ring-primary/30"
              autoFocus
            />
            <Button
              className="w-full h-10 font-medium"
              onClick={onSubmit}
              disabled={!value.trim()}
            >
              <Lock className="mr-2 h-3.5 w-3.5" />
              Unlock
            </Button>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <ZynqBrand />
        </div>
      </motion.div>
    </div>
  );
}

// ── File meta row ─────────────────────────────────────────────────────────────
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

// ── Main share card ───────────────────────────────────────────────────────────
export function PublicShareView({ token }: PublicShareViewProps) {
  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');

  const previewType = file ? getPreviewType(file.mimeType, file.name) : 'none';
  const canPreview = previewType !== 'none' && file?.hasContent;

  const fetchFile = useCallback(async () => {
    setLoading(true);
    setFile(null);
    setError('');
    setNeedsPassword(false);
    try {
      const data = await publicApi.getShare(token, sharePassword || undefined);
      setFile(data);
    } catch (err) {
      setFile(null);
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setNeedsPassword(true);
        setError(sharePassword ? 'Incorrect password. Please try again.' : 'This share is password protected.');
      } else if (err instanceof ApiError && err.statusCode === 429) {
        setNeedsPassword(true);
        setError(err.message || 'Too many password attempts. Try again shortly.');
      } else {
        setError('This link is invalid or has expired.');
      }
    } finally {
      setLoading(false);
    }
  }, [sharePassword, token]);

  useEffect(() => {
    if (!token) return;
    void fetchFile();
  }, [fetchFile, token]);

  const handleDownload = async () => {
    if (!file?.hasContent) return;
    setDownloading(true);
    try {
      const { blob, fileName } = await publicApi.downloadShare(token, sharePassword || undefined);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || file.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setNeedsPassword(true);
        setError('Password required to download this file.');
      } else if (err instanceof ApiError && err.statusCode === 429) {
        setNeedsPassword(true);
        setError('Too many requests — please try again later.');
      } else {
        setError('Download failed. Please try again.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleUnlock = () => {
    const trimmed = passwordInput.trim();
    if (!trimmed) return;
    setNeedsPassword(false);
    setSharePassword(trimmed);
  };

  // ── States ───────────────────────────────────────────────────────────────────
  if (loading) return <LoadingState />;

  if (error && !needsPassword) return <ErrorState message={error} />;

  if (needsPassword) {
    return (
      <PasswordGate
        error={error}
        value={passwordInput}
        onChange={setPasswordInput}
        onSubmit={handleUnlock}
      />
    );
  }

  // ── File card ────────────────────────────────────────────────────────────────
  const formattedDate = file?.createdAt
    ? new Date(file.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <BackgroundDecor />

      <AnimatePresence mode="wait">
        {file && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm"
          >
            {/* Top branding */}
            <div className="flex justify-center mb-5">
              <ZynqBrand />
            </div>

            {/* Main card */}
            <div className="rounded-2xl border border-border/60 bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden">

              {/* File hero */}
              <div className="px-8 pt-8 pb-6 flex flex-col items-center gap-4 border-b border-border/40">
                {/* Icon with glow ring */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl scale-150 opacity-60" />
                  <div className="relative w-20 h-20 rounded-2xl bg-background border border-border/60 shadow-sm flex items-center justify-center">
                    <FileTypeIcon
                      name={file.name}
                      mimeType={file.mimeType}
                      isFolder={file.isFolder}
                      size={52}
                    />
                  </div>
                </div>

                {/* Name */}
                <div className="text-center space-y-1 w-full">
                  <h1
                    className="text-[15px] font-semibold leading-snug break-all line-clamp-3"
                    title={file.name}
                  >
                    {file.name}
                  </h1>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatBytes(file.isFolder ? (file.folderSize || 0) : file.size)}
                  </p>
                </div>
              </div>

              {/* Meta */}
              <div className="px-5 py-1">
                {file.owner && <MetaRow label="Shared by" value={file.owner} />}
                {formattedDate && <MetaRow label="Created" value={formattedDate} />}
                <MetaRow label="Type" value={file.isFolder ? 'Folder' : (file.mimeType || 'File')} />
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 pt-3 space-y-2.5">
                {/* Preview */}
                {canPreview && (
                  <Button
                    variant="outline"
                    className="w-full h-10 text-sm font-medium gap-2 border-border/60 hover:bg-muted/60 hover:border-border"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                )}

                {/* Download */}
                <Button
                  className="w-full h-10 text-sm font-medium gap-2 shadow-sm"
                  disabled={downloading || !file.hasContent}
                  onClick={handleDownload}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {downloading
                    ? 'Downloading…'
                    : file.isFolder
                      ? 'Download as ZIP'
                      : 'Download'}
                </Button>

                {/* Share link hint */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <LinkIcon className="h-3 w-3 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground/50">
                    Shared securely via <span className="font-medium">ZynqCloud</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {previewOpen && file?.hasContent && (
        <PublicSharePreviewDialog
          token={token}
          password={sharePassword || undefined}
          file={file}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
