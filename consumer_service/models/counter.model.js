const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["customer", "order"],
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

// this ensures only one counter per owner+type
counterSchema.index({ ownerId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Counter", counterSchema);
