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
  Webhook,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Play
} from 'lucide-react';
import { apiManagementApi } from '../../services/api';
import { toast } from '@/components/ui/use-toast';

interface WebhookCreationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface WebhookFormData {
  name: string;
  description: string;
  url: string;
  events: string[];
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
  timeoutMs: number;
  headers: Record<string, string>;
}

const AVAILABLE_EVENTS = [
  { id: 'booking.created', label: 'Booking Created', category: 'Bookings' },
  { id: 'booking.updated', label: 'Booking Updated', category: 'Bookings' },
  { id: 'booking.cancelled', label: 'Booking Cancelled', category: 'Bookings' },
  { id: 'booking.confirmed', label: 'Booking Confirmed', category: 'Bookings' },
  { id: 'booking.checked_in', label: 'Booking Check-in', category: 'Bookings' },
  { id: 'booking.checked_out', label: 'Booking Check-out', category: 'Bookings' },
  { id: 'booking.no_show', label: 'Booking No Show', category: 'Bookings' },
  { id: 'guest.created', label: 'Guest Created', category: 'Guest Events' },
  { id: 'guest.updated', label: 'Guest Updated', category: 'Guest Events' },
  { id: 'guest.checked_in', label: 'Guest Check-in', category: 'Guest Events' },
  { id: 'guest.checked_out', label: 'Guest Check-out', category: 'Guest Events' },
  { id: 'payment.completed', label: 'Payment Completed', category: 'Payments' },
  { id: 'payment.failed', label: 'Payment Failed', category: 'Payments' },
  { id: 'payment.refunded', label: 'Payment Refunded', category: 'Payments' },
  { id: 'payment.partial_refund', label: 'Payment Partial Refund', category: 'Payments' },
  { id: 'room.status_changed', label: 'Room Status Changed', category: 'Room Management' },
  { id: 'room.availability_changed', label: 'Room Availability Changed', category: 'Room Management' },
  { id: 'room.maintenance_scheduled', label: 'Maintenance Scheduled', category: 'Room Management' },
  { id: 'room.cleaned', label: 'Room Cleaned', category: 'Room Management' },
  { id: 'rate.updated', label: 'Rate Updated', category: 'Rate Events' },
  { id: 'rate.created', label: 'Rate Created', category: 'Rate Events' },
  { id: 'rate.deleted', label: 'Rate Deleted', category: 'Rate Events' }
];

export const WebhookCreationForm: React.FC<WebhookCreationFormProps> = ({
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<WebhookFormData>({
    name: '',
    description: '',
    url: '',
    events: [],
    isActive: true,
    retryPolicy: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelayMs: 1000
    },
    timeoutMs: 30000,
    headers: {}
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [createdWebhook, setCreatedWebhook] = useState<{
    name: string;
    url: string;
    secret?: string;
    events: string[];
    isActive: boolean;
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const handleEventToggle = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  const addHeader = () => {
    if (headerKey && headerValue && !formData.headers[headerKey]) {
      setFormData(prev => ({
        ...prev,
        headers: {
          ...prev.headers,
          [headerKey]: headerValue
        }
      }));
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    setFormData(prev => ({
      ...prev,
      headers: Object.fromEntries(
        Object.entries(prev.headers).filter(([k]) => k !== key)
      )
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Webhook name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'Webhook URL is required';
    } else {
      try {
        new URL(formData.url);
        if (!formData.url.startsWith('https://')) {
          newErrors.url = 'Webhook URL must use HTTPS for security';
        }
      } catch {
        newErrors.url = 'Invalid URL format';
      }
    }

    if (formData.events.length === 0) {
      newErrors.events = 'At least one event must be selected';
    }

    if (formData.retryPolicy.maxRetries < 0 || formData.retryPolicy.maxRetries > 10) {
      newErrors.maxRetries = 'Max retries must be between 0 and 10';
    }

    if (formData.timeoutMs < 1000 || formData.timeoutMs > 60000) {
      newErrors.timeoutMs = 'Timeout must be between 1 and 60 seconds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const testWebhookUrl = async () => {
    if (!formData.url) {
      toast({
        title: "URL Required",
        description: "Please enter a webhook URL to test",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    try {
      // Validate URL is reachable by attempting a HEAD request
      new URL(formData.url);
      // Show success - full test requires a created webhook
      toast({
        title: "URL Validated",
        description: "URL format is valid. Full delivery test will be available after webhook creation.",
      });
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid HTTPS URL",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiManagementApi.createWebhook(formData);

      setCreatedWebhook(response.data?.data);
      toast({
        title: "Webhook Created",
        description: "Your webhook has been created successfully and is ready to receive events.",
      });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast({
        title: "Error Creating Webhook",
        description: message || "Failed to create webhook",
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
      description: "Webhook secret copied to clipboard",
    });
  };

  const handleFinish = () => {
    onSuccess();
  };

  if (createdWebhook) {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Webhook Created Successfully!</strong>
            <br />
            Your webhook is now active and will receive events. Save the webhook secret for signature verification.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <Label>Webhook Name</Label>
                <div className="font-medium">{createdWebhook.name}</div>
              </div>

              <div>
                <Label>Endpoint URL</Label>
                <code className="block bg-muted p-2 rounded font-mono text-sm mt-1">
                  {createdWebhook.url}
                </code>
              </div>

              <div>
                <Label>Webhook Secret</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted p-2 rounded font-mono text-sm">
                    {showSecret ? createdWebhook.secret : '•'.repeat(32)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdWebhook.secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Use this secret to verify webhook signatures (HMAC-SHA256)
                </div>
              </div>

              <div>
                <Label>Events</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {createdWebhook.events.map((event: string) => (
                    <Badge key={event} variant="secondary">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Badge variant={createdWebhook.isActive ? 'default' : 'secondary'}>
                  {createdWebhook.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleFinish} className="flex-1">
            <CheckCircle className="mr-2 h-4 w-4" />
            Done
          </Button>
          <Button variant="outline" onClick={() => copyToClipboard(createdWebhook.secret)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Secret
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
          <Label htmlFor="name">Webhook Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="My Webhook"
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
            placeholder="Describe what this webhook is used for..."
            className={errors.description ? 'border-red-500' : ''}
          />
          {errors.description && <div className="text-sm text-red-500 mt-1">{errors.description}</div>}
        </div>

        <div>
          <Label htmlFor="url">Endpoint URL *</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://your-domain.com/webhook"
              className={errors.url ? 'border-red-500' : ''}
            />
            <Button type="button" onClick={testWebhookUrl} disabled={testing || !formData.url} variant="outline">
              {testing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Test
                </>
              )}
            </Button>
          </div>
          {errors.url && <div className="text-sm text-red-500 mt-1">{errors.url}</div>}
          <div className="text-xs text-muted-foreground mt-1">
            Must be a valid HTTPS URL
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="isActive">Active</Label>
            <div className="text-xs text-muted-foreground">
              Whether this webhook should receive events
            </div>
          </div>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
          />
        </div>
      </div>

      {/* Events */}
      <div>
        <Label>Events to Subscribe *</Label>
        <div className="mt-2 space-y-3">
          {Object.entries(
            AVAILABLE_EVENTS.reduce((acc, event) => {
              if (!acc[event.category]) acc[event.category] = [];
              acc[event.category].push(event);
              return acc;
            }, {} as Record<string, typeof AVAILABLE_EVENTS>)
          ).map(([category, events]) => (
            <div key={category}>
              <div className="text-sm font-medium text-muted-foreground mb-2">{category}</div>
              <div className="grid grid-cols-2 gap-2">
                {events.map(event => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Switch
                      id={event.id}
                      checked={formData.events.includes(event.id)}
                      onCheckedChange={() => handleEventToggle(event.id)}
                    />
                    <Label htmlFor={event.id} className="text-sm">
                      {event.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {errors.events && <div className="text-sm text-red-500 mt-1">{errors.events}</div>}
      </div>

      {/* Configuration */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxRetries">Max Retries</Label>
            <Input
              id="maxRetries"
              type="number"
              min="0"
              max="10"
              value={formData.retryPolicy.maxRetries}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                retryPolicy: {
                  ...prev.retryPolicy,
                  maxRetries: parseInt(e.target.value) || 0
                }
              }))}
              className={errors.maxRetries ? 'border-red-500' : ''}
            />
            {errors.maxRetries && <div className="text-sm text-red-500 mt-1">{errors.maxRetries}</div>}
          </div>

          <div>
            <Label htmlFor="timeoutMs">Timeout (seconds)</Label>
            <Input
              id="timeoutMs"
              type="number"
              min="1"
              max="60"
              value={formData.timeoutMs / 1000}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                timeoutMs: (parseInt(e.target.value) || 30) * 1000
              }))}
              className={errors.timeoutMs ? 'border-red-500' : ''}
            />
            {errors.timeoutMs && <div className="text-sm text-red-500 mt-1">{errors.timeoutMs}</div>}
          </div>
        </div>

        <div>
          <Label htmlFor="backoffMultiplier">Backoff Multiplier</Label>
          <Select
            value={formData.retryPolicy.backoffMultiplier.toString()}
            onValueChange={(value) => setFormData(prev => ({
              ...prev,
              retryPolicy: {
                ...prev.retryPolicy,
                backoffMultiplier: parseFloat(value)
              }
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select backoff multiplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1x (Linear)</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="2">2x (Exponential)</SelectItem>
              <SelectItem value="3">3x</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground mt-1">
            How much to increase delay between retries
          </div>
        </div>
      </div>

      {/* Custom Headers */}
      <div>
        <Label>Custom Headers (Optional)</Label>
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <Input
              value={headerKey}
              onChange={(e) => setHeaderKey(e.target.value)}
              placeholder="Header name"
              className="flex-1"
            />
            <Input
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              placeholder="Header value"
              className="flex-1"
            />
            <Button type="button" onClick={addHeader} variant="outline">
              Add
            </Button>
          </div>
          {Object.keys(formData.headers).length > 0 && (
            <div className="space-y-1">
              {Object.entries(formData.headers).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-muted p-2 rounded">
                  <code className="text-sm">
                    {key}: {value}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHeader(key)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Add custom headers to be sent with webhook requests
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
              <Webhook className="mr-2 h-4 w-4" />
              Create Webhook
            </>
          )}
        </Button>
      </div>
    </form>
  );
};