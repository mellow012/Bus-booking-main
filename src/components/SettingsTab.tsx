"use client";

import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { HelpCircle } from "lucide-react";

interface Company {
  id: string;
  paymentSettings?: {
    gateways?: { paychangu?: boolean; stripe?: boolean };
    paychanguToken?: string;
    paychanguAccount?: string;
    paychanguReceiveNumber?: string; // New field for receiving number
    stripePublishableKey?: string;
    stripeSecretKey?: string;
    stripePayoutAccount?: string;
    supportedMethods?: string[];
    currency?: string;
  };
}

interface SettingsTabProps {
  company: Company;
  setCompany: (company: Company) => void;
  // FIX: Updated to match the expected signature from the calling context (string only)
  setError: (error: string) => void; 
  setSuccess: (success: string) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ company, setCompany, setError, setSuccess }) => {
  const [loading, setLoading] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      gateways: company?.paymentSettings?.gateways || { paychangu: false, stripe: false },
      paychanguToken: company?.paymentSettings?.paychanguToken || "",
      paychanguAccount: company?.paymentSettings?.paychanguAccount || "",
      paychanguReceiveNumber: company?.paymentSettings?.paychanguReceiveNumber || "", // Default to empty
      stripePublishableKey: company?.paymentSettings?.stripePublishableKey || "",
      stripeSecretKey: company?.paymentSettings?.stripeSecretKey || "",
      stripePayoutAccount: company?.paymentSettings?.stripePayoutAccount || "",
      supportedMethods: company?.paymentSettings?.supportedMethods || [],
      currency: company?.paymentSettings?.currency || "MWK",
    },
  });

  useEffect(() => {
    reset({
      gateways: company?.paymentSettings?.gateways || { paychangu: false, stripe: false },
      paychanguToken: company?.paymentSettings?.paychanguToken || "",
      paychanguAccount: company?.paymentSettings?.paychanguAccount || "",
      paychanguReceiveNumber: company?.paymentSettings?.paychanguReceiveNumber || "",
      stripePublishableKey: company?.paymentSettings?.stripePublishableKey || "",
      stripeSecretKey: company?.paymentSettings?.stripeSecretKey || "",
      stripePayoutAccount: company?.paymentSettings?.stripePayoutAccount || "",
      supportedMethods: company?.paymentSettings?.supportedMethods || [],
      currency: company?.paymentSettings?.currency || "MWK",
    });
  }, [company?.paymentSettings, reset]);

  type FormValues = {
    gateways: { paychangu?: boolean; stripe?: boolean };
    paychanguToken: string;
    paychanguAccount: string;
    paychanguReceiveNumber: string;
    stripePublishableKey: string;
    stripeSecretKey: string;
    stripePayoutAccount: string;
    supportedMethods: string[];
    currency: string;
  };
  
  const onSubmit = async (data: FormValues): Promise<void> => {
    setLoading(true);
    // FIX: Changed setError(null) to setError("") to clear the message
    setError("");
    setSuccess("");

    try {
      if (data.gateways.paychangu && !data.paychanguAccount) {
        throw new Error("PayChangu account number is required");
      }
      if (data.gateways.paychangu && !data.paychanguReceiveNumber) {
        throw new Error("PayChangu receiving number is required");
      }
      if (data.gateways.paychangu && !data.paychanguToken) {
        throw new Error("PayChangu API token is required");
      }
      if (data.gateways.paychangu && !/^[a-zA-Z0-9-]{20,}$/.test(data.paychanguToken)) {
        throw new Error("PayChangu API token must be a valid key (e.g., 20+ alphanumeric characters)");
      }
      if (data.gateways.paychangu && !/^\+265\d{9}$/.test(data.paychanguReceiveNumber)) {
        throw new Error("PayChangu receiving number must be in +265xxxxxxxxx format");
      }
      if (data.gateways.stripe && (!data.stripePublishableKey || !data.stripeSecretKey)) {
        throw new Error("Stripe keys are required");
      }
      if (data.gateways.stripe && !data.stripePayoutAccount) {
        throw new Error("Stripe payout account ID is required");
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
    } catch (err: any) {
      setError(err.message || "Failed to update payment settings");
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = company?.paymentSettings?.paychanguAccount || company?.paymentSettings?.stripePayoutAccount;

  if (!company) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-2/3"></div>
          <div className="h-12 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-900">Payment Setup</h3>
        <p className="text-gray-600">Please configure payment details to enable the payment tab.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label>Enabled Gateways</Label>
            <div className="space-y-2 mt-2">
              <Controller
                name="gateways.paychangu"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="paychangu"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                    />
                    <Label htmlFor="paychangu">PayChangu (Airtel Money, TNM Mpamba)</Label>
                  </div>
                )}
              />
              <Controller
                name="gateways.stripe"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stripe"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                    />
                    <Label htmlFor="stripe">Stripe (Credit/Debit Cards)</Label>
                  </div>
                )}
              />
            </div>
          </div>

          {watch("gateways.paychangu") && (
            <>
              <div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="paychanguToken">PayChangu API Token <span className="text-gray-500 text-xs">(Test Public Key)</span></Label>
                  <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  <span className="sr-only">Use your PayChangu test public key during development.</span>
                </div>
                <Input
                  id="paychanguToken"
                  {...register("paychanguToken", {
                    required: "Token is required when PayChangu is enabled",
                  })}
                  type="password"
                  placeholder="e.g., sec-test-xxxxxxxxxxxxxxxxxxxx"
                />
                {errors.paychanguToken && <p className="text-red-600 text-sm">{errors.paychanguToken.message}</p>}
              </div>
              <div>
                <Label htmlFor="paychanguAccount">PayChangu Account Number</Label>
                <Input
                  id="paychanguAccount"
                  {...register("paychanguAccount", {
                    required: "Account number is required when PayChangu is enabled",
                    pattern: {
                      value: /^\+265\d{9}$/,
                      message: "Must be in +265xxxxxxxxx format",
                    },
                  })}
                  placeholder="+265xxxxxxxxx"
                />
                {errors.paychanguAccount && <p className="text-red-600 text-sm">{errors.paychanguAccount.message}</p>}
              </div>
              <div>
                <Label htmlFor="paychanguReceiveNumber">PayChangu Receiving Number</Label>
                <Input
                  id="paychanguReceiveNumber"
                  {...register("paychanguReceiveNumber", {
                    required: "Receiving number is required when PayChangu is enabled",
                    pattern: {
                      value: /^\+265\d{9}$/,
                      message: "Must be in +265xxxxxxxxx format",
                    },
                  })}
                  placeholder="+265xxxxxxxxx"
                />
                {errors.paychanguReceiveNumber && <p className="text-red-600 text-sm">{errors.paychanguReceiveNumber.message}</p>}
              </div>
            </>
          )}

          {watch("gateways.stripe") && (
            <>
              <div>
                <Label htmlFor="stripePublishableKey">Stripe Publishable Key</Label>
                <Input
                  id="stripePublishableKey"
                  {...register("stripePublishableKey", {
                    required: "Key is required when Stripe is enabled",
                  })}
                  type="password"
                  placeholder="e.g., pk_test_xxxxxxxxxxxxxxxxxxxx"
                />
                {errors.stripePublishableKey && <p className="text-red-600 text-sm">{errors.stripePublishableKey.message}</p>}
              </div>
              <div>
                <Label htmlFor="stripeSecretKey">Stripe Secret Key</Label>
                <Input
                  id="stripeSecretKey"
                  {...register("stripeSecretKey", {
                    required: "Key is required when Stripe is enabled",
                  })}
                  type="password"
                  placeholder="e.g., sk_test_xxxxxxxxxxxxxxxxxxxx"
                />
                {errors.stripeSecretKey && <p className="text-red-600 text-sm">{errors.stripeSecretKey.message}</p>}
              </div>
              <div>
                <Label htmlFor="stripePayoutAccount">Stripe Payout Account ID</Label>
                <Input
                  id="stripePayoutAccount"
                  {...register("stripePayoutAccount", {
                    required: "Account ID is required when Stripe is enabled",
                  })}
                  placeholder="e.g., acct_xxxxxxxxxxxxxxxxxxxx"
                />
                {errors.stripePayoutAccount && <p className="text-red-600 text-sm">{errors.stripePayoutAccount.message}</p>}
              </div>
            </>
          )}

          <div>
            <Label>Supported Payment Methods</Label>
            <div className="space-y-2 mt-2">
              {["credit_card", "mobile_money"].map((method) => (
                <Controller
                  key={method}
                  name="supportedMethods"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={method}
                        checked={(field.value || []).includes(method)}
                        onCheckedChange={(checked) => {
                          const updated = checked
                            ? [...(field.value || []), method]
                            : (field.value || []).filter((m) => m !== method);
                          field.onChange(updated);
                        }}
                      />
                      <Label htmlFor={method} className="capitalize">
                        {method.replace("_", " ")}
                      </Label>
                    </div>
                  )}
                />
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="currency">Default Currency</Label>
            <Input id="currency" {...register("currency")} placeholder="MWK" />
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              className="bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 text-white">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">Payment Settings</h3>
      <p className="text-gray-600">Manage your configured payment methods.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {company.paymentSettings?.gateways?.paychangu && (
          <div className="p-4 bg-white rounded-lg shadow">
            <h4 className="font-semibold">PayChangu</h4>
            <p>Account: {company.paymentSettings.paychanguAccount || "Not set"}</p>
            <p>Receiving Number: {company.paymentSettings.paychanguReceiveNumber || "Not set"}</p>
            <p>Token: {company.paymentSettings.paychanguToken ? "Configured" : "Not set"}</p>
            <Button
              variant="outline"
              className="mt-2 text-red-600 hover:bg-red-50"
              onClick={() => {
                const updated = { ...watch(), gateways: { ...watch("gateways"), paychangu: false } };
                reset(updated);
                handleSubmit(onSubmit)();
              }}
            >
              Remove
            </Button>
          </div>
        )}
        {company.paymentSettings?.gateways?.stripe && (
          <div className="p-4 bg-white rounded-lg shadow">
            <h4 className="font-semibold">Stripe</h4>
            <p>Payout Account: {company.paymentSettings.stripePayoutAccount || "Not set"}</p>
            <p>Keys: {company.paymentSettings.stripePublishableKey ? "Configured" : "Not set"}</p>
            <Button
              variant="outline"
              className="mt-2 text-red-600 hover:bg-red-50"
              onClick={() => {
                const updated = { ...watch(), gateways: { ...watch("gateways"), stripe: false } };
                reset(updated);
                handleSubmit(onSubmit)();
              }}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
      <Button
        onClick={() => {
          reset({ gateways: { paychangu: false, stripe: false }, supportedMethods: [] });
          // FIX: Changed setError(null) to setError("") to clear the message
          setError("");
          setSuccess("");
          handleSubmit(onSubmit)();
        }}
        className="bg-red-600 text-white hover:bg-red-700"
      >
        Reset All Settings
      </Button>
    </div>
  );
};

export default SettingsTab;
