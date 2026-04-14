import { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Cloud, Download, Eye } from 'lucide-react';
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
        setError(
          err.message || 'Too many password attempts. Try again shortly.',
        );
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
      const { blob, fileName } = await publicApi.downloadShare(
        token,
        sharePassword || undefined,
      );
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
        setError('Too many requests - please try again later.');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !needsPassword) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-background to-primary/5">
        <Cloud className="h-10 w-10 text-primary mb-3" />
        <h1 className="text-xl font-semibold">{error}</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-primary/5 p-4">
      <Card className="w-full max-w-4xl p-6 space-y-6 shadow-lg border-2">
        <div className="flex flex-col items-center space-y-3">
          <Cloud className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold text-center">zynqCloud Share</h1>
        </div>

        {needsPassword && (
          <div className="w-full max-w-md mx-auto space-y-2">
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter share password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && passwordInput.trim()) {
                    handleUnlock();
                  }
                }}
                className="border-2 border-primary/30 focus-visible:border-primary"
              />
              <Button onClick={handleUnlock} disabled={!passwordInput.trim()}>
                Unlock
              </Button>
            </div>
          </div>
        )}

        {file && (
          <>
            <div className="flex flex-col items-center space-y-2 text-center rounded-xl border bg-background/50 p-4">
              <FileTypeIcon name={file.name} mimeType={file.mimeType} isFolder={file.isFolder} size={52} />
              <div className="flex items-center gap-2 max-w-full">
                <p className="text-lg font-medium break-all max-w-full">
                  {file.name}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatBytes(file.isFolder ? (file.folderSize || 0) : file.size)}
              </p>
              {file.owner && (
                <p className="text-xs text-muted-foreground">
                  Shared by {file.owner}
                </p>
              )}
            </div>

            {file.hasContent && previewType !== 'none' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border border-border/70 hover:border-primary/60"
                onClick={() => setPreviewOpen(true)}
                title="Show preview"
              >
                <span className="text-xs mr-1">Preview</span>
                <Eye className="h-4 w-4" />
              </Button>
            )}

            <Button
              size="lg"
              className="w-full"
              disabled={downloading || !file?.hasContent}
              onClick={handleDownload}
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {downloading
                ? 'Downloading...'
                : file?.isFolder
                  ? 'Download as ZIP'
                  : 'Download File'}
            </Button>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground mt-3">
          Shared securely via <span className="font-semibold">zynqCloud</span>
        </p>
      </Card>

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
