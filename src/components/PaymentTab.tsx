"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PaymentsTab = ({ company, paymentSettings, bookings, setError, setSuccess }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "bookings"), where("companyId", "==", company.id), where("paymentStatus", "==", "paid"));
        const snapshot = await getDocs(q);
        const fetchedTransactions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          bookingDate: doc.data().bookingDate.toDate ? doc.data().bookingDate.toDate() : new Date(doc.data().bookingDate),
        }));
        setTransactions(fetchedTransactions);
      } catch (err: any) {
        setError(err.message || "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };

    if (company.id) fetchTransactions();
  }, [company.id, setError]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-8 bg-gray-200 animate-pulse rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2 mt-1"></div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {Array(5)
                  .fill(0)
                  .map((_, index) => (
                    <TableHead key={index}>
                      <div className="h-6 bg-gray-200 animate-pulse rounded"></div>
                    </TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array(3)
                .fill(0)
                .map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Array(5)
                      .fill(0)
                      .map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <div className="h-4 bg-gray-200 animate-pulse rounded"></div>
                        </TableCell>
                      ))}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">Payment Management</h3>
        <p className="text-gray-600 mt-1">View and manage your payment transactions</p>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.bookingReference}</TableCell>
                    <TableCell>MWK {transaction.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>{transaction.bookingDate.toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>{transaction.paymentStatus}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => alert("Payout initiated")}>
                        Initiate Payout
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {transactions.length === 0 && <p className="text-gray-500">No transactions found.</p>}
        </>
      )}
    </div>
  );
};

export default PaymentsTab;