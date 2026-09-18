import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function CreateCompanyModal({ isOpen, onClose, onSuccess, onError }: CreateCompanyModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', adminFirstName: '', adminLastName: '',
    adminPhone: '', contact: '', address: '', description: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Company name is required';
    if (!formData.email.trim()) errors.email = 'Admin email is required';
    else if (!emailRegex.test(formData.email)) errors.email = 'Please enter a valid email address';
    if (formData.contact && !phoneRegex.test(formData.contact.replace(/\s+/g, ''))) errors.contact = 'Please enter a valid phone number';
    if (formData.adminPhone && !phoneRegex.test(formData.adminPhone.replace(/\s+/g, ''))) errors.adminPhone = 'Please enter a valid admin phone number';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateCompany = async () => {
    if (!validateForm()) {
      onError('Please fix the form errors.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/create-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.name.trim(),
          companyEmail: formData.email.trim().toLowerCase(),
          adminFirstName: formData.adminFirstName.trim(),
          adminLastName: formData.adminLastName.trim(),
          adminPhone: formData.adminPhone.trim(),
          companyContact: formData.contact.trim(),
          companyAddress: formData.address.trim(),
          companyDescription: formData.description.trim(),
          status: 'pending',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || 'Company created!');
        onClose();
        // Reset form
        setFormData({ name: '', email: '', adminFirstName: '', adminLastName: '', adminPhone: '', contact: '', address: '', description: '' });
      } else {
        throw new Error(data.error || 'Failed to create company');
      }
    } catch (e: unknown) {
      onError((e as Error).message.includes('Failed to fetch')
        ? 'Network error. Please check your connection.'
        : (e as Error).message || 'Failed to create company.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl" style={{ borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-6 pb-4">
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-jakarta)', color: '#005A5B' }}>Create company</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="border-t border-gray-100" />

        {/* Body */}
        <div className="px-6 py-5 space-y-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {/* Company Name — full width */}
          <div>
            <label htmlFor="add-name" className="block text-xs font-medium text-gray-500 mb-1">Company Name *</label>
            <input type="text" id="add-name" value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. AXA Coach Services"
              className={`block w-full border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition ${formErrors.name ? 'border-red-400' : 'border-gray-200'}`}
              style={{ borderRadius: '10px' }} />
            {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
          </div>

          {/* Admin Email — full width */}
          <div>
            <label htmlFor="add-email" className="block text-xs font-medium text-gray-500 mb-1">Admin Email *</label>
            <input type="email" id="add-email" value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              placeholder="admin@company.com"
              className={`block w-full border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition ${formErrors.email ? 'border-red-400' : 'border-gray-200'}`}
              style={{ borderRadius: '10px' }} />
            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
          </div>

          {/* First Name + Last Name — paired row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-firstName" className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
              <input type="text" id="add-firstName" value={formData.adminFirstName}
                onChange={e => setFormData(p => ({ ...p, adminFirstName: e.target.value }))}
                placeholder="John"
                className="block w-full border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition"
                style={{ borderRadius: '10px' }} />
            </div>
            <div>
              <label htmlFor="add-lastName" className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
              <input type="text" id="add-lastName" value={formData.adminLastName}
                onChange={e => setFormData(p => ({ ...p, adminLastName: e.target.value }))}
                placeholder="Banda"
                className="block w-full border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition"
                style={{ borderRadius: '10px' }} />
            </div>
          </div>

          {/* Admin Phone + Contact Phone — paired row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-adminPhone" className="block text-xs font-medium text-gray-500 mb-1">Admin Phone</label>
              <input type="tel" id="add-adminPhone" value={formData.adminPhone}
                onChange={e => setFormData(p => ({ ...p, adminPhone: e.target.value }))}
                placeholder="+265 999 123 456"
                className={`block w-full border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition ${formErrors.adminPhone ? 'border-red-400' : 'border-gray-200'}`}
                style={{ borderRadius: '10px' }} />
              {formErrors.adminPhone && <p className="text-red-500 text-xs mt-1">{formErrors.adminPhone}</p>}
            </div>
            <div>
              <label htmlFor="add-contact" className="block text-xs font-medium text-gray-500 mb-1">Company Phone</label>
              <input type="tel" id="add-contact" value={formData.contact}
                onChange={e => setFormData(p => ({ ...p, contact: e.target.value }))}
                placeholder="+265 888 654 321"
                className={`block w-full border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition ${formErrors.contact ? 'border-red-400' : 'border-gray-200'}`}
                style={{ borderRadius: '10px' }} />
              {formErrors.contact && <p className="text-red-500 text-xs mt-1">{formErrors.contact}</p>}
            </div>
          </div>

          {/* Address — full width */}
          <div>
            <label htmlFor="add-address" className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input type="text" id="add-address" value={formData.address}
              onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
              placeholder="e.g. Area 47, Lilongwe"
              className="block w-full border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition"
              style={{ borderRadius: '10px' }} />
          </div>

          {/* Description — full width */}
          <div>
            <label htmlFor="add-description" className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea id="add-description" value={formData.description} rows={2}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Brief description of the company (optional)"
              className="block w-full border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005A5B]/20 focus:border-[#005A5B] transition resize-none"
              style={{ borderRadius: '10px' }} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100" />
        <div className="px-6 py-4 flex justify-end gap-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ borderRadius: '10px' }}>
            Cancel
          </button>
          <button onClick={handleCreateCompany} disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            style={{ borderRadius: '10px', backgroundColor: loading ? '#f0a89e' : '#E8604C' }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#d4503e'; }}
            onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#E8604C'; }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create company
          </button>
        </div>
      </div>
    </div>
  );
}
