import React, { useState, useEffect } from 'react';
import { doc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import { Button } from '@/components/ui/button';
import {
  User, Mail, Building2, MapPin, Calendar, Shield, Save, Edit2, X
} from 'lucide-react';
import { UserProfile } from '@/types/core';

interface OperatorProfileTabProps {
  userProfile: UserProfile | null;
  companyName?: string;
  companyBranches?: string[];
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}

interface EditData {
  phoneNumber: string;
}

const OperatorProfileTab: React.FC<OperatorProfileTabProps> = ({
  userProfile,
  companyName,
  companyBranches = [],
  setError,
  setSuccess,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operatorRegion, setOperatorRegion] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState<EditData>({
    phoneNumber: userProfile?.phone || '',
  });

  // Fetch operator data by querying uid field
  useEffect(() => {
    if (!userProfile?.id) {
      console.log('No userProfile.id');
      setOperatorRegion('Not set');
      setLoading(false);
      return;
    }

    const fetchOperatorData = async () => {
      try {
        console.log('Searching for operator with uid:', userProfile.id);

        // Query operators collection by uid field
        const operatorsRef = collection(db, 'operators');
        const q = query(operatorsRef, where('uid', '==', userProfile.id));
        const snapshot = await getDocs(q);

        console.log('Query results:', snapshot.docs.length, 'documents found');

        if (snapshot.docs.length > 0) {
          const operatorData = snapshot.docs[0].data();
          console.log('Operator data found:', operatorData);

          const region = operatorData.region || 'Not set';
          console.log('Region:', region);

          setOperatorRegion(region);
        } else {
          console.log('No operator document found with uid:', userProfile.id);
          setOperatorRegion('Not set');
        }
      } catch (error: any) {
        console.error('Error fetching operator data:', error);
        setOperatorRegion('Error loading region');
      } finally {
        setLoading(false);
      }
    };

    fetchOperatorData();
  }, [userProfile?.id]);

  const handleSave = async () => {
    if (!userProfile?.id) {
      setError('User profile not found');
      return;
    }

    setSaving(true);
    try {
      const userDocRef = doc(db, 'users', userProfile.id);
      await updateDoc(userDocRef, {
        phone: editData.phoneNumber,
        updatedAt: new Date(),
      });

      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(`Failed to update profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      phoneNumber: userProfile?.phone || '',
    });
    setIsEditing(false);
  };

  const operatorName = `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 
                       userProfile?.name || 'Operator';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
          <p className="text-sm text-gray-500 mt-1">View and manage your operator profile</p>
        </div>
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Header Banner */}
        <div className="h-24 bg-gradient-to-r from-blue-500 to-blue-600"></div>
        
        <div className="px-6 pb-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-start gap-6 -mt-12 mb-6">
            <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <span className="text-3xl font-bold text-blue-600">
                  {operatorName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="flex-1 pt-14">
              <h3 className="text-2xl font-bold text-gray-900">{operatorName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Operator</span>
              </div>
            </div>
          </div>

          {/* Profile Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Mail className="w-4 h-4 text-gray-400" />
                Email Address
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg border">
                <p className="text-gray-900">{userProfile?.email || 'Not set'}</p>
              </div>
              <p className="text-xs text-gray-500">Email cannot be changed</p>
            </div>

            {/* Company */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Building2 className="w-4 h-4 text-gray-400" />
                Company
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg border">
                <p className="text-gray-900">{companyName || 'Not set'}</p>
              </div>
            </div>

            {/* Region - Read Only (from operators collection) */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400" />
                Operating Region
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg border">
                {loading ? (
                  <p className="text-gray-500 italic">Loading region...</p>
                ) : (
                  <p className="text-gray-900 font-medium">{operatorRegion}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Region is set by your administrator and cannot be changed
              </p>
            </div>

            {/* Phone Number - Editable */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <User className="w-4 h-4 text-gray-400" />
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editData.phoneNumber}
                  onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                  placeholder="+265 999 123 456"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 rounded-lg border">
                  <p className="text-gray-900">{userProfile?.phone || 'Not set'}</p>
                </div>
              )}
            </div>

            {/* Account Created */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                Member Since
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg border">
                <p className="text-gray-900">
                  {userProfile?.createdAt instanceof Date
                    ? userProfile.createdAt.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'Unknown'
                  }
                </p>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Shield className="w-4 h-4 text-gray-400" />
                Role
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Operator
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Region-Based Operations</p>
                <p>
                  As an operator in <span className="font-semibold">{operatorRegion}</span>, 
                  you can only create and manage schedules for routes that start from your assigned region. 
                  This ensures clear accountability and efficient operations management.
                </p>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Security Notice</p>
                <p>
                  Your region assignment cannot be changed from this page. Contact your company administrator 
                  if you believe this needs to be updated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Card */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Create Schedules', description: 'For routes in your region', allowed: true },
            { label: 'Manage Bookings', description: 'For your schedules only', allowed: true },
            { label: 'View Payments', description: 'For your schedules only', allowed: true },
            { label: 'Assign Buses', description: 'To your schedules', allowed: true },
            { label: 'Delete Routes', description: 'Company admin only', allowed: false },
            { label: 'Manage Team', description: 'Company admin only', allowed: false },
          ].map((permission, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
              <div className={`mt-0.5 ${permission.allowed ? 'text-green-600' : 'text-gray-400'}`}>
                {permission.allowed ? (
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{permission.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{permission.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OperatorProfileTab;