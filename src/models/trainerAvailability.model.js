import mongoose from 'mongoose';

const trainerSlotSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 1,
      min: 1,
    },
    locationLabel: {
      type: String,
      trim: true,
      default: '',
    },
    sessionType: {
      type: String,
      trim: true,
      default: 'personal-training',
    },
  },
  { _id: true },
);

const trainerAvailabilitySchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    slots: {
      type: [trainerSlotSchema],
      default: [],
    },
    timezone: {
      type: String,
      default: 'Asia/Calcutta',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
);

trainerAvailabilitySchema.index({ trainer: 1, gym: 1 }, { unique: true });

const TrainerAvailability = mongoose.model('TrainerAvailability', trainerAvailabilitySchema);

export default TrainerAvailability;
