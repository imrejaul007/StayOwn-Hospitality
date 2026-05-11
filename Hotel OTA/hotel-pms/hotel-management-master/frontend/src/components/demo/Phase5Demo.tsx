import React, { useState } from 'react';
import OTAChannelManager from '../admin/OTAChannelManager';
import { cn } from '../../utils/cn';
import { 
  Globe, 
  IndianRupee, 
  Languages, 
  Activity,
  BarChart3,
  Settings,
  AlertTriangle,
  CheckCircle,
  Zap,
  TrendingUp,
  Users
} from 'lucide-react';

interface DemoSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'management' | 'distribution' | 'translation' | 'monitoring';
}

export const Phase5Demo: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [selectedHotel] = useState('demo-hotel-123');

  const demoSections: DemoSection[] = [
    {
      id: 'overview',
      title: 'OTA Channel Overview',
      description: 'Comprehensive dashboard showing all channel integrations and performance',
      icon: <Globe className="w-5 h-5" />,
      category: 'management'
    },
    {
      id: 'channel-config',
      title: 'Channel Configuration',
      description: 'Multi-language and multi-currency settings for each OTA platform',
      icon: <Settings className="w-5 h-5" />,
      category: 'management'
    },
    {
      id: 'rate-distribution',
      title: 'Currency Rate Distribution',
      description: 'Automated rate conversion and distribution across channels',
      icon: <IndianRupee className="w-5 h-5" />,
      category: 'distribution'
    },
    {
      id: 'content-translation',
      title: 'Automated Content Translation',
      description: 'AI-powered content optimization for different OTA platforms',
      icon: <Languages className="w-5 h-5" />,
      category: 'translation'
    },
    {
      id: 'performance-monitoring',
      title: 'Real-Time Monitoring',
      description: 'Live performance metrics, alerts, and health monitoring',
      icon: <Activity className="w-5 h-5" />,
      category: 'monitoring'
    },
    {
      id: 'analytics',
      title: 'Advanced Analytics',
      description: 'Business insights, translation quality, and ROI analysis',
      icon: <BarChart3 className="w-5 h-5" />,
      category: 'monitoring'
    }
  ];

  const categoryColors = {
    management: 'bg-blue-50 text-blue-700 border-blue-200',
    distribution: 'bg-green-50 text-green-700 border-green-200',
    translation: 'bg-purple-50 text-purple-700 border-purple-200',
    monitoring: 'bg-orange-50 text-orange-700 border-orange-200'
  };

  const mockChannelData = {
    summary: {
      channels: { total: 8, connected: 7, connectionRate: 87.5 },
      sync: { totalSyncs: 1247, successRate: 94.2, averageResponseTime: 1234 },
      translation: { totalTranslations: 2891, averageQuality: 87.3 },
      errors: { total: 23, critical: 2, errorRate: 1.8 }
    },
    channels: [
      {
        channelId: 'booking_com',
        channelName: 'Booking.com',
        status: {
          isActive: true,
          connectionStatus: 'connected' as const,
          lastSync: {
            rates: '2024-01-15T10:30:00Z',
            inventory: '2024-01-15T10:25:00Z',
            content: '2024-01-15T09:15:00Z'
          }
        },
        languageSettings: {
          primaryLanguage: 'EN',
          supportedLanguages: [
            { languageCode: 'EN', isActive: true, translationQuality: 'native' },
            { languageCode: 'ES', isActive: true, translationQuality: 'professional' },
            { languageCode: 'FR', isActive: true, translationQuality: 'automatic' },
            { languageCode: 'DE', isActive: true, translationQuality: 'reviewed' }
          ],
          autoTranslate: true
        },
        currencySettings: {
          baseCurrency: 'USD',
          supportedCurrencies: [
            { currencyCode: 'USD', isActive: true, markup: 0 },
            { currencyCode: 'EUR', isActive: true, markup: 2.5 },
            { currencyCode: 'GBP', isActive: true, markup: 1.8 }
          ],
          autoConvert: true
        },
        performance: {
          averageResponseTime: 1150,
          uptimePercentage: 99.2,
          translationAccuracy: 91.5
        },
        syncHealthScore: 95
      },
      {
        channelId: 'expedia',
        channelName: 'Expedia',
        status: {
          isActive: true,
          connectionStatus: 'connected' as const,
          lastSync: {
            rates: '2024-01-15T10:28:00Z',
            inventory: '2024-01-15T10:20:00Z',
            content: '2024-01-15T08:45:00Z'
          }
        },
        languageSettings: {
          primaryLanguage: 'EN',
          supportedLanguages: [
            { languageCode: 'EN', isActive: true, translationQuality: 'native' },
            { languageCode: 'ES', isActive: true, translationQuality: 'automatic' },
            { languageCode: 'ZH', isActive: true, translationQuality: 'professional' }
          ],
          autoTranslate: true
        },
        currencySettings: {
          baseCurrency: 'USD',
          supportedCurrencies: [
            { currencyCode: 'USD', isActive: true, markup: 0 },
            { currencyCode: 'CAD', isActive: true, markup: 1.2 }
          ],
          autoConvert: true
        },
        performance: {
          averageResponseTime: 890,
          uptimePercentage: 98.7,
          translationAccuracy: 88.3
        },
        syncHealthScore: 92
      },
      {
        channelId: 'airbnb',
        channelName: 'Airbnb',
        status: {
          isActive: true,
          connectionStatus: 'error' as const,
          lastSync: {
            rates: '2024-01-15T09:15:00Z',
            inventory: '2024-01-15T09:10:00Z',
            content: '2024-01-15T08:30:00Z'
          }
        },
        languageSettings: {
          primaryLanguage: 'EN',
          supportedLanguages: [
            { languageCode: 'EN', isActive: true, translationQuality: 'native' },
            { languageCode: 'ES', isActive: true, translationQuality: 'automatic' }
          ],
          autoTranslate: true
        },
        currencySettings: {
          baseCurrency: 'USD',
          supportedCurrencies: [
            { currencyCode: 'USD', isActive: true, markup: 0 }
          ],
          autoConvert: false
        },
        performance: {
          averageResponseTime: 2340,
          uptimePercentage: 94.1,
          translationAccuracy: 85.2
        },
        syncHealthScore: 78
      }
    ],
    alerts: [
      {
        type: 'connection_error',
        severity: 'high',
        message: 'Airbnb connection failed - authentication timeout',
        timestamp: '2024-01-15T10:15:00Z'
      },
      {
        type: 'translation_quality',
        severity: 'medium',
        message: 'Translation quality below threshold for German content on Booking.com',
        timestamp: '2024-01-15T09:45:00Z'
      }
    ]
  };

  const renderFeatureShowcase = () => {
    return (
      <div className="space-y-8">
        {/* Feature Overview */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 border">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Phase 5: Advanced Channel Management & OTA Integration
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Enterprise-grade OTA integration with intelligent multi-language content translation, 
              currency-specific rate distribution, and comprehensive monitoring across all channels.
            </p>
          </div>

          {/* Key Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg border text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Multi-Channel</h3>
              <p className="text-sm text-gray-600">
                10+ OTA platforms with unified management
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <IndianRupee className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Pricing</h3>
              <p className="text-sm text-gray-600">
                Automated currency conversion with custom markups
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Languages className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">AI Translation</h3>
              <p className="text-sm text-gray-600">
                Channel-optimized content in 25+ languages
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Live Monitoring</h3>
              <p className="text-sm text-gray-600">
                Real-time sync health and performance metrics
              </p>
            </div>
          </div>
        </div>

        {/* Live Demo Section */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Live OTA Channel Manager</h3>
                <p className="text-gray-600 mt-1">
                  Interactive demonstration with live data simulation
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
                  Live Demo
                </span>
              </div>
            </div>
          </div>
          
          {/* Inject mock data into OTAChannelManager */}
          <div className="p-6">
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                <Zap className="w-4 h-4" />
                Demo Features Active
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Real-time channel status monitoring</li>
                <li>• Multi-currency rate distribution simulation</li>
                <li>• Automated content translation preview</li>
                <li>• Performance metrics and alerts</li>
              </ul>
            </div>
            
            {/* This would normally get real data from an API */}
            <OTAChannelManager 
              hotelId={selectedHotel}
              className="min-h-96"
            />
          </div>
        </div>

        {/* Technical Architecture Overview */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Technical Architecture</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-500" />
                Backend Services
              </h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Channel Configuration Management</li>
                <li>• Rate Distribution Service</li>
                <li>• OTA Content Translation Service</li>
                <li>• Real-time Monitoring Service</li>
                <li>• Multi-currency Exchange Engine</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-green-500" />
                Frontend Components
              </h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• OTA Channel Manager Dashboard</li>
                <li>• Real-time Performance Monitoring</li>
                <li>• Translation Quality Analytics</li>
                <li>• Currency Distribution Controls</li>
                <li>• Alert Management System</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                Key Features
              </h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• 10+ OTA Platform Integration</li>
                <li>• 25+ Language Support</li>
                <li>• 50+ Currency Auto-Conversion</li>
                <li>• Real-time Sync Health Monitoring</li>
                <li>• AI-Powered Content Optimization</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">94.2%</div>
            <div className="text-sm font-medium text-gray-900 mb-1">Sync Success Rate</div>
            <div className="text-xs text-gray-500">Across all channels</div>
          </div>

          <div className="bg-white rounded-lg border p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">87.3%</div>
            <div className="text-sm font-medium text-gray-900 mb-1">Translation Quality</div>
            <div className="text-xs text-gray-500">Average confidence score</div>
          </div>

          <div className="bg-white rounded-lg border p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">1.2s</div>
            <div className="text-sm font-medium text-gray-900 mb-1">Response Time</div>
            <div className="text-xs text-gray-500">Average across all channels</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Demo Mode Banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
        <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
          <AlertTriangle className="w-4 h-4" />
          Demo Mode - Showing sample data
        </div>
        <p className="text-amber-700 text-sm mt-1">
          This is a demonstration component and is not connected to live data. All values shown are illustrative examples only.
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Phase 5 Demo: Advanced Channel Management
            </h1>
            <p className="text-gray-600">
              Enterprise OTA integration with intelligent localization and real-time monitoring
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(
            demoSections.reduce((acc, section) => {
              if (!acc[section.category]) acc[section.category] = 0;
              acc[section.category]++;
              return acc;
            }, {} as Record<string, number>)
          ).map(([category, count]) => (
            <span
              key={category}
              className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border",
                categoryColors[category as keyof typeof categoryColors]
              )}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
            </span>
          ))}
        </div>
      </div>

      {renderFeatureShowcase()}
    </div>
  );
};

export default Phase5Demo;