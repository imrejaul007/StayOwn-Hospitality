import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Divider,
} from '@mui/material';

interface SpecialDiscount {
  _id: string;
  name: string;
  code: string;
  description?: string;
  type: string;
  category: string;
  discountValue: number;
  discountType: string;
  maxDiscountAmount?: number;
  minBookingValue?: number;
  minNights?: number;
  maxNights?: number;
  dates: {
    startDate: string;
    endDate: string;
  };
  usageLimits: {
    maxUsagePerGuest: number;
    maxTotalUsage?: number;
    currentUsage: number;
  };
  isActive: boolean;
  isPublic: boolean;
  priority: number;
  analytics: {
    totalBookings: number;
    totalRevenue: number;
    totalDiscountGiven: number;
    averageBookingValue: number;
    conversionRate: number;
    lastUsed?: string;
  };
  createdBy: {
    name: string;
    email: string;
  };
  updatedBy?: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface DiscountFormProps {
  discount: SpecialDiscount | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

const discountTypeOptions = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
  { value: 'free_night', label: 'Free Night' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'package_discount', label: 'Package Discount' },
];

const typeOptions = [
  'early_bird', 'last_minute', 'long_stay', 'seasonal', 'corporate',
  'group', 'loyalty', 'promotional', 'other',
];

const categoryOptions = [
  'booking', 'room', 'service', 'package', 'membership', 'referral', 'other',
];

function toDateInputValue(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export function DiscountForm({ discount, onSubmit, onCancel }: DiscountFormProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | ''>('');
  const [type, setType] = useState('promotional');
  const [category, setCategory] = useState('booking');
  const [minBookingValue, setMinBookingValue] = useState<number | ''>('');
  const [minNights, setMinNights] = useState<number | ''>('');
  const [maxNights, setMaxNights] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [maxPerGuest, setMaxPerGuest] = useState<number>(1);
  const [maxTotal, setMaxTotal] = useState<number | ''>('');
  const [priority, setPriority] = useState<number>(0);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (discount) {
      setName(discount.name);
      setCode(discount.code);
      setDescription(discount.description || '');
      setDiscountType(discount.discountType);
      setDiscountValue(discount.discountValue);
      setMaxDiscountAmount(discount.maxDiscountAmount ?? '');
      setType(discount.type);
      setCategory(discount.category);
      setMinBookingValue(discount.minBookingValue ?? '');
      setMinNights(discount.minNights ?? '');
      setMaxNights(discount.maxNights ?? '');
      setStartDate(toDateInputValue(discount.dates.startDate));
      setEndDate(toDateInputValue(discount.dates.endDate));
      setIsActive(discount.isActive);
      setIsPublic(discount.isPublic);
      setMaxPerGuest(discount.usageLimits.maxUsagePerGuest);
      setMaxTotal(discount.usageLimits.maxTotalUsage ?? '');
      setPriority(discount.priority);
    }
  }, [discount]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Name is required';
    if (!code.trim()) newErrors.code = 'Code is required';
    if (discountValue <= 0) newErrors.discountValue = 'Discount value must be greater than 0';
    if (discountType === 'percentage' && discountValue > 100) {
      newErrors.discountValue = 'Percentage cannot exceed 100';
    }
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!endDate) newErrors.endDate = 'End date is required';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discountType,
      discountValue,
      type,
      category,
      dates: {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      },
      isActive,
      isPublic,
      priority,
      usageLimits: {
        maxUsagePerGuest: maxPerGuest,
        maxTotalUsage: maxTotal || undefined,
      },
    };

    if (maxDiscountAmount !== '') data.maxDiscountAmount = maxDiscountAmount;
    if (minBookingValue !== '') data.minBookingValue = minBookingValue;
    if (minNights !== '') data.minNights = minNights;
    if (maxNights !== '') data.maxNights = maxNights;

    onSubmit(data);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ pt: 1 }}>
      {/* Basic Section */}
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Basic Information
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            error={!!errors.name}
            helperText={errors.name}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            fullWidth
            required
            error={!!errors.code}
            helperText={errors.code || 'Uppercase alphanumeric'}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select value={type} label="Type" onChange={(e) => setType(e.target.value)}>
              {typeOptions.map((t) => (
                <MenuItem key={t} value={t}>
                  {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
              {categoryOptions.map((c) => (
                <MenuItem key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            size="small"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Discount Type Section */}
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Discount Value
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Discount Type</InputLabel>
            <Select
              value={discountType}
              label="Discount Type"
              onChange={(e) => setDiscountType(e.target.value)}
            >
              {discountTypeOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label={discountType === 'percentage' ? 'Discount (%)' : 'Discount Value'}
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(Number(e.target.value))}
            fullWidth
            required
            error={!!errors.discountValue}
            helperText={errors.discountValue}
            size="small"
            inputProps={{ min: 0, step: discountType === 'percentage' ? 1 : 0.01 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Max Discount Amount"
            type="number"
            value={maxDiscountAmount}
            onChange={(e) => setMaxDiscountAmount(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            size="small"
            helperText="Cap for percentage discounts"
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Conditions Section */}
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Conditions
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Min Booking Value"
            type="number"
            value={minBookingValue}
            onChange={(e) => setMinBookingValue(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            size="small"
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Min Nights"
            type="number"
            value={minNights}
            onChange={(e) => setMinNights(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            size="small"
            inputProps={{ min: 1, step: 1 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Max Nights"
            type="number"
            value={maxNights}
            onChange={(e) => setMaxNights(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            size="small"
            inputProps={{ min: 1, step: 1 }}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Validity Section */}
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Validity
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
            required
            error={!!errors.startDate}
            helperText={errors.startDate}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            fullWidth
            required
            error={!!errors.endDate}
            helperText={errors.endDate}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Box display="flex" flexDirection="column" gap={1} pt={0.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  size="small"
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  size="small"
                />
              }
              label="Public"
            />
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Limits Section */}
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Usage Limits
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Max Per Guest"
            type="number"
            value={maxPerGuest}
            onChange={(e) => setMaxPerGuest(Number(e.target.value))}
            fullWidth
            size="small"
            inputProps={{ min: 1, step: 1 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Max Total Usage"
            type="number"
            value={maxTotal}
            onChange={(e) => setMaxTotal(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            size="small"
            helperText="Leave empty for unlimited"
            inputProps={{ min: 0, step: 1 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            fullWidth
            size="small"
            helperText="Higher = applied first"
            inputProps={{ min: 0, step: 1 }}
          />
        </Grid>
      </Grid>

      {/* Actions */}
      <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" type="submit">
          {discount ? 'Update Discount' : 'Create Discount'}
        </Button>
      </Box>
    </Box>
  );
}

export default DiscountForm;
