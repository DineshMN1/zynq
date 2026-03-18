import { lazy, Suspense, useRef, useEffect } from 'react';
import { Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PreviewType } from '@/features/file/utils/preview-type';
import { FileTypeIcon } from '@/features/file/components/file-type-icon';

// Lazy-load heavy viewers for code-splitting
const PdfViewer = lazy(() =>
  import('./pdf-viewer').then((m) => ({ default: m.PdfViewer })),
);
const ImageViewer = lazy(() =>
  import('./image-viewer').then((m) => ({ default: m.ImageViewer })),
);
const CodeViewer = lazy(() =>
  import('./code-viewer').then((m) => ({ default: m.CodeViewer })),
);
const MarkdownViewer = lazy(() =>
  import('./markdown-viewer').then((m) => ({ default: m.MarkdownViewer })),
);

/**
 * Returns dialog size classes based on preview type.
 * Full viewport for media that needs space, narrower for text-based content.
 */
export function getPreviewDialogClasses(previewType: PreviewType): string {
  // sm:max-w-lg! overrides the base DialogContent's sm:max-w-lg
  switch (previewType) {
    case 'pdf':
    case 'video':
      return 'sm:max-w-[96vw]! w-[96vw] h-[90vh] max-h-[90vh]';
    case 'image':
      return 'sm:max-w-[96vw]! w-auto h-auto max-h-[90vh]';
    case 'code':
    case 'markdown':
    case 'text':
      return 'sm:max-w-5xl! w-full max-h-[90vh]';
    case 'audio':
      return 'sm:max-w-lg! w-full';
    case 'none':
    default:
      return 'sm:max-w-md! w-full';
  }
}

interface PreviewContentProps {
  previewType: PreviewType;
  loading: boolean;
  error: string;
  blobUrl: string | null;
  textContent: string | null;
  fileName: string;
  mimeType: string;
  zoom: number;
  onDownload: () => void;
}

/** Thin wrapper that sets volume to max on mount so playback isn't quiet. */
function MediaElement({
  tag: Tag,
  src,
  className,
}: {
  tag: 'video' | 'audio';
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.volume = 1;
  }, []);
  return <Tag ref={ref} src={src} controls className={className} />;
}

function ViewerFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function PreviewContent({
  previewType,
  loading,
  error,
  blobUrl,
  textContent,
  fileName,
  mimeType,
  zoom,
  onDownload,
}: PreviewContentProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download instead
        </Button>
      </div>
    );
  }

  // PDF handles zoom via its own scale prop (not CSS zoom)
  if (previewType === 'pdf' && blobUrl) {
    return (
      <Suspense fallback={<ViewerFallback />}>
        <PdfViewer url={blobUrl} zoom={zoom} />
      </Suspense>
    );
  }

  // All other types use CSS zoom on a wrapper
  const zoomStyle = zoom !== 1 ? { zoom } : undefined;

  if (previewType === 'image' && blobUrl) {
    return (
      <div style={zoomStyle} className="flex items-center justify-center h-full w-full">
        <Suspense fallback={<ViewerFallback />}>
          <ImageViewer url={blobUrl} alt={fileName} />
        </Suspense>
      </div>
    );
  }

  if (previewType === 'video' && blobUrl) {
    return (
      <div style={zoomStyle}>
        <MediaElement tag="video" src={blobUrl} className="max-w-full max-h-full p-2" />
      </div>
    );
  }

  if (previewType === 'audio' && blobUrl) {
    return (
      <div className="py-8 px-4 w-full flex flex-col items-center gap-4" style={zoomStyle}>
        <FileTypeIcon name={fileName} mimeType={mimeType} isFolder={false} size={64} />
        <p className="text-sm font-medium">{fileName}</p>
        <MediaElement tag="audio" src={blobUrl} className="w-full max-w-md" />
      </div>
    );
  }

  if (previewType === 'markdown' && textContent !== null) {
    return (
      <div style={zoomStyle} className="w-full">
        <Suspense fallback={<ViewerFallback />}>
          <MarkdownViewer content={textContent} />
        </Suspense>
      </div>
    );
  }

  if (previewType === 'code' && textContent !== null) {
    return (
      <div style={zoomStyle} className="w-full">
        <Suspense fallback={<ViewerFallback />}>
          <CodeViewer content={textContent} fileName={fileName} />
        </Suspense>
      </div>
    );
  }

  if (previewType === 'text' && textContent !== null) {
    return (
      <pre style={zoomStyle} className="w-full overflow-auto p-4 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-all">
        {textContent}
      </pre>
    );
  }

  // No preview available
  return (
    <div className="py-12 text-center flex flex-col items-center gap-3">
      <FileTypeIcon name={fileName} mimeType={mimeType} isFolder={false} size={48} />
      <p className="text-sm text-muted-foreground">
        No preview available for this file type.
      </p>
      <Button variant="outline" size="sm" onClick={onDownload}>
        <Download className="mr-2 h-4 w-4" />
        Download
      </Button>
    </div>
  );
}
