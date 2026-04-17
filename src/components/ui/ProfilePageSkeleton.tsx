import React from 'react';

const ProfilePageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Profile Header Skeleton */}
        <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8 mb-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-center space-x-4 w-full lg:w-auto">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gray-200 rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-8 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-4 bg-gray-200 rounded w-40" />
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="h-10 bg-gray-200 rounded-2xl w-32" />
              <div className="h-10 bg-gray-200 rounded-2xl w-12" />
            </div>
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 h-32" />
          ))}
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="bg-white rounded-3xl shadow-lg p-2 mb-8 border border-gray-100 flex space-x-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-2xl w-24" />
          ))}
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100 h-[600px]" />
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100 h-[300px]" />
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100 h-[300px]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePageSkeleton;
