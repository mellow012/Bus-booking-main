import React from 'react';

const SkeletonElement = ({ className }: { className?: string }) => (
  <div className={`bg-gray-200 rounded-lg animate-pulse ${className}`} />
);

const ProfilePageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Profile Header Skeleton */}
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div className="flex items-center space-x-6 mb-6 lg:mb-0">
              <div className="w-24 h-24 bg-gray-200 rounded-full animate-pulse"></div>
              <div>
                <SkeletonElement className="h-8 w-48 mb-3" />
                <SkeletonElement className="h-5 w-64" />
                <SkeletonElement className="h-4 w-48 mt-3" />
              </div>
            </div>
            <SkeletonElement className="h-14 w-40 rounded-2xl" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 h-[116px]">
              <SkeletonElement className="h-full w-full" />
            </div>
          ))}
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="bg-white rounded-3xl shadow-lg p-2 mb-8 border border-gray-100">
          <SkeletonElement className="h-14 w-full rounded-2xl" />
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100 h-[400px]">
              <SkeletonElement className="h-full w-full" />
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100 h-[400px]">
              <SkeletonElement className="h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePageSkeleton;