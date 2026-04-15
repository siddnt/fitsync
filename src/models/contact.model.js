import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    subject: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: ['general', 'billing', 'technical', 'membership', 'marketplace'],
      default: 'general'
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["new", "read", "in-progress", "responded", "closed"],
      default: "new"
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      default: null
    },
    internalNotes: {
      type: String,
      trim: true,
      default: ''
    },
    replies: {
      type: [
        new mongoose.Schema(
          {
            author: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
              default: null
            },
            authorRole: {
              type: String,
              trim: true,
              default: 'admin'
            },
            message: {
              type: String,
              required: true,
              trim: true
            },
            createdAt: {
              type: Date,
              default: Date.now
            }
          },
          { _id: true }
        )
      ],
      default: []
    }
  },
  {
    timestamps: true
  }
);

contactSchema.index({ status: 1, priority: 1, createdAt: -1 });
contactSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
contactSchema.index({ gym: 1, status: 1, createdAt: -1 });

const Contact = mongoose.model("Contact", contactSchema);

export default Contact; 
