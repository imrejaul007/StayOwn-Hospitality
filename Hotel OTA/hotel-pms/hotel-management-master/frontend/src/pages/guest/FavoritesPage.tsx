import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Settings, Star, Calendar, Gift, X, Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import favoritesService, { FavoriteOffer } from '../../services/favoritesService';
import BackButton from '../../components/ui/BackButton';
import ErrorAlert, { parseErrorToLoyaltyError } from '../../components/ui/ErrorAlert';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const FavoritesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<number>(-1);
  const [page, setPage] = useState<number>(1);
  const [editingFavorite, setEditingFavorite] = useState<FavoriteOffer | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const { data: favoritesData, isLoading } = useQuery({
    queryKey: ['favorites', { page, category: selectedCategory, type: selectedType, sortBy, sortOrder }],
    queryFn: () => favoritesService.getFavorites({
      page,
      limit: 12,
      category: selectedCategory || undefined,
      type: selectedType || undefined,
      sortBy,
      sortOrder
    })
  });

  const { data: statsData } = useQuery({
    queryKey: ['favoriteStats'],
    queryFn: () => favoritesService.getFavoriteStats()
  });

  const removeFromFavoritesMutation = useMutation({
    mutationFn: (favoriteId: string) => favoritesService.removeFromFavorites(favoriteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteStats'] });
      toast.success('Removed from favorites');
      setActionError(null);
    },
    onError: (error: unknown) => {
      setActionError(error);
      const loyaltyError = parseErrorToLoyaltyError(error);
      toast.error(loyaltyError.message);
    }
  });

  const updateFavoriteMutation = useMutation({
    mutationFn: ({ favoriteId, data }: { favoriteId: string; data: Record<string, unknown> }) => 
      favoritesService.updateFavorite(favoriteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      setEditingFavorite(null);
      setActionError(null);
      toast.success('Favorite settings updated');
    },
    onError: (error: unknown) => {
      setActionError(error);
      const loyaltyError = parseErrorToLoyaltyError(error);
      toast.error(loyaltyError.message);
    }
  });

  const handleRemove = (favoriteId: string) => setConfirmRemoveId(favoriteId);

  const confirmRemove = () => {
    if (!confirmRemoveId) return;
    removeFromFavoritesMutation.mutate(confirmRemoveId);
    setConfirmRemoveId(null);
  };

  const handleUpdateSettings = (data: {
    notifyOnExpiry: boolean;
    notifyOnUpdate: boolean;
    notes: string;
  }) => {
    if (editingFavorite) {
      updateFavoriteMutation.mutate({
        favoriteId: editingFavorite._id,
        data
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'room': return '🏨';
      case 'dining': return '🍽️';
      case 'spa': return '🧖‍♀️';
      case 'transport': return '🚗';
      default: return '🎁';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'discount': return 'bg-green-100 text-green-800';
      case 'free_service': return 'bg-blue-100 text-blue-800';
      case 'upgrade': return 'bg-purple-100 text-purple-800';
      case 'bonus_points': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedType, sortBy, sortOrder]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const favorites = favoritesData?.data?.favorites || [];
  const pagination = favoritesData?.data?.pagination;
  const stats = statsData?.data;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <BackButton 
              to="/app/loyalty" 
              label="Back to Loyalty Dashboard" 
            />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Heart className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl font-bold text-gray-900">My Favorites</h1>
          </div>

          {/* Error Alert */}
          {actionError && (
            <div className="mb-6">
              <ErrorAlert 
                error={parseErrorToLoyaltyError(actionError)}
                onDismiss={() => setActionError(null)}
                className="max-w-2xl"
              />
            </div>
          )}
          
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{stats.totalFavorites}</div>
                <div className="text-sm text-gray-600">Total Favorites</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-green-600">{stats.avgPointsRequired}</div>
                <div className="text-sm text-gray-600">Avg Points Required</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.keys(stats.categoryBreakdown).length}
                </div>
                <div className="text-sm text-gray-600">Categories</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">{stats.daysSinceFavoriting}</div>
                <div className="text-sm text-gray-600">Days Since First Favorite</div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="room">Room</option>
                <option value="dining">Dining</option>
                <option value="spa">Spa</option>
                <option value="transport">Transport</option>
                <option value="general">General</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="discount">Discount</option>
                <option value="free_service">Free Service</option>
                <option value="upgrade">Upgrade</option>
                <option value="bonus_points">Bonus Points</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="createdAt">Date Added</option>
                <option value="offerName">Offer Name</option>
                <option value="pointsRequired">Points Required</option>
                <option value="validUntil">Expiry Date</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={-1}>Descending</option>
                <option value={1}>Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Favorites Grid */}
        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No favorites yet</h3>
            <p className="text-gray-600">Start adding offers to your favorites to see them here!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => (
              <div key={favorite._id} className="bg-white rounded-lg border hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getCategoryIcon(favorite.offer.category)}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(favorite.offer.type)}`}>
                        {favorite.offer.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button aria-label="Edit favorite settings"
                        onClick={() => setEditingFavorite(favorite)}
                        className="p-2 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button aria-label="Remove from favorites"
                        onClick={() => handleRemove(favorite._id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{favorite.offer.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{favorite.offer.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      {favorite.offer.pointsRequired} points
                    </div>
                    {favorite.offer.validUntil && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(favorite.offer.validUntil).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {favorite.notifyOnExpiry && (
                      <div className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        <span>Expiry alerts</span>
                      </div>
                    )}
                    {favorite.notifyOnUpdate && (
                      <div className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        <span>Update alerts</span>
                      </div>
                    )}
                  </div>

                  {favorite.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      {favorite.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrev}
              className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNext}
              className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Edit Favorite Modal */}
      {editingFavorite && (
        <EditFavoriteModal
          favorite={editingFavorite}
          onClose={() => setEditingFavorite(null)}
          onSave={handleUpdateSettings}
          isLoading={updateFavoriteMutation.isPending}
        />
      )}

      {/* Remove Confirmation Dialog */}
      {confirmRemoveId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Remove Favorite</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove this offer from favorites?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmRemoveId(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface EditFavoriteModalProps {
  favorite: FavoriteOffer;
  onClose: () => void;
  onSave: (data: { notifyOnExpiry: boolean; notifyOnUpdate: boolean; notes: string }) => void;
  isLoading: boolean;
}

const EditFavoriteModal: React.FC<EditFavoriteModalProps> = ({
  favorite,
  onClose,
  onSave,
  isLoading
}) => {
  const [notifyOnExpiry, setNotifyOnExpiry] = useState(favorite.notifyOnExpiry);
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(favorite.notifyOnUpdate);
  const [notes, setNotes] = useState(favorite.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ notifyOnExpiry, notifyOnUpdate, notes });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Edit Favorite Settings</h2>
          <button aria-label="Close favorite settings dialog"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">{favorite.offer.title}</h3>
            <p className="text-sm text-gray-600">{favorite.offer.description}</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifyOnExpiry}
                onChange={(e) => setNotifyOnExpiry(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium">Expiry Notifications</div>
                <div className="text-sm text-gray-500">Get notified when this offer is about to expire</div>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifyOnUpdate}
                onChange={(e) => setNotifyOnUpdate(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium">Update Notifications</div>
                <div className="text-sm text-gray-500">Get notified when this offer is updated</div>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Personal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add a personal note about why you favorited this offer..."
            />
            <div className="text-xs text-gray-500 mt-1">{notes.length}/200 characters</div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button aria-label="Save favorite settings"
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default withErrorBoundary(FavoritesPage);