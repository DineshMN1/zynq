'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  X,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUploadContext, type UploadProgress } from '@/context/UploadContext';
import { formatBytes } from '@/lib/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.ceil(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function CircleProgress({ value }: { value: number }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth="3"
      />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  );
}

function UploadRow({
  item,
  onCancel,
}: {
  item: UploadProgress;
  onCancel: () => void;
}) {
  const isActive =
    item.status === 'uploading' ||
    item.status === 'queued' ||
    item.status === 'checking';
  const speedLabel =
    item.speedBps && item.speedBps > 1024
      ? `${formatBytes(item.speedBps)}/s`
      : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-2.5 space-y-1.5 border-b border-border/50 last:border-0"
    >
      <div className="flex items-center gap-2">
        <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs truncate flex-1 min-w-0">{item.fileName}</span>
        {speedLabel && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {speedLabel}
          </span>
        )}
        {isActive ? (
          <button
            onClick={onCancel}
            className="shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
            title="Cancel upload"
          >
            <X className="h-3 w-3" />
          </button>
        ) : item.status === 'completed' ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
        ) : item.status === 'duplicate' ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        )}
      </div>
      {isActive && <Progress value={item.progress} className="h-[3px]" />}
      {item.status === 'checking' && (
        <p className="text-[10px] text-muted-foreground">
          Checking for duplicates…
        </p>
      )}
      {item.status === 'uploading' &&
        item.etaSeconds !== undefined &&
        item.etaSeconds > 1 && (
          <p className="text-[10px] text-muted-foreground">
            {formatEta(item.etaSeconds)} left
          </p>
        )}
    </motion.div>
  );
}

export function UploadManagerPopup() {
  const { uploadQueue, cancelUpload, cancelAll, dismissCompleted } =
    useUploadContext();
  const isMobile = useIsMobile();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const activeUploads = uploadQueue.filter(
    (u) =>
      u.status === 'uploading' ||
      u.status === 'queued' ||
      u.status === 'checking',
  );
  const hasActive = activeUploads.length > 0;
  const aggregateProgress =
    activeUploads.length > 0
      ? Math.round(
          activeUploads.reduce((sum, u) => sum + u.progress, 0) /
            activeUploads.length,
        )
      : 100;

  // Show popup when uploads are added
  useEffect(() => {
    if (uploadQueue.length > 0) {
      setIsVisible(true);
    }
  }, [uploadQueue.length]);

  // Auto-dismiss 4s after all uploads finish
  useEffect(() => {
    if (!hasActive && uploadQueue.length > 0) {
      const t = setTimeout(() => {
        dismissCompleted();
        setIsVisible(false);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [hasActive, uploadQueue.length, dismissCompleted]);

  const handleClose = () => {
    if (hasActive) {
      cancelAll();
    } else {
      dismissCompleted();
    }
    setIsVisible(false);
  };

  const bottomClass = isMobile
    ? 'bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]'
    : 'bottom-6';

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {isMinimized ? (
            <motion.button
              key="minimized"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={() => setIsMinimized(false)}
              className={cn(
                'fixed right-6 z-50 flex items-center gap-2',
                'bg-card border border-border shadow-lg rounded-full px-3 py-1.5',
                'hover:shadow-xl transition-shadow cursor-pointer',
                bottomClass,
              )}
            >
              <CircleProgress value={aggregateProgress} />
              <span className="text-xs font-medium pr-1">
                {uploadQueue.length}{' '}
                {uploadQueue.length === 1 ? 'file' : 'files'}
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed right-6 z-50',
                'bg-card border border-border shadow-xl rounded-xl overflow-hidden',
                isMobile ? 'w-[calc(100vw-3rem)]' : 'w-80',
                bottomClass,
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    Uploads ({uploadQueue.length})
                  </span>
                  {hasActive && (
                    <span className="text-xs text-muted-foreground">
                      · {aggregateProgress}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                    title="Minimize"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleClose}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                    title={hasActive ? 'Cancel all' : 'Close'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* File list */}
              <ScrollArea className="max-h-72">
                <AnimatePresence initial={false}>
                  {uploadQueue.map((item) => (
                    <UploadRow
                      key={item.id}
                      item={item}
                      onCancel={() => cancelUpload(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </ScrollArea>

              {/* Footer */}
              {hasActive && (
                <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {activeUploads.length} active
                  </span>
                  <button
                    onClick={cancelAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel all
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
