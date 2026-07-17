import React from 'react';
import {
  Building2, User2, CreditCard, Activity, Wifi, User, Layers, X, Loader2,
} from 'lucide-react';

type TabType = string;

interface Props {
  activeTab: string;
  setActiveTab: (t: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (b: boolean) => void;
  userProfile?: any;
  signOut: () => void;
}

const SidebarItem: React.FC<{ id: string; label: string; icon: any; isActive: boolean; onClick: () => void }> = ({ id, label, icon: Icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 px-4 space-x-3 mb-1 ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
  >
    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-indigo-600 text-gray-400'}`} />
    <span className="text-[13px] font-bold flex-1 text-left truncate">{label}</span>
  </button>
);

export default function AdminSidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen, userProfile, signOut }: Props) {
  return (
    <aside className={`w-64 bg-white border-r border-gray-100 h-screen fixed lg:sticky top-0 flex flex-col z-50 overflow-hidden transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="p-6 mb-2 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-indigo-900 text-[15px] leading-tight">Super Admin</h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Platform Control</p>
          </div>
        </div>
        <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2">
        <SidebarItem id="overview" label="Overview" icon={Building2} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <SidebarItem id="companies" label="Companies" icon={Building2} isActive={activeTab === 'companies'} onClick={() => setActiveTab('companies')} />
        <SidebarItem id="users" label="Users" icon={User2} isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <SidebarItem id="payments" label="Payments" icon={CreditCard} isActive={activeTab === 'payments'} onClick={() => setActiveTab('payments')} />
        <SidebarItem id="audit" label="Audit" icon={Activity} isActive={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
        <SidebarItem id="health" label="System Health" icon={Wifi} isActive={activeTab === 'health'} onClick={() => setActiveTab('health')} />
        <SidebarItem id="profile" label="Profiles" icon={User} isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />

        <div className="pt-4 mt-4 border-t border-gray-50">
          <button onClick={signOut} className="w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 px-4 space-x-3 text-red-500 hover:bg-red-50">
            <Loader2 className="w-5 h-5 flex-shrink-0 group-hover:rotate-180 transition-transform" />
            <span className="text-[13px] font-bold">Sign Out</span>
          </button>
        </div>
      </nav>

      <div className="p-4 bg-gray-50/50 m-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-[10px] font-black text-white">SA</div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-gray-900 truncate">{userProfile?.firstName || 'Admin'}</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] font-bold text-gray-500 uppercase">Super User</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
