/**
 * Admin Corporate Panel
 *
 * Hotel OTA corporate account management for travel agents and business clients.
 * Allows creating accounts, managing users, viewing bookings, and approving requests.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';
import {
  Building2,
  Users,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  ChevronRight,
  Search,
  CreditCard,
  Calendar,
  Phone,
  Mail,
  Shield,
  TrendingUp,
} from 'lucide-react';

interface CorporateAccount {
  id: string;
  companyName: string;
  gstin?: string;
  billingEmail?: string;
  billingAddress?: string;
  creditLimitPaise: number;
  usedCreditPaise: number;
  paymentTermsDays: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    corporateUsers: number;
    bookings: number;
  };
  corporateUsers?: Array<{
    id: string;
    role: 'admin' | 'traveller' | 'approver';
    costCenter?: string;
    isActive: boolean;
    user: {
      id: string;
      fullName: string;
      phone?: string;
      email?: string;
    };
  }>;
}

interface CorporateFormData {
  companyName: string;
  gstin: string;
  billingEmail: string;
  billingAddress: string;
  creditLimitPaise: string;
  paymentTermsDays: string;
}

const defaultFormData: CorporateFormData = {
  companyName: '',
  gstin: '',
  billingEmail: '',
  billingAddress: '',
  creditLimitPaise: '',
  paymentTermsDays: '30',
};

const AdminCorporatePanel: React.FC = () => {
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CorporateAccount | null>(null);
  const [formData, setFormData] = useState<CorporateFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/v1/admin/corporate/accounts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
      });
      const data = await res.json();
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      toast.error('Failed to load corporate accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Filter accounts by search
  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create account
  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/v1/admin/corporate/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
        body: JSON.stringify({
          company_name: formData.companyName,
          gstin: formData.gstin || undefined,
          billing_email: formData.billingEmail || undefined,
          billing_address: formData.billingAddress || undefined,
          credit_limit_paise: parseInt(formData.creditLimitPaise) * 100 || 0,
          payment_terms_days: parseInt(formData.paymentTermsDays) || 30,
        }),
      });
      if (res.ok) {
        toast.success('Corporate account created');
        setShowCreateModal(false);
        setFormData(defaultFormData);
        fetchAccounts();
      } else {
        toast.error('Failed to create account');
      }
    } catch (error) {
      toast.error('Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  // Update account
  const handleUpdate = async () => {
    if (!selectedAccount) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/v1/admin/corporate/accounts/${selectedAccount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
        body: JSON.stringify({
          company_name: formData.companyName,
          gstin: formData.gstin || undefined,
          billing_email: formData.billingEmail || undefined,
          billing_address: formData.billingAddress || undefined,
          credit_limit_paise: parseInt(formData.creditLimitPaise) * 100 || 0,
          payment_terms_days: parseInt(formData.paymentTermsDays) || 30,
        }),
      });
      if (res.ok) {
        toast.success('Account updated');
        setShowEditModal(false);
        fetchAccounts();
      } else {
        toast.error('Failed to update account');
      }
    } catch (error) {
      toast.error('Failed to update account');
    } finally {
      setSubmitting(false);
    }
  };

  // Deactivate account
  const handleDeactivate = async (accountId: string) => {
    if (!confirm('Are you sure you want to deactivate this account?')) return;
    try {
      const res = await fetch(`/v1/admin/corporate/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
      });
      if (res.ok) {
        toast.success('Account deactivated');
        fetchAccounts();
      } else {
        toast.error('Failed to deactivate account');
      }
    } catch (error) {
      toast.error('Failed to deactivate account');
    }
  };

  // Open edit modal
  const openEditModal = (account: CorporateAccount) => {
    setSelectedAccount(account);
    setFormData({
      companyName: account.companyName,
      gstin: account.gstin || '',
      billingEmail: account.billingEmail || '',
      billingAddress: account.billingAddress || '',
      creditLimitPaise: (account.creditLimitPaise / 100).toString(),
      paymentTermsDays: account.paymentTermsDays.toString(),
    });
    setShowEditModal(true);
  };

  // Open detail modal
  const openDetailModal = async (account: CorporateAccount) => {
    setSelectedAccount(account);
    setShowDetailModal(true);
    // Fetch full account details with users
    try {
      const res = await fetch(`/v1/admin/corporate/accounts/${account.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
      });
      const data = await res.json();
      setSelectedAccount(data);
    } catch (error) {
      console.error('Failed to fetch account details:', error);
    }
  };

  // Format currency
  const formatCurrency = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);
  };

  // Get credit usage percentage
  const getCreditUsage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.round((used / limit) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corporate Accounts</h1>
          <p className="text-gray-500 mt-1">Manage travel agent and business client accounts</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Corporate Account
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by company name or GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No corporate accounts"
          description="Add your first corporate account to get started"
          action={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAccounts.map((account) => (
            <Card key={account.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{account.companyName}</h3>
                      <p className="text-sm text-gray-500">{account.gstin || 'No GSTIN'}</p>
                    </div>
                  </div>
                  <Badge variant={account.isActive ? 'success' : 'danger'}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Credit Info */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Credit Used</span>
                    <span className="font-medium">
                      {formatCurrency(account.usedCreditPaise)} / {formatCurrency(account.creditLimitPaise)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        getCreditUsage(account.usedCreditPaise, account.creditLimitPaise) > 80
                          ? 'bg-red-500'
                          : getCreditUsage(account.usedCreditPaise, account.creditLimitPaise) > 50
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(getCreditUsage(account.usedCreditPaise, account.creditLimitPaise), 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-lg font-semibold">{account._count?.corporateUsers || 0}</p>
                    <p className="text-xs text-gray-500">Users</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-lg font-semibold">{account._count?.bookings || 0}</p>
                    <p className="text-xs text-gray-500">Bookings</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetailModal(account)}>
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditModal(account)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  {account.isActive && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeactivate(account.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Corporate Account">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
            <Input
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Acme Corporation"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
            <Input
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
            <Input
              type="email"
              value={formData.billingEmail}
              onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
              placeholder="accounts@acme.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
              <Input
                type="number"
                value={formData.creditLimitPaise}
                onChange={(e) => setFormData({ ...formData, creditLimitPaise: e.target.value })}
                placeholder="100000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (days)</label>
              <Input
                type="number"
                value={formData.paymentTermsDays}
                onChange={(e) => setFormData({ ...formData, paymentTermsDays: e.target.value })}
                placeholder="30"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !formData.companyName}>
              {submitting ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Corporate Account">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
            <Input
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
            <Input
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
            <Input
              type="email"
              value={formData.billingEmail}
              onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
              <Input
                type="number"
                value={formData.creditLimitPaise}
                onChange={(e) => setFormData({ ...formData, creditLimitPaise: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (days)</label>
              <Input
                type="number"
                value={formData.paymentTermsDays}
                onChange={(e) => setFormData({ ...formData, paymentTermsDays: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={submitting || !formData.companyName}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={selectedAccount?.companyName || 'Account Details'}
      >
        {selectedAccount && (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">GSTIN</p>
                <p className="font-medium">{selectedAccount.gstin || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={selectedAccount.isActive ? 'success' : 'danger'}>
                  {selectedAccount.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Credit Limit</p>
                <p className="font-medium">{formatCurrency(selectedAccount.creditLimitPaise)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Used Credit</p>
                <p className="font-medium">{formatCurrency(selectedAccount.usedCreditPaise)}</p>
              </div>
            </div>

            {/* Users */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Users ({selectedAccount.corporateUsers?.length || 0})</h4>
              </div>
              {selectedAccount.corporateUsers && selectedAccount.corporateUsers.length > 0 ? (
                <div className="space-y-2">
                  {selectedAccount.corporateUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{user.user.fullName}</p>
                          <p className="text-sm text-gray-500">
                            {user.user.email || user.user.phone || 'No contact'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                        {user.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No users added yet</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default withErrorBoundary(AdminCorporatePanel);
