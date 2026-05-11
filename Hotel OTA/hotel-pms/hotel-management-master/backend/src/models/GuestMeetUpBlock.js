import mongoose from 'mongoose';

const guestMeetUpBlockSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    blockerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    blockedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

guestMeetUpBlockSchema.index({ hotelId: 1, blockerUserId: 1, blockedUserId: 1 }, { unique: true });

export default mongoose.model('GuestMeetUpBlock', guestMeetUpBlockSchema);
