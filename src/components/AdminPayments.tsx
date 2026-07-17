import React from 'react';
import { CreditCard, Wifi, Zap, AlertCircle, X } from 'lucide-react';
import SettingsTab from '@/components/SettingsTab';
import { Company, Booking } from '@/types/index';

type PaymentSummary = {
  totalCompanies: number;
  enabledCompanies: number;
  fullyConfiguredCompanies: number;
  incompleteConfigs: number;
  totalRevenue: number;
  failedPayments: number;
  pendingPayments: number;
};

const StatPill: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string }> = ({ icon, label, value, color }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] bg-white">
    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-1.5">{label}</p>
      <p className="text-base font-bold text-gray-900 leading-none">{value}</p>
    </div>
  </div>
);

interface Props {
  companies: Company[];
  bookings: Booking[];
  paymentSummary: PaymentSummary;
  paymentCompanyQuery: string;
  setPaymentCompanyQuery: (q: string) => void;
  paymentCompanyPagination: any;
  selectedPaymentCompany: Company | null;
  setSelectedPaymentCompany: (c: Company | null) => void;
  updateCompanySettings: (c: Company) => void;
  openPaymentSettingsModal: (c: Company) => void;
  showAlert: (type: 'error'|'success'|'info'|'warning', msg: string) => void;
}

export default function AdminPayments({
  companies,
  bookings,
  paymentSummary,
  paymentCompanyQuery,
  setPaymentCompanyQuery,
  paymentCompanyPagination,
  selectedPaymentCompany,
  setSelectedPaymentCompany,
  updateCompanySettings,
  openPaymentSettingsModal,
  showAlert,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-gray-900">Payments & System Settings</h3>
          <p className="text-[10px] text-gray-400 mt-1">Review gateway health, connected companies, and configure payment settings per partner.</p>
        </div>
        {selectedPaymentCompany ? (
          <button type="button" onClick={() => setSelectedPaymentCompany(null)}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            Back to payment summary
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill icon={<CreditCard className="w-4 h-4 text-white" />} label="Companies linked" value={paymentSummary.totalCompanies} color="bg-slate-100 text-slate-700" />
        <StatPill icon={<Wifi className="w-4 h-4 text-white" />} label="Gateways active" value={`${paymentSummary.enabledCompanies}`} color="bg-emerald-100 text-emerald-700" />
        <StatPill icon={<Zap className="w-4 h-4 text-white" />} label="Fully configured" value={`${paymentSummary.fullyConfiguredCompanies}`} color="bg-indigo-100 text-indigo-700" />
        <StatPill icon={<AlertCircle className="w-4 h-4 text-white" />} label="Pending / failed" value={`${paymentSummary.pendingPayments} / ${paymentSummary.failedPayments}`} color="bg-amber-100 text-amber-700" />
      </div>

      {!selectedPaymentCompany ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Connected companies</h4>
              <p className="text-[10px] text-gray-400">Manage payment settings for each company on the platform.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={paymentCompanyQuery}
                  onChange={e => setPaymentCompanyQuery(e.target.value)}
                  placeholder="Search companies..."
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Company</th>
                    <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Revenue</th>
                    <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Payments</th>
                    <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paymentCompanyPagination.currentCompanies.map((company: Company) => (
                    <tr key={company.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">{(company.name || 'C')[0]}</div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">{company.name}</div>
                            <div className="text-xs text-gray-400">{company.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">MWK {((company as any)._revenue || 0).toLocaleString()}</td>
                      <td className="px-5 py-4">{(company as any)._bookings || 0}</td>
                      <td className="px-5 py-4"><span className="text-xs text-gray-500">{company.status}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openPaymentSettingsModal(company)} className="px-3 py-2 rounded-2xl bg-indigo-50 text-indigo-700 text-xs font-bold">Settings</button>
                          <button onClick={() => setSelectedPaymentCompany(company)} className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-xs">View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Displaying {paymentCompanyPagination.startIndex}—{paymentCompanyPagination.endIndex} Of {paymentCompanyPagination.totalItems} Companies</p>
              <div className="flex items-center gap-1">
                <button onClick={() => paymentCompanyPagination.currentPage > 1 && paymentCompanyPagination.onPrev?.()} className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-all">Prev</button>
                <span className="px-4 text-xs font-black text-gray-700">PAGE {paymentCompanyPagination.currentPage}</span>
                <button onClick={() => paymentCompanyPagination.currentPage < paymentCompanyPagination.totalPages && paymentCompanyPagination.onNext?.()} className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-all">Next</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h4 className="text-sm font-bold text-gray-900">Company Transactions</h4>
            <p className="text-xs text-gray-400 mt-1">Summary of recent transactions and splits.</p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <SettingsTab
              company={selectedPaymentCompany as Company}
              setCompany={updateCompanySettings as any}
              setError={msg => showAlert('error', msg)}
              setSuccess={msg => showAlert('success', msg)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
