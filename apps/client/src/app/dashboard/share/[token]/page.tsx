'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Cloud, Download } from 'lucide-react';
import { formatBytes } from '@/lib/auth';
import { publicApi } from '@/lib/api';
import {
  getFileIcon,
  getIconColor,
  getIconBgColor,
} from '@/features/file/utils/file-icons';
import { cn } from '@/lib/utils';

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
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
          {file &&
            (() => {
              const IconComponent = getFileIcon(
                file.name,
                file.mimeType,
                file.isFolder,
              );
              const iconColor = getIconColor(
                file.name,
                file.mimeType,
                file.isFolder,
              );
              const iconBgColor = getIconBgColor(
                file.name,
                file.mimeType,
                file.isFolder,
              );
              return (
                <div
                  className={cn(
                    'h-14 w-14 rounded-xl flex items-center justify-center',
                    iconBgColor,
                  )}
                >
                  <IconComponent className={cn('h-7 w-7', iconColor)} />
                </div>
              );
            })()}
          <p className="text-lg font-medium break-all max-w-full">
            {file?.name}
          </p>
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
          disabled={!file?.hasContent}
          onClick={async () => {
            if (!file?.hasContent) return;
            try {
              const { blob, fileName } = await publicApi.downloadShare(token);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName || file.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch {
              setError('Download failed.');
            }
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Download File
        </Button>

        <p className="text-xs text-muted-foreground mt-3">
          Shared securely via <span className="font-semibold">zynqCloud</span>
        </p>
      </Card>
    </div>
  );
}
