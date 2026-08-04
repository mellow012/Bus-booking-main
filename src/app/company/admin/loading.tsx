import React from 'react';

export default function CompanyAdminLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:flex w-72 flex-col bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse ml-3" />
        </div>
        <div className="p-4 space-y-2 flex-1">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse flex items-center px-4 gap-3">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100">
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Skeleton */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="h-6 w-40 bg-gray-200 rounded-md animate-pulse hidden sm:block" />
            <div className="flex items-center gap-4">
              <div className="h-10 w-48 bg-gray-100 rounded-full animate-pulse hidden md:block" />
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          {/* Subnav Skeleton */}
          <div className="px-4 sm:px-6 lg:px-8 border-t border-gray-100 bg-white">
            <div className="flex gap-6 h-12 items-center">
               <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
               <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
               <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </header>

        {/* Tab Content Skeleton */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
               <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
               <div className="h-10 w-32 bg-indigo-100 rounded-lg animate-pulse" />
            </div>

            {/* Dashboard Cards Skeleton Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="h-5 w-10 bg-gray-200 rounded-lg animate-pulse mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                  <div className="h-8 bg-gray-300 rounded w-20 animate-pulse" />
                </div>
              ))}
            </div>

            {/* Data Table/List Skeleton */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
               <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-6" />
               {[1, 2, 3, 4, 5].map(i => (
                 <div key={i} className="h-16 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />
               ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
