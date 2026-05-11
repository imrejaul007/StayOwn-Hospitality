import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import {
  FileText,
  Users,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Download,
  Search,
  RefreshCw,
  Calendar,
  Building,
  Shield,
  Award,
  Heart,
  Phone,
  CreditCard,
  PiggyBank,
  Briefcase,
  RotateCcw,
  FileCheck,
  FileX,
  Timer
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Document {
  _id: string;
  originalName: string;
  category: string;
  documentType: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired' | 'renewal_required';
  createdAt: string;
  verificationDetails?: {
    verifiedAt?: string;
    verifiedBy?: {
      _id: string;
      name: string;
    };
    comments?: string;
    rejectionReason?: string;
  };
  expiryDate?: string;
  description?: string;
  fileSize: number;
  fileType: string;
  userType: 'guest' | 'staff';
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  departmentId?: {
    _id: string;
    name: string;
  };
  bookingId?: {
    _id: string;
    confirmationNumber: string;
  };
}

interface DocumentStats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  expired: number;
  renewalRequired: number;
  guestDocs: number;
  staffDocs: number;
}

interface VerificationAction {
  action: 'verify' | 'reject' | 'request_renewal';
  notes?: string;
  rejectionReason?: string;
  expiryMonths?: number;
}

const guestDocumentCategories = {
  identity_proof: { icon: Shield, label: 'Identity Proof' },
  address_proof: { icon: Building, label: 'Address Proof' },
  travel_document: { icon: FileText, label: 'Travel Document' },
  visa: { icon: FileText, label: 'Visa' },
  certificate: { icon: Award, label: 'Certificate' },
  booking_related: { icon: Calendar, label: 'Booking Related' },
  payment_proof: { icon: CreditCard, label: 'Payment Proof' }
};

const staffDocumentCategories = {
  employment_verification: { icon: Briefcase, label: 'Employment Verification' },
  id_proof: { icon: Shield, label: 'Identity Proof' },
  training_certificate: { icon: Award, label: 'Training & Certification' },
  health_certificate: { icon: Heart, label: 'Health Certificate' },
  background_check: { icon: Shield, label: 'Background Check' },
  work_permit: { icon: Building, label: 'Work Permit & Visa' },
  emergency_contact: { icon: Phone, label: 'Emergency Contact' },
  tax_document: { icon: CreditCard, label: 'Tax Documents' },
  bank_details: { icon: PiggyBank, label: 'Banking Information' }
};

function AdminDocumentVerification() {
  useAuth();
  const { selectedPropertyId, viewMode } = useProperty();
  const [activeQueue, setActiveQueue] = useState<'guest' | 'staff'>('guest');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    expired: 0,
    renewalRequired: 0,
    guestDocs: 0,
    staffDocs: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [verificationModal, setVerificationModal] = useState(false);
  const [verificationAction, setVerificationAction] = useState<VerificationAction>({
    action: 'verify'
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchDocuments();
    }
  }, [selectedPropertyId, activeQueue, statusFilter]);

  useEffect(() => {
    setCategoryFilter('all');
  }, [activeQueue]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/documents/admin/queue', {
        params: { userType: activeQueue, status: statusFilter, propertyId: selectedPropertyId }
      });
      setDocuments(data.documents);
      calculateStats(data.documents, data.totalStats);
    } catch (error) {
      toast.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (docs: Document[], totalStats?: Record<string, unknown>) => {
    const newStats: DocumentStats = {
      total: (totalStats?.total as number) ?? docs.length,
      pending: (totalStats?.pending as number) ?? docs.filter(d => d.status === 'pending').length,
      verified: (totalStats?.verified as number) ?? docs.filter(d => d.status === 'verified').length,
      rejected: (totalStats?.rejected as number) ?? docs.filter(d => d.status === 'rejected').length,
      expired: (totalStats?.expired as number) ?? docs.filter(d => d.status === 'expired').length,
      renewalRequired: (totalStats?.renewalRequired as number) ?? docs.filter(d => d.status === 'renewal_required').length,
      guestDocs: (totalStats?.guestDocs as number) ?? docs.filter(d => d.userType === 'guest').length,
      staffDocs: (totalStats?.staffDocs as number) ?? docs.filter(d => d.userType === 'staff').length
    };
    setStats(newStats);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-orange-100 text-orange-800';
      case 'renewal_required':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (doc: Document) => {
    if (doc.status === 'expired') return 'border-l-red-500';
    if (doc.status === 'renewal_required') return 'border-l-orange-500';
    if (doc.expiryDate) {
      const daysToExpiry = Math.ceil((new Date(doc.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry <= 7) return 'border-l-red-500';
      if (daysToExpiry <= 30) return 'border-l-yellow-500';
    }
    return 'border-l-blue-500';
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc._id}/download`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a delay to allow the new tab to load
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error('Error opening document');
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc._id}/download`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error downloading document');
    }
  };

  const openVerificationModal = (doc: Document, action: 'verify' | 'reject' | 'request_renewal') => {
    setSelectedDocument(doc);
    setVerificationAction({ action, notes: '', rejectionReason: '', expiryMonths: 12 });
    setVerificationModal(true);
  };

  const handleVerificationSubmit = async () => {
    if (!selectedDocument) return;

    if (verificationAction.action === 'reject' && !verificationAction.rejectionReason?.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);

    try {
      let endpoint = '';
      const payload: Record<string, unknown> = {};

      switch (verificationAction.action) {
        case 'verify':
          endpoint = `/documents/${selectedDocument._id}/verify`;
          payload.comments = verificationAction.notes;
          if (verificationAction.expiryMonths) {
            payload.expiryMonths = verificationAction.expiryMonths;
          }
          break;
        case 'reject':
          endpoint = `/documents/${selectedDocument._id}/reject`;
          payload.rejectionReason = verificationAction.rejectionReason;
          payload.notes = verificationAction.notes;
          break;
        case 'request_renewal':
          endpoint = `/documents/${selectedDocument._id}/request-renewal`;
          payload.notes = verificationAction.notes;
          break;
      }

      await api.patch(endpoint, payload);
      toast.success(`Document ${verificationAction.action === 'verify' ? 'verified' : verificationAction.action === 'reject' ? 'rejected' : 'marked for renewal'} successfully`);
      setVerificationModal(false);
      setSelectedDocument(null);
      fetchDocuments();
    } catch (error) {
      toast.error('Error processing document');
    } finally {
      setProcessing(false);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      doc.originalName?.toLowerCase().includes(term) ||
      doc.userId?.name?.toLowerCase().includes(term) ||
      doc.userId?.email?.toLowerCase().includes(term);

    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const QueueButton = ({ queue, label, count }: { queue: 'guest' | 'staff'; label: string; count: number }) => (
    <button
      aria-label={`Switch to ${label}`}
      onClick={() => setActiveQueue(queue)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeQueue === queue
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      <Users className="h-4 w-4" />
      {label}
      <Badge variant="secondary" className="ml-1">
        {count}
      </Badge>
    </button>
  );

  const currentCategories = activeQueue === 'guest' ? guestDocumentCategories : staffDocumentCategories;

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Compliance', 'Document Verification']} />
        <div className="mt-8 text-center">
          <p className="text-gray-500">Please select a property to manage document verification</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Compliance', 'Document Verification']} />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
          <p className="text-gray-600 mt-1">Review and verify guest and staff documents</p>
        </div>
        <Button
          onClick={fetchDocuments}
          variant="outline"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Timer className="h-8 w-8 text-yellow-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Verified</p>
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
            </div>
            <FileCheck className="h-8 w-8 text-green-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <FileX className="h-8 w-8 text-red-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-orange-600">{stats.expired}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Renewal</p>
              <p className="text-2xl font-bold text-blue-600">{stats.renewalRequired}</p>
            </div>
            <RotateCcw className="h-8 w-8 text-blue-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Guest Docs</p>
              <p className="text-2xl font-bold text-purple-600">{stats.guestDocs}</p>
            </div>
            <Users className="h-8 w-8 text-purple-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Staff Docs</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.staffDocs}</p>
            </div>
            <UserCheck className="h-8 w-8 text-indigo-400" />
          </div>
        </Card>
      </div>

      {/* Queue Navigation */}
      <div className="flex flex-wrap gap-2">
        <QueueButton queue="guest" label="Guest Queue" count={stats.guestDocs} />
        <QueueButton queue="staff" label="Staff Queue" count={stats.staffDocs} />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents or users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="renewal_required">Renewal Required</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {Object.entries(currentCategories).map(([key, category]) => (
                <option key={key} value={key}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('pending');
              }}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Documents List */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {activeQueue === 'guest' ? 'Guest' : 'Staff'} Documents ({filteredDocuments.length})
          </h3>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm || categoryFilter !== 'all'
                ? 'No documents match your filters'
                : `No ${statusFilter === 'all' ? '' : statusFilter} ${activeQueue} documents found`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDocuments.map(doc => {
              const category = currentCategories[doc.category];
              const Icon = category?.icon || FileText;

              return (
                <div key={doc._id} className={`border-l-4 ${getPriorityColor(doc)} border rounded-lg p-4 hover:bg-gray-50 transition-colors`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-6 w-6 text-gray-600 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{doc.originalName}</h4>
                          <Badge className={`text-xs ${getStatusColor(doc.status)}`}>
                            {doc.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                          <p>
                            <strong>User:</strong> {doc.userId?.name} ({doc.userId?.role})
                          </p>
                          <p>
                            <strong>Category:</strong> {category?.label}
                          </p>
                          <p>
                            <strong>Uploaded:</strong> {formatDate(doc.createdAt)}
                          </p>
                          <p>
                            <strong>Size:</strong> {formatFileSize(doc.fileSize)}
                          </p>
                          {doc.departmentId && (
                            <p>
                              <strong>Department:</strong> {doc.departmentId.name}
                            </p>
                          )}
                          {doc.bookingId && (
                            <p>
                              <strong>Booking:</strong> {doc.bookingId.confirmationNumber}
                            </p>
                          )}
                          {doc.expiryDate && (
                            <p>
                              <strong>Expires:</strong> {formatDate(doc.expiryDate)}
                            </p>
                          )}
                          {doc.verificationDetails?.verifiedAt && doc.verificationDetails?.verifiedBy && (
                            <p>
                              <strong>Verified by:</strong> {doc.verificationDetails.verifiedBy.name}
                            </p>
                          )}
                        </div>

                        {doc.verificationDetails?.comments && (
                          <p className="text-sm text-gray-600 mt-2 italic bg-gray-100 p-2 rounded">
                            <strong>Notes:</strong> {doc.verificationDetails.comments}
                          </p>
                        )}

                        {doc.verificationDetails?.rejectionReason && (
                          <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded">
                            <strong>Rejection reason:</strong> {doc.verificationDetails.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadDocument(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>

                      {doc.status === 'pending' && (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            onClick={() => openVerificationModal(doc, 'verify')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openVerificationModal(doc, 'reject')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {(doc.status === 'verified' || doc.status === 'expired') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openVerificationModal(doc, 'request_renewal')}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Request Renewal
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Verification Modal */}
      <Modal
        isOpen={verificationModal}
        onClose={() => setVerificationModal(false)}
        title={`${verificationAction.action === 'verify' ? 'Verify' : verificationAction.action === 'reject' ? 'Reject' : 'Request Renewal'} Document`}
        size="lg"
      >
        {selectedDocument && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">{selectedDocument.originalName}</h4>
              <p className="text-sm text-gray-600">
                User: {selectedDocument.userId?.name} ({selectedDocument.userId?.email})
              </p>
              <p className="text-sm text-gray-600">
                Category: {currentCategories[selectedDocument.category]?.label}
              </p>
            </div>

            {verificationAction.action === 'verify' && (
              <div>
                <label className="block text-sm font-medium mb-2">Validity Period (months)</label>
                <Input
                  type="number"
                  value={verificationAction.expiryMonths || ''}
                  onChange={(e) => setVerificationAction(prev => ({
                    ...prev,
                    expiryMonths: parseInt(e.target.value) || undefined
                  }))}
                  placeholder="Leave blank for no expiry"
                  min="1"
                  max="120"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank if this document doesn't expire
                </p>
              </div>
            )}

            {verificationAction.action === 'reject' && (
              <div>
                <label className="block text-sm font-medium mb-2">Rejection Reason *</label>
                <Textarea
                  value={verificationAction.rejectionReason || ''}
                  onChange={(e) => setVerificationAction(prev => ({
                    ...prev,
                    rejectionReason: e.target.value
                  }))}
                  placeholder="Please provide a clear reason for rejection..."
                  rows={3}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
              <Textarea
                value={verificationAction.notes || ''}
                onChange={(e) => setVerificationAction(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setVerificationModal(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerificationSubmit}
                disabled={processing || (verificationAction.action === 'reject' && !verificationAction.rejectionReason?.trim())}
                className={
                  verificationAction.action === 'verify'
                    ? 'bg-green-600 hover:bg-green-700'
                    : verificationAction.action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }
              >
                {processing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {verificationAction.action === 'verify' && <CheckCircle className="h-4 w-4 mr-2" />}
                    {verificationAction.action === 'reject' && <XCircle className="h-4 w-4 mr-2" />}
                    {verificationAction.action === 'request_renewal' && <RotateCcw className="h-4 w-4 mr-2" />}
                    {verificationAction.action === 'verify' ? 'Verify Document' :
                     verificationAction.action === 'reject' ? 'Reject Document' : 'Request Renewal'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default withErrorBoundary(AdminDocumentVerification, { level: 'page' });