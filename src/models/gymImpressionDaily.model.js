import mongoose from 'mongoose';

const gymImpressionDailySchema = new mongoose.Schema(
  {
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    openCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastImpressionAt: {
      type: Date,
      default: null,
    },
    lastOpenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

gymImpressionDailySchema.index({ gym: 1, date: 1 }, { unique: true });

const GymImpressionDaily = mongoose.model('GymImpressionDaily', gymImpressionDailySchema);

export default GymImpressionDaily;
