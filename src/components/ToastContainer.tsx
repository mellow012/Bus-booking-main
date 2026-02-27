'use client';

import React from 'react';
import Toast from './Toast';
import { useAppToast } from '@/contexts/ToastContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 pointer-events-none max-w-md">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            {...toast}
            onClose={removeToast}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;