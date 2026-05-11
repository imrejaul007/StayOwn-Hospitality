import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Typography,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  Alert,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  Hotel as HotelIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Slot {
  _id: string;
  slotId: string;
  slotName: string;
  roomType: string;
  category: string;
  timeSlot: {
    startTime: string;
    endTime: string;
    duration: number;
  };
  pricing: {
    basePrice: number;
    currency: string;
    perGuestCharge: number;
  };
  capacity: {
    maxGuests: number;
    includedGuests: number;
  };
  availability: {
    isAvailable: boolean;
    blackoutDates: string[];
    minimumAdvanceBooking: number;
    maximumAdvanceBooking: number;
  };
  operationalDays: Array<{
    enabled: boolean;
    specialPricing?: number;
  }>;
  inclusions: string[];
  restrictions: {
    ageRestrictions: {
      minAge: number;
      maxAge: number;
      childrenAllowed: boolean;
    };
    guestRestrictions: string[];
  };
  isActive: boolean;
}

interface SlotFormData {
  slotName: string;
  roomType: string;
  category: string;
  startTime: Date | null;
  endTime: Date | null;
  basePrice: number;
  perGuestCharge: number;
  maxGuests: number;
  includedGuests: number;
  isAvailable: boolean;
  minimumAdvanceBooking: number;
  maximumAdvanceBooking: number;
  operationalDays: Array<{ enabled: boolean; specialPricing?: number }>;
  inclusions: string[];
  minAge: number;
  maxAge: number;
  childrenAllowed: boolean;
  guestRestrictions: string[];
}

interface SlotManagerProps {
  slots: Slot[];
  onSlotCreated: () => void;
  onSlotUpdated: () => void;
  onSlotDeleted: () => void;
}

const SlotManager: React.FC<SlotManagerProps> = ({
  slots,
  onSlotCreated,
  onSlotUpdated,
  onSlotDeleted
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);

  const initialFormData: SlotFormData = {
    slotName: '',
    roomType: '',
    category: 'premium',
    startTime: null,
    endTime: null,
    basePrice: 0,
    perGuestCharge: 0,
    maxGuests: 4,
    includedGuests: 2,
    isAvailable: true,
    minimumAdvanceBooking: 2,
    maximumAdvanceBooking: 30,
    operationalDays: Array(7).fill({ enabled: true, specialPricing: 0 }),
    inclusions: [],
    minAge: 0,
    maxAge: 120,
    childrenAllowed: true,
    guestRestrictions: []
  };

  const [formData, setFormData] = useState<SlotFormData>(initialFormData);

  const roomTypes = [
    'Deluxe Room',
    'Executive Suite', 
    'Presidential Suite',
    'Standard Room',
    'Family Suite',
    'Poolside Villa',
    'Garden View Room',
    'Ocean View Room'
  ];

  const categories = [
    { value: 'premium', label: 'Premium' },
    { value: 'standard', label: 'Standard' },
    { value: 'luxury', label: 'Luxury' },
    { value: 'family', label: 'Family' },
    { value: 'business', label: 'Business' }
  ];

  const commonInclusions = [
    'Room Access',
    'WiFi',
    'Towels',
    'Basic Amenities',
    'Room Service',
    'Housekeeping',
    'Mini Bar',
    'Pool Access',
    'Gym Access',
    'Spa Access',
    'Business Center',
    'Concierge Service'
  ];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleOpenDialog = (slot?: Slot) => {
    if (slot) {
      setEditingSlot(slot);
      setFormData({
        slotName: slot.slotName,
        roomType: slot.roomType,
        category: slot.category,
        startTime: new Date(`1970-01-01T${slot.timeSlot.startTime}:00`),
        endTime: new Date(`1970-01-01T${slot.timeSlot.endTime}:00`),
        basePrice: slot.pricing.basePrice,
        perGuestCharge: slot.pricing.perGuestCharge,
        maxGuests: slot.capacity.maxGuests,
        includedGuests: slot.capacity.includedGuests,
        isAvailable: slot.availability.isAvailable,
        minimumAdvanceBooking: slot.availability.minimumAdvanceBooking,
        maximumAdvanceBooking: slot.availability.maximumAdvanceBooking,
        operationalDays: slot.operationalDays,
        inclusions: slot.inclusions,
        minAge: slot.restrictions.ageRestrictions.minAge,
        maxAge: slot.restrictions.ageRestrictions.maxAge,
        childrenAllowed: slot.restrictions.ageRestrictions.childrenAllowed,
        guestRestrictions: slot.restrictions.guestRestrictions
      });
    } else {
      setEditingSlot(null);
      setFormData(initialFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSlot(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    if (!formData.slotName || !formData.roomType || !formData.startTime || !formData.endTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        slotName: formData.slotName,
        roomType: formData.roomType,
        category: formData.category,
        timeSlot: {
          startTime: formData.startTime?.toTimeString().slice(0, 5),
          endTime: formData.endTime?.toTimeString().slice(0, 5),
          duration: calculateDuration(formData.startTime, formData.endTime)
        },
        pricing: {
          basePrice: formData.basePrice,
          currency: 'USD',
          perGuestCharge: formData.perGuestCharge
        },
        capacity: {
          maxGuests: formData.maxGuests,
          includedGuests: formData.includedGuests
        },
        availability: {
          isAvailable: formData.isAvailable,
          minimumAdvanceBooking: formData.minimumAdvanceBooking,
          maximumAdvanceBooking: formData.maximumAdvanceBooking,
          blackoutDates: []
        },
        operationalDays: formData.operationalDays,
        inclusions: formData.inclusions,
        restrictions: {
          ageRestrictions: {
            minAge: formData.minAge,
            maxAge: formData.maxAge,
            childrenAllowed: formData.childrenAllowed
          },
          guestRestrictions: formData.guestRestrictions
        }
      };

      if (editingSlot) {
        await axios.put(`/api/v1/day-use/slots/${editingSlot._id}`, submitData);
        onSlotUpdated();
        toast.success('Slot updated successfully');
      } else {
        await axios.post('/api/v1/day-use/slots', submitData);
        onSlotCreated();
        toast.success('Slot created successfully');
      }

      handleCloseDialog();
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to save slot');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    if (!window.confirm('Are you sure you want to delete this slot?')) {
      return;
    }

    try {
      await axios.delete(`/api/v1/day-use/slots/${slotId}`);
      onSlotDeleted();
      toast.success('Slot deleted successfully');
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to delete slot');
    }
  };

  const calculateDuration = (start: Date | null, end: Date | null): number => {
    if (!start || !end) return 0;
    return Math.abs(end.getTime() - start.getTime()) / (1000 * 60);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, slot: Slot) => {
    setAnchorEl(event.currentTarget);
    setSelectedSlot(slot);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSlot(null);
  };

  const handleOperationalDayChange = (index: number, enabled: boolean) => {
    const newDays = [...formData.operationalDays];
    newDays[index] = { ...newDays[index], enabled };
    setFormData({ ...formData, operationalDays: newDays });
  };

  const handleInclusionToggle = (inclusion: string) => {
    const newInclusions = formData.inclusions.includes(inclusion)
      ? formData.inclusions.filter(i => i !== inclusion)
      : [...formData.inclusions, inclusion];
    setFormData({ ...formData, inclusions: newInclusions });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Time Slot Configuration</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Slot
          </Button>
        </Box>

        {/* Slots Grid */}
        <Grid container spacing={3}>
          {slots.map((slot) => (
            <Grid item xs={12} md={6} lg={4} key={slot._id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Box>
                      <Typography variant="h6" component="h3">
                        {slot.slotName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {slot.roomType}
                      </Typography>
                    </Box>
                    <IconButton onClick={(e) => handleMenuOpen(e, slot)}>
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Box display="flex" alignItems="center" mb={1}>
                    <ScheduleIcon sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2">
                      {slot.timeSlot.startTime} - {slot.timeSlot.endTime}
                    </Typography>
                  </Box>

                  <Box display="flex" alignItems="center" mb={1}>
                    <AttachMoneyIcon sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2">
                      ${slot.pricing.basePrice} base
                      {slot.pricing.perGuestCharge > 0 && 
                        ` + $${slot.pricing.perGuestCharge}/guest`
                      }
                    </Typography>
                  </Box>

                  <Box display="flex" alignItems="center" mb={2}>
                    <PeopleIcon sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2">
                      Up to {slot.capacity.maxGuests} guests
                    </Typography>
                  </Box>

                  <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                    <Chip 
                      size="small" 
                      label={slot.category} 
                      color="primary"
                    />
                    {slot.availability.isAvailable ? (
                      <Chip size="small" label="Available" color="success" />
                    ) : (
                      <Chip size="small" label="Unavailable" color="error" />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    {slot.inclusions.length} inclusions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {slots.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <HotelIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" mb={1}>
              No Time Slots Created
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Create your first day use time slot to start managing bookings
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Create First Slot
            </Button>
          </Paper>
        )}

        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => {
            if (selectedSlot) handleOpenDialog(selectedSlot);
            handleMenuClose();
          }}>
            <EditIcon sx={{ mr: 1 }} /> Edit
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedSlot) handleDelete(selectedSlot._id);
            handleMenuClose();
          }}>
            <DeleteIcon sx={{ mr: 1 }} /> Delete
          </MenuItem>
        </Menu>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingSlot ? 'Edit Time Slot' : 'Create New Time Slot'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" mb={2}>Basic Information</Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Slot Name"
                  value={formData.slotName}
                  onChange={(e) => setFormData({ ...formData, slotName: e.target.value })}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Room Type</InputLabel>
                  <Select
                    value={formData.roomType}
                    label="Room Type"
                    onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                  >
                    {roomTypes.map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Time Configuration */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" mb={2}>Time Configuration</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TimePicker
                  label="Start Time"
                  value={formData.startTime}
                  onChange={(time) => setFormData({ ...formData, startTime: time })}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TimePicker
                  label="End Time"
                  value={formData.endTime}
                  onChange={(time) => setFormData({ ...formData, endTime: time })}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                />
              </Grid>

              {formData.startTime && formData.endTime && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    Duration: {Math.floor(calculateDuration(formData.startTime, formData.endTime) / 60)} hours {calculateDuration(formData.startTime, formData.endTime) % 60} minutes
                  </Alert>
                </Grid>
              )}

              {/* Pricing */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" mb={2}>Pricing</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Base Price ($)"
                  type="number"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Per Additional Guest ($)"
                  type="number"
                  value={formData.perGuestCharge}
                  onChange={(e) => setFormData({ ...formData, perGuestCharge: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Capacity */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" mb={2}>Capacity Settings</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Maximum Guests"
                  type="number"
                  value={formData.maxGuests}
                  onChange={(e) => setFormData({ ...formData, maxGuests: Number(e.target.value) })}
                  inputProps={{ min: 1, max: 20 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Included Guests (no extra charge)"
                  type="number"
                  value={formData.includedGuests}
                  onChange={(e) => setFormData({ ...formData, includedGuests: Number(e.target.value) })}
                  inputProps={{ min: 1, max: formData.maxGuests }}
                />
              </Grid>

              {/* Operational Days */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" mb={2}>Operational Days</Typography>
                {dayNames.map((day, index) => (
                  <FormControlLabel
                    key={day}
                    control={
                      <Checkbox
                        checked={formData.operationalDays[index]?.enabled || false}
                        onChange={(e) => handleOperationalDayChange(index, e.target.checked)}
                      />
                    }
                    label={day}
                  />
                ))}
              </Grid>

              {/* Inclusions */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" mb={2}>Inclusions</Typography>
                <Box maxHeight={200} overflow="auto">
                  {commonInclusions.map((inclusion) => (
                    <FormControlLabel
                      key={inclusion}
                      control={
                        <Checkbox
                          checked={formData.inclusions.includes(inclusion)}
                          onChange={() => handleInclusionToggle(inclusion)}
                        />
                      }
                      label={inclusion}
                    />
                  ))}
                </Box>
              </Grid>

              {/* Availability Settings */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" mb={2}>Availability Settings</Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isAvailable}
                      onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                    />
                  }
                  label="Available for Booking"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Minimum Advance Booking (hours)"
                  type="number"
                  value={formData.minimumAdvanceBooking}
                  onChange={(e) => setFormData({ ...formData, minimumAdvanceBooking: Number(e.target.value) })}
                  inputProps={{ min: 0 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Maximum Advance Booking (days)"
                  type="number"
                  value={formData.maximumAdvanceBooking}
                  onChange={(e) => setFormData({ ...formData, maximumAdvanceBooking: Number(e.target.value) })}
                  inputProps={{ min: 1 }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" disabled={loading}>
              {loading ? 'Saving...' : editingSlot ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default SlotManager;