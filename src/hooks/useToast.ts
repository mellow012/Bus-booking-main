import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (
      title: string,
      message: string,
      type: ToastType = 'info',
      duration: number = 4000,
      action?: { label: string; onClick: () => void }
    ) => {
      const id = `${Date.now()}-${Math.random()}`;
      const toast: Toast = { id, type, title, message, duration, action };

      setToasts((prev) => [toast, ...prev]);

      if (duration > 0 && type !== 'loading') {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, message: string, duration?: number) =>
      addToast(title, message, 'success', duration ?? 4000),
    [addToast]
  );

  const error = useCallback(
    (title: string, message: string, duration?: number) =>
      addToast(title, message, 'error', duration ?? 5000),
    [addToast]
  );

  const warning = useCallback(
    (title: string, message: string, duration?: number) =>
      addToast(title, message, 'warning', duration ?? 4000),
    [addToast]
  );

  const info = useCallback(
    (title: string, message: string, duration?: number) =>
      addToast(title, message, 'info', duration ?? 4000),
    [addToast]
  );

  const loading = useCallback(
    (title: string, message: string) => addToast(title, message, 'loading', 0),
    [addToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    loading,
  };
};