import React, { useState, useEffect, useCallback } from 'react';
import { useAutoTranslation } from '../../hooks/useAutoTranslation';
import { useLanguageDetection } from '../../hooks/useLanguageDetection';
import { useLocalization } from '../../context/LocalizationContext';
import { cn } from '../../utils/cn';
import { Loader2, Globe, Settings, RefreshCw, BarChart3, X } from 'lucide-react';

interface RealTimeTranslatorProps {
  text: string;
  onTranslationChange?: (translatedText: string) => void;
  className?: string;
  placeholder?: string;
  showDetectedLanguage?: boolean;
  showTranslationStats?: boolean;
  enableLanguageDetection?: boolean;
  debounceMs?: number;
}

export const RealTimeTranslator: React.FC<RealTimeTranslatorProps> = ({
  text,
  onTranslationChange,
  className,
  placeholder = "Text will be translated automatically...",
  showDetectedLanguage = true,
  showTranslationStats = false,
  enableLanguageDetection = true,
  debounceMs = 500
}) => {
  const { currentLanguage } = useLocalization();
  const { translateWithDebounce, isTranslating, error, translationStats, clearCache } = useAutoTranslation({
    enableRealTime: true,
    debounceMs
  });
  
  const { 
    detectTextLanguage, 
    detectedLanguage, 
    confidence, 
    source,
    isDetecting 
  } = useLanguageDetection({
    enableTextDetection: enableLanguageDetection,
    debounceMs
  });

  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Auto-translate text when it changes
  useEffect(() => {
    if (!text || text.trim().length === 0) {
      setTranslatedText('');
      setSourceLanguage(null);
      onTranslationChange?.('');
      return;
    }

    const performTranslation = async () => {
      try {
        // Detect source language if enabled
        let detectedLang = sourceLanguage;
        if (enableLanguageDetection) {
          const detected = await detectTextLanguage(text);
          if (detected) {
            detectedLang = detected;
            setSourceLanguage(detected);
          }
        }

        // Translate text
        const translated = await translateWithDebounce(
          text,
          `realtime-${Date.now()}`,
          currentLanguage,
          detectedLang || undefined
        );

        setTranslatedText(translated);
        onTranslationChange?.(translated);
      } catch (error) {
        setTranslatedText(text); // Fallback to original text
        onTranslationChange?.(text);
      }
    };

    performTranslation();
  }, [
    text,
    currentLanguage,
    translateWithDebounce,
    detectTextLanguage,
    enableLanguageDetection,
    sourceLanguage,
    onTranslationChange
  ]);

  const handleClearCache = useCallback(() => {
    clearCache();
  }, [clearCache]);

  const renderLanguageInfo = () => {
    if (!showDetectedLanguage || !sourceLanguage) return null;

    const confidenceColor = confidence > 0.8 ? 'text-green-600' : 
                            confidence > 0.6 ? 'text-yellow-600' : 'text-red-600';

    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Globe className="w-3 h-3" />
        <span>Detected: {sourceLanguage}</span>
        <span className={cn("font-medium", confidenceColor)}>
          ({Math.round(confidence * 100)}% confidence)
        </span>
        <span className="text-gray-400">via {source}</span>
      </div>
    );
  };

  const renderTranslationStats = () => {
    if (!showTranslationStats) return null;

    return (
      <div className={cn(
        "absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg p-4 z-50 min-w-80",
        showStats ? "block" : "hidden"
      )}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Translation Statistics</h4>
          <button aria-label="Close"
            onClick={() => setShowStats(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Cache Size</div>
            <div className="font-medium">{translationStats.cacheSize}</div>
          </div>
          <div>
            <div className="text-gray-500">Hit Rate</div>
            <div className="font-medium">{translationStats.cacheHitRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-gray-500">Pending</div>
            <div className="font-medium">{translationStats.pendingTranslations}</div>
          </div>
          <div>
            <div className="text-gray-500">Queue</div>
            <div className="font-medium">{translationStats.queueLength}</div>
          </div>
        </div>
        
        <button
          onClick={handleClearCache}
          className="mt-3 w-full px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
        >
          Clear Cache
        </button>
      </div>
    );
  };

  const renderControls = () => {
    if (!showTranslationStats) return null;

    return (
      <div className="flex items-center gap-1 mb-2">
        <button aria-label="Close"
          onClick={() => setShowStats(!showStats)}
          className={cn(
            "p-1.5 text-xs rounded hover:bg-gray-100 transition-colors",
            showStats ? "bg-gray-100 text-blue-600" : "text-gray-500"
          )}
          title="Translation Statistics"
        >
          <BarChart3 className="w-3 h-3" />
        </button>
        
        <button aria-label="Refresh"
          onClick={handleClearCache}
          className="p-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
          title="Clear Translation Cache"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <div className={cn("relative", className)}>
      {renderControls()}
      {renderLanguageInfo()}
      
      <div className="relative">
        <div className={cn(
          "w-full p-3 border rounded-md bg-gray-50 min-h-[100px]",
          (isTranslating || isDetecting) && "opacity-75"
        )}>
          {(isTranslating || isDetecting) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isDetecting ? 'Detecting language...' : 'Translating...'}
              </div>
            </div>
          )}
          
          {translatedText ? (
            <p className="text-gray-900 whitespace-pre-wrap">{translatedText}</p>
          ) : (
            <p className="text-gray-500 italic">{placeholder}</p>
          )}
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            <div className="flex items-center gap-2">
              <X className="w-4 h-4" />
              <span>Translation Error: {error}</span>
            </div>
          </div>
        )}
      </div>

      {renderTranslationStats()}
    </div>
  );
};

export default RealTimeTranslator;