require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const validateEnv = require("./config/validateEnv");
const connectDB = require("./config/db");
const { connectRabbitMQ } = require("./config/rabbitmq");
const campaignRoutes = require("./routes/campaign.routes");
const aiRoutes = require("./routes/ai.routes");

validateEnv();

const app = express();
app.use(cors({
  origin: [process.env.API_GATEWAY_URI, process.env.FRONTEND_URI],
  credentials: true,
  allowedHeaders: ["Content-Type", "X-User-Id", "X-User-Email", "X-Proxied", "x-user-id", "x-user-email"]

}));
app.use(express.json());
app.use(morgan("dev"));

app.use("/campaigns/ai", aiRoutes);
app.use("/campaigns", campaignRoutes);


app.get("/health", (req, res) => res.json({ status: "ok", service: "campaign_service" }));

// init connections and start
const PORT = process.env.PORT || 7000;
const start = async () => {
  await connectDB();
  await connectRabbitMQ();
  app.listen(PORT, () => console.log(`Campaign Service running on port ${PORT}`));
};

start();
