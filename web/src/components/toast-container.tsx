import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function ToastIcon({ variant }: { variant?: string }) {
  if (variant === 'destructive')
    return <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />;
  if (variant === 'warning')
    return <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />;
  if (variant === 'success')
    return <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />;
  return <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />;
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 flex flex-col gap-2 z-[60] w-80 pointer-events-none"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{ animation: 'toast-slide-in 0.2s ease-out' }}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm',
            t.variant === 'destructive'
              ? 'bg-red-600 text-white border-red-500/40'
              : t.variant === 'warning'
                ? 'bg-amber-500 text-white border-amber-400/40'
                : t.variant === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-500/40'
                  : 'bg-card text-foreground border-border',
          )}
        >
          <ToastIcon variant={t.variant} />
          <div className="flex-1 min-w-0">
            {t.title && <p className="font-semibold leading-snug">{t.title}</p>}
            {t.description && (
              <p className="text-xs opacity-80 mt-0.5 leading-snug">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 h-5 w-5 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors opacity-70 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(1rem); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
