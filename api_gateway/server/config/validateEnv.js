const requiredEnvVars = [
  "PORT",
  "CRM_MONGO_URI",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "CUSTOMER_SERVICE_URI",
  "CAMPAIGN_SERVICE_URI",
  "FRONTEND_URI",
  "SESSION_SECRET"
];

function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1); // stop the server immediately
  }

  console.log("Environment variables validated");
}

module.exports = validateEnv;
