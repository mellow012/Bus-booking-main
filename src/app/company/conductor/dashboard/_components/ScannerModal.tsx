'use client';

import React, { FC, useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, QrCode, Camera, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

const ScannerModal: FC<ScannerModalProps> = ({ isOpen, onClose, onScan }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);

      // Timeout to ensure the modal container is rendered
      const timeoutId = setTimeout(() => {
        try {
          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          };

          const scanner = new Html5QrcodeScanner('reader', config, false);
          scannerRef.current = scanner;

          scanner.render(
            (decodedText) => {
              setSuccess(true);
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100);
              onScan(decodedText);
              // We don't close immediately to show success feedback
              setTimeout(() => {
                scanner.clear().catch(console.error);
                onClose();
              }, 1000);
            },
            (errorMessage) => {
              // Ignore frequent scan failures (common when searching)
              // console.log(errorMessage);
            }
          );
        } catch (err: any) {
          console.error('Scanner error:', err);
          setError('Could not initialize camera. Please ensure you have granted permissions.');
        }
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
      };
    }
  }, [isOpen, onScan, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan Ticket">
      <div className="space-y-4">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-800 font-bold mb-4">{error}</p>
            <Button onClick={onClose} variant="outline" className="w-full h-12 rounded-xl">Close</Button>
          </div>
        ) : success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-12 text-center animate-in zoom-in duration-300">
            <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
            <p className="text-emerald-800 font-black text-xl">Ticket Scanned!</p>
            <p className="text-emerald-600 font-bold mt-2">Processing check-in...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-square w-full max-w-[320px] mx-auto bg-black rounded-3xl overflow-hidden border-4 border-indigo-600/20 shadow-2xl">
              <div id="reader" className="w-full h-full"></div>
              
              {/* Custom Viewfinder Overlay */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
                <div className="w-full h-full border-2 border-indigo-500 rounded-lg relative">
                   <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1"></div>
                   <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1"></div>
                   <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1"></div>
                   <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1"></div>
                   
                   {/* Scanning Line Animation */}
                   <div className="absolute inset-x-0 h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-scan-line" />
                </div>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-gray-900 font-bold text-base flex items-center justify-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600" /> Center the QR code
              </p>
              <p className="text-gray-500 text-xs font-medium">Ticket will be scanned automatically</p>
            </div>
            
            <Button onClick={onClose} variant="outline" className="w-full h-12 rounded-xl font-bold border-gray-200">
              Cancel
            </Button>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        #reader__dashboard {
          display: none !important;
        }
        #reader__status_span {
          display: none !important;
        }
        #reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 20px !important;
        }
        @keyframes scan-line {
          0% { top: 0% }
          50% { top: 100% }
          100% { top: 0% }
        }
        .animate-scan-line {
          animation: scan-line 3s ease-in-out infinite;
        }
      `}</style>
    </Modal>
  );
};

export default ScannerModal;
