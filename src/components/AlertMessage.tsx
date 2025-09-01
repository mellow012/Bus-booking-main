// components/AlertMessage.tsx
import { FC, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, X, AlertTriangle, Info } from 'lucide-react';

interface AlertMessageProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number; // in milliseconds
  className?: string;
}

const AlertMessage: FC<AlertMessageProps> = ({ 
  type, 
  message, 
  onClose,
  autoClose = true,
  duration = 5000,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (autoClose) {
      // Progress bar animation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 50));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 50);

      // Auto close timer
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for fade out animation
      }, duration);

      return () => {
        clearInterval(progressInterval);
        clearTimeout(timer);
      };
    }
  }, [autoClose, duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for fade out animation
  };

  const getAlertConfig = () => {
    switch (type) {
      case 'error':
        return {
          bgColor: 'bg-red-50',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          buttonColor: 'text-red-600 hover:text-red-800',
          borderColor: 'border-red-200',
          progressColor: 'bg-red-400',
          icon: <AlertCircle className="w-5 h-5" />
        };
      case 'success':
        return {
          bgColor: 'bg-green-50',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
          buttonColor: 'text-green-600 hover:text-green-800',
          borderColor: 'border-green-200',
          progressColor: 'bg-green-400',
          icon: <CheckCircle className="w-5 h-5" />
        };
      case 'warning':
        return {
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
          buttonColor: 'text-yellow-600 hover:text-yellow-800',
          borderColor: 'border-yellow-200',
          progressColor: 'bg-yellow-400',
          icon: <AlertTriangle className="w-5 h-5" />
        };
      case 'info':
        return {
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          buttonColor: 'text-blue-600 hover:text-blue-800',
          borderColor: 'border-blue-200',
          progressColor: 'bg-blue-400',
          icon: <Info className="w-5 h-5" />
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          buttonColor: 'text-gray-600 hover:text-gray-800',
          borderColor: 'border-gray-200',
          progressColor: 'bg-gray-400',
          icon: <Info className="w-5 h-5" />
        };
    }
  };

  const config = getAlertConfig();

  return (
    <div 
      className={`mb-6 rounded-lg border p-4 shadow-sm transition-all duration-300 transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      } ${config.bgColor} ${config.borderColor} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`${config.iconColor} mr-3 flex-shrink-0`}>
            {config.icon}
          </div>
          <span className={`text-sm font-medium ${config.textColor}`}>
            {message}
          </span>
        </div>
        <button 
          onClick={handleClose}
          className={`${config.buttonColor} transition-colors duration-200 hover:scale-110 transform flex-shrink-0 ml-4 p-1 rounded-full hover:bg-white hover:bg-opacity-50`}
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Progress bar for auto-close */}
      {autoClose && (
        <div className="mt-3 w-full bg-white bg-opacity-30 rounded-full h-1 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-75 ease-linear ${config.progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default AlertMessage;