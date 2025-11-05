import mongoose from 'mongoose';

const traineeRecordSchema = new mongoose.Schema(
  {
    trainee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
    },
    goals: { type: [String], default: [] },
  },
  { _id: false },
);

const trainerAssignmentSchema = new mongoose.Schema(
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
    trainees: {
      type: [traineeRecordSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    notes: { type: String },
  },
  { timestamps: true },
);

trainerAssignmentSchema.index({ trainer: 1, gym: 1 }, { unique: true });

const TrainerAssignment = mongoose.model('TrainerAssignment', trainerAssignmentSchema);

export default TrainerAssignment;
export { TrainerAssignment };
