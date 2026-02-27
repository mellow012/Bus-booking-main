'use client';

import React, { useEffect } from 'react';
import { Check, X, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Toast as ToastType } from '@/hooks/useToast';

interface ToastProps extends ToastType {
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 4000,
  action,
  onClose,
}) => {
  useEffect(() => {
    if (duration === 0 || type === 'loading') return;

    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, type, id, onClose]);

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
    loading: 'bg-blue-50 border-blue-200',
  };

  const textColors = {
    success: 'text-green-900',
    error: 'text-red-900',
    warning: 'text-yellow-900',
    info: 'text-blue-900',
    loading: 'text-blue-900',
  };

  const iconColors = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
    loading: 'text-blue-600',
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check className={`w-5 h-5 ${iconColors.success}`} />;
      case 'error':
        return <X className={`w-5 h-5 ${iconColors.error}`} />;
      case 'warning':
        return <AlertTriangle className={`w-5 h-5 ${iconColors.warning}`} />;
      case 'loading':
        return <Loader2 className={`w-5 h-5 ${iconColors.loading} animate-spin`} />;
      default:
        return <Info className={`w-5 h-5 ${iconColors.info}`} />;
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 ${bgColors[type]} animate-in slide-in-from-top-4 duration-300 shadow-lg`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm ${textColors[type]}`}>{title}</h3>
          <p className={`text-sm mt-1 ${textColors[type]} opacity-90`}>{message}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {action && (
            <button
              onClick={action.onClick}
              className={`text-sm font-medium px-3 py-1 rounded hover:opacity-80 transition-opacity ${
                type === 'success'
                  ? 'bg-green-200 text-green-900'
                  : type === 'error'
                  ? 'bg-red-200 text-red-900'
                  : type === 'warning'
                  ? 'bg-yellow-200 text-yellow-900'
                  : 'bg-blue-200 text-blue-900'
              }`}
            >
              {action.label}
            </button>
          )}

          {type !== 'loading' && (
            <button
              onClick={() => onClose(id)}
              className={`p-1 hover:bg-black/10 rounded transition-colors ${textColors[type]}`}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toast;