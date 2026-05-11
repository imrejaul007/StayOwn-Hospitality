import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Avatar,
  Tooltip,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress,
  Collapse
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckInIcon,
  ExitToApp as CheckOutIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  AttachMoney as AttachMoneyIcon,
  Hotel as HotelIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Booking {
  _id: string;
  bookingId: string;
  guestInfo: {
    primaryGuest: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
    totalGuests: number;
    additionalGuests: Array<{
      firstName: string;
      lastName: string;
      age?: number;
    }>;
  };
  bookingDetails: {
    slotId: {
      slotName: string;
      roomType: string;
      timeSlot: {
        startTime: string;
        endTime: string;
      };
    };
    bookingDate: string;
    roomNumber?: string;
  };
  pricing: {
    totalAmount: number;
    paidAmount: number;
    currency: string;
  };
  status: {
    bookingStatus: string;
    paymentStatus: string;
    roomStatus: string;
  };
  timeline: {
    bookedAt: string;
    confirmedAt?: string;
    checkedInAt?: string;
    checkedOutAt?: string;
    cancelledAt?: string;
  };
  operational: {
    source: string;
  };
}

interface DayUseBookingsTableProps {
  bookings: Booking[];
  selectedDate: Date;
  onBookingUpdated: () => void;
  loading: boolean;
}

const DayUseBookingsTable: React.FC<DayUseBookingsTableProps> = ({
  bookings,
  selectedDate,
  onBookingUpdated,
  loading
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'view' | 'edit' | 'cancel' | 'checkin' | 'checkout'>('view');
  const [cancellationReason, setCancellationReason] = useState('');
  const [roomAssignment, setRoomAssignment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState('all');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, booking: Booking) => {
    setAnchorEl(event.currentTarget);
    setSelectedBooking(booking);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedBooking(null);
  };

  const handleDialogOpen = (type: typeof dialogType) => {
    setDialogType(type);
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedBooking(null);
    setCancellationReason('');
    setRoomAssignment('');
  };

  const handleCheckIn = async () => {
    if (!selectedBooking) return;

    setActionLoading(true);
    try {
      await axios.post(`/api/v1/day-use/bookings/${selectedBooking._id}/checkin`, {
        roomAssignment: roomAssignment ? [{ roomNumber: roomAssignment }] : undefined
      });
      
      onBookingUpdated();
      toast.success('Guest checked in successfully');
      handleDialogClose();
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to check in guest');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedBooking) return;

    setActionLoading(true);
    try {
      await axios.post(`/api/v1/day-use/bookings/${selectedBooking._id}/checkout`);
      
      onBookingUpdated();
      toast.success('Guest checked out successfully');
      handleDialogClose();
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to check out guest');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedBooking || !cancellationReason) return;

    setActionLoading(true);
    try {
      await axios.post(`/api/v1/day-use/bookings/${selectedBooking._id}/cancel`, {
        reason: cancellationReason
      });
      
      onBookingUpdated();
      toast.success('Booking cancelled successfully');
      handleDialogClose();
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'primary';
      case 'checked_in': return 'success';
      case 'in_use': return 'info';
      case 'checked_out': return 'default';
      case 'cancelled': return 'error';
      case 'no_show': return 'warning';
      default: return 'default';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'pending': return 'error';
      case 'refunded': return 'default';
      default: return 'default';
    }
  };

  const toggleRowExpansion = (bookingId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(bookingId)) {
      newExpanded.delete(bookingId);
    } else {
      newExpanded.add(bookingId);
    }
    setExpandedRows(newExpanded);
  };

  const filteredBookings = filterStatus === 'all' 
    ? bookings 
    : bookings.filter(booking => booking.status.bookingStatus === filterStatus);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const BookingDetailsCard = ({ booking }: { booking: Booking }) => (
    <Card variant="outlined" sx={{ mt: 2, mb: 2 }}>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" mb={2}>Guest Information</Typography>
            <Box display="flex" alignItems="center" mb={1}>
              <PersonIcon sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="body2">
                {booking.guestInfo.primaryGuest.firstName} {booking.guestInfo.primaryGuest.lastName}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" mb={1}>
              <EmailIcon sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="body2">{booking.guestInfo.primaryGuest.email}</Typography>
            </Box>
            <Box display="flex" alignItems="center" mb={1}>
              <PhoneIcon sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="body2">{booking.guestInfo.primaryGuest.phone}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Total Guests: {booking.guestInfo.totalGuests}
            </Typography>
            {booking.guestInfo.additionalGuests?.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" mb={1}>Additional Guests:</Typography>
                {booking.guestInfo.additionalGuests.map((guest, index) => (
                  <Typography key={`booking-guestInfo-additionalGuests-${index}`} variant="body2" color="text.secondary">
                    • {guest.firstName} {guest.lastName} {guest.age ? `(${guest.age} years)` : ''}
                  </Typography>
                ))}
              </Box>
            )}
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" mb={2}>Booking Details</Typography>
            <Box display="flex" alignItems="center" mb={1}>
              <HotelIcon sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="body2">
                {booking.bookingDetails.slotId.slotName} - {booking.bookingDetails.slotId.roomType}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" mb={1}>
              <ScheduleIcon sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="body2">
                {booking.bookingDetails.slotId.timeSlot.startTime} - {booking.bookingDetails.slotId.timeSlot.endTime}
              </Typography>
            </Box>
            {booking.bookingDetails.roomNumber && (
              <Typography variant="body2" mb={1}>
                Room: {booking.bookingDetails.roomNumber}
              </Typography>
            )}
            <Box display="flex" alignItems="center" mb={1}>
              <AttachMoneyIcon sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="body2">
                Total: {booking.pricing.currency} {booking.pricing.totalAmount}
                {booking.pricing.paidAmount > 0 && 
                  ` (Paid: ${booking.pricing.currency} ${booking.pricing.paidAmount})`
                }
              </Typography>
            </Box>
            
            <Box mt={2}>
              <Typography variant="subtitle2" mb={1}>Timeline:</Typography>
              <Typography variant="body2" color="text.secondary">
                Booked: {format(new Date(booking.timeline.bookedAt), 'MMM dd, yyyy HH:mm')}
              </Typography>
              {booking.timeline.confirmedAt && (
                <Typography variant="body2" color="text.secondary">
                  Confirmed: {format(new Date(booking.timeline.confirmedAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
              )}
              {booking.timeline.checkedInAt && (
                <Typography variant="body2" color="text.secondary">
                  Checked In: {format(new Date(booking.timeline.checkedInAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
              )}
              {booking.timeline.checkedOutAt && (
                <Typography variant="body2" color="text.secondary">
                  Checked Out: {format(new Date(booking.timeline.checkedOutAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
              )}
              {booking.timeline.cancelledAt && (
                <Typography variant="body2" color="error">
                  Cancelled: {format(new Date(booking.timeline.cancelledAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  if (loading && bookings.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with filters */}
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Bookings for {format(selectedDate, 'MMMM dd, yyyy')}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="checked_in">Checked In</MenuItem>
            <MenuItem value="in_use">In Use</MenuItem>
            <MenuItem value="checked_out">Checked Out</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="no_show">No Show</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {filteredBookings.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" mb={1}>
            No bookings found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filterStatus !== 'all' ? 
              `No bookings with status "${filterStatus}" for this date.` :
              'No bookings scheduled for this date.'
            }
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                <TableCell>Booking ID</TableCell>
                <TableCell>Guest</TableCell>
                <TableCell>Slot</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Guests</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBookings
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((booking) => (
                  <React.Fragment key={booking._id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(booking._id)}
                        >
                          {expandedRows.has(booking._id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {booking.bookingId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {booking.operational.source}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {booking.guestInfo.primaryGuest.firstName} {booking.guestInfo.primaryGuest.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {booking.guestInfo.primaryGuest.phone}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {booking.bookingDetails.slotId.slotName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {booking.bookingDetails.slotId.roomType}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {booking.bookingDetails.slotId.timeSlot.startTime} - {booking.bookingDetails.slotId.timeSlot.endTime}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {booking.guestInfo.totalGuests}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {booking.pricing.currency} {booking.pricing.totalAmount}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={booking.status.bookingStatus.replace('_', ' ')}
                          color={getStatusColor(booking.status.bookingStatus) as unknown}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={booking.status.paymentStatus}
                          color={getPaymentStatusColor(booking.status.paymentStatus) as unknown}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={(e) => handleMenuOpen(e, booking)}>
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={10} sx={{ p: 0 }}>
                        <Collapse in={expandedRows.has(booking._id)} timeout="auto" unmountOnExit>
                          <BookingDetailsCard booking={booking} />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
            </TableBody>
          </Table>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredBookings.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleDialogOpen('view')}>
          <ViewIcon sx={{ mr: 1 }} /> View Details
        </MenuItem>
        {selectedBooking?.status.bookingStatus === 'confirmed' && (
          <MenuItem onClick={() => handleDialogOpen('checkin')}>
            <CheckInIcon sx={{ mr: 1 }} /> Check In
          </MenuItem>
        )}
        {(selectedBooking?.status.bookingStatus === 'checked_in' || 
          selectedBooking?.status.bookingStatus === 'in_use') && (
          <MenuItem onClick={() => handleDialogOpen('checkout')}>
            <CheckOutIcon sx={{ mr: 1 }} /> Check Out
          </MenuItem>
        )}
        {selectedBooking?.status.bookingStatus !== 'cancelled' &&
         selectedBooking?.status.bookingStatus !== 'checked_out' && (
          <MenuItem onClick={() => handleDialogOpen('cancel')}>
            <CancelIcon sx={{ mr: 1 }} /> Cancel
          </MenuItem>
        )}
      </Menu>

      {/* Action Dialogs */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogType === 'view' && 'Booking Details'}
          {dialogType === 'checkin' && 'Check In Guest'}
          {dialogType === 'checkout' && 'Check Out Guest'}
          {dialogType === 'cancel' && 'Cancel Booking'}
        </DialogTitle>
        <DialogContent>
          {dialogType === 'view' && selectedBooking && (
            <BookingDetailsCard booking={selectedBooking} />
          )}
          
          {dialogType === 'checkin' && (
            <Box>
              <Typography variant="body1" mb={3}>
                Check in guest: {selectedBooking?.guestInfo.primaryGuest.firstName} {selectedBooking?.guestInfo.primaryGuest.lastName}
              </Typography>
              <TextField
                fullWidth
                label="Room Assignment (Optional)"
                value={roomAssignment}
                onChange={(e) => setRoomAssignment(e.target.value)}
                placeholder="e.g., 101, 205A"
              />
            </Box>
          )}
          
          {dialogType === 'checkout' && (
            <Typography variant="body1">
              Confirm check out for: {selectedBooking?.guestInfo.primaryGuest.firstName} {selectedBooking?.guestInfo.primaryGuest.lastName}
            </Typography>
          )}
          
          {dialogType === 'cancel' && (
            <Box>
              <Alert severity="warning" sx={{ mb: 3 }}>
                This action will cancel the booking and may trigger refund processing.
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Cancellation Reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                required
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          {dialogType === 'checkin' && (
            <Button onClick={handleCheckIn} variant="contained" disabled={actionLoading}>
              {actionLoading ? 'Checking In...' : 'Check In'}
            </Button>
          )}
          {dialogType === 'checkout' && (
            <Button onClick={handleCheckOut} variant="contained" disabled={actionLoading}>
              {actionLoading ? 'Checking Out...' : 'Check Out'}
            </Button>
          )}
          {dialogType === 'cancel' && (
            <Button 
              onClick={handleCancel} 
              variant="contained" 
              color="error"
              disabled={actionLoading || !cancellationReason}
            >
              {actionLoading ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DayUseBookingsTable;