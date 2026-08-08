'use client';

import React, { useState, useMemo } from 'react';
import { 
  Bus as BusIcon, Plus, Search, Edit2, Trash2, 
  Settings, CheckCircle, AlertTriangle, AlertCircle, Wrench, Shield, Fuel, Star, Loader2
} from 'lucide-react';
import { Bus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';
import { createBus, updateBus, deleteBus } from '@/lib/actions/fleet.actions';
import { uploadBusImage } from '@/utils/supabase/storage-utils';
import { BUS_TYPES, BUS_STATUSES } from './_lib/constants';
import TabButton from '@/components/tabButton';
import ToggleChip from '@/components/ToggleChip';

const AVAILABLE_AMENITIES = ['AC', 'WiFi', 'USB Charging', 'Reclining Seats', 'TV', 'Restroom'];

interface BusesTabProps {
  dashboard: any;
}

export default function BusesTab({ dashboard }: BusesTabProps) {
  const { companyId } = dashboard;
  const rawBuses = dashboard.dashboardData?.buses || [];
  
  // Local state for search & filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'amenities'>('details');
  
  // Form State
  const [formValues, setFormValues] = useState<{
    licensePlate: string;
    busType: string;
    capacity: number;
    status: string;
    fuelType: string;
    lastMaintenanceDate: string;
    nextMaintenanceDate: string;
    images: string[];
    amenities: string[];
  }>({
    licensePlate: '',
    busType: 'Luxury',
    capacity: 40,
    status: 'active',
    fuelType: 'Diesel',
    lastMaintenanceDate: '',
    nextMaintenanceDate: '',
    images: [],
    amenities: [],
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filtered buses
  const filteredBuses = useMemo(() => {
    return rawBuses.filter((bus: any) => {
      const matchesSearch = bus.licensePlate?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === 'all' || bus.busType === selectedType;
      const matchesStatus = selectedStatus === 'all' || bus.status === selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [rawBuses, searchQuery, selectedType, selectedStatus]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = rawBuses.length;
    const active = rawBuses.filter((b: any) => b.status === 'active').length;
    const maintenance = rawBuses.filter((b: any) => b.status === 'maintenance').length;
    const inactive = rawBuses.filter((b: any) => b.status === 'inactive').length;
    return { total, active, maintenance, inactive };
  }, [rawBuses]);

  const openAddModal = () => {
    setEditingBus(null);
    setFormValues({
      licensePlate: '',
      busType: 'Luxury',
      capacity: 40,
      status: 'active',
      fuelType: 'Diesel',
      lastMaintenanceDate: '',
      nextMaintenanceDate: '',
      images: [],
      amenities: [],
    });
    setSelectedFiles([]);
    setImagePreviews([]);
    setFormError('');
    setActiveTab('details');
    setIsModalOpen(true);
  };

  const openEditModal = (bus: Bus) => {
    setEditingBus(bus);
    setFormValues({
      licensePlate: bus.licensePlate,
      busType: bus.busType,
      capacity: bus.capacity,
      status: bus.status,
      fuelType: bus.fuelType || 'Diesel',
      lastMaintenanceDate: bus.lastMaintenanceDate ? new Date(bus.lastMaintenanceDate).toISOString().split('T')[0] : '',
      nextMaintenanceDate: bus.nextMaintenanceDate ? new Date(bus.nextMaintenanceDate).toISOString().split('T')[0] : '',
      images: bus.images || [],
      amenities: Array.isArray(bus.amenities) ? (bus.amenities as string[]) : [],
    });
    setSelectedFiles([]);
    setImagePreviews(bus.images || []);
    setFormError('');
    setActiveTab('details');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.licensePlate.trim()) {
      setFormError('License plate is required');
      return;
    }
    if (formValues.capacity < 10 || formValues.capacity > 100) {
      setFormError('Capacity must be between 10 and 100 seats');
      return;
    }

    setSubmitting(true);
    setFormError('');
    
    try {
      let uploadedUrls: string[] = [...(formValues.images || [])];
      
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const url = await uploadBusImage(file, companyId);
          uploadedUrls.push(url);
        }
      }

      if (editingBus) {
        // Update Bus
        const res = await updateBus(editingBus.id, {
          ...formValues,
          images: uploadedUrls,
          companyId,
        } as any);
        if (res.success) {
          dashboard.showAlert('success', 'Bus updated successfully');
          setIsModalOpen(false);
          dashboard.refreshData?.();
        } else {
          setFormError(res.error || 'Failed to update bus');
        }
      } else {
        // Create Bus
        const res = await createBus({
          ...formValues,
          images: uploadedUrls,
          companyId,
        } as any);
        if (res.success) {
          dashboard.showAlert('success', 'Bus added successfully');
          setIsModalOpen(false);
          dashboard.refreshData?.();
        } else {
          setFormError(res.error || 'Failed to add bus');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
      
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    // If it's an existing image (URL string)
    if (index < formValues.images.length) {
      const updatedImages = [...formValues.images];
      updatedImages.splice(index, 1);
      setFormValues({ ...formValues, images: updatedImages });
    } else {
      // It's a newly added file
      const fileIndex = index - formValues.images.length;
      const updatedFiles = [...selectedFiles];
      updatedFiles.splice(fileIndex, 1);
      setSelectedFiles(updatedFiles);
    }
    
    const updatedPreviews = [...imagePreviews];
    updatedPreviews.splice(index, 1);
    setImagePreviews(updatedPreviews);
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      const res = await deleteBus(id);
      if (res.success) {
        dashboard.showAlert('success', 'Bus deleted successfully');
        setIsDeletingId(null);
        dashboard.refreshData?.();
      } else {
        dashboard.showAlert('error', res.error || 'Failed to delete bus');
      }
    } catch (err: any) {
      dashboard.showAlert('error', err.message || 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <BusIcon className="w-7 h-7 text-indigo-600" />
            Fleet Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage company vehicles, seating capacities, and maintenance schedules.</p>
        </div>
        <Button onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Vehicle
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
            <BusIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Fleet</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Active Buses</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{stats.active}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Maintenance</p>
            <p className="text-2xl font-extrabold text-amber-600 mt-0.5">{stats.maintenance}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Inactive</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-0.5">{stats.inactive}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search by license plate..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl text-sm border-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Type selector */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-10 text-xs px-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Bus Types</option>
            {BUS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Status selector */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 text-xs px-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Buses Grid */}
      {filteredBuses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <BusIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Vehicles Found</h3>
          <p className="text-sm text-gray-500">Try adjusting your filters or search query, or add a new bus to your fleet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBuses.map((bus: any) => {
            return (
              <div key={bus.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                        {bus.busType}
                      </span>
                      <h4 className="text-lg font-black text-gray-900 mt-2.5 uppercase tracking-wide">
                        {bus.licensePlate}
                      </h4>
                    </div>

                    {/* Status Pill */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
                      ${bus.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        bus.status === 'maintenance' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-rose-50 text-rose-700 border border-rose-100'}`}
                    >
                      {bus.status}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 mt-6 pt-6 border-t border-gray-50 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Capacity</p>
                        <p className="font-bold text-gray-900">{bus.capacity} Passengers</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Fuel className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Fuel Type</p>
                        <p className="font-bold text-gray-900">{bus.fuelType || 'Diesel'}</p>
                      </div>
                    </div>

                    {(() => {
                      const allBookings = dashboard.dashboardData?.bookings || [];
                      const busReviews = allBookings.filter((b: any) => (b.schedule?.busId === bus.id || b.bus?.id === bus.id) && b.reviewRating != null && b.reviewRating > 0);
                      const totalRating = busReviews.reduce((acc: number, b: any) => acc + Number(b.reviewRating), 0);
                      const count = busReviews.length;
                      const avg = count > 0 ? (totalRating / count).toFixed(1) : null;
                      return (
                        <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-semibold">Vehicle Rating</p>
                            <p className="font-bold text-gray-900">{avg ? `${avg} ★ (${count} review${count > 1 ? 's' : ''})` : 'No reviews'}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {bus.lastMaintenanceDate && (
                      <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
                        <Wrench className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-semibold">Last Maintenance</p>
                          <p className="font-bold text-gray-900">{new Date(bus.lastMaintenanceDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2.5">
                  <Button
                    onClick={() => openEditModal(bus)}
                    variant="outline"
                    className="h-8.5 text-xs px-3 border-gray-200 hover:bg-gray-100 hover:text-gray-900 rounded-xl"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    onClick={() => setIsDeletingId(bus.id)}
                    variant="outline"
                    className="h-8.5 text-xs px-3 text-rose-600 border-rose-100 hover:bg-rose-50 hover:border-rose-200 rounded-xl"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Bus Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BusIcon className="w-5 h-5 text-indigo-600" />
                {editingBus ? 'Edit Vehicle Info' : 'Add Vehicle to Fleet'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg absolute right-4 top-4">×</button>
              <div className="mt-4 flex gap-2">
                <TabButton isActive={activeTab === 'details'} onClick={() => setActiveTab('details')}>Details</TabButton>
                <TabButton isActive={activeTab === 'amenities'} onClick={() => setActiveTab('amenities')}>Amenities & Photos</TabButton>
              </div>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="licensePlate">License Plate *</Label>
                    <Input 
                      id="licensePlate"
                      value={formValues.licensePlate}
                      onChange={(e) => setFormValues({ ...formValues, licensePlate: e.target.value })}
                      placeholder="e.g. MN 1234, TO 8901"
                      className="h-10 mt-1 uppercase"
                    />
                  </div>

                  <div>
                    <Label htmlFor="busType">Bus Category</Label>
                    <select
                      id="busType"
                      value={formValues.busType}
                      onChange={(e) => setFormValues({ ...formValues, busType: e.target.value })}
                      className="w-full h-10 mt-1 px-3 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {BUS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="capacity">Capacity *</Label>
                    <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all mt-1">
                      <input
                        id="capacity"
                        type="number"
                        value={formValues.capacity}
                        onChange={(e) => setFormValues({ ...formValues, capacity: parseInt(e.target.value) || 0 })}
                        min="10"
                        max="100"
                        className="block w-full bg-transparent px-3 py-2 pr-16 text-sm text-gray-900 focus:outline-none h-10 rounded-xl"
                        required
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">seats</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="status">Fleet Status</Label>
                    <select
                      id="status"
                      value={formValues.status}
                      onChange={(e) => setFormValues({ ...formValues, status: e.target.value })}
                      className="w-full h-10 mt-1 px-3 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="active">Active (On road)</option>
                      <option value="inactive">Inactive (Stored)</option>
                      <option value="maintenance">Maintenance (Garage)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="fuelType">Fuel Type</Label>
                    <select
                      id="fuelType"
                      value={formValues.fuelType}
                      onChange={(e) => setFormValues({ ...formValues, fuelType: e.target.value })}
                      className="w-full h-10 mt-1 px-3 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Diesel">Diesel</option>
                      <option value="Petrol">Petrol</option>
                      <option value="Electric">Electric</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="lastMaintenanceDate">Last Maintenance</Label>
                    <Input 
                      id="lastMaintenanceDate"
                      type="date"
                      value={formValues.lastMaintenanceDate}
                      onChange={(e) => setFormValues({ ...formValues, lastMaintenanceDate: e.target.value })}
                      className="h-10 mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="nextMaintenanceDate">Next Maintenance</Label>
                    <Input 
                      id="nextMaintenanceDate"
                      type="date"
                      value={formValues.nextMaintenanceDate}
                      onChange={(e) => setFormValues({ ...formValues, nextMaintenanceDate: e.target.value })}
                      className="h-10 mt-1"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'amenities' && (
                <div className="space-y-4">
                  <div>
                    <Label>Amenities</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {AVAILABLE_AMENITIES.map((amenity) => {
                        const isSelected = formValues.amenities.includes(amenity);
                        return (
                          <ToggleChip
                            key={amenity}
                            label={amenity}
                            isActive={isSelected}
                            onClick={() => {
                              const next = isSelected
                                ? formValues.amenities.filter(a => a !== amenity)
                                : [...formValues.amenities, amenity];
                              setFormValues({ ...formValues, amenities: next });
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label>Bus Images</Label>
                    <div className="mt-1 flex items-center gap-4 flex-wrap p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      {imagePreviews.map((preview, i) => (
                        <div key={i} className="relative w-24 h-24 rounded-lg border border-gray-200 bg-white overflow-hidden shrink-0 group shadow-sm">
                          <img src={preview} alt="Bus" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              type="button" 
                              onClick={() => removeImage(i)} 
                              className="bg-white text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full p-1.5 shadow"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer transition-colors shrink-0 shadow-sm">
                        <Plus className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-semibold tracking-wide uppercase">Add Photo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          className="sr-only" 
                          onChange={handleImageChange} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-50 mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl h-10"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 min-w-[100px]"
                >
                  {submitting ? (
                     <>
                       <Loader2 className="h-4 w-4 animate-spin" />
                       Saving...
                     </>
                  ) : (
                    'Save Vehicle'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeletingId && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Vehicle</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to remove this vehicle from your fleet? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDeletingId(null)}
                disabled={submitting}
                className="rounded-xl h-10 px-5"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(isDeletingId)}
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-10 px-5"
              >
                {submitting ? (
                   <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                     Deleting...
                   </>
                 ) : (
                   'Delete Vehicle'
                 )}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
