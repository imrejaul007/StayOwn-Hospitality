import mongoose from 'mongoose';

const hotelServiceFavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  serviceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'HotelService',
    required: true,
    index: true
  }
}, { timestamps: true });

hotelServiceFavoriteSchema.index({ userId: 1, hotelId: 1, serviceId: 1 }, { unique: true });

export default mongoose.model('HotelServiceFavorite', hotelServiceFavoriteSchema);
