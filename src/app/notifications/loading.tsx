import React from 'react';

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 lg:pt-36 pb-20 px-4 sm:px-6 lg:px-8 animate-pulse">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div className="h-8 bg-gray-200 rounded-xl w-44" />
          <div className="h-9 bg-gray-200 rounded-lg w-28" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-grow space-y-2">
                <div className="h-4 bg-gray-200 rounded w-48" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
