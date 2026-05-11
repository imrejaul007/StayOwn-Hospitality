import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  User,
  Calendar,
  Building,
  Shield,
  Award,
  Heart,
  Phone,
  CreditCard,
  PiggyBank,
  Briefcase,
  Info
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../LoadingSpinner';
import { toast } from 'sonner';

interface DocumentViewerProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  showMetadata?: boolean;
  allowDownload?: boolean;
  showActions?: boolean;
  className?: string;
}

interface DocumentData {
  _id: string;
  originalName: string;
  category: string;
  documentType: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired' | 'renewal_required';
  uploadedAt: string;
  verifiedAt?: string;
  verifiedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  expiresAt?: string;
  notes?: string;
  rejectionReason?: string;
  fileUrl: string;
  filePath: string;
  userType: 'guest' | 'staff';
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
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
  viewableByRoles: string[];
  metadata: {
    size: number;
    mimeType: string;
    dimensions?: {
      width: number;
      height: number;
    };
    pageCount?: number;
  };
  auditLog: Array<{
    action: string;
    performedBy: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    timestamp: string;
    details?: unknown;
  }>;
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

export default function DocumentViewer({
  documentId,
  isOpen,
  onClose,
  showMetadata = true,
  allowDownload = true,
  showActions = false,
  className = ''
}: DocumentViewerProps) {
  const { user } = useAuth();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [hasViewAccess, setHasViewAccess] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchDocumentData();
    }

    return () => {
      if (documentUrl) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [isOpen, documentId]);

  const fetchDocumentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, fetch document details
      const { data: docData } = await api.get(`/documents/${documentId}`);
      const documentPayload = docData?.data?.document || docData?.document;
      if (!documentPayload) {
        throw new Error('Document details are unavailable');
      }
      setDocument(documentPayload);
      setHasViewAccess(true);

      // Check if user has view access based on roles and ownership
      const canView = checkViewAccess(documentPayload);
      if (!canView) {
        setError('You do not have permission to view this document');
        setHasViewAccess(false);
        return;
      }

      // Then, fetch the actual document file
      const { data: blob } = await api.get(`/documents/${documentId}/download`, {
        responseType: 'blob'
      });
      setDocumentBlob(blob);

      // Create object URL for viewing
      const url = URL.createObjectURL(blob);
      setDocumentUrl(url);

    } catch (error: unknown) {
      const axiosErr = error as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 403) {
        setError('You do not have permission to view this document');
        setHasViewAccess(false);
        return;
      }
      setError(axiosErr.response?.data?.message || (error instanceof Error ? error.message : 'Failed to load document'));
    } finally {
      setLoading(false);
    }
  };

  const checkViewAccess = (doc: DocumentData): boolean => {
    if (!user) return false;

    // Document owner can always view
    if (doc.userId._id === user._id) return true;

    // Admin can view all documents
    if (user.role === 'admin') return true;

    // Check if user role is in viewableByRoles
    if (doc.viewableByRoles.includes(user.role)) return true;

    // For staff documents, check department access
    if (doc.userType === 'staff' && user.departmentId && doc.departmentId) {
      return user.departmentId === doc.departmentId._id;
    }

    // Manager can view documents in their domain
    if (user.role === 'manager') {
      if (doc.userType === 'guest' || (doc.userType === 'staff' && (!doc.departmentId || doc.departmentId._id === user.departmentId))) {
        return true;
      }
    }

    return false;
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
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
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

  const handleDownload = async () => {
    if (!documentBlob || !document) return;

    try {
      const url = URL.createObjectURL(documentBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Document downloaded successfully');
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    setFullscreen(prev => !prev);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderDocumentContent = () => {
    if (!documentUrl || !document) return null;

    const isImage = document.metadata.mimeType.startsWith('image/');
    const isPDF = document.metadata.mimeType === 'application/pdf';

    if (isImage) {
      return (
        <div className="flex justify-center items-center h-full overflow-auto">
          <img
            src={documentUrl}
            alt={document.originalName}
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transition: 'transform 0.3s ease',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
            className="shadow-lg"
          />
        </div>
      );
    }

    if (isPDF) {
      return (
        <div className="w-full h-full">
          <iframe
            src={documentUrl}
            title={document.originalName}
            className="w-full h-full border-0"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left'
            }}
          />
        </div>
      );
    }

    // For other file types, show a preview or download option
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <FileText className="h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{document.originalName}</h3>
        <p className="text-gray-600 mb-4">
          This file type ({document.metadata.mimeType}) cannot be previewed in the browser.
        </p>
        {allowDownload && (
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download to View
          </Button>
        )}
      </div>
    );
  };

  const currentCategories = document?.userType === 'guest' ? guestDocumentCategories : staffDocumentCategories;
  const category = document ? currentCategories[document.category] : null;
  const CategoryIcon = category?.icon || FileText;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size={fullscreen ? 'full' : 'xl'}
      className={className}
    >
      <div className="flex flex-col h-full max-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {document && (
              <>
                <CategoryIcon className="h-6 w-6 text-gray-600" />
                <div>
                  <h3 className="text-lg font-semibold truncate max-w-md">
                    {document.originalName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs ${getStatusColor(document.status)}`}>
                      {document.status.replace('_', ' ')}
                    </Badge>
                    {getStatusIcon(document.status)}
                    <span className="text-sm text-gray-500">
                      {category?.label}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Document Controls */}
            {documentUrl && hasViewAccess && (
              <>
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 px-2">{zoom}%</span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleRotate}>
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                  {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </>
            )}

            {allowDownload && documentBlob && hasViewAccess && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            )}

            {showMetadata && document && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuditLog(!showAuditLog)}
              >
                <Info className="h-4 w-4" />
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Document Viewer */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                <p className="text-gray-600">{error}</p>
              </div>
            ) : (
              <div ref={viewerRef} className="w-full h-full bg-gray-100">
                {renderDocumentContent()}
              </div>
            )}
          </div>

          {/* Metadata Sidebar */}
          {showMetadata && document && hasViewAccess && (
            <div className={`w-80 border-l bg-white overflow-y-auto ${showAuditLog ? 'block' : 'hidden'}`}>
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Document Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Size:</span>
                      <span className="ml-2">{formatFileSize(document.metadata.size)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2">{document.metadata.mimeType}</span>
                    </div>
                    {document.metadata.dimensions && (
                      <div>
                        <span className="text-gray-500">Dimensions:</span>
                        <span className="ml-2">
                          {document.metadata.dimensions.width} × {document.metadata.dimensions.height}
                        </span>
                      </div>
                    )}
                    {document.metadata.pageCount && (
                      <div>
                        <span className="text-gray-500">Pages:</span>
                        <span className="ml-2">{document.metadata.pageCount}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Uploaded:</span>
                      <span className="ml-2">{formatDate(document.uploadedAt)}</span>
                    </div>
                    {document.expiresAt && (
                      <div>
                        <span className="text-gray-500">Expires:</span>
                        <span className="ml-2">{formatDate(document.expiresAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Name:</span>
                      <span className="ml-2">
                        {document.userId.firstName} {document.userId.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2">{document.userId.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Role:</span>
                      <span className="ml-2 capitalize">{document.userId.role}</span>
                    </div>
                    {document.departmentId && (
                      <div>
                        <span className="text-gray-500">Department:</span>
                        <span className="ml-2">{document.departmentId.name}</span>
                      </div>
                    )}
                    {document.bookingId && (
                      <div>
                        <span className="text-gray-500">Booking:</span>
                        <span className="ml-2">{document.bookingId.confirmationNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {document.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {document.notes}
                    </p>
                  </div>
                )}

                {document.rejectionReason && (
                  <div>
                    <h4 className="font-medium text-red-900 mb-2">Rejection Reason</h4>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
                      {document.rejectionReason}
                    </p>
                  </div>
                )}

                {document.verifiedBy && document.verifiedAt && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Verification</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">Verified by:</span>
                        <span className="ml-2">
                          {document.verifiedBy.firstName} {document.verifiedBy.lastName}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Verified on:</span>
                        <span className="ml-2">{formatDate(document.verifiedAt)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {document.auditLog && document.auditLog.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Activity Log</h4>
                    <div className="space-y-2">
                      {document.auditLog.slice(0, 5).map((log, index) => (
                        <div key={`log-${index}`} className="text-xs bg-gray-50 p-2 rounded">
                          <div className="font-medium">{log.action}</div>
                          <div className="text-gray-500">
                            by {log.performedBy.firstName} {log.performedBy.lastName}
                          </div>
                          <div className="text-gray-400">
                            {formatDate(log.timestamp)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}