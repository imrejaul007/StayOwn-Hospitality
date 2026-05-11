import mongoose from 'mongoose';

const widgetSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['chart', 'metric', 'table', 'gauge', 'map', 'kpi'],
    required: true,
  },
  chartType: {
    type: String,
    enum: ['bar', 'line', 'pie', 'doughnut', 'area', 'scatter'],
  },
  title: { type: String, required: true },
  dataSource: { type: String, required: true },
  filters: [{
    field: String,
    operator: String,
    value: mongoose.Schema.Types.Mixed,
  }],
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 4 },
    height: { type: Number, default: 3 },
  },
  refreshInterval: { type: Number, default: 300 },
}, { _id: true });

const dashboardConfigSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.ObjectId, ref: 'Hotel', required: true, index: true },
  userId: { type: mongoose.Schema.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  widgets: [widgetSchema],
  isDefault: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
}, {
  timestamps: true,
});

dashboardConfigSchema.index({ hotelId: 1, userId: 1 });

const DashboardConfig = mongoose.model('DashboardConfig', dashboardConfigSchema);
export default DashboardConfig;
