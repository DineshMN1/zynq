'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, X } from 'lucide-react';
import { type FileMetadata, fileApi } from '@/lib/api';
import { getFileIcon, getIconColor } from '@/features/file/utils/file-icons';
import { cn } from '@/lib/utils';

interface FilePreviewDialogProps {
  file: FileMetadata;
  onClose: () => void;
}

function getPreviewType(
  mimeType: string,
  name: string,
): 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'none' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const codeExts = [
    'js',
    'jsx',
    'ts',
    'tsx',
    'py',
    'java',
    'c',
    'cpp',
    'h',
    'hpp',
    'cs',
    'go',
    'rs',
    'rb',
    'php',
    'swift',
    'kt',
    'html',
    'htm',
    'css',
    'scss',
    'sass',
    'json',
    'xml',
    'yaml',
    'yml',
    'toml',
    'sh',
    'bash',
    'sql',
    'vue',
    'svelte',
    'md',
    'markdown',
  ];
  const textExts = [
    'txt',
    'log',
    'csv',
    'env',
    'gitignore',
    'dockerignore',
    'editorconfig',
    'ini',
    'conf',
    'cfg',
  ];

  if (codeExts.includes(ext)) return 'code';
  if (textExts.includes(ext)) return 'text';
  if (mimeType.startsWith('text/')) return 'text';

  return 'none';
}

export function FilePreviewDialog({ file, onClose }: FilePreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const previewType = getPreviewType(file.mime_type, file.name);
  const IconComponent = getFileIcon(file.name, file.mime_type, false);
  const iconColor = getIconColor(file.name, file.mime_type, false);

  useEffect(() => {
    let url: string | null = null;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { blob } = await fileApi.download(file.id);
        if (previewType === 'text' || previewType === 'code') {
          const text = await blob.text();
          setTextContent(text);
        } else if (previewType !== 'none') {
          url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch {
        setError('Failed to load preview.');
      } finally {
        setLoading(false);
      }
    };

    if (previewType !== 'none') {
      void load();
    } else {
      setLoading(false);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, previewType]);

  const handleDownload = async () => {
    try {
      const { blob, fileName } = await fileApi.download(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
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
        className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2 min-w-0">
            <IconComponent className={cn('h-5 w-5 shrink-0', iconColor)} />
            <DialogTitle className="text-base truncate font-medium">
              {file.name}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0 flex items-center justify-center bg-muted/20">
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading preview...
              </p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Download instead
              </Button>
            </div>
          ) : previewType === 'image' && blobUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt={file.name}
              className="max-w-full max-h-full object-contain p-2"
              style={{ maxHeight: 'calc(90vh - 120px)' }}
            />
          ) : previewType === 'video' && blobUrl ? (
            <video
              src={blobUrl}
              controls
              className="max-w-full max-h-full p-2"
              style={{ maxHeight: 'calc(90vh - 120px)' }}
            />
          ) : previewType === 'audio' && blobUrl ? (
            <div className="py-8 px-4 w-full flex flex-col items-center gap-4">
              <IconComponent className={cn('h-16 w-16', iconColor)} />
              <p className="text-sm font-medium">{file.name}</p>
              <audio src={blobUrl} controls className="w-full max-w-md" />
            </div>
          ) : previewType === 'pdf' && blobUrl ? (
            <embed
              src={blobUrl}
              type="application/pdf"
              className="w-full"
              style={{ height: 'calc(90vh - 80px)' }}
            />
          ) : (previewType === 'text' || previewType === 'code') &&
            textContent !== null ? (
            <pre
              className="w-full overflow-auto p-4 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-all"
              style={{ maxHeight: 'calc(90vh - 80px)' }}
            >
              {textContent}
            </pre>
          ) : (
            <div className="py-12 text-center flex flex-col items-center gap-3">
              <IconComponent className={cn('h-12 w-12', iconColor)} />
              <p className="text-sm text-muted-foreground">
                No preview available for this file type.
              </p>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
