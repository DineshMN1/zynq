import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  Upload,
  RotateCcw,
  Copy,
  Pause,
  Play,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUploadContext, type UploadProgress } from '@/context/UploadContext';
import { formatBytes } from '@/lib/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 5) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.ceil(seconds % 60);
    return s > 0 ? `${m}m ${s}s left` : `${m}m left`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

function statusColor(status: UploadProgress['status']) {
  if (status === 'completed' || status === 'duplicate') return 'text-green-500';
  if (status === 'error') return 'text-destructive';
  if (status === 'paused') return 'text-yellow-500';
  return 'text-primary';
}

function UploadRow({
  item,
  onCancel,
  onPause,
  onResume,
}: {
  item: UploadProgress;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const isActive =
    item.status === 'uploading' ||
    item.status === 'queued' ||
    item.status === 'checking';

  // Build the detail string shown below the progress bar
  const detail = (() => {
    if (item.status === 'checking') return 'Checking for duplicates…';
    if (item.status === 'queued') return 'Queued';
    if (item.status === 'uploading') {
      // All bytes sent but waiting for the server to finish writing/encrypting
      if (item.progress >= 100) return 'Finalizing…';
      const pct = `${item.progress}%`;
      const bytes =
        item.loadedBytes !== undefined && item.totalBytes !== undefined
          ? `${formatBytes(item.loadedBytes)} / ${formatBytes(item.totalBytes)}`
          : '';
      const speed =
        item.speedBps && item.speedBps > 1024
          ? `${formatBytes(item.speedBps)}/s`
          : '';
      const eta =
        item.etaSeconds !== undefined ? formatEta(item.etaSeconds) : '';
      return [pct, bytes, speed, eta].filter(Boolean).join(' · ');
    }
    if (item.status === 'paused') return 'Paused';
    if (item.status === 'completed') return 'Upload complete';
    if (item.status === 'duplicate') return 'Already exists';
    if (item.status === 'error') return 'Upload failed';
    return '';
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="px-3 py-2.5 border-b border-border/40 last:border-0 w-full min-w-0"
    >
      {/* Row 1: icon + filename + dismiss for done states */}
      <div className="flex items-center gap-1.5 w-full min-w-0 mb-1.5">
        <div className="shrink-0">
          {item.status === 'completed' || item.status === 'duplicate' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : item.status === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          ) : item.status === 'paused' ? (
            <Pause className="h-3.5 w-3.5 text-yellow-500" />
          ) : item.status === 'checking' ? (
            <Copy className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
          ) : (
            <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        <span
          className="text-xs font-medium truncate flex-1 min-w-0"
          title={item.fileName}
        >
          {item.fileName.length > 28
            ? item.fileName.slice(0, 24) + '…' + item.fileName.slice(-6)
            : item.fileName}
        </span>

        {/* Dismiss button for finished states */}
        {(item.status === 'completed' || item.status === 'duplicate') && (
          <button
            onClick={onCancel}
            title="Dismiss"
            className="shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Row 2: progress bar */}
      {(isActive || item.status === 'paused') && (
        <Progress value={item.progress} className="h-1 mb-1.5" />
      )}

      {/* Row 3: detail + action buttons */}
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        {detail && (
          <p
            className={cn(
              'text-[10px] leading-none truncate flex-1 min-w-0',
              statusColor(item.status),
            )}
          >
            {detail}
          </p>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {/* Uploading: pause + cancel */}
          {item.status === 'uploading' && (
            <>
              <button
                onClick={onPause}
                title="Pause"
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
              >
                <Pause className="h-3 w-3" />
              </button>
              <button
                onClick={onCancel}
                title="Cancel"
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {/* Queued/checking: cancel only */}
          {(item.status === 'queued' || item.status === 'checking') && (
            <button
              onClick={onCancel}
              title="Cancel"
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {/* Paused: resume + cancel */}
          {item.status === 'paused' && (
            <>
              <button
                onClick={onResume}
                title="Resume"
                className="flex items-center gap-1 px-2 h-5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors text-[10px] font-medium"
              >
                <Play className="h-2.5 w-2.5" />
                Resume
              </button>
              <button
                onClick={onCancel}
                title="Cancel"
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {/* Error: retry + dismiss */}
          {item.status === 'error' && (
            <>
              <button
                onClick={onResume}
                title="Retry upload"
                className="flex items-center gap-1 px-2 h-5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors text-[10px] font-medium"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Retry
              </button>
              <button
                onClick={onCancel}
                title="Dismiss"
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function UploadManagerPopup() {
  const {
    uploadQueue,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    cancelAll,
    dismissCompleted,
  } = useUploadContext();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  const activeUploads = uploadQueue.filter(
    (u) =>
      u.status === 'uploading' ||
      u.status === 'queued' ||
      u.status === 'checking',
  );
  const hasActive = activeUploads.length > 0;
  const hasPaused = uploadQueue.some((u) => u.status === 'paused');

  // "Finalizing" = all in-progress uploads have sent bytes (progress >= 100)
  // but the server hasn't responded yet — no queued/checking/paused items remain.
  const isAllFinalizing =
    hasActive &&
    !hasPaused &&
    uploadQueue.every(
      (u) =>
        (u.status === 'uploading' && u.progress >= 100) ||
        u.status === 'completed' ||
        u.status === 'duplicate' ||
        u.status === 'error',
    );

  const aggregateProgress =
    activeUploads.length > 0
      ? Math.round(
          activeUploads.reduce((sum, u) => sum + u.progress, 0) /
            activeUploads.length,
        )
      : 100;

  const errorCount = uploadQueue.filter((u) => u.status === 'error').length;

  useEffect(() => {
    if (uploadQueue.length > 0) setIsVisible(true);
  }, [uploadQueue.length]);

  // Auto-dismiss 5s after entering finalizing state (all bytes sent, server processing)
  useEffect(() => {
    if (!isAllFinalizing) return;
    const t = setTimeout(() => {
      dismissCompleted();
      setIsVisible(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [isAllFinalizing, dismissCompleted]);

  // Auto-dismiss 3s after all uploads finish or queue is empty
  useEffect(() => {
    if (!hasActive && !hasPaused) {
      const t = setTimeout(() => {
        dismissCompleted();
        setIsVisible(false);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [hasActive, hasPaused, dismissCompleted]);

  const handleClose = () => {
    cancelAll();
    dismissCompleted();
    setIsVisible(false);
  };

  const bottomClass = isMobile
    ? 'bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]'
    : 'bottom-4';

  const widthClass = isMobile ? 'w-[calc(100vw-2rem)]' : 'w-96';

  return (
    <AnimatePresence>
      {isVisible && (
        <>
            <motion.div
              key="expanded"
              initial={{ y: 16, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className={cn(
                'fixed right-4 z-40 flex flex-col',
                'bg-card border border-border shadow-2xl rounded-2xl overflow-hidden',
                widthClass,
                bottomClass,
              )}
              style={{ maxHeight: 'min(420px, calc(100vh - 5rem))' }}
            >
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-muted/20">
                <div className="flex items-center gap-2 min-w-0">
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold truncate">
                    {hasActive
                      ? `Uploading ${activeUploads.length} file${activeUploads.length !== 1 ? 's' : ''}…`
                      : 'Uploads'}
                  </span>
                  {hasActive && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {aggregateProgress}%
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-[10px] font-medium text-destructive shrink-0">
                      · {errorCount} failed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 ml-2 shrink-0">
                  <button
                    onClick={handleClose}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ── File list ── */}
              <ScrollArea className="flex-1 overflow-auto">
                <AnimatePresence initial={false}>
                  {uploadQueue.map((item) => (
                    <UploadRow
                      key={item.id}
                      item={item}
                      onCancel={() => cancelUpload(item.id)}
                      onPause={() => pauseUpload(item.id)}
                      onResume={() => resumeUpload(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </ScrollArea>

              {/* ── Footer ── */}
              {uploadQueue.length > 1 && (
                <div className="px-4 py-2 border-t border-border bg-muted/10 flex items-center justify-between shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {uploadQueue.length} files total
                  </span>
                  {hasActive && (
                    <button
                      onClick={cancelAll}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel all
                    </button>
                  )}
                </div>
              )}
            </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
