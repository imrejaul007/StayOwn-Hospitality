import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Globe, 
  CreditCard, 
  Clock, 
  Mail, 
  Phone, 
  MapPin,
  Palette,
  Search,
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { WebSettings } from '@/services/webSettingsService';

interface SettingsPreviewProps {
  settings: WebSettings;
  section?: string;
}

export default function SettingsPreview({ settings, section = 'general' }: SettingsPreviewProps) {
  const renderGeneralPreview = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Globe className="w-5 h-5 text-blue-600" />
        <div>
          <h3 className="font-semibold">{settings.general?.hotelName || 'Hotel Name'}</h3>
          <p className="text-sm text-gray-600">{settings.general?.description || 'No description'}</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Mail className="w-4 h-4 text-gray-500" />
          <span className="text-sm">{settings.general?.contact?.email || 'No email'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Phone className="w-4 h-4 text-gray-500" />
          <span className="text-sm">{settings.general?.contact?.phone || 'No phone'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          <span className="text-sm">{settings.general?.fullAddress || 'No address'}</span>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Currency</span>
        <Badge variant="outline">
          {settings.general?.currency?.symbol}{settings.general?.currency?.code}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Timezone</span>
        <Badge variant="outline">
          {settings.general?.timezone || 'UTC'}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Languages</span>
        <Badge variant="outline">
          {settings.general?.languages?.length || 0} configured
        </Badge>
      </div>
    </div>
  );

  const renderBookingPreview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <div className="text-sm font-medium">Min Stay</div>
          <div className="text-lg font-bold text-blue-600">
            {settings.booking?.minimumStay || 1} {(settings.booking?.minimumStay || 1) === 1 ? 'night' : 'nights'}
          </div>
        </div>
        
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <div className="text-sm font-medium">Max Stay</div>
          <div className="text-lg font-bold text-green-600">
            {settings.booking?.maximumStay || 30} nights
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Check-in Time</span>
          <Badge variant="outline">{settings.booking?.checkInTime || '15:00'}</Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Check-out Time</span>
          <Badge variant="outline">{settings.booking?.checkOutTime || '11:00'}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Instant Confirmation</span>
          <div className="flex items-center">
            {settings.booking?.instantConfirmation ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Requires Approval</span>
          <div className="flex items-center">
            {settings.booking?.requiresApproval ? (
              <CheckCircle className="w-4 h-4 text-orange-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <div className="text-sm font-medium mb-2">Cancellation Policy</div>
        <Badge variant="outline" className="capitalize">
          {settings.booking?.cancellationPolicy?.type || 'moderate'}
        </Badge>
        {settings.booking?.cancellationPolicy?.penaltyPercentage > 0 && (
          <span className="text-sm text-gray-600 ml-2">
            {settings.booking.cancellationPolicy.penaltyPercentage}% penalty
          </span>
        )}
      </div>
    </div>
  );

  const renderPaymentPreview = () => (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-3">Payment Gateways</div>
        <div className="space-y-2">
          {settings.payment?.gateways?.filter(g => g.isActive).map((gateway, index) => (
            <div key={`-${index}-${gateway.name}`} className="flex items-center justify-between p-2 bg-green-50 rounded">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium capitalize">{gateway.name}</span>
              </div>
              <Badge variant="default" size="sm">Active</Badge>
            </div>
          )) || (
            <div className="text-center py-4 text-gray-500 text-sm">
              No active payment gateways
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Deposit Required</span>
          <div className="flex items-center">
            {settings.payment?.depositRequired ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {settings.payment?.depositRequired && (
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-sm font-medium">Deposit Details</div>
            <div className="text-sm text-gray-600">
              {settings.payment.depositAmount?.type === 'percentage' 
                ? `${settings.payment.depositAmount.value}% of total`
                : `${settings.general?.currency?.symbol}${settings.payment.depositAmount?.value} fixed`
              }
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tax Inclusive Pricing</span>
          <div className="flex items-center">
            {settings.payment?.taxInclusive ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSEOPreview = () => (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center space-x-2 mb-2">
          <Search className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">Search Preview</span>
        </div>
        
        <div className="space-y-1">
          <div className="text-lg font-medium text-blue-700 hover:underline cursor-pointer">
            {settings.seo?.metaTags?.title || settings.general?.hotelName || 'Your Hotel'}
          </div>
          <div className="text-sm text-green-600">
            https://yourhotel.com
          </div>
          <div className="text-sm text-gray-600">
            {settings.seo?.metaTags?.description || 'Welcome to our hotel. Book your stay with us for comfort and convenience.'}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Search Engine Indexing</span>
          <div className="flex items-center">
            {settings.seo?.robots?.index !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Follow Links</span>
          <div className="flex items-center">
            {settings.seo?.robots?.follow !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Auto Sitemap</span>
          <div className="flex items-center">
            {settings.seo?.sitemap?.autoGenerate !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {settings.seo?.metaTags?.keywords && settings.seo.metaTags.keywords.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">SEO Keywords</div>
            <div className="flex flex-wrap gap-1">
              {settings.seo.metaTags.keywords.map((keyword, index) => (
                <Badge key={`settings-seo-metaTags-keywords-${index}-${keyword}`} variant="outline" size="sm">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderIntegrationsPreview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {/* Google Analytics */}
        <div className="flex items-center justify-between p-3 border rounded">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <Settings className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Google Analytics</div>
              <div className="text-xs text-gray-500">
                {settings.integrations?.googleAnalytics?.trackingId || 'Not configured'}
              </div>
            </div>
          </div>
          <Badge 
            variant={settings.integrations?.googleAnalytics?.isActive ? "default" : "secondary"}
            size="sm"
          >
            {settings.integrations?.googleAnalytics?.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Google Tag Manager */}
        <div className="flex items-center justify-between p-3 border rounded">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Settings className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Google Tag Manager</div>
              <div className="text-xs text-gray-500">
                {settings.integrations?.googleTagManager?.containerId || 'Not configured'}
              </div>
            </div>
          </div>
          <Badge 
            variant={settings.integrations?.googleTagManager?.isActive ? "default" : "secondary"}
            size="sm"
          >
            {settings.integrations?.googleTagManager?.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Facebook Pixel */}
        <div className="flex items-center justify-between p-3 border rounded">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium">Facebook Pixel</div>
              <div className="text-xs text-gray-500">
                {settings.integrations?.facebookPixel?.pixelId || 'Not configured'}
              </div>
            </div>
          </div>
          <Badge 
            variant={settings.integrations?.facebookPixel?.isActive ? "default" : "secondary"}
            size="sm"
          >
            {settings.integrations?.facebookPixel?.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Email Marketing */}
        <div className="flex items-center justify-between p-3 border rounded">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Mail className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Email Marketing</div>
              <div className="text-xs text-gray-500 capitalize">
                {settings.integrations?.emailMarketing?.provider || 'Not configured'}
              </div>
            </div>
          </div>
          <Badge 
            variant={settings.integrations?.emailMarketing?.isActive ? "default" : "secondary"}
            size="sm"
          >
            {settings.integrations?.emailMarketing?.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <Separator />

      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">
          {settings.integrations?.activeCount || 0}
        </div>
        <div className="text-sm text-gray-600">Active Integrations</div>
      </div>
    </div>
  );

  const renderThemePreview = () => (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex items-center space-x-2 mb-3">
          <Palette className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-600">Color Preview</span>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'primary', label: 'Primary', color: settings.theme?.colorScheme?.primary || '#2563eb' },
            { key: 'secondary', label: 'Secondary', color: settings.theme?.colorScheme?.secondary || '#64748b' },
            { key: 'accent', label: 'Accent', color: settings.theme?.colorScheme?.accent || '#f59e0b' },
            { key: 'success', label: 'Success', color: settings.theme?.colorScheme?.success || '#10b981' }
          ].map(({ key, label, color }) => (
            <div key={key} className="text-center">
              <div 
                className="w-12 h-12 rounded-full mx-auto mb-1 border-2 border-white shadow-sm"
                style={{ backgroundColor: color }}
              ></div>
              <div className="text-xs text-gray-600">{label}</div>
              <div className="text-xs font-mono text-gray-500">{color}</div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Primary Font</span>
          <Badge variant="outline" style={{ fontFamily: settings.theme?.typography?.primaryFont || 'Inter' }}>
            {settings.theme?.typography?.primaryFont || 'Inter'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Base Font Size</span>
          <Badge variant="outline">
            {settings.theme?.typography?.fontSize?.base || '16px'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Max Width</span>
          <Badge variant="outline">
            {settings.theme?.layout?.maxWidth || '1200px'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Border Radius</span>
          <Badge variant="outline">
            {settings.theme?.layout?.borderRadius || '8px'}
          </Badge>
        </div>
      </div>

      {/* Typography Preview */}
      <div className="border rounded-lg p-4 bg-white">
        <div 
          className="space-y-2"
          style={{ 
            fontFamily: settings.theme?.typography?.primaryFont || 'Inter',
            fontSize: settings.theme?.typography?.fontSize?.base || '16px',
            color: settings.theme?.colorScheme?.text || '#1f2937'
          }}
        >
          <h3 
            className="text-xl font-bold" 
            style={{ color: settings.theme?.colorScheme?.primary || '#2563eb' }}
          >
            Sample Heading
          </h3>
          <p className="text-sm">
            This is how your text will appear with the selected typography settings.
          </p>
          <button 
            className="px-4 py-2 rounded text-white text-sm"
            style={{ 
              backgroundColor: settings.theme?.colorScheme?.primary || '#2563eb',
              borderRadius: settings.theme?.layout?.borderRadius || '8px'
            }}
          >
            Sample Button
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdvancedPreview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Caching Enabled</span>
          <div className="flex items-center">
            {settings.advanced?.caching?.enabled !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Compression Enabled</span>
          <div className="flex items-center">
            {settings.advanced?.compression?.enabled !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">CSRF Protection</span>
          <div className="flex items-center">
            {settings.advanced?.security?.csrfProtection !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Rate Limiting</span>
          <div className="flex items-center">
            {settings.advanced?.security?.rateLimiting?.enabled !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {settings.advanced?.caching?.enabled !== false && (
          <div className="bg-green-50 p-3 rounded">
            <div className="text-sm font-medium text-green-800">Cache TTL</div>
            <div className="text-sm text-green-600">
              {settings.advanced?.caching?.ttl || 300} seconds
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderMaintenancePreview = () => (
    <div className="space-y-4">
      {settings.maintenance?.isMaintenanceMode && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Settings className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-orange-800">Maintenance Mode Active</span>
          </div>
          <p className="text-sm text-orange-700">
            {settings.maintenance.maintenanceMessage || 'We are currently performing maintenance. Please check back soon.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Maintenance Mode</span>
          <div className="flex items-center">
            {settings.maintenance?.isMaintenanceMode ? (
              <Badge variant="destructive">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Auto Backup</span>
          <div className="flex items-center">
            {settings.maintenance?.autoBackup?.enabled !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {settings.maintenance?.autoBackup?.enabled !== false && (
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-sm font-medium text-blue-800">Backup Schedule</div>
            <div className="text-sm text-blue-600 capitalize">
              {settings.maintenance?.autoBackup?.frequency || 'weekly'}
              {' '}(retained for {settings.maintenance?.autoBackup?.retention || 30} days)
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const getSectionContent = () => {
    switch (section) {
      case 'general': return renderGeneralPreview();
      case 'booking': return renderBookingPreview();
      case 'payment': return renderPaymentPreview();
      case 'seo': return renderSEOPreview();
      case 'integrations': return renderIntegrationsPreview();
      case 'theme': return renderThemePreview();
      case 'advanced': return renderAdvancedPreview();
      case 'maintenance': return renderMaintenancePreview();
      default: return <div className="text-center text-gray-500">Preview not available</div>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700 mb-3">
        {section.charAt(0).toUpperCase() + section.slice(1)} Preview
      </div>
      {getSectionContent()}
    </div>
  );
}