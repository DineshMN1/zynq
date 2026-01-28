'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Share2, Loader2, File, Folder, Globe, Trash2, Copy, Check } from 'lucide-react';
import { fileApi, type Share } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';

export default function SharedPage() {
  const [privateShares, setPrivateShares] = useState<Share[]>([]);
  const [publicShares, setPublicShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    try {
      setLoading(true);
      const [privateData, publicData] = await Promise.all([
        fileApi.getShared(), // shared *with me*
        fileApi.getPublicShares(), // shared *by me* publicly
      ]);
      setPrivateShares(privateData);
      setPublicShares(publicData);
    } catch (error) {
      console.error('Failed to load shared files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm('Are you sure you want to stop sharing this file publicly? The link will no longer work.')) {
      return;
    }
    try {
      await fileApi.revokeShare(shareId);
      setPublicShares(publicShares.filter((s) => s.id !== shareId));
      toast({
        title: 'Share revoked',
        description: 'Public link has been disabled.',
      });
    } catch (error) {
      console.error('Failed to revoke share:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke the share.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = async (token: string, shareId: string) => {
    const link = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: 'Link copied',
        description: 'Public link copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const totalItems = privateShares.length + publicShares.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Shared Files</h1>
        <p className="text-muted-foreground mt-1">
          Files shared with you or publicly shared by you
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : totalItems === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Share2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No shared files</h3>
            <p className="text-sm text-muted-foreground">
              Files shared with you or publicly will appear here
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Publicly Shared by Me */}
          {publicShares.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Public Links
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {publicShares.map((share, index) => (
                  <motion.div
                    key={share.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="p-4 hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {share.file?.is_folder ? (
                            <Folder className="h-5 w-5 text-primary" />
                          ) : (
                            <File className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <Badge variant="outline">Public</Badge>
                      </div>
                      <div>
                        <p className="font-medium truncate" title={share.file?.name}>
                          {share.file?.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatBytes(share.file?.size ?? 0)}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => share.share_token && handleCopyLink(share.share_token, share.id)}
                          >
                            {copiedId === share.id ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            Copy
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevokeShare(share.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Stop Sharing
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Shared with Me */}
          {privateShares.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" /> Shared With Me
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {privateShares.map((share, index) => (
                  <motion.div
                    key={share.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="p-4 hover:border-primary/50 transition-colors">
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
                      <p className="font-medium truncate" title={share.file?.name}>
                        {share.file?.name}
                      </p>
                      {share.file && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatBytes(share.file.size)}
                        </p>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ToastContainer />
    </div>
  );
}
