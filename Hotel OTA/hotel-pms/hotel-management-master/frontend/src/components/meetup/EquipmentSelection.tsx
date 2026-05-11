import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Monitor,
  Wifi,
  Coffee,
  Camera,
  Mic,
  Laptop,
  PresentationChart,
  Users,
  DollarSign,
  Clock,
  Plus,
  Minus,
  Info,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import roomBookingService, { Equipment, Service, BookingCost } from '../../services/roomBookingService';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../LoadingSpinner';
import toast from 'react-hot-toast';

interface EquipmentSelectionProps {
  hotelId: string;
  duration: number; // in minutes
  participants: number;
  selectedEquipment: string[];
  selectedServices: string[];
  onEquipmentChange: (equipment: string[]) => void;
  onServicesChange: (services: string[]) => void;
  onCostChange?: (cost: BookingCost) => void;
  className?: string;
}

export default function EquipmentSelection({
  hotelId,
  duration,
  participants,
  selectedEquipment,
  selectedServices,
  onEquipmentChange,
  onServicesChange,
  onCostChange,
  className = ''
}: EquipmentSelectionProps) {
  const [activeTab, setActiveTab] = useState<'equipment' | 'services'>('equipment');
  const [estimatedCost, setEstimatedCost] = useState<BookingCost | null>(null);

  // Fetch available equipment
  const {
    data: equipment,
    isLoading: equipmentLoading,
    error: equipmentError
  } = useQuery<Equipment[]>({
    queryKey: ['equipment', hotelId],
    queryFn: () => roomBookingService.getAvailableEquipment(hotelId),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Fetch available services
  const {
    data: services,
    isLoading: servicesLoading,
    error: servicesError
  } = useQuery<Service[]>({
    queryKey: ['services', hotelId],
    queryFn: () => roomBookingService.getAvailableServices(hotelId),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Calculate cost estimate when selections change
  const {
    data: costEstimate,
    isLoading: costLoading,
    refetch: refetchCost
  } = useQuery<BookingCost>({
    queryKey: ['booking-cost', hotelId, duration, selectedEquipment, selectedServices, participants],
    queryFn: () => roomBookingService.calculateBookingCost(
      hotelId,
      duration / 60, // Convert minutes to hours
      selectedEquipment,
      selectedServices,
      participants
    ),
    enabled: !!hotelId && duration > 0,
    staleTime: 30 * 1000 // 30 seconds
  });

  useEffect(() => {
    if (costEstimate) {
      setEstimatedCost(costEstimate);
      onCostChange?.(costEstimate);
    }
  }, [costEstimate, onCostChange]);

  const handleEquipmentToggle = (equipmentId: string) => {
    const newSelection = selectedEquipment.includes(equipmentId)
      ? selectedEquipment.filter(id => id !== equipmentId)
      : [...selectedEquipment, equipmentId];

    onEquipmentChange(newSelection);
  };

  const handleServiceToggle = (serviceId: string) => {
    const newSelection = selectedServices.includes(serviceId)
      ? selectedServices.filter(id => id !== serviceId)
      : [...selectedServices, serviceId];

    onServicesChange(newSelection);
  };

  const getEquipmentIcon = (equipmentId: string) => {
    const icons: Record<string, unknown> = {
      'projector': Monitor,
      'whiteboard': PresentationChart,
      'flipchart': PresentationChart,
      'sound_system': Mic,
      'video_conference': Camera,
      'laptop': Laptop
    };
    return icons[equipmentId] || Monitor;
  };

  const getServiceIcon = (serviceId: string) => {
    const icons: Record<string, unknown> = {
      'basic_refreshments': Coffee,
      'business_lunch': Users,
      'welcome_drinks': Coffee,
      'stationery_kit': PresentationChart,
      'photographer': Camera,
      'concierge_support': Users
    };
    return icons[serviceId] || Coffee;
  };

  const calculateItemCost = (item: Equipment | Service, isEquipment: boolean) => {
    if (isEquipment) {
      const equipment = item as Equipment;
      return equipment.costPerHour * (duration / 60);
    } else {
      const service = item as Service;
      if (service.costPerHour) {
        return service.costPerHour * (duration / 60);
      } else if (service.costPerPerson) {
        return service.costPerPerson * participants;
      }
    }
    return 0;
  };

  const isServiceDisabled = (service: Service) => {
    if (service.minPeople && participants < service.minPeople) {
      return true;
    }
    if (service.minDuration && duration < (service.minDuration * 60)) {
      return true;
    }
    return false;
  };

  const getServiceDisabledReason = (service: Service) => {
    if (service.minPeople && participants < service.minPeople) {
      return `Minimum ${service.minPeople} participants required`;
    }
    if (service.minDuration && duration < (service.minDuration * 60)) {
      return `Minimum ${service.minDuration} hour(s) duration required`;
    }
    return '';
  };

  const isLoading = equipmentLoading || servicesLoading;
  const hasError = equipmentError || servicesError;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Additional Equipment & Services</h3>
          <p className="text-sm text-gray-600">
            Enhance your meet-up with professional equipment and services
          </p>
        </div>
        {estimatedCost && (
          <div className="text-right">
            <div className="text-sm text-gray-600">Estimated Total</div>
            <div className="text-xl font-bold text-gray-900">
              {roomBookingService.formatCurrency(estimatedCost.total)}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('equipment')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'equipment'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Monitor className="w-4 h-4 inline mr-2" />
            Equipment
            {selectedEquipment.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-800 py-0.5 px-2 rounded-full text-xs">
                {selectedEquipment.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'services'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Coffee className="w-4 h-4 inline mr-2" />
            Services
            {selectedServices.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-800 py-0.5 px-2 rounded-full text-xs">
                {selectedServices.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : hasError ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load options</h3>
            <p className="text-gray-600">Please try refreshing the page</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Equipment Tab */}
          {activeTab === 'equipment' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipment?.map((item) => {
                const IconComponent = getEquipmentIcon(item.id);
                const isSelected = selectedEquipment.includes(item.id);
                const itemCost = calculateItemCost(item, true);

                return (
                  <Card
                    key={item.id}
                    className={`p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    } ${!item.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => item.available && handleEquipmentToggle(item.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-xs text-gray-600">{item.description}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {roomBookingService.formatCurrency(item.costPerHour)}/hour
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {roomBookingService.formatCurrency(itemCost)}
                        </div>
                        <div className="text-xs text-gray-500">total</div>
                      </div>
                    </div>

                    {!item.available && (
                      <div className="mt-2 text-xs text-red-600 font-medium">
                        Currently unavailable
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'services' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services?.map((item) => {
                const IconComponent = getServiceIcon(item.id);
                const isSelected = selectedServices.includes(item.id);
                const isDisabled = isServiceDisabled(item);
                const disabledReason = getServiceDisabledReason(item);
                const itemCost = calculateItemCost(item, false);

                return (
                  <Card
                    key={item.id}
                    className={`p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isDisabled
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    } ${!item.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => item.available && !isDisabled && handleServiceToggle(item.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-xs text-gray-600">{item.description}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {item.costPerHour
                            ? `${roomBookingService.formatCurrency(item.costPerHour)}/hour`
                            : `${roomBookingService.formatCurrency(item.costPerPerson || 0)}/person`
                          }
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {roomBookingService.formatCurrency(itemCost)}
                        </div>
                        <div className="text-xs text-gray-500">total</div>
                      </div>
                    </div>

                    {!item.available && (
                      <div className="mt-2 text-xs text-red-600 font-medium">
                        Currently unavailable
                      </div>
                    )}

                    {isDisabled && disabledReason && (
                      <div className="mt-2 text-xs text-orange-600 font-medium">
                        {disabledReason}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cost Breakdown */}
      {estimatedCost && (
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">Cost Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Room ({roomBookingService.formatDuration(duration)})</span>
              <span className="font-medium">
                {roomBookingService.formatCurrency(estimatedCost.baseRoom)}
              </span>
            </div>
            {estimatedCost.equipment > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Equipment</span>
                <span className="font-medium">
                  {roomBookingService.formatCurrency(estimatedCost.equipment)}
                </span>
              </div>
            )}
            {estimatedCost.services > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Services</span>
                <span className="font-medium">
                  {roomBookingService.formatCurrency(estimatedCost.services)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">
                {roomBookingService.formatCurrency(estimatedCost.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax (18% GST)</span>
              <span className="font-medium">
                {roomBookingService.formatCurrency(estimatedCost.tax)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">
                {roomBookingService.formatCurrency(estimatedCost.total)}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}