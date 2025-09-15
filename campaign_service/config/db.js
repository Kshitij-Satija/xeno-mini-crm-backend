const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.CAMPAIGN_DB_URI, {});
    console.log("Connected to Campaign MongoDB");
  } catch (err) {
    console.error("Campaign DB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
