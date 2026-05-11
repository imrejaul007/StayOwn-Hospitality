import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Upload,
  Camera,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  Shield,
  AlertCircle,
  CheckCircle,
  Edit,
  X,
  Plus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { travelAgentService, TravelAgent } from '../../services/travelAgentService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface ProfileFormData {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  businessDetails: {
    licenseNumber: string;
    gstNumber: string;
    establishedYear: number;
    businessType: 'domestic' | 'international' | 'both';
  };
  paymentTerms: {
    creditLimit: number;
    paymentDueDays: number;
    preferredPaymentMethod: string;
  };
  notes: string;
}

const ProfileEdit: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TravelAgent | null>(null);
  const [profileImage, setProfileImage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'basic' | 'business' | 'payment' | 'preferences'>('basic');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ProfileFormData>({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      zipCode: ''
    },
    businessDetails: {
      licenseNumber: '',
      gstNumber: '',
      establishedYear: new Date().getFullYear(),
      businessType: 'domestic'
    },
    paymentTerms: {
      creditLimit: 0,
      paymentDueDays: 30,
      preferredPaymentMethod: 'bank_transfer'
    },
    notes: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const agentProfile = await travelAgentService.getMyTravelAgentProfile();
      setProfile(agentProfile);

      // Populate form with existing data
      setFormData({
        companyName: agentProfile.companyName || '',
        contactPerson: agentProfile.contactPerson || '',
        email: agentProfile.email || '',
        phone: agentProfile.phone || '',
        address: {
          street: agentProfile.address?.street || '',
          city: agentProfile.address?.city || '',
          state: agentProfile.address?.state || '',
          country: agentProfile.address?.country || '',
          zipCode: agentProfile.address?.zipCode || ''
        },
        businessDetails: {
          licenseNumber: agentProfile.businessDetails?.licenseNumber || '',
          gstNumber: agentProfile.businessDetails?.gstNumber || '',
          establishedYear: agentProfile.businessDetails?.establishedYear || new Date().getFullYear(),
          businessType: agentProfile.businessDetails?.businessType || 'domestic'
        },
        paymentTerms: {
          creditLimit: agentProfile.paymentTerms?.creditLimit || 0,
          paymentDueDays: agentProfile.paymentTerms?.paymentDueDays || 30,
          preferredPaymentMethod: agentProfile.paymentTerms?.preferredPaymentMethod || 'bank_transfer'
        },
        notes: agentProfile.notes || ''
      });
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (formData.businessDetails.establishedYear < 1900 || formData.businessDetails.establishedYear > new Date().getFullYear()) {
      newErrors.establishedYear = 'Please enter a valid year';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        businessDetails: formData.businessDetails,
        paymentTerms: formData.paymentTerms,
        notes: formData.notes
      };

      await travelAgentService.updateAgentProfile(updateData);
      toast.success('Profile updated successfully!');
      navigate('/travel-agent');
    } catch (error) {
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      toast.success('Profile image updated');
    }
  };

  const getFieldError = (field: string) => {
    return errors[field] ? (
      <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
        <AlertCircle className="h-4 w-4" />
        {errors[field]}
      </p>
    ) : null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button aria-label="Previous"
                onClick={() => navigate('/travel-agent')}
                className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
                <p className="text-gray-600">Update your travel agent information</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/travel-agent')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button aria-label="Save"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Profile Image & Status */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover"
                      />
                    ) : (
                      <Building className="h-12 w-12 text-indigo-600" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full cursor-pointer hover:bg-indigo-700 transition-colors">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <h3 className="font-semibold text-gray-900">{formData.companyName || 'Company Name'}</h3>
                <p className="text-sm text-gray-600">{profile?.agentCode}</p>
                <div className="mt-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    profile?.status === 'active' ? 'bg-green-100 text-green-800' :
                    profile?.status === 'suspended' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {profile?.status === 'active' ? <CheckCircle className="h-4 w-4 mr-1" /> :
                     profile?.status === 'suspended' ? <X className="h-4 w-4 mr-1" /> :
                     <AlertCircle className="h-4 w-4 mr-1" />}
                    {profile?.status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Account Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Bookings</span>
                  <span className="font-medium">{profile?.performance?.totalBookings || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Revenue</span>
                  <span className="font-medium">₹{profile?.performance?.totalRevenue?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Commission Rate</span>
                  <span className="font-medium">{profile?.commissionStructure?.defaultRate || 0}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Credit Limit</span>
                  <span className="font-medium">₹{formData.paymentTerms.creditLimit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  {[
                    { key: 'basic', label: 'Basic Info', icon: User },
                    { key: 'business', label: 'Business Details', icon: Building },
                    { key: 'payment', label: 'Payment Terms', icon: CreditCard },
                    { key: 'preferences', label: 'Preferences', icon: FileText }
                  ].map(({ key, label, icon: Icon }) => (
                    <button aria-label="Close"
                      key={key}
                      onClick={() => setActiveTab(key as unknown)}
                      className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
                        activeTab === key
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Basic Information Tab */}
            {activeTab === 'basic' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name *
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                          errors.companyName ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter company name"
                      />
                    </div>
                    {getFieldError('companyName')}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Person *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.contactPerson}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                          errors.contactPerson ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter contact person name"
                      />
                    </div>
                    {getFieldError('contactPerson')}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                          errors.email ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter email address"
                      />
                    </div>
                    {getFieldError('email')}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                          errors.phone ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter phone number"
                      />
                    </div>
                    {getFieldError('phone')}
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, street: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="Street address"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, city: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.address.state}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, state: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="State/Province"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.address.country}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, country: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="Country"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.address.zipCode}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, zipCode: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="ZIP/Postal Code"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Business Details Tab */}
            {activeTab === 'business' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Business Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type
                    </label>
                    <select
                      value={formData.businessDetails.businessType}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        businessDetails: { ...prev.businessDetails, businessType: e.target.value as string }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    >
                      <option value="domestic">Domestic</option>
                      <option value="international">International</option>
                      <option value="both">Both</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Established Year
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={formData.businessDetails.establishedYear}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          businessDetails: { ...prev.businessDetails, establishedYear: parseInt(e.target.value) || 0 }
                        }))}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                          errors.establishedYear ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="YYYY"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>
                    {getFieldError('establishedYear')}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      License Number
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.businessDetails.licenseNumber}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          businessDetails: { ...prev.businessDetails, licenseNumber: e.target.value }
                        }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="Enter license number"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GST Number
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.businessDetails.gstNumber}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          businessDetails: { ...prev.businessDetails, gstNumber: e.target.value }
                        }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="Enter GST number"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Payment Terms Tab */}
            {activeTab === 'payment' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Payment Terms</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Credit Limit
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={formData.paymentTerms.creditLimit}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          paymentTerms: { ...prev.paymentTerms, creditLimit: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="Enter credit limit"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Due Days
                    </label>
                    <input
                      type="number"
                      value={formData.paymentTerms.paymentDueDays}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        paymentTerms: { ...prev.paymentTerms, paymentDueDays: parseInt(e.target.value) || 30 }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      placeholder="Enter payment due days"
                      min="1"
                      max="90"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Payment Method
                    </label>
                    <select
                      value={formData.paymentTerms.preferredPaymentMethod}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        paymentTerms: { ...prev.paymentTerms, preferredPaymentMethod: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                      <option value="wire_transfer">Wire Transfer</option>
                      <option value="digital_wallet">Digital Wallet</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Preferences & Notes</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      placeholder="Enter any additional notes or special requirements..."
                      rows={6}
                    />
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">Account Status Information</h3>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>• Your agent code: <strong>{profile?.agentCode}</strong></p>
                      <p>• Current status: <strong>{profile?.status?.toUpperCase()}</strong></p>
                      <p>• Commission rate: <strong>{profile?.commissionStructure?.defaultRate}%</strong></p>
                      <p>• Account created: <strong>{profile?.createdAt ? format(new Date(profile.createdAt), 'MMM dd, yyyy') : 'N/A'}</strong></p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(ProfileEdit, { level: 'page' });