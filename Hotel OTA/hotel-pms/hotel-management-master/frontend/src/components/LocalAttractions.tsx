import React, { useState, useEffect } from 'react';
import { cn } from '../utils/cn';
import { attractionsService, LocalAttraction } from '../services/attractionsService';
import { LoadingSpinner } from './LoadingSpinner';
import { Card } from './ui/card';

interface LocalAttractionsProps {
  hotelId: string;
  maxDistance?: number;
  className?: string;
}

type TabKey = 'amenities' | 'dining' | 'attractions';

const TABS = [
  { key: 'amenities' as TabKey, label: 'Amenities', icon: '🏨' },
  { key: 'dining' as TabKey, label: 'Dining', icon: '🍽️' },
  { key: 'attractions' as TabKey, label: 'Local Attractions', icon: '🎯' },
] as const;

export function LocalAttractions({ 
  hotelId, 
  maxDistance = 10, 
  className 
}: LocalAttractionsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('amenities');
  const [attractions, setAttractions] = useState<Record<TabKey, LocalAttraction[]>>({
    amenities: [],
    dining: [],
    attractions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAttractions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load attractions for each tab category
        const [amenities, dining, localAttractions] = await Promise.all([
          attractionsService.getAttractionsByCategory(hotelId, 'amenities', maxDistance),
          attractionsService.getAttractionsByCategory(hotelId, 'dining', maxDistance),
          attractionsService.getAttractionsByCategory(hotelId, 'attractions', maxDistance),
        ]);

        setAttractions({
          amenities,
          dining,
          attractions: localAttractions,
        });
      } catch (err) {
        setError('Failed to load attractions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (hotelId) {
      loadAttractions();
    }
  }, [hotelId, maxDistance]);

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">⚠️</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </Card>
    );
  }

  const currentAttractions = attractions[activeTab] || [];

  return (
    <Card className={cn('w-full', className)}>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button aria-label="Close"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-3 px-4 text-sm font-medium transition-colors relative',
              'hover:text-blue-600',
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            )}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {currentAttractions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🏨</div>
            <p className="text-gray-500">
              No {TABS.find(t => t.key === activeTab)?.label.toLowerCase()} found nearby.
            </p>
          </div>
        ) : (
          currentAttractions.map((attraction) => (
            <AttractionCard key={attraction._id} attraction={attraction} />
          ))
        )}
      </div>
    </Card>
  );
}

interface AttractionCardProps {
  attraction: LocalAttraction;
}

function AttractionCard({ attraction }: AttractionCardProps) {
  const walkingTime = attractionsService.calculateWalkingTime(attraction.distance);
  
  return (
    <div className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200">
      {/* Icon/Image */}
      <div className="flex-shrink-0">
        {attraction.imageUrl ? (
          <img
            src={attraction.imageUrl}
            alt={attraction.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
            <span className="text-xl">
              {attractionsService.getCategoryIcon(attraction.category)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {attraction.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {attraction.description}
            </p>
          </div>
          
          {/* Distance and Location Button */}
          <div className="flex-shrink-0 ml-4 text-right">
            <div className="text-xs text-gray-500">
              {attraction.distanceText}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {walkingTime}
            </div>
            {(attraction.coordinates?.lat && attraction.coordinates?.lng) && (
              <button aria-label="View"
                className="mt-2 p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                onClick={() => {
                  // Open Google Maps with the coordinates
                  const url = `https://www.google.com/maps?q=${attraction.coordinates.lat},${attraction.coordinates.lng}`;
                  window.open(url, '_blank');
                }}
                title="View on map"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center space-x-2">
            {/* Rating */}
            {attraction.rating && (
              <div className="flex items-center text-xs text-yellow-600">
                <span className="mr-1">⭐</span>
                <span>{attraction.rating.toFixed(1)}</span>
              </div>
            )}
            
            {/* Phone */}
            {attraction.phone && (
              <a
                href={`tel:${attraction.phone}`}
                className="text-xs text-blue-600 hover:text-blue-800"
                title="Call"
              >
                📞
              </a>
            )}
            
            {/* Website */}
            {attraction.website && (
              <a
                href={attraction.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800"
                title="Visit website"
              >
                🌐
              </a>
            )}
          </div>

          {/* Opening hours indicator */}
          <div className="text-xs text-gray-400">
            {getOpeningStatus(attraction.openingHours)}
          </div>
        </div>
      </div>
    </div>
  );
}

function getOpeningStatus(openingHours: LocalAttraction['openingHours']): string {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[now.getDay()] as keyof typeof openingHours;
  const todayHours = openingHours[today];
  
  if (!todayHours || todayHours.toLowerCase() === 'closed') {
    return 'Closed today';
  }
  
  if (todayHours === '24 hours') {
    return 'Open 24h';
  }
  
  // Simple check - in a real app you'd parse the time and check if currently open
  return 'Open today';
}

export default LocalAttractions;