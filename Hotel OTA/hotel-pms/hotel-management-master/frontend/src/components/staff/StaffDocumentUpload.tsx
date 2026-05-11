import React, { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  Building,
  Shield,
  Award,
  Heart,
  Users,
  CreditCard,
  Briefcase,
  Phone,
  PiggyBank
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface DocumentUpload {
  file: File;
  preview: string;
  category: string;
  documentType: string;
  notes: string;
  departmentId?: string;
}

interface DocumentRequirement {
  _id: string;
  userType: 'staff';
  category: string;
  documentType: string;
  name: string;
  description: string;
  required: boolean;
  maxSizeMB: number;
  allowedFormats: string[];
  expiryMonths?: number;
  applicableConditions: {
    departments?: string[];
    roles?: string[];
    minimumExperience?: number;
  };
  isCurrentlyActive: boolean;
}

interface Department {
  _id: string;
  name: string;
}

interface StaffDocumentUploadProps {
  onUploadSuccess?: () => void;
}

export default function StaffDocumentUpload({ onUploadSuccess }: StaffDocumentUploadProps = {}) {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<DocumentUpload[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingRequirements, setLoadingRequirements] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const staffDocumentCategories: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; types: Record<string, string> }> = {
    employment_verification: {
      icon: Briefcase,
      label: 'Employment Verification',
      types: {
        offer_letter: 'Offer Letter',
        employment_contract: 'Employment Contract',
        probation_completion: 'Probation Completion',
        promotion_letter: 'Promotion Letter',
        salary_certificate: 'Salary Certificate'
      }
    },
    id_proof: {
      icon: Shield,
      label: 'Identity Proof',
      types: {
        drivers_license: 'Driver\'s License',
        passport: 'Passport',
        national_id: 'National ID',
        social_security: 'Social Security Card',
        voter_id: 'Voter ID'
      }
    },
    training_certificate: {
      icon: Award,
      label: 'Training & Certification',
      types: {
        safety_training: 'Safety Training',
        hospitality_certification: 'Hospitality Certification',
        language_proficiency: 'Language Proficiency',
        first_aid: 'First Aid Certification',
        food_safety: 'Food Safety Certificate'
      }
    },
    health_certificate: {
      icon: Heart,
      label: 'Health Certificate',
      types: {
        medical_checkup: 'Medical Checkup',
        vaccination_record: 'Vaccination Record',
        fitness_certificate: 'Fitness Certificate',
        mental_health_clearance: 'Mental Health Clearance',
        drug_test: 'Drug Test Result'
      }
    },
    background_check: {
      icon: Shield,
      label: 'Background Check',
      types: {
        criminal_background: 'Criminal Background Check',
        employment_verification: 'Previous Employment Verification',
        reference_check: 'Reference Check',
        credit_check: 'Credit Check',
        address_verification: 'Address Verification'
      }
    },
    work_permit: {
      icon: Building,
      label: 'Work Permit & Visa',
      types: {
        work_visa: 'Work Visa',
        work_permit: 'Work Permit',
        residence_permit: 'Residence Permit',
        green_card: 'Green Card',
        citizenship_proof: 'Citizenship Proof'
      }
    },
    emergency_contact: {
      icon: Phone,
      label: 'Emergency Contact',
      types: {
        emergency_contact_form: 'Emergency Contact Form',
        next_of_kin: 'Next of Kin Information',
        medical_emergency_info: 'Medical Emergency Information',
        insurance_beneficiary: 'Insurance Beneficiary'
      }
    },
    tax_document: {
      icon: CreditCard,
      label: 'Tax Documents',
      types: {
        tax_id: 'Tax ID Number',
        w4_form: 'W-4 Form',
        tax_return: 'Tax Return',
        tax_exemption: 'Tax Exemption Certificate'
      }
    },
    bank_details: {
      icon: PiggyBank,
      label: 'Banking Information',
      types: {
        bank_account_details: 'Bank Account Details',
        direct_deposit_form: 'Direct Deposit Form',
        void_check: 'Void Check',
        bank_statement: 'Bank Statement'
      }
    }
  };

  useEffect(() => {
    fetchRequirements();
    fetchDepartments();
  }, []);

  // Revoke all pending object URLs when the component unmounts to avoid memory leaks
  useEffect(() => {
    return () => {
      setSelectedFiles(prev => {
        prev.forEach(f => URL.revokeObjectURL(f.preview));
        return prev;
      });
    };
  }, []);

  const fetchRequirements = async () => {
    try {
      const { data } = await api.get('/documents/requirements/staff');
      // Backend wraps under data.requirements (status:'success', data:{ requirements })
      setRequirements(data.data?.requirements || data.requirements || []);
    } catch {
      // Non-critical: upload still works without requirements metadata
      setRequirements([]);
    } finally {
      setLoadingRequirements(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      // Backend returns { success: true, data: { departments: [...], pagination: {...} } }
      setDepartments(data.data?.departments || data.departments || []);
    } catch (error) {
      setDepartments([]);
    }
  };

  const getApplicableRequirements = useCallback(() => {
    return requirements.filter(req => {
      if (!req.isCurrentlyActive) return false;

      const conditions = req.applicableConditions;

      // Check department requirement
      if (conditions.departments && conditions.departments.length > 0) {
        const userDepartment = selectedDepartment || user?.departmentId;
        if (!userDepartment || !conditions.departments.includes(userDepartment)) {
          return false;
        }
      }

      // Check role requirement
      if (conditions.roles && conditions.roles.length > 0) {
        if (!conditions.roles.includes(user?.role)) {
          return false;
        }
      }

      return true;
    });
  }, [requirements, selectedDepartment, user?.departmentId, user?.role]);

  const getCurrentRequirement = useCallback(() => {
    if (!selectedCategory || !selectedDocumentType) return null;

    return getApplicableRequirements().find(req =>
      req.category === selectedCategory && req.documentType === selectedDocumentType
    );
  }, [selectedCategory, selectedDocumentType, getApplicableRequirements]);

  const validateFile = useCallback((file: File): string | null => {
    // MIME-type allowlist to guard against extension spoofing
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return `File type "${file.type}" is not allowed. Please upload a PDF, image (JPG/PNG), or Word document.`;
    }

    const requirement = getCurrentRequirement();

    if (requirement) {
      // Check file size against requirement
      const maxSizeBytes = requirement.maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        return `File size exceeds ${requirement.maxSizeMB}MB limit`;
      }

      // Check file extension against requirement's allowed formats
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension && !requirement.allowedFormats.includes(fileExtension)) {
        return `File format .${fileExtension} not allowed. Allowed formats: ${requirement.allowedFormats.join(', ')}`;
      }
    } else {
      // Default validation if no specific requirement
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return 'File size exceeds 10MB limit';
      }

      const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension && !allowedExtensions.includes(fileExtension)) {
        return `File format .${fileExtension} not allowed`;
      }
    }

    return null;
  }, [getCurrentRequirement]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!selectedCategory || !selectedDocumentType) {
      toast.error('Please select document category and type before uploading');
      return;
    }

    const newFiles: DocumentUpload[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validationError = validateFile(file);

      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      newFiles.push({
        file,
        preview,
        category: selectedCategory,
        documentType: selectedDocumentType,
        notes: notes,
        departmentId: selectedDepartment || user?.departmentId
      });
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
    setNotes('');
  }, [selectedCategory, selectedDocumentType, notes, selectedDepartment, user?.departmentId, validateFile]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadDocuments = async () => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected for upload');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const fileUpload of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('document', fileUpload.file);
        formData.append('category', fileUpload.category);
        formData.append('documentType', fileUpload.documentType);
        // Backend stores notes as 'description'
        formData.append('description', fileUpload.notes);
        formData.append('userType', 'staff');

        if (fileUpload.departmentId) {
          formData.append('departmentId', fileUpload.departmentId);
        }

        // Auto-calculate expiryDate from the matched requirement's expiryMonths
        const matchedRequirement = requirements.find(
          req => req.category === fileUpload.category && req.documentType === fileUpload.documentType
        );
        if (matchedRequirement?.expiryMonths) {
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + matchedRequirement.expiryMonths);
          formData.append('expiryDate', expiryDate.toISOString().slice(0, 10));
        }

        await api.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} document(s) uploaded successfully`);
      // Revoke object URLs before clearing state to prevent memory leaks
      setSelectedFiles(prev => {
        prev.forEach(f => URL.revokeObjectURL(f.preview));
        return [];
      });
      setSelectedCategory('');
      setSelectedDocumentType('');
      setSelectedDepartment('');
      onUploadSuccess?.();
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} document(s) failed to upload`);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const currentRequirement = getCurrentRequirement();
  const applicableRequirements = getApplicableRequirements();

  return (
    <div className="space-y-6">
      {/* Document Category & Type Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Document Upload
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Document Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedDocumentType('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Category</option>
              {Object.entries(staffDocumentCategories).map(([key, category]) => {
                const Icon = category.icon;
                return (
                  <option key={key} value={key}>
                    {category.label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Document Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Document Type</label>
            <select
              value={selectedDocumentType}
              onChange={(e) => setSelectedDocumentType(e.target.value)}
              disabled={!selectedCategory}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select Type</option>
              {selectedCategory && Object.entries(staffDocumentCategories[selectedCategory]?.types || {}).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Use My Department</option>
              {departments.map(dept => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Document Requirements Display */}
        {currentRequirement && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">{currentRequirement.name}</h4>
                <p className="text-sm text-blue-700 mt-1">{currentRequirement.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    Max Size: {currentRequirement.maxSizeMB}MB
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Formats: {currentRequirement.allowedFormats.join(', ')}
                  </Badge>
                  {currentRequirement.expiryMonths && (
                    <Badge variant="outline" className="text-xs">
                      Valid for: {currentRequirement.expiryMonths} months
                    </Badge>
                  )}
                  {currentRequirement.required && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes about this document..."
            className="w-full"
            rows={3}
          />
        </div>

        {/* File Upload Area */}
        <div role="button" tabIndex={0}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${!selectedCategory || !selectedDocumentType ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => selectedCategory && selectedDocumentType && fileInputRef.current?.click()}
         onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectedCategory && selectedDocumentType) { fileInputRef.current?.click(); } } }}>
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            {selectedCategory && selectedDocumentType
              ? 'Drop files here or click to browse'
              : 'Select category and type first'
            }
          </p>
          <p className="text-sm text-gray-500">
            Supported formats: PDF, JPG, PNG, DOC, DOCX
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
            disabled={!selectedCategory || !selectedDocumentType}
          />
        </div>

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Selected Files ({selectedFiles.length})</h4>
            <div className="space-y-3">
              {selectedFiles.map((fileUpload, index) => (
                <div key={`selectedFiles-${index}-${fileUpload.category}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-sm">{fileUpload.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(fileUpload.file.size / 1024 / 1024).toFixed(2)} MB •
                        {staffDocumentCategories[fileUpload.category]?.label} •
                        {staffDocumentCategories[fileUpload.category]?.types[fileUpload.documentType]}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={uploadDocuments}
                disabled={uploading || selectedFiles.length === 0}
                className="flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Documents
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Requirements Overview */}
      {applicableRequirements.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Document Requirements for Your Role
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applicableRequirements.map((requirement) => {
              const category = staffDocumentCategories[requirement.category];
              const Icon = category?.icon || FileText;

              return (
                <div key={requirement._id} className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{requirement.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{requirement.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {requirement.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                        {requirement.expiryMonths && (
                          <Badge variant="outline" className="text-xs">
                            {requirement.expiryMonths}mo validity
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}