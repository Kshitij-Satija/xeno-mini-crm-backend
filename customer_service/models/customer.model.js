const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  customerId: {
    type: Number,
    required: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },

  metadata: {
    dob: Date,
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    location: String,
  },

  lifetimeSpend: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  lastOrderDate: { type: Date },
});

// ensure one customer per owner+email
customerSchema.index({ ownerId: 1, email: 1 }, { unique: true, sparse: true });

// ensure per-owner customerId uniqueness
customerSchema.index({ ownerId: 1, customerId: 1 }, { unique: true });

module.exports = mongoose.model("Customer", customerSchema);
