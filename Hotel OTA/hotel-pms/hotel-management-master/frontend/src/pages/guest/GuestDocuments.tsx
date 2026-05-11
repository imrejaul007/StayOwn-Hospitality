import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import {
  DocumentTextIcon,
  FolderIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import DocumentUpload from '@/components/guest/DocumentUpload';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Document {
  _id: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  category: string;
  documentType: string;
  description: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired' | 'renewal_required';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  expiryDate?: string;
  verificationDetails?: {
    verifiedBy?: {
      name: string;
      email: string;
    };
    verifiedAt?: string;
    comments?: string;
    rejectionReason?: string;
  };
  bookingId?: {
    _id: string;
    bookingNumber: string;
    checkIn: string;
    checkOut: string;
  };
  isExpiring?: boolean;
  isExpired?: boolean;
}

interface Booking {
  _id: string;
  bookingNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

const CATEGORY_ICONS: { [key: string]: React.ComponentType<unknown> } = {
  identity_proof: DocumentTextIcon,
  address_proof: FolderIcon,
  travel_document: DocumentTextIcon,
  visa: DocumentTextIcon,
  certificate: DocumentTextIcon,
  booking_related: FolderIcon,
  payment_proof: DocumentTextIcon
};

const CATEGORY_LABELS: { [key: string]: string } = {
  identity_proof: 'Identity Proof',
  address_proof: 'Address Proof',
  travel_document: 'Travel Document',
  visa: 'Visa',
  certificate: 'Certificate',
  booking_related: 'Booking Related',
  payment_proof: 'Payment Proof'
};

function GuestDocuments() {
  const queryClient = useQueryClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'documents'>('overview');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<Document | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: docsData, isLoading: loading, refetch } = useQuery({
    queryKey: ['guest-documents', page, selectedCategory, selectedStatus, selectedBooking, debouncedSearchTerm],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        userType: 'guest',
        page,
        limit: PAGE_SIZE
      };
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedBooking !== 'all' && selectedBooking !== 'no_booking') params.bookingId = selectedBooking;
      if (debouncedSearchTerm.trim()) params.search = debouncedSearchTerm.trim();
      const response = await api.get('/documents', { params });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev: unknown) => prev,
  });

  const documents: Document[] = docsData?.data?.documents || [];
  const totalCount = docsData?.totalCount ?? documents.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const error = docsData === undefined && !loading ? 'Failed to fetch documents. Please try again.' : null;

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data } = await api.get('/bookings', {
        params: { limit: 50, page: 1 }
      });
      setBookings(data.data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch bookings for filter:', error);
    }
  };

  const handleDocumentUploaded = (_newDocument: Document) => {
    queryClient.invalidateQueries({ queryKey: ['guest-documents'] });
    setActiveTab('documents');
  };

  const getFilteredDocuments = () => {
    if (selectedBooking === 'no_booking') {
      return documents.filter((doc) => !doc.bookingId);
    }
    return documents;
  };

  const getDocumentStats = () => {
    const total = documents.length;
    const verified = documents.filter(doc => doc.status === 'verified').length;
    const pending = documents.filter(doc => doc.status === 'pending').length;
    const rejected = documents.filter(doc => doc.status === 'rejected').length;
    const expiring = documents.filter(doc => doc.isExpiring).length;
    const expired = documents.filter(doc => doc.isExpired).length;

    return { total, verified, pending, rejected, expiring, expired };
  };

  const getCategoryStats = () => {
    const categories = Object.keys(CATEGORY_LABELS);
    return categories.map(category => {
      const categoryDocs = documents.filter(doc => doc.category === category);
      return {
        category,
        label: CATEGORY_LABELS[category],
        count: categoryDocs.length,
        verified: categoryDocs.filter(doc => doc.status === 'verified').length,
        pending: categoryDocs.filter(doc => doc.status === 'pending').length
      };
    }).filter(stat => stat.count > 0);
  };

  const downloadDocument = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc._id}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      // Sanitize filename to prevent header-injection-style issues
      a.download = doc.originalName.replace(/[^\w.\-() ]/g, '_');
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      toast.success('Document downloaded successfully');
    } catch (err) {
      toast.error('Failed to download document');
    }
  };

  const viewDocument = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc._id}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: doc.fileType });
      const url = window.URL.createObjectURL(blob);
      setPreviewDoc(doc);
      setPreviewUrl(url);
    } catch (err) {
      toast.error('Failed to view document');
    }
  };

  const closePreview = useCallback(() => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewDoc(null);
  }, [previewUrl]);

  const deleteDocument = (doc: Document) => {
    setConfirmDeleteDoc(doc);
  };

  const confirmDeleteDocument = async () => {
    if (!confirmDeleteDoc) return;
    const doc = confirmDeleteDoc;
    setConfirmDeleteDoc(null);
    setDeleting(doc._id);
    try {
      await api.delete(`/documents/${doc._id}`);
      queryClient.invalidateQueries({ queryKey: ['guest-documents'] });
      toast.success('Document deleted successfully');
    } catch (err) {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />;
      case 'expired':
      case 'renewal_required':
        return <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'expired':
      case 'renewal_required':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const stats = getDocumentStats();
  const categoryStats = getCategoryStats();
  const filteredDocuments = getFilteredDocuments();

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedStatus, selectedBooking, debouncedSearchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <ExclamationTriangleIcon className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Document Preview Modal */}
      {previewUrl && previewDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {previewDoc.originalName}
              </h3>
              <div className="flex items-center space-x-2">
                <Button variant="secondary" size="sm" onClick={() => downloadDocument(previewDoc)}>
                  <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> Download
                </Button>
                <Button variant="secondary" size="sm" onClick={closePreview}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
              {previewDoc.fileType === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[600px] border-0"
                  title={`Preview: ${previewDoc.originalName}`}
                />
              ) : previewDoc.fileType.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={`Preview: ${previewDoc.originalName}`}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Preview not available for this file type.</p>
                  <Button className="mt-4" onClick={() => downloadDocument(previewDoc)}>
                    Download to View
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
        <p className="text-gray-600 mt-2">
          Manage your uploaded documents and track verification status
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'overview' as const, label: 'Overview', icon: FolderIcon },
            { id: 'upload' as const, label: 'Upload Documents', icon: DocumentTextIcon },
            { id: 'documents' as const, label: 'All Documents', icon: DocumentTextIcon }
          ].map(tab => (
            <button
              key={tab.id}
              aria-label={tab.label}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card className="p-4">
              <div className="flex items-center">
                <DocumentTextIcon className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Verified</p>
                  <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <ClockIcon className="w-8 h-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-8 h-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Expiring</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.expiring}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-700" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Expired</p>
                  <p className="text-2xl font-bold text-red-700">{stats.expired}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Category Breakdown */}
          {categoryStats.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents by Category</h3>
              <div className="space-y-4">
                {categoryStats.map(stat => {
                  const IconComponent = CATEGORY_ICONS[stat.category] || DocumentTextIcon;
                  return (
                    <div key={stat.category} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <IconComponent className="w-6 h-6 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-900">{stat.label}</p>
                          <p className="text-sm text-gray-600">{stat.count} document(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <p className="text-sm font-medium text-green-600">{stat.verified}</p>
                          <p className="text-xs text-gray-500">Verified</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-yellow-600">{stat.pending}</p>
                          <p className="text-xs text-gray-500">Pending</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Recent Documents */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Documents</h3>
              <Button
                variant="secondary"
                onClick={() => setActiveTab('documents')}
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No documents uploaded yet.</p>
                  <Button className="mt-3" variant="secondary" onClick={() => setActiveTab('upload')}>
                    Upload Your First Document
                  </Button>
                </div>
              ) : (
                documents.slice(0, 5).map(doc => (
                  <div key={doc._id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <DocumentTextIcon className="w-6 h-6 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.originalName}</p>
                            <p className="text-sm text-gray-600">
                              {(CATEGORY_LABELS[doc.category] || doc.category)} • {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                      </div>
                    </div>
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(doc.status)}`}>
                      {getStatusIcon(doc.status)}
                      <span className="capitalize">{doc.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <DocumentUpload
          userType="guest"
          onDocumentUploaded={handleDocumentUploaded}
        />
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <FunnelIcon className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>
              </div>

              <select
                aria-label="Filter by document category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <select
                aria-label="Filter by document status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
                <option value="renewal_required">Renewal Required</option>
              </select>

              <select
                aria-label="Filter by booking"
                value={selectedBooking}
                onChange={(e) => setSelectedBooking(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Bookings</option>
                <option value="no_booking">Not Linked to Booking</option>
                {bookings.map(booking => (
                  <option key={booking._id} value={booking._id}>
                    {booking.bookingNumber}
                  </option>
                ))}
              </select>

              <div className="flex items-center space-x-2 flex-1 min-w-64">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Documents List */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Documents ({filteredDocuments.length})
              </h3>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">No documents found</p>
                <p className="text-gray-600 mb-4">
                  {documents.length === 0
                    ? "You haven't uploaded any documents yet."
                    : "No documents match your current filters."
                  }
                </p>
                <Button onClick={() => setActiveTab('upload')}>
                  Upload Your First Document
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {filteredDocuments.map(doc => (
                    <div key={doc._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <DocumentTextIcon className="w-8 h-8 text-gray-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">{doc.originalName}</h4>
                            <p className="text-sm text-gray-600">
                              {(CATEGORY_LABELS[doc.category] || doc.category)} • {doc.documentType} •{' '}
                              {formatFileSize(doc.fileSize)} •{' '}
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                            {doc.description && (
                              <p className="text-sm text-gray-500 mt-1">{doc.description}</p>
                            )}
                            {doc.bookingId && (
                              <p className="text-sm text-blue-600 mt-1">
                                Linked to booking: {doc.bookingId.bookingNumber}
                              </p>
                            )}
                            {doc.verificationDetails?.rejectionReason && (
                              <p className="text-sm text-red-600 mt-1">
                                Rejection reason: {doc.verificationDetails.rejectionReason}
                              </p>
                            )}
                            {doc.verificationDetails?.comments && doc.status === 'verified' && (
                              <p className="text-sm text-green-600 mt-1">
                                Verification notes: {doc.verificationDetails.comments}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(doc.status)}`}>
                            {getStatusIcon(doc.status)}
                            <span className="capitalize">{doc.status.replace('_', ' ')}</span>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => viewDocument(doc)}
                            title="Preview document"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => downloadDocument(doc)}
                            title="Download document"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => deleteDocument(doc)}
                            disabled={deleting === doc._id}
                            title="Delete document"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {deleting === doc._id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                            ) : (
                              <TrashIcon className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} documents
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeftIcon className="w-4 h-4 mr-1" /> Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                      >
                        Next <ChevronRightIcon className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Delete Document Confirmation Dialog */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-doc-title">
          <Card className="max-w-md w-full p-6">
            <h3 id="delete-doc-title" className="text-lg font-semibold text-gray-900 mb-2">Delete Document</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete &ldquo;{confirmDeleteDoc.originalName}&rdquo;? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDeleteDoc(null)}>Cancel</Button>
              <Button variant="secondary" className="text-red-600 hover:bg-red-50" onClick={confirmDeleteDocument}>
                <TrashIcon className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(GuestDocuments);
