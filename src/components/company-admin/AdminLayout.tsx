
import React from 'react';
import TopBar from './TopBar';
import Breadcrumb from './Breadcrumb';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <main className="p-4 sm:p-6 lg:p-8">
        <Breadcrumb />
        <div className="mt-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
