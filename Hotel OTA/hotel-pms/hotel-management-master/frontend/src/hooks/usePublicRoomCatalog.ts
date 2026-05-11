import { useQuery } from '@tanstack/react-query';
import { fetchPublicRoomTypeOptions } from '../services/publicRoomCatalogService';

export function usePublicRoomCatalog(hotelId: string) {
  return useQuery({
    queryKey: ['public-room-type-options', hotelId],
    queryFn: () => fetchPublicRoomTypeOptions(hotelId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
