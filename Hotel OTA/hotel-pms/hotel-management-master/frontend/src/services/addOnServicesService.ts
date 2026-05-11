import { api } from './api';

export const addOnServicesService = {
  // Primary list method (with pagination support)
  getAddOnServices: (params?: Record<string, unknown>) => api.get('/add-on-services', { params }).then(r => r.data),
  getAddOnServiceById: (id: string) => api.get(`/add-on-services/${id}`).then(r => r.data),
  createAddOnService: (data: Record<string, unknown>) => api.post('/add-on-services', data).then(r => r.data),
  updateAddOnService: (id: string, data: Record<string, unknown>) => api.put(`/add-on-services/${id}`, data).then(r => r.data),
  deleteAddOnService: (id: string) => api.delete(`/add-on-services/${id}`).then(r => r.data),

  // Aliases used by AdminAddOnServices.tsx
  getServices: (params?: Record<string, unknown>) => api.get('/add-on-services', { params }).then(r => r.data),
  getCategories: (params?: Record<string, unknown>) => api.get('/add-on-services/categories', { params }).then(r => r.data),
  createService: (data: Record<string, unknown>) => api.post('/add-on-services', data).then(r => r.data),
  updateService: (id: string, data: Record<string, unknown>) => api.put(`/add-on-services/${id}`, data).then(r => r.data),
  deleteService: (id: string) => api.delete(`/add-on-services/${id}`).then(r => r.data),

  // Additional endpoints
  getFeaturedServices: (params?: Record<string, unknown>) => api.get('/add-on-services/featured', { params }).then(r => r.data),
  getUpsellRecommendations: (params?: Record<string, unknown>) => api.get('/add-on-services/upsell-recommendations', { params }).then(r => r.data),
  getServiceAnalytics: (serviceId: string) => api.get(`/add-on-services/${serviceId}/analytics`).then(r => r.data),
  checkAvailability: (serviceId: string, params?: Record<string, unknown>) => api.get(`/add-on-services/${serviceId}/availability`, { params }).then(r => r.data),
  getServicePricing: (serviceId: string, params?: Record<string, unknown>) => api.get(`/add-on-services/${serviceId}/pricing`, { params }).then(r => r.data),
  bookService: (serviceId: string, data: Record<string, unknown>) => api.post(`/add-on-services/${serviceId}/book`, data).then(r => r.data),

  // Inclusions
  getInclusions: (params?: Record<string, unknown>) => api.get('/add-on-services/inclusions/list', { params }).then(r => r.data),
  getPackageInclusions: (packageId: string) => api.get(`/add-on-services/inclusions/package/${packageId}`).then(r => r.data),
  redeemInclusion: (id: string, data: Record<string, unknown>) => api.post(`/add-on-services/inclusions/${id}/redeem`, data).then(r => r.data),
  createInclusion: (data: Record<string, unknown>) => api.post('/add-on-services/inclusions', data).then(r => r.data),
  updateInclusion: (id: string, data: Record<string, unknown>) => api.put(`/add-on-services/inclusions/${id}`, data).then(r => r.data),

  // Bulk operations
  bulkCreateServices: (data: Record<string, unknown>) => api.post('/add-on-services/bulk', data).then(r => r.data),
};
