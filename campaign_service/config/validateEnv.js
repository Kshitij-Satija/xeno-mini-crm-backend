module.exports = () => {
  const requiredVars = [
    "CAMPAIGN_DB_URI",           // MongoDB URI for Campaigns
    "CUSTOMER_DB_URI",           // MongoDB URI for Customers (used in campaign consumer)
    "RABBITMQ_URI",              // RabbitMQ connection string
      "DUMMY_VENDOR_URI",  // Dummy vendor API endpoint for sending messages  "VENDOR_SERVICE_URI",   
     // Public URL or gateway callback for delivery receipts "CAMPAIGN_SERVICE_PUBLIC_URL",
    "PORT",                      // Service port
    "NODE_ENV",                   // Environment (development/production)
    "API_GATEWAY_URI"
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error("Missing environment variables:", missing.join(", "));
    process.exit(1);
  }
  console.log("Environment Variables validated.")
};
