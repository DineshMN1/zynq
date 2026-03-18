import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// CDN worker — avoids pnpm symlink resolution issues
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  /** Blob URL — will be fetched and converted to ArrayBuffer for pdf.js worker */
  url: string;
  zoom: number;
}

export function PdfViewer({ url, zoom }: PdfViewerProps) {
  const [pdfData, setPdfData] = useState<{ data: Uint8Array } | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Convert blob URL to ArrayBuffer so pdf.js worker can read it
  useEffect(() => {
    let stale = false;
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (!stale) setPdfData({ data: new Uint8Array(buf) });
      })
      .catch(() => {
        if (!stale) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => { stale = true; };
  }, [url]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setLoading(false);
    setLoadError(true);
  }, []);

  const goToPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goToNext = () => setPageNumber((p) => Math.min(numPages, p + 1));

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <p className="text-sm">Unable to render PDF inline.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline underline-offset-2"
        >
          Open in new tab
        </a>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Page navigation */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-b bg-background/80 backdrop-blur-sm shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrev} disabled={pageNumber <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums min-w-17.5 text-center text-muted-foreground">
            {pageNumber} / {numPages}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNext} disabled={pageNumber >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* PDF content */}
      <div className="flex-1 overflow-auto flex justify-center">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <Document
          file={pdfData}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          className={cn('py-4', loading && 'hidden')}
          loading=""
        >
          <Page
            pageNumber={pageNumber}
            scale={zoom}
            className="shadow-lg [&_canvas]:rounded-sm"
            loading=""
          />
        </Document>
      </div>
    </div>
  );
}
