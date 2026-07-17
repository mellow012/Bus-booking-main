
import React from 'react';
import { Bell, HelpCircle, Search } from 'lucide-react';

const TopBar = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              {/* Company Logo and Name */}
              <h1 className="text-xl font-bold">Company Admin</h1>
            </div>
          </div>
          <div className="flex items-center">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="block w-full rounded-md border-0 bg-gray-100 py-1.5 pl-10 pr-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
            {/* Notifications */}
            <button
              type="button"
              className="ml-4 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Bell className="h-6 w-6" />
            </button>
            {/* Help/Tour */}
            <button
              type="button"
              className="ml-4 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <HelpCircle className="h-6 w-6" />
            </button>
            {/* User Avatar */}
            <div className="ml-4 flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-gray-300"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
