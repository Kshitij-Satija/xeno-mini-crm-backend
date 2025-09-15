require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { connectRabbitMQ } = require("./config/rabbitmq");
const validateEnv = require("./config/validateEnv");

// Consumers
const startCustomerConsumer = require("./consumers/customer.consumer"); // create
const startCustomerUpdateConsumer = require("./consumers/customerUpdate.consumer");
const startCustomerDeleteConsumer = require("./consumers/customerDelete.consumer");
const startOrderConsumer = require("./consumers/order.consumer");
const startOrderUpdateConsumer = require("./consumers/orderUpdate.consumer");
const startOrderDeleteConsumer = require("./consumers/orderDelete.consumer");

validateEnv();

const startServer = async () => {
  // DB
  await connectDB();

  // RabbitMQ
  await connectRabbitMQ();

  // Start Consumers
  startCustomerConsumer();
  startCustomerUpdateConsumer();
  startCustomerDeleteConsumer();
  startOrderConsumer();
  startOrderUpdateConsumer();
  startOrderDeleteConsumer();

  console.log("Consumer Service is running and listening to queues");

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors({
    origin: true,
    credentials: true
  }));

  //app.get("/", (req, res) => {
  //  res.send("Consumer Service is up and running");
  //});

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
