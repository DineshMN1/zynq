import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { FileTypeIcon } from '@/features/file/components/file-type-icon';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function SharedPage() {
  const [sharedWithMe, setSharedWithMe] = useState<Share[]>([]);
  const [publicShares, setPublicShares] = useState<Share[]>([]);
  const [sharedByMe, setSharedByMe] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [revokeType, setRevokeType] = useState<'public' | 'private'>('public');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<Share | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [clearExpiry, setClearExpiry] = useState(false);

  const loadShares = useCallback(async () => {
    try {
      setLoading(true);
      const [withMeData, publicData, byMeData] = await Promise.all([
        fileApi.getShared(),
        fileApi.getPublicShares(),
        fileApi.getPrivateShares(),
      ]);
      setSharedWithMe(withMeData.items);
      setPublicShares(publicData);
      setSharedByMe(byMeData.items);
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

  const handleDownloadShared = (shareId: string) => {
    fileApi.downloadShared(shareId);
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

  const formatExpiryLabel = (expiresAt?: string | null) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - Date.now();
    if (diffMs <= 0) return 'expired';
    const totalMinutes = Math.ceil(diffMs / 60000);
    if (totalMinutes < 60) return `expires in ${totalMinutes}m`;
    const totalHours = Math.ceil(totalMinutes / 60);
    if (totalHours < 24) return `expires in ${totalHours}h`;
    const totalDays = Math.ceil(totalHours / 24);
    return `expires in ${totalDays}d`;
  };

  const toDatetimeLocalValue = (iso?: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const handleEditPublicShare = (share: Share) => {
    setEditingShare(share);
    setEditPassword('');
    setClearPassword(false);
    setClearExpiry(false);
    setEditExpiresAt(toDatetimeLocalValue(share.expires_at));
    setEditDialogOpen(true);
  };

  const handleSavePublicShare = async () => {
    if (!editingShare) return;
    try {
      const updatePayload: {
        expiresAt?: string;
        password?: string;
        clearPassword?: boolean;
        clearExpiry?: boolean;
      } = {};

      if (clearPassword) {
        updatePayload.clearPassword = true;
      } else if (editPassword.trim()) {
        updatePayload.password = editPassword.trim();
      }

      if (clearExpiry) {
        updatePayload.clearExpiry = true;
      } else if (editExpiresAt) {
        updatePayload.expiresAt = new Date(editExpiresAt).toISOString();
      }

      const updated = await fileApi.updatePublicShare(
        editingShare.id,
        updatePayload,
      );
      setPublicShares((prev) =>
        prev.map((share) =>
          share.id === updated.id ? { ...share, ...updated } : share,
        ),
      );
      toast({ title: 'Public link updated' });
      setEditDialogOpen(false);
      setEditingShare(null);
    } catch (error) {
      console.error('Failed to update public share:', error);
      toast({
        title: 'Update failed',
        description: 'Could not update public share settings.',
        variant: 'destructive',
      });
    }
  };

  const totalItems =
    sharedWithMe.length + publicShares.length + sharedByMe.length;

  return (
    <div className="px-4 py-4 sm:p-6 space-y-6">
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
                  const expiryLabel = formatExpiryLabel(share.expires_at);
                  return (
                    <motion.div
                      key={share.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="h-full border-border/70 bg-gradient-to-b from-background to-muted/20 p-4 transition-colors hover:border-primary/50">
                        <div className="flex h-full flex-col">
                          <div className="flex items-start justify-between">
                            <FileTypeIcon name={fileName} mimeType={mimeType} isFolder={isFolder} size={44} />
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
                                ? formatBytes(Number(share.file?.folder_size || 0))
                                : formatBytes(Number(share.file?.size || 0))}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {share.hasPassword
                                  ? 'Protected'
                                  : 'No password'}
                              </Badge>
                              {expiryLabel ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {expiryLabel}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  No expiry
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-auto pt-4 space-y-2">
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
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleEditPublicShare(share)}
                            >
                              Edit
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
                            <FileTypeIcon name={fileName} mimeType={mimeType} isFolder={isFolder} size={44} />
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
                                  ? formatBytes(Number(share.file.folder_size || 0))
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
                            <FileTypeIcon name={fileName} mimeType={mimeType} isFolder={isFolder} size={44} />
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
                                  ? formatBytes(Number(share.file.folder_size || 0))
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit public link</DialogTitle>
            <DialogDescription>
              Update password protection and expiry for this public link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-public-password">New password</Label>
              <Input
                id="edit-public-password"
                type="password"
                placeholder="Leave empty to keep current"
                value={editPassword}
                onChange={(e) => {
                  setEditPassword(e.target.value);
                  if (e.target.value) setClearPassword(false);
                }}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="clear-public-password"
                  checked={clearPassword}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;
                    setClearPassword(enabled);
                    if (enabled) setEditPassword('');
                  }}
                />
                <Label htmlFor="clear-public-password">
                  Remove password protection
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-public-expiry">Expiry</Label>
              <Input
                id="edit-public-expiry"
                type="datetime-local"
                value={editExpiresAt}
                onChange={(e) => {
                  setEditExpiresAt(e.target.value);
                  if (e.target.value) setClearExpiry(false);
                }}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="clear-public-expiry"
                  checked={clearExpiry}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;
                    setClearExpiry(enabled);
                    if (enabled) setEditExpiresAt('');
                  }}
                />
                <Label htmlFor="clear-public-expiry">Remove expiry</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingShare(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePublicShare}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer />
    </div>
  );
}
