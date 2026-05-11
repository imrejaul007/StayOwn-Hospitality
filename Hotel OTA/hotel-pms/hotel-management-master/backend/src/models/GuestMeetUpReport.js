import mongoose from 'mongoose';

const guestMeetUpReportSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    meetUpRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MeetUpRequest'
    },
    reason: {
      type: String,
      enum: ['harassment', 'spam', 'inappropriate', 'safety', 'other'],
      required: true
    },
    details: {
      type: String,
      maxlength: 2000,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'dismissed'],
      default: 'pending',
      index: true
    }
  },
  { timestamps: true }
);

guestMeetUpReportSchema.index({ hotelId: 1, createdAt: -1 });

export default mongoose.model('GuestMeetUpReport', guestMeetUpReportSchema);
