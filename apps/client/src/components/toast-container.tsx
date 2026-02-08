'use client';

import { useToast } from '@/hooks/use-toast';

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-md shadow-md px-4 py-3 border text-sm ${
            t.variant === 'destructive'
              ? 'bg-red-600 text-white border-red-700'
              : t.variant === 'success'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-background border-muted'
          }`}
        >
          {t.title && <div className="font-semibold">{t.title}</div>}
          {t.description && (
            <div className="text-xs opacity-80">{t.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}
