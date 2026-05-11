import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Key,
  Shield,
  CheckCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiManagementApi } from '../../services/api';
import { toast } from '@/components/ui/use-toast';

interface APIKeyCreationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface KeyFormData {
  name: string;
  description: string;
  type: 'read' | 'write' | 'admin';
  permissions: string[];
  expiresAt: string;
  rateLimit: {
    minute: number;
    hour: number;
    day: number;
  };
  ipRestrictions: string[];
  domainRestrictions: string[];
}

const AVAILABLE_PERMISSIONS = [
  { id: 'bookings:read', label: 'Read Bookings', category: 'Bookings' },
  { id: 'bookings:write', label: 'Write Bookings', category: 'Bookings' },
  { id: 'rooms:read', label: 'Read Rooms', category: 'Rooms' },
  { id: 'rooms:write', label: 'Write Rooms', category: 'Rooms' },
  { id: 'guests:read', label: 'Read Guests', category: 'Guests' },
  { id: 'guests:write', label: 'Write Guests', category: 'Guests' },
  { id: 'analytics:read', label: 'Read Analytics', category: 'Analytics' },
  { id: 'reports:read', label: 'Read Reports', category: 'Reports' },
  { id: 'users:read', label: 'Read Users', category: 'Admin' },
  { id: 'users:write', label: 'Write Users', category: 'Admin' },
  { id: 'hotels:read', label: 'Read Hotels', category: 'Admin' },
  { id: 'hotels:write', label: 'Write Hotels', category: 'Admin' }
];

const DEFAULT_RATE_LIMITS = {
  read: { minute: 100, hour: 1000, day: 10000 },
  write: { minute: 50, hour: 500, day: 5000 },
  admin: { minute: 200, hour: 2000, day: 20000 }
};

export const APIKeyCreationForm: React.FC<APIKeyCreationFormProps> = ({
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<KeyFormData>({
    name: '',
    description: '',
    type: 'read',
    permissions: [],
    expiresAt: '',
    rateLimit: DEFAULT_RATE_LIMITS.read,
    ipRestrictions: [],
    domainRestrictions: []
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ipInput, setIpInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [createdKey, setCreatedKey] = useState<{
    name: string;
    key: string;
    type: string;
    permissions: string[];
  } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const handleTypeChange = (type: 'read' | 'write' | 'admin') => {
    setFormData(prev => ({
      ...prev,
      type,
      rateLimit: DEFAULT_RATE_LIMITS[type],
      permissions: type === 'admin' ? AVAILABLE_PERMISSIONS.map(p => p.id) :
                   type === 'write' ? AVAILABLE_PERMISSIONS.filter(p => !p.id.includes('users:') && !p.id.includes('hotels:')).map(p => p.id) :
                   AVAILABLE_PERMISSIONS.filter(p => p.id.includes(':read')).map(p => p.id)
    }));
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const addIpRestriction = () => {
    if (ipInput && !formData.ipRestrictions.includes(ipInput)) {
      setFormData(prev => ({
        ...prev,
        ipRestrictions: [...prev.ipRestrictions, ipInput]
      }));
      setIpInput('');
    }
  };

  const addDomainRestriction = () => {
    if (domainInput && !formData.domainRestrictions.includes(domainInput)) {
      setFormData(prev => ({
        ...prev,
        domainRestrictions: [...prev.domainRestrictions, domainInput]
      }));
      setDomainInput('');
    }
  };

  const removeIpRestriction = (ip: string) => {
    setFormData(prev => ({
      ...prev,
      ipRestrictions: prev.ipRestrictions.filter(i => i !== ip)
    }));
  };

  const removeDomainRestriction = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      domainRestrictions: prev.domainRestrictions.filter(d => d !== domain)
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'API Key name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.permissions.length === 0) {
      newErrors.permissions = 'At least one permission must be selected';
    }

    if (formData.expiresAt && new Date(formData.expiresAt) <= new Date()) {
      newErrors.expiresAt = 'Expiration date must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiManagementApi.createAPIKey({
        ...formData,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined
      });

      setCreatedKey(response.data?.data);
      toast({
        title: "API Key Created",
        description: "Your API key has been created successfully. Make sure to copy it now as it won't be shown again.",
      });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast({
        title: "Error Creating API Key",
        description: message || "Failed to create API key",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const handleFinish = () => {
    onSuccess();
  };

  if (createdKey) {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>API Key Created Successfully!</strong>
            <br />
            Make sure to copy your API key now. You won't be able to see it again for security reasons.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <Label>API Key Name</Label>
                <div className="font-medium">{createdKey.name}</div>
              </div>

              <div>
                <Label>API Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted p-2 rounded font-mono text-sm">
                    {showKey ? createdKey.key : '•'.repeat(createdKey.key.length)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdKey.key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Type & Permissions</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={createdKey.type === 'admin' ? 'destructive' : 'secondary'}>
                    {createdKey.type}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {createdKey.permissions.length} permissions
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleFinish} className="flex-1">
            <CheckCircle className="mr-2 h-4 w-4" />
            Done
          </Button>
          <Button variant="outline" onClick={() => copyToClipboard(createdKey.key)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Key Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">API Key Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="My API Key"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && <div className="text-sm text-red-500 mt-1">{errors.name}</div>}
        </div>

        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this API key will be used for..."
            className={errors.description ? 'border-red-500' : ''}
          />
          {errors.description && <div className="text-sm text-red-500 mt-1">{errors.description}</div>}
        </div>

        <div>
          <Label htmlFor="type">Key Type *</Label>
          <Select value={formData.type} onValueChange={handleTypeChange}>
            <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select key type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <div>
                    <div>Read Only</div>
                    <div className="text-xs text-muted-foreground">Can only read data</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="write">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <div>
                    <div>Read & Write</div>
                    <div className="text-xs text-muted-foreground">Can read and modify data</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="admin">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <div>
                    <div>Admin</div>
                    <div className="text-xs text-muted-foreground">Full access to all resources</div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
          <Input
            id="expiresAt"
            type="datetime-local"
            value={formData.expiresAt}
            onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
            className={errors.expiresAt ? 'border-red-500' : ''}
          />
          {errors.expiresAt && <div className="text-sm text-red-500 mt-1">{errors.expiresAt}</div>}
          <div className="text-xs text-muted-foreground mt-1">
            Leave empty for no expiration
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div>
        <Label>Permissions *</Label>
        <div className="mt-2 space-y-3">
          {Object.entries(
            AVAILABLE_PERMISSIONS.reduce((acc, permission) => {
              if (!acc[permission.category]) acc[permission.category] = [];
              acc[permission.category].push(permission);
              return acc;
            }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>)
          ).map(([category, permissions]) => (
            <div key={category}>
              <div className="text-sm font-medium text-muted-foreground mb-2">{category}</div>
              <div className="grid grid-cols-2 gap-2">
                {permissions.map(permission => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Switch
                      id={permission.id}
                      checked={formData.permissions.includes(permission.id)}
                      onCheckedChange={() => handlePermissionToggle(permission.id)}
                    />
                    <Label htmlFor={permission.id} className="text-sm">
                      {permission.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {errors.permissions && <div className="text-sm text-red-500 mt-1">{errors.permissions}</div>}
      </div>

      {/* Rate Limits */}
      <div>
        <Label>Rate Limits</Label>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div>
            <Label htmlFor="minuteLimit">Per Minute</Label>
            <Input
              id="minuteLimit"
              type="number"
              value={formData.rateLimit.minute}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                rateLimit: { ...prev.rateLimit, minute: parseInt(e.target.value) || 0 }
              }))}
            />
          </div>
          <div>
            <Label htmlFor="hourLimit">Per Hour</Label>
            <Input
              id="hourLimit"
              type="number"
              value={formData.rateLimit.hour}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                rateLimit: { ...prev.rateLimit, hour: parseInt(e.target.value) || 0 }
              }))}
            />
          </div>
          <div>
            <Label htmlFor="dayLimit">Per Day</Label>
            <Input
              id="dayLimit"
              type="number"
              value={formData.rateLimit.day}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                rateLimit: { ...prev.rateLimit, day: parseInt(e.target.value) || 0 }
              }))}
            />
          </div>
        </div>
      </div>

      {/* IP Restrictions */}
      <div>
        <Label>IP Address Restrictions (Optional)</Label>
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <Input
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="192.168.1.1 or 192.168.1.0/24"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIpRestriction(); } }}
            />
            <Button type="button" onClick={addIpRestriction} variant="outline">
              Add
            </Button>
          </div>
          {formData.ipRestrictions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {formData.ipRestrictions.map(ip => (
                <Badge key={ip} variant="secondary" className="cursor-pointer" onClick={() => removeIpRestriction(ip)}>
                  {ip} ×
                </Badge>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Leave empty to allow access from any IP address
          </div>
        </div>
      </div>

      {/* Domain Restrictions */}
      <div>
        <Label>Domain Restrictions (Optional)</Label>
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <Input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="example.com or *.example.com"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomainRestriction(); } }}
            />
            <Button type="button" onClick={addDomainRestriction} variant="outline">
              Add
            </Button>
          </div>
          {formData.domainRestrictions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {formData.domainRestrictions.map(domain => (
                <Badge key={domain} variant="secondary" className="cursor-pointer" onClick={() => removeDomainRestriction(domain)}>
                  {domain} ×
                </Badge>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Leave empty to allow access from any domain
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
              Creating...
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              Create API Key
            </>
          )}
        </Button>
      </div>
    </form>
  );
};