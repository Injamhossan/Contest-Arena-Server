const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    prizeMoney: {
      type: Number,
      required: true,
      min: 0,
    },
    taskInstructions: {
      type: String,
      required: true,
    },
    contestType: {
      type: String,
      required: true,
      trim: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    creatorName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'pending',
    },
    deadline: {
      type: Date,
      required: true,
    },
    participantsCount: {
      type: Number,
      default: 0,
    },
    participationLimit: {
      type: Number,
      required: true,
      default: 0, // 0 means unlimited, or we can enforce a limit. User said "oita lekhar option diba", so creator sets it.
    },
    winnerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    winnerName: {
      type: String,
      default: '',
    },
    winnerPhotoURL: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
contestSchema.index({ status: 1, createdAt: -1 });
contestSchema.index({ participantsCount: -1 });
contestSchema.index({ contestType: 1 });

module.exports = mongoose.model('Contest', contestSchema);

