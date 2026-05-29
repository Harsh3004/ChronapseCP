import mongoose from 'mongoose';

const contestSchema = new mongoose.Schema(
  {
    contestId: {
      type: String,
      required: [true, 'contestId is required'],
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Contest name is required'],
      trim: true,
    },
    platform: {
      type: String,
      required: [true, 'Platform is required'],
      trim: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },

    // The Google Calendar event ID returned after a successful event insert
    // Null until the event has been created.
    calendarEventId: {
      type: String,
      default: null,
    },

    // Tracks whether the 24-hour WhatsApp reminder has been dispatched
    // Prevents duplicate notifications on subsequent hourly runs
    notified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

contestSchema.index({ notified: 1, startTime: 1 });

const Contest = mongoose.model('Contest', contestSchema);

export default Contest;
