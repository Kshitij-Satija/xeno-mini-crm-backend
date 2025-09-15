// keepAlive.js
const axios = require("axios");
const cron = require("node-cron");
require("dotenv").config();

const backendUrls = [
  process.env.BACKEND_URL || "https://xeno-mini-crm-api-gateway.onrender.com/api/health",
  "https://xeno-mini-crm-customer-service.onrender.com/health",
  "https://xeno-mini-crm-campaign-service.onrender.com/health",
];

const keepAlive = () => {
  cron.schedule(
    "*/2 * * * *", // every 2 minutes
    async () => {
      for (const url of backendUrls) {
        try {
          await axios.get(url, { timeout: 5000 }); // ✅ ping directly
          console.log(`[KeepAlive] ✅ Ping OK: ${url}`);
        } catch (error) {
          console.error(`[KeepAlive] ❌ Ping failed for ${url}: ${error.message}`);
        }
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  console.log("[KeepAlive] Cron job scheduled (every 2 minutes).");
};

module.exports = keepAlive;
