import React, { useState, useEffect } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  Plus,
  Search,
  Filter,
  Star,
  IndianRupee,
  Users,
  TrendingUp,
  Edit,
  Trash2,
  Eye,
  Settings,
  ShoppingBag,
  Award,
  MapPin,
  Clock,
  BarChart3
} from 'lucide-react';
import AddOnCatalog from '../../components/services/AddOnCatalog';
import InclusionManager from '../../components/services/InclusionManager';
import UpsellManager from '../../components/services/UpsellManager';
import { addOnServicesService } from '../../services/addOnServicesService';
import { useToast } from '../../hooks/useToast';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

interface AddOnService {
  _id: string;
  serviceId: string;
  name: string;
  description: string;
  category: string;
  type: string;
  pricing: {
    basePrice: number;
    baseCurrency: string;
  };
  availability: {
    isAvailable: boolean;
    maxQuantityPerBooking: number;
  };
  analytics: {
    totalBookings: number;
    totalRevenue: number;
    averageRating: number;
    popularityScore: number;
  };
  isActive: boolean;
  isFeatured: boolean;
  location: {
    venue?: string;
    isOffsite: boolean;
  };
}

interface ServiceCategory {
  category: string;
  serviceCount: number;
  averagePrice: number;
  averageRating: number;
  totalRevenue: number;
  displayName: string;
}

const AdminAddOnServices: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [activeTab, setActiveTab] = useState<'services' | 'catalog' | 'inclusions' | 'upsell' | 'analytics'>('services');
  const [services, setServices] = useState<AddOnService[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<AddOnService | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [filters, setFilters] = useState({
    priceRange: { min: '', max: '' },
    rating: '',
    availability: 'all',
    location: 'all'
  });
  const { showToast } = useToast();

  // Early return if no property selected in single property mode
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Services', 'Add-on Services']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to manage add-on services</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (selectedPropertyId) {
      loadData();
    }
  }, [selectedCategory, searchTerm, selectedPropertyId, currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [servicesRes, categoriesRes] = await Promise.all([
        addOnServicesService.getServices({
          hotelId: selectedPropertyId,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          search: searchTerm || undefined,
          page: currentPage,
          limit: 20,
        }),
        addOnServicesService.getCategories({ hotelId: selectedPropertyId })
      ]);

      const servicesData = servicesRes.data?.services || servicesRes.data || [];
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setPagination({
        total: servicesRes.data?.pagination?.total || servicesData.length || 0,
        pages: servicesRes.data?.pagination?.pages || 1
      });
      setCategories(categoriesRes.data || []);
    } catch (error: unknown) {
      showToast('Error loading services data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (serviceData: Partial<AddOnService>) => {
    try {
      await addOnServicesService.createService({ ...serviceData, hotelId: selectedPropertyId });
      showToast('Service created successfully', 'success');
      setShowCreateModal(false);
      loadData();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleUpdateService = async (id: string, serviceData: Partial<AddOnService>) => {
    try {
      await addOnServicesService.updateService(id, serviceData);
      showToast('Service updated successfully', 'success');
      setShowEditModal(false);
      setSelectedService(null);
      loadData();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
      await addOnServicesService.deleteService(id);
      showToast('Service deleted successfully', 'success');
      loadData();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      dining: '🍽️',
      spa: '🧘',
      fitness: '💪',
      transportation: '🚗',
      entertainment: '🎭',
      business: '💼',
      laundry: '👕',
      childcare: '👶',
      pet_services: '🐕',
      concierge: '🛎️',
      tours: '🗺️',
      shopping: '🛍️',
      medical: '⚕️',
      technology: '💻',
      other: '🏨'
    };
    return icons[category as keyof typeof icons] || '🏨';
  };

  const getServiceTypeColor = (type: string) => {
    const colors = {
      once: 'bg-blue-100 text-blue-800',
      per_night: 'bg-green-100 text-green-800',
      per_person: 'bg-purple-100 text-purple-800',
      per_hour: 'bg-orange-100 text-orange-800',
      per_unit: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const filteredServices = services.filter(service => {
    if (searchTerm && !service.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !service.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    if (filters.rating && service.analytics.averageRating < parseFloat(filters.rating)) {
      return false;
    }
    
    if (filters.availability !== 'all' && 
        ((filters.availability === 'available' && !service.availability.isAvailable) ||
         (filters.availability === 'unavailable' && service.availability.isAvailable))) {
      return false;
    }
    
    if (filters.location !== 'all' &&
        ((filters.location === 'onsite' && service.location.isOffsite) ||
         (filters.location === 'offsite' && !service.location.isOffsite))) {
      return false;
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Services', 'Add-on Services']} />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add-on Services Management</h1>
          <p className="text-gray-600 mt-2">Manage hotel services, inclusions, and upsell opportunities</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ShoppingBag className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Services</p>
              <p className="text-2xl font-bold text-gray-900">{services.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <IndianRupee className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${services.reduce((sum, s) => sum + s.analytics.totalRevenue, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">
                {services.reduce((sum, s) => sum + s.analytics.totalBookings, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average Rating</p>
              <p className="text-2xl font-bold text-gray-900">
                {services.length > 0 ? 
                  (services.reduce((sum, s) => sum + s.analytics.averageRating, 0) / services.length).toFixed(1) : 
                  '0.0'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'services', label: 'Services', icon: ShoppingBag },
              { key: 'catalog', label: 'Service Catalog', icon: Eye },
              { key: 'inclusions', label: 'Inclusions', icon: Award },
              { key: 'upsell', label: 'Upsell Manager', icon: TrendingUp },
              { key: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map(({ key, label, icon: Icon }) => (
              <button aria-label="Close"
                key={key}
                onClick={() => setActiveTab(key as unknown)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'services' && (
            <div className="space-y-6">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search services..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.category} value={cat.category}>
                        {cat.displayName} ({cat.serviceCount})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={filters.availability}
                    onChange={(e) => setFilters({...filters, availability: e.target.value})}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Availability</option>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                  
                  <select
                    value={filters.location}
                    onChange={(e) => setFilters({...filters, location: e.target.value})}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Locations</option>
                    <option value="onsite">On-site</option>
                    <option value="offsite">Off-site</option>
                  </select>
                </div>
              </div>

              {/* Services Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((service) => (
                  <div key={service._id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getCategoryIcon(service.category)}</div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{service.name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${getServiceTypeColor(service.type)}`}>
                            {service.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        {service.isFeatured && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        )}
                        <div className="flex space-x-1">
                          <button aria-label="Edit"
                            onClick={() => {
                              setSelectedService(service);
                              setShowEditModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button aria-label="Delete"
                            onClick={() => handleDeleteService(service._id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {service.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <IndianRupee className="h-4 w-4 text-green-600" />
                        <span>${service.pricing.basePrice}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span>{service.analytics.totalBookings} bookings</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Star className="h-4 w-4 text-yellow-600" />
                        <span>{service.analytics.averageRating.toFixed(1)} rating</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-purple-600" />
                        <span>{service.location.isOffsite ? 'Off-site' : 'On-site'}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          service.availability.isAvailable ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className="text-sm text-gray-600">
                          {service.availability.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        Max: {service.availability.maxQuantityPerBooking}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredServices.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || selectedCategory !== 'all' ? 
                      "Try adjusting your search criteria." :
                      "Get started by creating your first add-on service."
                    }
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Service</span>
                  </button>
                </div>
              )}

              {/* Pagination Controls */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6 px-4">
                  <p className="text-sm text-gray-600">
                    Showing page {currentPage} of {pagination.pages} ({pagination.total} total)
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                      disabled={currentPage >= pagination.pages}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'catalog' && (
            <AddOnCatalog
              services={services}
              onServiceBook={(serviceId, bookingDetails) => {
                showToast('Service booking functionality will be implemented', 'info');
              }}
            />
          )}

          {activeTab === 'inclusions' && (
            <InclusionManager 
              onUpdate={loadData}
            />
          )}

          {activeTab === 'upsell' && (
            <UpsellManager 
              services={services}
              onUpdate={loadData}
            />
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Service Analytics</h3>
              
              {/* Category Performance */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Performance by Category</h4>
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getCategoryIcon(category.category)}</span>
                        <div>
                          <div className="font-medium">{category.displayName}</div>
                          <div className="text-sm text-gray-600">{category.serviceCount} services</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-semibold">${category.totalRevenue.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">
                          Avg: ${category.averagePrice.toFixed(2)} | {category.averageRating.toFixed(1)}★
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Top Performing Services */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Top Performing Services</h4>
                <div className="space-y-2">
                  {services
                    .sort((a, b) => b.analytics.totalRevenue - a.analytics.totalRevenue)
                    .slice(0, 5)
                    .map((service, index) => (
                      <div key={service._id} className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3">
                          <div className="text-sm font-medium text-gray-500">#{index + 1}</div>
                          <div>
                            <div className="font-medium">{service.name}</div>
                            <div className="text-sm text-gray-600">{service.analytics.totalBookings} bookings</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${service.analytics.totalRevenue.toLocaleString()}</div>
                          <div className="text-sm text-gray-600">{service.analytics.averageRating.toFixed(1)}★</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(AdminAddOnServices);