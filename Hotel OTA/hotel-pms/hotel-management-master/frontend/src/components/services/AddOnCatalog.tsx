import React, { useState, useMemo } from 'react';
import { Search, ShoppingBag, IndianRupee } from 'lucide-react';

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

interface AddOnCatalogProps {
  services: AddOnService[];
  onServiceBook: (serviceId: string, bookingDetails: Record<string, unknown>) => void;
}

const getCategoryBadgeClass = (category: string): string => {
  const map: Record<string, string> = {
    dining: 'bg-orange-100 text-orange-800',
    spa: 'bg-pink-100 text-pink-800',
    fitness: 'bg-green-100 text-green-800',
    transportation: 'bg-blue-100 text-blue-800',
    entertainment: 'bg-purple-100 text-purple-800',
    business: 'bg-gray-100 text-gray-800',
    laundry: 'bg-yellow-100 text-yellow-800',
    childcare: 'bg-teal-100 text-teal-800',
    tours: 'bg-indigo-100 text-indigo-800',
    technology: 'bg-cyan-100 text-cyan-800',
  };
  return map[category] || 'bg-gray-100 text-gray-800';
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

export default function AddOnCatalog({ services, onServiceBook }: AddOnCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const unique = Array.from(new Set(services.map((s) => s.category))).sort();
    return unique;
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (activeCategory !== 'all' && service.category !== activeCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          service.name.toLowerCase().includes(term) ||
          service.description?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [services, activeCategory, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Search services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            activeCategory === 'all'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 text-sm rounded-full border capitalize transition-colors ${
              activeCategory === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Service Cards Grid */}
      {filteredServices.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <div
              key={service._id}
              className="border border-gray-200 rounded-lg p-5 flex flex-col justify-between hover:shadow-lg transition-shadow bg-white"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                    {service.name}
                  </h3>
                  <span
                    className={`ml-2 flex-shrink-0 px-2 py-0.5 text-xs rounded-full capitalize ${getCategoryBadgeClass(
                      service.category
                    )}`}
                  >
                    {service.category.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Description */}
                {service.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {service.description}
                  </p>
                )}

                {/* Price */}
                <div className="flex items-center gap-1 mb-3">
                  <IndianRupee className="h-4 w-4 text-green-600" />
                  <span className="text-xl font-bold text-gray-900">
                    {formatPrice(service.pricing.basePrice)}
                  </span>
                </div>

                {/* Availability */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.availability.isAvailable ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm text-gray-600">
                    {service.availability.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>

              {/* Book Button */}
              <button
                onClick={() =>
                  onServiceBook(service._id, { serviceId: service._id, name: service.name })
                }
                disabled={!service.availability.isAvailable}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  service.availability.isAvailable
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Book
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16">
          <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
          <p className="text-gray-600">
            {searchTerm || activeCategory !== 'all'
              ? 'Try adjusting your search or category filter.'
              : 'There are no services available in the catalog yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
