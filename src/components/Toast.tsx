'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, AlertTriangle, Info, Loader2, Bell } from 'lucide-react';
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
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  useEffect(() => {
    if (duration === 0 || type === 'loading') return;

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, type, id]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  };

  const configs = {
    success: {
      bg: 'bg-gradient-to-r from-emerald-500 to-green-600',
      icon: <Check className="w-5 h-5 text-white" />,
      iconBg: 'bg-white/20',
      ring: 'ring-emerald-400/30',
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-rose-600',
      icon: <X className="w-5 h-5 text-white" />,
      iconBg: 'bg-white/20',
      ring: 'ring-red-400/30',
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
      icon: <AlertTriangle className="w-5 h-5 text-white" />,
      iconBg: 'bg-white/20',
      ring: 'ring-amber-400/30',
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      icon: <Info className="w-5 h-5 text-white" />,
      iconBg: 'bg-white/20',
      ring: 'ring-blue-400/30',
    },
    loading: {
      bg: 'bg-gradient-to-r from-slate-700 to-slate-800',
      icon: <Loader2 className="w-5 h-5 text-white animate-spin" />,
      iconBg: 'bg-white/20',
      ring: 'ring-slate-400/30',
    },
  };

  const config = configs[type];

  return (
    <div
      className={`${config.bg} w-full rounded-2xl p-4 shadow-2xl ring-1 ${config.ring} backdrop-blur-md transition-all duration-500 ease-out ${
        isVisible && !isExiting
          ? 'translate-y-0 opacity-100 scale-100'
          : isExiting
          ? '-translate-y-4 opacity-0 scale-95'
          : '-translate-y-8 opacity-0 scale-95'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className={`${config.iconBg} rounded-xl p-2 shrink-0`}>
          {config.icon}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-bold text-sm text-white leading-tight">{title}</h3>
          <p className="text-[13px] mt-0.5 text-white/80 leading-snug">{message}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {action && (
            <button
              onClick={action.onClick}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              {action.label}
            </button>
          )}

          {type !== 'loading' && (
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/70 hover:text-white"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      {duration > 0 && type !== 'loading' && (
        <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/40 rounded-full"
            style={{
              animation: `shrink ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default Toast;
