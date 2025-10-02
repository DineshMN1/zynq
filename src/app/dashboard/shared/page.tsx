'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Share2, Loader2, File, Folder } from 'lucide-react';
import { fileApi, type Share } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import { motion } from 'framer-motion';

export default function SharedPage() {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShares();
  }, []);

  const loadShares = async () => {
    try {
      setLoading(true);
      const response = await fileApi.getShared();
      setShares(response.items);
    } catch (error) {
      console.error('Failed to load shared files:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Shared with me</h1>
        <p className="text-muted-foreground mt-1">
          Files and folders others have shared with you
        </p>
      </div>

      {/* Shared Files */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : shares.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Share2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No shared files</h3>
              <p className="text-sm text-muted-foreground">
                Files shared with you will appear here
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shares.map((share, index) => (
            <motion.div
              key={share.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {share.file?.is_folder ? (
                      <Folder className="h-5 w-5 text-primary" />
                    ) : (
                      <File className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <Badge variant={share.permission === 'write' ? 'default' : 'secondary'}>
                    {share.permission}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium truncate" title={share.file?.name}>
                    {share.file?.name}
                  </p>
                  {share.file && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatBytes(share.file.size)}
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}