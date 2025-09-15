require("dotenv").config();

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const MongoStore = require("connect-mongo");

const connectDB = require("./config/db");
const validateEnv = require("./config/validateEnv");
require("./config/passport");
const keepAlive = require("./scripts/keepAlive"); 

const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const { ensureAuth } = require("./middlewares/auth.middleware");
const { proxyTo } = require("./middlewares/proxy.middleware");

validateEnv();

const app = express();
connectDB();

// ✅ CORS (Allow Vercel Frontend)
app.use(
  cors({
    origin: process.env.FRONTEND_URI || "https://xeno-minicrm.vercel.app",
    credentials: true,
  })
);

app.use(cookieParser());

app.set("trust proxy", 1);

// Mongo-backed sessions (persistent + cross-site ready)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "crm_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.CRM_MONGO_URI, // MUST be same as DB connection string
      ttl: 24 * 60 * 60, // 1 day
    }),
    cookie: {
      httpOnly: true,
      secure: true, 
      sameSite: "none", 
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Global request logging
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.originalUrl}`);
  res.on("finish", () => {
    console.log(
      `Response sent: ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`
    );
  });
  res.on("error", (err) => {
    console.error(
      `Response error: ${req.method} ${req.originalUrl} - Error: ${err}`
    );
  });
  next();
});


app.get("/", (req, res) => {
  res.json({ status: "API Gateway running" });
});

// Auth routes
app.use("/api/auth", express.json(), authRoutes);

// Health check
app.get("/api/health", (req, res) => {
  console.log("Health check hit");
  res.json({ status: "ok" });
});

// Protect all /api/* except /auth and /health
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth") || req.path === "/health") {
    return next();
  }
  ensureAuth(req, res, (err) => {
    if (err) return next(err);
    console.log("User authenticated:", req.user?.email);
    next();
  });
});

// Routes
app.use("/api/dashboard", dashboardRoutes);

// Proxies
app.use("/api/customers", ...proxyTo("/customers", process.env.CUSTOMER_SERVICE_URI));
app.use("/api/orders", ...proxyTo("/orders", process.env.CUSTOMER_SERVICE_URI));
app.use("/api/campaigns", ...proxyTo("/campaigns", process.env.CAMPAIGN_SERVICE_URI));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API Gateway running on PORT: ${PORT}`);
 keepAlive();
});
