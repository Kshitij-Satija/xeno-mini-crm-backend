const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  orderId: { type: Number, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  customerNumericId: { type: Number },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["PENDING", "SHIPPED", "COMPLETED"],
    default: "PENDING"
  },
  date: { type: Date, default: Date.now }
});

// this ensures per-owner orderId uniqueness
OrderSchema.index({ ownerId: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model("Order", OrderSchema);
