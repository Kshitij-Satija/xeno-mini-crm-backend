const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  campaignName: { type: String },
  rules: { type: Object, required: true }, // { logic: 'AND', rules: [] }
  message: { type: String, required: true },

  stats: {
    audienceSize: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },

  status: {
    type: String,
    enum: ["PENDING", "SCHEDULED", "PROCESSING", "COMPLETED"],
    default: "PENDING",
  },

  deliveryMode: {
    type: String,
    enum: ["IMMEDIATE", "SCHEDULED"],
    default: "IMMEDIATE",
  },

  scheduledAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },

  tags: { type: [String], default: [] },
});

module.exports = mongoose.model("Campaign", campaignSchema);
