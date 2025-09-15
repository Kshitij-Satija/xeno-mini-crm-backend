const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.CRM_MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }
    console.log("onnecting to MongoDB...");
    await mongoose.connect(process.env.CRM_MONGO_URI, {
      
    });

    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
