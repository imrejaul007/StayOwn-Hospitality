import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { api } from '../../services/api';

interface RevenueAccount {
  _id: string;
  accountCode: string;
  accountName: string;
  accountDescription?: string;
  revenueCategory: string;
  accountType: string;
  reportingGroup: string;
  isActive: boolean;
  isSystemGenerated: boolean;
  parentAccount?: {
    _id: string;
    accountCode: string;
    accountName: string;
  };
  accountLevel: number;
  sortOrder: number;
  glAccountCode?: string;
  applicableRoomTypes: unknown[];
  applicableChannels: string[];
  applicableRateTypes: string[];
  validFrom: string;
  validTo?: string;
  autoCalculation: {
    isEnabled: boolean;
    calculationMethod: string;
    calculationValue: number;
  };
  budgetInfo: {
    monthlyBudget: number;
    yearlyBudget: number;
    budgetCurrency: string;
  };
  auditInfo: {
    totalRevenue: number;
    transactionCount: number;
    lastRevenueDate?: string;
  };
  createdBy: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface RevenueAccountFormProps {
  account: RevenueAccount | null;
  hotelId: string;
  onSubmit: () => void;
  onCancel: () => void;
}

const revenueCategories = [
  { value: 'room', label: 'Room' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'package', label: 'Package' },
  { value: 'addon', label: 'Add-on' },
  { value: 'fee', label: 'Fee' },
  { value: 'tax', label: 'Tax' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'penalty', label: 'Penalty' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'group', label: 'Group' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'channel', label: 'Channel' },
  { value: 'other', label: 'Other' },
];

const accountTypes = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'fee', label: 'Fee' },
  { value: 'tax', label: 'Tax' },
  { value: 'deposit', label: 'Deposit' },
];

export default function RevenueAccountForm({
  account,
  hotelId,
  onSubmit,
  onCancel,
}: RevenueAccountFormProps) {
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountDescription, setAccountDescription] = useState('');
  const [revenueCategory, setRevenueCategory] = useState('room');
  const [accountType, setAccountType] = useState('primary');
  const [glAccountCode, setGlAccountCode] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (account) {
      setAccountCode(account.accountCode);
      setAccountName(account.accountName);
      setAccountDescription(account.accountDescription || '');
      setRevenueCategory(account.revenueCategory);
      setAccountType(account.accountType);
      setGlAccountCode(account.glAccountCode || '');
      setSortOrder(String(account.sortOrder ?? 0));
      setIsActive(account.isActive);
    }
  }, [account]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!accountCode.trim()) newErrors.accountCode = 'Account code is required';
    if (!accountName.trim()) newErrors.accountName = 'Account name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSubmitError('');

    const payload: Record<string, unknown> = {
      accountCode: accountCode.trim(),
      accountName: accountName.trim(),
      revenueCategory,
      accountType,
      sortOrder: Number(sortOrder) || 0,
      isActive,
    };

    if (accountDescription.trim()) payload.accountDescription = accountDescription.trim();
    if (glAccountCode.trim()) payload.glAccountCode = glAccountCode.trim();

    try {
      if (account) {
        await api.patch(`/revenue-accounts/${account._id}`, payload);
      } else {
        await api.post(`/revenue-accounts/hotels/${hotelId}`, payload);
      }
      onSubmit();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save revenue account';
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {submitError}
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Basic Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Account Code"
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            required
            error={errors.accountCode}
            placeholder="e.g. REV-ROOM-001"
          />
          <Input
            label="Account Name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
            error={errors.accountName}
            placeholder="e.g. Standard Room Revenue"
          />
        </div>
        <Textarea
          label="Description"
          value={accountDescription}
          onChange={(e) => setAccountDescription(e.target.value)}
          placeholder="Optional description of this revenue account"
          rows={2}
        />
      </div>

      {/* Classification */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Classification
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Revenue Category</Label>
            <Select value={revenueCategory} onValueChange={setRevenueCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {revenueCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((at) => (
                  <SelectItem key={at.value} value={at.value}>
                    {at.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Financial */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Financial
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="GL Account Code"
            value={glAccountCode}
            onChange={(e) => setGlAccountCode(e.target.value)}
            placeholder="e.g. 4000-100"
            helperText="General ledger account code"
          />
          <Input
            label="Sort Order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="0"
            helperText="Lower numbers appear first"
          />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Status
        </h3>
        <div className="flex items-center gap-3">
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <Label className="mb-0">{isActive ? 'Active' : 'Inactive'}</Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} loading={saving}>
          {account ? 'Update Account' : 'Create Account'}
        </Button>
      </div>
    </form>
  );
}
