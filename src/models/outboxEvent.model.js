import mongoose from 'mongoose';

const outboxEventSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    aggregateType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    aggregateId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedAt: Date,
    lastError: String,
  },
  {
    timestamps: true,
  },
);

outboxEventSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
outboxEventSchema.index({ topic: 1, aggregateType: 1, aggregateId: 1, createdAt: -1 });

const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema);

export default OutboxEvent;
