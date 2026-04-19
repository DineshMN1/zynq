import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUploadContext } from '@/context/UploadContext';
import { UploadRow } from '@/components/UploadManagerPopup';
import { toast } from '@/hooks/use-toast';

export default function DashboardUploadsPage() {
  const navigate = useNavigate();
  const { uploadQueue, cancelUpload, pauseUpload, resumeUpload, cancelAll } =
    useUploadContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingReselectId, setPendingReselectId] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleTasks = useMemo(
    () =>
      uploadQueue.filter(
        (item) => item.status !== 'completed' && item.status !== 'duplicate',
      ),
    [uploadQueue],
  );

  const activeCount = visibleTasks.filter(
    (item) =>
      item.status === 'uploading' ||
      item.status === 'queued' ||
      item.status === 'checking',
  ).length;

  const errorCount = visibleTasks.filter(
    (item) => item.status === 'error' || item.status === 'interrupted',
  ).length;

  const handleReselectClick = (id: string) => {
    setPendingReselectId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingReselectId) return;

    const task = uploadQueue.find((item) => item.id === pendingReselectId);
    setPendingReselectId(null);
    if (!task?.retry) {
      toast({
        title: 'Cannot resume',
        description: 'That upload no longer has a retry action.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await Promise.resolve(task.retry(file));
    } catch (err) {
      console.error('Reselect upload failed:', err);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-background to-muted/20">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="border-b border-border/60 bg-background/80 backdrop-blur px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Upload queue
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Uploads
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount > 0
                ? `${activeCount} active upload${activeCount !== 1 ? 's' : ''}`
                : 'No uploads are currently active.'}
              {errorCount > 0
                ? ` ${errorCount} need attention.`
                : ' Resumable tasks stay here until they finish.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/files')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to files
            </Button>
            {visibleTasks.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => cancelAll()}
                className="text-muted-foreground"
              >
                Cancel all
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4 sm:p-6">
        <div className="h-full rounded-2xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
          <ScrollArea className="h-full">
            {visibleTasks.length > 0 ? (
              <div className="divide-y divide-border/40">
                {visibleTasks.map((item) => (
                  <UploadRow
                    key={item.id}
                    item={item}
                    now={now}
                    onCancel={() => cancelUpload(item.id)}
                    onPause={() => pauseUpload(item.id)}
                    onResume={() => {
                      if (item.sourceId) {
                        resumeUpload(item.id);
                      } else {
                        handleReselectClick(item.id);
                      }
                    }}
                    onReselect={() => handleReselectClick(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <FileWarning className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">No uploads in progress</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Active uploads, retries, and interrupted files show up here.
                  Start a new upload from Files and it will appear in this queue.
                </p>
                <Button className="mt-5" onClick={() => navigate('/dashboard/files')}>
                  Go to files
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
