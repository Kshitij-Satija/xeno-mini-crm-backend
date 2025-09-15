const mongoose = require("mongoose");

const connectDB = async (retries = 5, delay = 5000) => {
  if (!process.env.CAMPAIGN_DB_URI) throw new Error("CAMPAIGN_DB_URI missing");

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.CAMPAIGN_DB_URI, {});
      console.log("Connected to Campaign MongoDB");
      return;
    } catch (err) {
      console.error(`Campaign DB connection error (attempt ${i + 1} of ${retries}):`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying DB connection in ${delay / 1000} seconds...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error("Max retries reached. Could not connect to Campaign DB.");
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
