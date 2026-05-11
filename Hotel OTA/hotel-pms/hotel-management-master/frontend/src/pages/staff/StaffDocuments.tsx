import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Upload,
  Search,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Building,
  Award,
  Heart,
  Shield,
  Phone,
  CreditCard,
  PiggyBank,
  Briefcase,
  RefreshCw,
  Plus,
  TrendingUp
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import StaffDocumentUpload from '../../components/staff/StaffDocumentUpload';
import { toast } from 'sonner';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Document {
  _id: string;
  originalName: string;
  category: string;
  documentType: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired' | 'renewal_required';
  // Backend uses createdAt from Mongoose timestamps; uploadedAt is an alias
  createdAt: string;
  uploadedAt?: string;
  // Backend stores verification info under verificationDetails
  verificationDetails?: {
    verifiedBy?: {
      _id: string;
      name: string;
    };
    verifiedAt?: string;
    rejectionReason?: string;
    comments?: string;
  };
  // Backend field is expiryDate
  expiryDate?: string;
  // Notes are stored as description in the backend
  description?: string;
  fileUrl: string;
  filePath: string;
  userType: string;
  departmentId?: {
    _id: string;
    name: string;
  };
  viewableByRoles: string[];
  // Backend stores size directly as fileSize (not nested under metadata)
  fileSize: number;
  fileType: string;
}

interface DocumentStats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  expired: number;
  renewalRequired: number;
}

const staffDocumentCategories: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
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

function StaffDocuments() {
  useAuth(); // Ensures authenticated context is present
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'documents'>('overview');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    expired: 0,
    renewalRequired: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input to avoid firing a request on every keystroke
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch stats once on mount (independent of list filters)
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [currentPage, statusFilter, categoryFilter, debouncedSearch]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        userType: 'staff',
        page: currentPage,
        limit: pageLimit
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const { data } = await api.get('/documents', { params });
      const fetchedDocs: Document[] = data?.data?.documents || [];
      const count = data?.totalCount || 0;
      const pages = data?.totalPages || 1;
      setDocuments(fetchedDocs);
      setTotalCount(count);
      setTotalPages(pages);
    } catch (error) {
      toast.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  };

  // Fetch aggregate stats independently of current filter/page so the
  // overview cards always reflect the complete picture.
  // Uses the /documents/analytics endpoint to get all counts in a single round-trip.
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const { data } = await api.get('/documents/analytics', {
        params: { userType: 'staff', period: '3650d' }
      });
      const overview = data?.analytics?.overview;
      if (overview) {
        setStats({
          total: overview.totalDocuments || 0,
          pending: overview.pendingVerification || 0,
          verified: overview.verifiedDocuments || 0,
          rejected: overview.rejectedDocuments || 0,
          expired: overview.expiredDocuments || 0,
          renewalRequired: overview.renewalRequests || 0
        });
      }
    } catch {
      // Non-critical: stats failure does not block the main list
    } finally {
      setStatsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'expired':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'renewal_required':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
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

  const handleViewDocument = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc._id}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const newTab = window.open(url, '_blank');
      // Revoke after a short delay to give the browser time to load the resource
      if (newTab) {
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      } else {
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast.error('Error opening document');
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc._id}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
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

  // All filtering is done server-side; documents already contains the filtered page.
  const filteredDocuments = documents;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const TabButton = ({ tab, label, icon: Icon }: { tab: string; label: string; icon: React.ComponentType<{ className?: string }> }) => (
    <button aria-label={label}
      onClick={() => setActiveTab(tab as typeof activeTab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeTab === tab
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Documents</h1>
          <p className="text-gray-600 mt-1">Manage your employment and compliance documents</p>
        </div>
        <Button
          onClick={() => setActiveTab('upload')}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        <TabButton tab="overview" label="Overview" icon={TrendingUp} />
        <TabButton tab="upload" label="Upload" icon={Upload} />
        <TabButton tab="documents" label="My Documents" icon={FileText} />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && statsLoading && (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {activeTab === 'overview' && !statsLoading && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Verified</p>
                  <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
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
                <RefreshCw className="h-8 w-8 text-blue-400" />
              </div>
            </Card>
          </div>

          {/* Recent Documents */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Documents</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('documents')}
              >
                View All
              </Button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No documents uploaded yet</p>
                <Button
                  className="mt-4"
                  onClick={() => setActiveTab('upload')}
                >
                  Upload Your First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.slice(0, 5).map(doc => {
                  const category = staffDocumentCategories[doc.category];
                  const Icon = category?.icon || FileText;

                  return (
                    <div key={doc._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-sm">{doc.originalName}</p>
                          <p className="text-xs text-gray-500">
                            {category?.label} • {formatDate(doc.uploadedAt || doc.createdAt)} • {formatFileSize(doc.fileSize || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getStatusColor(doc.status)}`}>
                          {doc.status.replace(/_/g, ' ')}
                        </Badge>
                        {getStatusIcon(doc.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'upload' && (
        <StaffDocumentUpload onUploadSuccess={() => { fetchDocuments(); fetchStats(); }} />
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search documents..."
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
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
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
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {Object.entries(staffDocumentCategories).map(([key, category]) => (
                    <option key={key} value={key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Documents List */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                My Documents ({totalCount})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDocuments}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner />
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {debouncedSearch || statusFilter !== 'all' || categoryFilter !== 'all'
                    ? 'No documents match your filters'
                    : 'No documents uploaded yet'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDocuments.map(doc => {
                  const category = staffDocumentCategories[doc.category];
                  const Icon = category?.icon || FileText;

                  return (
                    <div key={doc._id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Icon className="h-6 w-6 text-gray-600 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{doc.originalName}</h4>
                              <Badge className={`text-xs ${getStatusColor(doc.status)}`}>
                                {doc.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {category?.label}
                              {doc.departmentId && ` • ${doc.departmentId.name}`}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                              <span>Uploaded: {formatDate(doc.uploadedAt || doc.createdAt)}</span>
                              <span>•</span>
                              <span>Size: {formatFileSize(doc.fileSize || 0)}</span>
                              {doc.verificationDetails?.verifiedAt && (
                                <>
                                  <span>•</span>
                                  <span>Verified: {formatDate(doc.verificationDetails.verifiedAt)}</span>
                                </>
                              )}
                              {doc.expiryDate && (
                                <>
                                  <span>•</span>
                                  <span>Expires: {formatDate(doc.expiryDate)}</span>
                                </>
                              )}
                            </div>
                            {doc.description && (
                              <p className="text-sm text-gray-600 mt-2 italic">
                                Note: {doc.description}
                              </p>
                            )}
                            {doc.verificationDetails?.rejectionReason && (
                              <p className="text-sm text-red-600 mt-2">
                                Rejection reason: {doc.verificationDetails.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(StaffDocuments);
