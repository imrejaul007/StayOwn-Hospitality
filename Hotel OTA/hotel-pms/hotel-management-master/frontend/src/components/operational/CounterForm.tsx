import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Button,
  Typography,
  Checkbox,
  FormGroup
} from '@mui/material';

interface Counter {
  _id: string;
  name: string;
  code: string;
  type: string;
  description?: string;
  status: string;
  isActive: boolean;
  location: {
    floor?: number;
    room?: string;
  };
  capacity: {
    maxConcurrentUsers: number;
    maxDailyTransactions: number;
  };
  operatingHours: {
    startTime?: string;
    endTime?: string;
    workingDays?: string[];
  };
  features: {
    supportsCheckIn: boolean;
    supportsCheckOut: boolean;
    supportsPayment: boolean;
    supportsKeyIssuance: boolean;
    supportsGuestServices: boolean;
  };
}

interface CounterFormProps {
  counter: Counter | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

const counterTypes = [
  'reception', 'concierge', 'cashier', 'information', 'check_in',
  'check_out', 'valet', 'bell_desk', 'business_center'
];

const formatTypeLabel = (type: string): string =>
  type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function CounterForm({ counter, onSubmit, onCancel }: CounterFormProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('reception');
  const [description, setDescription] = useState('');
  const [floor, setFloor] = useState<number | ''>('');
  const [room, setRoom] = useState('');
  const [maxConcurrentUsers, setMaxConcurrentUsers] = useState<number | ''>(1);
  const [maxDailyTransactions, setMaxDailyTransactions] = useState<number | ''>(1000);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [features, setFeatures] = useState({
    supportsCheckIn: false,
    supportsCheckOut: false,
    supportsPayment: false,
    supportsKeyIssuance: false,
    supportsGuestServices: false,
  });
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (counter) {
      setName(counter.name || '');
      setCode(counter.code || '');
      setType(counter.type || 'reception');
      setDescription(counter.description || '');
      setFloor(counter.location?.floor ?? '');
      setRoom(counter.location?.room || '');
      setMaxConcurrentUsers(counter.capacity?.maxConcurrentUsers ?? 1);
      setMaxDailyTransactions(counter.capacity?.maxDailyTransactions ?? 1000);
      setStartTime(counter.operatingHours?.startTime || '');
      setEndTime(counter.operatingHours?.endTime || '');
      setFeatures({
        supportsCheckIn: counter.features?.supportsCheckIn ?? false,
        supportsCheckOut: counter.features?.supportsCheckOut ?? false,
        supportsPayment: counter.features?.supportsPayment ?? false,
        supportsKeyIssuance: counter.features?.supportsKeyIssuance ?? false,
        supportsGuestServices: counter.features?.supportsGuestServices ?? false,
      });
      setIsActive(counter.isActive ?? true);
    }
  }, [counter]);

  const handleFeatureChange = (feature: keyof typeof features) => {
    setFeatures((prev) => ({ ...prev, [feature]: !prev[feature] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      name,
      code,
      type,
      description,
      location: {
        floor: floor === '' ? undefined : floor,
        room: room || undefined,
      },
      capacity: {
        maxConcurrentUsers: maxConcurrentUsers || 1,
        maxDailyTransactions: maxDailyTransactions || 1000,
      },
      operatingHours: {
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      },
      features,
      isActive,
    };
    onSubmit(data);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ pt: 1 }}>
      <Grid container spacing={2}>
        {/* Name */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            size="small"
          />
        </Grid>

        {/* Code */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            fullWidth
            required
            size="small"
            helperText="Uppercase letters, numbers, _ and -"
          />
        </Grid>

        {/* Type */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value)}
            >
              {counterTypes.map((t) => (
                <MenuItem key={t} value={t}>
                  {formatTypeLabel(t)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Active */}
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            }
            label="Active"
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* Description */}
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

        {/* Location */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
            Location
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Floor"
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            size="small"
            inputProps={{ min: -10, max: 100 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            fullWidth
            size="small"
          />
        </Grid>

        {/* Capacity */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
            Capacity
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Max Concurrent Users"
            type="number"
            value={maxConcurrentUsers}
            onChange={(e) =>
              setMaxConcurrentUsers(e.target.value === '' ? '' : Number(e.target.value))
            }
            fullWidth
            size="small"
            inputProps={{ min: 1, max: 50 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Max Daily Transactions"
            type="number"
            value={maxDailyTransactions}
            onChange={(e) =>
              setMaxDailyTransactions(e.target.value === '' ? '' : Number(e.target.value))
            }
            fullWidth
            size="small"
            inputProps={{ min: 1, max: 10000 }}
          />
        </Grid>

        {/* Operating Hours */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
            Operating Hours
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="End Time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        {/* Features */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
            Features
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={features.supportsCheckIn}
                  onChange={() => handleFeatureChange('supportsCheckIn')}
                  size="small"
                />
              }
              label="Check-In"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={features.supportsCheckOut}
                  onChange={() => handleFeatureChange('supportsCheckOut')}
                  size="small"
                />
              }
              label="Check-Out"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={features.supportsPayment}
                  onChange={() => handleFeatureChange('supportsPayment')}
                  size="small"
                />
              }
              label="Payment"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={features.supportsKeyIssuance}
                  onChange={() => handleFeatureChange('supportsKeyIssuance')}
                  size="small"
                />
              }
              label="Key Issuance"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={features.supportsGuestServices}
                  onChange={() => handleFeatureChange('supportsGuestServices')}
                  size="small"
                />
              }
              label="Guest Services"
            />
          </FormGroup>
        </Grid>
      </Grid>

      {/* Actions */}
      <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained">
          {counter ? 'Update' : 'Create'}
        </Button>
      </Box>
    </Box>
  );
}

export default CounterForm;
