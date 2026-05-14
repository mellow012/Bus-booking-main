'use client';

import React from 'react';
import Toast from './Toast';
import { useAppToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppToast();
  const { user, loading } = useAuth();

  // Show offset if email verification banner is active
  const hasBanner = !loading && user && !user.emailVerified;

  return (
    <div className={`fixed ${hasBanner ? 'top-20' : 'top-6'} left-1/2 -translate-x-1/2 z-[100] space-y-3 pointer-events-none w-full max-w-md px-4 transition-all duration-500`}>
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto flex justify-center">
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
