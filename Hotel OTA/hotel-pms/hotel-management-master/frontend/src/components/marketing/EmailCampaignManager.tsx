import React, { useState, useEffect, useRef} from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Send, Eye, BarChart3, Users, Mail, Calendar, Target, AlertTriangle } from 'lucide-react';
import { bookingEngineService, EmailCampaign, CreateEmailCampaignData } from '@/services/bookingEngineService';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';

interface CreateCampaignData {
  name: string;
  type: string;
  subject: string;
  preheader: string;
  htmlContent: string;
  textContent: string;
  segments: string[];
  scheduledDate?: string;
  sendImmediately: boolean;
}

const EmailCampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Multi-property support
  const { selectedProperty, selectedPropertyId } = useProperty();
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  const [formData, setFormData] = useState<CreateCampaignData>({
    name: '',
    type: 'promotional',
    subject: '',
    preheader: '',
    htmlContent: '',
    textContent: '',
    segments: [],
    sendImmediately: true
  });

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await bookingEngineService.getEmailCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load email campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      const campaignData: CreateEmailCampaignData = {
        campaignId: `campaign-${Date.now()}`,
        name: formData.name,
        type: formData.type,
        status: formData.sendImmediately ? 'sending' : 'scheduled',
        content: {
          subject: formData.subject,
          preheader: formData.preheader,
          htmlContent: formData.htmlContent,
          textContent: formData.textContent
        },
        targeting: {
          segments: formData.segments,
          excludeUnsubscribed: true
        },
        scheduling: {
          sendImmediately: formData.sendImmediately,
          scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate).toISOString() : undefined
        },
        tracking: {
          sent: 0,
          opens: 0,
          clicks: 0,
          conversions: 0
        }
      };

      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: campaignData,
          settingType: 'email_campaign',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
      } else {
        await bookingEngineService.createEmailCampaign(campaignData);
      }

      fetchCampaigns();
      setIsCreateModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const handleUpdateCampaign = async () => {
    if (!selectedCampaign) return;

    try {
      const updateData = {
        name: formData.name,
        type: formData.type,
        content: {
          subject: formData.subject,
          preheader: formData.preheader,
          htmlContent: formData.htmlContent,
          textContent: formData.textContent
        },
        targeting: {
          segments: formData.segments,
          excludeUnsubscribed: true
        }
      };

      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { id: selectedCampaign._id, ...updateData },
          settingType: 'email_campaign',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
      } else {
        await bookingEngineService.updateEmailCampaign(selectedCampaign._id, updateData);
      }

      fetchCampaigns();
      setIsEditModalOpen(false);
      setSelectedCampaign(null);
      resetForm();
    } catch (error) {
      console.error('Error updating campaign:', error);
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
        fetchCampaigns();
      }
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    try {
      await bookingEngineService.sendEmailCampaign(campaignId);
      fetchCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'promotional',
      subject: '',
      preheader: '',
      htmlContent: '',
      textContent: '',
      segments: [],
      sendImmediately: true
    });
  };

  const openEditModal = (campaign: EmailCampaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      type: campaign.type,
      subject: campaign.content?.subject || '',
      preheader: campaign.content?.preheader || '',
      htmlContent: campaign.content?.htmlContent || '',
      textContent: campaign.content?.textContent || '',
      segments: campaign.targeting?.segments || [],
      sendImmediately: false
    });
    setIsEditModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      sending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-green-100 text-green-800',
      paused: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      promotional: Mail,
      welcome: Users,
      abandoned_booking: Calendar,
      post_stay: Target,
      newsletter: BarChart3,
      seasonal: Calendar,
      birthday: Users,
      anniversary: Users
    };
    return icons[type as keyof typeof icons] || Mail;
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return campaign.status === 'sending';
    if (activeTab === 'draft') return campaign.status === 'draft';
    if (activeTab === 'sent') return campaign.status === 'sent';
    return true;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center py-8">
          <div className="text-lg">Loading email campaigns...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
          <p className="font-medium">Settings updated successfully!</p>
          {applyToScope !== 'single' && affectedCount > 1 && (
            <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
          )}
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
          <p className="font-medium">Error: {updateError}</p>
        </div>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  This property is part of: {inheritanceStatus.groupName}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Email campaign settings can be managed centrally for all properties in this group.
                  {inheritanceStatus.lastSyncedAt && (
                    <span className="ml-1">
                      Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Email Campaign Management</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Email Campaign</DialogTitle>
            </DialogHeader>
            <CampaignForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreateCampaign}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaign Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Mail className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
              <p className="text-2xl font-bold">{campaigns.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Send className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sent</p>
              <p className="text-2xl font-bold">
                {campaigns.reduce((sum, c) => sum + (c.tracking?.sent || 0), 0).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Eye className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Opens</p>
              <p className="text-2xl font-bold">
                {campaigns.reduce((sum, c) => sum + (c.tracking?.opens || 0), 0).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <BarChart3 className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Open Rate</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const totalSent = campaigns.reduce((sum, c) => sum + (c.tracking?.sent || 0), 0);
                  const totalOpens = campaigns.reduce((sum, c) => sum + (c.tracking?.opens || 0), 0);
                  return totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) : '0';
                })()}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-property selector */}
      <Card>
        <CardContent className="p-4">
          <ApplyToSelector
            value={applyToScope}
            onChange={setApplyToScope}
            isInGroup={inheritanceStatus?.hasGroup || false}
            groupName={inheritanceStatus?.groupName}
            totalProperties={inheritanceStatus?.groupPropertyCount || 0}
            showWarning={true}
            warningMessage="Changes to email campaign settings will affect marketing communications across all properties in the selected scope."
          />
        </CardContent>
      </Card>

      {/* Campaign Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Campaigns</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No campaigns found</p>
                <p className="text-sm text-gray-400">Create your first email campaign to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCampaigns.map((campaign) => {
                const TypeIcon = getTypeIcon(campaign.type);
                return (
                  <Card key={campaign._id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                          <TypeIcon className="w-5 h-5 text-gray-600" />
                          <div>
                            <h3 className="text-lg font-semibold">{campaign.name}</h3>
                            <p className="text-sm text-gray-600">{campaign.content?.subject || 'No subject'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsPreviewModalOpen(true)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(campaign)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {campaign.status === 'draft' && (
                            <Button
                              size="sm"
                              onClick={() => handleSendCampaign(campaign._id)}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex items-center">
                          <Send className="w-4 h-4 text-blue-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Sent</p>
                            <p className="font-semibold">{campaign.tracking?.sent || 0}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Eye className="w-4 h-4 text-green-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Opens</p>
                            <p className="font-semibold">{campaign.tracking?.opens || 0}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <BarChart3 className="w-4 h-4 text-purple-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Clicks</p>
                            <p className="font-semibold">{campaign.tracking?.clicks || 0}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Target className="w-4 h-4 text-orange-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Conversions</p>
                            <p className="font-semibold">{campaign.tracking?.conversions || 0}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Campaign</DialogTitle>
          </DialogHeader>
          <CampaignForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateCampaign}
            onCancel={() => setIsEditModalOpen(false)}
            isEdit
          />
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Email Campaign Settings"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

const CampaignForm: React.FC<{
  formData: CreateCampaignData;
  setFormData: (data: CreateCampaignData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}> = ({ formData, setFormData, onSubmit, onCancel, isEdit }) => {
  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList>
        <TabsTrigger value="basic">Basic Settings</TabsTrigger>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="targeting">Targeting</TabsTrigger>
        <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter campaign name"
            />
          </div>

          <div>
            <Label htmlFor="type">Campaign Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select campaign type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="promotional">Promotional</SelectItem>
                <SelectItem value="welcome">Welcome</SelectItem>
                <SelectItem value="abandoned_booking">Abandoned Booking</SelectItem>
                <SelectItem value="post_stay">Post Stay</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="anniversary">Anniversary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="subject">Email Subject</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Enter email subject"
          />
        </div>

        <div>
          <Label htmlFor="preheader">Preheader Text</Label>
          <Input
            id="preheader"
            value={formData.preheader}
            onChange={(e) => setFormData({ ...formData, preheader: e.target.value })}
            placeholder="Enter preheader text (appears below subject in email clients)"
          />
        </div>
      </TabsContent>

      <TabsContent value="content" className="space-y-4">
        <div>
          <Label htmlFor="htmlContent">HTML Content</Label>
          <Textarea
            id="htmlContent"
            value={formData.htmlContent}
            onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
            placeholder="Enter HTML content for the email"
            className="min-h-[200px]"
          />
        </div>

        <div>
          <Label htmlFor="textContent">Plain Text Content</Label>
          <Textarea
            id="textContent"
            value={formData.textContent}
            onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
            placeholder="Enter plain text content (fallback for email clients that don't support HTML)"
            className="min-h-[200px]"
          />
        </div>
      </TabsContent>

      <TabsContent value="targeting" className="space-y-4">
        <div>
          <Label htmlFor="segments">Target Segments</Label>
          <Input
            id="segments"
            value={formData.segments.join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              segments: e.target.value.split(',').map(s => s.trim()).filter(s => s)
            })}
            placeholder="Enter target segments separated by commas (e.g., new_customers, premium, vip)"
          />
        </div>
      </TabsContent>

      <TabsContent value="scheduling" className="space-y-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="sendImmediately"
            checked={formData.sendImmediately}
            onChange={(e) => setFormData({ ...formData, sendImmediately: e.target.checked })}
          />
          <Label htmlFor="sendImmediately">Send immediately</Label>
        </div>

        {!formData.sendImmediately && (
          <div>
            <Label htmlFor="scheduledDate">Scheduled Date & Time</Label>
            <Input
              id="scheduledDate"
              type="datetime-local"
              value={formData.scheduledDate}
              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            />
          </div>
        )}
      </TabsContent>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Campaign
        </Button>
      </div>
    </Tabs>
  );
};

export default EmailCampaignManager;
