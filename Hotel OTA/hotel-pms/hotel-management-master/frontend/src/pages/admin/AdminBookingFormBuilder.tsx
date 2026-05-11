import React, { useState, useEffect, useCallback, useRef } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Grid, List, FileText, Eye, Edit, Copy, Trash2, BarChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import FormBuilder from '../../components/web/FormBuilder';
import FormPreview from '../../components/web/FormPreview';
import { bookingFormService, BookingFormTemplate } from '../../services/bookingFormService';

const AdminBookingFormBuilder: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const [templates, setTemplates] = useState<BookingFormTemplate[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<BookingFormTemplate | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 12
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Read filter values from URL search params (single source of truth)
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const categoryFilter = searchParams.get('category') || 'all';
  const currentPage = searchParams.get('page') || '1';

  // Fetch templates whenever URL params or property changes
  useEffect(() => {
    if (selectedPropertyId) {
      loadTemplates();
    }
  }, [searchParams, selectedPropertyId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);

      const params = {
        page: currentPage,
        limit: '12',
        search: searchTerm,
        status: statusFilter,
        category: categoryFilter,
        sortBy: searchParams.get('sortBy') || 'updatedAt',
        sortOrder: searchParams.get('sortOrder') || 'desc'
      };

      const response = await bookingFormService.getTemplates(params);

      if (response.success && response.data) {
        setTemplates(response.data.templates);
        setPagination(response.data.pagination);
      } else {
        toast.error('Failed to load form templates');
      }
    } catch (error) {
      toast.error('Failed to load form templates');
    } finally {
      setLoading(false);
    }
  };

  // Update URL params (triggers re-fetch via useEffect)
  const updateParams = useCallback((updates: Record<string, string>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== '1' && value !== '') {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });
      // Reset to page 1 when filters change (unless page is being changed directly)
      if (!('page' in updates)) {
        newParams.delete('page');
      }
      return newParams;
    });
  }, [setSearchParams]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ search: value });
    }, 400);
  }, [updateParams]);

  const handleStatusChange = useCallback((value: string) => {
    updateParams({ status: value });
  }, [updateParams]);

  const handleCategoryChange = useCallback((value: string) => {
    updateParams({ category: value });
  }, [updateParams]);

  const handlePageChange = useCallback((page: number) => {
    updateParams({ page: String(page) });
  }, [updateParams]);

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setShowFormBuilder(true);
  };

  const handleEditTemplate = (template: BookingFormTemplate) => {
    setSelectedTemplate(template);
    setShowFormBuilder(true);
  };

  const handlePreviewTemplate = (template: BookingFormTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleDuplicateTemplate = async (template: BookingFormTemplate) => {
    try {
      const newName = `${template.name} (Copy)`;
      const response = await bookingFormService.duplicateTemplate(template._id, { name: newName });

      if (response.success) {
        toast.success('Template duplicated successfully');
        loadTemplates();
      } else {
        toast.error('Failed to duplicate template');
      }
    } catch (error) {
      toast.error('Failed to duplicate template');
    }
  };

  const handleDeleteTemplate = async (template: BookingFormTemplate) => {
    if (!window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      const response = await bookingFormService.deleteTemplate(template._id);
      if (response.success) {
        toast.success('Template deleted successfully');
        loadTemplates();
      } else {
        toast.error('Failed to delete template');
      }
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleViewAnalytics = (template: BookingFormTemplate) => {
    toast('Analytics dashboard coming soon', { icon: '📊' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'booking':
        return 'bg-blue-100 text-blue-800';
      case 'inquiry':
        return 'bg-purple-100 text-purple-800';
      case 'registration':
        return 'bg-indigo-100 text-indigo-800';
      case 'survey':
        return 'bg-pink-100 text-pink-800';
      case 'custom':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (showFormBuilder) {
    return (
      <FormBuilder
        template={selectedTemplate}
        onSave={() => {
          setShowFormBuilder(false);
          setSelectedTemplate(null);
          loadTemplates();
          toast.success(`Template ${selectedTemplate ? 'updated' : 'created'} successfully`);
        }}
        onCancel={() => {
          setShowFormBuilder(false);
          setSelectedTemplate(null);
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Booking Forms']} />

      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Booking Form Builder</h1>
          <p className="text-sm sm:text-base text-gray-600">Create and manage custom booking forms</p>
        </div>
        <Button onClick={handleCreateTemplate} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="sm:hidden">Create</span>
          <span className="hidden sm:inline">Create Form</span>
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search templates..."
                  defaultValue={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-40 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full sm:w-40 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="booking">Booking</SelectItem>
                  <SelectItem value="inquiry">Inquiry</SelectItem>
                  <SelectItem value="registration">Registration</SelectItem>
                  <SelectItem value="survey">Survey</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex rounded-lg border">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="text-xs"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="text-xs"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {templates.map((template) => (
                <Card key={template._id} className="hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-200">
                  <CardHeader className="pb-3 sm:pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 mb-2 break-words">
                          {template.name || 'Untitled Form'}
                        </CardTitle>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
                          {template.description || 'No description provided'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge className={`${getStatusColor(template.status)} text-xs font-medium`}>
                        {template.status}
                      </Badge>
                      <Badge className={`${getCategoryColor(template.category)} text-xs font-medium`}>
                        {template.category}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 py-2 sm:py-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="font-semibold text-gray-700 text-sm sm:text-base">{template.fieldCount ?? template.fields?.length ?? 0}</div>
                        <div className="text-xs">Fields</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-700 text-sm sm:text-base">{template.usage?.views || 0}</div>
                        <div className="text-xs">Views</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreviewTemplate(template)}
                        className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 text-xs sm:text-sm"
                      >
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="sm:hidden">Preview</span>
                        <span className="hidden sm:inline">Preview Form</span>
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditTemplate(template)}
                          className="justify-start hover:bg-green-50 hover:border-green-300 text-xs"
                          title="Edit Template"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicateTemplate(template)}
                          className="justify-start hover:bg-purple-50 hover:border-purple-300 text-xs"
                          title="Duplicate Template"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewAnalytics(template)}
                          className="justify-start hover:bg-orange-50 hover:border-orange-300 text-xs"
                          title="View Analytics"
                        >
                          <BarChart className="w-3 h-3 mr-1" />
                          Stats
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTemplate(template)}
                          className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300 text-xs"
                          title="Delete Template"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm">Name</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm hidden sm:table-cell">Category</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm">Status</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm hidden md:table-cell">Fields</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm hidden lg:table-cell">Views</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm hidden lg:table-cell">Updated</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((template) => (
                        <tr key={template._id} className="border-b border-gray-100">
                          <td className="py-3 px-2 sm:px-4">
                            <div>
                              <div className="font-medium text-sm sm:text-base">{template.name}</div>
                              <div className="text-xs sm:text-sm text-gray-500 truncate max-w-xs">
                                {template.description}
                              </div>
                              <div className="sm:hidden mt-1">
                                <Badge className={`${getCategoryColor(template.category)} text-xs`}>
                                  {template.category}
                                </Badge>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 sm:px-4 hidden sm:table-cell">
                            <Badge className={`${getCategoryColor(template.category)} text-xs`}>
                              {template.category}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 sm:px-4">
                            <Badge className={`${getStatusColor(template.status)} text-xs`}>
                              {template.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 sm:px-4 hidden md:table-cell text-xs sm:text-sm">{template.fieldCount ?? template.fields?.length ?? 0}</td>
                          <td className="py-3 px-2 sm:px-4 hidden lg:table-cell text-xs sm:text-sm">{template.usage?.views || 0}</td>
                          <td className="py-3 px-2 sm:px-4 hidden lg:table-cell text-xs sm:text-sm text-gray-500">
                            {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-2 sm:px-4">
                            <div className="flex gap-1 sm:gap-2">
                              <Button size="sm" variant="outline" onClick={() => handlePreviewTemplate(template)} className="text-xs" title="Preview">
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleEditTemplate(template)} className="text-xs" title="Edit">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDuplicateTemplate(template)} className="text-xs" title="Duplicate">
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleViewAnalytics(template)} className="text-xs" title="Analytics">
                                <BarChart className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteTemplate(template)} className="text-xs text-red-600 hover:text-red-700" title="Delete">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 sm:mt-6">
              <p className="text-xs sm:text-sm text-gray-600">
                Showing {templates.length} of {pagination.total} {pagination.total === 1 ? 'template' : 'templates'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.current <= 1}
                  onClick={() => handlePageChange(pagination.current - 1)}
                  className="text-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs sm:text-sm text-gray-700">
                  Page {pagination.current} of {pagination.pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.current >= pagination.pages}
                  onClick={() => handlePageChange(pagination.current + 1)}
                  className="text-xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {templates.length === 0 && (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="text-center py-8 sm:py-12">
                <FileText className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No templates found</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 max-w-md mx-auto px-4">
                  {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                    ? 'No templates match your current filters. Try adjusting your search criteria or clearing filters.'
                    : 'Create your first booking form template to start collecting guest information and bookings.'}
                </p>
                {(!searchTerm && statusFilter === 'all' && categoryFilter === 'all') ? (
                  <Button onClick={handleCreateTemplate} className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-lg px-4 sm:px-6 py-2 sm:py-3">
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="sm:hidden">Create First Template</span>
                    <span className="hidden sm:inline">Create Your First Form Template</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => setSearchParams({})}
                    variant="outline"
                    className="text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Form Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Preview: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription className="text-sm">
              Preview how this form will appear to users
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedTemplate && (
              <FormPreview template={selectedTemplate} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default withErrorBoundary(AdminBookingFormBuilder);
