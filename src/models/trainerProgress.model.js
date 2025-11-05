import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
    notes: { type: String },
  },
  { _id: false },
);

const progressMetricSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true },
    value: { type: Number, required: true },
    unit: { type: String },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const dietPlanSchema = new mongoose.Schema(
  {
    weekOf: { type: Date, required: true },
    meals: {
      type: [
        {
          name: { type: String },
          description: { type: String },
          calories: { type: Number },
          macros: { type: Map, of: Number },
        },
      ],
      default: [],
    },
    notes: { type: String },
  },
  { _id: false },
);

const feedbackSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    category: {
      type: String,
      enum: ['progress', 'nutrition', 'attendance', 'general'],
      default: 'general',
    },
    reviewedAt: { type: Date },
  },
);

const trainerProgressSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    trainee: {
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
    attendance: {
      type: [attendanceSchema],
      default: [],
    },
    progressMetrics: {
      type: [progressMetricSchema],
      default: [],
    },
    dietPlans: {
      type: [dietPlanSchema],
      default: [],
    },
    feedback: {
      type: [feedbackSchema],
      default: [],
    },
    summary: { type: String },
  },
  { timestamps: true },
);

trainerProgressSchema.index({ trainee: 1, trainer: 1 }, { unique: true });

const TrainerProgress = mongoose.model('TrainerProgress', trainerProgressSchema);

export default TrainerProgress;
export { TrainerProgress };
