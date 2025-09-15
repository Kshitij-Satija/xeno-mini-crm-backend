require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const { connectRabbitMQ } = require("./config/rabbitmq");
const validateEnv = require("./config/validateEnv");

// Consumers
const startCampaignCreateConsumer = require("./consumers/campaignCreate.consumer");
const startCampaignProcessConsumer = require("./consumers/campaignProcess.consumer");
const startCampaignDeliveryConsumer = require("./consumers/campaignDelivery.consumer");
const startDeliveryReceiptsConsumer = require("./consumers/campaignDeliveryReceipts.consumer");

// Scheduler
const startScheduler = require("./workers/schedular");

validateEnv();

const startServer = async () => {
  try {
    // DB
    await connectDB();

    // RabbitMQ
    await connectRabbitMQ();

    // Start Consumers
    startCampaignCreateConsumer();
    startCampaignProcessConsumer();
    startCampaignDeliveryConsumer();
    startDeliveryReceiptsConsumer();

    // Start Scheduler
    startScheduler();

    console.log("Campaign Consumer Service + Scheduler running and listening to queues");

    // Create HTTP server (for Render health checks + CORS)
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Enable CORS with origin:true
    app.use(cors({
      origin: true,
      credentials: true
    }));

    // Routes
    app.get("/", (req, res) => {
      res.send("Campaign Consumer Service + Scheduler is up and running");
    });

    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok" });
    });

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

  } catch (err) {
    console.error("Failed to start Campaign Consumer Service:", err);
    process.exit(1);
  }
};

startServer();
