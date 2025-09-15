const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { connectRabbitMQ } = require("./config/rabbitmq");
const validateEnv = require("./config/validateEnv");
const customerRoutes = require("./routes/customer.routes");
const orderRoutes = require("./routes/order.routes");
const custorderRoutes = require("./routes/overview.routes");

require("dotenv").config();
validateEnv();

const app = express();

connectDB();
connectRabbitMQ();

app.use(cors({
  origin: [process.env.API_GATEWAY_URI, process.env.FRONTEND_URI, process.env.CAMPAIGN_SERVICE_URI],
  credentials: true,
  allowedHeaders: ["Content-Type", "X-User-Id", "X-User-Email", "X-Proxied", "x-user-id", "x-user-email"]

}));

// Parse JSON AND preserve raw body for logging / proxy
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Log every incoming request
app.use((req, res, next) => {
  console.log("[Customer Service] Received request");
  console.log(`${req.method} ${req.originalUrl}`);
  //console.log(`Headers:`, req.headers);
  //console.log(`Raw body:`, req.rawBody || "No body");
  //console.log(`Parsed body:`, req.body || "No parsed body");
  next();
});

// Routes
app.use("/customers", customerRoutes);
app.use("/orders", orderRoutes);
app.use("/custorder", custorderRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => console.log(`Customer Service running on PORT ${PORT}`));
