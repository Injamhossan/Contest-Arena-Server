const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contest',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    submissionLink: {
      type: String,
      default: '',
    },
    submissionText: {
      type: String,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['paid'],
      default: 'paid',
    },
    paymentId: {
      type: String,
      required: true,
    },
    transactionId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only participate once per contest
submissionSchema.index({ contestId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);

