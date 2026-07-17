'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, MapPin, Building, Globe, Phone, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadLogo } from '@/utils/supabase/storage-utils';
import { useCompanyRegions } from './_hooks/useDashboardQueries';

interface ProfileTabProps {
  dashboard: any;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function ProfileTab({ dashboard }: ProfileTabProps) {
  const { dashboardData, updateDashboardData } = dashboard;
  const company = dashboardData.company;
  const { data: branches = [] } = useCompanyRegions(company?.id || '');

  const [formData, setFormData] = useState({
    name: company?.name || '',
    contactEmail: company?.email || '',
    contactPhone: company?.contact || company?.phone || '',
    address: company?.address || '',
    description: company?.description || '',
    whatsapp: company?.contactSettings?.whatsapp || '',
    website: company?.contactSettings?.website || '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo || null);

  const [operatingHours, setOperatingHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(() => {
    const defaults: Record<string, { open: string; close: string; closed: boolean }> = {};
    DAYS_OF_WEEK.forEach(day => {
      defaults[day] = company?.operatingHours?.[day] || { open: '06:00', close: '18:00', closed: false };
    });
    return defaults;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Sync form with company data changes
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        contactEmail: company.email || '',
        contactPhone: company.contact || company.phone || '',
        address: company.address || '',
        description: company.description || '',
        whatsapp: company.contactSettings?.whatsapp || '',
        website: company.contactSettings?.website || '',
      });
      setOperatingHours(() => {
        const defaults: Record<string, { open: string; close: string; closed: boolean }> = {};
        DAYS_OF_WEEK.forEach(day => {
          defaults[day] = company?.operatingHours?.[day] || { open: '06:00', close: '18:00', closed: false };
        });
        return defaults;
      });
      setLogoPreview(company.logo || null);
      setLogoFile(null);
    }
  }, [company]);

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
      dashboard.setIsBusy?.(true);

      const updatedData: Record<string, any> = {
        name: formData.name,
        phone: formData.contactPhone,
        address: formData.address,
        description: formData.description,
        operatingHours,
        contactSettings: {
          ...(company?.contactSettings || {}),
          whatsapp: formData.whatsapp,
          website: formData.website,
        }
      };

      if (logoFile && company?.id) {
        const logoUrl = await uploadLogo(logoFile, company.id);
        updatedData.logo = logoUrl;
      }

      const response = await fetch('/api/company/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company?.id, updates: updatedData })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to update');
      const updatedCompany = json.company ? json.company : { ...company, ...updatedData };
      updateDashboardData('company', updatedCompany);
      if (logoFile) {
        setLogoFile(null);
      }
      setIsEditing(false);
      dashboard.showAlert('success', 'Profile updated successfully');
    } catch (error: any) {
      const message = error?.message || 'Failed to update profile. Please try again.';
      dashboard.showAlert('error', message);
    } finally {
      dashboard.setIsBusy?.(false);
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

  const website = company?.contactSettings?.website || 'Not provided';
  const whatsapp = company?.contactSettings?.whatsapp || 'Not provided';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            Company Profile
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage the company's public details, operating hours, and contact information.
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Save className="w-4 h-4" />
            Edit Profile
          </button>
        )}
      </div>

      {isEditing ? (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Company logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-xs">No logo</span>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        if (file) {
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                </div>
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

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400" /> Core Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Company logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-xs">No logo</span>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500">Company Name</div>
                  <div className="text-sm font-medium text-gray-900">{company.name || 'Not provided'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Headquarters Address</div>
                <div className="text-sm font-medium text-gray-900">{company.address || 'Not provided'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-gray-500">Description</div>
                <div className="text-sm text-gray-700">{company.description || 'Not provided'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" /> Contact Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-500">Email</div>
                <div className="text-sm font-medium text-gray-900">{formData.contactEmail || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Phone Number</div>
                <div className="text-sm font-medium text-gray-900">{formData.contactPhone || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 flex items-center gap-1"><Globe className="w-3 h-3" /> Website</div>
                <div className="text-sm font-medium text-gray-900">{website}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">WhatsApp Business</div>
                <div className="text-sm font-medium text-gray-900">{whatsapp}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Operating Hours
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="flex items-center justify-between text-sm py-1">
                  <span className="capitalize text-gray-700">{day}</span>
                  <span className={operatingHours[day]?.closed ? 'text-gray-400' : 'text-gray-900 font-medium'}>
                    {operatingHours[day]?.closed ? 'Closed' : `${operatingHours[day]?.open} - ${operatingHours[day]?.close}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

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
        </div>
      )}
    </div>
  );
}