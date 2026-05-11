import React, { useState, useEffect, useRef} from 'react';
import { useLanguageDetection } from '../../hooks/useLanguageDetection';
import { useLocalization } from '../../context/LocalizationContext';
import { cn } from '../../utils/cn';
import { Globe, X, Check, AlertCircle, Loader2 } from 'lucide-react';

interface LanguageDetectionBannerProps {
  className?: string;
  autoHideDurationMs?: number;
  showConfidenceScore?: boolean;
  onLanguageAccept?: (language: string) => void;
  onLanguageReject?: (language: string) => void;
}

export const LanguageDetectionBanner: React.FC<LanguageDetectionBannerProps> = ({
  className,
  autoHideDurationMs = 10000, // Auto-hide after 10 seconds
  showConfidenceScore = true,
  onLanguageAccept,
  onLanguageReject
}) => {
  const { currentLanguage, setLanguage, getLanguageNames } = useLocalization();
  const {
    detectedLanguage,
    confidence,
    source,
    isDetecting,
    error,
    setUserLanguagePreference,
    isLanguageSupported,
    getBestFallback
  } = useLanguageDetection();

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show banner when language is detected and different from current
  const isVisibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const shouldShow = detectedLanguage && 
                      detectedLanguage !== currentLanguage &&
                      confidence > 0.6 &&
                      !error &&
                      !isDetecting;

    if (shouldShow) {
      setIsVisible(true);
      setIsAnimating(true);

      // Set auto-hide timer
      if (autoHideDurationMs > 0) {
        if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = setTimeout(() => {
          handleDismiss();
        }, autoHideDurationMs);
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [detectedLanguage, currentLanguage, confidence, error, isDetecting, autoHideDurationMs]);

  const handleAcceptLanguage = () => {
    if (!detectedLanguage) return;

    let targetLanguage = detectedLanguage;

    // Check if language is supported
    if (!isLanguageSupported(detectedLanguage)) {
      targetLanguage = getBestFallback(detectedLanguage);
    }

    setUserLanguagePreference(targetLanguage);
    setLanguage(targetLanguage);
    onLanguageAccept?.(targetLanguage);
    handleDismiss();
  };

  const handleRejectLanguage = () => {
    if (detectedLanguage) {
      onLanguageReject?.(detectedLanguage);
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsAnimating(false);
    if (isVisibleTimerRef.current) clearTimeout(isVisibleTimerRef.current);
    isVisibleTimerRef.current = setTimeout(() => setIsVisible(false), 300); // Wait for animation to complete
    
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      setAutoHideTimer(null);
    }
  };

  const getLanguageName = (code: string): string => {
    const names = getLanguageNames();
    return names[code] || code;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'text-green-600';
    if (confidence > 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'browser':
        return '🌐';
      case 'location':
        return '📍';
      case 'text':
        return '📝';
      case 'user':
        return '👤';
      default:
        return '🔍';
    }
  };

  if (isDetecting) {
    return (
      <div className={cn("fixed top-4 right-4 max-w-md z-50", className)}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm text-gray-600">Detecting language...</span>
        </div>
      </div>
    );
  }

  if (!isVisible || !detectedLanguage) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-4 right-4 max-w-md z-50 transition-all duration-300 transform",
        isAnimating ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
        className
      )}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">
              <Globe className="w-5 h-5 text-blue-500" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-gray-900">
                  Language Detected
                </h4>
                {showConfidenceScore && (
                  <span className={cn("text-xs font-medium", getConfidenceColor(confidence))}>
                    {Math.round(confidence * 100)}%
                  </span>
                )}
              </div>
              
              <p className="text-sm text-gray-600 mb-3">
                We detected you might prefer{' '}
                <span className="font-medium">{getLanguageName(detectedLanguage)}</span>
                {source && (
                  <span className="text-gray-500">
                    {' '}(via {getSourceIcon(source)} {source})
                  </span>
                )}
              </p>

              {!isLanguageSupported(detectedLanguage) && (
                <div className="flex items-center gap-1 mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                  <AlertCircle className="w-3 h-3" />
                  <span>
                    {getLanguageName(detectedLanguage)} isn't fully supported. 
                    We'll use {getLanguageName(getBestFallback(detectedLanguage))} instead.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAcceptLanguage}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Switch Language
                </button>
                
                <button
                  onClick={handleRejectLanguage}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Keep Current
                </button>
              </div>
            </div>
          </div>
          
          <button aria-label="Close"
            onClick={handleDismiss}
            className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageDetectionBanner;