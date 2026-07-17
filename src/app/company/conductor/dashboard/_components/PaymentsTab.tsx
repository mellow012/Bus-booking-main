'use client';

import { DollarSign } from 'lucide-react';
import { Booking } from '@/types';

interface PaymentsTabProps {
  tripBookings: Booking[];
}

export default function PaymentsTab({ tripBookings }: PaymentsTabProps) {
  const paidBookings = tripBookings.filter(b => b.paymentStatus === 'paid');
  const totalCollected = paidBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const cashCollected = paidBookings.filter(b => b.paymentMethod === 'cash').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const onlineCollected = totalCollected - cashCollected;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Collected</p>
            <p className="text-2xl font-black text-gray-900">MWK {totalCollected.toLocaleString()}</p>
         </div>
         <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Cash on Hand</p>
            <p className="text-2xl font-black text-emerald-700">MWK {cashCollected.toLocaleString()}</p>
         </div>
         <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Online/Prepaid</p>
            <p className="text-2xl font-black text-blue-700">MWK {onlineCollected.toLocaleString()}</p>
         </div>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
         <div className="p-6 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" /> Payment History
            </h3>
            <span className="text-xs font-bold text-gray-500">{paidBookings.length} transactions</span>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50">
                     <th className="px-6 py-4">Ref</th>
                     <th className="px-6 py-4">Passenger</th>
                     <th className="px-6 py-4">Method</th>
                     <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {paidBookings.map(b => (
                     <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{b.bookingReference}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 text-sm">{b.passengerDetails?.[0]?.name || 'Unknown'}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${b.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                              {b.paymentMethod}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-gray-900 text-sm">MWK {b.totalAmount?.toLocaleString()}</td>
                     </tr>
                  ))}
                  {paidBookings.length === 0 && (
                     <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold">No payments recorded yet.</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
