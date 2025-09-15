const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.CUSTOMER_DB_URI) throw new Error("CUSTOMER_DB_URI missing");
    await mongoose.connect(process.env.CUSTOMER_DB_URI);
    console.log("Customer DB connected");
  } catch (err) {
    console.error("DB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
