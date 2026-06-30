'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, MapPin, Building, Globe, Phone, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ProfileTabProps {
  dashboard: any;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function ProfileTab({ dashboard }: ProfileTabProps) {
  const { dashboardData, updateDashboardData } = dashboard;
  const company = dashboardData.company;
  const branches = dashboardData.regions || [];

  const [formData, setFormData] = useState({
    name: company?.name || '',
    contactEmail: company?.email || '',
    contactPhone: company?.contact || company?.phone || '',
    address: company?.address || '',
    description: company?.description || '',
    whatsapp: company?.socials?.whatsapp || '',
    website: company?.socials?.website || '',
  });

  const [operatingHours, setOperatingHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(() => {
    const defaults: Record<string, { open: string; close: string; closed: boolean }> = {};
    DAYS_OF_WEEK.forEach(day => {
      defaults[day] = company?.operatingHours?.[day] || { open: '06:00', close: '18:00', closed: false };
    });
    return defaults;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync form with company data changes
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        contactEmail: company.email || '',
        contactPhone: company.contact || company.phone || '',
        address: company.address || '',
        description: company.description || '',
        whatsapp: company.socials?.whatsapp || '',
        website: company.socials?.website || '',
      });
    }
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleHoursChange = (day: string, field: 'open' | 'close', value: string) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleDayClosed = (day: string, closed: boolean) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], closed }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const updatedData = {
        name: formData.name,
        contact: formData.contactPhone,
        phone: formData.contactPhone,
        address: formData.address,
        description: formData.description,
        operatingHours,
        socials: {
          whatsapp: formData.whatsapp,
          website: formData.website,
        }
      };

      // Optimistic UI update
      updateDashboardData('company', { ...company, ...updatedData });
      
      const response = await fetch('/api/company/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company?.id, ...updatedData })
      });
      
      if (!response.ok) throw new Error('Failed to update');
      
      dashboard.showAlert('success', 'Profile updated successfully');
    } catch (error) {
      dashboard.showAlert('error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!company) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Company information not available. Please set up your company first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Company Profile
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Update your public details, operating hours, and contact information.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-400" /> Core Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text" name="name" value={formData.name} onChange={handleChange} required
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headquarters Address</label>
              <input
                type="text" name="address" value={formData.address} onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="e.g., Area 3, Lilongwe"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description" value={formData.description} onChange={handleChange} rows={3}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="A brief description of your bus company..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400" /> Contact Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (Read-only)</label>
              <input
                type="email" value={formData.contactEmail} disabled
                className="block w-full rounded-lg border-gray-200 bg-gray-50 text-gray-500 shadow-sm sm:text-sm px-3 py-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" /> Website
              </label>
              <input
                type="url" name="website" value={formData.website} onChange={handleChange} placeholder="https://example.com"
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Business</label>
              <input
                type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+265..."
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> Operating Hours
          </h3>
          <div className="space-y-3">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${operatingHours[day]?.closed ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="w-24 text-sm font-medium text-gray-700 capitalize">{day}</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!operatingHours[day]?.closed}
                    onChange={(e) => handleDayClosed(day, !e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-500">{operatingHours[day]?.closed ? 'Closed' : 'Open'}</span>
                </label>
                {!operatingHours[day]?.closed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time" value={operatingHours[day]?.open || '06:00'}
                      onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                      className="rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-2 py-1 border"
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input
                      type="time" value={operatingHours[day]?.close || '18:00'}
                      onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                      className="rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-2 py-1 border"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Branches Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" /> Branches of Operation
          </h3>
          {branches.length === 0 ? (
            <div className="py-4 text-center text-gray-500 text-sm">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-300" />
              No branches added. Go to the Operators &amp; Branches tab to add branches.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {branches.map((branch: any) => (
                <div key={branch.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">{branch.name}</span>
                  {branch.code && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold ml-auto">{branch.code}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
}