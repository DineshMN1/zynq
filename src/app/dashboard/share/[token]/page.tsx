'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Cloud, Download, File } from 'lucide-react';
import { formatBytes } from '@/lib/auth';

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchFile();
  }, [token]);

  const fetchFile = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/share/${token}`);
      if (!res.ok) throw new Error('File not found');
      const data = await res.json();
      setFile(data);
    } catch (err) {
      setError('This link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

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
          <File className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">{file.name}</p>
          <p className="text-sm text-muted-foreground">
            {file.mime_type} • {formatBytes(file.size || 0)}
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => window.open(file.downloadUrl, '_blank')}
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
