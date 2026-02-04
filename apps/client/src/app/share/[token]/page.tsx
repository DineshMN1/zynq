'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Cloud, Download, File } from 'lucide-react';
import { formatBytes } from '@/lib/auth';
import { publicApi } from '@/lib/api';

interface SharedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  owner: string;
  ownerId: string;
  createdAt: string;
  isFolder: boolean;
  hasContent: boolean;
}

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const fetchFile = useCallback(async () => {
    try {
      const data = await publicApi.getShare(token);
      setFile(data);
    } catch {
      setError('This link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchFile();
  }, [token, fetchFile]);

  const handleDownload = async () => {
    if (!file?.hasContent) return;
    setDownloading(true);
    try {
      const { blob, fileName } = await publicApi.downloadShare(token);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || file.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-background to-primary/5">
        <Cloud className="h-10 w-10 text-primary mb-3" />
        <h1 className="text-xl font-semibold">{error}</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-primary/5 p-4">
      <Card className="w-full max-w-md p-6 text-center space-y-6 shadow-lg border-2">
        <div className="flex flex-col items-center space-y-3">
          <Cloud className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">zynqCloud Share</h1>
        </div>

        <div className="flex flex-col items-center space-y-2">
          <File className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">{file?.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatBytes(file?.size || 0)}
          </p>
          {file?.owner && (
            <p className="text-xs text-muted-foreground">
              Shared by {file.owner}
            </p>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={downloading}
          onClick={handleDownload}
        >
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {downloading ? 'Downloading...' : 'Download File'}
        </Button>

        <p className="text-xs text-muted-foreground mt-3">
          Shared securely via <span className="font-semibold">zynqCloud</span>
        </p>
      </Card>
    </div>
  );
}
