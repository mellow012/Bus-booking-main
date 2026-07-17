'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { User, Save, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveProfileSource } from '../_lib/profile-data';

interface ProfileTabProps {
  dashboard: any;
}

export default function ProfileTab({ dashboard }: ProfileTabProps) {
  const resolvedProfile = useMemo(() => resolveProfileSource(dashboard), [dashboard]);
  const profile = resolvedProfile.profile;
  const { refreshUserProfile } = useAuth();

  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    phone: profile?.phoneNumber || profile?.phone || '',
  });

  useEffect(() => {
    setFormData({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      phone: profile?.phoneNumber || profile?.phone || '',
    });
  }, [profile?.firstName, profile?.lastName, profile?.phoneNumber, profile?.phone]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const profileHeading = resolvedProfile.isViewingOperator ? 'Operator Profile' : 'My Profile';
  const profileDescription = resolvedProfile.isViewingOperator
    ? 'Viewing the selected operator profile.'
    : 'Manage your personal information.';

  const normalizePhone = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    let p = trimmed.replace(/[\s\-()]/g, '');
    if (p.startsWith('00')) p = '+' + p.slice(2);
    if (p.startsWith('+')) return '+' + p.replace(/[^\d]/g, '');
    if (p.startsWith('0')) return '+265' + p.replace(/^0+/, '');
    const digits = p.replace(/[^\d]/g, '');
    if (digits.length >= 7 && digits.length <= 10) return '+265' + digits;
    return '+' + digits;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: normalizePhone(formData.phone),
      };

      if (!payload.firstName || !payload.lastName) {
        throw new Error('First name and last name are required.');
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update profile');
      }

      if (result?.data?.phone) {
        setFormData((prev) => ({ ...prev, phone: result.data.phone }));
      }

      await refreshUserProfile();
      if (dashboard.fetchInitialData) await dashboard.fetchInitialData(true);
      if (dashboard.showAlert) dashboard.showAlert('success', 'Profile updated successfully');
      setSaveMessage('Profile updated successfully.');
    } catch (error: any) {
      const message = error?.message || 'Failed to update profile';
      if (dashboard.showAlert) dashboard.showAlert('error', message);
      setSaveMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-600" />
          {profileHeading}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {profileDescription}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:w-2/3">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="block w-full rounded-lg border-gray-200 bg-gray-50 text-gray-500 shadow-sm sm:text-sm px-3 py-2 border"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Branch / Region</label>
              <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg text-indigo-700 border border-indigo-100">
                <MapPin className="w-5 h-5" />
                <span className="font-semibold">{profile?.branch?.join(', ') || profile?.region || 'Not assigned'}</span>
              </div>
            </div>

          </div>

          <div className="pt-4 flex flex-col gap-3 border-t border-gray-100 md:flex-row md:items-center md:justify-between">
            {saveMessage ? (
              <p className={`text-sm ${saveMessage.toLowerCase().includes('success') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {saveMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
