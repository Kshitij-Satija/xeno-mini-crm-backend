// vendor-api/server.js
require("dotenv").config(); // ✅ load .env variables first

const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// enable CORS from any origin
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

app.get("/health", (req, res) => {
  console.log("Vendor API health check hit");
  res.json({ status: "ok", service: "vendor-api" });
});

// Simulate vendor sending messages
app.post("/send", async (req, res) => {
  try {
    const { campaignId, customerId, ownerId, commLogId, message } = req.body;

    console.log("Received /send request:", {
      campaignId,
      customerId,
      ownerId,
      commLogId,
      message,
    });

    if (!campaignId || !customerId || !commLogId) {
      console.warn("Invalid payload received at Vendor API");
      return res.status(400).json({ message: "Invalid payload" });
    }

    // Generate vendor message ID
    const vendorMessageId = `v_${commLogId}`;
    console.log(`Generated vendorMessageId: ${vendorMessageId}`);

    // Simulate async delivery (success 90%, fail 10%)
    const success = Math.random() > 0.1;
    const status = success ? "SENT" : "FAILED";
    console.log(`Delivery simulation result: ${status}`);

    // Call back your delivery receipt API
    const callbackUrl = `${process.env.CAMPAIGN_SERVICE_URI}/campaigns/delivery-receipt`;
    console.log(`Sending delivery receipt callback to ${callbackUrl}`);

    await axios.post(
      callbackUrl,
      {
        vendorMessageId,
        campaignId,
        customerId,
        status,
        timestamp: new Date(),
      },
      { headers: { "x-user-id": ownerId } }
    );

    console.log(`Callback sent successfully for customer ${customerId} with status ${status}`);

    return res.json({ vendorMessageId, status });
  } catch (err) {
    console.error("Vendor API error:", err.message);
    return res.status(500).json({ message: "Vendor failure" });
  }
});

const PORT = process.env.VENDOR_PORT || 9000;
app.listen(PORT, () => console.log(`Dummy Vendor API running on ${PORT}`));
