import { lazy, Suspense, useRef, useEffect, useState, useCallback } from 'react';
import {
  Loader2, Download, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { PreviewType } from '@/features/file/utils/preview-type';
import { FileTypeIcon } from '@/features/file/components/file-type-icon';
import { cn } from '@/lib/utils';

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

/** Audio element with volume forced to max. */
function AudioElement({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.volume = 1;
  }, []);
  return <audio ref={ref} src={src} controls className={className} />;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Custom video player with play/pause, seekbar, time, volume, fullscreen. */
function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 2500);
  }, [playing]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 1;

    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      if (v.buffered.length > 0)
        setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
    };
    const onDurationChange = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onEnded = () => { setPlaying(false); setShowControls(true); };

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); } else { v.pause(); }
  };

  const seek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = (pct / 100) * v.duration;
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    setVolume(val);
    setMuted(val === 0);
    if (v) { v.volume = val; v.muted = val === 0; }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) void el.requestFullscreen();
    else void document.exitFullscreen();
  };

  const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center group select-none"
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={togglePlay}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={toggleFullscreen}
      />

      {/* Centre play/pause flash */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-4">
            <Play className="h-10 w-10 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 px-3 pt-6 pb-3 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-200',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seekbar */}
        <div className="relative h-4 flex items-center mb-2 cursor-pointer">
          {/* Buffered track */}
          <div className="absolute left-0 right-0 h-1 rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white/40" style={{ width: `${buffered}%` }} />
          </div>
          <Slider
            min={0}
            max={100}
            step={0.1}
            value={[currentPct]}
            onValueChange={([v]) => seek(v)}
            className="w-full [&>[data-slot=slider-track]]:bg-transparent [&>[data-slot=slider-range]]:bg-white [&>[data-slot=slider-thumb]]:bg-white [&>[data-slot=slider-thumb]]:border-0 [&>[data-slot=slider-thumb]]:shadow-md"
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-white/80 transition-colors p-1"
          >
            {playing
              ? <Pause className="h-5 w-5 fill-white" />
              : <Play className="h-5 w-5 fill-white" />}
          </button>

          {/* Time */}
          <span className="text-white text-xs tabular-nums select-none">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <button onClick={toggleMute} className="text-white hover:text-white/80 transition-colors p-1">
            {muted || volume === 0
              ? <VolumeX className="h-4 w-4" />
              : <Volume2 className="h-4 w-4" />}
          </button>
          <div className="w-20">
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[muted ? 0 : volume]}
              onValueChange={([v]) => changeVolume(v)}
              className="[&>[data-slot=slider-range]]:bg-white [&>[data-slot=slider-thumb]]:bg-white [&>[data-slot=slider-thumb]]:border-0 [&>[data-slot=slider-thumb]]:h-3 [&>[data-slot=slider-thumb]]:w-3"
            />
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:text-white/80 transition-colors p-1">
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
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
      <div className="w-full h-full" style={zoomStyle}>
        <VideoPlayer src={blobUrl} />
      </div>
    );
  }

  if (previewType === 'audio' && blobUrl) {
    return (
      <div className="py-8 px-4 w-full flex flex-col items-center gap-4" style={zoomStyle}>
        <FileTypeIcon name={fileName} mimeType={mimeType} isFolder={false} size={64} />
        <p className="text-sm font-medium">{fileName}</p>
        <AudioElement src={blobUrl} className="w-full max-w-md" />
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
