import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import favoritesService from '../../services/favoritesService';

interface FavoriteButtonProps {
  offerId: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  offerId,
  size = 'md',
  showTooltip = true,
  className = ''
}) => {
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);

  // Check if offer is in favorites
  const { data: favoriteData, isLoading } = useQuery({
    queryKey: ['favorite-status', offerId],
    queryFn: () => favoritesService.checkIsFavorite(offerId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isFavorite = favoriteData?.data?.isFavorite || false;
  const favoriteId = favoriteData?.data?.favorite?._id;

  // Add to favorites mutation
  const addToFavoritesMutation = useMutation({
    mutationFn: (data: { offerId: string; notifyOnExpiry?: boolean; notifyOnUpdate?: boolean }) =>
      favoritesService.addToFavorites(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-status', offerId] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteStats'] });
      toast.success('Added to favorites! ❤️');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to add to favorites');
    }
  });

  // Remove from favorites mutation - FIX: remove by offerId since backend DELETE /:id tries both
  const removeFromFavoritesMutation = useMutation({
    mutationFn: (id: string) => favoritesService.removeFromFavorites(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-status', offerId] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteStats'] });
      toast.success('Removed from favorites');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to remove from favorites');
    }
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isFavorite) {
      // Use favoriteId if available, otherwise fall back to offerId
      removeFromFavoritesMutation.mutate(favoriteId || offerId);
    } else {
      addToFavoritesMutation.mutate({
        offerId,
        notifyOnExpiry: true,
        notifyOnUpdate: false
      });
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-4 w-4';
      case 'lg':
        return 'h-6 w-6';
      default:
        return 'h-5 w-5';
    }
  };

  const getButtonClasses = () => {
    const baseClasses = 'relative flex items-center justify-center rounded-full transition-all duration-200';
    
    switch (size) {
      case 'sm':
        return `${baseClasses} p-1`;
      case 'lg':
        return `${baseClasses} p-3`;
      default:
        return `${baseClasses} p-2`;
    }
  };

  const isPending = addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending;

  if (isLoading) {
    return (
      <div className={`${getButtonClasses()} ${className} cursor-not-allowed opacity-50`}>
        <div className={`${getSizeClasses()} animate-pulse bg-gray-300 rounded`} />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isPending}
        className={`
          ${getButtonClasses()}
          ${className}
          ${isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          ${isFavorite 
            ? 'bg-red-50 hover:bg-red-100 text-red-600' 
            : 'bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-red-500'
          }
          group
        `}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        {isPending ? (
          <div className={`${getSizeClasses()} animate-spin border-2 border-current border-t-transparent rounded-full`} />
        ) : (
          <Heart 
            className={`
              ${getSizeClasses()} 
              transition-all duration-200
              ${isFavorite ? 'fill-current text-red-500' : 'group-hover:scale-110'}
            `} 
          />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && isHovered && !isPending && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
          {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

export default FavoriteButton;