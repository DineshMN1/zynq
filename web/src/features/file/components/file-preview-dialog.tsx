import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ApiError, type FileMetadata, fileApi } from '@/lib/api';
import { getFileIcon, getIconColor } from '@/features/file/utils/file-icons';
import { getPreviewType } from '@/features/file/utils/preview-type';
import { PreviewContent, getPreviewDialogClasses } from './viewers/preview-content';
import { cn } from '@/lib/utils';

interface FilePreviewDialogProps {
  file: FileMetadata;
  onClose: () => void;
}

export function FilePreviewDialog({ file, onClose }: FilePreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);

  const previewType = getPreviewType(file.mime_type, file.name);
  const IconComponent = getFileIcon(file.name, file.mime_type, false);
  const iconColor = getIconColor(file.name, file.mime_type, false);
  const hasPreview = previewType !== 'none';

  const zoomIn = useCallback(() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2))), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  useEffect(() => {
    let stale = false;
    let createdUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { blob } = await fileApi.downloadBlob(file.id);
        if (stale) return;
        if (previewType === 'text' || previewType === 'code' || previewType === 'markdown') {
          const text = await blob.text();
          if (!stale) setTextContent(text);
        } else if (previewType !== 'none') {
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

    if (previewType !== 'none') {
      void load();
    } else {
      setLoading(false);
    }

    return () => {
      stale = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file.id, previewType]);

  const handleDownload = () => {
    fileApi.download(file.id);
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
            <IconComponent className={cn('h-5 w-5 shrink-0', iconColor)} />
            <DialogTitle className="text-sm truncate font-medium">
              {file.name}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Zoom controls — visible when there's actual content to zoom */}
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
            iconComponent={IconComponent}
            iconColor={iconColor}
            zoom={zoom}
            onDownload={handleDownload}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
