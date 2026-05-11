import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw, 
  Filter,
  Check,
  X,
  Clock,
  AlertTriangle,
  Globe,
  BarChart3,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/utils/toast';
import { useLocalization } from '@/context/LocalizationContext';
import { languageService, type Translation, type Language } from '@/services/languageService';

interface TranslationManagerProps {
  hotelId?: string;
  initialNamespace?: string;
  initialLanguage?: string;
}

interface TranslationFilter {
  namespace?: string;
  language?: string;
  status?: 'pending' | 'translated' | 'approved' | 'published';
  search?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  showMissingOnly?: boolean;
}

interface TranslationFormData {
  key: string;
  namespace: string;
  sourceText: string;
  translations: Record<string, string>;
  context?: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export const TranslationManager: React.FC<TranslationManagerProps> = ({
  hotelId,
  initialNamespace = 'common',
  initialLanguage
}) => {
  // State
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<Translation | null>(null);
  const [filter, setFilter] = useState<TranslationFilter>({ 
    namespace: initialNamespace,
    language: initialLanguage
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<TranslationFormData>({
    key: '',
    namespace: initialNamespace,
    sourceText: '',
    translations: {},
    context: '',
    tags: [],
    priority: 'medium'
  });
  const [stats, setStats] = useState<unknown>(null);

  // Context
  const { 
    availableLanguages, 
    currentLanguage, 
    getTranslationStats,
    getMissingTranslations,
    reloadNamespace
  } = useLocalization();

  // Load data
  useEffect(() => {
    loadNamespaces();
    loadTranslationStats();
  }, []);

  useEffect(() => {
    if (filter.namespace) {
      loadTranslations();
    }
  }, [filter]);

  const loadNamespaces = async () => {
    try {
      const { data } = await languageService.getTranslationNamespaces();
      setNamespaces(data.map(ns => ns.name));
    } catch (error) {
      toast.error('Failed to load namespaces');
    }
  };

  const loadTranslations = async () => {
    if (!filter.namespace) return;
    
    setIsLoading(true);
    try {
      const targetLanguage = filter.language || currentLanguage?.code || 'EN';
      const { data } = await languageService.getTranslations(filter.namespace, targetLanguage, {
        includeStatus: true,
        includeMeta: true
      });

      // Convert to Translation array (mock transformation)
      const translationArray = Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
        _id: `${filter.namespace}_${key}`,
        key,
        namespace: filter.namespace!,
        context: '',
        sourceLanguage: 'EN',
        sourceText: typeof value === 'string' ? value : value.sourceText || key,
        translations: [{
          language: targetLanguage,
          text: typeof value === 'string' ? value : value.text || key,
          status: 'published' as const,
          confidence: 1,
          translatedAt: new Date().toISOString()
        }],
        tags: [],
        pluralizations: [],
        interpolation: {
          hasVariables: typeof value === 'string' ? value.includes('{{') : false,
          variables: []
        },
        usage: {
          frequency: 0,
          contexts: [filter.namespace!],
          lastUsed: new Date().toISOString()
        },
        priority: 'medium' as const,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      setTranslations(translationArray);
    } catch (error) {
      toast.error('Failed to load translations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTranslationStats = async () => {
    try {
      const { data } = await languageService.getTranslationStats({
        namespace: filter.namespace
      });
      setStats(data);
    } catch {
      // Error handled silently
    }
  };

  // Filter translations
  const filteredTranslations = translations.filter(translation => {
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      if (!translation.key.toLowerCase().includes(searchTerm) &&
          !translation.sourceText.toLowerCase().includes(searchTerm)) {
        return false;
      }
    }
    
    if (filter.status) {
      const translationStatus = translation.translations.find(
        t => t.language === (filter.language || currentLanguage?.code || 'EN')
      )?.status;
      if (translationStatus !== filter.status) {
        return false;
      }
    }
    
    if (filter.priority && translation.priority !== filter.priority) {
      return false;
    }
    
    return true;
  });

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      
      if (dialogMode === 'create') {
        await languageService.saveTranslation(
          formData.key,
          formData.namespace,
          formData.sourceText,
          formData.translations,
          {
            context: formData.context,
            tags: formData.tags,
            priority: formData.priority
          }
        );
        toast.success('Translation created successfully');
      } else if (selectedTranslation) {
        await languageService.saveTranslation(
          formData.key,
          formData.namespace,
          formData.sourceText,
          formData.translations,
          {
            context: formData.context,
            tags: formData.tags,
            priority: formData.priority
          }
        );
        toast.success('Translation updated successfully');
      }
      
      setShowDialog(false);
      await loadTranslations();
      await reloadNamespace(formData.namespace);
      
    } catch (error) {
      toast.error('Failed to save translation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (translation: Translation) => {
    if (!confirm('Are you sure you want to delete this translation?')) return;
    
    try {
      await languageService.deleteTranslation(translation.key, translation.namespace);
      toast.success('Translation deleted successfully');
      await loadTranslations();
      await reloadNamespace(translation.namespace);
    } catch (error) {
      toast.error('Failed to delete translation');
    }
  };

  const handleApprove = async (translation: Translation, language: string) => {
    try {
      await languageService.approveTranslation(
        translation.key,
        translation.namespace,
        language
      );
      toast.success('Translation approved');
      await loadTranslations();
    } catch (error) {
      toast.error('Failed to approve translation');
    }
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setFormData({
      key: '',
      namespace: filter.namespace || 'common',
      sourceText: '',
      translations: {},
      context: '',
      tags: [],
      priority: 'medium'
    });
    setSelectedTranslation(null);
    setShowDialog(true);
  };

  const openEditDialog = (translation: Translation) => {
    setDialogMode('edit');
    setSelectedTranslation(translation);
    
    const translationsMap: Record<string, string> = {};
    translation.translations.forEach(t => {
      translationsMap[t.language] = t.text;
    });
    
    setFormData({
      key: translation.key,
      namespace: translation.namespace,
      sourceText: translation.sourceText,
      translations: translationsMap,
      context: translation.context || '',
      tags: translation.tags,
      priority: translation.priority
    });
    setShowDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'destructive',
      translated: 'secondary',
      approved: 'default',
      published: 'default'
    } as const;
    
    const icons = {
      pending: Clock,
      translated: Edit3,
      approved: Check,
      published: Globe
    };
    
    const Icon = icons[status as keyof typeof icons] || Clock;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${colors[priority as keyof typeof colors] || colors.medium}`}>
        {priority}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Translation Manager</h2>
          <p className="text-gray-600">Manage translations across languages and namespaces</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Translation
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Globe className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Keys</p>
                  <p className="text-2xl font-bold">{stats.overview.totalKeys}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <BarChart3 className="w-8 h-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Completeness</p>
                  <p className="text-2xl font-bold">{Math.round(stats.overview.completeness)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Languages</p>
                  <p className="text-2xl font-bold">{Object.keys(stats.byLanguage).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Settings className="w-8 h-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Namespaces</p>
                  <p className="text-2xl font-bold">{Object.keys(stats.byNamespace).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="namespace">Namespace</Label>
              <Select 
                value={filter.namespace || ''} 
                onValueChange={(value) => setFilter({ ...filter, namespace: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select namespace" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map(ns => (
                    <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="language">Language</Label>
              <Select 
                value={filter.language || ''} 
                onValueChange={(value) => setFilter({ ...filter, language: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={filter.status || ''} 
                onValueChange={(value) => setFilter({ ...filter, status: value as string })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="translated">Translated</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                placeholder="Search translations..."
                value={filter.search || ''}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Translations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Translations ({filteredTranslations.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadTranslations} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Source Text</TableHead>
                  <TableHead>Translation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTranslations.map((translation) => {
                  const targetLang = filter.language || currentLanguage?.code || 'EN';
                  const translationData = translation.translations.find(t => t.language === targetLang);
                  
                  return (
                    <TableRow key={translation._id}>
                      <TableCell className="font-mono text-sm">{translation.key}</TableCell>
                      <TableCell className="max-w-xs truncate" title={translation.sourceText}>
                        {translation.sourceText}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={translationData?.text}>
                        {translationData?.text || '-'}
                      </TableCell>
                      <TableCell>
                        {translationData ? getStatusBadge(translationData.status) : '-'}
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(translation.priority)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(translation)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          {translationData && translationData.status === 'translated' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(translation, targetLang)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(translation)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {filteredTranslations.length === 0 && !isLoading && (
              <div className="text-center py-8 text-gray-500">
                No translations found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Create Translation' : 'Edit Translation'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create' 
                ? 'Add a new translation key and its translations'
                : 'Update the translation key and its translations'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="translation.key"
                />
              </div>
              <div>
                <Label htmlFor="namespace">Namespace</Label>
                <Select
                  value={formData.namespace}
                  onValueChange={(value) => setFormData({ ...formData, namespace: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {namespaces.map(ns => (
                      <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="sourceText">Source Text</Label>
              <Textarea
                id="sourceText"
                value={formData.sourceText}
                onChange={(e) => setFormData({ ...formData, sourceText: e.target.value })}
                placeholder="Enter the source text in English"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value as string })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="context">Context</Label>
                <Input
                  id="context"
                  value={formData.context}
                  onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                  placeholder="Usage context (optional)"
                />
              </div>
            </div>
            
            <div>
              <Label>Translations</Label>
              <div className="space-y-3 mt-2">
                {availableLanguages.map(lang => (
                  <div key={lang.code} className="flex items-center gap-2">
                    <Label className="w-20 text-sm">{lang.code}</Label>
                    <Input
                      value={formData.translations[lang.code] || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        translations: {
                          ...formData.translations,
                          [lang.code]: e.target.value
                        }
                      })}
                      placeholder={`Translation in ${lang.name}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                dialogMode === 'create' ? 'Create' : 'Update'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TranslationManager;