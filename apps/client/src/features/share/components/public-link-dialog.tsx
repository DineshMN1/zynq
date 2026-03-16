import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PublicLinkDialogProps {
  publicLink: string | null;
  fileName?: string;
  onClose: () => void;
}

export function PublicLinkDialog({
  publicLink,
  fileName,
  onClose,
}: PublicLinkDialogProps) {
  const handleCopy = async () => {
    if (publicLink) {
      try {
        await navigator.clipboard.writeText(publicLink);
        toast({ title: 'Copied to clipboard!' });
      } catch {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = publicLink;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'absolute';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          const copied = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (copied) {
            toast({ title: 'Copied to clipboard!' });
            return;
          }
        } catch {
          // fall through to error toast
        }
        toast({
          title: 'Copy failed',
          description: 'Unable to copy link automatically.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog open={!!publicLink} onOpenChange={() => onClose()}>
      <DialogContent className="w-[95vw] max-w-xl">
        <DialogHeader>
          <DialogTitle>Public Share Link</DialogTitle>
          <DialogDescription>
            Copy and share this link with others.
          </DialogDescription>
        </DialogHeader>
        {fileName ? (
          <p className="text-sm text-muted-foreground break-all rounded-md bg-muted/40 px-3 py-2">
            {fileName}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2 rounded-md bg-muted px-3 py-2 sm:flex-row sm:items-center">
          <div className="min-h-10 min-w-0 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono break-all">
            {publicLink || ''}
          </div>
          <Button
            size="icon"
            variant="secondary"
            onClick={handleCopy}
            className="self-end sm:self-auto"
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
