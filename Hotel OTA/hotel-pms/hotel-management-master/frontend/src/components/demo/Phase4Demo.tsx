import React, { useState, useEffect } from 'react';
import { useLanguageDetection } from '../../hooks/useLanguageDetection';
import { useAutoTranslation } from '../../hooks/useAutoTranslation';
import { useLocalization } from '../../context/LocalizationContext';
import RealTimeTranslator from '../ui/RealTimeTranslator';
import TranslatedInput from '../ui/TranslatedInput';
import LanguageDetectionBanner from '../ui/LanguageDetectionBanner';
import LanguageSelector from '../ui/LanguageSelector';
import { cn } from '../../utils/cn';
import { 
  Languages, 
  Zap, 
  Globe, 
  MessageSquare, 
  Settings, 
  BarChart3,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface DemoSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export const Phase4Demo: React.FC = () => {
  const { currentLanguage, availableLanguages } = useLocalization();
  const { 
    detectedLanguage, 
    confidence, 
    source, 
    isDetecting, 
    detectLanguage,
    clearDetectionCache 
  } = useLanguageDetection();
  
  const { 
    translationStats, 
    isTranslating, 
    clearCache,
    preloadTranslations,
    refreshStats 
  } = useAutoTranslation();

  const [activeSection, setActiveSection] = useState<string>('detection');
  const [sampleText, setSampleText] = useState('Hello, this is a sample text for real-time translation!');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const demoSections: DemoSection[] = [
    {
      id: 'detection',
      title: 'Language Detection',
      description: 'Automatic language detection from browser, location, and text',
      icon: <Globe className="w-5 h-5" />
    },
    {
      id: 'realtime',
      title: 'Real-Time Translation',
      description: 'Live text translation with caching and optimization',
      icon: <Zap className="w-5 h-5" />
    },
    {
      id: 'forms',
      title: 'Smart Form Translation',
      description: 'Auto-translating form inputs with debouncing',
      icon: <MessageSquare className="w-5 h-5" />
    },
    {
      id: 'analytics',
      title: 'Translation Analytics',
      description: 'Performance metrics and cache statistics',
      icon: <BarChart3 className="w-5 h-5" />
    }
  ];

  // Preload common translations on mount
  useEffect(() => {
    const commonTexts = [
      'Hello',
      'Welcome',
      'Thank you',
      'Please wait',
      'Loading...',
      'Error occurred',
      'Success!',
      'Name',
      'Email',
      'Message'
    ];
    
    const languages = ['ES', 'FR', 'DE', 'ZH'];
    preloadTranslations(commonTexts, languages);
  }, [preloadTranslations]);

  const handleFormChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const renderDetectionSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            Current Detection Status
          </h4>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Current Language:</span>
              <span className="font-medium">{currentLanguage?.name || 'Not set'}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Detected Language:</span>
              <span className="font-medium">{detectedLanguage || 'None'}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Confidence:</span>
              <span className={cn(
                "font-medium",
                confidence > 0.8 ? "text-green-600" : 
                confidence > 0.6 ? "text-yellow-600" : "text-red-600"
              )}>
                {confidence ? `${Math.round(confidence * 100)}%` : '0%'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Detection Source:</span>
              <span className="font-medium capitalize">{source || 'None'}</span>
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <button aria-label="Refresh"
              onClick={detectLanguage}
              disabled={isDetecting}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDetecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Detect Language
                </>
              )}
            </button>
            
            <button
              onClick={clearDetectionCache}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Clear Detection Cache
            </button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Languages className="w-4 h-4 text-green-500" />
            Language Selector
          </h4>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select a language to see auto-translation in action:
            </p>
            
            <LanguageSelector 
              variant="dropdown"
              showFlags={true}
              className="w-full"
            />
            
            <div className="text-xs text-gray-500">
              Available: {availableLanguages.length} languages
            </div>
          </div>
        </div>
      </div>
      
      <LanguageDetectionBanner 
        showConfidenceScore={true}
        onLanguageAccept={() => {}}
        onLanguageReject={() => {}}
      />
    </div>
  );

  const renderRealTimeSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          Real-Time Text Translation
        </h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Input Text (English):
            </label>
            <textarea
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              className="w-full p-3 border rounded-md resize-none"
              rows={3}
              placeholder="Enter text to translate..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto-Translated Output ({currentLanguage?.code || 'EN'}):
            </label>
            <RealTimeTranslator
              text={sampleText}
              showDetectedLanguage={true}
              showTranslationStats={true}
              enableLanguageDetection={true}
              className="w-full"
              onTranslationChange={(translated) => {
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFormsSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-500" />
          Smart Form Translation
        </h4>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Form inputs are automatically translated as you type. Try entering text in different languages:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name:
              </label>
              <TranslatedInput
                value={formData.name}
                onChange={handleFormChange('name')}
                placeholder="Enter your name..."
                showTranslationIndicator={true}
                enableRealTimeTranslation={true}
                translationKey="form-name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email:
              </label>
              <TranslatedInput
                type="email"
                value={formData.email}
                onChange={handleFormChange('email')}
                placeholder="Enter your email..."
                showTranslationIndicator={true}
                enableRealTimeTranslation={true}
                translationKey="form-email"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message:
            </label>
            <textarea
              value={formData.message}
              onChange={handleFormChange('message')}
              className="w-full p-3 border rounded-md resize-none"
              rows={4}
              placeholder="Enter your message..."
            />
          </div>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <h5 className="font-medium mb-2">Form Data Preview:</h5>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnalyticsSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          Translation Analytics
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {translationStats.cacheSize}
            </div>
            <div className="text-sm text-blue-600">Cached Translations</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {translationStats.cacheHitRate.toFixed(1)}%
            </div>
            <div className="text-sm text-green-600">Cache Hit Rate</div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {translationStats.pendingTranslations}
            </div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {translationStats.queueLength}
            </div>
            <div className="text-sm text-purple-600">Queue Length</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Translation Status:</span>
            <span className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              isTranslating ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
            )}>
              {isTranslating ? 'Active' : 'Idle'}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={refreshStats}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Stats
            </button>
            
            <button
              onClick={clearCache}
              className="px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'detection':
        return renderDetectionSection();
      case 'realtime':
        return renderRealTimeSection();
      case 'forms':
        return renderFormsSection();
      case 'analytics':
        return renderAnalyticsSection();
      default:
        return renderDetectionSection();
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Phase 4: Real-Time Language Detection & Auto-Translation
        </h1>
        <p className="text-gray-600">
          Experience intelligent language detection, real-time translation, and advanced caching mechanisms.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 space-y-2">
          {demoSections.map((section) => (
            <button aria-label="Favorite"
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full p-4 rounded-lg text-left transition-colors",
                "flex items-start gap-3 hover:bg-gray-50",
                activeSection === section.id
                  ? "bg-blue-50 border border-blue-200 text-blue-700"
                  : "bg-white border border-gray-200 text-gray-700"
              )}
            >
              <div className="mt-0.5">{section.icon}</div>
              <div>
                <div className="font-medium">{section.title}</div>
                <div className="text-xs text-gray-500 mt-1">{section.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Phase4Demo;