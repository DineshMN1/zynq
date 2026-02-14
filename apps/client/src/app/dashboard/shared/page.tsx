'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Share2,
  Loader2,
  Globe,
  Trash2,
  Copy,
  Check,
  Download,
  Lock,
  Users,
} from 'lucide-react';
import { fileApi, type Share } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';
import {
  getFileIcon,
  getIconBgColor,
  getIconColor,
} from '@/features/file/utils/file-icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SharedPage() {
  const [sharedWithMe, setSharedWithMe] = useState<Share[]>([]);
  const [publicShares, setPublicShares] = useState<Share[]>([]);
  const [sharedByMe, setSharedByMe] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [revokeType, setRevokeType] = useState<'public' | 'private'>('public');

  const loadShares = useCallback(async () => {
    try {
      setLoading(true);
      const [withMeData, publicData, byMeData] = await Promise.all([
        fileApi.getShared(),
        fileApi.getPublicShares(),
        fileApi.getPrivateShares(),
      ]);
      setSharedWithMe(withMeData);
      setPublicShares(publicData);
      setSharedByMe(byMeData);
    } catch (error) {
      console.error('Failed to load shared files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleRevokeShare = (shareId: string, type: 'public' | 'private') => {
    setSelectedShareId(shareId);
    setRevokeType(type);
    setRevokeDialogOpen(true);
  };

  const confirmRevokeShare = async () => {
    if (!selectedShareId) return;
    try {
      await fileApi.revokeShare(selectedShareId);
      if (revokeType === 'public') {
        setPublicShares(publicShares.filter((s) => s.id !== selectedShareId));
      } else {
        setSharedByMe(sharedByMe.filter((s) => s.id !== selectedShareId));
      }
      toast({
        title: 'Share revoked',
        description:
          revokeType === 'public'
            ? 'Public link has been disabled.'
            : 'Private share has been revoked.',
      });
    } catch (error) {
      console.error('Failed to revoke share:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke the share.',
        variant: 'destructive',
      });
    } finally {
      setRevokeDialogOpen(false);
      setSelectedShareId(null);
    }
  };

  const handleDownloadShared = async (shareId: string) => {
    try {
      const { blob, fileName } = await fileApi.downloadShared(shareId);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Error downloading',
        description: 'Unable to download file.',
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

  const totalItems =
    sharedWithMe.length + publicShares.length + sharedByMe.length;

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
                {publicShares.map((share, index) => {
                  const fileName = share.file?.name ?? 'File';
                  const mimeType = share.file?.mime_type ?? '';
                  const isFolder = !!share.file?.is_folder;
                  const IconComponent = getFileIcon(
                    fileName,
                    mimeType,
                    isFolder,
                  );
                  const iconColor = getIconColor(fileName, mimeType, isFolder);
                  const iconBgColor = getIconBgColor(
                    fileName,
                    mimeType,
                    isFolder,
                  );
                  return (
                    <motion.div
                      key={share.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="p-4 h-full hover:border-primary/50 transition-colors">
                        <div className="flex h-full flex-col">
                          <div className="flex items-start justify-between">
                            <div
                              className={`h-12 w-12 rounded-xl flex items-center justify-center ${iconBgColor}`}
                            >
                              <IconComponent
                                className={`h-6 w-6 ${iconColor}`}
                              />
                            </div>
                            <Badge variant="outline" className="gap-1">
                              <Globe className="h-3 w-3" />
                              Public
                            </Badge>
                          </div>
                          <div className="mt-3">
                            <p
                              className="font-medium truncate"
                              title={share.file?.name}
                            >
                              {share.file?.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {share.file?.is_folder
                                ? 'Folder'
                                : formatBytes(Number(share.file?.size || 0))}
                            </p>
                          </div>
                          <div className="mt-auto pt-4 grid grid-cols-2 gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={() =>
                                share.share_token &&
                                handleCopyLink(share.share_token, share.id)
                              }
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
                              className="w-full"
                              onClick={() =>
                                handleRevokeShare(share.id, 'public')
                              }
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Stop Sharing
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Shared by Me (Private) */}
          {sharedByMe.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Shared by Me
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sharedByMe.map((share, index) => {
                  const fileName = share.file?.name ?? 'File';
                  const mimeType = share.file?.mime_type ?? '';
                  const isFolder = !!share.file?.is_folder;
                  const IconComponent = getFileIcon(
                    fileName,
                    mimeType,
                    isFolder,
                  );
                  const iconColor = getIconColor(fileName, mimeType, isFolder);
                  const iconBgColor = getIconBgColor(
                    fileName,
                    mimeType,
                    isFolder,
                  );
                  return (
                    <motion.div
                      key={share.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="p-4 h-full hover:border-primary/50 transition-colors">
                        <div className="flex h-full flex-col">
                          <div className="flex items-start justify-between">
                            <div
                              className={`h-12 w-12 rounded-xl flex items-center justify-center ${iconBgColor}`}
                            >
                              <IconComponent
                                className={`h-6 w-6 ${iconColor}`}
                              />
                            </div>
                            <Badge
                              variant={
                                share.permission === 'write'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="gap-1"
                            >
                              <Lock className="h-3 w-3" />
                              {share.permission}
                            </Badge>
                          </div>
                          <div className="mt-3">
                            <p
                              className="font-medium truncate"
                              title={share.file?.name}
                            >
                              {share.file?.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Shared with{' '}
                              {share.grantee_user?.name ||
                                share.grantee_email ||
                                'Unknown'}
                            </p>
                            {share.file && (
                              <p className="text-xs text-muted-foreground">
                                {share.file.is_folder
                                  ? 'Folder'
                                  : formatBytes(Number(share.file.size || 0))}
                              </p>
                            )}
                          </div>
                          <div className="mt-auto pt-4">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                handleRevokeShare(share.id, 'private')
                              }
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Revoke Access
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Shared with Me */}
          {sharedWithMe.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" /> Shared With Me
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sharedWithMe.map((share, index) => {
                  const fileName = share.file?.name ?? 'File';
                  const mimeType = share.file?.mime_type ?? '';
                  const isFolder = !!share.file?.is_folder;
                  const IconComponent = getFileIcon(
                    fileName,
                    mimeType,
                    isFolder,
                  );
                  const iconColor = getIconColor(fileName, mimeType, isFolder);
                  const iconBgColor = getIconBgColor(
                    fileName,
                    mimeType,
                    isFolder,
                  );
                  return (
                    <motion.div
                      key={share.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="p-4 h-full hover:border-primary/50 transition-colors">
                        <div className="flex h-full flex-col">
                          <div className="flex items-start justify-between">
                            <div
                              className={`h-12 w-12 rounded-xl flex items-center justify-center ${iconBgColor}`}
                            >
                              <IconComponent
                                className={`h-6 w-6 ${iconColor}`}
                              />
                            </div>
                            <Badge
                              variant={
                                share.permission === 'write'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="gap-1"
                            >
                              <Lock className="h-3 w-3" />
                              {share.permission}
                            </Badge>
                          </div>
                          <div className="mt-3">
                            <p
                              className="font-medium truncate"
                              title={share.file?.name}
                            >
                              {share.file?.name}
                            </p>
                            {share.file && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {share.file.is_folder
                                  ? 'Folder'
                                  : formatBytes(Number(share.file.size || 0))}
                              </p>
                            )}
                          </div>
                          <div className="mt-auto pt-4">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={() => handleDownloadShared(share.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {share.file?.is_folder
                                ? 'Download folder (zip)'
                                : 'Download'}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Revoke Share Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revokeType === 'public'
                ? 'Stop sharing this file?'
                : 'Revoke access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeType === 'public'
                ? 'Are you sure you want to stop sharing this file publicly? The link will no longer work and anyone with the link will lose access.'
                : "Are you sure you want to revoke this user's access to the file? They will no longer be able to view or download it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeShare}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeType === 'public' ? 'Stop Sharing' : 'Revoke Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ToastContainer />
    </div>
  );
}
