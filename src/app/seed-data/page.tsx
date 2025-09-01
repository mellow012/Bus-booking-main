'use client';

import React, { useState } from 'react';
import { seedDatabase } from '@/utils/seedDatabase';

export default function SeedData() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSeedDatabase = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await seedDatabase();
      setMessage('Database seeded successfully! You can now search for buses.');
    } catch (err: any) {
      setError(err.message || 'Failed to seed database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Database Setup
          </h1>
          
          <p className="text-gray-600 mb-8">
            Click the button below to populate the database with sample data including companies, buses, routes, and schedules.
          </p>

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleSeedDatabase}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Seeding Database...' : 'Seed Database'}
          </button>

          <div className="mt-8 text-left">
            <h3 className="font-semibold text-gray-900 mb-2">What will be created:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 4 Bus companies</li>
              <li>• 12 Buses with different types</li>
              <li>• 20 Routes between major cities</li>
              <li>• 1,800+ Schedules for the next 30 days</li>
            </ul>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

