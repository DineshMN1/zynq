'use client';

import * as React from 'react';

type ToastVariant = 'default' | 'destructive' | 'success';

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 3000;

let toastCount = 0;
let memoryState: ToastProps[] = [];
const listeners: Array<(toasts: ToastProps[]) => void> = [];

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastProps[]>(memoryState);

  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const index = listeners.indexOf(setToasts);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    toasts,
    toast: showToast,
    dismiss: dismissToast,
  };
}

export function showToast(toast: Omit<ToastProps, 'id'>) {
  const id = (++toastCount).toString();
  const newToast = { id, ...toast };
  memoryState = [newToast, ...memoryState].slice(0, TOAST_LIMIT);
  listeners.forEach((listener) => listener(memoryState));
  setTimeout(() => dismissToast(id), TOAST_REMOVE_DELAY);
}

export function dismissToast(id: string) {
  memoryState = memoryState.filter((t) => t.id !== id);
  listeners.forEach((listener) => listener(memoryState));
}

export { showToast as toast };
