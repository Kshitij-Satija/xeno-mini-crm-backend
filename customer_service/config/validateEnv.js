module.exports = () => {
  const requiredVars = [
    "PORT",
    "CUSTOMER_DB_URI",
    "RABBITMQ_URI",
    "AUTH_GATEWAY_URL",
    "CAMPAIGN_SERVICE_URI",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error("Missing environment variables:", missing.join(", "));
    process.exit(1);
  }
};
