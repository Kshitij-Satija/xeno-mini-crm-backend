const mongoose = require("mongoose");

const communicationLogSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  customerNumericId: { type: Number },
  message: { type: String, required: true },
  vendorMessageId: { type: String }, // vendor-provided id or we use comm._id
  status: { type: String, enum: ["SENT", "FAILED", "PENDING"], default: "PENDING" },
  lastUpdatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

communicationLogSchema.index({ campaignId: 1 });
communicationLogSchema.index({ ownerId: 1 });

module.exports = mongoose.model("CommunicationLog", communicationLogSchema);
