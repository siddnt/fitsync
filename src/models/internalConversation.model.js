import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const internalConversationSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: ['owner-manager', 'owner-admin', 'admin-manager'],
      required: true,
    },
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      default: null,
    },
    participants: {
      type: [participantSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: 'At least two participants are required.',
      },
      required: true,
      default: [],
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

internalConversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 });
internalConversationSchema.index({ category: 1, lastMessageAt: -1 });
internalConversationSchema.index({ gym: 1, lastMessageAt: -1 });

const InternalConversation = mongoose.model('InternalConversation', internalConversationSchema);

export default InternalConversation;
