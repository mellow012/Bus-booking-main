import React, { useState } from 'react';
import { fixRouteAssignments } from '@/lib/routeAssignment';
import { AlertCircle, CheckCircle, Wrench } from 'lucide-react';

interface FixRouteAssignmentsButtonProps {
  companyId: string;
}

export const FixRouteAssignmentsButton: React.FC<FixRouteAssignmentsButtonProps> = ({ companyId }) => {
  const [status, setStatus] = useState<'idle' | 'fixing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const handleFix = async () => {
    if (!confirm('This will update all route assignments to use Auth UIDs instead of Firestore doc IDs. Continue?')) {
      return;
    }

    setStatus('fixing');
    try {
      const res = await fixRouteAssignments(companyId);
      setResult(res);
      setStatus('success');
      
      // Reload page after 2 seconds to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Fix failed:', error);
      setStatus('error');
    }
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="font-bold text-yellow-900 text-lg mb-2">
            Route Assignment Issue Detected
          </h3>
          <p className="text-sm text-yellow-800 mb-4">
            Your routes are using Firestore document IDs instead of Firebase Auth UIDs in <code className="bg-yellow-100 px-1 rounded">assignedOperatorIds</code>.
            This prevents operators from seeing their assigned routes.
          </p>
          
          {status === 'idle' && (
            <button
              onClick={handleFix}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold transition-colors"
            >
              <Wrench className="w-4 h-4" />
              Fix All Route Assignments
            </button>
          )}

          {status === 'fixing' && (
            <div className="flex items-center gap-2 text-yellow-900">
              <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="font-semibold">Fixing route assignments...</span>
            </div>
          )}

          {status === 'success' && result && (
            <div className="bg-green-50 border border-green-400 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-900 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">✓ Fixed Successfully!</span>
              </div>
              <p className="text-sm text-green-800">
                • Routes checked: {result.total}<br />
                • Routes fixed: {result.fixedCount}<br />
                • Routes already correct: {result.skippedCount}
              </p>
              <p className="text-xs text-green-700 mt-2">Reloading page...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-400 rounded-lg p-4">
              <p className="text-sm text-red-800 font-semibold">
                ✗ Fix failed. Check console for details.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-xs text-yellow-700 bg-yellow-100 rounded-lg p-3">
        <strong>What this does:</strong> Converts operator assignments from Firestore document IDs 
        (like "V7JLMXNHJyiOEFlArtgB") to Firebase Auth UIDs (like "4F9bopnI3cObNVg4uKFdZSug0Gr1").
        This is a one-time fix and won't affect your data otherwise.
      </div>
    </div>
  );
};