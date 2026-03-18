import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ApiError, publicApi } from '@/lib/api';
import { getPreviewType } from '@/features/file/utils/preview-type';
import { PreviewContent, getPreviewDialogClasses } from '@/features/file/components/viewers/preview-content';
import { FileTypeIcon } from '@/features/file/components/file-type-icon';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface PublicSharePreviewDialogProps {
  token: string;
  password?: string;
  file: {
    name: string;
    mimeType: string;
    hasContent: boolean;
  };
  onClose: () => void;
}

export function PublicSharePreviewDialog({
  token,
  password,
  file,
  onClose,
}: PublicSharePreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);

  const previewType = getPreviewType(file.mimeType, file.name);
  const hasPreview = previewType !== 'none';

  const zoomIn = useCallback(() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2))), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  useEffect(() => {
    let stale = false;
    let createdUrl: string | null = null;

    const load = async () => {
      if (!file.hasContent || previewType === 'none') {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { blob } = await publicApi.downloadShare(token, password);
        if (stale) return;

        if (previewType === 'text' || previewType === 'code' || previewType === 'markdown') {
          const text = await blob.text();
          if (!stale) setTextContent(text);
        } else {
          createdUrl = URL.createObjectURL(blob);
          if (!stale) setBlobUrl(createdUrl);
        }
      } catch (err) {
        if (!stale) {
          setError(
            err instanceof ApiError ? err.message : 'Failed to load preview.',
          );
        }
      } finally {
        if (!stale) setLoading(false);
      }
    };

    setBlobUrl(null);
    setTextContent(null);
    void load();

    return () => {
      stale = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file.hasContent, file.name, file.mimeType, password, previewType, token]);

  const handleDownload = async () => {
    try {
      const { blob, fileName } = await publicApi.downloadShare(token, password);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || file.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      toast({
        title: 'Download failed',
        description:
          err instanceof ApiError
            ? err.message
            : 'Unable to download this file.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'flex flex-col p-0 gap-0',
          getPreviewDialogClasses(previewType),
        )}
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-2.5 border-b flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileTypeIcon name={file.name} mimeType={file.mimeType} isFolder={false} size={20} className="shrink-0" />
            <DialogTitle className="text-sm truncate font-medium">
              {file.name}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {hasPreview && !loading && !error && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} title="Zoom out">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <button
                  onClick={zoomReset}
                  className="text-xs tabular-nums text-muted-foreground hover:text-foreground min-w-10 text-center transition-colors"
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} title="Zoom in">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0 flex items-center justify-center bg-muted/20">
          <PreviewContent
            previewType={previewType}
            loading={loading}
            error={error}
            blobUrl={blobUrl}
            textContent={textContent}
            fileName={file.name}
            mimeType={file.mimeType}
            zoom={zoom}
            onDownload={handleDownload}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
