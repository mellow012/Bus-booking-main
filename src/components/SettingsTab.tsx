"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { 
  CreditCard, 
  Bell, 
  Mail, 
  Crown, 
  Save,
  Settings as SettingsIcon,
  Shield,
  DollarSign,
  Edit2,
  Eye,
  X,
  Check
} from "lucide-react";

interface Company {
  id: string;
  paymentSettings?: {
    gateways?: { paychangu?: boolean; stripe?: boolean };
    paychanguToken?: string;
    paychanguAccount?: string;
    paychanguReceiveNumber?: string;
    stripePublishableKey?: string;
    stripeSecretKey?: string;
    stripePayoutAccount?: string;
    supportedMethods?: string[];
    currency?: string;
  };
  notificationSettings?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    bookingAlerts?: boolean;
    paymentAlerts?: boolean;
    systemAlerts?: boolean;
  };
  contactSettings?: {
    supportEmail?: string;
    supportPhone?: string;
    whatsappNumber?: string;
    officeAddress?: string;
  };
  premiumFeatures?: {
    isActive?: boolean;
    expiryDate?: Date;
    features?: string[];
  };
}

interface SettingsTabProps {
  company: Company;
  setCompany: (company: Company) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

type SettingsSection = 'payment' | 'notifications' | 'contact' | 'premium';

const SettingsTab: React.FC<SettingsTabProps> = ({ company, setCompany, setError, setSuccess }) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('payment');
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const sections = [
    { id: 'payment' as const, label: 'Payment Settings', icon: CreditCard },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'contact' as const, label: 'Contact Info', icon: Mail },
    { id: 'premium' as const, label: 'Premium Features', icon: Crown },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'payment':
        return <PaymentSettings company={company} setCompany={setCompany} setError={setError} setSuccess={setSuccess} loading={loading} setLoading={setLoading} editMode={editMode} setEditMode={setEditMode} />;
      case 'notifications':
        return <NotificationSettings company={company} setCompany={setCompany} setError={setError} setSuccess={setSuccess} loading={loading} setLoading={setLoading} editMode={editMode} setEditMode={setEditMode} />;
      case 'contact':
        return <ContactSettings company={company} setCompany={setCompany} setError={setError} setSuccess={setSuccess} loading={loading} setLoading={setLoading} editMode={editMode} setEditMode={setEditMode} />;
      case 'premium':
        return <PremiumFeatures company={company} setCompany={setCompany} setError={setError} setSuccess={setSuccess} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500">Manage your company settings and preferences</p>
          </div>
        </div>
        
        {/* Edit/View Mode Toggle - Only for non-premium sections */}
        {activeSection !== 'premium' && (
          <Button
            onClick={() => setEditMode(!editMode)}
            variant={editMode ? "outline" : "default"}
            className={editMode ? "border-blue-600 text-blue-600" : ""}
          >
            {editMode ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                View Mode
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Mode
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setEditMode(false);
                }}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {renderSection()}
      </div>
    </div>
  );
};

// Payment Settings Component
const PaymentSettings: React.FC<{
  company: Company;
  setCompany: (company: Company) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
}> = ({ company, setCompany, setError, setSuccess, loading, setLoading, editMode, setEditMode }) => {
  const { control, register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      gateways: company?.paymentSettings?.gateways || { paychangu: false, stripe: false },
      paychanguToken: company?.paymentSettings?.paychanguToken || "",
      paychanguAccount: company?.paymentSettings?.paychanguAccount || "",
      paychanguReceiveNumber: company?.paymentSettings?.paychanguReceiveNumber || "",
      stripePublishableKey: company?.paymentSettings?.stripePublishableKey || "",
      stripeSecretKey: company?.paymentSettings?.stripeSecretKey || "",
      stripePayoutAccount: company?.paymentSettings?.stripePayoutAccount || "",
      supportedMethods: company?.paymentSettings?.supportedMethods || [],
      currency: company?.paymentSettings?.currency || "MWK",
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (data.gateways.paychangu && (!data.paychanguAccount || !data.paychanguReceiveNumber || !data.paychanguToken)) {
        throw new Error("All PayChangu fields are required");
      }
      if (data.gateways.stripe && (!data.stripePublishableKey || !data.stripeSecretKey || !data.stripePayoutAccount)) {
        throw new Error("All Stripe fields are required");
      }

      const updatedPaymentSettings = {
        gateways: data.gateways,
        paychanguToken: data.gateways.paychangu ? data.paychanguToken : undefined,
        paychanguAccount: data.gateways.paychangu ? data.paychanguAccount : undefined,
        paychanguReceiveNumber: data.gateways.paychangu ? data.paychanguReceiveNumber : undefined,
        stripePublishableKey: data.gateways.stripe ? data.stripePublishableKey : undefined,
        stripeSecretKey: data.gateways.stripe ? data.stripeSecretKey : undefined,
        stripePayoutAccount: data.gateways.stripe ? data.stripePayoutAccount : undefined,
        supportedMethods: data.supportedMethods,
        currency: data.currency,
      };

      await updateDoc(doc(db, "companies", company.id), {
        paymentSettings: updatedPaymentSettings,
      });
      setCompany({ ...company, paymentSettings: updatedPaymentSettings });
      setSuccess("Payment settings updated successfully");
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to update payment settings");
    } finally {
      setLoading(false);
    }
  };

  // View Mode
  if (!editMode) {
    const hasPayChangu = company?.paymentSettings?.gateways?.paychangu;
    const hasStripe = company?.paymentSettings?.gateways?.stripe;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment Gateways</h3>
            <p className="text-sm text-gray-500">View your payment gateway configuration</p>
          </div>
          <DollarSign className="w-6 h-6 text-gray-400" />
        </div>

        {!hasPayChangu && !hasStripe ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No payment gateways configured</p>
            <p className="text-sm text-gray-500 mt-1">Click "Edit Mode" to set up payment methods</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {hasPayChangu && (
              <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-blue-900 text-lg">PayChangu</h4>
                    <p className="text-sm text-blue-700">Mobile Money Gateway</p>
                  </div>
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700 font-medium">Account Number</p>
                    <p className="text-blue-900">{company.paymentSettings?.paychanguAccount || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Receiving Number</p>
                    <p className="text-blue-900">{company.paymentSettings?.paychanguReceiveNumber || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">API Token</p>
                    <p className="text-blue-900">{'•'.repeat(20)} {company.paymentSettings?.paychanguToken ? '(Configured)' : '(Not set)'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Status</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            {hasStripe && (
              <div className="border border-purple-200 rounded-lg p-6 bg-purple-50">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-purple-900 text-lg">Stripe</h4>
                    <p className="text-sm text-purple-700">Credit/Debit Card Gateway</p>
                  </div>
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-purple-700 font-medium">Publishable Key</p>
                    <p className="text-purple-900">pk_{'•'.repeat(15)} {company.paymentSettings?.stripePublishableKey ? '(Set)' : '(Not set)'}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Secret Key</p>
                    <p className="text-purple-900">sk_{'•'.repeat(15)} {company.paymentSettings?.stripeSecretKey ? '(Set)' : '(Not set)'}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Payout Account</p>
                    <p className="text-purple-900">{company.paymentSettings?.stripePayoutAccount || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Status</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 font-medium">Default Currency</p>
                  <p className="text-gray-900">{company.paymentSettings?.currency || 'MWK'}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Supported Methods</p>
                  <p className="text-gray-900">{company.paymentSettings?.supportedMethods?.join(', ') || 'None'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Gateways</h3>
          <p className="text-sm text-gray-500">Configure how you accept payments from customers</p>
        </div>
        <DollarSign className="w-6 h-6 text-gray-400" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Gateway Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Enabled Payment Gateways</Label>
          <div className="grid gap-4">
            <Controller
              name="gateways.paychangu"
              control={control}
              render={({ field }) => (
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id="paychangu"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="paychangu" className="font-medium cursor-pointer">PayChangu</Label>
                    <p className="text-sm text-gray-500">Accept Airtel Money and TNM Mpamba</p>
                  </div>
                </div>
              )}
            />
            <Controller
              name="gateways.stripe"
              control={control}
              render={({ field }) => (
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id="stripe"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="stripe" className="font-medium cursor-pointer">Stripe</Label>
                    <p className="text-sm text-gray-500">Accept credit/debit cards internationally</p>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        {/* PayChangu Settings */}
        {watch("gateways.paychangu") && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              PayChangu Configuration
            </h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="paychanguToken">API Token (Test Public Key)</Label>
                <Input
                  id="paychanguToken"
                  {...register("paychanguToken")}
                  type="password"
                  placeholder="sec-test-xxxxxxxxxxxxxxxxxxxx"
                  className="mt-1"
                />
                {errors.paychanguToken && <p className="text-red-600 text-sm mt-1">{errors.paychanguToken.message}</p>}
              </div>
              <div>
                <Label htmlFor="paychanguAccount">Account Number</Label>
                <Input
                  id="paychanguAccount"
                  {...register("paychanguAccount")}
                  placeholder="+265xxxxxxxxx"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="paychanguReceiveNumber">Receiving Number</Label>
                <Input
                  id="paychanguReceiveNumber"
                  {...register("paychanguReceiveNumber")}
                  placeholder="+265xxxxxxxxx"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Stripe Settings */}
        {watch("gateways.stripe") && (
          <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-medium text-purple-900 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Stripe Configuration
            </h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="stripePublishableKey">Publishable Key</Label>
                <Input
                  id="stripePublishableKey"
                  {...register("stripePublishableKey")}
                  type="password"
                  placeholder="pk_test_xxxxxxxxxxxxxxxxxxxx"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="stripeSecretKey">Secret Key</Label>
                <Input
                  id="stripeSecretKey"
                  {...register("stripeSecretKey")}
                  type="password"
                  placeholder="sk_test_xxxxxxxxxxxxxxxxxxxx"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="stripePayoutAccount">Payout Account ID</Label>
                <Input
                  id="stripePayoutAccount"
                  {...register("stripePayoutAccount")}
                  placeholder="acct_xxxxxxxxxxxxxxxxxxxx"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Currency */}
        <div>
          <Label htmlFor="currency">Default Currency</Label>
          <Input 
            id="currency" 
            {...register("currency")} 
            placeholder="MWK"
            className="mt-1"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              reset();
              setEditMode(false);
            }}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Notification Settings Component
const NotificationSettings: React.FC<{
  company: Company;
  setCompany: (company: Company) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
}> = ({ company, setCompany, setError, setSuccess, loading, setLoading, editMode, setEditMode }) => {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      emailNotifications: company?.notificationSettings?.emailNotifications ?? true,
      smsNotifications: company?.notificationSettings?.smsNotifications ?? false,
      bookingAlerts: company?.notificationSettings?.bookingAlerts ?? true,
      paymentAlerts: company?.notificationSettings?.paymentAlerts ?? true,
      systemAlerts: company?.notificationSettings?.systemAlerts ?? true,
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await updateDoc(doc(db, "companies", company.id), {
        notificationSettings: data,
      });
      setCompany({ ...company, notificationSettings: data });
      setSuccess("Notification settings updated successfully");
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to update notification settings");
    } finally {
      setLoading(false);
    }
  };

  // View Mode
  if (!editMode) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
          <p className="text-sm text-gray-500">Your current notification settings</p>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Notification Channels</h4>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive updates via email</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  company?.notificationSettings?.emailNotifications 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {company?.notificationSettings?.emailNotifications ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">SMS Notifications</p>
                  <p className="text-sm text-gray-500">Receive urgent alerts via SMS</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  company?.notificationSettings?.smsNotifications 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {company?.notificationSettings?.smsNotifications ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Alert Types</h4>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Booking Alerts</p>
                  <p className="text-sm text-gray-500">New bookings and cancellations</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  company?.notificationSettings?.bookingAlerts 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {company?.notificationSettings?.bookingAlerts ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Payment Alerts</p>
                  <p className="text-sm text-gray-500">Payments received</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  company?.notificationSettings?.paymentAlerts 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {company?.notificationSettings?.paymentAlerts ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">System Alerts</p>
                  <p className="text-sm text-gray-500">System updates and announcements</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  company?.notificationSettings?.systemAlerts 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {company?.notificationSettings?.systemAlerts ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
        <p className="text-sm text-gray-500">Choose how you want to be notified about important events</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Notification Channels</h4>
          <div className="space-y-3">
            <Controller
              name="emailNotifications"
              control={control}
              render={({ field }) => (
                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id="emailNotifications"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="emailNotifications" className="font-medium cursor-pointer">Email Notifications</Label>
                    <p className="text-sm text-gray-500">Receive updates via email</p>
                  </div>
                </div>
              )}
            />
            <Controller
              name="smsNotifications"
              control={control}
              render={({ field }) => (
                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id="smsNotifications"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="smsNotifications" className="font-medium cursor-pointer">SMS Notifications</Label>
                    <p className="text-sm text-gray-500">Receive urgent alerts via SMS</p>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Alert Types</h4>
          <div className="space-y-3">
            <Controller
              name="bookingAlerts"
              control={control}
              render={({ field }) => (
                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id="bookingAlerts"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="bookingAlerts" className="font-medium cursor-pointer">Booking Alerts</Label>
                    <p className="text-sm text-gray-500">New bookings and cancellations</p>
                  </div>
                </div>
              )}
            />
            <Controller
              name="paymentAlerts"
              control={control}
              render={({ field }) => (
                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id="paymentAlerts"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="paymentAlerts" className="font-medium cursor-pointer">Payment Alerts</Label>
                    <p className="text-sm text-gray-500">Payments received and processed</p>
                  </div>
                </div>
              )}
            />
            <Controller
              name="systemAlerts"
              control={control}
              render={({ field }) => (
                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id="systemAlerts"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="systemAlerts" className="font-medium cursor-pointer">System Alerts</Label>
                    <p className="text-sm text-gray-500">System updates and announcements</p>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setEditMode(false)}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Contact Settings Component
const ContactSettings: React.FC<{
  company: Company;
  setCompany: (company: Company) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
}> = ({ company, setCompany, setError, setSuccess, loading, setLoading, editMode, setEditMode }) => {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      supportEmail: company?.contactSettings?.supportEmail || "",
      supportPhone: company?.contactSettings?.supportPhone || "",
      whatsappNumber: company?.contactSettings?.whatsappNumber || "",
      officeAddress: company?.contactSettings?.officeAddress || "",
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await updateDoc(doc(db, "companies", company.id), {
        contactSettings: data,
      });
      setCompany({ ...company, contactSettings: data });
      setSuccess("Contact settings updated successfully");
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to update contact settings");
    } finally {
      setLoading(false);
    }
  };

  // View Mode
  if (!editMode) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
          <p className="text-sm text-gray-500">Your business contact details</p>
        </div>

        <div className="grid gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium text-gray-600 mb-1">Support Email</p>
            <p className="text-gray-900">{company?.contactSettings?.supportEmail || 'Not set'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium text-gray-600 mb-1">Support Phone</p>
            <p className="text-gray-900">{company?.contactSettings?.supportPhone || 'Not set'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium text-gray-600 mb-1">WhatsApp Number</p>
            <p className="text-gray-900">{company?.contactSettings?.whatsappNumber || 'Not set'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium text-gray-600 mb-1">Office Address</p>
            <p className="text-gray-900">{company?.contactSettings?.officeAddress || 'Not set'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
        <p className="text-sm text-gray-500">Update your business contact details</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="supportEmail">Support Email</Label>
          <Input
            id="supportEmail"
            {...register("supportEmail")}
            type="email"
            placeholder="support@company.com"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="supportPhone">Support Phone</Label>
          <Input
            id="supportPhone"
            {...register("supportPhone")}
            type="tel"
            placeholder="+265 XXX XXX XXX"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
          <Input
            id="whatsappNumber"
            {...register("whatsappNumber")}
            type="tel"
            placeholder="+265 XXX XXX XXX"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="officeAddress">Office Address</Label>
          <Input
            id="officeAddress"
            {...register("officeAddress")}
            placeholder="123 Main Street, Lilongwe"
            className="mt-1"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              reset();
              setEditMode(false);
            }}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Premium Features Component
const PremiumFeatures: React.FC<{
  company: Company;
  setCompany: (company: Company) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}> = ({ company }) => {
  const isPremium = company?.premiumFeatures?.isActive;
  const features = company?.premiumFeatures?.features || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Premium Features</h3>
          <p className="text-sm text-gray-500">Unlock advanced capabilities for your business</p>
        </div>
        <Crown className="w-6 h-6 text-yellow-500" />
      </div>

      {isPremium ? (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-200">
            <div className="flex items-center gap-3 mb-4">
              <Crown className="w-8 h-8 text-yellow-600" />
              <div>
                <h4 className="text-xl font-bold text-gray-900">Premium Active</h4>
                <p className="text-sm text-gray-600">
                  Expires: {company?.premiumFeatures?.expiryDate 
                    ? new Date(company.premiumFeatures.expiryDate).toLocaleDateString() 
                    : 'Never'}
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <h5 className="font-medium text-gray-900 mb-2">Active Features:</h5>
              <div className="grid gap-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Premium Not Active</h4>
          <p className="text-gray-600 mb-6">Upgrade to premium to unlock advanced features</p>
          <Button className="bg-yellow-600 hover:bg-yellow-700">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Premium
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mt-8">
        <div className="p-4 border rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">Analytics Dashboard</h5>
          <p className="text-sm text-gray-600">Advanced reporting and insights</p>
        </div>
        <div className="p-4 border rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">Priority Support</h5>
          <p className="text-sm text-gray-600">24/7 dedicated customer service</p>
        </div>
        <div className="p-4 border rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">Custom Branding</h5>
          <p className="text-sm text-gray-600">White-label your booking pages</p>
        </div>
        <div className="p-4 border rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">API Access</h5>
          <p className="text-sm text-gray-600">Integrate with your systems</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab